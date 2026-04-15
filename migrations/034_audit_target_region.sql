-- 034: SEO audit target region + language (for DataForSEO location mapping)
-- Idempotent: safe to re-run.

ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS target_region VARCHAR(10) DEFAULT 'au';
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS target_language VARCHAR(10) DEFAULT 'en';
