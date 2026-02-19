package jobs

// NATS subject constants for the content service job queue.
const (
	SubjectCrawlStart      = "content.crawl.start"
	SubjectCrawlPage       = "content.crawl.page"
	SubjectCrawlComplete   = "content.crawl.complete"
	SubjectProfileGenerate = "content.profile.generate"
	SubjectAuditStart      = "content.audit.start"
	SubjectAuditComplete   = "content.audit.complete"
	SubjectGenerateCopy    = "content.generate.copy"
	SubjectGenerateBulk    = "content.generate.bulk"
)

// CrawlStartMsg triggers a full website crawl for a client.
type CrawlStartMsg struct {
	JobID       string `json:"job_id"`
	AgencyID    string `json:"agency_id"`
	ClientID    string `json:"client_id"`
	SourceURL   string `json:"source_url"`
	MaxDepth    int    `json:"max_depth"`
	CrawlType   string `json:"crawl_type"`
	CrawlTarget string `json:"crawl_target"`
}

// CrawlPageMsg triggers embedding generation for a single crawled page.
type CrawlPageMsg struct {
	JobID    string `json:"job_id"`
	ClientID string `json:"client_id"`
	PageID   string `json:"page_id"`
	URL      string `json:"url"`
}

// CrawlCompleteMsg is published when a crawl job finishes (success or failure).
type CrawlCompleteMsg struct {
	JobID        string `json:"job_id"`
	AgencyID     string `json:"agency_id"`
	ClientID     string `json:"client_id"`
	TotalPages   int    `json:"total_pages"`
	PagesChanged int    `json:"pages_changed"`
	Success      bool   `json:"success"`
	Error        string `json:"error,omitempty"`
}

// ProfileGenerateMsg triggers brand profile generation for a client.
type ProfileGenerateMsg struct {
	AgencyID string `json:"agency_id"`
	ClientID string `json:"client_id"`
}

// AuditStartMsg triggers an SEO audit for a client.
type AuditStartMsg struct {
	AuditID  string `json:"audit_id"`
	AgencyID string `json:"agency_id"`
	ClientID string `json:"client_id"`
}
