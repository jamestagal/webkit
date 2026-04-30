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

## Corrupted anonymous `node_modules` volume hides fresh image content

**Date:** 2026-04-30
**Severity:** P2 — blocks build for the affected service; surgical fix is fast

**Symptom:** A docker-compose service that uses the standard "preserve container's node_modules" pattern fails to run an `npx <something>` step at build time even though the package is in `package.json`. Error usually looks like `npm error could not determine executable to run`. From inside the container, `node_modules/` exists but `node_modules/.bin/` is missing or empty. Image rebuilds (`docker compose build`) don't fix it.

**Concrete instance (2026-04-30):** `webkit-admin` ran `npx tailwindcss` in its `air` build cmd. After a Docker Desktop restart, the build crashed with `could not determine executable to run`. `docker exec webkit-admin ls /app/service-admin/node_modules/.bin/` returned "No such file or directory." Restarts and rebuilds didn't fix it because the anonymous volume kept overlaying the freshly-baked image content with the corrupted state.

**Why it happens.** The compose pattern is:

```yaml
volumes:
  - ./app/service-admin:/app/service-admin       # bind-mount host source for hot reload
  - /app/service-admin/node_modules              # anonymous volume — preserves container's deps
```

The second line is a deliberate trick: the bind-mount above would otherwise overwrite the container's `node_modules` with whatever the host has (usually empty in dev). The anonymous volume layer over `node_modules` keeps the Dockerfile's `npm install` output visible.

The catch: anonymous volumes **persist across `docker compose down` / `up`**. They're only removed by `docker compose down -v` or `docker compose rm -v <svc>`. So:

1. First `docker compose up` runs the Dockerfile's `npm install`, populates the anonymous volume from the image's `/app/<svc>/node_modules`
2. Container is restarted/rebuilt later. Image rebuilds bake fresh `node_modules` into the image — but Docker re-attaches the **same anonymous volume** from step 1, hiding the fresh content
3. If that anonymous volume's `.bin/` got cleared at any point (interrupted `npm install`, manual `rm` inside the container, dependency downgrade, image rebuild while container was running), the corruption persists indefinitely

**Surgical fix (preferred, ~15 sec, no data loss):**

```bash
docker exec <service> sh -c 'cd <workdir> && npm install'
docker restart <service>
```

`npm install` writes into the live anonymous volume, repopulating `.bin/`. `docker restart` triggers air's full build cycle (templ → npx tailwindcss → go build) so you can see whether the symptom cleared.

**Heavier fix if surgical didn't work (~30 sec, drops only the affected service's anonymous volumes):**

```bash
docker compose rm -f -s -v <service>
docker compose up -d <service>
```

`-v` removes the anonymous volumes attached to that service. Compose recreates them from the image's contents on the next `up`. Doesn't touch other services or named volumes.

**DON'T reach for `docker compose down -v` for this.** That nukes named volumes too, including `webkit_postgres_data` — you lose all local DB state.

**Prevention checklist when defining a new service with this pattern:**

- Document somewhere in the project that `npm install` inside the container is the recovery path
- If the service has a "rebuild from clean" Make target, have it run `docker compose rm -f -s -v <svc>` instead of just `docker compose build` so the anonymous volume gets recreated from the fresh image
- Don't rely on `docker compose build` alone to ship fresh `node_modules` to existing containers — it won't until the anonymous volume is dropped

**Detection signal:** if `docker logs <service>` shows an `npx`/`npm exec` failure and the container has been "Up" for a while across multiple host restarts, this is the most likely cause. Quick check: `docker exec <service> ls /app/<svc>/node_modules/.bin/`. If empty or missing, this is the bug.
