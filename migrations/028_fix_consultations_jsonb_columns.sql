-- Fix consultations columns: design_styles and admired_websites should be jsonb (matching Drizzle schema)
-- design_styles: text[] → jsonb (convert existing array values to JSON arrays)
-- admired_websites: text → jsonb (convert existing text values to JSON arrays)

-- Step 1: Convert design_styles from text[] to jsonb
ALTER TABLE consultations
    ALTER COLUMN design_styles DROP DEFAULT;

ALTER TABLE consultations
    ALTER COLUMN design_styles TYPE jsonb
    USING COALESCE(to_jsonb(design_styles), '[]'::jsonb);

ALTER TABLE consultations
    ALTER COLUMN design_styles SET DEFAULT '[]'::jsonb;

-- Step 2: Convert admired_websites from text to jsonb
-- First nullify empty strings so the USING clause only deals with NULL or real values
UPDATE consultations SET admired_websites = NULL WHERE admired_websites = '';

ALTER TABLE consultations
    ALTER COLUMN admired_websites DROP DEFAULT;

ALTER TABLE consultations
    ALTER COLUMN admired_websites TYPE jsonb
    USING CASE
        WHEN admired_websites IS NULL THEN '[]'::jsonb
        WHEN admired_websites ~ '^\[' THEN admired_websites::jsonb
        ELSE jsonb_build_array(admired_websites)
    END;

ALTER TABLE consultations
    ALTER COLUMN admired_websites SET DEFAULT '[]'::jsonb;
