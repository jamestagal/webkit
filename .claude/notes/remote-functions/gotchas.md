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

---

## The Two `.run()` Error Modes — Opposite Errors, Opposite Fixes

**Discovered:** 2026-04-29 (run-audit Stage 1 → Phase A/A.5/B)
**Impact:** Adding `.run()` to anchored sites breaks them; omitting it from unanchored sites breaks them. Same `.run()` token, opposite remedy.

### The Two Errors

- **`Cannot call query while not in reactive context`** / `not created in reactive context` → the call site has a **fresh unanchored query** inside an imperative path. Fix: add `.run()` to produce a plain Promise, OR refactor the caller to use an anchored `$derived(getX(...))`.
- **`On the client, .run() can only be called outside render, e.g. in universal load functions and event handlers. In render, await the query directly`** → the call site is **already anchored** (e.g. inside `loadUsers()` called from `onMount`). `.run()` is wrong. Just `await` the existing query instance.

### Real Incident

Stage 1 (commit `cb19f31`) added `.run()` to seven sites including `users.svelte:96` (`loadUsers` function — called from BOTH `onMount` AND event handlers). The `onMount` path then surfaced the second error mode rendered AS PAGE CONTENT, not just console — this is the diagnostic signal that the throw happened in render-tracking context. Reverted in `840a1f9`. The fix was to split into:

- **Phase A (`e7e095e`)** — `.run()` on event-handler-only callers
- **Phase B (`9771e2a`)** — anchored `$derived(getUsers(...))` refactor for the dual-path `loadUsers` site

### Detection Method

Before reaching for `.run()`, **read the actual error string in the Svelte runtime warning, not the broad framing in your head**. The two errors look superficially similar ("not in reactive context" / "outside render") but they describe opposite states.

If a site is dual-path (called from BOTH lifecycle AND event handlers) — see the Dual-Path gotcha below — neither raw `.run()` nor raw `await` works for both callers. Refactor.

---

## `setInterval` / `setTimeout` Inside `$effect` Needs `.run()`

**Discovered:** 2026-04-29 (Phase A.5)
**Impact:** Polling that looks like it's in reactive context (because it's inside `$effect`) actually fires in imperative async context. The query inside the timer callback errors with "not in reactive context" if it lacks `.run()`.

### Counterintuitive Mechanic

`$effect` runs synchronously to set up tracked dependencies. Anything **scheduled** by the effect (a `setInterval`, `setTimeout`, or unawaited Promise) fires AFTER `$effect` returns, in plain async context. The lexical scope of `$effect` does NOT carry the reactive tracking into the deferred callback.

### Reference Bug + Fix

Site: `apps/service-client/src/routes/(app)/[agencySlug]/content/crawl/+page.svelte:80`

```svelte
$effect(() => {
    if (!crawlJob) return;
    const status = crawlJob.status;
    if (status === "complete" || status === "failed" || status === "cancelled") return;

    const interval = setInterval(async () => {
        try {
            // BEFORE Phase A.5 — errored with "not in reactive context"
            // const updated = await getCrawlStatus(crawlJob!.id);

            // AFTER Phase A.5 (commit b573580) — works
            const updated = await getCrawlStatus(crawlJob!.id).run();
            crawlJob = updated;
        } catch (e) {
            console.error("Poll failed:", e);
        }
    }, 2000);

    return () => clearInterval(interval);
});
```

### Rule

Any query call inside a `setInterval`, `setTimeout`, or Promise chain scheduled from `$effect` (or from an event handler) needs `.run()`, regardless of how the parent code looks. The deciding factor is when the query is **invoked**, not when it's syntactically nested.

### Other Sites To Audit On This Pattern

The Phase A.5 fix was the canonical example, but three other content-polling sites use the same scheduling pattern and are queued for the same fix in a future template-apply phase:

- `content/[clientId]/brand:199`
- `content/[clientId]/audit:63`
- `agencies/create:50`

Smaller blast radius than Phase A.5 (these don't have a tight 2-second loop), but the same rule applies.

---

## Dual-Path Sites — Refactor To Anchored `$derived`, Don't Add `.run()`

**Discovered:** 2026-04-29 (Phase B)
**Impact:** Sites called from BOTH lifecycle paths (`onMount`, `$effect`) AND event handlers cannot be fixed by adding `.run()` — `.run()` rejects in render context, while a bare `await` rejects in event-handler context. The two paths have opposite requirements.

### Detection: Call-Graph Triage

Grep every caller of the function. Classify each:

- **Lifecycle:** called from `onMount`, `$effect`, top-level `<script>` await, `+page.server.ts` `load`
- **Event-handler-only:** called from `onclick`, `onsubmit`, `oninput`, mutation handlers, post-mutation refetch chains
- **Timer:** called from `setInterval`, `setTimeout` callbacks (these are event-handler-equivalent — see the previous gotcha)

If callers span more than one category, the site is dual-path and `.run()` is the wrong fix.

### The Refactor — Anchored `$derived(getX(...))`

The fix is to remove the function entirely and anchor the query at component setup. Every caller — lifecycle, event handler, mutation refetch, pagination — reads from the same anchored instance, so the runtime sees one consistent reactive context.

Reference implementation: `apps/service-client/src/routes/(app)/super-admin/users/+page.svelte` (commit `9771e2a`):

```svelte
<script lang="ts">
    let filters = $state({ search: '', superAdminOnly: false, ownersOnly: false });
    let searchInput = $state('');
    let currentPage = $state(1);
    const pageSize = 20;

    // Anchored — replaces the old loadUsers() imperative function
    const usersQuery = $derived(
        getUsers({
            search: filters.search || undefined,
            superAdminOnly: filters.superAdminOnly || undefined,
            ownersOnly: filters.ownersOnly || undefined,
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
        })
    );

    // Mutation post-refresh — replaces `await loadUsers()`
    async function handleToggleSuperAdmin() {
        await updateUserAccess({ ... });
        await usersQuery.refresh();
    }
</script>

<!-- Filter handlers just write to filters; $derived recomputes -->
<input bind:checked={filters.superAdminOnly} onchange={() => currentPage = 1} />

<!-- Pagination just mutates currentPage; $derived recomputes -->
<button onclick={() => currentPage--}>Previous</button>
```

### Other Sites Queued For This Refactor

Per the run-audit final-result (`9771e2a` close-the-loop), four more dual-path sites need the same template-apply: `super-admin/freemium`, `super-admin/audit-log`, `super-admin/beta-invites`, `super-admin/agencies`, `super-admin/form-templates`. Per-site commit, smoke each, bisect-clean.

---

## When Docs Aren't Enough, Read The Runtime Source

**Discovered:** 2026-04-29 (run-audit, after three premise revisions)
**Impact:** Methodological — for experimental SvelteKit features, docs interpretation alone produces wrong rules. The runtime source is the only authoritative rule source.

### What Happened

The original Stage 1 spec for the `.run()` audit cycled through three docs-derived rules:

1. **"Add `.run()` everywhere outside render"** — broke onMount paths
2. **"Add `.run()` only in event handlers"** — broke dual-path callers
3. **"Add `.run()` only inside imperative wrappers"** — broke `$effect`/`setInterval` (the timer callbacks ARE imperative wrappers but the rule didn't capture that)

Each revision was based on docs reading + edge-case extrapolation. Each broke something on the next click-test.

The fourth (and holding) rule came from reading runtime source directly:

- `node_modules/@sveltejs/kit/src/runtime/app/server/remote/query.js` — confirmed `refresh()` exists, returns `Promise<void>`, sets `loading=true` during refetch
- `node_modules/@sveltejs/kit/src/exports/public.d.ts:2185` — full `RemoteQuery<T>` type surface, including the `ready` discriminator for type-safe `current` access
- The runtime's "is in reactive context" check uses render-tracking primitives — confirmed by reading the call sites, not by inferring from the docs

### Rule

If a hypothesis fails empirical test more than twice, **stop iterating on the hypothesis**. Go to the authoritative source — runtime source code, public type declarations, the actual error-throw site in the framework. The premise is wrong, not the edge cases.

For SvelteKit experimental features specifically, the authoritative sources are:

- `node_modules/@sveltejs/kit/src/runtime/...` — runtime behavior
- `node_modules/@sveltejs/kit/src/exports/public.d.ts` — public type contract
- The actual error message text in the Svelte/SvelteKit warnings (read it verbatim, don't paraphrase)

### Related

This is also a project-agnostic learning. The cross-project version lives in `~/Workspaces/shared-context/learnings/` (queued via `/learn`).
