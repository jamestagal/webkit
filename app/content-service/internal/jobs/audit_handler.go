package jobs

import (
	"encoding/json"
	"log/slog"

	"content-service/internal/seo"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// handleAuditStart receives an AuditStartMsg, creates an SEO audit engine,
// and runs the audit in a tracked goroutine.
func (m *Manager) handleAuditStart(msg *nats.Msg) {
	var startMsg AuditStartMsg
	if err := json.Unmarshal(msg.Data, &startMsg); err != nil {
		slog.Error("Failed to unmarshal audit start", "error", err)
		return
	}

	auditID, err := uuid.Parse(startMsg.AuditID)
	if err != nil {
		slog.Error("Invalid audit_id", "audit_id", startMsg.AuditID, "error", err)
		return
	}
	agencyID, err := uuid.Parse(startMsg.AgencyID)
	if err != nil {
		slog.Error("Invalid agency_id", "agency_id", startMsg.AgencyID, "error", err)
		return
	}
	clientID, err := uuid.Parse(startMsg.ClientID)
	if err != nil {
		slog.Error("Invalid client_id", "client_id", startMsg.ClientID, "error", err)
		return
	}

	slog.Info("Audit job starting",
		"audit_id", auditID,
		"agency_id", agencyID,
		"client_id", clientID,
	)

	engine := seo.New(m.db, m.dfsClient, m.cfg.AnthropicAPIKey)

	m.wg.Add(1)
	go func() {
		defer m.wg.Done()

		if err := engine.Run(m.ctx, auditID, clientID, agencyID); err != nil {
			slog.Error("Audit failed",
				"audit_id", auditID,
				"error", err,
			)
			// Mark audit as failed.
			_, dbErr := m.db.ExecContext(m.ctx,
				"UPDATE seo_audits SET status = 'failed', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
				auditID,
			)
			if dbErr != nil {
				slog.Error("Failed to update audit status to failed", "audit_id", auditID, "error", dbErr)
			}
			m.publishAuditComplete(auditID, agencyID, clientID, false, err.Error())
			return
		}

		m.publishAuditComplete(auditID, agencyID, clientID, true, "")
	}()
}

// handleAuditComplete logs the completion of an SEO audit.
func (m *Manager) handleAuditComplete(msg *nats.Msg) {
	var complete AuditCompleteMsg
	if err := json.Unmarshal(msg.Data, &complete); err != nil {
		slog.Error("Failed to unmarshal audit complete", "error", err)
		return
	}
	slog.Info("Audit completed",
		"audit_id", complete.AuditID,
		"agency_id", complete.AgencyID,
		"client_id", complete.ClientID,
		"success", complete.Success,
	)
}

// publishAuditComplete publishes an AuditCompleteMsg to NATS.
func (m *Manager) publishAuditComplete(auditID, agencyID, clientID uuid.UUID, success bool, errMsg string) {
	complete := AuditCompleteMsg{
		AuditID:  auditID.String(),
		AgencyID: agencyID.String(),
		ClientID: clientID.String(),
		Success:  success,
		Error:    errMsg,
	}

	data, err := json.Marshal(complete)
	if err != nil {
		slog.Error("Failed to marshal audit complete message", "audit_id", auditID, "error", err)
		return
	}

	if err := m.nc.Publish(SubjectAuditComplete, data); err != nil {
		slog.Error("Failed to publish audit complete", "audit_id", auditID, "error", err)
	}
}
