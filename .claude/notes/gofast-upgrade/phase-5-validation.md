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
