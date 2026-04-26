# Production Deployment — Reference

For critical warnings, see `gotchas.md`. For patterns that worked, see `learnings.md`.

## Infrastructure Overview

Production runs on a **Hostinger VPS**:
- **Traefik**: Reverse proxy, automatic Let's Encrypt SSL
- **Docker Compose**: Container orchestration
- **GitHub Container Registry (GHCR)**: Image storage
- **PostgreSQL 16**: Production database (pinned to `postgres:16-alpine`)

## Production URLs

| Service | URL | Internal Port |
|---------|-----|---------------|
| Client App | https://app.webkit.au | 3000 |
| Core API | https://api.webkit.au | 4001 |
| Admin | https://admin.webkit.au | 3001 |

## Docker Networks

- `traefik-public`: External, connects services to Traefik
- `webkit-internal`: Internal service-to-service

## Key Files

- `docker-compose.production.yml` — production container config
- `.github/workflows/deploy-production.yml` — CI/CD pipeline

## CI/CD — One-Click Deployment

**To deploy:** GitHub → Actions → "Deploy to Production" → "Run workflow"

Fully automated. No SSH required.

**Triggers:**
1. GitHub Release publish
2. Manual `workflow_dispatch`

**Pipeline steps:**
1. Build images (parallel matrix):
   - Inject JWT keys from GitHub Secrets
   - Build Docker images for core/admin/client
   - Push to ghcr.io
   - Clean up sensitive key files
2. Deploy to VPS:
   - SCP `docker-compose.production.yml` to VPS
   - SSH + pull latest images
   - `docker compose up -d --force-recreate`
   - Prune old images
   - Health check

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Hostinger VPS IP/hostname |
| `VPS_USER` | SSH username (typically `root`) |
| `VPS_SSH_KEY` | Private SSH key |
| `VPS_SSH_PASSPHRASE` | SSH key passphrase (if applicable) |
| `PRIVATE_KEY_PEM` | JWT private key for token signing |
| `PUBLIC_KEY_PEM` | JWT public key for token verification |

## Manual VPS Access

```bash
ssh root@<VPS_HOST>
cd /opt/webkit

# Running containers
docker compose -f docker-compose.production.yml ps

# Logs
docker compose -f docker-compose.production.yml logs -f [service]

# Database
docker exec -it webkit-postgres psql -U webkit -d webkit
```

## Authentication — JWT Token Flow

1. **Login** via Magic Link or OAuth
2. **Core Service** issues `access_token` (15 min) + `refresh_token` (30 days)
3. **Cookies** stored HTTP-only with domain scope
4. **Refresh** handled by SvelteKit hooks

## Cookie Security (CRITICAL)

Cookie `secure` flag must be conditional on environment:

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

`secure: true` cookies only work over HTTPS. `secure: true` in local dev (HTTP) causes cookies not to be sent, breaking auth.

## Key Auth Files

- `apps/service-client/src/hooks.server.ts` — auth middleware, token validation
- `apps/service-client/src/lib/server/refresh.ts` — token refresh logic
- `apps/service-client/src/lib/server/jwt.ts` — JWT verification
- `app/service-core/rest/login_route.go` — login endpoints, cookie setting

## PostgreSQL Version Pinning (CRITICAL)

Always pin PostgreSQL to a specific major version:

```yaml
# docker-compose.yml (dev)
postgres:
  image: postgres:17-alpine

# docker-compose.production.yml
postgres:
  image: postgres:16-alpine
```

PostgreSQL data files are not compatible across major versions. If Docker pulls a newer version (e.g., v18 when data was created with v17), the database fails to start.

## Hot Reload

Go services use Air (configured via `.air.toml`).
