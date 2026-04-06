-- Add optional name/label column to consultations for disambiguation
-- Falls back to businessName in the UI when null
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS name VARCHAR(255);
