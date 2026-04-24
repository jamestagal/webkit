-- 037_rename_proposal_status_ready_to_live.sql
--
-- Rename the proposal lifecycle status value 'ready' → 'live'.
--
-- Motivation: "Ready" was ambiguous in the UI ("ready for what?");
-- "Live" unambiguously means the shareable link is active and reachable
-- by clients. Pure value rename — the state's meaning is unchanged.
--
-- Safety: proposals.status is declared as plain varchar(50) in the
-- Drizzle schema with no DB-level CHECK constraint and no enum type,
-- so this is a one-statement value update — no constraint alter, no
-- enum migration. The Go schema file (app/service-core/storage/
-- schema_postgres.sql) declares a CHECK constraint for sqlc reference
-- only and is not applied to the DB per CLAUDE.md.
--
-- Idempotent: re-running on an already-migrated DB is a no-op because
-- no rows will have status = 'ready' after first run.

update proposals set status = 'live' where status = 'ready';
