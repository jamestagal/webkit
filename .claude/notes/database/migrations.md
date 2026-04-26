# Database Migrations — Reference

## Migration System

Raw SQL migrations with numbered, idempotent files:

```
/migrations/
├── 001_add_agencies_freemium_columns.sql
├── 002_create_beta_invites_table.sql
├── 003_add_users_suspension_columns.sql
├── 004_form_builder_system.sql
├── 005_clients_system.sql
├── 006_form_templates_admin.sql
├── 007_consultation_option_sets.sql
├── 008_seed_full_discovery_template.sql
├── 009_add_stripe_customer_to_agencies.sql
└── ...
```

## Writing Migrations

All migrations **MUST be idempotent** (safe to re-run):

```sql
-- Good
CREATE TABLE IF NOT EXISTS my_table (...);
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
CREATE INDEX IF NOT EXISTS idx_name ON my_table(col);

-- Bad
CREATE TABLE my_table (...);
ALTER TABLE my_table ADD COLUMN new_col TEXT;
```

## Running Migrations

```bash
# Local
sh scripts/run_migrations.sh

# Production (requires VPS_HOST, VPS_USER)
VPS_HOST=your-vps-ip VPS_USER=root sh scripts/run_migrations.sh production

# Manual production via SSH heredoc
ssh root@<VPS_HOST>
docker exec -i webkit-postgres psql -U webkit -d webkit <<'EOF'
-- paste migration SQL here
EOF
```

## Database Development Workflow

1. **Start services:** `docker compose up`
2. **Create migration file:** `migrations/0XX_description.sql` (idempotent SQL)
3. **Run migration:** `sh scripts/run_migrations.sh`
4. **Update Drizzle schema:** add tables/columns to `apps/service-client/src/lib/server/schema.ts`
5. **Update Go schema** (if Go needs the tables): `app/service-core/storage/schema_postgres.sql`
6. **Regenerate sqlc:** `sh scripts/run_queries.sh postgres`
7. **Type check:** `cd service-client && npm run check`

## Schema Files

| File | Purpose | When to Update |
|------|---------|----------------|
| `migrations/*.sql` | Source of truth for DB structure | Always (create new migration) |
| `apps/service-client/src/lib/server/schema.ts` | Drizzle ORM schema for SvelteKit | After running migration |
| `app/service-core/storage/schema_postgres.sql` | Go sqlc reference schema | Only if Go queries the new tables |

## Important Notes

- **Never use `atlas schema apply`** — declarative, can be destructive
- **Go schema is reference only** — used by sqlc for type generation, not migrations
- All schema changes go through numbered migration files first
- Migrations run alphabetically

## What `schema_postgres.sql` Is For

**Only:**
1. sqlc code generation via `sh scripts/run_queries.sh postgres`
2. Reference documentation

**NOT for:**
- ❌ Schema migrations (use `/migrations/*.sql`)
- ❌ Atlas sync (`atlas schema apply`)
- ❌ Source of truth for DB structure

## Go Backend Sync (CRITICAL)

When adding columns to tables queried by Go (especially `users` — uses `SELECT *`):

1. Update `app/service-core/storage/schema_postgres.sql`
2. Run `sh scripts/run_queries.sh postgres` to regenerate sqlc
3. Commit generated files (`models.go`, `query_postgres.sql.go`)
4. Restart `webkit-core` after migration

The `agencies` table doesn't require this — Go doesn't `SELECT *` during auth flow.
