# CLAUDE.md

Guidance for Claude Code when working in this repository. Reference docs in `.claude/notes/` are loaded on-demand.

## Shared Context

**Read `~/Workspaces/shared-context/standards/conventions.md` at session start** — auto-capture rules for learnings and gotchas. Before duplicating knowledge here, check:
- **Workflow standard:** `~/Workspaces/shared-context/standards/claude-code-workflow.md`
- **Svelte 5 rules:** `~/Workspaces/shared-context/stack/svelte5-rules.md`
- **SvelteKit patterns:** `~/Workspaces/shared-context/stack/sveltekit-patterns.md`
- **Go backend patterns:** `~/Workspaces/shared-context/stack/go-patterns.md`
- **Drizzle patterns:** `~/Workspaces/shared-context/stack/drizzle-patterns.md`
- **Deployment patterns:** `~/Workspaces/shared-context/stack/deployment.md`
- **Deployment gotchas:** `~/Workspaces/shared-context/learnings/deployment-gotchas.md`
- **SvelteKit gotchas:** `~/Workspaces/shared-context/learnings/sveltekit-gotchas.md`
- **Conventions:** `~/Workspaces/shared-context/standards/conventions.md`

Downstream fork: leap-learn (`~/Projects/personal/leap-learn/`)

## Cross-Agent Comms (`.comms/`)

When working a thread with Cowork (the Claude desktop app acting as spec-drafter / appraiser), follow the protocol in `.comms/README.md`. The chat-vs-file and big-decisions rules:

- Substantive appraisals, verification responses, clearance decisions, and design rationale go in a `.comms/` file. Chat gets a **one-line pointer** (filename + one-sentence verdict), not the full body.
- Big decisions — anything that materially changes scope, security posture, or the spec contract — consult the user in chat *first*, get a call, *then* file the durable record.
- `.comms/` is gitignored — local-machine durable record only, not synced across machines.

### Inbox handling — the four-step ritual (not optional)

At session start (or on user nudge), check `.comms/cowork-to-claude/` for files with `status: open`. When you find one, do these in order, **every time**:

1. **Read the content fully** — frontmatter + body.
2. **Flip the source file's `status` from `open` to `answered`** before doing anything else. Single Edit; takes 2 seconds. This is a *precondition* to addressing the content, not an afterthought.
3. **Address the content** — do the work the message describes, ask for clarification if needed, etc.
4. **Write a brief reply file in `.comms/claude-to-cowork/`** with `in_reply_to: <source-filename>` and a short body — even if the substantive response is just "acknowledged, addressed via X, proceeding." One-liner replies are fine; the loop closure matters more than length.

**Steps 2 and 4 are not optional.** They are how the protocol works. Skipping them re-surfaces "already addressed" messages on the next session-start scan as if they were new — wasting context, wasting time, and degrading the cross-session decision thread the protocol exists to preserve.

If you're tempted to skip step 2 or 4 because you want to "get to the real work," resist. The file hygiene IS part of the work. Two seconds now saves a confused inbox scan later.

### Reply file template

Minimum-viable reply when the appraisal/instruction was clear and you're proceeding without negotiation:

```yaml
---
from: claude-code
to: cowork
thread: <slug from source file>
status: acknowledged
in_reply_to: <source-filename>
created: <ISO-8601 with TZ>
---

Acknowledged appraisal. Flag 1 addressed via <one-line how>. Proceeding with PR1.
```

Longer replies (post-PR verification reports, design pushback, blocker reports) get the full PR-comment treatment. The minimum-viable form above is for "no negotiation needed" cases — most acknowledgments fall there.

## Three-Layer Workflow

Specs flow: **Cowork (draft)** → **Claude Code plan mode (plan)** → **Cowork (appraise plan)** → **Claude Code (implement)**.

1. User drafts spec in Cowork and saves to `.cowork/planning/active/` (symlinked to `~/Documents/Claude/Projects/Webkit/`)
2. User pastes the spec path here and enters **Plan mode** — you produce an implementation plan (no code yet)
3. User takes the plan back to Cowork for appraisal; feedback comes back as revisions to the plan
4. Iterate the plan until user approves; **only then** exit plan mode and implement
5. During implementation, write project learnings to `.claude/notes/{feature}/`; cross-project learnings queue in `~/Workspaces/shared-context/promotions-to-review/` for later promotion
6. Commit with a `Spec: <filename>.md` trailer to auto-stamp the spec in `.cowork/planning/active/` with the commit SHA
7. Once verified complete, run `/ship <filename>` to archive the spec to `.cowork/archive/completed/` (closes Layer 3)

### `.cowork/` write policy

Agents are **read-only** under `.cowork/` with **two narrow exceptions**:

1. `/ship` may move a spec file between `.cowork/planning/active/` and `.cowork/archive/{completed,superseded}/`
2. `/ship` may edit `.cowork/FEATURE-TRACKER.md` to flip a feature's status (e.g. `READY` → `DONE`). Matches entries by the `[slug]` anchor on the entry headline. Confirmation required before applying the edit.

Format convention for tracker entries — each entry headline carries a slug anchor matching its spec filename stem:

```
DONE      [content-intelligence-nav-redesign] Content Intelligence Nav Redesign — shipped 2026-04-17
          Spec: archive/completed/content-intelligence-nav-redesign.md
```

No other writes, edits, renames, or deletes under `.cowork/` — Cowork owns that workspace.

### Git hooks

One-time per clone: `sh scripts/install-git-hooks.sh`. Installs `post-commit` which stamps the matching Cowork spec when the commit message contains a `Spec: <filename>.md` trailer. Silent no-op if the trailer is absent or the spec is missing.

Full pattern: `~/Workspaces/shared-context/standards/claude-code-workflow.md`.

## Karpathy Coding Principles

Behavioral guidelines to reduce common LLM coding mistakes. Bias toward caution over speed — use judgment for trivial tasks.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables YOUR changes made unused. Leave pre-existing dead code alone unless asked.

The test: Every changed line traces directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with verification per step:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

## Plan Mode

- Make plans extremely concise. Sacrifice grammar for concision.
- Create a new planning document for each new feature. Don't append to previous plan files.
- End each plan with unresolved questions, if any.

## Project Overview

**Webkit** is a multi-tenant SaaS platform for web agencies to create client consultations and proposals. Agency-based tenancy with customizable forms and branding per agency.

## Architecture Overview

Microservices:
- **Core Service** (Go): gRPC + REST APIs, database interactions
- **Admin Service** (Go): web admin interface, Server-Sent Events
- **Client Service** (SvelteKit + TS + Svelte 5 runes): frontend app
- **Database**: PostgreSQL primary (SQLite/Turso supported)
- **Message Queue**: NATS
- **Monitoring**: Grafana + Prometheus

Services communicate via gRPC (internal) and REST (external). Protobuf defs in `/proto`.

### Service Ports
- Client: http://localhost:3000
- Admin: http://localhost:3001 (HTTP) / 3002 (SSE)
- Core: http://localhost:4001 (HTTP) / 4002 (gRPC)
- PostgreSQL: localhost:5432
- NATS: localhost:8222
- Mailpit: http://localhost:8025 (UI) / 1025 (SMTP)

## Multi-Tenancy Architecture

**Shared database, row-level tenant isolation** — NOT separate databases per agency. All tables use `agency_id` columns.

### Key Tables
- `agencies` — core tenant table (branding, billing, status)
- `agency_memberships` — user-agency relationships (owner/admin/member)
- `agency_form_options` — customizable form dropdowns per agency
- `agency_proposal_templates` — future proposal templates
- `consultations`, `consultation_drafts` — scoped by `agency_id`

### Data Isolation (MANDATORY)

All database queries MUST use `withAgencyScope()`:

```typescript
// apps/service-client/src/lib/server/db-helpers.ts
const consultations = await withAgencyScope(agencyId, async (id) => {
    return db.query.consultations.findMany({
        where: eq(consultations.agencyId, id)
    });
});
```

### Form Customization

Agencies customize dropdowns via `agency_form_options` table. 14 configurable categories: `industry`, `business_type`, `budget_range`, `urgency_level`, `primary_challenges`, `technical_issues`, `solution_gaps`, `digital_presence`, `marketing_channels`, `primary_goals`, `secondary_goals`, `success_metrics`, `kpis`, `budget_constraints`.

Flow: layout loads config in `[agencySlug]/+layout.server.ts` → `setAgencyConfig()` module state → components call `getAgencyConfig()` → falls back to defaults.

### Permissions & Roles (`apps/service-client/src/lib/server/permissions.ts`)
- **Owner**: full access, billing, member role changes
- **Admin**: settings, member management (except roles), templates
- **Member**: create/edit own consultations and proposals

### Subscription Tiers (`apps/service-client/src/lib/server/subscription.ts`)
- `free`: 1 member, 5 consultations/month, 1 template
- `starter`: 3 members, 25/month, 5 templates
- `growth`: 10 members, 100/month, 20 templates
- `enterprise`: unlimited

## Key Files & Locations

### Multi-Tenancy Core
- `apps/service-client/src/lib/server/agency.ts` — agency context helpers
- `apps/service-client/src/lib/server/db-helpers.ts` — data isolation
- `apps/service-client/src/lib/server/permissions.ts` — permission matrix
- `apps/service-client/src/lib/server/subscription.ts` — tier enforcement
- `apps/service-client/src/lib/stores/agency-config.svelte.ts` — form options store

### Remote Functions
- `apps/service-client/src/lib/api/*.remote.ts` — all client-callable server functions
- See `.claude/notes/remote-functions/reference.md` for full rules

### Routes
- `apps/service-client/src/routes/(app)/[agencySlug]/` — agency-scoped routes
- `apps/service-client/src/routes/(app)/agencies/` — agency management
- `apps/service-client/src/routes/api/` — REST endpoints (GDPR export)

### Schema
- `apps/service-client/src/lib/server/schema.ts` — Drizzle schema (SvelteKit)
- `app/service-core/storage/schema_postgres.sql` — sqlc reference schema AND historical DB bootstrap (constraints here ARE enforced on the live DB; see Database Migrations section)

## Development Commands

```bash
# Setup
sh scripts/run_keys.sh              # Generate JWT keys
sh scripts/run_queries.sh postgres  # Compile SQL via sqlc
sh scripts/run_grpc.sh              # Generate protobuf

# Run
docker compose up --build
sh scripts/run_migrations.sh                              # local migrations
VPS_HOST=x.x.x.x VPS_USER=root sh scripts/run_migrations.sh production

# Dev tooling
sh scripts/format.sh                # format all frontend
cd service-client && npm run dev    # dev server
cd service-client && npm run check  # type check
cd service-client && npm run test   # all tests
cd service-client && npm run lint   # lint + format check
```

## Svelte 5 Compliance

This project uses Svelte 5 runes. See `~/Workspaces/shared-context/stack/svelte5-rules.md` for full patterns. Key runes: `$state`, `$derived`, `$props`, `$effect`. Events: `onclick` not `on:click`.

## Confirmation Dialogs (CRITICAL)

**NEVER use native `confirm()`.** Always use styled DaisyUI modals with `modal modal-open`. See `.claude/notes/ui/gotchas.md` for full patterns.

Quick reference:
- Single action: `showDeleteModal` + `deletingItem` state + `btn-error` delete button
- Multi action: generic `confirmModal` object with configurable title/message/actionClass/onConfirm
- Always include: loading spinner, disabled buttons during async, backdrop click to close, item name in bold
- Colors: `btn-error` delete/remove, `btn-warning` cancel/revoke

## SvelteKit Remote Functions — Critical Rules

Full reference: `.claude/notes/remote-functions/reference.md`. Pitfalls: `.claude/notes/remote-functions/gotchas.md`.

**The non-negotiables:**
- Files MUST use `.remote.ts` extension in `src/lib/api/` (NOT `src/lib/server/`)
- `.remote.ts` files can ONLY export functions wrapped with `query()`, `command()`, `form()`, or `prerender()`
- **No type exports** — move types to separate `.types.ts` files
- **No regular function exports** — move server-only utilities to `$lib/server/*.ts` and import them
- Valibot schema MUST be the first argument to `query()`/`command()` (not validated inside)
- For optional filter objects: wrap the schema with `v.optional()`, access as `filters || {}`

**Function types:** `query` (read, cacheable), `command` (write, can't run during render), `form` (progressive enhancement), `prerender` (build-time).

**Error handling:** `error()` works everywhere; `redirect()` works in `query`/`form`/`prerender` but NOT `command`.

**Page data loading:** on pages with `+page.server.ts` + `command()` calls + stateful children, load data in `+page.server.ts` and read via `$derived(data.x)` to avoid remount issues. See `.claude/notes/sveltekit-data-loading/`.

## Database Migrations

Full workflow: `.claude/notes/database/migrations.md`.

**The non-negotiables:**
- All migrations in `/migrations/*.sql`, numbered, **idempotent** (`IF NOT EXISTS` / `IF EXISTS`)
- `/migrations/*.sql` is the source of truth for **ongoing** schema changes. Never use `atlas schema apply` (declarative, destructive).
- `app/service-core/storage/schema_postgres.sql` serves **two** roles: (1) sqlc reference for Go query generation, (2) **historical DB bootstrap** — constraints, tables, and defaults present in this file ARE enforced on the live DB even if no migration file defines them. Verified 2026-04-22 (`valid_proposal_status` CHECK constraint lives on the DB but is declared only in this file, not in any migration).
- When verifying DB-level enforcement (CHECK constraints, triggers, defaults, NOT NULL), **query live DB state directly** via `pg_constraint` / `information_schema` rather than inferring from `schema_postgres.sql` or `schema.ts`. Schema files can drift from runtime state; `pg_catalog` cannot.
- New constraints or constraint changes must be added **via migration AND** reflected in `schema_postgres.sql` to keep the sqlc reference in sync with runtime.
- **After adding columns to Go-queried tables** (esp. `users` — uses `SELECT *`): update Go schema, run `sh scripts/run_queries.sh postgres`, commit `models.go`/`query_postgres.sql.go`, restart `webkit-core`

## Query Development Checklist

When writing/modifying database queries in remote functions:

1. **Read schema first:** check the table in `apps/service-client/src/lib/server/schema.ts`
2. **Run `npm run check`** before committing — catches schema mismatches
3. **Never ignore TypeScript errors** — they indicate real bugs (e.g., selecting non-existent columns)
4. **Match exact column names** — use Drizzle names, not assumed (e.g., `clientSignedAt` not `signedAt`)
5. **Use Drizzle helpers for arrays:** `inArray(column, array)`. Never raw SQL ``sql`${col} = ANY(${arr})` `` — it doesn't escape properly

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `PUBLIC_APP_DOMAIN` | Host for agency-scoped URLs + public share links (e.g., `app.webkit.au` in prod, `localhost:3000` in dev). MUST be the SvelteKit host — NOT the bare marketing domain `webkit.au` |
| `DATABASE_URL` | PostgreSQL connection for Drizzle |
| `DIRECT_URL` | Direct PostgreSQL URL (for migrations) |
| `POSTGRES_*` | PostgreSQL connection details |

See `docker-compose.yml` for the full list.

## Authentication — Cookie Security (CRITICAL)

Cookie `secure` flag must be conditional:

```typescript
const isProduction = env.DOMAIN !== 'localhost';
event.cookies.set("access_token", token, {
  path: "/", sameSite: "lax", httpOnly: true,
  secure: isProduction,  // false for localhost HTTP, true for prod HTTPS
  domain: env.DOMAIN,
  maxAge: ACCESS_TOKEN_MAX_AGE,
});
```

`secure: true` cookies only work over HTTPS; using it in local dev breaks auth. Full JWT/auth architecture: `.claude/notes/deployment/production.md`.

## Production Deployment

Full details: `.claude/notes/deployment/production.md`. Critical warnings: `.claude/notes/deployment/gotchas.md`.

**The non-negotiables:**
- **Never remove JWT key injection steps** in `.github/workflows/deploy-production.yml`. CI writes PEM files from secrets → Dockerfile COPY bakes them in → Go reads `/private.pem` at runtime → CI cleans up. Removing these breaks auth with HTTP 500 on every login
- **Never use `wget` in Docker health checks or deploy scripts.** Go services use `curl`; Node service uses `node -e "fetch(...)"`. `wget` not in base images → health fails → Traefik stops routing → site-wide 404
- **PostgreSQL version pinning is mandatory** — `postgres:17-alpine` (dev) / `postgres:16-alpine` (prod). Major-version mismatch = data files won't load

**Deploy:** GitHub → Actions → "Deploy to Production" → "Run workflow". Fully automated.

## Troubleshooting

See `.claude/notes/troubleshooting.md` for common issues (auth redirect loops, database connection failures, PostgreSQL version issues, inter-service connectivity, login failures after column additions).

## Self-Evolving Notes

This project uses a **self-evolving knowledge base** in `.claude/notes/{feature}/learnings.md` + `gotchas.md`.

### Workflow
1. **Before starting a feature:** check `.claude/notes/{feature}/`
2. **After completing work:** update notes with new learnings
3. **After fixing a bug:** add root cause + solution to `gotchas.md`

### The Magic Phrase

When Claude makes a mistake, use:

> "Update the notes in `.claude/notes/{feature}/` so you don't make that mistake again."

### Current Notes

| Feature | Status |
|---------|--------|
| billing | Active |
| deployment | Active |
| sveltekit-data-loading | Active |
| ui | Active |
| remote-functions | Active |
| content-intelligence | Active |
| content-audit | Active |
| wave1-hardening | Active |

### Pattern: Idempotent Billing Status

For payment flows with async webhooks, see:
- `.claude/notes/billing/learnings.md`
- `docs/spec/subscription-billing-implementation-v2.md` (Pattern section)
