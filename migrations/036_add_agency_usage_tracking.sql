-- 036: Per-agency monthly usage counters + cumulative storage tracking
-- Replaces feature-specific counters on `agencies` (ai_generations_this_month,
-- seo_audits_this_month — deprecated in PR 3, dropped post-launch).
-- Feature names enforced at application layer (see app/pkg/usage/feature.go).

CREATE TABLE IF NOT EXISTS agency_usage (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id  UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    feature    TEXT        NOT NULL,
    period     TEXT        NOT NULL,
    count      INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agency_usage_unique UNIQUE (agency_id, feature, period),
    CONSTRAINT agency_usage_count_non_negative CHECK (count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_agency_usage_lookup
    ON agency_usage (agency_id, feature, period);

COMMENT ON TABLE agency_usage IS
    'Monthly rolling usage counters. period format: YYYY-MM. Rows created on first use each month.';

CREATE TABLE IF NOT EXISTS agency_storage (
    agency_id  UUID        PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
    used_bytes BIGINT      NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agency_storage_non_negative CHECK (used_bytes >= 0)
);

INSERT INTO agency_storage (agency_id)
SELECT id FROM agencies
ON CONFLICT (agency_id) DO NOTHING;
