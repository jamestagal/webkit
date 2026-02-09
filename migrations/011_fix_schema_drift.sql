-- Migration 011: Fix schema drift between Drizzle and actual database
-- Addresses type mismatches, missing NOT NULL constraints, and missing constraints

-- 1. Fix agency_activity_log.ip_address type from inet to text
ALTER TABLE agency_activity_log ALTER COLUMN ip_address TYPE text;

-- 2. Clean up NULL agency_id rows in consultations, then set NOT NULL
DELETE FROM consultations WHERE agency_id IS NULL;
ALTER TABLE consultations ALTER COLUMN agency_id SET NOT NULL;

-- 3. Update consultations status CHECK to include 'converted'
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE consultations ADD CONSTRAINT valid_status CHECK (status IN ('draft', 'completed', 'archived', 'converted'));

-- 4. Add unique constraint on clients (agency_id, email) if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clients_agency_email_unique'
    ) THEN
        ALTER TABLE clients ADD CONSTRAINT clients_agency_email_unique UNIQUE (agency_id, email);
    END IF;
END $$;
