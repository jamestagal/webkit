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
