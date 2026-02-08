# Execution Roadmap

**Date:** 2026-02-08
**Source:** All spec plans in `docs/plans/`, resolved questions in `unresolved-questions-answered.md`

---

## How This Document Works

Every item from the 5 spec plans is mapped here with:
- **Work stream** -- can an agent do this independently?
- **Dependencies** -- what blocks it?
- **Cross-cutting** -- does it touch files another task also touches?

Items are grouped into execution waves. Within each wave, independent items run in parallel.

---

## Wave 1: Critical Fixes (P0)

**Goal:** Fix everything that could cause data loss, security issues, or crashes under load.
**Timeline:** 1-2 focused days
**All items are independent -- run in parallel.**

### Stream A: Go Backend Hardening (1 agent)

Touches: `app/service-core/rest/middleware.go`, `app/service-core/rest/server.go`

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Fix rate limiter thread safety | arch-spec #1 | 1-2 hrs | `middleware.go:64-100` |
| Fix email validation | arch-spec #3 | 30 min | `middleware.go:356-358` |
| Fix error message leaking | arch-spec #8 | 1 hr | `server.go:243-253` |
| Add `http.MaxBytesReader` to `validateJSONInput` | arch-spec #2 (partial) | 15 min | `middleware.go:211-228` |

**Why one agent:** All 4 touch `middleware.go` or `server.go`. Parallel agents would conflict.

### Stream B: SvelteKit Quick Fixes (1 agent)

Touches: `service-client/` only, no overlap with Stream A

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Fix error page typo + domain | ui-spec #1 | 5 min | `+error.svelte` |
| Set BODY_SIZE_LIMIT=10MB | arch-spec #2 (partial) | 5 min | `Dockerfile:39` |
| Delete dead Zod code | arch-spec #5 (resolved Q3) | 15 min | `validation.ts`, `http.ts`, `package.json` |
| Delete Button.svelte + fix 2 usages | ui-spec #11 (resolved Q1) | 30 min | `Button.svelte`, 2 page files |
| Update free tier limits (10 consults, 3 templates) | business-spec #9 (decision #1) | 5 min | `subscription.ts` |

**Why one agent:** Trivial changes, all in `service-client/`. Quick sequential work.

### Stream C: Database Race Conditions (1 agent)

Touches: `service-client/src/lib/api/*.remote.ts`, `service-client/src/lib/server/`

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Fix document number race conditions | db-spec #1 | 2-4 hrs | `proposals.remote.ts`, `contracts.remote.ts`, `invoices.remote.ts`, new `document-numbers.ts` |
| Fix AI generation counter race | db-spec #4 | 1 hr | `subscription.ts:338-370` |

**Why one agent:** Both involve atomic SQL patterns. The doc number fix creates a helper that's a similar pattern to the AI counter fix. No overlap with other streams.

### Stream D: Contract Emails (1 agent)

Touches: `service-client/src/lib/api/contracts.remote.ts`, `service-client/src/lib/server/`, `service-client/src/lib/templates/`

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Wire up contract email sending | business-spec #1 | 4-8 hrs | `contracts.remote.ts`, new `contract-emails.ts`, `email-templates.ts` |

**Why separate:** Larger task, touches email templates. No file overlap with Stream C (different remote files, different server utils).

**CROSS-CUTTING NOTE:** Stream C and D both touch `contracts.remote.ts`. Stream C modifies the document number generation at contract creation (~lines 142-168). Stream D modifies the send/resend flow (~lines 793-870, 1386). These are different sections -- safe to parallelize IF agents don't reformat the whole file. **Safer: run Stream C before Stream D**, or have Stream D agent read `contracts.remote.ts` fresh after Stream C completes.

### Stream E: Production Infrastructure (1 agent)

Touches: `docker-compose.production.yml`, VPS scripts -- NO overlap with any code streams

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Add Gotenberg resource limits | scalability-spec #6 | 30 min | `docker-compose.production.yml` |
| Set up database backups to R2 | scalability-spec #1 | 4-6 hrs | `docker-compose.production.yml`, new backup script |
| Add external uptime monitoring | scalability-spec #2 (Phase 1) | 1 hr | External service config (Better Stack/Uptime Robot) |

**Why one agent:** All infra/Docker work. No code changes. Sequential within `docker-compose.production.yml`.

### Stream F: XSS Audit (1 agent)

Touches: `service-client/src/routes/c/`, `service-client/src/routes/(app)/*/contracts/`, `contracts.remote.ts` (server-side sanitization)

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Add DOMPurify, sanitize {@html} | ui-spec #2 | 2-3 hrs | 5 template files, `contracts.remote.ts`, new `sanitize.ts`, `package.json` |

**CROSS-CUTTING NOTE:** Touches `contracts.remote.ts` for server-side sanitization on storage. Stream D also touches this file but different functions (send/resend vs HTML generation). **Safe to parallelize IF Stream F only adds sanitization in `generateContract*` functions and Stream D only modifies `sendContract`/`resendContract`.**

**Recommendation: Run Stream F after Stream D** to avoid merge complexity.

---

### Wave 1 Execution Plan

```
PARALLEL GROUP 1 (all independent, no file conflicts):
├── Agent 1: Stream A (Go backend)        ~3-4 hrs
├── Agent 2: Stream B (SvelteKit fixes)   ~1 hr
├── Agent 3: Stream C (DB race conditions) ~3-5 hrs
└── Agent 4: Stream E (Infra/Docker)      ~5-7 hrs

SEQUENTIAL AFTER GROUP 1:
├── Agent 5: Stream D (Contract emails)   ~4-8 hrs  (after C, reads fresh contracts.remote.ts)
└── Agent 6: Stream F (XSS audit)         ~2-3 hrs  (after D, reads fresh contracts.remote.ts)
```

**Max parallel agents: 4**
**Total elapsed time: ~1.5 days** (Group 1 takes ~7 hrs, then D+F take ~10 hrs)

---

## Wave 2: Launch Readiness (P1)

**Goal:** Features and hardening needed before accepting paying customers.
**Timeline:** 1-2 weeks after Wave 1
**Depends on Wave 1 being complete.**

### Stream G: Dashboard & Reporting (1 agent)

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Populate dashboard stats | ui-spec #3 | 4-6 hrs | `+page.server.ts`, `+page.svelte` (dashboard) |
| Activity feed (real data) | ui-spec #3 + business-spec #2 Phase B | 4-8 hrs | Same files + new `reporting.remote.ts` |
| Reports page (Phase C) | business-spec #2 Phase C | 1-2 weeks | New route `reports/+page.svelte` |

**Note:** Dashboard stats and activity feed are prerequisites for the full reports page. Run sequentially within this stream.

### Stream H: Database Integrity (1 agent)

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Add unique constraints on doc numbers | db-spec #2 | 1-2 hrs | New migration, `schema.ts` |
| Fix schema drift (5 mismatches) | db-spec #3 | 2-3 hrs | New migration, `schema_postgres.sql`, `schema.ts` |
| Add FKs on form_submissions | db-spec #10a | 30 min | New migration |

**Why one agent:** All migration work. Must be in a single migration file (or sequential numbered files). Requires `run_queries.sh postgres` after Go schema changes.

**Dependency:** db-spec #2 depends on Wave 1 Stream C (race condition fix must come first, then add unique constraint).

### Stream I: Security & CI/CD (1 agent)

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Move JWT keys from Docker layers to env vars | arch-spec #6 | 2-4 hrs | Dockerfiles, `deploy-production.yml`, Go auth code |
| Add migration tracking table | arch-spec #7 | 4-8 hrs | `run_migrations.sh`, new migration |
| Traefik rate limiting | scalability-spec #3 Phase 1 | 1 hr | `docker-compose.production.yml` |

**Why one agent:** All CI/CD and infra. No overlap with code streams.

### Stream J: Deploy Improvements (1 agent)

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Graceful shutdown in Go services | scalability-spec #8 | 2-3 hrs | `service-core/main.go`, `service-admin/main.go`, `rest/server.go` |
| Zero-downtime deploys | scalability-spec #7 | 4-6 hrs | `deploy-production.yml` |
| Cloudflare CDN setup | scalability-spec #9 | 1-2 hrs | Cloudflare dashboard/API |

**Why one agent:** Graceful shutdown enables zero-downtime deploys. Sequential dependency within stream.

### Stream K: Onboarding (1 agent)

| Item | Source | Effort | Files |
|------|--------|--------|-------|
| Onboarding wizard | business-spec #7 | 1-2 weeks | New route, `agency_profiles` updates |

**Independent:** No file overlap with other Wave 2 streams.

### Wave 2 Execution Plan

```
PARALLEL GROUP 2 (all independent):
├── Agent 1: Stream G (Dashboard/Reports)   ~2-3 weeks
├── Agent 2: Stream H (DB integrity)        ~4-6 hrs
├── Agent 3: Stream I (Security/CI)         ~7-13 hrs
├── Agent 4: Stream J (Deploy improvements) ~7-11 hrs
└── Agent 5: Stream K (Onboarding)          ~1-2 weeks

Max parallel agents: 5
```

**Stream G and K are the long poles** (weeks). H, I, J finish in 1-2 days each.

---

## Wave 3: Post-Launch Polish (P2)

**Goal:** UX improvements, accessibility, caching, architecture cleanup.
**Timeline:** Ongoing after launch. Pick and choose based on user feedback.

### Stream L: UI Polish (1 agent)

| Item | Source | Effort |
|------|--------|--------|
| Breadcrumb navigation | ui-spec #4 | 2 hrs |
| Fix mobile sidebar DOM manipulation | ui-spec #5 | 1-2 hrs |
| Unify spinner patterns | ui-spec #6 | 2-3 hrs |
| Add ARIA attributes | ui-spec #7 | 2-3 hrs (after #5) |
| NProgress page transitions | ui-spec #8 | 1-2 hrs |

All SvelteKit UI work, no backend touches. Sequential within (ARIA depends on sidebar fix).

### Stream M: Infrastructure Scaling (1 agent)

| Item | Source | Effort |
|------|--------|--------|
| Redis caching layer | scalability-spec #4 | 1-2 days |
| NATS JetStream or removal | scalability-spec #5 / arch-spec #10 | 4-6 hrs |
| Full monitoring stack (Grafana) | scalability-spec #2 Phase 2 | 2-4 hrs |

All infra/Docker + Go pubsub code. No SvelteKit overlap.

### Stream N: Database Architecture (1 agent)

| Item | Source | Effort |
|------|--------|--------|
| CASCADE delete protection | db-spec #5 | 4-8 hrs |
| RLS policies | db-spec #8 | 2-3 days |
| Address dual JSONB+flat columns | db-spec #9 | 1-2 days |
| Context key collision fix (Go) | arch-spec #11 | 15 min |
| Duplicate route cleanup (Go) | arch-spec #9 | 2-4 hrs |

**CROSS-CUTTING:** db-spec #9 (JSONB) is blocked by arch-spec #4 (dual-DB decision). Resolved question says: keep both column sets, long-term migrate consultation CRUD to SvelteKit. This is a product decision -- defer unless you want to commit to that direction.

### Stream O: Encryption (1 agent)

| Item | Source | Effort |
|------|--------|--------|
| Encrypt banking info (BSB, TFN) | db-spec #6 | 1-2 days |
| Evaluate/drop legacy subscriptions table | db-spec #7 | 1 hr (after product decision) |

**Dependency:** db-spec #7 requires product decision on whether user-level subscriptions are still needed (resolved Q3 says Go backend DOES reference it). Must remove Go `payment/service.go` first if deprecating.

---

## Wave 4: Future (P3)

**Not scheduled. Product-driven. No urgency.**

| Item | Source | Agent? |
|------|--------|--------|
| Client portal | business-spec #3 | Yes, independent |
| Recurring invoices | business-spec #4 | Yes, independent |
| International support (currency/locale) | business-spec #5 + ui-spec #12 | Yes, independent |
| Xero integration | business-spec #6 | Yes, independent |
| Template marketplace | business-spec #8 | Yes, independent |
| Project management | business-spec #10 | Yes, independent |
| Logo storage to R2 | ui-spec #9 | Yes, independent |
| Debounced client search | ui-spec #10 | Yes, independent |
| Confirm modal component | ui-spec #A | Yes, independent |
| Electric SQL integration | electric-sql-spec | Yes, after Wave 2 |

All P3 items are fully independent and can each be a standalone agent task.

---

## Cross-Cutting File Conflict Map

These files are touched by multiple items. **Never assign two agents to the same file simultaneously.**

| File | Touched By | Resolution |
|------|-----------|------------|
| `contracts.remote.ts` | Stream C (doc numbers ~L142), Stream D (emails ~L793), Stream F (sanitization in HTML gen) | Run C → D → F sequentially |
| `middleware.go` | Stream A (rate limiter, email validation, MaxBytesReader) | Single agent handles all |
| `server.go` | Stream A (error leaking) | Single agent |
| `docker-compose.production.yml` | Stream E (Gotenberg, backups), Stream I (Traefik rate limit), Stream J (Cloudflare), Stream M (Redis, monitoring) | Separate waves, no conflict |
| `schema.ts` (Drizzle) | Stream H (constraints, drift fixes) | Single agent |
| `schema_postgres.sql` (Go) | Stream H (drift fixes) | Single agent |
| `subscription.ts` | Stream C (AI counter fix) | Single agent |
| `deploy-production.yml` | Stream I (JWT), Stream J (zero-downtime) | Same wave but different sections; safer as one agent |
| `package.json` | Stream B (remove zod), Stream F (add dompurify) | Different waves, no conflict |

---

## Decisions (Resolved 2026-02-08)

### 1. Free tier limits — INCREASE
**Decision: Yes. `maxConsultationsPerMonth: 10`, `maxTemplates: 3`, keep `maxAIGenerationsPerMonth: 5`.**

The current free tier (5 consultations, 1 template) prevents agencies from experiencing the core value proposition. The consultation-to-invoice pipeline needs muscle memory — 5 consultations isn't enough to build it. Agencies hit a wall before the "aha" moment of AI-generated proposals flowing from real consultations.

Starter's value is PDF export and email delivery, not consultation count. Agencies on free can do 10 consultations and generate proposals, but can't email them or export professional PDFs. That's the natural upgrade trigger — frustrated by feature limits, not quantity limits.

Keep AI generations at 5 for free. AI costs real money per call. 10 consultations with 5 AI generations is a sensible ratio — enough to get hooked without unlimited API costs.

**Change:** Update `TIER_DEFINITIONS` in `subscription.ts` free tier. Slot into Wave 1 Stream B (trivial config change).

### 2. User-level subscriptions — REMOVE
**Decision: Remove. Entire `/payments-*` system is dead code.**

The Go `domain/payment/service.go` implements a user-level subscription system (Basic/Premium) completely disconnected from the frontend. Zero SvelteKit code calls `/payments-portal`, `/payments-checkout`, or `/payments-update`. The agency-level billing at `/api/v1/billing/` is the only active subscription flow.

The `subscriptions` table is doubly abandoned — the Go payment service doesn't even use it. It writes user subscription data directly onto `users` table fields (`subscription_id`, `subscription_end`, `customer_id`). The generated sqlc query functions exist but are never called.

**Pre-removal verification steps:**
1. Grep Go codebase for `BasicPlan` and `PremiumPlan` bitflags — confirm no auth middleware gates features on them
2. Check production data: `SELECT COUNT(*) FROM subscriptions;` and `SELECT COUNT(*) FROM users WHERE subscription_id != '';` — if zero (or test data only), clear to proceed
3. Remove in order: Go routes (`server.go:32-40`) → `domain/payment/` + handler → sqlc queries → regenerate sqlc → drop `subscriptions` table via migration → clean up user-level fields (`customer_id`, `subscription_id`, `subscription_end`, `access`) from `users` table last (most disruptive)

**When:** Wave 2, Stream I or standalone task. Nothing depends on it.

### 3. JSONB direction — DO NOTHING NOW, DEPRECATE GO CONSULTATION CODE LATER
**Decision: Keep both column sets. Don't invest in sync. Deprecate Go consultation routes.**

The Go consultation endpoints are completely unused by the frontend. SvelteKit handles all consultation CRUD via Drizzle using flat columns. The Go backend's 39+ JSONB queries, draft system, and version history are sophisticated but orphaned — no active code path reaches them from the UI.

This is NOT a "two backends writing to the same record" problem. Two parallel systems share a table but operate on different column sets. The data coherence risk the appraisal flagged is theoretical, not active.

**Action plan:**
1. **Wave 1/2:** Do nothing. Not causing bugs, no active conflict.
2. **Wave 2-3:** Formally deprecate Go consultation routes. Add deprecation comment in `server.go`. Optionally add logging middleware to confirm no external caller uses them.
3. **Wave 3 (Stream N):** Remove Go consultation code (`domain/consultation/`, sqlc queries, handler). JSONB columns become inert. Drop them in a migration whenever convenient.
4. **Don't backfill** JSONB→flat. All real agency consultations were created through SvelteKit — there's nothing to backfill.

**Worth salvaging (P3):** The Go side's draft auto-save and version history features (`consultation_drafts`, `consultation_versions` tables) are genuinely useful UX patterns. When there's bandwidth, re-implement drafts and versioning in SvelteKit as a P3 feature using the Go implementation as a reference. The tables already exist — just need SvelteKit remote functions to read/write them with flat columns added.

### 4. Currency — EXTRACT UTILITIES NOW, DEFER MULTI-CURRENCY
**Decision: Create `$lib/utils/format.ts` in Wave 2. Don't add DB columns yet.**

AUD is hardcoded in 40+ locations across 20+ files. That's fine for launch. But when the first NZ or UK agency signs up wanting NZD/GBP, it's a multi-day emergency refactor touching every invoice template, email template, PDF generator, proposal page, and AI prompt.

Phase 1: Create `$lib/utils/format.ts` with `formatCurrency(amount, currency?)` and `formatDate(date, locale?)`, default to AUD, find-and-replace all 40+ inline `Intl.NumberFormat` calls. A few hours of work with zero risk (behaviour doesn't change, just centralising) and massive optionality later.

Don't add `currency`/`locale` columns to `agency_profiles` yet. That's Phase 2 and belongs in the quarterly roadmap alongside Xero integration — need to think through multi-currency Stripe implications before committing to the schema.

**When:** Wave 2, add to Stream G or Stream B. Pure SvelteKit work, no backend changes, no migrations.

---

## Recommended First Move

Start Wave 1 with 4 parallel agents:

```
Agent 1: "Go Backend Hardening" (Stream A)
  - Read middleware.go, server.go
  - Fix rate limiter, email validation, error leaking, MaxBytesReader

Agent 2: "SvelteKit Quick Fixes" (Stream B)
  - Fix error page, set BODY_SIZE_LIMIT, delete Zod, delete Button.svelte
  - Update free tier limits in subscription.ts (10 consultations, 3 templates)

Agent 3: "Database Race Conditions" (Stream C)
  - Create atomic doc number helper, fix AI counter
  - Touch: proposals.remote.ts, contracts.remote.ts, invoices.remote.ts, subscription.ts

Agent 4: "Production Infrastructure" (Stream E)
  - Gotenberg limits, backup script, monitoring setup
  - Touch: docker-compose.production.yml, new scripts
```

Then after Group 1 completes:
```
Agent 5: "Contract Emails" (Stream D)
Agent 6: "XSS Audit" (Stream F)
```

---

*End of Execution Roadmap*
