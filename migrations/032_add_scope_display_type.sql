-- Add display_type column to quotation scope templates and sections.
-- Controls PDF rendering: 'priced' (2-column bullets + price) or 'description' (full-width prose, no price).
ALTER TABLE quotation_scope_templates
    ADD COLUMN IF NOT EXISTS display_type VARCHAR(20) NOT NULL DEFAULT 'priced';

ALTER TABLE quotation_scope_sections
    ADD COLUMN IF NOT EXISTS display_type VARCHAR(20) NOT NULL DEFAULT 'priced';
