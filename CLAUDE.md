# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Webkit** is a multi-tenant SaaS platform for web agencies to create client consultations and proposals. It uses agency-based tenancy with customizable forms and branding per agency.

## Architecture Overview

This is a microservices application built with:
- **Core Service**: Go backend providing gRPC and REST APIs, database interactions
- **Admin Service**: Go backend with web interface for administration, Server-Sent Events (SSE)
- **Client Service**: SvelteKit frontend application with TypeScript and Svelte 5 runes
- **Database**: PostgreSQL (primary), with SQLite/Turso support
- **Message Queue**: NATS for inter-service communication
- **Monitoring**: Grafana and Prometheus integration available

The services communicate via gRPC (internal) and REST APIs (external), with protobuf definitions in `/proto`.

## Multi-Tenancy Architecture

### Database Model (Single Shared Database)

We use **shared database with row-level tenant isolation** - NOT separate databases per agency. All agencies share the same tables with `agency_id` columns for data separation.

**Key Tables:**
- `agencies` - Core tenant table with branding, billing, status
- `agency_memberships` - User-Agency relationships with roles (owner/admin/member)
- `agency_form_options` - Customizable form dropdown options per agency
- `agency_proposal_templates` - Future proposal templates per agency
- `consultations` - Scoped by `agency_id`
- `consultation_drafts` - Scoped by `agency_id`

### Data Isolation Pattern

All database queries MUST use the `withAgencyScope()` helper:

```typescript
// service-client/src/lib/server/db-helpers.ts
const consultations = await withAgencyScope(agencyId, async (id) => {
    return db.query.consultations.findMany({
        where: eq(consultations.agencyId, id)
    });
});
```

### Form Customization Per Agency

Agencies can customize dropdown options via `agency_form_options` table. The 14 configurable categories are:
- `industry`, `business_type`, `budget_range`, `urgency_level`
- `primary_challenges`, `technical_issues`, `solution_gaps`
- `digital_presence`, `marketing_channels`, `primary_goals`
- `secondary_goals`, `success_metrics`, `kpis`, `budget_constraints`

**How it works:**
1. Layout loads agency config in `[agencySlug]/+layout.server.ts`
2. Config stored via `setAgencyConfig()` module-level state
3. Form components call `getAgencyConfig()` for options
4. Falls back to defaults if agency has no custom options

### Permissions & Roles

Defined in `service-client/src/lib/server/permissions.ts`:
- **Owner**: Full access including billing, member role changes
- **Admin**: Settings, member management (except role changes), templates
- **Member**: Create/edit own consultations and proposals

### Subscription Tiers

Defined in `service-client/src/lib/server/subscription.ts`:
- `free`: 1 member, 5 consultations/month, 1 template
- `starter`: 3 members, 25 consultations/month, 5 templates
- `growth`: 10 members, 100 consultations/month, 20 templates
- `enterprise`: Unlimited

## Key Files & Locations

### Multi-Tenancy Core
- `service-client/src/lib/server/agency.ts` - Agency context helpers
- `service-client/src/lib/server/db-helpers.ts` - Data isolation helpers
- `service-client/src/lib/server/permissions.ts` - Permission matrix
- `service-client/src/lib/server/subscription.ts` - Tier enforcement
- `service-client/src/lib/stores/agency-config.svelte.ts` - Form options store

### Remote Functions
- `service-client/src/lib/api/consultation.remote.ts` - Consultation operations
- `service-client/src/lib/api/agency.remote.ts` - Agency operations
- `service-client/src/lib/api/gdpr.remote.ts` - Data export endpoints

### Routes
- `service-client/src/routes/(app)/[agencySlug]/` - Agency-scoped routes
- `service-client/src/routes/(app)/agencies/` - Agency management
- `service-client/src/routes/api/` - API endpoints (GDPR export)

### Schema
- `app/service-core/storage/schema_postgres.sql` - Go backend schema
- `service-client/src/lib/server/schema.ts` - Drizzle schema (SvelteKit)

## Development Commands

### Initial Setup
```bash
# Generate JWT keys for authentication
sh scripts/run_keys.sh

# Compile SQL queries using sqlc (postgres or sqlite)
sh scripts/run_queries.sh [postgres|sqlite]

# Generate protobuf code for gRPC
sh scripts/run_grpc.sh
```

### Running the Application
```bash
# Start all services with Docker Compose
docker compose up --build

# Run database migrations
sh scripts/atlas.sh [postgres|sqlite|turso]
```

### Development Tools
```bash
# Format all frontend code
sh scripts/format.sh

# Client-specific commands (in service-client/)
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run all tests (e2e + unit)
npm run test:unit    # Unit tests only
npm run test:e2e     # End-to-end tests
npm run lint         # Lint and format check
npm run format       # Auto-format code
```

### Service Ports
- Client: http://localhost:3000
- Admin: http://localhost:3001 (HTTP), http://localhost:3002 (SSE)
- Core: http://localhost:4001 (HTTP), localhost:4002 (gRPC)
- PostgreSQL: localhost:5432
- NATS: localhost:8222
- Mailpit: http://localhost:8025 (Web UI), localhost:1025 (SMTP)

## Code Organization

### Backend Services (`/app`)
- **service-core/**: Core business logic, database layer, gRPC/REST APIs
- **service-admin/**: Admin interface, SSE server, gRPC client
- **pkg/**: Shared Go packages and utilities
- Go workspace with shared dependencies via `go.work`

### Frontend (`/service-client`)
- SvelteKit application with TypeScript
- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`)
- TailwindCSS + DaisyUI for styling
- Vitest for unit testing, Playwright for e2e testing

### Infrastructure
- **proto/**: Protobuf definitions for gRPC services
- **scripts/**: Development automation scripts
- **monitoring/**: Grafana, Prometheus, Loki configs
- **infra/**: Terraform + Kubernetes deployment

## Svelte 5 Compliance

This project uses Svelte 5. Key patterns:

```svelte
<!-- Props: Use $props() not export let -->
<script lang="ts">
    let { value, onChange }: Props = $props();
</script>

<!-- State: Use $state() -->
let count = $state(0);

<!-- Derived: Use $derived() -->
let doubled = $derived(count * 2);

<!-- Events: Use onclick not on:click -->
<button onclick={handleClick}>Click</button>
<svelte:window onbeforeunload={handleUnload} />
```

## SvelteKit Remote Functions

This project uses **SvelteKit Remote Functions** for server-side data operations. Remote functions are server-side functions that can be called from the client.

### Critical Rules

**File Naming & Location:**
- Files MUST use `.remote.ts` extension
- Location: `src/lib/api/*.remote.ts`
- Do NOT place in `src/lib/server/` (reserved for server-only utilities)

**Export Restrictions (CRITICAL):**
- `.remote.ts` files can ONLY export functions wrapped with `query()`, `command()`, `form()`, or `prerender()`
- **Type exports are NOT allowed** - move types to separate `.types.ts` files
- Regular function exports will cause runtime errors

```typescript
// BAD - will cause "all exports must be remote functions" error
export type MyType = { ... };
export interface MyInterface { ... }
export const helper = () => { ... };

// GOOD - only remote function exports
export const getData = query(schema, async (input) => { ... });
export const saveData = command(schema, async (input) => { ... });
```

**Type Export Pattern:**
```typescript
// questionnaire.types.ts - separate file for types
export type QuestionnaireResponses = { ... };
export type QuestionnaireAccessResult = { ... };

// questionnaire.remote.ts - import types, only export remote functions
import type { QuestionnaireResponses } from './questionnaire.types';
export const getQuestionnaire = query(...);
```

### Function Types

| Type | Purpose | Usage |
|------|---------|-------|
| `query` | Read data | Cached, can be called during render |
| `command` | Write data | Cannot be called during render |
| `form` | Form submissions | Works without JS (progressive enhancement) |
| `prerender` | Build-time data | Cached in browser Cache API |

### Validation with Valibot

All functions accepting arguments MUST use Valibot schema validation:

```typescript
// CORRECT - schema as first argument
export const getContract = query(
  v.pipe(v.string(), v.uuid()),
  async (contractId) => { ... }
);

export const updateContract = command(
  UpdateContractSchema,
  async (data) => { ... }
);

// INCORRECT - manual validation inside
export const badExample = command(async (data: unknown) => {
  const validated = v.parse(Schema, data); // Don't do this!
});

// Functions with no arguments - no schema needed
export const getCurrentUser = query(async () => { ... });
```

### Optional Filter Parameters Pattern (CRITICAL)

For functions that accept optional filter objects (like list queries), wrap the schema with `v.optional()`:

```typescript
// Define schema with v.optional() wrapper
const ContractFiltersSchema = v.optional(
  v.object({
    status: v.optional(ContractStatusSchema),
    limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
    offset: v.optional(v.pipe(v.number(), v.minValue(0)))
  })
);

// Use schema as first argument, handle undefined filters
export const getContracts = query(ContractFiltersSchema, async (filters) => {
  const { status, limit = 50, offset = 0 } = filters || {};
  // ... use filters with defaults
});

// Call with empty object or specific filters
const contracts = await getContracts({});
const filtered = await getContracts({ status: 'signed' });
```

**Why this pattern is required:**
- Schema MUST be first argument to `query()` - internal validation doesn't work
- `v.optional()` wrapper allows calling with `{}` or `undefined`
- Use `filters || {}` or `filters?.field` to safely access properties

### Request Context

Use `getRequestEvent()` for cookies and session data:

```typescript
import { getRequestEvent } from '$app/server';

export const myFunction = query(async () => {
  const event = getRequestEvent();
  const cookies = event.cookies;
  // ...
});
```

Note: `route`, `params`, `url` from `getRequestEvent()` reflect the **calling page**, not the endpoint.

### Error Handling

```typescript
import { error, redirect } from '@sveltejs/kit';

export const myQuery = query(async () => {
  if (!authorized) throw error(403, 'Forbidden');
  if (needsLogin) throw redirect(302, '/login');
  // ...
});
```

- `redirect()` works in `query`, `form`, `prerender` (NOT in `command`)
- `error()` throws HTTP errors in all function types

### Remote Functions Files

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

### Type Files

| File | Types For |
|------|-----------|
| `questionnaire.types.ts` | Questionnaire responses, access results |

## Database Development Workflow

When making database changes:

1. **Start services**: `docker compose up`
2. **Edit schema**: Modify `app/service-core/storage/schema_postgres.sql`
3. **Apply migrations**: `sh scripts/atlas.sh postgres`
4. **Edit Drizzle schema**: Modify `service-client/src/lib/server/schema.ts`
5. **Edit queries**: Modify files in `app/service-core/storage/sql/*.sql`
6. **Generate Go code**: `sh scripts/run_queries.sh postgres`

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `PUBLIC_APP_DOMAIN` | Domain for agency URLs (e.g., `webkit.au`) |
| `DATABASE_URL` | PostgreSQL connection string for Drizzle |
| `DIRECT_URL` | Direct PostgreSQL URL (for migrations) |
| `POSTGRES_*` | PostgreSQL connection details |

See `docker-compose.yml` for the complete list.

## Hot Reload

Both Go services use Air for hot reloading during development (configured via `.air.toml` files).

## Production Deployment Architecture

### Infrastructure Overview

Production runs on a **Hostinger VPS** with the following stack:
- **Traefik**: Reverse proxy with automatic Let's Encrypt SSL certificates
- **Docker Compose**: Container orchestration
- **GitHub Container Registry (GHCR)**: Image storage
- **PostgreSQL 16**: Production database (pinned to v16-alpine)

### Production URLs

| Service | URL | Internal Port |
|---------|-----|---------------|
| Client App | https://app.webkit.au | 3000 |
| Core API | https://api.webkit.au | 4001 |
| Admin | https://admin.webkit.au | 3001 |

### Docker Networks

- `traefik-public`: External network connecting services to Traefik reverse proxy
- `webkit-internal`: Internal network for service-to-service communication

### Key Production Files

- `docker-compose.production.yml` - Production container configuration
- `.github/workflows/deploy-production.yml` - CI/CD pipeline

## CI/CD Pipeline

### One-Click Deployment (Fully Automated)

**To deploy:** GitHub → Actions → "Deploy to Production" → "Run workflow"

That's it! No SSH or manual scripts required. The workflow handles everything automatically.

### Deployment Triggers

1. **GitHub Release**: Publishing a new release
2. **Manual Trigger**: `workflow_dispatch` in GitHub Actions

### Pipeline Steps

1. **Build Images** (parallel matrix build):
   - Injects JWT keys from GitHub Secrets
   - Builds Docker images for core, admin, and client services
   - Pushes to GitHub Container Registry (ghcr.io)
   - Cleans up sensitive key files

2. **Deploy to VPS**:
   - Syncs `docker-compose.production.yml` to VPS via SCP
   - SSHs to VPS and pulls latest images
   - Recreates containers with `docker compose up -d --force-recreate`
   - Prunes old images
   - Runs health check

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Hostinger VPS IP/hostname |
| `VPS_USER` | SSH username (typically `root`) |
| `VPS_SSH_KEY` | Private SSH key for VPS access |
| `VPS_SSH_PASSPHRASE` | SSH key passphrase (if applicable) |
| `PRIVATE_KEY_PEM` | JWT private key for token signing |
| `PUBLIC_KEY_PEM` | JWT public key for token verification |

### Manual VPS Access

```bash
# SSH to production VPS
ssh root@<VPS_HOST>

# Navigate to webkit directory
cd /opt/webkit

# View running containers
docker compose -f docker-compose.production.yml ps

# View logs
docker compose -f docker-compose.production.yml logs -f [service]

# Manual database operations
docker exec -it webkit-postgres psql -U webkit -d webkit
```

### Production Database Migrations

Database migrations must be run manually on production:

```bash
# SSH to VPS
ssh root@<VPS_HOST>

# Connect to PostgreSQL
docker exec -it webkit-postgres psql -U webkit -d webkit

# Run ALTER TABLE or other migrations
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS accent_gradient TEXT;
```

## Authentication Architecture

### JWT Token Flow

1. **Login**: User authenticates via Magic Link or OAuth
2. **Core Service**: Issues `access_token` (15 min) and `refresh_token` (30 days)
3. **Cookies**: Tokens stored as HTTP-only cookies with domain scope
4. **Refresh**: SvelteKit hooks automatically refresh expired access tokens

### Cookie Security

**Critical**: Cookie `secure` flag must be conditional on environment:

```typescript
// In refresh.ts and other cookie-setting code
const isProduction = env.DOMAIN !== 'localhost';

event.cookies.set("access_token", token, {
  path: "/",
  sameSite: "lax",
  secure: isProduction,  // false for localhost, true for production
  httpOnly: true,
  domain: env.DOMAIN,
  maxAge: ACCESS_TOKEN_MAX_AGE,
});
```

**Why**: `secure: true` cookies only work over HTTPS. Using `secure: true` in local development (HTTP) causes cookies not to be sent, breaking authentication.

### Key Authentication Files

- `service-client/src/hooks.server.ts` - Auth middleware, token validation
- `service-client/src/lib/server/refresh.ts` - Token refresh logic
- `service-client/src/lib/server/jwt.ts` - JWT verification
- `app/service-core/rest/login_route.go` - Login endpoints, cookie setting

## Agency Branding

### Brand Colors

Agencies can customize their branding with:
- `primaryColor` - Main brand color (buttons, links)
- `secondaryColor` - Light background color
- `accentColor` - Accent/highlight color
- `accentGradient` - CSS gradient for premium visual effects (optional)
- `logoUrl` - Agency logo (URL or base64 data URL)

### Gradient Support

The `accentGradient` field stores a complete CSS gradient string:

```sql
-- Example gradient value
'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
```

Used in proposals and UI elements for visual polish. Falls back to `accentColor` when not set.

### Branding Files

- `service-client/src/routes/(app)/[agencySlug]/settings/branding/+page.svelte` - Branding settings UI
- `service-client/src/lib/api/agency-profile.remote.ts` - Save branding data

## PostgreSQL Version Management

### Version Pinning (CRITICAL)

Always pin PostgreSQL to a specific major version to avoid data compatibility issues:

```yaml
# docker-compose.yml (development)
postgres:
  image: postgres:17-alpine  # Pinned to v17

# docker-compose.production.yml
postgres:
  image: postgres:16-alpine  # Pinned to v16
```

**Why**: PostgreSQL data files are not compatible across major versions. If Docker pulls a newer version (e.g., v18 when data was created with v17), the database will fail to start.

## Troubleshooting

### Common Issues

**Authentication redirect loop after login:**
- Check cookie `secure` flag matches environment (false for localhost)
- Clear browser cookies and retry

**Database connection failures after Docker restart:**
- Ensure PostgreSQL container is healthy before other services start
- Check `depends_on` with `condition: service_healthy`

**PostgreSQL won't start after Docker update:**
- Check if Docker pulled a newer PostgreSQL version
- Pin to the version matching your data (check `postgres_data` volume)

**Services can't connect to each other:**
- Use container names for internal communication (e.g., `webkit-core:4001`)
- Ensure services are on the same Docker network

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.