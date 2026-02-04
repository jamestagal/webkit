-- Migration: Add stripe_customer_id to agencies for platform billing
-- This column stores the Stripe Customer ID for agencies subscribing to WebKit tiers

-- Add stripe_customer_id column to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT '';

-- Create index for efficient lookup by Stripe customer ID (used in webhook handlers)
CREATE INDEX IF NOT EXISTS idx_agencies_stripe_customer ON agencies(stripe_customer_id) WHERE stripe_customer_id != '';
