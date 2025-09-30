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
    unique (email, sub)
);

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
create index if not exists idx_consultation_drafts_updated_at on consultation_drafts(updated_at);

-- Indexes for consultation_versions
create index if not exists idx_consultation_versions_consultation_id on consultation_versions(consultation_id);
create index if not exists idx_consultation_versions_user_id on consultation_versions(user_id);
create index if not exists idx_consultation_versions_created_at on consultation_versions(created_at);
create index if not exists idx_consultation_versions_version_number on consultation_versions(consultation_id, version_number);