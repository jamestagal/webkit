# Deployment Gotchas

## NEVER remove JWT key injection from deploy workflow

**Date:** 2026-02-11
**Severity:** P0 - breaks all authentication

The deploy workflow (`deploy-production.yml`) has critical steps that inject JWT PEM files from GitHub Secrets into the Docker build context:

1. **Before build:** Write `secrets.PRIVATE_KEY_PEM` and `secrets.PUBLIC_KEY_PEM` to files in the service directories
2. **During build:** Dockerfile `COPY` picks them up and bakes them into the production image at `/private.pem` and `/public.pem`
3. **After build:** Clean up the key files from the CI workspace

**What happens if removed:** The Go auth code (`app/pkg/auth/auth.go`) tries env var `JWT_PRIVATE_KEY` first, then falls back to reading `/private.pem` from disk. If neither exists, `GenerateTokens()` fails and login returns HTTP 500 "Error creating auth tokens".

**Key files needed per service:**
- `service-core`: `private.pem` + `public.pem` (signs and verifies tokens)
- `service-admin`: `public.pem` only (verifies tokens)
- `service-client`: `public.pem` only (verifies tokens)

**The docker-compose.production.yml `${JWT_PRIVATE_KEY}` env vars are NOT a replacement.** They are empty on the VPS. The file-based approach via Dockerfile COPY is the actual mechanism.

**Root cause of 2026-02-11 outage:** Wave 2 Stream J refactored `deploy-production.yml` and removed the key injection steps. The production containers were built without JWT keys, breaking all authentication.

## Health checks must match container tooling

**Date:** 2026-02-11
**Severity:** P0 - causes site-wide 404

Docker health checks in `docker-compose.production.yml` must use tools that exist in the container:

- **Go services** (`debian:bookworm-slim`): Use `curl` (added to Dockerfile). Do NOT use `wget`.
- **Node service** (`node:22-slim`): Use `node -e "fetch(...)"`. Do NOT use `wget` or `curl`.

**What happens if wrong:** Traefik excludes unhealthy containers from routing, causing 404 for all requests. The service is actually running fine but Traefik won't send traffic to it.

**The deploy script health checks (`deploy-production.yml`) run on the VPS host**, not inside containers, so they should use `curl` (available on the VPS).

## VPS SSH connection timeout on deploy (intermittent)

**Date:** 2026-04-29
**Severity:** P3 — transient, retry-recoverable

**Symptom:** GitHub Actions "Deploy to Production" workflow fails at the `appleboy/scp-action` or `appleboy/ssh-action` step with `dial tcp ***:22: i/o timeout` or `ssh: handshake failed`. The build/push job completes successfully and Docker images land in ghcr.io; only the VPS sync/deploy steps fail. Frequency: ~25-30% of runs as of 2026-04-29 (3 failures in last 11 deploys).

**Workaround:** Re-run the failed workflow from the Actions UI or via `gh workflow run deploy-production.yml --ref main`. Always clears on first retry — confirmed across three separate occurrences (2026-04-27 23:44 → 23:53, 2026-04-28 23:23 → 23:30, 2026-04-29 05:06 → 05:14).

**When to escalate (NOT yet):**
- A single retry stops clearing the failure
- Frequency climbs above ~40% of runs
- Failure correlates with VPS-side health (CPU/memory/network) at the failure timestamp

**Likely candidates if escalating:** Hetzner network jitter, SSH agent keepalive on the GH Actions runner, GitHub Actions runner-pool routing to a network segment the VPS firewall doesn't see, or fail2ban on the VPS rate-limiting GH Actions IP ranges.
