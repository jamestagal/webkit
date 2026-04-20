-- 037: Proposal-specific branding override columns on agency_document_branding.
-- Enables granular per-field overrides for the proposal document type (cover
-- bg/text, section heading, CTA button bg/text, footer bg). Idempotent: uses
-- ADD COLUMN IF NOT EXISTS and wraps CHECK constraint creation in an
-- EXCEPTION-trapping DO block (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
-- Text-color columns cascade to NULL at the resolver layer; consumers omit
-- inline styles so text keeps inheriting `text-base-content`.

ALTER TABLE agency_document_branding
    ADD COLUMN IF NOT EXISTS cover_bg_color        TEXT,
    ADD COLUMN IF NOT EXISTS cover_text_color      TEXT,
    ADD COLUMN IF NOT EXISTS section_heading_color TEXT,
    ADD COLUMN IF NOT EXISTS cta_button_color      TEXT,
    ADD COLUMN IF NOT EXISTS cta_button_text_color TEXT,
    ADD COLUMN IF NOT EXISTS footer_bg_color       TEXT;

-- Hex-format CHECK constraints (mirror the Valibot regex in
-- document-branding.remote.ts). Each wrapped in its own DO block so a re-run
-- skips cleanly.

DO $$ BEGIN
    ALTER TABLE agency_document_branding
        ADD CONSTRAINT agency_document_branding_cover_bg_color_hex_chk
        CHECK (cover_bg_color IS NULL OR cover_bg_color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE agency_document_branding
        ADD CONSTRAINT agency_document_branding_cover_text_color_hex_chk
        CHECK (cover_text_color IS NULL OR cover_text_color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE agency_document_branding
        ADD CONSTRAINT agency_document_branding_section_heading_color_hex_chk
        CHECK (section_heading_color IS NULL OR section_heading_color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE agency_document_branding
        ADD CONSTRAINT agency_document_branding_cta_button_color_hex_chk
        CHECK (cta_button_color IS NULL OR cta_button_color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE agency_document_branding
        ADD CONSTRAINT agency_document_branding_cta_button_text_color_hex_chk
        CHECK (cta_button_text_color IS NULL OR cta_button_text_color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE agency_document_branding
        ADD CONSTRAINT agency_document_branding_footer_bg_color_hex_chk
        CHECK (footer_bg_color IS NULL OR footer_bg_color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend valid_document_type to allow 'quotation'. The existing constraint
-- predates the quotation system (see schema.ts DocumentType) and would block
-- the new Quotations branding tab from saving.
ALTER TABLE agency_document_branding
    DROP CONSTRAINT IF EXISTS valid_document_type;
DO $$ BEGIN
    ALTER TABLE agency_document_branding
        ADD CONSTRAINT valid_document_type
        CHECK (document_type IN ('contract', 'invoice', 'questionnaire', 'proposal', 'email', 'quotation'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
