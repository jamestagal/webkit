-- create "tokens" table
CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY NOT NULL,
    expires DATETIME NOT NULL,
    target TEXT NOT NULL,
    callback TEXT NOT NULL DEFAULT ''
);

-- create "users" table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    access INTEGER NOT NULL,
    sub TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL DEFAULT '',
    subscription_id TEXT NOT NULL DEFAULT '',
    subscription_end DATETIME NOT NULL DEFAULT '2000-01-01 00:00:00',
    api_key TEXT NOT NULL DEFAULT '',
    UNIQUE (email, sub)
);

-- create "files" table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content_type TEXT NOT NULL
);

-- create "emails" table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    email_to TEXT NOT NULL,
    email_from TEXT NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL
);

-- create "email_attachments" table
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL
);

-- create "notes" table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL
);

-- create "consultations" table
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL,

    -- Client Information
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_title TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    preferred_contact TEXT NOT NULL DEFAULT 'email',

    -- Business Context
    industry TEXT NOT NULL,
    location TEXT NOT NULL,
    years_in_business INTEGER,
    team_size INTEGER,
    monthly_traffic INTEGER,
    current_platform TEXT NOT NULL DEFAULT '',

    -- Consultation Data (JSON for flexibility)
    business_data TEXT NOT NULL DEFAULT '{}',
    challenges TEXT NOT NULL DEFAULT '{}',
    goals TEXT NOT NULL DEFAULT '{}',
    budget TEXT NOT NULL DEFAULT '{}',

    -- Metadata
    consultation_date DATETIME,
    duration_minutes INTEGER,
    sales_rep TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    next_steps TEXT NOT NULL DEFAULT '[]',
    commitment_level INTEGER CHECK (commitment_level BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'scheduled'
);

-- create "consultation_drafts" table
CREATE TABLE IF NOT EXISTS consultation_drafts (
    id UUID PRIMARY KEY NOT NULL,
    consultation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    draft_data TEXT NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- create "consultation_versions" table
CREATE TABLE IF NOT EXISTS consultation_versions (
    id UUID PRIMARY KEY NOT NULL,
    consultation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    version_data TEXT NOT NULL,
    change_description TEXT NOT NULL DEFAULT '',
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- create indexes for consultations
CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_consultation_date ON consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_industry ON consultations(industry);
CREATE INDEX IF NOT EXISTS idx_consultations_created ON consultations(created);

-- create indexes for consultation_drafts
CREATE INDEX IF NOT EXISTS idx_consultation_drafts_consultation_id ON consultation_drafts(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_drafts_user_id ON consultation_drafts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_drafts_unique ON consultation_drafts(consultation_id, user_id);

-- create indexes for consultation_versions
CREATE INDEX IF NOT EXISTS idx_consultation_versions_consultation_id ON consultation_versions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_versions_user_id ON consultation_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_versions_version ON consultation_versions(consultation_id, version_number);
