# Super Admin — Grant Freemium Access to Existing Agency

## Context

Today, `isFreemium` can only be set at agency creation time via a beta invite token ([agency.remote.ts:319-324](service-client/src/lib/api/agency.remote.ts#L319-L324), hardcoded `reason: "beta_tester"`). The Super Admin UI can list, revoke, and change expiry of already-freemium agencies, but **cannot grant freemium to an existing agency** — so dogfooding accounts and managed-on-behalf agencies (e.g. Stop Leak Bathrooms) need raw SQL against production. The Freemium Users page dropdown advertises six reasons (beta_tester, partner, promotional, early_signup, referral_reward, internal) but only `beta_tester` is ever written.

This plan closes that gap by extending the existing "Change Status / Tier" modal on the agency detail page to also manage freemium access, and collapsing the three freemium-related write paths into a single unified command. Also adds revocation audit columns that are currently missing.

## Scope decisions (confirmed with user)

- Extend existing modal on `/super-admin/agencies/{id}`, no separate grant flow.
- Unify into one command `updateAgencyAccess` absorbing `updateAgencyStatus`, `revokeAgencyFreemium`, and `updateFreemiumExpiry`.
- UX: freemium overrides tier limits — when freemium toggled on, show note "Tier limits ignored while freemium is active" next to the tier select.
- Capture `freemium_revoked_by` and `freemium_revoked_at` (both currently missing) for symmetry with `freemium_granted_by` / `_at`.
- No history table. Current columns + git + future logs answer audit questions.
- Freemium Users page stays as the filtered list view; no grant action added there.

## Files to modify

### 1. Migration — `migrations/035_add_freemium_revoked_columns.sql` (new)

```sql
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS freemium_revoked_by VARCHAR(255);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS freemium_revoked_at TIMESTAMPTZ;
```

Idempotent per project convention ([CLAUDE.md migration rules](CLAUDE.md)).

### 2. Drizzle schema — [service-client/src/lib/server/schema.ts:80-100](service-client/src/lib/server/schema.ts#L80-L100)

Add to `agencies` table:
```ts
freemiumRevokedAt: timestamp("freemium_revoked_at", { withTimezone: true }),
freemiumRevokedBy: varchar("freemium_revoked_by", { length: 255 }),
```

### 3. Go reference schema — [app/service-core/storage/schema_postgres.sql:88-92](app/service-core/storage/schema_postgres.sql#L88-L92)

Mirror the two new columns next to the existing `freemium_granted_*` lines. Then:
```bash
sh scripts/run_queries.sh postgres   # regenerates models.go, query_postgres.sql.go
```
Commit the generated files.

`GetAgencyByStripeCustomer` uses `SELECT *` ([query_postgres.sql:141](app/service-core/storage/query/query_postgres.sql#L141)) so sqlc regen is mandatory — without it the Go struct scan breaks at runtime during Stripe webhook handling ([CLAUDE.md auth gotcha](CLAUDE.md)).

### 4. Server command consolidation — [service-client/src/lib/api/super-admin.remote.ts](service-client/src/lib/api/super-admin.remote.ts)

**Add** Valibot picklist for the reason enum (new, currently unvalidated at server):
```ts
const FreemiumReasonSchema = v.picklist([
  "beta_tester", "partner", "promotional",
  "early_signup", "referral_reward", "internal",
]);
```

**Replace** `updateAgencyStatus` (lines 220-284), `revokeAgencyFreemium` (lines 702-729), and `updateFreemiumExpiry` (lines 731-767) with a single:

```ts
export const updateAgencyAccess = command(
  v.object({
    agencyId: v.pipe(v.string(), v.uuid()),
    status: v.optional(v.picklist(["active", "suspended", "cancelled"])),
    subscriptionTier: v.optional(v.string()),
    freemium: v.optional(v.object({
      enabled: v.boolean(),
      reason: v.optional(FreemiumReasonSchema),
      expiresAt: v.nullable(v.optional(v.pipe(v.string(), v.isoTimestamp()))),
    })),
  }),
  async (data) => { /* ... */ }
);
```

Handler behaviour — **wrap entire body in `db.transaction(async (tx) => { ... })`** so a failed log insert rolls back the agency update:
- `requireSuperAdmin()` first, **outside** the transaction. The guard reads the current user from the DB, so it's not pure in-memory — the reason it lives outside the tx is to short-circuit on auth failure before opening a transaction, not because it avoids DB access.
- Load current agency row inside tx; `throw error(404, "Agency not found")` if missing.
- If `status` / `subscriptionTier` present → update; write `agencyActivityLog` entries matching current `updateAgencyStatus` semantics (lines 253-282) using the same `subscription.upgraded` / `subscription.downgraded` / `agency.status_changed` action strings.
- **Payload semantics — desired end-state, not partial patch.** When the `freemium` object is present, its fields describe the target state. E.g. a payload of `{ enabled: true, reason: "internal", expiresAt: null }` means "freemium should be enabled with reason=internal and no expiry" — it is **not** "only update reason". The handler writes every field in the incoming `freemium` object, so a missing `expiresAt` means "don't include it in the patch" while an explicit `null` means "clear it". The modal is responsible for sending the complete desired state for the freemium section whenever it's dirty.
- If `freemium` present:
  - **enable → disable transition** (currently true, becoming false): set `isFreemium=false`, `freemiumRevokedBy=currentUser.id`, `freemiumRevokedAt=now`. Leave `reason`/`grantedAt`/`grantedBy` for history.
  - **disable → enable transition**: if `reason` is undefined → `throw error(400, "Freemium reason is required when granting access")` (explicit, not silent null write). Set `isFreemium=true, freemiumReason=reason, freemiumGrantedAt=now, freemiumGrantedBy=currentUser.id, freemiumExpiresAt=normalizeExpiry(expiresAt)`, and clear `freemiumRevokedAt/By` so a re-grant doesn't look revoked.
  - **already-enabled, edit in place**: update `reason` and/or `freemiumExpiresAt` to the values in the payload (see desired end-state note above — an explicit `null` on `expiresAt` clears it). **Preserve** `freemiumGrantedAt` / `freemiumGrantedBy` — the grant is a continuous relationship, not a series of events. Reason changes are captured in the log payload.
- Write `agencyActivityLog` entries via `tx.insert(agencyActivityLog).values(...)`. Action strings (free `varchar(100)` per [schema.ts:208](service-client/src/lib/server/schema.ts#L208), no enum migration needed):
  - `freemium.granted` — `newValues: { reason, expiresAt }`
  - `freemium.revoked` — `oldValues: { reason: prev.freemiumReason, expiresAt: prev.freemiumExpiresAt }`
  - `freemium.updated` — `oldValues: { reason?: prev.freemiumReason, expiresAt?: prev.freemiumExpiresAt }`, `newValues: { reason?: nextReason, expiresAt?: nextExpiresAt }` — include only the fields that actually changed so the delta is clear in the audit trail.
- **Activity log actor column** — `agencyActivityLog` likely has a non-null `userId` / actor column. Confirm the column definition in [schema.ts:198-222](service-client/src/lib/server/schema.ts#L198-L222) during implementation. For super-admin-driven writes this is fine (`currentUser.id`). Not a blocker for this PR — the beta-invite path isn't being migrated — but flag it if the column is NOT NULL, since any future log entry written from the beta-invite code path would need a sentinel actor value.
- Return the updated agency row inside the tx (same shape callers already expect).

**Date handling — `normalizeExpiry(input: string | null | undefined)` in `service-client/src/lib/utils/freemium.ts` (shared module, imported by both the modal and the remote function):**
- The modal sends `YYYY-MM-DD` from `<input type="date">`.
- Wire schema is `v.isoTimestamp()` — modal must convert before submit. Use `input ? new Date(input + "T23:59:59.999Z").toISOString() : null` (end-of-day UTC).
- Rationale: matches typical billing/expiry semantics — agency keeps access through the chosen day in any timezone. Document this in a comment on the helper.
- Empty string from the date input → `null` (no expiry).
- **Why shared, not duplicated**: duplicated date math drifts — one side gets a DST or leap-day fix, the other doesn't, and off-by-one expiries become a year-later bug. One exported function, one set of tests, two import sites.

**Delete** the three old commands once all callers are migrated. Caller audit confirmed via `grep -rn "updateAgencyStatus\|revokeAgencyFreemium\|updateFreemiumExpiry" service-client/` — only 3 files reference them (the definition file plus the two below). No loaders or tests slip through.

Callers to update in same PR:
- [super-admin/agencies/[agencyId]/+page.svelte:78-81](service-client/src/routes/(app)/super-admin/agencies/[agencyId]/+page.svelte#L78-L81) — modal submit.
- [super-admin/freemium/+page.svelte](service-client/src/routes/(app)/super-admin/freemium/+page.svelte) — revoke button + expiry edit modal.

**Note on `status` picklist**: `"cancelled"` is already in the existing `updateAgencyStatus` Valibot picklist ([super-admin.remote.ts:223](service-client/src/lib/api/super-admin.remote.ts#L223)) even though the current modal `<select>` only exposes Active/Suspended. Carrying it forward in `updateAgencyAccess` is not a scope expansion — preserves existing server contract. Whether to add it to the modal `<select>` is a separate UX call; recommend keeping the modal options as-is (Active/Suspended) to match current behaviour.

### 5. Agency detail modal — [super-admin/agencies/[agencyId]/+page.svelte:386-429](service-client/src/routes/(app)/super-admin/agencies/[agencyId]/+page.svelte#L386-L429)

Rename modal title from "Change Status / Tier" → "Change Access". Add third section after tier select:

```
Status:            [ Active / Suspended / Cancelled ]
Subscription Tier: [ Free / Starter / Growth / Enterprise ]
                   ⚠ Ignored while freemium is active        (shown only when freemium.enabled)

Freemium Access:   ( ) None  ( ) Granted
  When Granted:
    Reason:   [ Beta Tester / Partner / Promotional / Early Signup / Referral Reward / Internal ]
    Expires:  [ date picker ]  [ Clear ]    (empty = no expiry)
```

State additions (near [line 50-52](service-client/src/routes/(app)/super-admin/agencies/[agencyId]/+page.svelte#L50-L52)):
```ts
let freemiumEnabled = $state(agency.isFreemium);
let freemiumReason = $state(agency.freemiumReason ?? "internal");
let freemiumExpiresAt = $state(agency.freemiumExpiresAt?.toISOString().slice(0, 10) ?? "");
```

Submit builds the `freemium` object only if the admin touched it (track a `freemiumDirty` flag set by any onChange in the freemium section — including clearing the date input), then converts the date input via `normalizeExpiry()` imported from `$lib/utils/freemium.ts` (shared with the server handler), then calls `updateAgencyAccess({ agencyId, status, subscriptionTier, freemium? })`.

**Clearing vs not touching the date input**: both produce an empty string in `freemiumExpiresAt` state, but the dirty flag disambiguates intent. If the admin opens the modal and never touches the freemium section, `freemiumDirty` stays false and the `freemium` key is omitted from the payload entirely (handler leaves the agency row's freemium columns alone). If the admin clears the date, `freemiumDirty` flips true and the submit sends `expiresAt: null`, which the handler writes as NULL per the desired-end-state semantics.

Show a confirmation toast per existing pattern.

Also extend the `AgencyDetails` interface (lines 12-41) and the `getAgencyDetails` query return to include `isFreemium`, `freemiumReason`, `freemiumExpiresAt`, `freemiumGrantedAt`, `freemiumGrantedBy`, `freemiumRevokedAt`, `freemiumRevokedBy` so the modal can pre-populate and so the page can render a "Freemium: Granted (Internal, no expiry)" badge next to the existing status/tier badges.

**Beta-invite-granted agencies**: their `freemium_granted_by` is the literal string `"system:beta_invite"` (not a UUID — see [agency.remote.ts:323](service-client/src/lib/api/agency.remote.ts#L323)). The badge / detail rendering must format this gracefully, e.g.:
```
freemium_granted_by === "system:beta_invite" → "System (beta invite)"
freemium_granted_by starts with "system:"   → "System"
otherwise                                   → look up user, show name
```
Same for any future `freemium_revoked_by` written by manual SQL.

### 6. Freemium Users page — [super-admin/freemium/+page.svelte:291-315](service-client/src/routes/(app)/super-admin/freemium/+page.svelte#L291-L315)

Update existing actions to call the unified command:
- Revoke → `updateAgencyAccess({ agencyId, freemium: { enabled: false } })`
- Expiry edit → `updateAgencyAccess({ agencyId, freemium: { enabled: true, reason: currentReason, expiresAt } })` (must preserve current reason — read from row).

**`currentReason` must come from the row state at click time**, not from stale component-level state. Read it from the specific row being acted on (e.g. inside the click handler, not hoisted to a page-level variable set on load). Matters if `getFreemiumAgencies` invalidates between page load and click — the snapshot the admin is acting on should be the fresh one.

No grant button added here per user decision.

## What not to touch

- Beta invite creation flow ([agency.remote.ts:319-324](service-client/src/lib/api/agency.remote.ts#L319-L324)) — keeps writing freemium directly at creation with `reason: "beta_tester"`. Migrating it to `updateAgencyAccess` is out of scope; the column writes are compatible.
- `getFreemiumAgencies` list query — response shape unchanged.
- `getEffectiveTier` and `enforceSeoAuditLimit` — freemium → enterprise override already works ([subscription.ts:140-148](service-client/src/lib/server/subscription.ts#L140-L148)).
- Free/Starter/Growth/Enterprise `TIER_DEFINITIONS` — unchanged.

## Verification

### Pre-deploy (local)

1. Apply migration: `sh scripts/run_migrations.sh`. Re-run — expect no error (idempotency).
2. Regenerate sqlc: `sh scripts/run_queries.sh postgres`. Confirm `models.go` and `query_postgres.sql.go` now include `FreemiumRevokedBy` / `FreemiumRevokedAt`.
3. Type check: `cd service-client && npm run check` — no new errors introduced.
4. Start stack: `docker compose up --build`.

### Functional — Super Admin agency detail modal

Logged in as super admin (Ben):

1. Navigate to `/super-admin/agencies/<plentify-id>`. Confirm freemium badge shows "Granted (Internal, no expiry)" (Plentify was freemium-flagged earlier today).
2. Open "Change Access" modal. Confirm freemium section pre-populated: Granted / Internal / (empty date).
3. Switch Freemium Access to "None", submit. Expect:
   - `agencies.is_freemium = false`, `freemium_revoked_by = <ben-user-id>`, `freemium_revoked_at = now`.
   - Badge updates to "None" (or absent).
   - `agency_activity_log` entry `freemium.revoked`.
4. Re-open modal. Switch to "Granted", reason = "Internal", expires = blank. Submit. Expect:
   - `is_freemium=true`, `freemium_granted_by=<ben-user-id>`, `freemium_granted_at=now`, `freemium_revoked_*` cleared.
   - `agency_activity_log` entry `freemium.granted`.
5. Re-open, set expiry = +30 days. Submit. Expect `freemium_expires_at` set, no change to `granted_by/at`, log entry `freemium.updated`.
6. Try to submit "Granted" with no reason selected — expect 400 from server (explicit `throw error(400, ...)` in handler, since Valibot `v.optional(reason)` accepts undefined at the schema level).
6b. **Combined update** — change status from Active → Suspended **and** revoke freemium in one submit. Confirm both writes land in a single request and two `agency_activity_log` entries exist (`agency.status_changed` + `freemium.revoked`). Exercises the transaction wrapping the whole handler body.
6c. **Rollback** (local only, delete before merge) — temporarily force a throw from inside the `tx.insert(agencyActivityLog)` call (e.g. rename the log table in dev, or add a `throw new Error("test")` after the agency update). Submit a freemium change. Confirm the agency row is **not** updated — proves the transaction actually wraps what it claims to.

### Functional — Freemium Users page

7. Navigate to `/super-admin/freemium`. Confirm Plentify appears.
8. Click the expiry-edit icon, change date, save. Reason must be preserved (no loss of "internal" label after save).
9. Click revoke icon, confirm. Row disappears from the filtered list. `freemium_revoked_by/at` populated.

### Functional — beta-invite display compatibility

9b. Find an agency that was created via beta invite (`freemium_granted_by = 'system:beta_invite'`). Open its detail page. Confirm the freemium badge renders "System (beta invite)" rather than blank or a broken UUID lookup. Same check on the Freemium Users list row.

### Functional — quota enforcement (the original motivation)

10. Under a freemium-enabled agency, start an SEO audit. Expect no quota block ([canRunSeoAudit](service-client/src/lib/server/subscription.ts#L443-L509) returns `unlimited: true` via enterprise override).
11. Revoke freemium on a free-tier agency. Start SEO audit. Expect the original "Monthly SEO audit limit reached (0/0)" 403.

### Go backend

12. Trigger any code path that hits `GetAgencyByStripeCustomer` (e.g., Stripe webhook or the billing page). Confirm no struct-scan panic — proves sqlc regen matches schema.

### Production deploy

13. Run migration 035 on prod via `VPS_HOST=... VPS_USER=... sh scripts/run_migrations.sh production`.
14. Restart `webkit-core` so Go picks up new sqlc-generated struct: `ssh root@$VPS_HOST "docker restart webkit-core"`.
15. Deploy via GitHub Actions "Deploy to Production" workflow.
16. Post-deploy smoke: open `/super-admin/agencies/<plentify-id>`, confirm modal renders with freemium section and Plentify's current state. No action needed — the raw SQL from earlier remains consistent with the new code.

## Resolved during planning

- **Q1 — activity log schema**: confirmed via [schema.ts:198-222](service-client/src/lib/server/schema.ts#L198-L222). `action` is a free `varchar(100)`, no Postgres enum. Free to use `freemium.granted` / `.revoked` / `.updated` strings directly. Migration 035 covers only the two `freemium_revoked_*` columns; no `ALTER TYPE` needed. Bonus: the table already has `oldValues` / `newValues` jsonb columns, perfectly suited for the reason-change delta.
- **Q2 — granted_at/by on reason edit**: **preserve** (handler section above reflects this). `freemium_granted_at` answers "how long has this agency had freemium?" — the most likely audit question. Reason changes are captured in `freemium.updated` log entries with `oldValues.reason` → `newValues.reason` so the trail is intact without overloading the agency row.
- **Migration number**: confirmed via `migrations/` listing — current tail is `034_audit_target_region.sql`, so `035_add_freemium_revoked_columns.sql` is correct.
- **Caller audit**: confirmed only 3 files reference the three commands being absorbed (definition + the 2 listed UI callers).
