-- Widen banking columns to accommodate AES-256-GCM encrypted values (base64-encoded)
-- text has no length limit in PostgreSQL, no performance difference vs varchar
ALTER TABLE agency_profiles ALTER COLUMN bsb TYPE text;
ALTER TABLE agency_profiles ALTER COLUMN account_number TYPE text;
ALTER TABLE agency_profiles ALTER COLUMN tax_file_number TYPE text;
