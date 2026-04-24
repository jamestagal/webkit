# Post-Beta Parking Lot

Items captured during pre-beta work that shouldn't be acted on now but shouldn't be forgotten either. Each entry has an explicit **trigger** — the condition under which this becomes worth scheduling.

---

## Activity feed rendering coverage

**Surfaced:** 2026-04-24 during Thread 3 (status rename `ready` → `live`).
**Source:** `service-client/src/lib/components/ActivityFeed.svelte` — `formatAction()` at L38-L104.

### Problem

`formatAction()` parses activity action strings as `entity.verb` and runs a switch on the verb. The switch covers a curated list of verbs (`created`, `updated`, `deleted`, `sent`, `signed`, `paid`, `invited`, `removed`, `archived`, `completed`, `exported`, `upgraded`, `downgraded`, `received`, `connected`, `disconnected`, `account_updated`, `status_changed`, `live` as of the status rename) but falls through to `default: "${name} ${verb} ${entityLabel}"` for anything else. That produces awkward strings like `"Ben live proposal"` (pre-rename, for `proposal.ready`) or `"Ben reviewed proposal"` if a `reviewed` action is logged without a matching case.

Adding cases one-at-a-time as renames or new actions surface the gap works but doesn't scale. The switch has been silently drifting out of sync with what `logActivity` callers emit.

### Proposal

Replace the switch with a centralized **verb → label** map that:

1. Lives alongside the `logActivity` caller surface (likely `db-helpers.ts` next to `ACTIVITY_TYPES`).
2. Is exported and consumed by `ActivityFeed.svelte` so both producers and renderers reference the same source of truth.
3. Has a unit test or type-check that forces every verb emitted by `logActivity` to have a label, preventing future drift.

### Trigger

First beta user confusion about activity feed wording. If an agency asks "why does my feed say 'Ben live proposal'?" or similar, bump this to active work.

### Notes

- Historical rows with unmapped verbs will continue to render via the `default` fallback until this lands.
- The `live` case was added in commit `4ca4595` (see git log on `main`) — that's a one-off patch, not a fix for the underlying structural issue.

---

## `ACTIVITY_TYPES` constant map — unused or inconsistent

**Surfaced:** 2026-04-24 during Thread 3 grep sweep.
**Source:** `service-client/src/lib/server/db-helpers.ts` — `ACTIVITY_TYPES` constant at L355+.

### Problem

`ACTIVITY_TYPES` defines string constants (e.g., `PROPOSAL_SENT: "proposal.sent"`, `PROPOSAL_ACCEPTED: "proposal.accepted"`) but `logActivity()` call sites use **string literals directly**, not the constants. Example: `proposals.remote.ts:750` calls `logActivity("proposal.live", ...)` rather than `logActivity(ACTIVITY_TYPES.PROPOSAL_LIVE, ...)`.

This means the constant map is effectively dead code — it documents the expected activity types but isn't enforced. Worse, it's inconsistent: the rename added `proposal.live` as a literal without a corresponding `PROPOSAL_LIVE` constant, and `proposal.ready` never had one either.

### Proposal

One of:

- **A.** Delete `ACTIVITY_TYPES` entirely — no callers reference it, so it's dead weight.
- **B.** Enforce its use via an ESLint rule or TypeScript pattern (e.g., typed `logActivity(action: keyof typeof ACTIVITY_TYPES | ...)`) so literals become compile errors.

Option B is the safer long-term fix but requires migrating all `logActivity` call sites first.

### Trigger

Whoever next touches `logActivity` in a non-trivial way (new activity type, refactor, audit-log feature work). Don't spend cycles on this in isolation — fold it into the next natural activity-log touch.

### Notes

- This is a pre-existing inconsistency. Not introduced by any recent rename.
- Connected to the activity feed rendering coverage item above — if Option B is chosen there (centralized verb→label map), `ACTIVITY_TYPES` becomes a natural keystone.

---

## Migration runner version-collision footgun

**Surfaced:** 2026-04-24 during Thread 3 Phase 2 verification.
**Source:** `scripts/run_migrations.sh` — the "already applied" check at L87 (local) / L45 (prod).

### Problem

The runner dedups applied migrations by **version number only**, not filename or content hash. If two branches independently cut the same next version number (e.g., both claim 037), whichever branch's migration applies first locks that version on the DB. When the second branch is later applied against the same DB, its migration is **silently skipped** — no log line, no warning, no indication that the UPDATE/DDL in it never ran.

Today's incident (commit `d6a523e` + `2860001`):

- `feat/branding-live-preview` (06cc873) introduced `037_add_proposal_branding_overrides.sql` → applied to local DB on 2026-04-20.
- `fix/rename-ready-to-live` (`d6a523e` post-rebase) independently introduced `037_rename_proposal_status_ready_to_live.sql`.
- `sh scripts/run_migrations.sh` on the rename branch silently skipped the rename migration because version 37 was already recorded with the branding filename.
- Renumbered to 038 in commit `2860001` to resolve.

Caught this time because spot-check `SELECT status FROM proposals` would have surfaced stale `ready` rows on a DB with real data. **On a DB with zero `ready` rows, the failure would have passed silently through to production.**

### Proposal

Three options, from easiest to safest:

- **C. CI lint (PR-time):** fail review if the highest migration number on the feature branch doesn't advance monotonically from main's tip. Catches collisions before merge.
- **B. Runtime filename check:** if schema_migrations has version N recorded with filename X but the file on disk at version N is filename Y, fail loudly instead of skipping.
- **A. Content hash:** record content hash alongside version in schema_migrations. Dedup on (version, hash). Silent-skip only if same version AND same content.

**Recommendation:** (C) as an immediate cheap guard (a shell script in CI), (B) as a defensive belt for prod deploys. (A) is the strongest but requires migrating schema_migrations itself — worth only if collisions keep happening post-beta.

### Trigger

Next time two branches touch `migrations/` in parallel. Given webkit's schema is still evolving weekly pre-beta, this is likely to recur before beta-close. First repeat incident → bump to active.

### Notes

- Today's incident was caught only because DB spot-checks were part of verification. A more typical verification (unit tests, UI click-through) wouldn't have surfaced the silent skip. That's the real severity: the failure mode is invisible to most verification styles.
- Renumbering (as done in commit `2860001`) resolves the specific incident but doesn't prevent future occurrences.
- **Related entry:** "Migration runner — no `--single-transaction` on psql invocation" (below). Both are runner-hardening concerns and a single post-beta fix pass would naturally address them together.

---

## Migration runner — no `--single-transaction` on psql invocation

**Surfaced:** 2026-04-24 during Thread 3 Phase 2 close-out (pre-deploy sanity check).
**Source:** `scripts/run_migrations.sh` — L51 (prod) / L93 (local).

### Problem

The runner invokes `docker exec -i webkit-postgres psql -U <user> -d <db> < migration.sql` — piping the file as stdin. Without `--single-transaction` (or `-1`), psql autocommits every statement independently. A migration with multiple statements (e.g. DROP CONSTRAINT → ADD CONSTRAINT, or multiple ALTER TABLE steps) has a vulnerable window between statements where concurrent writers could observe intermediate state.

Concrete case: migration `038_rename_proposal_status_ready_to_live.sql` does `UPDATE` → `DROP CONSTRAINT` → `ADD CONSTRAINT`. Between the DROP and the ADD, there's a brief window where `valid_proposal_status` doesn't exist. A concurrent INSERT with a malformed status value could slip through. Pre-beta prod traffic is effectively zero so this window was harmless, but the failure mode is real for post-beta traffic.

### Proposal

Three natural paths:

- **1. Add `--single-transaction` to the runner.** Change `psql ... < $migration` to `psql ... --single-transaction -f $migration` in both the local and prod branches of `run_migrations.sh`. Every migration file is wrapped in an implicit BEGIN/COMMIT automatically. **Side effect:** any migration file containing an explicit `BEGIN;` / `COMMIT;` will error with a nested-transaction warning. Need to audit existing migrations for that before shipping.
- **2. Require explicit `BEGIN; ... COMMIT;` in each migration file.** Runner untouched; burden shifts to the author of each migration. More ceremony per migration, but transactional semantics become visible in the file itself rather than implicit in the invocation.
- **3. Hybrid:** `--single-transaction` flag + a lint rule rejecting migrations that contain explicit `BEGIN`/`COMMIT`. Belt and braces — runner enforces atomicity, linter prevents the nested-transaction footgun that option 1 alone introduces.

**Recommendation:** (1) after an audit of existing migrations; (3) if time permits, since the lint rule is a small addition that eliminates the future footgun of someone pasting `BEGIN;` into a migration file not realizing the runner already wraps it.

Caveat: `--single-transaction` is incompatible with `CREATE INDEX CONCURRENTLY` and a few other operations that can't run inside a transaction. Webkit doesn't use any of those today; if a future migration needs one, it would need an explicit escape hatch (per-file flag, separate runner path, or manual application).

### Trigger

Either of (whichever comes first):

- **First beta traffic.** The transient window between DDL statements becomes non-zero in terms of concurrent-write exposure.
- **Next migration doing a multi-statement atomic change** — constraint swaps, column renames with backfill, partition rotation, or similar patterns where intermediate state would be observable and potentially harmful.

### Related work

- Commit `546050b` (migration 038's constraint swap) — the specific migration that surfaced this concern.
- **Sibling parking-lot entry** "Migration runner version-collision footgun" (commit `c13cbe5` introduced it). Same file, same fix window — both runner-hardening concerns that a single post-beta fix pass would address together.

### Notes

- Today's migration 038 (DROP + ADD CONSTRAINT) applied without wrapping because pre-beta traffic is ~zero. No harm done; no state leaked through the window.
- Does not block today's prod deploy.

---

## Audit page deep-link by `auditId`

**Surfaced:** 2026-04-24 during planning of `feat/reports-management-page`.
**Source:** `service-client/src/routes/(app)/[agencySlug]/content/[clientId]/audit/+page.server.ts:4-26` — destructures `params.clientId` only.

### Problem

Audit page always renders the latest audit — `latestAudit = audits[0]` after a `desc(createdAt)` sort. No URL param or selector UI lets a caller say "show me *this* specific audit." Grep confirms: zero `searchParams`, zero `?auditId`, no client-side history selector.

This becomes a friction point the moment a row elsewhere wants to link to a specific historical audit:

- Reports page (just landed) lists every shared audit, but the "Audit" date column is plain text because there's nowhere meaningful to link. Clicking a 2-week-old row and landing on today's audit would be worse UX than no link.
- Audit-history table on the audit page itself surfaces historical rows but can't open them — same underlying gap.
- Any future "view this audit" CTA (email notifications, Slack integrations, activity-feed cross-links) hits the same wall.

### Proposal

Accept an optional `?auditId=<uuid>` search param on `/content/[clientId]/audit`:

1. Server load reads it, validates the audit belongs to the current `clientId` (defence against cross-client URL tampering).
2. Falls back to `audits[0]` when absent — preserves existing default behaviour.
3. Client-side: the audit-history table rows become clickable and update the URL (pushState or an `<a>` with the param).

Straightforward scope (estimated <1h for load + UI wiring). Zero schema, zero new endpoints.

### Trigger

- **Reports row-link follow-up is picked up**, OR
- **A beta user asks why historical share rows don't open** the specific audit they were shared from.

Whichever comes first.

### Notes

- Reports page already filters out never-shared audits, so row-links would only open audits that had a share created at some point — the most likely case a user wants to revisit anyway.
- Worth considering in the same session as this: should the audit page grow a visible audit-selector (dropdown or history sidebar) while we're in there? Probably yes if the deep-link lands — otherwise users arriving from a deep-link have no clear "back to latest" affordance beyond browser back.

---

## Share-link token rotation on revoked rows is a destructive default

**Surfaced:** 2026-04-24 while diagnosing production 404s on share URLs that the Reports UI reported as "Active" for agency `plentify-web-designs`.
**Source:** `service-client/src/lib/api/content-audit.remote.ts:160-163` — `createShareLink`'s rotation guard.

### Problem

Three share-lifecycle commands interact asymmetrically with `share_token`:

- `reinstateShareLink` **preserves** the token. Same URL survives.
- `revokeShareLink` **preserves** the token. Same URL comes back if reinstated.
- `createShareLink` **rotates** the token when `share_token IS NULL OR share_revoked_at IS NOT NULL`.

The trap: Revoke + Create Again silently breaks every URL previously sent to the client. Post-rotation the row looks fully active (`share_revoked_at = NULL`, new token present, status badge says "Active"), but the old URL now points at a token the DB no longer holds. `validateShareToken` ([share-tokens.ts:93-108](../../service-client/src/lib/server/share-tokens.ts#L93-L108)) returns `not-found` and the public route 404s. No visible UI signal that the URL was rotated; no audit log of rotation.

Surface symptom: "my link shows Active in the dashboard, but my client gets a 404."

### Resolution paths (three, not mutually exclusive)

- **(a) Slug-mismatch observability.** `validateShareToken` collapses slug mismatch into `not-found` for information-hiding, but there's no telemetry on how often that branch fires. Add structured logging on the mismatch branch so a slug-rename incident is distinguishable from a token-rotation incident without re-running diagnostic SQL per case. No behaviour change.
- **(b) `agency_slug_snapshot` column on `seo_audits`.** Snapshot the agency slug at share-creation time so URLs survive agency rename. Orthogonal to (c); addresses the slug-rename failure mode specifically, which is a separate class from token rotation.
- **(c) [highest-impact] Make rotation the opt-in branch, not the default.** The Reports page's Reinstate row action already does this right — it calls `reinstateShareLink` (same URL) rather than `createShareLink` (rotate). The gap is on the audit-page ShareReportModal, where "Create again" on a revoked row silently rotates. Options:
  - **c1.** Surface Reinstate more prominently than Create on revoked rows in ShareReportModal.
  - **c2.** Inline warning in ShareReportModal when the user is about to rotate: *"The existing URL will stop working — use Reinstate instead to preserve it."*
  - **c3.** Require `force: true` on `createShareLink` to rotate on a revoked row; 409 otherwise. Every existing caller keeps working unless it passes through a revoked state first.

(c) is the real fix — (a) and (b) are observability/data-integrity complements.

### Trigger

First beta user complaint about a previously-working share URL going dead, OR when Revoke-vs-Reinstate usage metrics become visible and rotation frequency exceeds expectation. Reports page already routes Reinstate correctly, so this moves higher-priority only if the audit-page ShareReportModal continues to be the primary share-management surface in practice.

### Notes

- The Reports page (merged in commit `aaec1c0`) partially mitigates by making same-URL reinstatement the default management path. Does not mitigate on the audit-page ShareReportModal.
- Diagnostic query to confirm rotation on a specific broken URL:
  ```sql
  SELECT id, client_id, share_token, share_revoked_at, share_created_at, share_expires_at
  FROM seo_audits
  WHERE share_token = '<token-from-broken-url>';
  ```
  Zero rows → token has been rotated. To locate the replacement, list currently-tokenized audits for the same agency (`WHERE agency_id = X AND share_token IS NOT NULL`) and cross-reference `share_created_at` / `updated_at` against the user's recollection of when they sent the broken URL.
- This entry was surfaced during a 2026-04-24 diagnostic chain that turned out to be a local-vs-prod DB mismatch (URLs generated against a local dev database, inspected against production) — not a rotation incident. The trap mechanism is real regardless — captured here so the next time it's hypothesized as a cause, the verification checklist (which DB were these URLs generated against?) is already written down.
