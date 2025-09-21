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

-- create "consultations" table
create table if not exists consultations (
    id uuid primary key not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null,

    -- Client Information
    business_name text not null,
    contact_name text not null,
    contact_title text not null default '',
    email text not null,
    phone text not null default '',
    website text not null default '',
    preferred_contact text not null default 'email',

    -- Business Context
    industry text not null,
    location text not null,
    years_in_business integer,
    team_size integer,
    monthly_traffic integer,
    current_platform text not null default '',

    -- Consultation Data (JSONB for flexibility)
    business_data jsonb not null default '{}',
    challenges jsonb not null default '{}',
    goals jsonb not null default '{}',
    budget jsonb not null default '{}',

    -- Metadata
    consultation_date timestamptz,
    duration_minutes integer,
    sales_rep text not null default '',
    notes text not null default '',
    next_steps jsonb not null default '[]',
    commitment_level integer check (commitment_level between 1 and 5),
    status text not null default 'scheduled'
);

-- create "consultation_drafts" table
create table if not exists consultation_drafts (
    id uuid primary key not null,
    consultation_id uuid not null,
    user_id uuid not null,
    draft_data jsonb not null,
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp
);

-- create "consultation_versions" table
create table if not exists consultation_versions (
    id uuid primary key not null,
    consultation_id uuid not null,
    user_id uuid not null,
    version_number integer not null,
    version_data jsonb not null,
    change_description text not null default '',
    created timestamptz not null default current_timestamp
);

-- create indexes for consultations
create index if not exists idx_consultations_user_id on consultations(user_id);
create index if not exists idx_consultations_status on consultations(status);
create index if not exists idx_consultations_consultation_date on consultations(consultation_date);
create index if not exists idx_consultations_industry on consultations(industry);
create index if not exists idx_consultations_created on consultations(created);

-- create indexes for consultation_drafts
create index if not exists idx_consultation_drafts_consultation_id on consultation_drafts(consultation_id);
create index if not exists idx_consultation_drafts_user_id on consultation_drafts(user_id);
create unique index if not exists idx_consultation_drafts_unique on consultation_drafts(consultation_id, user_id);

-- create indexes for consultation_versions
create index if not exists idx_consultation_versions_consultation_id on consultation_versions(consultation_id);
create index if not exists idx_consultation_versions_user_id on consultation_versions(user_id);
create index if not exists idx_consultation_versions_version on consultation_versions(consultation_id, version_number);
