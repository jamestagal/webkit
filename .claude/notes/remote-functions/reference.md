# SvelteKit Remote Functions — Reference

Detailed reference for remote functions. For quick-hit pitfalls, see `gotchas.md`.

## Critical Rules

**File naming & location:**
- Files MUST use `.remote.ts` extension
- Location: `src/lib/api/*.remote.ts`
- Do NOT place in `src/lib/server/` (reserved for server-only utilities)

**Export restrictions (CRITICAL):**
- `.remote.ts` files can ONLY export functions wrapped with `query()`, `command()`, `form()`, or `prerender()`
- **Type exports are NOT allowed** — move types to separate `.types.ts` files
- Regular function exports cause runtime errors

```typescript
// BAD — "all exports must be remote functions" error
export type MyType = { ... };
export interface MyInterface { ... }
export const helper = () => { ... };

// GOOD
export const getData = query(schema, async (input) => { ... });
export const saveData = command(schema, async (input) => { ... });
```

## Type Export Pattern

```typescript
// questionnaire.types.ts — separate file for types
export type QuestionnaireResponses = { ... };
export type QuestionnaireAccessResult = { ... };

// questionnaire.remote.ts — import types, only export remote functions
import type { QuestionnaireResponses } from './questionnaire.types';
export const getQuestionnaire = query(...);
```

## Why This Restriction Exists

Remote functions are **server-side functions callable from the client**. SvelteKit:

1. Runs the actual function code on the server
2. Generates a client proxy that makes an HTTP request to the server

SvelteKit validates every export follows this pattern. This fails:

```typescript
// BAD — SvelteKit can't create client proxy
export async function markInviteAsUsed(token: string) {
  await db.update(...)  // Error: all exports must be remote functions
}
```

## Server-Only Utilities Pattern

**Client-callable** → `.remote.ts` with `query()`/`command()`:

```typescript
// beta-invites.remote.ts
export const createBetaInvite = command(schema, async (data) => {
  // Callable from client components
});
```

**Server-only utilities** → regular `.ts` in `$lib/server/`:

```typescript
// $lib/server/beta-invites.ts
export async function markInviteAsUsed(token: string) {
  // Only callable from other server code
  await db.update(...)
}
```

Used in remote functions:
```typescript
// agency.remote.ts
import { markInviteAsUsed } from '$lib/server/beta-invites';

export const createAgency = command(schema, async (data) => {
  if (data.inviteToken) {
    await markInviteAsUsed(data.inviteToken);
  }
});
```

## Function Types

| Type | Purpose | Usage |
|------|---------|-------|
| `query` | Read data | Cached, callable during render |
| `command` | Write data | Cannot be called during render |
| `form` | Form submissions | Works without JS (progressive enhancement) |
| `prerender` | Build-time data | Cached in browser Cache API |

## Validation with Valibot

All functions accepting arguments MUST use Valibot schema validation:

```typescript
// CORRECT — schema as first argument
export const getContract = query(
  v.pipe(v.string(), v.uuid()),
  async (contractId) => { ... }
);

export const updateContract = command(
  UpdateContractSchema,
  async (data) => { ... }
);

// INCORRECT — manual validation inside
export const badExample = command(async (data: unknown) => {
  const validated = v.parse(Schema, data); // Don't do this
});

// No-argument functions — no schema needed
export const getCurrentUser = query(async () => { ... });
```

## Optional Filter Parameters Pattern (CRITICAL)

Wrap optional filter objects with `v.optional()`:

```typescript
const ContractFiltersSchema = v.optional(
  v.object({
    status: v.optional(ContractStatusSchema),
    limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
    offset: v.optional(v.pipe(v.number(), v.minValue(0)))
  })
);

export const getContracts = query(ContractFiltersSchema, async (filters) => {
  const { status, limit = 50, offset = 0 } = filters || {};
});

// Call sites
const contracts = await getContracts({});
const filtered = await getContracts({ status: 'signed' });
```

**Why:**
- Schema MUST be first argument — internal validation doesn't work
- `v.optional()` allows calling with `{}` or `undefined`
- Use `filters || {}` or `filters?.field` for safe access

## Request Context

```typescript
import { getRequestEvent } from '$app/server';

export const myFunction = query(async () => {
  const event = getRequestEvent();
  const cookies = event.cookies;
});
```

Note: `route`, `params`, `url` reflect the **calling page**, not the endpoint.

## Error Handling

```typescript
import { error, redirect } from '@sveltejs/kit';

export const myQuery = query(async () => {
  if (!authorized) throw error(403, 'Forbidden');
  if (needsLogin) throw redirect(302, '/login');
});
```

- `redirect()` works in `query`, `form`, `prerender` (NOT `command`)
- `error()` works in all function types

## Page Data Loading Pattern

SvelteKit supports top-level `await` in components, but **pages with `+page.server.ts` + `command()` calls + stateful child components should load data in `+page.server.ts`** to avoid component remount issues.

See `.claude/notes/sveltekit-data-loading/` for incident details.

```svelte
<!-- CAUTION — may remount on command() if page also has +page.server.ts -->
<script lang="ts">
  const items = await getItems();
  let selected = $state(null);  // can reset on remount
</script>

<!-- PREFERRED for pages with mutations + stateful components -->
<script lang="ts">
  let { data }: PageProps = $props();
  let items = $derived(data.items);
  let selected = $state(null);  // preserved across mutations
</script>
```

**When page has mutations + stateful components:**
1. Fetch in `+page.server.ts` `load`
2. Read from `data` props in `+page.svelte`
3. After mutations, call `invalidateAll()`

**Read-only or simple pages:** top-level `await` is fine.

## Remote Functions Files

| File | Purpose |
|------|---------|
| `agency.remote.ts` | Agency CRUD, members, form options |
| `agency-profile.remote.ts` | Agency profile and settings |
| `agency-packages.remote.ts` | Service packages |
| `agency-addons.remote.ts` | Package addons |
| `consultation.remote.ts` | Client consultations |
| `proposals.remote.ts` | Proposals CRUD |
| `contracts.remote.ts` | Contracts, signing |
| `contract-templates.remote.ts` | Contract templates |
| `invoices.remote.ts` | Invoicing |
| `questionnaire.remote.ts` | Client questionnaires |
| `email.remote.ts` | Email sending/logs |
| `stripe.remote.ts` | Stripe Connect, payments |
| `gdpr.remote.ts` | Data export, deletion |

## Type Files

| File | Types For |
|------|-----------|
| `questionnaire.types.ts` | Questionnaire responses, access results |

## Query Instance Anchoring — When To Use `.run()` vs Anchored `$derived`

**The boundary that matters** is NOT "render context vs non-render context" or "direct vs wrapped binding." It's whether the **query instance** is anchored at component setup, or whether you're creating a **fresh unanchored query** inside an imperative path.

| Where the query is created | What works |
|----------------------------|------------|
| At component setup (top-level `<script>` or `$derived`) | `await` directly anywhere — render context, event handlers, `$effect`, lifecycle hooks. NO `.run()` needed. |
| Fresh inside an event handler / `$effect` body | `await query(...).run()` — `.run()` produces a plain Promise. Or refactor to anchored `$derived`. |
| Fresh inside `setInterval` / `setTimeout` callback (even if scheduled inside `$effect`) | `await query(...).run()` — the timer callback fires post-effect-setup, in pure imperative async context. The `$effect` lexical scope does NOT carry the reactive context into the callback. |
| Fresh inside any Promise chain after a `setTimeout` | `await query(...).run()` — same imperative-async reason. |

### The two error modes — opposite errors, opposite fixes

- **`Cannot call query while not in reactive context`** / `not created in reactive context` → fresh unanchored query. Either add `.run()` or refactor to anchored `$derived`.
- **`Cannot call .run() outside of render`** (or similar) → already anchored. `.run()` is wrong. Just `await` the existing instance.

Misreading these as the same error caused the original Stage 1 regression in commit `cb19f31` (added `.run()` to anchored sites, broke them — see revert `840a1f9`). Read the actual error string before reaching for `.run()`.

### `RemoteQuery<T>` type surface

Sourced from `node_modules/@sveltejs/kit/src/exports/public.d.ts:2185`:

```typescript
type RemoteResource<T> = Promise<T> & {
    get error(): any;
    get loading(): boolean;
} & ({ get current(): undefined; ready: false }
   | { get current(): T;          ready: true });

type RemoteQuery<T> = RemoteResource<T> & {
    run(): Promise<T>;
    set(value: T): void;
    refresh(): Promise<void>;
    withOverride(update: (current: T) => T): RemoteQueryOverride;
};
```

The `ready` discriminator gives type-safe `current` access in templates without `{#await}`. Pattern:

```svelte
{#if !usersQuery.ready}
    <Spinner />
{:else if usersQuery.error}
    <Error>{usersQuery.error?.message ?? 'Failed'}</Error>
{:else if usersQuery.ready && usersQuery.current.users.length === 0}
    <Empty />
{:else if usersQuery.ready}
    {#each usersQuery.current.users as u (u.id)}...{/each}
{/if}
```

`ready: true` narrows `current` from `undefined` to `T`, so `usersQuery.current.users` is type-safe inside the `{:else if usersQuery.ready}` branch.

### Anchored `$derived` pattern — canonical for dual-path filter/search

When a remote query is called from BOTH a lifecycle path (`onMount`, `$effect`) AND event handlers (filter checkbox onchange, mutation refetch, pagination), neither `.run()` nor a bare `await` works for both paths. The fix is to anchor the query at component setup so every caller reads from the same anchored instance:

```svelte
<script lang="ts">
    let filters = $state({ search: '', superAdminOnly: false, ownersOnly: false });
    let currentPage = $state(1);
    const pageSize = 20;

    // Anchored: $derived recomputes when filters/pagination change → query auto-refetches
    const usersQuery = $derived(
        getUsers({
            search: filters.search || undefined,
            superAdminOnly: filters.superAdminOnly || undefined,
            ownersOnly: filters.ownersOnly || undefined,
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
        })
    );

    async function handleToggleSuperAdmin() {
        await updateUserAccess({ ... });
        await usersQuery.refresh();   // replaces imperative `await loadUsers()`
    }
</script>
```

**Reference implementation:** the `super-admin/users` Phase B refactor (commit `9771e2a`). Key properties:
- Pagination MUST be in the derived payload (`limit` / `offset`) so `currentPage++` triggers refetch
- Mutation post-refresh uses `await usersQuery.refresh()` (the `RemoteQuery` API), not imperative refetch
- Filter changes write to the `$state` object; the `$derived` recomputes automatically — no event handler "trigger" needed
- Search debounce: bind to a separate `searchInput` $state, debounce-write into `filters.search` so the derived doesn't refire on every keystroke

### When the docs aren't enough, read the runtime source

The SvelteKit experimental remote functions docs don't yet cover the anchoring rule completely. The deciding rule today came from reading runtime source directly:

- `node_modules/@sveltejs/kit/src/runtime/app/server/remote/query.js:290` — `refresh()` API shape and Promise return
- `node_modules/@sveltejs/kit/src/exports/public.d.ts:2185` — `RemoteQuery<T>` / `RemoteResource<T>` type surface (the source of truth for `ready`, `current`, `loading`, `error`, `refresh`)
- The runtime tracks "is in reactive context" via render-tracking primitives — the lexical scope of `$effect` does NOT carry into a `setInterval` callback even though the callback was scheduled there

For experimental SvelteKit features, the `node_modules/@sveltejs/kit/src/runtime/...` and `.../src/exports/public.d.ts` are the authoritative rule source. Three premise revisions during the 2026-04-29 audit were avoidable if we'd gone to source first instead of cycling on docs interpretations.
