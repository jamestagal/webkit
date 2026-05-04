# Phase 1 audit — `[k8s-migration-checklist]`

**Status:** complete (8/8 deliverables)
**Date:** 2026-05-04
**Scope:** read-only audit, no `kube/config/*.yaml` modified, no code changes
**Source plan:** `~/Documents/Claude/Projects/Webkit/planning/plans/k8s-migration-checklist.md`
**Appraisal:** `.comms/cowork-to-claude/20260504T161205-k8s-migration-checklist-plan-appraised.md`

---

## Executive findings

- **CNPG-pgvector for Postgres 16: NOT a rabbit hole.** `ghcr.io/cloudnative-pg/postgresql:16.x-standard-{trixie,bookworm}` ships pgvector pre-bundled (option (a) from plan §4 confirmed available). No custom image build needed. Custom-build path documented as ~10-line fallback if standard flavor is rejected for any reason.
- **Plan-correction: JWT key load is HYBRID, not filesystem-only.** Webkit Go code (`app/pkg/auth/auth.go:16-19`, `app/service-admin/auth/auth.go:15-18`) checks `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` env first, falls back to `/private.pem` / `/public.pem`. Either pattern works for K8s. The plan's "do not modernize to K8s secret mount" guidance is unnecessarily conservative — both paths are pre-existing and supported.
- **`victoria-traces-single` Helm chart EXISTS** — chart `0.0.7`, appVersion `v0.8.1`. No raw-manifest fallback needed for Phase 2.
- **`service-ingress.yaml` has a latent prod-incompat:** line 9 sets `certresolver: default`, but Webkit prod uses resolver name `letsencrypt` (per `docker-compose.production.yml:58, 102, 175`). Phase 2 must rename to `letsencrypt` — otherwise cutover fails TLS handshake.
- **`service-client.yaml` is severely underspecified** — current 4-env-var manifest would crash boot. Compose-prod sets 30+ env vars on this service. Phase 2 closure list below.

---

## Deliverable 1 — JWT runtime path confirmation

**Verdict:** HYBRID (env-first, filesystem fallback). Both paths are wired in Go and used in production.

### Evidence

[app/pkg/auth/auth.go:16-19](app/pkg/auth/auth.go#L16-L19) — Go service-core/content/etc shared loader:

```go
if key := os.Getenv("JWT_PRIVATE_KEY"); key != "" {
    return []byte(key), nil
}
return os.ReadFile("/private.pem")
```

Same pattern at [app/pkg/auth/auth.go:23-26](app/pkg/auth/auth.go#L23-L26) for the public key, and at [app/service-admin/auth/auth.go:15-18](app/service-admin/auth/auth.go#L15-L18) for the admin service.

Production wiring uses BOTH paths:
- **Filesystem path armed:** `.github/workflows/deploy-production.yml:42-51` writes PEM files into the build context, Dockerfile `COPY` bakes them into image at `/private.pem` and `/public.pem`.
- **Env path armed:** `docker-compose.production.yml:42-43, 95, 162` injects `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` from `${...}` substitution.

If `${JWT_PRIVATE_KEY}` is unset in `.env.production`, env path returns `""` and Go falls back to `/private.pem`. If set, env path wins. The exact production behavior depends on what `.env.production` contains on the VPS — both are functional.

### K8s implication

Plan §1.2 ("JWT PEM injection — exact preserve flow") said: *"Do not 'modernize' this to a K8s secret mount — that would require Go code changes."*

This is **incorrect**. The Go code already supports env-var injection (preferred path). K8s migration may use either:
- (a) **Continue COPY-into-image** (existing pattern): CI writes PEM to build context, Dockerfile COPY, image baked. Same shape as Compose deploy.
- (b) **K8s Secret as env var** (cleaner): create `kubectl create secret generic jwt-keys --from-literal=...` once per environment; reference via `valueFrom.secretKeyRef` in deployment manifests.

**Recommendation:** option (b) — K8s Secret env-var injection. Reasoning:
- Removes PEM material from container image layer (image leak no longer leaks key).
- Removes a CI step (no per-build write/copy/cleanup of PEM file).
- Existing Go path supports it without modification.
- Reverting to (a) is trivial if (b) ever breaks (env-precedence means filesystem fallback still works if both are configured).

This is a BIG-DECISION-CLASS change vs the plan's recommendation. Flagging for chat consult before Phase 3 (workflow authoring) commits to either path.

### Acceptance

✓ Single grep across `app/` confirmed runtime path.
✓ Hybrid pattern documented; plan claim contradicted with file:line evidence.

---

## Deliverable 2 — CNPG image variant for Postgres 16 + pgvector (HIGHEST RISK)

**Verdict:** **NOT a rabbit hole.** `standard` flavor of CNPG community image ships pgvector pre-bundled for Postgres 16. Phase 1 escalation rule (>1 day = chat) NOT triggered.

### Evidence

[`cloudnative-pg/postgres-containers` README](https://github.com/cloudnative-pg/postgres-containers): the `standard` image flavor "extends minimal images" and explicitly includes pgvector among the bundled extensions. Tag pattern: `MM.mm-TS-TYPE-OS` (e.g., `17.6-standard-trixie`, `16.10-standard-trixie`).

The new ImageVolume pattern (`ghcr.io/cloudnative-pg/pgvector:0.8.x-18-trixie`) is **PostgreSQL 18+ only** — it relies on Postgres 18's `extension_control_path` GUC. Confirmed in [Bartolini's Recipe 23 (2025-12)](https://www.gabrielebartolini.it/articles/2025/12/cnpg-recipe-23-managing-extensions-with-imagevolume-in-cloudnativepg/). Not relevant for Webkit (PG16).

### Recommended pin for Phase 2

```yaml
# kube/config/db-postgres.yaml
spec:
  imageName: ghcr.io/cloudnative-pg/postgresql:16.10-standard-trixie
```

Verify the exact latest 16.x point-release tag at staging-deploy time via `crane ls ghcr.io/cloudnative-pg/postgresql | grep '^16\..*-standard-trixie$' | sort -V | tail -1` (or equivalent). 16.10 is the documented latest 16.x at time of audit.

### Custom-build fallback (NOT recommended, retained for reference)

If the `standard` flavor is rejected (e.g., minimal-image-only policy):

```dockerfile
FROM ghcr.io/cloudnative-pg/postgresql:16.10-minimal-trixie
USER root
RUN set -xe; apt-get update; \
    apt-get install -y --no-install-recommends "postgresql-16-pgvector"; \
    rm -fr /tmp/* /var/lib/apt/lists/*
USER 26
```

~10 lines. Build time <2 min. Tag the resulting image NOT-`latest` (CNPG operator rejects `:latest`). Source: [official CNPG creating-container-images guide](https://cloudnative-pg.io/blog/creating-container-images/).

### Acceptance

✓ Standard flavor confirmed to bundle pgvector for PG16 (README evidence).
✓ Custom-build fallback documented with exact Dockerfile.
✓ Phase 2 imageName pin recommended with explicit tag.

---

## Deliverable 3 — Helm chart spike (`vm/victoria-traces-single`) + chart pinning discipline

**Verdict:** chart EXISTS in `victoriametrics-charts` repo. Phase 2 unblocked, no fallback raw-manifest authoring needed.

### Helm CLI availability

Helm CLI is **not installed** on the audit machine. Cannot run `helm search repo vm/victoria-traces-single` directly. Confirmation done via authoritative GitHub source-tree + Chart.yaml fetches.

### `helm search`-equivalent output (sourced from GitHub repo)

| Chart name | Latest version | appVersion | Source |
|------------|---------------|-----------|--------|
| `victoria-traces-single` | `0.0.7` | `v0.8.1` | [Chart.yaml](https://raw.githubusercontent.com/VictoriaMetrics/helm-charts/master/charts/victoria-traces-single/Chart.yaml) |
| `victoria-metrics-single` | `0.37.0` | `v1.142.0` | [Chart.yaml](https://raw.githubusercontent.com/VictoriaMetrics/helm-charts/master/charts/victoria-metrics-single/Chart.yaml) |
| `victoria-logs-single` | `0.12.4` | `v1.50.0` | [Chart.yaml](https://raw.githubusercontent.com/VictoriaMetrics/helm-charts/master/charts/victoria-logs-single/Chart.yaml) |

**Note on `victoria-traces-single 0.0.7`:** chart is young (sub-1.0). Stay alert at Phase 2 staging-deploy for breaking value-shape changes between 0.0.x releases. Pin via `helm install --version 0.0.7` to avoid pulling a newer 0.0.x mid-deploy. Recommend re-checking at Phase 2 kickoff for any 0.0.8+ that may have shipped between this audit and deploy.

**Phase 2 chart pin set (verbatim — use these versions, do not "pick latest stable"):**

```bash
# Repo: https://victoriametrics.github.io/helm-charts/
helm install vts vm/victoria-traces-single  --version 0.0.7
helm install vms vm/victoria-metrics-single --version 0.37.0
helm install vls vm/victoria-logs-single    --version 0.12.4

# Other charts (not from VM repo)
helm install otel-collector open-telemetry/opentelemetry-collector --version 0.108.x  # match collector image 0.147.0; verify at Phase 2
helm install grafana grafana/grafana --version 8.x  # carry from gofast-v2.18.0-upgrade Phase 5
helm install nats nats/nats --version 1.2.x  # verify at Phase 2
```

`opentelemetry-collector`, `grafana`, `nats` chart versions kept as plan-spec ranges — pin to exact at Phase 2 kickoff via `helm search repo <chart>` against live cluster. Documented as Phase 2 first-action.

### Acceptance

✓ `victoria-traces-single` chart confirmed to exist (was the highest-uncertainty chart per plan).
✓ Three VM charts pinned to exact `version` strings sourced from authoritative `Chart.yaml`.
✓ Remaining 3 charts noted as Phase 2 first-action verification (`helm search` against live cluster once K3s is up).

---

## Deliverable 4 — Env-var closure list (Compose-prod vs K8s YAML delta)

**Verdict:** Substantial gap across all three services. service-client is the most severe — current K8s YAML would crash boot.

### `service-core` (compose-prod lines 12-49 vs `kube/config/service-core.yaml:38-117`)

**In compose-prod, missing from K8s YAML:**

| Env var | Compose-prod source | K8s status | Phase 2 action |
|---------|--------------------|-----------|---------------|
| `STRIPE_SECRET_KEY` | line 35 | absent | add via `secretKeyRef` |
| `STRIPE_WEBHOOK_SECRET` | line 36 | absent | add via `secretKeyRef` |
| `JWT_PRIVATE_KEY` | line 42 | absent | add via `secretKeyRef` (per Deliverable 1 recommendation) |
| `JWT_PUBLIC_KEY` | line 43 | absent | add via `secretKeyRef` |
| `TASK_TOKEN` | line 17 | present (line 47-51) | ✓ |

**In K8s YAML, NOT in compose-prod (likely fine, kept):**

`GITHUB_CLIENT_ID/SECRET`, `TWILIO_*`, `SES_*`, `POSTMARK_API_KEY`, `SENDGRID_API_KEY`, `STRIPE_PRICE_ID_BASIC/PREMIUM`, `S3_REGION`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZBLOB_*`, `FILE_DIR` — these are GoFast-vendor envs, useful as no-op placeholders (default to empty); leave as-is.

### `service-admin` (compose-prod lines 84-95 vs `kube/config/service-admin.yaml:38-47`)

**In compose-prod, missing from K8s YAML:**

| Env var | Compose-prod source | K8s status | Phase 2 action |
|---------|--------------------|-----------|---------------|
| `JWT_PUBLIC_KEY` | line 95 | absent | add via `secretKeyRef` (verify-only; admin doesn't sign) |

K8s admin manifest is otherwise minimal but correct (matches admin's actual env needs).

### `service-client` (compose-prod lines 130-168 vs `kube/config/service-client.yaml:34-39`)

**SEVERE: K8s manifest has only 5 env vars; compose-prod sets 30+.** Current K8s manifest would fail SvelteKit boot (Drizzle requires `DATABASE_URL`).

| Env var | Compose-prod source | K8s status | Phase 2 action |
|---------|--------------------|-----------|---------------|
| `NODE_ENV` | line 130 | absent | add literal `production` |
| `PORT` | line 131 | absent | add literal `3000` |
| `ORIGIN` | line 132 | absent | add `https://${CLIENT_URL}` |
| `BODY_SIZE_LIMIT` | (Dockerfile CMD line 38) | absent | **add literal `10485760`** — currently set in Dockerfile CMD only; if K8s overrides `command:`/`args:`, the limit is lost and large file uploads break |
| `PUBLIC_APP_DOMAIN` | line 139 | absent | add `${CLIENT_URL}` (just host, not URL) |
| `POSTGRES_HOST/PORT/DB/USER/PASSWORD` | lines 141-145 | absent | add via `secretKeyRef` |
| `DATABASE_URL` | line 147 | absent | construct from postgres secret OR add full URL secret |
| `DIRECT_URL` | line 148 | absent | same as DATABASE_URL |
| `RESEND_API_KEY` | line 150 | absent | add via `secretKeyRef` |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | lines 151-152 | absent | add literals |
| `GOTENBERG_URL` | line 154 | absent | add `http://gotenberg-sv:3000` (cluster-internal Service URL) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | lines 156-157 | absent | add via `secretKeyRef` |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY` | line 158 | absent | add literal (public key, ok in plain manifest) |
| `ANTHROPIC_API_KEY` | line 160 | absent | add via `secretKeyRef` |
| `JWT_PUBLIC_KEY` | line 162 | absent | add via `secretKeyRef` |
| `ENCRYPTION_KEY` | line 164 | absent | add via `secretKeyRef` |
| `PUBLIC_SENTRY_DSN` | line 166 | absent | add literal (public DSN) |
| `CONTENT_URL` | line 168 | absent | add `http://service-content-sv:5001` |

This list is the deliverable for Phase 2 task 7 (env vars closure). File a fuller artifact at `.claude/notes/k8s-migration/phase-2-env-closure.md` before commit per appraisal §"Phase 2 refinements".

### `service-content` (compose-prod lines 197-222 — NO existing K8s manifest)

**Manifest must be authored from scratch in Phase 2** (visible-known-debt template). Required env vars:

`LOG_LEVEL`, `HTTP_PORT=5001`, `DOMAIN`, `CLIENT_URL`, `POSTGRES_HOST/PORT/DB/USER/PASSWORD`, `NATS_URL=nats://nats:4222`, `CF_BROWSER_WORKER_URL`, `DATAFORSEO_LOGIN/PASSWORD`, `ANTHROPIC_API_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `GOTENBERG_URL`. Also: `JWT_PUBLIC_KEY` if content-service emits authenticated traffic (verify in Phase 2).

### Acceptance

✓ Compose-prod env list extracted per service.
✓ Delta against K8s YAML enumerated per service with Phase 2 actions.
✓ Severity flagged: service-client closure is the largest (30+ vars to add).
✓ Reference: K8s YAML files cited verbatim with line numbers.

---

## Deliverable 5 — Gotenberg deployment decision

**Decision: in-cluster Deployment + Service.**

### Reasoning

- Webkit prod runs Gotenberg in-stack today (`docker-compose.production.yml:273-296`) with explicit resource limits (`memory: 1G` limit, `256M` reservation). Migration parity is a 1:1 K8s Deployment/Service translation.
- No managed-Gotenberg SaaS justified for low PDF volume (proposal generation only).
- In-cluster deployment is cheaper, simpler, and avoids external dependency for a non-critical service.
- Cluster-internal URL (`http://gotenberg-sv:3000`) replaces the compose `http://gotenberg:3000` cleanly via env-var update on service-client + service-content.

### Phase 2 author from scratch

Manifest at `kube/config/gotenberg.yaml` (visible-known-debt template). Translates compose lines 273-296:

- Image: `gotenberg/gotenberg:8`
- Args: `["gotenberg", "--api-timeout=60s", "--chromium-restart-after=50", "--chromium-max-queue-size=10", "--log-level=warn"]`
- Resources: `limits.memory=1Gi`, `requests.memory=256Mi`
- Probe: `httpGet path=/health port=3000` (compose uses curl-based; K8s kubelet probes httpGet directly, no in-container curl needed)
- Service shape: ClusterIP, port 3000, target the deployment

Replicas: 1 (single-instance is sufficient; PDF gen is bursty but not concurrent across users at current scale).

### Acceptance

✓ Decision documented with reasoning.
✓ Phase 2 manifest shape specified (image, args, resources, probe).

---

## Deliverable 6 — Traefik conflict resolution decision

**Decision: K3s-bundled Traefik (option (b) from plan §5).**

### Reasoning

- Webkit's current standalone Traefik runs OUTSIDE this repo. `docker-compose.production.yml:302-303` declares `traefik-public` as `external: true` — meaning Traefik itself is configured on the VPS, not in this repo. There IS no `traefik/` config directory in the repo.
- K3s ships Traefik v3 (in K3s 1.32+), configured via `HelmChartConfig` CRD (`/var/lib/rancher/k3s/server/manifests/traefik-config.yaml`).
- "Two Traefiks on one VPS" (external + K3s-bundled) creates port 80/443 contention. Avoidable by picking one.
- Given Webkit owns kube/ wholesale, K3s-bundled is fewer moving parts post-cutover.

### Phase 2 staging validation gate

Before Phase 5 (prod cutover), staging must demonstrate:
- TLS handshake against `staging-app.webkit.au` succeeds with K3s-bundled Traefik holding the cert.
- Custom middleware (rate-limit) renders correctly via K8s Middleware CRD (see Deliverable 8).
- X-Forwarded-For / X-Real-IP reaches service-client and is honored by SvelteKit hooks (see Deliverable 8).

If staging surfaces a feature gap, fall back to option (a): K3s `--disable=traefik` and bridge external Traefik into K8s services via NodePort + `traefik-public` network. This is the explicit fallback path; do NOT chain forward through staging-validation failure.

### Acceptance

✓ Decision: K3s-bundled, fallback path documented.
✓ Staging validation gates listed.

---

## Deliverable 7 — pgvector volume migration path decision

**Decision: `pg_dump` / `pg_restore` (NOT volume mount).**

### Reasoning

- Compose Postgres uses `pgvector/pgvector:pg16` (image-managed Postgres 16 with pgvector). Storage layout is `/var/lib/postgresql/data` in the named volume `postgres_data`.
- CNPG-managed Postgres uses its own filesystem layout managed by the operator (`/var/lib/postgresql/data/pgdata`, with metadata files specific to CNPG bookkeeping).
- **Volume-mount-the-existing-data approach is NOT viable cross-engine.** CNPG would not recognize the directory as a valid CNPG-managed cluster; the operator would either reject it or re-init (data loss).
- `pg_dump`/`pg_restore` is the canonical cross-engine migration path. Format is text/custom; portable; tested on every CNPG `bootstrap.recovery` doc.

### Phase 5 cutover sequence (carries from plan §6 + appraisal Phase 5 checkpoint discipline)

1. T-24h: `pg_dump -Fc` on KVM 4 Compose Postgres → S3 (`webkit-backups` bucket).
2. T-24h: import dump into staging CNPG cluster; verify a sample query succeeds. **This is the dry-run of the prod restore path** — uncovers any version/extension incompatibility before cutover.
3. T0: Compose-down (preserves the old `postgres_data` volume as L2 rollback fuel).
4. T0: K3s-up; CNPG cluster bootstrapped from the S3 dump (`bootstrap.recovery` referencing the off-VPS dump location).
5. T+30m: smoke against `app.webkit.au`; if fail → L1 rollback (kubectl undo); if persistent → L2 (Compose `up -d` against preserved `postgres_data` volume; note dump-restore is NOT needed for L2 because original volume is intact).

### Risks

- **pgvector dimension/version compat:** confirm CNPG `standard` image's pgvector version ≥ what production currently runs. `docker exec webkit-postgres psql -U webkit -d webkit -c "SELECT extversion FROM pg_extension WHERE extname='vector';"` against prod gives the current version; CNPG standard image's bundled version must be ≥. If CNPG ships a NEWER pgvector, no issue (forward-compat). If OLDER, pre-cutover dry-run will fail; resolve via custom-build (Deliverable 2 fallback) using the matching pgvector apt package.
- **Large databases:** `pg_dump`/`pg_restore` round-trip is RTO-bounded by dump size. Webkit prod is small (1-user beta-prep); negligible. Document baseline dump size at T-24h for L2 RTO planning.

### Acceptance

✓ Decision: pg_dump/pg_restore (with reasoning vs volume mount).
✓ Cutover sequence specified.
✓ Risks (pgvector version, dump size) listed with mitigations.

---

## Deliverable 8 — K3s-bundled Traefik feature parity audit

**Verdict:** all four required features supported via Traefik v3. One latent bug in current `service-ingress.yaml` (resolver name mismatch) must be fixed in Phase 2.

### Feature 1 — `letsencrypt` named cert resolver

Webkit prod uses resolver name `letsencrypt` (`docker-compose.production.yml:58, 102, 175`).

K3s-bundled Traefik v3 supports arbitrary named cert resolvers via `HelmChartConfig` static config (Traefik docs confirmed multiple named resolvers). Configure via:

```yaml
# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    additionalArguments:
      - "--certificatesresolvers.letsencrypt.acme.email=admin@webkit.au"
      - "--certificatesresolvers.letsencrypt.acme.storage=/data/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
```

**Latent bug in current YAML:** [kube/config/service-ingress.yaml:9](kube/config/service-ingress.yaml#L9) sets:

```yaml
traefik.ingress.kubernetes.io/router.tls.certresolver: default
```

Phase 2 must rename `default` → `letsencrypt` to match the HelmChartConfig resolver definition. Otherwise TLS handshake fails at cutover.

### Feature 2 — X-Forwarded-For client real-IP forwarding

Traefik v3 forwards `X-Forwarded-For` by default when the request enters via `entrypoints.websecure`. To explicitly trust upstream proxies (e.g., Cloudflare in front of K3s):

```yaml
# In HelmChartConfig valuesContent
ports:
  websecure:
    forwardedHeaders:
      trustedIPs:
        - "173.245.48.0/20"  # Cloudflare ranges
        - "103.21.244.0/22"
        # ... full Cloudflare IP list
```

Webkit cookie-secure logic (`apps/service-client/src/hooks.server.ts` and elsewhere) reads `event.getClientAddress()` which derives from `X-Forwarded-For`. **Verify in staging** (Deliverable 6 gate) that real client IP reaches the SvelteKit app — not the K3s node IP.

### Feature 3 — TLS resolver naming convention

Already covered by Feature 1. Resolver name in HelmChartConfig MUST match the value referenced in Ingress / IngressRoute annotations. Phase 2 reconciles all three references (`service-ingress.yaml:9`, future content/admin ingresses if added).

### Feature 4 — Custom middlewares

Webkit prod uses three custom middlewares declared INLINE on each service's compose labels:
- `api-ratelimit` — 100 avg / 200 burst / 1s period (`docker-compose.production.yml:63-65`)
- `admin-ratelimit` — 50 avg / 100 burst / 1s period (lines 108-110)
- `client-ratelimit` — 200 avg / 400 burst / 1s period (lines 181-183)

Traefik on K8s uses Middleware CRDs (`traefik.io/v1alpha1` Middleware kind). Phase 2 author:

```yaml
# kube/config/middleware-ratelimit.yaml (NEW)
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: api-ratelimit
  namespace: default
spec:
  rateLimit:
    average: 100
    burst: 200
    period: 1s
---
# (admin-ratelimit, client-ratelimit follow same shape)
```

Reference middleware via Ingress annotation:
```yaml
traefik.ingress.kubernetes.io/router.middlewares: default-api-ratelimit@kubernetescrd
```

**No feature gap** — all three rate-limit shapes translate 1:1 to Traefik Middleware CRDs.

### Other middleware audit (non-rate-limit)

`docker-compose.production.yml` was scanned for any other middleware references. Only the three `*-ratelimit` patterns above were found. No HSTS, redirect, auth-headers, basic-auth, or compress middlewares are configured at the Webkit-app layer. (HSTS, if needed, is configurable at the Traefik global level via HelmChartConfig.)

### Acceptance

✓ All four feature-parity requirements addressable on K3s-bundled Traefik v3.
✓ Latent `service-ingress.yaml:9` resolver-name bug surfaced as Phase 2 must-fix.
✓ Phase 2 deliverable: author `middleware-ratelimit.yaml` (NEW manifest, three Middleware CRDs).
✓ Phase 2 deliverable: HelmChartConfig manifest at `/var/lib/rancher/k3s/server/manifests/traefik-config.yaml` with `letsencrypt` resolver + Cloudflare trustedIPs.

---

## Phase 2 first-action checklist (deliverables-derived)

These are the concrete edits Phase 2 must make on Day 1, distilled from this audit:

1. `kube/config/db-postgres.yaml` — add `spec.imageName: ghcr.io/cloudnative-pg/postgresql:16.10-standard-trixie` (verify latest 16.x at deploy time).
2. `kube/config/service-ingress.yaml:9` — rename `certresolver: default` → `certresolver: letsencrypt`.
3. `kube/config/service-client.yaml` — add 30+ env vars per Deliverable 4 closure list. Critical: `BODY_SIZE_LIMIT=10485760`, `DATABASE_URL`, `DIRECT_URL`.
4. `kube/config/service-core.yaml` — add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` via `secretKeyRef`.
5. `kube/config/service-admin.yaml` — add `JWT_PUBLIC_KEY` via `secretKeyRef`.
6. `kube/config/service-core.yaml:127`, `kube/config/service-admin.yaml:57` — pin `otel/autoinstrumentation-go:latest` to a specific tag matching the OTel Collector 0.147.0 line.
7. NEW `kube/config/service-content.yaml` + `service-content-sv.yaml` (visible-known-debt template).
8. NEW `kube/config/gotenberg.yaml` + service object (visible-known-debt template).
9. NEW `kube/config/middleware-ratelimit.yaml` (three Middleware CRDs).
10. NEW HelmChartConfig at `/var/lib/rancher/k3s/server/manifests/traefik-config.yaml` (cert resolver + trusted IPs).
11. Replace `kube/config/monitoring-vts.yaml` STUB with `victoria-traces-single` chart values 0.0.7 (visible-known-debt template until cluster-validated).
12. Edit `kube/config/monitoring-otel.yaml` — re-add traces pipeline + `otlp/vts` exporter.
13. Edit `kube/config/monitoring-grafana.yaml` — add VictoriaTraces datasource entry.

## Open big-decision items requiring chat

1. **JWT injection pattern: K8s Secret env-var (Deliverable 1 recommended) vs continue COPY-into-image (plan recommended).** Audit found Go code supports both; recommendation diverges from plan. Worth confirming before Phase 3 workflow authoring.

## Sources

- [CloudNativePG postgres-containers README](https://github.com/cloudnative-pg/postgres-containers)
- [CNPG: Creating Container Images](https://cloudnative-pg.io/blog/creating-container-images/)
- [CNPG Recipe 23 — ImageVolume (PG18+ pgvector)](https://www.gabrielebartolini.it/articles/2025/12/cnpg-recipe-23-managing-extensions-with-imagevolume-in-cloudnativepg/)
- [VictoriaMetrics helm-charts repo](https://github.com/VictoriaMetrics/helm-charts/tree/master/charts)
- [K3s Networking docs](https://docs.k3s.io/networking/networking-services)
- [Traefik v3 ACME / Cert Resolvers](https://doc.traefik.io/traefik/v3.0/https/acme/)
- [Sirsh Amarteifio — CloudNativePG, AGE, pg_vector on Docker (Medium)](https://medium.com/percolation-labs/cloudnativepg-age-and-pg-vector-on-a-docker-image-step-1-ef0156c78f49)
