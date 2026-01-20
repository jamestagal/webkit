-- Enable required extensions
create extension if not exists pg_trgm;

-- create "tokens" table
create table if not exists tokens (
    id text primary key not null,
    expires timestamptz not null,
    target text not null,
    callback text not null default ''
);

-- create "users" table
create table if not exists users (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    email text not null,
    phone text not null default '',
    access bigint not null,
    sub text not null,
    avatar text not null default '',
    customer_id text not null default '',
    subscription_id text not null default '',
    subscription_end timestamptz not null default '2000-01-01 00:00:00',
    api_key text not null default '',
    default_agency_id uuid,  -- Added for multi-tenancy
    -- Suspension (super-admin controlled)
    suspended boolean not null default false,
    suspended_at timestamptz,
    suspended_reason text,
    unique (email, sub)
);

-- =============================================================================
-- AGENCY / MULTI-TENANCY TABLES
-- =============================================================================

-- create "agencies" table - Core tenant table
create table if not exists agencies (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    -- Basic Information
    name text not null,
    slug text not null unique,  -- URL-friendly identifier (e.g., "acme-agency")

    -- Branding
    logo_url text not null default '',  -- Horizontal logo for documents
    logo_avatar_url text not null default '',  -- Square avatar logo for nav/UI
    primary_color text not null default '#4F46E5',  -- Indigo-600
    secondary_color text not null default '#1E40AF',  -- Blue-800
    accent_color text not null default '#F59E0B',  -- Amber-500
    accent_gradient text not null default '',  -- CSS gradient for backgrounds

    -- Contact
    email text not null default '',
    phone text not null default '',
    website text not null default '',

    -- Status & Billing
    status varchar(50) not null default 'active',
    subscription_tier varchar(50) not null default 'free',  -- free, starter, pro, enterprise
    subscription_id text not null default '',  -- Stripe subscription ID
    subscription_end timestamptz,

    -- AI Generation Rate Limiting
    ai_generations_this_month integer not null default 0,
    ai_generations_reset_at timestamptz,

    -- Freemium access (beta/partner programs)
    is_freemium boolean not null default false,
    freemium_reason varchar(50),  -- beta_tester, partner, promotional, early_signup, referral_reward, internal
    freemium_expires_at timestamptz,
    freemium_granted_at timestamptz,
    freemium_granted_by varchar(255),

    constraint valid_agency_status check (status in ('active', 'suspended', 'cancelled'))
);

-- create "agency_memberships" table - User-Agency relationships
create table if not exists agency_memberships (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    user_id uuid not null references users(id) on delete cascade,
    agency_id uuid not null references agencies(id) on delete cascade,

    -- Role within agency
    role varchar(50) not null default 'member',

    -- User-specific settings within agency
    display_name text not null default '',  -- Optional override for proposals

    -- Status
    status varchar(50) not null default 'active',
    invited_at timestamptz,
    invited_by uuid references users(id) on delete set null,
    accepted_at timestamptz,

    unique(user_id, agency_id),

    constraint valid_membership_role check (role in ('owner', 'admin', 'member')),
    constraint valid_membership_status check (status in ('active', 'invited', 'suspended'))
);

-- create "agency_form_options" table - Configurable form presets per agency
create table if not exists agency_form_options (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,

    -- Option category (maps to form components)
    -- Examples: 'budget_range', 'industry', 'business_type', 'digital_presence',
    --           'marketing_channels', 'challenges', 'technical_issues',
    --           'solution_gaps', 'primary_goals', 'secondary_goals',
    --           'success_metrics', 'kpis', 'budget_constraints', 'urgency'
    category varchar(100) not null,

    -- Option details
    value text not null,          -- Internal value (e.g., "under-5k")
    label text not null,          -- Display label (e.g., "Under $5,000")
    sort_order integer not null default 0,
    is_default boolean not null default false,  -- Show by default in quick-add
    is_active boolean not null default true,

    -- Optional metadata
    metadata jsonb not null default '{}',  -- For extra data like color coding

    unique(agency_id, category, value)
);

-- create "agency_proposal_templates" table - Proposal customization per agency
create table if not exists agency_proposal_templates (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,

    name text not null,
    is_default boolean not null default false,

    -- Template sections (JSONB for flexibility)
    sections jsonb not null default '[]',
    -- Example structure:
    -- [
    --   { "id": "cover", "title": "Cover Page", "enabled": true, "content": "..." },
    --   { "id": "executive_summary", "title": "Executive Summary", "enabled": true },
    --   { "id": "scope", "title": "Project Scope", "enabled": true },
    --   { "id": "pricing", "title": "Pricing", "enabled": true },
    --   { "id": "terms", "title": "Terms & Conditions", "enabled": true, "content": "..." }
    -- ]

    -- Footer/Header content
    header_content text not null default '',
    footer_content text not null default '',

    -- PDF/Document settings
    settings jsonb not null default '{}'
    -- { "font_family": "Inter", "font_size": 12, "margin": "1in" }
);

-- =============================================================================
-- AUDIT TRAIL & COMPLIANCE
-- =============================================================================

-- create "agency_activity_log" table - Audit trail for compliance
create table if not exists agency_activity_log (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,
    user_id uuid references users(id) on delete set null,  -- Nullable for system actions

    -- Action details
    action varchar(100) not null,  -- e.g., 'member.invited', 'settings.updated', 'consultation.created'
    entity_type varchar(50) not null,  -- e.g., 'member', 'consultation', 'agency', 'proposal'
    entity_id uuid,  -- ID of the affected entity

    -- Change details (for auditing)
    old_values jsonb,  -- Previous values (for updates)
    new_values jsonb,  -- New values (for creates/updates)

    -- Request context (for security)
    ip_address inet,
    user_agent text,

    -- Additional metadata
    metadata jsonb not null default '{}'
);

-- Add soft delete columns to agencies table (for GDPR compliance)
alter table agencies add column if not exists deleted_at timestamptz;
alter table agencies add column if not exists deletion_scheduled_for timestamptz;

-- Add slug format constraint (lowercase alphanumeric with hyphens, 3-50 chars)
-- Note: This validates new slugs but allows existing invalid ones
alter table agencies drop constraint if exists chk_slug_format;
alter table agencies add constraint chk_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' or length(slug) = 1);

-- Indexes for agencies
create index if not exists idx_agencies_slug on agencies(slug);
create index if not exists idx_agencies_status on agencies(status);

-- Indexes for agency_memberships
create index if not exists idx_agency_memberships_user_id on agency_memberships(user_id);
create index if not exists idx_agency_memberships_agency_id on agency_memberships(agency_id);
create index if not exists idx_agency_memberships_role on agency_memberships(role);
create index if not exists idx_agency_memberships_status on agency_memberships(status);

-- Indexes for agency_form_options
create index if not exists idx_agency_form_options_agency_id on agency_form_options(agency_id);
create index if not exists idx_agency_form_options_category on agency_form_options(agency_id, category);
create index if not exists idx_agency_form_options_active on agency_form_options(agency_id, is_active);

-- Indexes for agency_proposal_templates
create index if not exists idx_agency_proposal_templates_agency_id on agency_proposal_templates(agency_id);
create index if not exists idx_agency_proposal_templates_default on agency_proposal_templates(agency_id, is_default);

-- Indexes for agency_activity_log
create index if not exists idx_activity_agency_created on agency_activity_log(agency_id, created_at desc);
create index if not exists idx_activity_entity on agency_activity_log(entity_type, entity_id);
create index if not exists idx_activity_user on agency_activity_log(user_id);
create index if not exists idx_activity_action on agency_activity_log(action);

-- Index for soft deleted agencies
create index if not exists idx_agencies_deleted on agencies(deleted_at) where deleted_at is not null;

-- Index for freemium agencies
create index if not exists idx_agencies_freemium on agencies(is_freemium) where is_freemium = true;

-- Add foreign key for users.default_agency_id (after agencies table exists)
-- Note: This needs to be run after agencies table is created
alter table users add constraint fk_users_default_agency
    foreign key (default_agency_id) references agencies(id) on delete set null;

-- =============================================================================
-- BETA INVITES (Super-Admin Feature)
-- =============================================================================

-- create "beta_invites" table - Manage beta tester invitations
create table if not exists beta_invites (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,

    -- Invite target
    email varchar(255) not null,

    -- Token for URL (unique per invite, allows re-inviting same email)
    token varchar(100) not null unique,

    -- Status: pending, used, expired, revoked
    status varchar(20) not null default 'pending',

    -- Who created this invite
    created_by uuid references users(id) on delete set null,

    -- Usage tracking
    used_at timestamptz,
    used_by_agency_id uuid references agencies(id) on delete set null,

    -- Expiration (30 days from creation by default)
    expires_at timestamptz not null,

    -- Optional notes for admin reference
    notes text,

    constraint valid_beta_invite_status check (status in ('pending', 'used', 'expired', 'revoked'))
);

-- Indexes for beta_invites
create index if not exists idx_beta_invites_email on beta_invites(email);
create index if not exists idx_beta_invites_token on beta_invites(token);
create index if not exists idx_beta_invites_status on beta_invites(status);
create index if not exists idx_beta_invites_created_at on beta_invites(created_at);

-- =============================================================================
-- AGENCY PROFILES, PACKAGES & ADD-ONS (V2 Foundation)
-- =============================================================================

-- create "agency_profiles" table - Extended business details for documents
create table if not exists agency_profiles (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null unique references agencies(id) on delete cascade,

    -- Business Registration
    abn varchar(20) not null default '',
    acn varchar(20) not null default '',
    legal_entity_name text not null default '',
    trading_name text not null default '',

    -- Address
    address_line_1 text not null default '',
    address_line_2 text not null default '',
    city varchar(100) not null default '',
    state varchar(50) not null default '',
    postcode varchar(20) not null default '',
    country varchar(100) not null default 'Australia',

    -- Banking (for invoice display)
    bank_name varchar(100) not null default '',
    bsb varchar(10) not null default '',
    account_number varchar(30) not null default '',
    account_name text not null default '',

    -- Tax & GST
    gst_registered boolean not null default true,
    tax_file_number varchar(20) not null default '',
    gst_rate decimal(5,2) not null default 10.00,

    -- Social & Branding
    tagline text not null default '',
    social_linkedin text not null default '',
    social_facebook text not null default '',
    social_instagram text not null default '',
    social_twitter text not null default '',
    brand_font varchar(100) not null default '',

    -- Document Defaults
    default_payment_terms varchar(50) not null default 'NET_14',
    invoice_prefix varchar(20) not null default 'INV',
    invoice_footer text not null default '',
    next_invoice_number integer not null default 1,
    contract_prefix varchar(20) not null default 'CON',
    contract_footer text not null default '',
    next_contract_number integer not null default 1,
    proposal_prefix varchar(20) not null default 'PROP',
    next_proposal_number integer not null default 1,

    -- Stripe Connect
    stripe_account_id varchar(255),
    stripe_account_status varchar(50) not null default 'not_connected',
    stripe_onboarding_complete boolean not null default false,
    stripe_connected_at timestamptz,
    stripe_payouts_enabled boolean not null default false,
    stripe_charges_enabled boolean not null default false,

    constraint valid_payment_terms check (default_payment_terms in ('DUE_ON_RECEIPT', 'NET_7', 'NET_14', 'NET_30')),
    constraint valid_stripe_status check (stripe_account_status in ('not_connected', 'pending', 'active', 'restricted', 'disabled'))
);

-- create "agency_packages" table - Configurable pricing tiers per agency
create table if not exists agency_packages (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,

    -- Package Identity
    name varchar(100) not null,
    slug varchar(50) not null,
    description text not null default '',

    -- Pricing Model
    pricing_model varchar(50) not null,

    -- All prices in AUD dollars (DECIMAL for precision)
    setup_fee decimal(10,2) not null default 0.00,
    monthly_price decimal(10,2) not null default 0.00,
    one_time_price decimal(10,2) not null default 0.00,
    hosting_fee decimal(10,2) not null default 0.00,

    -- Terms
    minimum_term_months integer not null default 12,
    cancellation_fee_type varchar(50),
    cancellation_fee_amount decimal(10,2) not null default 0.00,

    -- Included Features (JSONB array of strings)
    included_features jsonb not null default '[]',
    max_pages integer,  -- NULL = unlimited

    -- Display Settings
    display_order integer not null default 0,
    is_featured boolean not null default false,
    is_active boolean not null default true,

    unique(agency_id, slug),

    constraint valid_pricing_model check (pricing_model in ('subscription', 'lump_sum', 'hybrid')),
    constraint valid_cancellation_fee_type check (cancellation_fee_type is null or cancellation_fee_type in ('none', 'fixed', 'remaining_balance'))
);

-- create "agency_addons" table - Optional services per package
create table if not exists agency_addons (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,

    -- Add-on Identity
    name varchar(100) not null,
    slug varchar(50) not null,
    description text not null default '',

    -- Pricing (AUD dollars)
    price decimal(10,2) not null,
    pricing_type varchar(50) not null,
    unit_label varchar(50),  -- e.g., "page", "hour" (for per_unit)

    -- Availability (JSONB array of package slugs, empty = all packages)
    available_packages jsonb not null default '[]',

    -- Display Settings
    display_order integer not null default 0,
    is_active boolean not null default true,

    unique(agency_id, slug),

    constraint valid_pricing_type check (pricing_type in ('one_time', 'monthly', 'per_unit'))
);

-- Indexes for agency_profiles
create index if not exists idx_agency_profiles_agency_id on agency_profiles(agency_id);

-- Indexes for agency_packages
create index if not exists idx_agency_packages_agency_id on agency_packages(agency_id);
create index if not exists idx_agency_packages_slug on agency_packages(agency_id, slug);
create index if not exists idx_agency_packages_active on agency_packages(agency_id, is_active);
create index if not exists idx_agency_packages_display_order on agency_packages(agency_id, display_order);

-- Indexes for agency_addons
create index if not exists idx_agency_addons_agency_id on agency_addons(agency_id);
create index if not exists idx_agency_addons_slug on agency_addons(agency_id, slug);
create index if not exists idx_agency_addons_active on agency_addons(agency_id, is_active);
create index if not exists idx_agency_addons_display_order on agency_addons(agency_id, display_order);

-- create "agency_document_branding" table - Per-document branding overrides
create table if not exists agency_document_branding (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,

    -- Document type: 'contract', 'invoice', 'questionnaire', 'proposal', 'email'
    document_type varchar(50) not null,

    -- Toggle: use custom branding vs agency defaults
    use_custom_branding boolean not null default false,

    -- Branding overrides (null = use agency default)
    logo_url text,
    primary_color text,
    accent_color text,
    accent_gradient text,

    unique(agency_id, document_type),
    constraint valid_document_type check (document_type in ('contract', 'invoice', 'questionnaire', 'proposal', 'email'))
);

-- Indexes for agency_document_branding
create index if not exists idx_agency_document_branding_agency_id on agency_document_branding(agency_id);
create index if not exists idx_agency_document_branding_type on agency_document_branding(agency_id, document_type);

-- create "files" table
create table if not exists files (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    file_key text not null,
    file_name text not null,
    file_size bigint not null,
    content_type text not null
);

-- create "emails" table
create table if not exists emails (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    email_to text not null,
    email_from text not null,
    email_subject text not null,
    email_body text not null
);

-- create "email_attachments" table
create table if not exists email_attachments (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    email_id uuid not null,
    file_name text not null,
    content_type text not null
);

-- create "notes" table
create table if not exists notes (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,
    title text not null,
    category text not null,
    content text not null
);

-- create "consultations" table with new structure
create table if not exists consultations (
    id uuid primary key not null default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    agency_id uuid references agencies(id) on delete cascade,  -- Added for multi-tenancy

    -- Contact Information (JSONB structure)
    contact_info jsonb not null default '{}',
    -- {
    --   "business_name": "string",
    --   "contact_person": "string",
    --   "email": "string",
    --   "phone": "string",
    --   "website": "string",
    --   "social_media": {
    --     "linkedin": "string",
    --     "facebook": "string",
    --     "instagram": "string"
    --   }
    -- }

    -- Business Context (JSONB structure)
    business_context jsonb not null default '{}',
    -- {
    --   "industry": "string",
    --   "business_type": "string",
    --   "team_size": "number",
    --   "current_platform": "string",
    --   "digital_presence": ["string"],
    --   "marketing_channels": ["string"]
    -- }

    -- Pain Points & Challenges (JSONB structure)
    pain_points jsonb not null default '{}',
    -- {
    --   "primary_challenges": ["string"],
    --   "technical_issues": ["string"],
    --   "urgency_level": "string", // "low", "medium", "high", "critical"
    --   "impact_assessment": "string",
    --   "current_solution_gaps": ["string"]
    -- }

    -- Goals & Objectives (JSONB structure)
    goals_objectives jsonb not null default '{}',
    -- {
    --   "primary_goals": ["string"],
    --   "secondary_goals": ["string"],
    --   "success_metrics": ["string"],
    --   "kpis": ["string"],
    --   "timeline": {
    --     "desired_start": "string",
    --     "target_completion": "string",
    --     "milestones": ["string"]
    --   },
    --   "budget_range": "string",
    --   "budget_constraints": ["string"]
    -- }

    -- Metadata
    status varchar(50) not null default 'draft',
    completion_percentage integer not null default 0 check (completion_percentage >= 0 and completion_percentage <= 100),

    -- Timestamps (NOT NULL with defaults for created/updated, nullable for completed)
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    completed_at timestamptz,

    -- Constraints
    constraint valid_status check (status in ('draft', 'completed', 'archived'))
);

-- create "consultation_drafts" table with new structure
create table if not exists consultation_drafts (
    id uuid primary key not null default gen_random_uuid(),
    consultation_id uuid not null references consultations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    agency_id uuid references agencies(id) on delete cascade,  -- Added for multi-tenancy

    -- Draft data (same structure as consultations)
    contact_info jsonb not null default '{}',
    business_context jsonb not null default '{}',
    pain_points jsonb not null default '{}',
    goals_objectives jsonb not null default '{}',

    -- Draft metadata (NOT NULL with defaults)
    auto_saved boolean not null default false,
    draft_notes text,

    -- Timestamps (NOT NULL with defaults)
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    -- Ensure one active draft per consultation
    unique(consultation_id)
);

-- create "consultation_versions" table with new structure
create table if not exists consultation_versions (
    id uuid primary key not null default gen_random_uuid(),
    consultation_id uuid not null references consultations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    agency_id uuid references agencies(id) on delete cascade,  -- Added for multi-tenancy
    version_number integer not null,

    -- Snapshot of consultation data at this version
    contact_info jsonb not null default '{}',
    business_context jsonb not null default '{}',
    pain_points jsonb not null default '{}',
    goals_objectives jsonb not null default '{}',
    status varchar(50) not null,
    completion_percentage integer not null,

    -- Version metadata
    change_summary text,
    changed_fields jsonb not null default '[]',

    -- Timestamps (NOT NULL with default)
    created_at timestamptz not null default current_timestamp,

    -- Ensure unique version numbers per consultation
    unique(consultation_id, version_number)
);

-- Indexes for consultations
create index if not exists idx_consultations_user_id on consultations(user_id);
create index if not exists idx_consultations_agency_id on consultations(agency_id);
create index if not exists idx_consultations_status on consultations(status);
create index if not exists idx_consultations_created_at on consultations(created_at);
create index if not exists idx_consultations_updated_at on consultations(updated_at);

-- JSONB indexes for efficient querying (using btree for text values)
create index if not exists idx_consultations_contact_business_name on consultations ((contact_info->>'business_name'));
create index if not exists idx_consultations_business_industry on consultations ((business_context->>'industry'));
create index if not exists idx_consultations_urgency on consultations ((pain_points->>'urgency_level'));

-- Indexes for consultation_drafts
create index if not exists idx_consultation_drafts_consultation_id on consultation_drafts(consultation_id);
create index if not exists idx_consultation_drafts_user_id on consultation_drafts(user_id);
create index if not exists idx_consultation_drafts_agency_id on consultation_drafts(agency_id);
create index if not exists idx_consultation_drafts_updated_at on consultation_drafts(updated_at);

-- Indexes for consultation_versions
create index if not exists idx_consultation_versions_consultation_id on consultation_versions(consultation_id);
create index if not exists idx_consultation_versions_user_id on consultation_versions(user_id);
create index if not exists idx_consultation_versions_agency_id on consultation_versions(agency_id);
create index if not exists idx_consultation_versions_created_at on consultation_versions(created_at);
create index if not exists idx_consultation_versions_version_number on consultation_versions(consultation_id, version_number);

-- =============================================================================
-- PROPOSALS (V2 Document Generation)
-- =============================================================================

-- create "proposals" table - Client proposals generated from consultations
create table if not exists proposals (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,

    -- Link to consultation (optional - can create standalone proposals)
    consultation_id uuid references consultations(id) on delete set null,

    -- Document identification
    proposal_number varchar(50) not null,  -- PROP-2025-0001
    slug varchar(100) not null unique,     -- Public URL slug

    -- Status workflow: draft, sent, viewed, accepted, declined, expired
    status varchar(50) not null default 'draft',

    -- Client info (denormalized for standalone proposals or overrides)
    client_business_name text not null default '',
    client_contact_name text not null default '',
    client_email varchar(255) not null default '',
    client_phone varchar(50) not null default '',
    client_website text not null default '',

    -- Cover & Introduction
    title text not null default 'Website Proposal',
    cover_image text,  -- Optional hero image URL

    -- Performance Analysis (manual entry after PageSpeed audit)
    performance_data jsonb not null default '{}',
    -- { performance: 45, accessibility: 78, bestPractices: 82, seo: 65, loadTime: '4.2s', issues: [...] }

    -- The Opportunity (manual research about client's industry/business)
    opportunity_content text not null default '',

    -- Current Issues (checklist items)
    current_issues jsonb not null default '[]',
    -- [{ text: 'Site is not mobile responsive', checked: true }, ...]

    -- Compliance Issues (optional section)
    compliance_issues jsonb not null default '[]',
    -- [{ text: 'WCAG accessibility standards not met', checked: true }, ...]

    -- ROI Analysis (optional section)
    roi_analysis jsonb not null default '{}',
    -- { currentVisitors: 500, projectedVisitors: 1500, conversionRate: 2.5, projectedLeads: 37 }

    -- Performance Standards (metrics the new site will achieve)
    performance_standards jsonb not null default '[]',
    -- [{ label: 'Page Load', value: '<2s' }, { label: 'Mobile Score', value: '95+' }, ...]

    -- Local Advantage (optional section for local SEO focus)
    local_advantage_content text not null default '',

    -- Site Architecture (proposed pages)
    proposed_pages jsonb not null default '[]',
    -- [{ name: 'Home', description: 'Modern homepage with...', features: [...] }, ...]

    -- Implementation Timeline
    timeline jsonb not null default '[]',
    -- [{ week: '1-2', title: 'Discovery & Design', description: '...' }, ...]

    -- Closing section
    closing_content text not null default '',

    -- Package selection
    selected_package_id uuid references agency_packages(id) on delete set null,
    selected_addons jsonb not null default '[]',  -- addon IDs

    -- Price overrides (if different from package defaults)
    custom_pricing jsonb,  -- { setupFee, monthlyPrice, discountPercent, discountNote }

    -- Validity
    valid_until timestamptz,

    -- Tracking
    view_count integer not null default 0,
    last_viewed_at timestamptz,
    sent_at timestamptz,
    accepted_at timestamptz,
    declined_at timestamptz,

    -- Client response fields (PART 2: Proposal Improvements)
    client_comments text not null default '',           -- Optional comments when client accepts
    decline_reason text not null default '',            -- Optional reason when client declines
    revision_request_notes text not null default '',    -- Required notes for revision requests
    revision_requested_at timestamptz,

    -- New content sections (PART 2: Proposal Improvements)
    executive_summary text not null default '',         -- Brief proposal overview
    next_steps jsonb not null default '[]',             -- Array of {text, completed} items

    -- Consultation data cache (PART 2: Proposal Improvements)
    consultation_pain_points jsonb not null default '{}',   -- Cached from consultation
    consultation_goals jsonb not null default '{}',         -- Cached from consultation
    consultation_challenges jsonb not null default '[]',    -- Array of challenge strings

    -- Creator
    created_by uuid references users(id) on delete set null,

    constraint valid_proposal_status check (status in ('draft', 'ready', 'sent', 'viewed', 'accepted', 'declined', 'revision_requested', 'expired'))
);

-- Indexes for proposals
create index if not exists idx_proposals_agency_id on proposals(agency_id);
create index if not exists idx_proposals_consultation_id on proposals(consultation_id);
create index if not exists idx_proposals_status on proposals(status);
create index if not exists idx_proposals_slug on proposals(slug);
create index if not exists idx_proposals_created_at on proposals(created_at desc);
create index if not exists idx_proposals_client_email on proposals(client_email);

-- =============================================================================
-- CONTRACTS (V2 Document Generation)
-- =============================================================================

-- create "contract_templates" table - Agency contract configuration
create table if not exists contract_templates (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,

    name varchar(255) not null,
    description text not null default '',
    version integer not null default 1,

    cover_page_config jsonb not null default '{}',
    terms_content text not null default '',
    signature_config jsonb not null default '{}',

    is_default boolean not null default false,
    is_active boolean not null default true,

    created_by uuid references users(id) on delete set null
);

create index if not exists idx_contract_templates_agency_id on contract_templates(agency_id);
create index if not exists idx_contract_templates_active on contract_templates(agency_id, is_active);

-- create "contract_schedules" table - Package-specific terms
create table if not exists contract_schedules (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    template_id uuid not null references contract_templates(id) on delete cascade,
    package_id uuid references agency_packages(id) on delete set null,

    name varchar(255) not null,
    display_order integer not null default 0,
    -- Category for organizing the reusable schedule library
    section_category varchar(100) not null default 'custom',
    content text not null default '',

    is_active boolean not null default true
);

create index if not exists idx_contract_schedules_template_id on contract_schedules(template_id);
create index if not exists idx_contract_schedules_package_id on contract_schedules(package_id);

-- create "contracts" table - Generated from proposals
create table if not exists contracts (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,
    proposal_id uuid not null references proposals(id) on delete cascade,
    template_id uuid references contract_templates(id) on delete set null,

    contract_number varchar(50) not null,
    slug varchar(100) not null unique,
    version integer not null default 1,
    status varchar(50) not null default 'draft',

    client_business_name text not null default '',
    client_contact_name text not null default '',
    client_email varchar(255) not null default '',
    client_phone varchar(50) not null default '',
    client_address text not null default '',

    services_description text not null default '',
    commencement_date timestamptz,
    completion_date timestamptz,
    special_conditions text not null default '',

    total_price decimal(10,2) not null default 0,
    price_includes_gst boolean not null default true,
    payment_terms text not null default '',

    generated_cover_html text,
    generated_terms_html text,
    generated_schedule_html text,

    valid_until timestamptz,

    agency_signatory_name varchar(255),
    agency_signatory_title varchar(100),
    agency_signed_at timestamptz,

    client_signatory_name varchar(255),
    client_signatory_title varchar(100),
    client_signed_at timestamptz,
    client_signature_ip varchar(50),
    client_signature_user_agent text,

    view_count integer not null default 0,
    last_viewed_at timestamptz,
    sent_at timestamptz,

    signed_pdf_url text,

    -- Field visibility - array of field keys to show on public view
    visible_fields jsonb not null default '["services","commencementDate","completionDate","price","paymentTerms","specialConditions"]',
    -- Schedule sections to include from library (array of schedule IDs)
    included_schedule_ids jsonb not null default '[]',

    created_by uuid references users(id) on delete set null,

    constraint valid_contract_status check (status in ('draft', 'sent', 'viewed', 'signed', 'completed', 'expired', 'terminated'))
);

create index if not exists idx_contracts_agency_id on contracts(agency_id);
create index if not exists idx_contracts_proposal_id on contracts(proposal_id);
create index if not exists idx_contracts_status on contracts(status);
create index if not exists idx_contracts_slug on contracts(slug);
create index if not exists idx_contracts_created_at on contracts(created_at desc);

-- create "invoices" table
create table if not exists invoices (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    agency_id uuid not null references agencies(id) on delete cascade,
    proposal_id uuid references proposals(id) on delete set null,
    contract_id uuid references contracts(id) on delete set null,

    invoice_number varchar(50) not null,
    slug varchar(100) not null unique,
    status varchar(50) not null default 'draft',

    client_business_name text not null,
    client_contact_name text not null default '',
    client_email varchar(255) not null,
    client_phone varchar(50) not null default '',
    client_address text not null default '',
    client_abn varchar(20) not null default '',

    issue_date timestamptz not null,
    due_date timestamptz not null,

    subtotal decimal(10,2) not null,
    discount_amount decimal(10,2) not null default 0.00,
    discount_description text not null default '',
    gst_amount decimal(10,2) not null default 0.00,
    total decimal(10,2) not null,

    gst_registered boolean not null default true,
    gst_rate decimal(5,2) not null default 10.00,

    payment_terms varchar(50) not null default 'NET_14',
    payment_terms_custom text not null default '',

    notes text not null default '',
    public_notes text not null default '',

    view_count integer not null default 0,
    last_viewed_at timestamptz,
    sent_at timestamptz,
    paid_at timestamptz,

    payment_method varchar(50),
    payment_reference text,
    payment_notes text,

    pdf_url text,
    pdf_generated_at timestamptz,

    -- Stripe Payment
    stripe_payment_link_id varchar(255),
    stripe_payment_link_url text,
    stripe_payment_intent_id varchar(255),
    stripe_checkout_session_id varchar(255),
    online_payment_enabled boolean not null default true,

    created_by uuid references users(id) on delete set null,

    constraint valid_invoice_status check (status in ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'))
);

create index if not exists idx_invoices_agency_id on invoices(agency_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_due_date on invoices(due_date);
create index if not exists idx_invoices_slug on invoices(slug);
create index if not exists idx_invoices_number on invoices(agency_id, invoice_number);

-- create "invoice_line_items" table
create table if not exists invoice_line_items (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    invoice_id uuid not null references invoices(id) on delete cascade,

    description text not null,
    quantity decimal(10,2) not null default 1.00,
    unit_price decimal(10,2) not null,
    amount decimal(10,2) not null,

    is_taxable boolean not null default true,
    sort_order integer not null default 0,
    category varchar(50),

    package_id uuid references agency_packages(id) on delete set null,
    addon_id uuid references agency_addons(id) on delete set null
);

create index if not exists idx_invoice_line_items_invoice_id on invoice_line_items(invoice_id);

-- create "email_logs" table for tracking sent emails
create table if not exists email_logs (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,

    -- Agency scope
    agency_id uuid not null references agencies(id) on delete cascade,

    -- Related entities (all optional, at least one should be set)
    proposal_id uuid references proposals(id) on delete set null,
    invoice_id uuid references invoices(id) on delete set null,
    contract_id uuid references contracts(id) on delete set null,

    -- Email type
    email_type varchar(50) not null,

    -- Email details
    recipient_email varchar(255) not null,
    recipient_name varchar(255),
    subject varchar(500) not null,
    body_html text not null,

    -- Attachment info
    has_attachment boolean not null default false,
    attachment_filename varchar(255),

    -- Resend tracking
    resend_message_id varchar(100),

    -- Status: pending, sent, delivered, opened, bounced, failed
    status varchar(50) not null default 'pending',

    sent_at timestamptz,
    delivered_at timestamptz,
    opened_at timestamptz,

    -- Error handling
    error_message text,
    retry_count integer not null default 0,

    -- Sender info
    sent_by uuid references users(id) on delete set null
);

-- Indexes for email_logs
create index if not exists idx_email_logs_agency_id on email_logs(agency_id);
create index if not exists idx_email_logs_proposal_id on email_logs(proposal_id);
create index if not exists idx_email_logs_invoice_id on email_logs(invoice_id);
create index if not exists idx_email_logs_contract_id on email_logs(contract_id);
create index if not exists idx_email_logs_status on email_logs(status);
create index if not exists idx_email_logs_created_at on email_logs(created_at);

-- create "questionnaire_responses" table for Initial Website Questionnaire
create table if not exists questionnaire_responses (
    id uuid primary key not null default gen_random_uuid(),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    -- Agency scope
    agency_id uuid not null references agencies(id) on delete cascade,

    -- Public URL slug (questionnaire's own slug for access)
    slug varchar(100) not null unique,

    -- Optional links to other entities (all nullable for standalone questionnaires)
    contract_id uuid references contracts(id) on delete set null,
    proposal_id uuid references proposals(id) on delete set null,
    consultation_id uuid references consultations(id) on delete set null,

    -- Client identification (for standalone questionnaires without linked entities)
    client_business_name text not null default '',
    client_email varchar(255) not null default '',

    -- All responses stored as JSONB (39 fields across 8 sections)
    responses jsonb not null default '{}',

    -- Progress tracking
    current_section integer not null default 0,
    completion_percentage integer not null default 0,

    -- Status: not_started, in_progress, completed
    status varchar(50) not null default 'not_started',

    -- Timestamps
    started_at timestamptz,
    completed_at timestamptz,
    last_activity_at timestamptz default current_timestamp
);

-- Indexes for questionnaire_responses
create index if not exists idx_questionnaire_responses_agency_id on questionnaire_responses(agency_id);
create index if not exists idx_questionnaire_responses_slug on questionnaire_responses(slug);
create index if not exists idx_questionnaire_responses_contract_id on questionnaire_responses(contract_id);
create index if not exists idx_questionnaire_responses_proposal_id on questionnaire_responses(proposal_id);
create index if not exists idx_questionnaire_responses_status on questionnaire_responses(agency_id, status);

-- create "subscriptions" table for detailed subscription tracking
create table if not exists subscriptions (
    id uuid primary key not null default gen_random_uuid(),
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null references users(id) on delete cascade,
    stripe_customer_id text not null,
    stripe_subscription_id text not null,
    stripe_price_id text not null,
    status text not null default 'active',
    current_period_start timestamptz not null,
    current_period_end timestamptz not null,
    canceled_at timestamptz,
    unique (stripe_subscription_id)
);

-- Indexes for subscriptions
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_customer_id on subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_status on subscriptions(status);