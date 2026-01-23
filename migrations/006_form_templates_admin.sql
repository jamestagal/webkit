-- Phase 7: Super Admin Form Templates Management
-- System template additions
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS new_until TIMESTAMPTZ;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

-- Agency form tracking (link back to source template)
ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL;
ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS is_customized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agency_forms ADD COLUMN IF NOT EXISTS previous_schema JSONB;

CREATE INDEX IF NOT EXISTS agency_forms_source_template_idx ON agency_forms (source_template_id) WHERE source_template_id IS NOT NULL;
