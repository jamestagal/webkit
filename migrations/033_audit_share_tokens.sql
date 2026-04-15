-- 033: Shareable SEO audit reports — token columns + view analytics
-- Idempotent: safe to re-run.

ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ;
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS share_view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS share_first_viewed_at TIMESTAMPTZ;
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS share_last_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_seo_audits_share_token
  ON seo_audits(share_token)
  WHERE share_token IS NOT NULL;
