# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-22-consultation-domain/spec.md

> Created: 2025-09-22
> Version: 1.0.0

## Schema Changes

### consultations Table
```sql
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Contact Information
    contact_info JSONB NOT NULL DEFAULT '{}',
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

    -- Business Context
    business_context JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "industry": "string",
    --   "business_type": "string",
    --   "team_size": "number",
    --   "current_platform": "string",
    --   "digital_presence": ["string"],
    --   "marketing_channels": ["string"]
    -- }

    -- Pain Points & Challenges
    pain_points JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "primary_challenges": ["string"],
    --   "technical_issues": ["string"],
    --   "urgency_level": "string", // "low", "medium", "high", "critical"
    --   "impact_assessment": "string",
    --   "current_solution_gaps": ["string"]
    -- }

    -- Goals & Objectives
    goals_objectives JSONB NOT NULL DEFAULT '{}',
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
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'completed', 'archived'
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Indexes for performance
    CONSTRAINT valid_status CHECK (status IN ('draft', 'completed', 'archived'))
);

-- Indexes
CREATE INDEX idx_consultations_user_id ON consultations(user_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_created_at ON consultations(created_at);
CREATE INDEX idx_consultations_updated_at ON consultations(updated_at);

-- JSONB indexes for efficient querying
CREATE INDEX idx_consultations_contact_business_name ON consultations USING GIN ((contact_info->>'business_name'));
CREATE INDEX idx_consultations_business_industry ON consultations USING GIN ((business_context->>'industry'));
CREATE INDEX idx_consultations_urgency ON consultations USING GIN ((pain_points->>'urgency_level'));
```

### consultation_drafts Table
```sql
CREATE TABLE consultation_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Draft data (same structure as consultations)
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',

    -- Draft metadata
    auto_saved BOOLEAN DEFAULT true,
    draft_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one active draft per consultation
    UNIQUE(consultation_id)
);

-- Indexes
CREATE INDEX idx_consultation_drafts_consultation_id ON consultation_drafts(consultation_id);
CREATE INDEX idx_consultation_drafts_user_id ON consultation_drafts(user_id);
CREATE INDEX idx_consultation_drafts_updated_at ON consultation_drafts(updated_at);
```

### consultation_versions Table
```sql
CREATE TABLE consultation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,

    -- Snapshot of consultation data at this version
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL,
    completion_percentage INTEGER NOT NULL,

    -- Version metadata
    change_summary TEXT,
    changed_fields JSONB, -- Array of field names that changed

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique version numbers per consultation
    UNIQUE(consultation_id, version_number)
);

-- Indexes
CREATE INDEX idx_consultation_versions_consultation_id ON consultation_versions(consultation_id);
CREATE INDEX idx_consultation_versions_user_id ON consultation_versions(user_id);
CREATE INDEX idx_consultation_versions_created_at ON consultation_versions(created_at);
CREATE INDEX idx_consultation_versions_version_number ON consultation_versions(consultation_id, version_number);
```

## Migrations

### PostgreSQL Migration (001_create_consultations.up.sql)
```sql
-- Create consultations table
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_status CHECK (status IN ('draft', 'completed', 'archived'))
);

-- Create indexes
CREATE INDEX idx_consultations_user_id ON consultations(user_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_created_at ON consultations(created_at);
CREATE INDEX idx_consultations_updated_at ON consultations(updated_at);
CREATE INDEX idx_consultations_contact_business_name ON consultations USING GIN ((contact_info->>'business_name'));
CREATE INDEX idx_consultations_business_industry ON consultations USING GIN ((business_context->>'industry'));
CREATE INDEX idx_consultations_urgency ON consultations USING GIN ((pain_points->>'urgency_level'));

-- Create consultation drafts table
CREATE TABLE consultation_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',
    auto_saved BOOLEAN DEFAULT true,
    draft_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(consultation_id)
);

-- Create consultation versions table
CREATE TABLE consultation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    contact_info JSONB NOT NULL DEFAULT '{}',
    business_context JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    goals_objectives JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL,
    completion_percentage INTEGER NOT NULL,
    change_summary TEXT,
    changed_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(consultation_id, version_number)
);

-- Create indexes for drafts and versions
CREATE INDEX idx_consultation_drafts_consultation_id ON consultation_drafts(consultation_id);
CREATE INDEX idx_consultation_drafts_user_id ON consultation_drafts(user_id);
CREATE INDEX idx_consultation_versions_consultation_id ON consultation_versions(consultation_id);
CREATE INDEX idx_consultation_versions_user_id ON consultation_versions(user_id);
```

### SQLite/Turso Migration Compatibility
- Replace `gen_random_uuid()` with application-generated UUIDs
- Replace `TIMESTAMP WITH TIME ZONE` with `DATETIME`
- Replace JSONB with JSON (maintain same structure)
- Adjust GIN indexes to standard indexes for text fields
- Maintain referential integrity constraints