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
