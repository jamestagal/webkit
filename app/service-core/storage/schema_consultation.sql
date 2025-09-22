-- Consultation Domain Schema (PostgreSQL)
-- This file contains the consultation tables according to the new specification

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
    completion_percentage integer default 0 check (completion_percentage >= 0 and completion_percentage <= 100),

    -- Timestamps
    created_at timestamptz default current_timestamp,
    updated_at timestamptz default current_timestamp,
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

    -- Draft metadata
    auto_saved boolean default true,
    draft_notes text,

    -- Timestamps
    created_at timestamptz default current_timestamp,
    updated_at timestamptz default current_timestamp,

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
    changed_fields jsonb, -- Array of field names that changed

    -- Timestamps
    created_at timestamptz default current_timestamp,

    -- Ensure unique version numbers per consultation
    unique(consultation_id, version_number)
);

-- Indexes for consultations
create index if not exists idx_consultations_user_id on consultations(user_id);
create index if not exists idx_consultations_status on consultations(status);
create index if not exists idx_consultations_created_at on consultations(created_at);
create index if not exists idx_consultations_updated_at on consultations(updated_at);

-- JSONB indexes for efficient querying
create index if not exists idx_consultations_contact_business_name on consultations using gin ((contact_info->>'business_name'));
create index if not exists idx_consultations_business_industry on consultations using gin ((business_context->>'industry'));
create index if not exists idx_consultations_urgency on consultations using gin ((pain_points->>'urgency_level'));

-- Indexes for consultation_drafts
create index if not exists idx_consultation_drafts_consultation_id on consultation_drafts(consultation_id);
create index if not exists idx_consultation_drafts_user_id on consultation_drafts(user_id);
create index if not exists idx_consultation_drafts_updated_at on consultation_drafts(updated_at);

-- Indexes for consultation_versions
create index if not exists idx_consultation_versions_consultation_id on consultation_versions(consultation_id);
create index if not exists idx_consultation_versions_user_id on consultation_versions(user_id);
create index if not exists idx_consultation_versions_created_at on consultation_versions(created_at);
create index if not exists idx_consultation_versions_version_number on consultation_versions(consultation_id, version_number);