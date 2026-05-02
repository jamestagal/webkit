-- 040_add_proposals_industry.sql
--
-- Add `industry` column to `proposals` for the doctype-coupling-relaxation Phase A
-- workstream. Allows proposals to capture industry context directly without
-- requiring a Consultation record.
--
-- Read priority in `buildContextFromProposal` (apps/service-client/src/lib/server/prompts/prompt-builder.ts)
-- becomes: proposal.industry ?? consultation.industry ?? "General".
--
-- New proposals created from a Consultation get this column populated by
-- createProposal cache-from-consultation logic. Standalone proposals get NULL
-- and the AI generation path triggers the QuickProposalContextModal which
-- captures industry inline (along with primary challenges + primary goals).
--
-- Existing proposals get NULL — read-time fallback to consultation.industry
-- preserves today's behaviour.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS industry text;
