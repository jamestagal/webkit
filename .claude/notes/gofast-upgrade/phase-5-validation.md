# Phase 5 Validation — `[gofast-v2.18.0-upgrade]`

**Workstream:** `[gofast-v2.18.0-upgrade]`
**Phase:** 5 (local validation, receive-side-only per relaxed acceptance)
**Date:** 2026-05-04
**Acceptance reference:** `.comms/cowork-to-claude/20260504T150814-gofast-v2-18-0-upgrade-phase-5-acceptance-relaxed.md`

---

## Summary

Receive-side validation of the v2.18.0 monitoring stack. All Victoria backends accept ingestion, all Grafana datasources are provisioned and queryable. Source-side instrumentation gap acknowledged — **the four `gofast_*` framework metric panels are present in dashboards but empty** because Webkit's `app/service-core/` has no OTel SDK or instrumentation. End-to-end validation deferred to follow-on workstream `[gofast-otel-instrumentation]`.

The truthful framing: **this workstream's deliverable is "Victoria stack ready to receive data when an instrumented service emits it."** That's verified. The send side requires the new workstream to land before end-to-end verification is possible.

---

## ⚠️ Acknowledged gap — `gofast_*` panels empty

**Webkit's `app/service-core/` has zero OTel instrumentation:**

- No `pkg/otel/` directory (the v2.18.0 reference clone has `pkg/otel/{otel.go, metrics.go, otel_test.go}` — Webkit does not)
- `grep -rn "OTEL_EXPORTER_OTLP_ENDPOINT\|otlp\|otel" app/service-core/main.go app/service-core/transport/` returns zero matches
- The `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317` env var is set on the running container but the Go code never reads it
- VictoriaMetrics `__name__` label after route exercise: empty list — confirms zero data emission

**Why this isn't a regression:** Webkit's service-core was scaffolded from a pre-OTel-instrumented GoFast version (or the OTel package was customized away at some point). The four built-in `gofast_*` framework metrics (`gofast_auth_refresh_total`, `gofast_authorize_denied_total`, `gofast_db_query_duration_seconds`, `gofast_external_request_duration_seconds`) are a v2.18.0 feature that requires the framework's interceptors and SDK init — neither of which exist in Webkit's service-core today.

**Source-side gap fix:** filed as `[gofast-otel-instrumentation]` PLANNED tracker entry. Scope: port v2.18.0 reference's `app/pkg/otel/` package into Webkit's service-core, initialize SDK in `main.go`, wire gRPC + HTTP interceptors, instrument the four metrics, end-to-end smoke. Estimated 1-2 days focused work.

**Future readers:** if you find the `gofast_*` panels empty in this Grafana, the upgrade is NOT broken — the receive-side stack is correctly configured and waiting for instrumented services. Check `[gofast-otel-instrumentation]` tracker status to find when source-side wiring lands.

---

## Receive-side evidence (ALL GREEN)

### Monitoring stack health — 5/5 containers up

```
webkit-grafana           Up 11 minutes
webkit-otel-collector    Up 11 minutes
webkit-victoriametrics   Up 14 minutes
webkit-victorialogs      Up 14 minutes
webkit-victoriatraces    Up 14 minutes
```

Brought up via `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --no-recreate otel-collector victoriametrics victorialogs victoriatraces grafana`.

### Grafana — datasources provisioned + health checks pass

Grafana port: **3030** (host) → 3000 (container). Remapped from v2.18.0 reference's default `3001:3000` because Webkit's admin service uses port 3001 (per CLAUDE.md "Service Ports"). Documented in `docker-compose.monitoring.yml:75-76` with explanatory comment.

API probe: `curl http://localhost:3030/api/health` → `{"database":"ok","version":"12.4.0"}`.

Datasource health (via Grafana datasource health API):

| Datasource     | Type                                     | Status | Message                |
|----------------|------------------------------------------|--------|------------------------|
| VictoriaLogs   | victoriametrics-logs-datasource          | OK     | Data source is working |
| VictoriaMetrics| victoriametrics-metrics-datasource       | OK     | Data source is working |
| VictoriaTraces | jaeger                                   | OK     | Data source is working |

Provisioned automatically from `monitoring/grafana-datasources.yaml` (sourced from v2.18.0 reference in Phase 3.2 `6b5f32e`).

Plugins (`GF_INSTALL_PLUGINS` env): `victoriametrics-metrics-datasource,victoriametrics-logs-datasource` — both downloaded and registered cleanly during Grafana startup (verified in container logs).

### Victoria backends — queryability

All three return valid responses (empty results, not errors) for canonical probe queries:

**VictoriaMetrics** (`http://localhost:8428`):
```bash
$ curl 'http://localhost:8428/api/v1/query?query=up'
{"status":"success","data":{"resultType":"vector","result":[]},"stats":{"seriesFetched":"0","executionTimeMsec":2}}
```
Empty result vector = no data emitted yet (expected, source-side gap above), but query path is valid.

**VictoriaLogs** (`http://localhost:9428`):
```bash
$ curl 'http://localhost:9428/select/logsql/query?query=*&limit=1' -w 'HTTP=%{http_code}\n'
HTTP=200
```
HTTP 200 = ingestion endpoint reachable and responding.

**VictoriaTraces** (`http://localhost:10428`, Jaeger-format API):
```bash
$ curl 'http://localhost:10428/select/jaeger/api/services'
{"data":[],"errors":null,"limit":0,"offset":0,"total":0}
```
Empty `data` array = no service traces yet (expected), but Jaeger API responds correctly.

### OTel Collector — pipelines initialized

OTel Collector v0.147.0 (matches v2.18.0 reference). Logs confirm clean startup:

- `spanmetrics` connector started ("traces → metrics")
- `servicegraph` connector started ("traces → metrics")
- OTLP gRPC receiver listening on `[::]:4317`
- OTLP HTTP receiver listening on `[::]:4318`
- `prometheusremotewrite/victoriametrics` exporter started
- `otlphttp/victorialogs` exporter started
- `otlp_grpc/victoriatraces` exporter started
- Health check ready on `:13133`

Pipeline configuration (per `monitoring/otel-collector-config.yaml`):
- traces: otlp → memory_limiter, batch → otlp_grpc/victoriatraces, spanmetrics, servicegraph
- metrics: otlp, spanmetrics, servicegraph → memory_limiter, batch → prometheusremotewrite/victoriametrics
- logs: otlp → memory_limiter, batch → otlphttp/victorialogs

Health endpoint check: `curl http://localhost:13133/` returns HTTP 200.

---

## Webkit-core configuration

`webkit-core` was recreated via `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d core` (Phase 5 setup) to pick up the new `OTEL_EXPORTER_OTLP_ENDPOINT` env var.

Verified env in running container:
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

Container boots clean (HTTP server on 4001, gRPC server on 4002, database connected). The env var has no functional effect today because the Go code doesn't read it (see acknowledged gap above) — but the var is now correctly exposed to the application layer for when `[gofast-otel-instrumentation]` lands.

---

## Screenshots

(Not captured — agent has no browser. Future Cowork or Benjamin pass can attach browser screenshots of the Grafana datasources page (3 green) and the empty `gofast_*` panels with annotation pointing to `[gofast-otel-instrumentation]`. The empty-but-not-erroring state is the load-bearing visual evidence of "receive-side ready, send-side pending.")

---

## GitHub environment secrets — Benjamin manual checklist

From Phase 1 verification report (still applicable):

For **each** environment in [Repo Settings → Environments]:

### `release` (production)

1. **Delete** secret named `ALLOY_URL`
2. **Add** new secret:
   - Name: `OTEL_EXPORTER_OTLP_ENDPOINT`
   - Value: `http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4317`
   - (matches the Helm-form FQDN per Phase 3.4 service DNS harmonization in `infra/service-core.tf:85`)

### `release-candidate` (staging)

3. **Delete** secret named `ALLOY_URL`
4. **Add** new secret:
   - Name: `OTEL_EXPORTER_OTLP_ENDPOINT`
   - Value: `http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4317`

No urgency (no K8s deploy runs against either env until `[k8s-migration-checklist]` resumes). Recommend doing as part of the next session-start ritual rather than batching to the end.

---

## Pointers to related work

- **`[gofast-otel-instrumentation]`** PLANNED — source-side OTel SDK port from v2.18.0 reference's `app/pkg/otel/`. Required to populate the `gofast_*` panels with non-zero data. ~1-2 days focused work.
- **`[k8s-migration-checklist]`** PAUSED → resumes after this workstream ships. K8s plan refresh inherits: divergence audit (5 hidden divergences from this workstream's plan), bash-migration guard rail, VictoriaTraces wiring (per `kube/config/monitoring-vts.yaml` UNVALIDATED stub from `bca45b9`), and the `gofast_otel_instrumentation` blocker note.
- **`[storage-r2-to-s3-rename]`** PLANNED — separate workstream surfaced during this upgrade's plan appraisal. Renames `R2_*` env vars and Go code to `S3_*` while preserving Cloudflare R2 endpoint as backing store. Sequenced after this ships, no urgency.

---

# Closing Update — `[gofast-otel-instrumentation]` Phase 5 (2026-05-04)

This section closes BOTH:
- `[gofast-v2.18.0-upgrade]` Phase 5 deferred verification (the gap documented above — `gofast_*` panels empty due to no source-side instrumentation)
- `[gofast-otel-instrumentation]` Phase 5 cross-layer audit (this workstream's closing artifact)

The prior sections (above the separator) capture the receive-side-only state at the gap-discovery moment. This section captures the closed state.

## Workstream summary

`[gofast-otel-instrumentation]` shipped 2026-05-04 across 6 atomic commits on `main`:

| Phase | Commit | Subject |
|---|---|---|
| 1 | `0a353a2` | port pkg/otel package from v2.18.0 reference |
| 2 | `873e819` | initialize OTel SDK in service-core main.go |
| 3 | `e0edc2a` | wire gRPC + HTTP OTel interceptors |
| 4.0 | `1483fe2` | defensive URL parsing for OTLP endpoint (hotfix) |
| 4.1 | `b2eab80` | instrument `gofast_db_query_duration_seconds` at login + billing sites |
| 4.2 | `8dc09da` | instrument `gofast_external_request_duration_seconds` at 11 provider sites |
| 4.3 | `0f3f852` | rewire `gofast_authorize_denied_total` to inline auth check sites + verify |
| 4.4 | `2e68d13` | instrument `gofast_auth_refresh_total` at Service.Refresh + correct Phase 1 helper comment |
| 5 | (this commit) | cross-layer audit + verification artifact |

Four `gofast_*` framework metrics now firing into VictoriaMetrics. Cross-module deferral filed as `[gofast-otel-shared-pkg]` for the 4 + AI providers in sibling Go modules.

## Verification — four-panel evidence

All four panels ≥1 series populated. Probes were dev-traffic exercises, no JWT-mint fixture required.

### Panel 1: `gofast_db_query_duration_seconds`

```
series count: 1
  query=select_agency_billing_info  result=error  count=3
```

Probe: `GET /api/v1/billing/info?agencyId=00000000-0000-0000-0000-000000000000` × 3 (zero-auth route per Phase 4.1 audit; `select_agency_billing_info` fires inside `Service.GetBillingInfo` then errors on agency-not-found at SQL layer). Wrapper instrumentation captures the full DB round-trip including the error case — `result=error` populates correctly.

`select_user_by_id` (Phase 4.1's other instrumentation site) requires authenticated traffic; will populate organically.

### Panel 2: `gofast_external_request_duration_seconds`

Historical series record (via `/api/v1/series` — `/api/v1/query` 5m rate-window aged out across container restart for Phase 4.4):

```
historical series count: 5
  smtp           send_email      success
  oauth_facebook token_exchange  error
  oauth_github   token_exchange  error
  oauth_google   token_exchange  error
  oauth_microsoft token_exchange error
```

Probe (Phase 4.2): email-login flow (fires `smtp/send_email`) + OAuth state generation × 4 providers + OAuth callbacks with bogus codes (fires `oauth_*/token_exchange` with `result=error`).

Container restarted between Phase 4.2 verification and Phase 5 verification — counter rates aged past the 5m default in `/api/v1/query`. Series records preserved in VM with full OTel resource attrs (verified earlier: `service_name=webkit-core`, `telemetry_sdk_version=1.38.0`, `process_runtime_name=go`).

11 providers instrumented (24 sites) ; 5 verified live; 6 will populate organically (stripe, s3, twilio, resend, postmark, sendgrid, ses, oauth_*/userinfo_lookup).

### Panel 3: `gofast_authorize_denied_total`

```
series count: 1
  reason=unauthenticated  access=256  count=1
```

Probe: `GET /api/v1/files` (auth-gated, no token) → 401 → fires `(h *Handler) authorize` helper → `AuthorizeDenied(ctx, "256", "unauthenticated")`.

3 distinct `access` values from webkit's bitflag enum (1, 64, 256) populated during Phase 4.3 verification; 1 visible in current 5m window. `forbidden` reason not exercised (would require valid-token + insufficient-permission scenario; deferred to organic traffic).

### Panel 4: `gofast_auth_refresh_total`

```
series count: 1
  result=error  reason=invalid_or_expired_tokens  count=5
```

Probe: `POST /api/v1/refresh` with bogus refresh-token cookies × 5 → 401 each → fires error branch at `domain/login/service.go:144`.

Path A (`skipped/not_needed`) and Path B (`success/refreshed`) require an authenticated session with valid (or expired) tokens — JWT-mint fixture not yet established. Both will populate organically in production traffic when authenticated requests pass through `Service.Refresh`.

## Cross-layer audit findings — workstream history

Three prior-phase consumer-side assumption errors caught at brief-prep:

### 1. Phase 3 → Phase 4.3: AuthMiddleware unwired in webkit's REST stack

- **Claim:** Phase 3 instrumented `AuthMiddleware` with `gofast_authorize_denied_total` fire site on 401/403 paths.
- **Reality:** Webkit's REST stack uses inline-per-route auth (`h.authService.Auth(token, access)`) — `AuthMiddleware` was never wired into the router.
- **Found by:** Cross-layer audit during Phase 4.1 brief-prep (verification methodology gap surfaced during Phase 4.2's metric-pipe debugging).
- **Fix:** Phase 4.3 added `(h *Handler) authorize` helper centralizing the inline auth pattern + metric-fire; migrated 11 inline sites across `file_route.go` (4), `note_route.go` (5), `email_route.go` (2). `AuthMiddleware` definition preserved unchanged for future use.
- **Lesson:** Reference-clone-derived patterns may depend on framework conventions webkit doesn't follow.

### 2. Phase 1 → Phase 4.2: Provider package layout cross-module gap

- **Claim:** Phase 1 plan assumed all integration providers live under `webkit-core` and would be instrumentable from a single `pkg/otel/` package.
- **Reality:** 4 integration packages (`dataforseo`, `pagespeed`, `jina`, `cfbrowser`) + AI providers (`anthropic`, `openai`) live in `app/pkg/*` shared module + `app/content-service` sibling Go module. Instrumenting them from webkit-core would force `service-core/pkg/otel` as a transitive dependency on `content-service`.
- **Found by:** Cross-layer audit during Phase 4.2 implementation.
- **Fix:** Filed `[gofast-otel-shared-pkg]` follow-on workstream (Option 3: move pkg/otel UP to `app/pkg/otel/` shared module). 11 of 14 canonical providers wrapped in this workstream's webkit-core scope.
- **Lesson:** Cross-module concerns surface only when discovery happens; service-scoped Phase 1 had no way to know.

### 3. Phase 1 → Phase 4.4: Refresh handler IS Service.Refresh

- **Claim:** Phase 1 helper comment in `pkg/otel/metrics.go:77-94` claimed "Webkit's auth flow does not have a discrete refresh handler — this metric may report zero in production."
- **Reality:** `domain/login/service.go:108` `Service.Refresh` IS the discrete refresh handler with two distinct success paths (skipped/not_needed + success/refreshed) plus error branches (invalid/revoked/expired refresh tokens).
- **Found by:** Cross-layer audit during Phase 4.4 brief-prep.
- **Fix:** Phase 4.4 corrected the helper comment + instrumented 5 sites in Service.Refresh (1 Path A + 1 Path B + 3 error branches).
- **Lesson:** Helper-side correctness (helper exists, signatures sound) is necessary-but-not-sufficient. Brief-prep should also verify consumer-side wiring exists for each defined helper.

**Pattern:** brief-prep cross-layer audit catches each at low cost. Validates the Karpathy #5 "verify the call chain — not just the function that performs X" framework working on webkit. Each fix was cheap when caught at brief-prep; would have been expensive at Phase 5 panel-screenshot time.

The auto-memory `feedback_audit_call_chain_not_just_function.md` (a.k.a. source-side-instrumentation-audit) covers the broader principle. The three-finding workstream-internal record stays here as durable workstream history.

## Counter-vs-histogram flush timing — banked observation

VictoriaMetrics scrape pickup for OTel SDK exports differs slightly between counter and histogram series:

- **Histograms** (`gofast_db_query_duration_seconds`, `gofast_external_request_duration_seconds`): appear in VM within ~10s of exercise.
- **Counters** (`gofast_authorize_denied_total`, `gofast_auth_refresh_total`): appear within ~23-30s of exercise.

**Phase 5+ verification scripts should `sleep 30s` between exercise and PromQL gate-check** to avoid false "metric absent" failures. Bake into `[gofast-otel-shared-pkg]` Phase 5 verification scripts and any future OTel verification gates.

## Endpoint-format hotfix — Phase 4.0

Pre-existing latent bug surfaced in Phase 3 cross-layer trace verification: `OTEL_EXPORTER_OTLP_ENDPOINT` per OTel spec is a URL (e.g. `http://otel-collector:4317`), but `pkg/otel/otel.go` was passing it verbatim to `otlpgrpc.WithEndpoint()` which expects `host:port` only. Result: "too many colons" errors on every export attempt; spans/metrics/logs failed to reach the collector silently (OTel SDK is non-blocking on connect).

**Fix:** added `parseOTLPEndpoint()` helper at `pkg/otel/otel.go:39` that extracts `host:port` from URL input, accepts `host:port` directly, falls through on parse failure. Applied at three `WithEndpoint(...)` call sites (otel.go:167/184/201). Test suite `TestParseOTLPEndpoint` covers 5 cases (URL, https URL, host:port unchanged, empty, malformed fallthrough).

The bug went undetected in Phase 2 because the bogus-endpoint boot test only verified init didn't panic — never observed an actual export. Phase 3 interceptor firing was the first time exports actually attempted, surfacing the format mismatch in collector logs. **The cross-layer audit framework catching this earlier than Phase 5 saved a deeper debugging session.**

## Verification gate spec correction

The Phase 3 verification spec used `docker logs webkit-otel-collector | grep -c "ResourceSpans"` as the trace-flowing gate. **This was structurally unreachable for Webkit's collector config** — the collector config (`monitoring/otel-collector-config.yaml`) has no `debug` or `logging` exporter, only `otlp_grpc/victoriatraces`, `otlp_http/victorialogs`, `prometheusremotewrite/victoriametrics`. The "ResourceSpans" string only appears in collector logs when a debug/logging exporter dumps received pdata to stdout.

**Stronger gate banked for future workstreams:** direct VictoriaTraces Jaeger-API query at `localhost:10428`:

```bash
curl -s "http://localhost:10428/select/jaeger/api/services" | jq -r '.data[]'
# Expect: webkit-core (or whichever service-name has registered traces)

curl -s "http://localhost:10428/select/jaeger/api/traces?service=webkit-core&limit=10" | jq '.data | length'
# Expect: > 0 trace records in the default lookback window
```

Use this gate shape for `[gofast-otel-shared-pkg]` Phase 5 + any future OTel verification.

## Deferred to follow-on workstreams

- **`[gofast-otel-shared-pkg]`** PLANNED in `FEATURE-TRACKER.md` — move `pkg/otel/` UP to `app/pkg/otel/` (shared module), add SDK init to `content-service/main.go`, instrument the 4 deferred providers + AI providers (`dataforseo`, `pagespeed`, `jina`, `cfbrowser`, `anthropic`, `openai`). Sequenced between current OTel ship and K8s migration restart.
- **`handleBillingInfo` zero-auth-posture finding** — separate auth-posture concern surfaced during Phase 4.1 audit (the route is intentionally zero-auth for marketing tier-comparison, but the boundary deserves explicit security review). NOT OTel scope — file as a security-posture finding when prioritized.
- **AuthMiddleware future-use migration** — preserved unchanged through Phase 4.3; available for routes that prefer middleware-style invocation. File as `[auth-middleware-migration]` if/when the team wants to consolidate auth patterns.
- **JWT-mint test fixture** — would unlock auth-gated metric verification (`select_user_by_id`, Path A/B of `auth_refresh`, `forbidden` reason on `authorize_denied`, stripe/s3/twilio external integrations). Useful for `[gofast-otel-shared-pkg]` Phase 5 + any future verification work that depends on authenticated paths.

## Sequencing post-ship

1. `/ship gofast-otel-instrumentation` → flips `[gofast-otel-instrumentation]` PLANNED → DONE in tracker; flips `[gofast-v2.18.0-upgrade]` deferred-Phase-5-artifact note to "closed by `[gofast-otel-instrumentation]` Phase 5 artifact"
2. `[gofast-otel-shared-pkg]` becomes active workstream — 3-phase mini-arc (move pkg/otel UP + content-service init + content-service instrumentation)
3. `[k8s-migration-checklist]` resumes after that — staging cluster + production cutover with full panel coverage from day 1
4. Beta launch follows K8s migration

## Lessons banked for the workstream record

1. **Brief-prep cross-layer audit pattern works** — caught 3 distinct prior-phase consumer-side assumption errors at low cost. Continue applying for `[gofast-otel-shared-pkg]` and beyond.
2. **OTel SDK non-blocking init hides export-time bugs** — Phase 2's "boots cleanly" gate couldn't catch the endpoint-format bug; Phase 3 wiring was needed for spans to actually attempt export. For OTel work, Phase-N "metric/trace appears in receive backend" is the only gate that proves the pipe.
3. **VM scrape-window vs 5m rate query** — counters/histograms aged across container restarts disappear from `/api/v1/query` 5m default but persist in `/api/v1/series`. Use the latter for historical-record verification when the active window has rolled over.
4. **Webkit module structure differs from reference clone in non-trivial ways** — service-core / content-service / service-admin / pkg/* shared. Single-module instrumentation work surfaces cross-module gaps. Always audit the consuming framework's package organization before deriving instrumentation patterns from a reference clone.
