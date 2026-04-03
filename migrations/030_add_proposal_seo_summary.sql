-- Add SEO summary section to proposals for AI-generated SEO health summary
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS seo_summary TEXT NOT NULL DEFAULT '';
