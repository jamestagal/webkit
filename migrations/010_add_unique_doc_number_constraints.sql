-- Migration 010: Add unique constraints on document numbers per agency
-- Prevents duplicate proposal/contract/invoice numbers within the same agency

-- Proposals: UNIQUE (agency_id, proposal_number)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposals_agency_number_unique'
    ) THEN
        ALTER TABLE proposals ADD CONSTRAINT proposals_agency_number_unique UNIQUE (agency_id, proposal_number);
    END IF;
END $$;

-- Contracts: UNIQUE (agency_id, contract_number)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contracts_agency_number_unique'
    ) THEN
        ALTER TABLE contracts ADD CONSTRAINT contracts_agency_number_unique UNIQUE (agency_id, contract_number);
    END IF;
END $$;

-- Invoices: Drop existing non-unique index, then add unique constraint
DROP INDEX IF EXISTS invoices_number_idx;
DROP INDEX IF EXISTS idx_invoices_number;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoices_agency_number_unique'
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_agency_number_unique UNIQUE (agency_id, invoice_number);
    END IF;
END $$;
