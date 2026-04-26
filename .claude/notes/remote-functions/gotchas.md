# Remote Functions Gotchas

## Exporting Non-Remote Functions From `.remote.ts` Files

**Discovered:** 2026-02-20 (Wave 5 Content Intelligence)
**Impact:** Build fails — `npm run check` passes but `npm run build` crashes

### The Problem

`.remote.ts` files can ONLY export functions wrapped with `query()`, `command()`, `form()`, or `prerender()`. Exporting any other value — regular functions, types, constants, interfaces — causes a build-time error:

```
Error: `contentFetch` exported from src/lib/api/content.remote.ts is invalid
— all exports from this file must be remote functions
```

**The trap:** `npm run check` (svelte-check) does NOT catch this. It only surfaces during `npm run build` when SvelteKit validates remote function module exports. Always run both check AND build before committing.

### Why It Happens

SvelteKit processes `.remote.ts` files specially. On the client, it generates proxies that make HTTP requests to the server. Every export must follow the remote function pattern so SvelteKit knows how to create the client-side proxy. A regular function export breaks this contract.

### The Fix

Move shared server utilities to `$lib/server/*.ts` files (plain server-only modules):

```
BEFORE (broken):
  src/lib/api/content.remote.ts
    export async function contentFetch<T>() { ... }  // BAD
    export const startCrawl = command(...)            // OK

AFTER (working):
  src/lib/server/content-fetch.ts
    export async function contentFetch<T>() { ... }  // OK - plain .ts file

  src/lib/api/content.remote.ts
    import { contentFetch } from "$lib/server/content-fetch";
    export const startCrawl = command(...)            // OK
```

### Rules

1. `.remote.ts` exports: ONLY `query()`, `command()`, `form()`, `prerender()` wrapped functions
2. Type exports: Put in separate `.types.ts` files (e.g., `content.types.ts`, `content-brand.types.ts`)
3. Shared server utilities: Put in `$lib/server/*.ts` files
4. Always run `npm run build` (not just `npm run check`) to catch this class of error

### Files Using This Pattern

- `$lib/server/content-fetch.ts` — shared `contentFetch()` proxy helper
- `$lib/api/content.remote.ts` — imports from `$lib/server/content-fetch`
- `$lib/api/content-brand.remote.ts` — imports from `$lib/server/content-fetch`
- `$lib/api/content-audit.remote.ts` — imports from `$lib/server/content-fetch`
- `$lib/api/content-copy.remote.ts` — imports from `$lib/server/content-fetch`

### Real Incident

Wave 5 Agent A exported `contentFetch` directly from `content.remote.ts` so that brand/audit/copy remote files could import it. `npm run check` passed across all 4 agents. The build failure was only caught during final verification (`npm run build`). Fix: created `$lib/server/content-fetch.ts` and updated all 4 import paths.

---

## Raw SQL Writes Bypass Handler-Mediated Audit Logs

**Discovered:** 2026-04-16 (Super Admin Freemium Grant feature deploy)
**Impact:** Silent gap in `agency_activity_log` — records in expected state but no audit trail entry

### The Problem

When activity logging lives inside a remote function's `db.transaction` (as it does for `agencyActivityLog`, and will for any similar pattern), emergency `docker exec psql ... UPDATE ...` fixes skip every side effect the handler owns. The target row is correct. The log row never existed.

Same class of miss applies to any handler-side-effect: webhook dispatches, cache invalidation, derived-column maintenance, counter increments.

### How It Manifested

Plentify's freemium was granted via raw SQL before the `updateAgencyAccess` command existed. After deploy, the super-admin audit page showed log entries for Stop Leak Bathrooms (granted through the new UI) but **nothing** for Plentify — despite Plentify being clearly freemium-enabled with "Granted by System" on the detail page. No bug, just the direct DB write bypassing the handler's `tx.insert(agencyActivityLog)`.

### Why It Happens

`updateAgencyAccess` wraps the agency update + activity log insert in a single transaction:

```typescript
await db.transaction(async (tx) => {
  await tx.update(agencies).set({ isFreemium: true, ... });
  await tx.insert(agencyActivityLog).values({ action: 'freemium.granted', ... });
});
```

`psql` hitting `agencies` directly executes neither the transaction boundary nor the log insert. Only the target table changes.

### The Fix (Prevention)

**Build the UI path before you need the emergency fix.** The existence of a "there's no UI for this yet" gap is the leading indicator that someone is about to write raw SQL against prod. The freemium grant feature existed as a Super Admin gap for weeks before it became a PR — every one of those weeks was raw-SQL risk.

**If raw SQL is genuinely unavoidable,** write the log row by hand in the same transaction:

```sql
BEGIN;
UPDATE agencies
  SET is_freemium = true,
      freemium_reason = 'internal',
      freemium_granted_at = NOW(),
      freemium_granted_by = '<your-user-id>'
  WHERE id = '<agency-id>';

INSERT INTO agency_activity_log (agency_id, user_id, action, new_values)
  VALUES ('<agency-id>', '<your-user-id>', 'freemium.granted',
          '{"reason":"internal","expiresAt":null}'::jsonb);
COMMIT;
```

Less convenient than the handler but preserves the trail.

### Fixing The Gap After The Fact

Once the UI exists, you can re-do the action through it (revoke → re-grant) to produce a proper audit pair. Trade-off: loses the original `freemium_granted_at` / `freemium_granted_by` values. Tenure and origin info overwrite.

For Plentify specifically: **not worth it.** The record is functionally correct, the "System" granted_by is accurate history ("we bootstrapped this via SQL"), and all future actions will be audited properly. Don't rewrite history for audit trail aesthetics.

### Rule Of Thumb

Treat handler-owned side effects (log writes, webhooks, cache busts, counter increments) as part of the *meaning* of the write, not an addendum. Raw SQL strips the meaning and leaves only the state.

### Related Files

- `apps/service-client/src/lib/api/super-admin.remote.ts` — `updateAgencyAccess` command wraps agency update + log insert in `db.transaction`
- `apps/service-client/src/lib/server/schema.ts:198-222` — `agencyActivityLog` table
- `docs/planning/quizzical-yawning-swan.md` — full context on the freemium grant feature that exposed this gap
