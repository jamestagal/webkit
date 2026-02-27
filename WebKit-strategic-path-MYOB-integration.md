# WebKit's strategic path: MYOB integration, market reality, and the case for starting narrow

**The bottom line: build Xero integration first, plan for MYOB second, and treat "Australian web design agencies" not as a ceiling but as a strategically sound beachhead.** MYOB's API has matured into a workable REST/JSON system, but it trails Xero badly on developer experience — no webhooks, weak documentation, and no Go SDK. The market data confirms this sequencing: an estimated **70–80% of Australian creative/digital agencies use Xero**, leaving only 1,500–3,000 web designers on MYOB. The real strategic question isn't whether MYOB is worth integrating (it is, eventually), but whether the ~7,500 Australian web design businesses represent a viable starting market. The evidence from Ignition, SafetyCulture, and HoneyBook says yes — every one of these billion-dollar companies began in a niche this size or smaller.

---

## MYOB's API has improved, but "improved" is relative

MYOB has fully retired its legacy SOAP-based APIs and now offers a **REST/JSON API suite with OAuth 2.0 authentication**. The old AccountRight Live API and New Essentials API have been consolidated under the **MYOB Business API** brand — same endpoints, new name, reflecting the merger of AccountRight and Essentials into a single product line. Authentication follows a standard three-legged OAuth 2.0 flow with authorization at `secure.myob.com/oauth2/account/authorize`, and access tokens expire in roughly 20 minutes, requiring frequent refresh cycles.

The API covers the full invoicing workflow WebKit would need. Sale invoices come in five types (`/Sale/Invoice/Item`, `/Sale/Invoice/Service`, `/Sale/Invoice/Professional`, `/Sale/Invoice/TimeBilling`, `/Sale/Invoice/Miscellaneous`), each supporting full CRUD operations. Customer management lives at `/Contact/Customer`, payments at `/Sale/CustomerPayment`, and GST tax codes at `/GeneralLedger/TaxCode`. The data model supports line items with tax codes, discount percentages, and job tracking — sufficient for a proposal-to-invoice sync. Pagination defaults to 400 records per page (max 1,000), with OData-style filtering on fields like `LastModified` and `Status`.

A **critical March 2025 change** introduced granular OAuth scopes, breaking the legacy `CompanyFile` scope for new API keys. New integrations must request specific scopes like `sme-invoice` and `sme-customer`. The old company file listing endpoint no longer works for new keys, and the `businessId` must now be extracted from the redirect URI. This change caught many developers off guard, and MYOB's documentation lagged the implementation.

**Rate limits sit at 8 requests per second and 1,000,000 per day per API key** — generous on the daily cap but tight on burst capacity. An undocumented but confirmed limit of **only 2 active API keys per developer account** has caused production outages when developers unknowingly created a third key, silently deactivating previous ones with misleading 403 errors.

The single biggest technical gap is the **complete absence of webhooks**. MYOB's Business API offers no event-driven notifications — developers must poll using `$filter=LastModified ge datetime'...'` queries to detect changes. This increases complexity, adds latency, and consumes rate-limit budget. By contrast, MYOB's enterprise product (Acumatica) does support webhooks, but that's a separate API targeting a different market segment entirely.

### No Go SDK exists — you'd build from scratch

After exhaustive searching across GitHub and Go package registries, **no Go/Golang library exists for the MYOB API** — neither official nor community-maintained. MYOB's official SDK support is limited to **.NET only** (latest version 2025.5.658 on NuGet), with community-maintained libraries in Ruby (`myob-api` gem) and Python (`pymyob` by Uptick). A Go developer would need to build a custom HTTP client using `golang.org/x/oauth2` for authentication and standard `net/http` for REST calls. The API's straightforward REST/JSON design makes this feasible but time-consuming — expect to invest **2–4 weeks** for a solid wrapper covering invoices, contacts, and payments.

Notably, **Xero also lacks an official Go SDK**, despite offering official SDKs in six languages (Python, Node.js, .NET, Java, PHP, Ruby). For Go developers targeting both platforms, a unified API provider like **Apideck** (which offers a Go SDK) may be the most efficient path.

---

## MYOB's developer program and marketplace: the path to listing

MYOB's developer program operates on three tiers. **Developer Access at $110/month** (AUD, including GST) provides full API access and a shared sandbox. **Developer Partner at $220/month** adds AccountRight and MYOB Business software licenses, product support, and — crucially — eligibility for marketplace listing. **Premium Developer Partner at $630/month** includes additional licenses and tailored marketing support.

The **MYOB App Marketplace** (myob.com/au/apps) lists **350+ apps** and functions as a directory service — MYOB doesn't handle payments; developers charge users directly. To get listed, you must be at minimum a Developer Partner, have **at least 5 active users** of your integration, and complete development within 6 months of membership. All listings undergo review by MYOB's Marketplace Sales and Support teams and must comply with their security requirements and brand guidelines. The process begins by contacting `ecosystem@myob.com`.

### How this compares to Xero's ecosystem

| Dimension | Xero | MYOB |
|---|---|---|
| **Marketplace apps** | **1,000+** globally | ~350 |
| **Developer community** | 50,000+ developers | Significantly smaller |
| **Webhooks** | Native, HMAC-SHA256 signed | None (polling only) |
| **Sandbox** | Instant demo company, free | Shared sandbox, request required |
| **Official SDKs** | 6 languages | .NET only |
| **OpenAPI spec** | Published | Not available |
| **Documentation quality** | Well-structured, comprehensive | Inconsistent, gaps, vague errors |
| **Onboarding time** | Hours to first API call | Days (auth complexity, sandbox delays) |
| **API pricing** | $0–$1,445 AUD/month (tiered, from March 2026) | Free beyond program membership |
| **Rate limits** | 60/min, 5,000/day per org | 8/sec, 1M/day per key |

One notable development: **Xero is introducing paid API tiers effective March 2, 2026**. The new pricing ranges from a free Starter tier (5 connections, limited rate limits) to Enterprise (POA). The Core tier at $35/month supports 50 connections with 10GB egress; the Advanced tier at **$1,445/month** is required for Journal endpoint access. This change has drawn significant developer backlash, with some reporting projected cost increases from near-zero to $17,000+/year. MYOB has announced no comparable API pricing, which paradoxically makes it the cheaper platform to integrate with — a potential strategic consideration.

### Developer pain points with MYOB are well-documented

Community forums, Stack Overflow, and developer blogs reveal consistent frustrations. The **two-layer authentication** (OAuth plus separate company file username/password encoded as Base64 in the `x-myobapi-cftoken` header) adds complexity beyond standard OAuth flows. The **2-key limit** is undocumented and creates production-breaking scenarios. Large company files (>700MB) cause **504 Gateway Timeout errors** that MYOB has acknowledged but not resolved. Error messages are vague — field length mismatches between documentation and actual API behavior go unaddressed, and some response payloads still warn that fields "have not been finalised in this release and may change." Developer support is ticket-based with reports of canned replies rather than substantive help.

A **unified API approach using Codat, Apideck, or Merge** could sidestep many of these pain points. These platforms abstract both MYOB and Xero behind a single interface, with Apideck offering virtual webhooks for MYOB (compensating for the native gap) and a Go SDK. Using Codat or Apideck could save **6–18 months** of direct MYOB integration work while also enabling QuickBooks support as a bonus.

---

## The market reality: Australian web agencies overwhelmingly use Xero

Xero commands approximately **60–67% of the Australian cloud accounting market**, with 1.77 million Australian subscribers as of FY24 (up 13% year-over-year). MYOB holds roughly **20–25%**, down from over 80% a decade ago. QuickBooks captures 10–15%, with the remainder split among Reckon, Saasu, FreshBooks, and Rounded.

Among **creative and digital agencies specifically**, the skew toward Xero is even more pronounced. Multiple Australian accounting advisory firms confirm that Xero dominates among service-based businesses, consultants, freelancers, and creative agencies. The estimated split for this segment is **70–80% Xero, 10–15% MYOB, 10–15% other**. This means only an estimated **1,500–3,000 web designers and agency owners** in Australia use MYOB — a small subset of the already-modest total market.

MYOB retains strength in specific segments: **tradies and construction** (where job management tools like Fergus and Tradify integrate with MYOB), **retail and inventory-heavy businesses** (where MYOB's multi-location inventory management excels), and **businesses with complex payroll needs** (MYOB supports 120+ modern awards). There's also a clear generational divide — established businesses that started with MYOB's desktop software a decade or more ago remain on MYOB, while **new businesses overwhelmingly default to Xero**, driven largely by accountant recommendations. Some accounting firms now refuse MYOB clients entirely.

### What web agencies actually need from accounting integration

The core workflow for Australian web agencies follows a clear pattern: **Proposal → Signature → Deposit → Project Kickoff → Milestone Invoices → Final Payment**. The critical integration points are invoice sync (creating invoices in accounting software from accepted proposals), payment reconciliation (matching Stripe/bank payments to invoices), GST handling (correct 10% GST application for BAS reporting), and contact sync (keeping client records consistent across systems).

A striking gap exists in the current market: **almost no proposal or client lifecycle tools designed for creative agencies integrate with MYOB**. Dubsado, Bonsai, Moxie, Better Proposals, and Proposify all support Xero and/or QuickBooks but not MYOB. The sole significant exception is **Ignition** (Australian-founded), which launched MYOB Business integration in March 2024 — but Ignition primarily targets accounting firms, not creative agencies. HoneyBook, a natural competitor, **isn't even available in Australia** (requires a US or Canadian bank account). This gap represents both a potential opportunity (underserved MYOB users) and a market signal (the MYOB creative-agency segment may be too small for most vendors to justify the integration effort).

---

## How big is the actual addressable market?

The Australian web design services industry comprises approximately **2,852 registered enterprises** (IBISWorld 2024), generating **$1.4 billion AUD** in annual revenue. Adding freelance web designers and developers brings the total to an estimated **7,000–8,500 businesses and sole operators**. However, the industry is in a **mature-to-declining phase**, with enterprise numbers dropping 3.12% from 2023 and revenue growth essentially flat at 0.9%.

The business size distribution mirrors broader Australian SME patterns: roughly **64% are non-employing sole traders**, 25% employ 1–4 people, 9% employ 5–19, and just 2% have 20+ employees. The **sweet spot for SaaS adoption is the 2–10 person agency** — complex enough to need workflow automation, revenue-stable enough to pay for it, and small enough that off-the-shelf tools suffice. That sweet spot represents roughly **1,000 businesses** in web design alone.

### Adjacent markets significantly expand the opportunity

| Segment | Businesses | Relevance | Growth trend |
|---|---|---|---|
| Web design services | ~2,852 | Core | Declining (-3.1%) |
| Freelance web designers | ~4,000–6,000 | Core | Growing (+13% projected) |
| Digital advertising agencies | **7,985** | High | **Fast-growing (+10%)** |
| Graphic design firms | ~6,000–8,000 | High | Stable |
| Traditional ad agencies | ~9,293 | Medium | Growing (+2.7%) |
| Photography businesses | ~8,000–12,000 | Medium | Stable |
| IT consultancies (small) | ~5,000–8,000 | Lower | Growing |

The **digital advertising agency segment** is particularly attractive — 7,985 enterprises growing at 10% annually, with revenue of $3.6 billion. These businesses share nearly identical proposal-to-invoice workflows and attend the same conferences as web designers.

### TAM calculations across three scenarios

**Core market only (web design):** ~7,500 businesses × $900 average annual spend = **$6.75M AUD/year**. This is tight but workable as a beachhead.

**Core plus high-relevance adjacencies (web + digital + graphic design):** ~22,000 businesses × $900 = **$19.8M AUD/year**. This is a comfortable early-stage SaaS market.

**Full creative services TAM:** ~45,000 businesses × $800 = **$36M AUD/year**. This requires minimal product modification — the same proposal-to-invoice workflow applies across all creative services.

At **5–10% market capture**, the serviceable obtainable market (SOM) reaches **$1–2M AUD/year** for the core market and **$2–4M AUD/year** for the expanded creative services market. To make the economics work with a smaller niche, premium pricing matters: think **$200–500/month**, not $50/month.

---

## Why "Australian web design agencies" is the right starting point, not the wrong one

The evidence from Australian SaaS success stories overwhelmingly supports a niche-first approach. **Ignition** started with Australian accountants (~2,000 firms), dominated that niche, expanded geographically within accounting, and only recently broadened to agencies — reaching a $330M valuation along the way. **SafetyCulture** began in a Townsville garage building safety checklists, took 20 years, and is now valued at $2.5B. **Canva** tested its concept for six years in Australian school yearbooks before launching the broader design tool. **Employment Hero** targeted Australian SMEs with HR software, hit profitability, and expanded market-by-market across APAC and into the UK.

The pattern is consistent: **start absurdly narrow, dominate the niche, then expand deliberately**. Geoffrey Moore's bowling pin strategy provides the theoretical framework — pick a beachhead where customers reference each other, share similar buying patterns, and have strong word of mouth. Australian web design agencies tick every box: they congregate at the same events, participate in the same Slack communities, follow the same industry publications, and actively share tool recommendations.

### The expansion sequence that works

**Year 0–1 (Pin 1): Australian web design agencies** (~2,000 target businesses). Goal: 100–200 paying customers, product-market fit, case studies, and $10–20K MRR. Focus on being the undisputed best solution for this specific group.

**Year 1–2 (Pin 2): All Australian digital/creative agencies** (~5,000–8,000 businesses). SEO agencies, branding firms, UX studios, and marketing agencies attend the same conferences and share networks with web designers. Word of mouth carries naturally into this adjacent space.

**Year 2–3 (Pin 3): Australian professional services broadly** (~50,000+ businesses) and/or **international web agencies** (following Ignition's playbook of staying vertical while going global).

**Year 3+ (Pin 4): Global professional services platform**. This is where TAM opens to billions and the company becomes a genuine platform play.

### Signals that it's time to expand

Move to the next pin when you've achieved **5–10% penetration** of the current niche, **NRR above 100%**, **NPS above 50**, and critically, when you start receiving **unsolicited inbound from adjacent verticals** — marketing agencies or design studios asking if your tool works for them. That organic pull is the clearest signal that the bowling pin strategy is working. Avoid expanding before these signals appear. Premature broadening is how niche SaaS companies die — not because the niche was too small, but because they left before dominating it.

---

## Conclusion: strategic priorities for WebKit

Three actionable conclusions emerge from this research. **First, build the Xero integration before MYOB** — 70–80% of your target market uses Xero, the developer experience is dramatically better (webhooks, SDKs, sandbox, documentation), and it's the expected default for any Australian SaaS targeting creative businesses. Use a unified API like Codat or Apideck for MYOB when the time comes; the native developer experience doesn't justify direct integration at an early stage.

**Second, MYOB integration is a competitive differentiator, not a launch priority.** The gap in the market — almost no creative-agency tools integrate with MYOB — means adding it later creates genuine switching cost and captures an underserved segment. But that segment (1,500–3,000 web designers on MYOB) is too small to justify leading with it. Plan the architecture to support both from day one; build MYOB in quarter 3 or 4, not quarter 1.

**Third, "Australian web design agencies" is not too narrow — it's strategically correct.** A ~$6.75M core TAM expanding to $20M+ with adjacent creative services, strong community dynamics, and a proven expansion playbook from Ignition, SafetyCulture, and HoneyBook make this a textbook beachhead. The risk isn't starting too narrow. The risk is expanding too early, diluting focus, and competing against horizontal giants before you own your niche. Price for value ($200–500/month), build community obsessively, and let the market pull you into adjacencies when the time is right.