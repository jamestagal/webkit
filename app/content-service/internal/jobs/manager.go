package jobs

import (
	"context"
	"database/sql"
	"log/slog"
	"sync"

	"app/pkg/cfbrowser"
	"app/pkg/jina"
	"content-service/config"
	"content-service/internal/embeddings"

	"github.com/nats-io/nats.go"
)

// Manager subscribes to NATS subjects and dispatches crawl, embedding,
// and future content-intelligence jobs.
type Manager struct {
	db          *sql.DB
	nc          *nats.Conn
	cfg         *config.Config
	cfClient    *cfbrowser.Client
	jinaClient  *jina.Client
	embedClient *embeddings.Client
	subs        []*nats.Subscription
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

// NewManager creates a job manager wired to the given dependencies.
func NewManager(
	db *sql.DB,
	nc *nats.Conn,
	cfg *config.Config,
	cf *cfbrowser.Client,
	jinaClient *jina.Client,
	embed *embeddings.Client,
) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		db:          db,
		nc:          nc,
		cfg:         cfg,
		cfClient:    cf,
		jinaClient:  jinaClient,
		embedClient: embed,
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start subscribes to all NATS job subjects.
func (m *Manager) Start() error {
	subjects := []struct {
		subject string
		handler nats.MsgHandler
	}{
		{SubjectCrawlStart, m.handleCrawlStart},
		{SubjectCrawlPage, m.handleCrawlPage},
		{SubjectCrawlComplete, m.handleCrawlComplete},
		{SubjectProfileGenerate, m.handleProfileGenerate},
		{SubjectAuditStart, m.handleAuditStart},
		{SubjectAuditComplete, m.handleAuditComplete},
		{SubjectGenerateCopy, m.handleGenerateCopy},
		{SubjectGenerateBulk, m.handleGenerateBulk},
	}

	for _, s := range subjects {
		sub, err := m.nc.Subscribe(s.subject, s.handler)
		if err != nil {
			// Unsubscribe any already-registered subscriptions before returning.
			m.unsubscribeAll()
			return err
		}
		m.subs = append(m.subs, sub)
		slog.Info("Subscribed", "subject", s.subject)
	}

	if err := m.nc.Flush(); err != nil {
		m.unsubscribeAll()
		return err
	}

	slog.Info("Job manager started", "subscriptions", len(m.subs))
	return nil
}

// Stop gracefully shuts down the job manager: cancels the context,
// unsubscribes from NATS, and waits for in-flight goroutines.
func (m *Manager) Stop() {
	m.cancel()
	m.unsubscribeAll()
	m.wg.Wait()
	slog.Info("Job manager stopped")
}

// unsubscribeAll drains and unsubscribes all active NATS subscriptions.
func (m *Manager) unsubscribeAll() {
	for _, sub := range m.subs {
		if sub.IsValid() {
			if err := sub.Unsubscribe(); err != nil {
				slog.Warn("Failed to unsubscribe", "subject", sub.Subject, "error", err)
			}
		}
	}
	m.subs = nil
}
