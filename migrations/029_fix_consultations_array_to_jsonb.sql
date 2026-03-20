-- Fix consultations columns: primary_challenges and primary_goals should be jsonb (matching Drizzle schema)
-- Both are currently text[] in production but Drizzle schema expects jsonb

-- Step 1: Convert primary_challenges from text[] to jsonb
ALTER TABLE consultations
    ALTER COLUMN primary_challenges DROP DEFAULT;

ALTER TABLE consultations
    ALTER COLUMN primary_challenges TYPE jsonb
    USING COALESCE(to_jsonb(primary_challenges), '[]'::jsonb);

ALTER TABLE consultations
    ALTER COLUMN primary_challenges SET DEFAULT '[]'::jsonb;

-- Step 2: Convert primary_goals from text[] to jsonb
ALTER TABLE consultations
    ALTER COLUMN primary_goals DROP DEFAULT;

ALTER TABLE consultations
    ALTER COLUMN primary_goals TYPE jsonb
    USING COALESCE(to_jsonb(primary_goals), '[]'::jsonb);

ALTER TABLE consultations
    ALTER COLUMN primary_goals SET DEFAULT '[]'::jsonb;
