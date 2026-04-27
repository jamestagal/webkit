-- 039_rename_document_type_questionnaire_to_form.sql
--
-- Rename the agency_document_branding.document_type value
-- 'questionnaire' → 'form'.
--
-- Motivation: the "Questionnaires" branding tab themes EVERY public
-- form an agency creates (Contact Form, Quick Quote Request, Project
-- Inquiry, Website Questionnaire, etc) via DaisyUI vars on the shared
-- form wrapper — not just questionnaire-type forms. Label is
-- misleading; rename DB value to match new "Forms" UI label.
--
-- Live DB constraint values pre-migration (queried 2026-04-28 via
-- pg_constraint): contract, invoice, questionnaire, proposal, email,
-- quotation. Note: schema_postgres.sql:478 omits 'quotation' — that's
-- pre-existing drift, addressed in this PR's schema_postgres.sql edit
-- to bring the sqlc reference in sync with the live DB.
--
-- Order matters: drop old constraint first so the UPDATE can write
-- 'form' (which the old constraint doesn't allow). Migration 038's
-- pattern (UPDATE → DROP → ADD) only worked because it had zero rows
-- to update; with a non-empty population we have to widen the gate
-- before backfilling.
--
-- Idempotent: re-running on an already-migrated DB is a no-op.
-- DROP IF EXISTS handles the no-constraint case; UPDATE matches no
-- rows once the rename is done; ADD CONSTRAINT replaces the dropped
-- constraint.

-- Step 1: drop the old constraint so the UPDATE in step 2 can write
-- the new value. (Without this, the UPDATE rejects with SQLSTATE
-- 23514 because 'form' is not in the old value list.)
alter table agency_document_branding drop constraint if exists valid_document_type;

-- Step 2: backfill existing 'questionnaire' rows to 'form'.
update agency_document_branding set document_type = 'form'
  where document_type = 'questionnaire';

-- Step 3: re-add the constraint with the new value list — 'form'
-- replaces 'questionnaire'; all other values preserved verbatim from
-- the live-DB pre-flight query.
alter table agency_document_branding add constraint valid_document_type
    check (document_type in ('contract', 'invoice', 'form', 'proposal', 'email', 'quotation'));
