-- Add audit columns for freemium revocation, mirroring freemium_granted_*.
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS freemium_revoked_by VARCHAR(255);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS freemium_revoked_at TIMESTAMPTZ;
