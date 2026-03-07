-- ============================================================================
-- MIGRATION 027: Create Missing Tables and Fix ON DELETE CASCADE Issues
-- ============================================================================
-- This migration creates 13 tables that are defined in the Drizzle schema
-- but missing from the numbered migration files. It also fixes missing
-- ON DELETE CASCADE constraints for 9 content intelligence tables.
--
-- Tables Created:
-- 1. agency_memberships
-- 2. agency_form_options
-- 3. agency_packages
-- 4. agency_addons
-- 5. agency_activity_log
-- 6. agency_document_branding
-- 7. agency_proposal_templates
-- 8. consultation_drafts
-- 9. consultation_versions
-- 10. contract_templates
-- 11. contract_schedules
-- 12. invoice_line_items
-- 13. email_logs
--
-- Cascade Fixes Applied To:
-- - content_crawl_jobs
-- - seo_audits
-- - brand_profiles
-- - content_copy
--
-- Missing Indexes Added:
-- - seo_audits(agency_id)
-- - content_crawl_jobs(agency_id)
-- - consultations(agency_id)
-- ============================================================================

-- =============================================================================
-- 1. AGENCY MEMBERSHIPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Role within agency
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    
    -- User-specific settings within agency
    display_name TEXT NOT NULL DEFAULT '',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    invited_at TIMESTAMPTZ,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    
    UNIQUE(user_id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_memberships_agency ON agency_memberships(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_memberships_user ON agency_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_memberships_status ON agency_memberships(agency_id, status);

-- =============================================================================
-- 2. AGENCY FORM OPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_form_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Option category
    category VARCHAR(100) NOT NULL,
    
    -- Option details
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Optional metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    UNIQUE(agency_id, category, value)
);

CREATE INDEX IF NOT EXISTS idx_agency_form_options_agency ON agency_form_options(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_form_options_category ON agency_form_options(agency_id, category);

-- =============================================================================
-- 3. AGENCY PACKAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Package Identity
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    
    -- Pricing Model
    pricing_model VARCHAR(50) NOT NULL,
    
    -- All prices in AUD dollars (DECIMAL for precision)
    setup_fee DECIMAL(10, 2) NOT NULL DEFAULT '0.00',
    monthly_price DECIMAL(10, 2) NOT NULL DEFAULT '0.00',
    one_time_price DECIMAL(10, 2) NOT NULL DEFAULT '0.00',
    hosting_fee DECIMAL(10, 2) NOT NULL DEFAULT '0.00',
    
    -- Terms
    minimum_term_months INTEGER NOT NULL DEFAULT 12,
    cancellation_fee_type VARCHAR(50),
    cancellation_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT '0.00',
    
    -- Included Features (JSONB array of strings)
    included_features JSONB NOT NULL DEFAULT '[]',
    max_pages INTEGER,
    
    -- Display Settings
    display_order INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    UNIQUE(agency_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_agency_packages_agency ON agency_packages(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_packages_active ON agency_packages(agency_id, is_active);

-- =============================================================================
-- 4. AGENCY ADDONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Add-on Identity
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    
    -- Pricing (AUD dollars)
    price DECIMAL(10, 2) NOT NULL,
    pricing_type VARCHAR(50) NOT NULL,
    unit_label VARCHAR(50),
    
    -- Availability (JSONB array of package slugs, empty = all packages)
    available_packages JSONB NOT NULL DEFAULT '[]',
    
    -- Display Settings
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    UNIQUE(agency_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_agency_addons_agency ON agency_addons(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_addons_active ON agency_addons(agency_id, is_active);

-- =============================================================================
-- 5. AGENCY ACTIVITY LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    
    -- Change details (for auditing)
    old_values JSONB,
    new_values JSONB,
    
    -- Request context (for security)
    ip_address TEXT,
    user_agent TEXT,
    
    -- Additional metadata
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_agency_activity_log_agency ON agency_activity_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_activity_log_user ON agency_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_activity_log_action ON agency_activity_log(agency_id, action);

-- =============================================================================
-- 6. AGENCY DOCUMENT BRANDING
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_document_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Document type: 'contract', 'invoice', 'questionnaire', 'proposal', 'email', 'quotation'
    document_type VARCHAR(50) NOT NULL,
    
    -- Toggle: use custom branding vs agency defaults
    use_custom_branding BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Branding overrides (null = use agency default)
    logo_url TEXT,
    primary_color TEXT,
    accent_color TEXT,
    accent_gradient TEXT,
    
    UNIQUE(agency_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_agency_document_branding_agency ON agency_document_branding(agency_id);

-- =============================================================================
-- 7. AGENCY PROPOSAL TEMPLATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_proposal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Template sections (JSONB for flexibility)
    sections JSONB NOT NULL DEFAULT '[]',
    
    -- Footer/Header content
    header_content TEXT NOT NULL DEFAULT '',
    footer_content TEXT NOT NULL DEFAULT '',
    
    -- PDF/Document settings
    settings JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_agency_proposal_templates_agency ON agency_proposal_templates(agency_id);

-- =============================================================================
-- 8. CONSULTATION DRAFTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS consultation_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Draft metadata
    auto_saved BOOLEAN NOT NULL DEFAULT FALSE,
    draft_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(consultation_id)
);

CREATE INDEX IF NOT EXISTS idx_consultation_drafts_user ON consultation_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_drafts_agency ON consultation_drafts(agency_id);

-- =============================================================================
-- 9. CONSULTATION VERSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS consultation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    
    -- Snapshot metadata
    status VARCHAR(50) NOT NULL,
    completion_percentage INTEGER NOT NULL,
    
    -- Version metadata
    change_summary TEXT,
    changed_fields JSONB NOT NULL DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(consultation_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_consultation_versions_user ON consultation_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_versions_agency ON consultation_versions(agency_id);

-- =============================================================================
-- 10. CONTRACT TEMPLATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Template identification
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Cover page configuration (structured JSON)
    cover_page_config JSONB NOT NULL DEFAULT '{}',
    
    -- Fixed terms & conditions content (rich text with merge fields)
    terms_content TEXT NOT NULL DEFAULT '',
    
    -- Signature configuration
    signature_config JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_agency ON contract_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON contract_templates(agency_id, is_active);

-- =============================================================================
-- 11. CONTRACT SCHEDULES
-- =============================================================================

CREATE TABLE IF NOT EXISTS contract_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    template_id UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
    
    -- Link to package (determines when this schedule is used)
    package_id UUID REFERENCES agency_packages(id) ON DELETE SET NULL,
    
    -- Schedule identification
    name VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    
    -- Category for organizing the reusable schedule library
    section_category VARCHAR(100) NOT NULL DEFAULT 'custom',
    
    -- Schedule content (rich text with merge fields)
    content TEXT NOT NULL DEFAULT '',
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_contract_schedules_template ON contract_schedules(template_id);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_package ON contract_schedules(package_id);

-- =============================================================================
-- 12. INVOICE LINE ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Line item details
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT '1.00',
    unit_price DECIMAL(10, 2) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    
    -- Tax handling per line item
    is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Optional categorization
    category VARCHAR(50),
    
    -- Reference to package/addon if applicable
    package_id UUID REFERENCES agency_packages(id) ON DELETE SET NULL,
    addon_id UUID REFERENCES agency_addons(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- =============================================================================
-- 13. EMAIL LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Agency scope
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    
    -- Related entities (all optional, at least one should be set)
    proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    form_submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    
    -- Email type
    email_type VARCHAR(50) NOT NULL,
    
    -- Email details
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    
    -- Attachment info
    has_attachment BOOLEAN NOT NULL DEFAULT FALSE,
    attachment_filename VARCHAR(255),
    
    -- Resend tracking
    resend_message_id VARCHAR(100),
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Sender info
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_logs_agency ON email_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_proposal ON email_logs(proposal_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_invoice ON email_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contract ON email_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_form_submission ON email_logs(form_submission_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_quotation ON email_logs(quotation_id);

-- =============================================================================
-- FIX MISSING ON DELETE CASCADE FOR CONTENT INTELLIGENCE TABLES
-- =============================================================================
-- These tables are already created by migration 021_content_intelligence.sql
-- but are missing ON DELETE CASCADE constraints on agency_id foreign keys.

-- 1. content_crawl_jobs - Add ON DELETE CASCADE to agency_id
ALTER TABLE content_crawl_jobs DROP CONSTRAINT IF EXISTS content_crawl_jobs_agency_id_fkey;
ALTER TABLE content_crawl_jobs ADD CONSTRAINT content_crawl_jobs_agency_id_fkey 
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;

-- 3. seo_audits - Add ON DELETE CASCADE to agency_id
ALTER TABLE seo_audits DROP CONSTRAINT IF EXISTS seo_audits_agency_id_fkey;
ALTER TABLE seo_audits ADD CONSTRAINT seo_audits_agency_id_fkey 
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;

-- 7. brand_profiles - Add ON DELETE CASCADE to agency_id
ALTER TABLE brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_agency_id_fkey;
ALTER TABLE brand_profiles ADD CONSTRAINT brand_profiles_agency_id_fkey 
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;

-- 9. content_copy - Add ON DELETE CASCADE to agency_id
ALTER TABLE content_copy DROP CONSTRAINT IF EXISTS content_copy_agency_id_fkey;
ALTER TABLE content_copy ADD CONSTRAINT content_copy_agency_id_fkey 
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;

-- =============================================================================
-- ADD MISSING INDEXES ON agency_id COLUMNS
-- =============================================================================

-- Ensure indexes exist for agency_id filtering in key tables
CREATE INDEX IF NOT EXISTS idx_seo_audits_agency ON seo_audits(agency_id);
CREATE INDEX IF NOT EXISTS idx_content_crawl_jobs_agency ON content_crawl_jobs(agency_id);
CREATE INDEX IF NOT EXISTS idx_consultations_agency ON consultations(agency_id);
