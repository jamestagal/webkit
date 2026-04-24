-- 038_rename_proposal_status_ready_to_live.sql
--
-- Rename the proposal lifecycle status value 'ready' → 'live'.
--
-- Motivation: "Ready" was ambiguous in the UI ("ready for what?");
-- "Live" unambiguously means the shareable link is active and reachable
-- by clients. Pure value rename — the state's meaning is unchanged.
--
-- The live DB has a CHECK constraint `valid_proposal_status` on
-- proposals.status (bootstrapped from app/service-core/storage/
-- schema_postgres.sql at some point — not via /migrations, but the
-- constraint is definitely present). So this migration has to both
-- backfill existing rows AND swap the constraint, or new writes with
-- status='live' get rejected with SQLSTATE 23514.
--
-- Idempotent: re-running on an already-migrated DB is a no-op.
-- UPDATE matches no rows (none have 'ready'), DROP CONSTRAINT is
-- guarded by IF EXISTS, ADD CONSTRAINT uses a fresh name.

-- Step 1: backfill existing 'ready' rows to 'live' while the old
-- constraint still permits 'ready' (avoids chicken-and-egg).
update proposals set status = 'live' where status = 'ready';

-- Step 2: swap the CHECK constraint so 'live' is the valid value
-- and 'ready' is no longer permitted.
alter table proposals drop constraint if exists valid_proposal_status;
alter table proposals add constraint valid_proposal_status
    check (status in ('draft', 'live', 'sent', 'viewed', 'accepted', 'declined', 'revision_requested', 'expired'));
