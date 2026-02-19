# Content Intelligence Module — Revised Specification (V2)

**Version:** 2.0
**Date:** February 2026
**Status:** Specification — Pre-Development
**Scope:** Phases 1-3 only (Crawl + Audit + Copy Generation)
**Dependencies:** Existing Webkit platform (SvelteKit + Go + PostgreSQL + Cloudflare)

---

## What Changed From V1

- **Scope reduced to Phases 1-3.** Social media management (Phase 4) and integration polish (Phase 5) deferred to future spec.
- **Firecrawl eliminated.** Replaced with Colly (Go crawler) + Cloudflare Browser Rendering. Saves ~$83-700/month, removes third-party dependency.
- **DataForSEO pricing corrected.** No minimum commitment — pure pay-as-you-go.
- **Two entry paths defined.** Path A (existing website) and Path B (new website / no site to crawl).
- **Questionnaire + Consultation data integrated as first-class input** for brand profiling and content generation.
- **Simpler copy status workflow.** Two states (draft/final) instead of four. Full approval workflow deferred.
- **NATS job queue architecture defined** for background pipeline work.
- **Embedding model versioning added** to content_chunks table.
- **English only** — multi-language support deferred.
- **Tenant isolation defined** for content-service Go microservice (agency_id validation on every request).
- **Export format specified** — per-page structured content with markdown/Word/plain text options.
- **SEO audit → proposal integration** — audit summary feeds into proposal generation for upsell value.
- **Competitor crawl limits set** — max 3 competitors, 15 core pages each.

---

## Executive Summary

Content Intelligence transforms Webkit from a client lifecycle tool into an AI-powered content engine. The core loop: extract client content (or gather context for new sites), build a brand + competitive profile, run SEO audits, and generate targeted copy — all informed by the client's actual voice, industry position, and strategic goals.

### Two Entry Paths

**Path A — Existing Website (site revamp/refresh)**
1. Enter client URL → Webkit crawls and extracts all content
2. AI builds brand voice profile from scraped content + questionnaire data
3. SEO audit runs (technical + content + backlinks + keywords)
4. AI generates deliverables: improved page copy, meta descriptions, new pages

**Path B — New Website (no existing site)**
1. Client completes Webkit Questionnaire (business context, brand, competitors, goals)
2. Webkit crawls up to 3 competitor sites specified in questionnaire (10-15 core pages each)
3. AI builds competitive landscape profile + keyword research for the industry
4. Brand voice profile built from questionnaire data (industry, tone preferences, audience)
5. AI generates deliverables: page copy, site structure, meta descriptions — informed by competitor intelligence and client brief

Both paths converge at the same AI generation layer. The difference is the context assembly: Path A uses scraped content + SEO data, Path B uses questionnaire data + competitor intelligence.

---

## Architecture Overview

### The Shared Foundation

```
┌─────────────────────────────────────────────────────────────┐
│                   CONTENT INTELLIGENCE ENGINE                │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐  │
│  │ Colly Crawler │   │ Brand Voice  │   │ Content       │  │
│  │ + CF Browser  │──▸│ Profiler     │──▸│ Knowledge     │  │
│  │ Rendering     │   │ (AI)         │   │ Base (pgvec)  │  │
│  └──────────────┘   └──────────────┘   └──────┬────────┘  │
│                                                │            │
│  ┌──────────────┐                              │            │
│  │ Questionnaire │──▸ (feeds profiler          │            │
│  │ + Consultation│    directly for Path B)      │            │
│  │ Data          │                              │            │
│  └──────────────┘                              │            │
│                                                │            │
│  ┌─────────────────────────────────────────────▼────────┐  │
│  │              Unified AI Generation Layer               │  │
│  │  (Brand profile + RAG chunks + SEO data + brief)      │  │
│  └──────┬────────────┬────────────┬──────────────────────┘  │
│         │            │            │                          │
│    ┌────▼────┐ ┌─────▼─────┐ ┌───▼───┐                    │
│    │ SEO     │ │ Copy      │ │ Meta  │                    │
│    │ Audit   │ │ Gen       │ │ Gen   │                    │
│    └─────────┘ └───────────┘ └───────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Crawler Architecture: Colly + Cloudflare Browser Rendering

**Why this combination:**
- **Colly** (github.com/gocolly/colly, 25k stars, active) handles crawl orchestration: URL queue, deduplication, depth limiting, rate limiting, robots.txt compliance, concurrent scheduling
- **Cloudflare Browser Rendering** handles page rendering: JavaScript execution, clean markdown extraction, link discovery — as a managed API within the existing CF ecosystem
- **Jina Reader** (r.jina.ai) as zero-config fallback for edge cases

**Why not Firecrawl:** Eliminates $83-700/month dependency. Colly + CF Browser Rendering covers the same functionality within the existing infrastructure. Client sites are typically 20-100 pages — no need for a managed crawling SaaS.

**Why not raw Playwright/ChromeDP:** Both require running headless browser processes on the server. CF Browser Rendering provides the same rendering as a managed API — no browser process management, memory leaks, or crash handling.

**Colly's role is orchestration only.** Its built-in HTTP fetcher is bypassed. Instead, for each URL:
1. Colly queues the URL and manages scheduling/deduplication
2. The custom transport calls CF Browser Rendering `/markdown` for content extraction
3. CF Browser Rendering `/links` returns discovered URLs for Colly to queue
4. Colly continues until depth limit or no new URLs

```go
// Simplified: Colly with CF Browser Rendering backend
c := colly.NewCollector(
    colly.MaxDepth(3),
    colly.Async(true),
)

c.Limit(&colly.LimitRule{
    DomainGlob:  "*",
    Parallelism: 3,
    Delay:       2 * time.Second,
})

// Override transport to use CF Browser Rendering
c.WithTransport(&cfBrowserTransport{
    workerURL: "https://browser-rendering.your-worker.workers.dev",
})
```

**CF Browser Rendering capacity:**
- Workers Paid ($5/mo): 10 hours/month, 10 concurrent browsers
- At ~30 sec/page: ~1,200 pages/month included free
- Overage: $0.09/browser-hour
- For 50 clients × 50 pages = 2,500 pages/month ≈ ~21 hours ≈ ~$1/month overage

### New Microservice: `content-service` (Go)

```
content-service/
├── cmd/
│   └── server/main.go
├── internal/
│   ├── crawler/
│   │   ├── crawler.go          # Colly-based crawl coordinator
│   │   ├── transport.go        # CF Browser Rendering HTTP transport
│   │   ├── classifier.go       # Three-layer page type classification
│   │   ├── sitemap.go          # Sitemap.xml parser
│   │   └── robots.go           # robots.txt handling (Colly built-in + custom)
│   ├── profiler/
│   │   ├── profiler.go         # Profile generation orchestrator
│   │   ├── voice.go            # Brand voice extraction (from scrape OR questionnaire)
│   │   ├── themes.go           # Content theme extraction
│   │   └── questionnaire.go    # Questionnaire data → profile context builder
│   ├── seo/
│   │   ├── content.go          # On-page content SEO checks
│   │   ├── technical.go        # Technical SEO via DataForSEO On-Page
│   │   ├── backlinks.go        # Backlink analysis via DataForSEO
│   │   ├── keywords.go         # Keyword research + gap analysis
│   │   ├── competitors.go      # Competitor SEO comparison
│   │   └── report.go           # SEO report generation
│   ├── generator/
│   │   ├── copy.go             # Website copy generation
│   │   ├── meta.go             # Meta descriptions, titles, schema
│   │   └── context.go          # Context assembly (brand + RAG + SEO + brief)
│   ├── embeddings/
│   │   ├── embed.go            # Text → vector embedding
│   │   └── search.go           # Similarity search
│   ├── jobs/
│   │   ├── queue.go            # NATS job queue manager
│   │   ├── crawl_job.go        # Crawl pipeline job handler
│   │   ├── audit_job.go        # Audit pipeline job handler
│   │   └── generate_job.go     # Generation job handler
│   └── handlers/
│       ├── crawl.go
│       ├── audit.go
│       ├── generate.go
│       └── reports.go
├── pkg/
│   ├── dataforseo/             # DataForSEO API client
│   │   ├── client.go
│   │   ├── backlinks.go
│   │   ├── keywords.go
│   │   ├── onpage.go
│   │   └── labs.go
│   ├── cfbrowser/              # CF Browser Rendering client
│   │   ├── client.go
│   │   ├── markdown.go
│   │   └── links.go
│   ├── jina/                   # Jina Reader fallback client
│   │   └── client.go
│   └── models/
│       ├── content.go
│       └── seo.go
└── migrations/
    └── 001_content_intelligence.sql
```

### NATS Job Queue Architecture

All long-running operations run as background jobs via NATS (already in Webkit's stack):

```
NATS Subjects:
  content.crawl.start      → Initiates crawl pipeline
  content.crawl.page       → Process individual page (extract, classify, chunk, embed)
  content.crawl.complete   → Crawl finished, trigger profiling
  content.profile.generate → Generate/regenerate brand profile
  content.audit.start      → Initiate SEO audit pipeline
  content.audit.section    → Process audit section (technical/backlinks/keywords/content)
  content.audit.complete   → Audit finished, calculate scores
  content.generate.copy    → Generate copy for a page
  content.generate.bulk    → Bulk generation job
```

**Concurrency limits per provider:**
- CF Browser Rendering: 10 concurrent (Workers Paid limit)
- DataForSEO: 5 concurrent (reasonable default, adjustable)
- Anthropic API: 10 concurrent (based on tier)
- Workers AI (embeddings): 20 concurrent (generous free tier)

**Pipeline resumability:** Each job phase is idempotent. If a crawl fails at page 35 of 50, the `content_crawl_jobs.pages_processed` counter lets it resume from page 35. Each `content_pages` record is upserted by `(client_id, url)` unique constraint, so re-processing a page just overwrites.

### New SvelteKit Routes

```
/[agencySlug]/content/                          # Content Intelligence dashboard
├── /[agencySlug]/content/import                # Import client website (enter URL)
│                                                # OR start from questionnaire (Path B)
├── /[agencySlug]/content/[clientId]/           # Client content overview
│   ├── /pages                                  # All scraped pages with status
│   ├── /brand                                  # Brand voice profile viewer/editor
│   ├── /audit                                  # SEO audit dashboard
│   │   ├── /overview                           # Summary + score
│   │   ├── /technical                          # Technical SEO issues
│   │   ├── /content                            # Content quality per page
│   │   ├── /backlinks                          # Backlink profile
│   │   ├── /keywords                           # Rankings + gaps
│   │   └── /competitors                        # Competitor comparison
│   └── /copy                                   # AI copy workspace
│       ├── /audit                              # Page-by-page copy audit
│       └── /generate                           # New copy generation
└── /[agencySlug]/content/reports               # Generated reports
```

Note: Routes scoped under `[agencySlug]` to match existing Webkit routing patterns and multi-tenant architecture.

---

## Path B: New Website Client Flow

### Context Sources

For clients without an existing website, the Content Intelligence system draws from two existing Webkit data sources:

**1. Full Website Questionnaire (37+ fields, 8 sections)**

Already captures:
- Business name, industry, years in operation
- Services/products offered (detailed descriptions)
- Target audience demographics and psychographics
- Brand personality descriptors, preferred tone
- Competitor website URLs (2-5 typically provided)
- Design preferences, color preferences
- Required pages list (e.g., "Home, About, Services, Blog, Contact, FAQ")
- Must-have features, nice-to-have features
- Content they can provide vs. need help creating
- Geographic service areas
- Unique selling propositions

**2. Consultation Data (39 fields, 4 steps)**

Additional context:
- Primary challenges and pain points
- Primary goals (lead generation, sales, brand awareness, etc.)
- Conversion goals (specific outcomes)
- Budget range and timeline
- Urgency level
- Admired websites with reasons
- Performance data (if migrating from an old site)

### Questionnaire Extensions for Content Intelligence

Add a new page/section to the existing Full Website Questionnaire template — NOT a separate form. The client is already in the flow of answering questions, so a "Content Strategy" page at the end feels natural. All fields are optional.

Agencies who need different or more specific content intel questions can create their own questionnaire templates via the form builder. The content intelligence system consumes questionnaire responses generically — it pulls from whatever fields exist, not hardcoded field IDs.

```
Page/Section: "Content Strategy" (new page appended to existing questionnaire template)

- target_keywords: TEXT[]
  "What search terms do you think your customers use to find businesses like yours?"
  (Free text, comma-separated. AI will expand and refine these.)

- competitor_urls: TEXT[] (already exists in questionnaire as "admired_websites")
  Rename/relabel: "List up to 3 competitor websites in your industry"
  (These become the crawl targets for Path B. Max 3.)

- content_tone_samples: TEXT
  "Paste a paragraph from any website, email, or brochure that sounds like your brand"
  (Raw text input. Even one paragraph gives the AI a voice anchor.)

- content_topics: TEXT[]
  "What topics should your website cover? List 5-10 subjects you want to be known for."

- local_areas: TEXT[]
  "What suburbs, cities, or regions do you serve?"
  (Feeds into local SEO keyword generation)
```

These fields are **optional** — the system works without them but produces better output with them. The default Webkit questionnaire template includes them; agency-created templates may or may not.

### Path B Pipeline

```
1. Agency creates client + sends questionnaire
2. Client completes questionnaire (including competitor URLs)
3. Agency triggers "Content Intelligence" for this client
4. System detects: no client website URL → Path B mode
   ┌──────────────────────────────────────────────────┐
   │ Path B: New Website                               │
   │                                                   │
   │ a. Crawl competitor sites (up to 3, 15 pages ea)  │
   │    - Core pages only: homepage, about, services,  │
   │      key blog posts. Skip policies, legal, etc.   │
   │ b. Classify competitor pages                      │
   │ c. Extract competitor content themes              │
   │ d. Run keyword research for client industry       │
   │    (DataForSEO: keyword_suggestions,              │
   │     keyword_ideas, competitors_domain)             │
   │ e. Build competitive landscape profile            │
   │ f. Build brand voice from questionnaire data      │
   │    (tone samples, personality, industry)          │
   │ g. Generate recommended site structure            │
   │ h. Generate copy for each recommended page        │
   └──────────────────────────────────────────────────┘
5. Agency reviews generated site structure + copy
6. Edit, approve, export for development handoff
```

### Brand Voice Profile: Two Sources

The `brand_profiles.profile` JSONB structure is the same regardless of source. The `generated_by` field tracks origin:

```
generated_by: 'scrape'          → Path A: built from scraped website content
generated_by: 'questionnaire'   → Path B: built from questionnaire + consultation data
generated_by: 'hybrid'          → Path A with questionnaire enhancements
generated_by: 'manual'          → Agency manually created/edited
```

**Path A generation prompt context:**
- 10-15 best pages from scraped content
- Questionnaire data (if available) for strategic intent

**Path B generation prompt context:**
- Questionnaire: brand personality, tone preferences, content tone samples
- Consultation: industry, goals, target audience, admired websites
- Competitor content themes (from competitor crawls)
- Industry norms (from keyword research)

**Path A+B hybrid (recommended for site revamps):**
When a client has BOTH an existing site AND completed a questionnaire, the profiler merges both inputs. The questionnaire captures where the client *wants* to go; the scraped content captures where they *are*. The profile notes divergences — e.g., "Current tone is formal/corporate but questionnaire indicates desire for approachable/friendly."

---

## Database Schema

### Changes from V1

- Added `embedding_model` to `content_chunks` (future-proofs model migration)
- Added `source_type` to `brand_profiles` ('scrape', 'questionnaire', 'hybrid', 'manual')
- Added `questionnaire_id` and `consultation_id` to `brand_profiles` (links to input data)
- Simplified `content_copy.status` to two states: 'draft' and 'final'
- Removed all social media tables (deferred)
- Removed `social_accounts`, `social_posts`, `social_templates` tables
- Added `competitor_crawl_jobs` linking table

### Core Tables

```sql
-- ============================================================
-- CONTENT INTELLIGENCE: Core Tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Tracks crawl/import jobs per client (or per competitor)
CREATE TABLE IF NOT EXISTS content_crawl_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    client_id UUID NOT NULL REFERENCES clients(id),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'crawling', 'extracting',
                          'classifying', 'embedding', 'profiling',
                          'complete', 'failed')),

    source_url TEXT NOT NULL,
    crawl_target TEXT NOT NULL DEFAULT 'client'
        CHECK (crawl_target IN ('client', 'competitor')),

    -- Progress tracking (enables resumability)
    pages_discovered INTEGER DEFAULT 0,
    pages_processed INTEGER DEFAULT 0,
    pages_changed INTEGER DEFAULT 0,
    max_depth INTEGER DEFAULT 3,

    crawl_type TEXT NOT NULL DEFAULT 'full'
        CHECK (crawl_type IN ('full', 'incremental', 'targeted')),

    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_client ON content_crawl_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON content_crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_agency ON content_crawl_jobs(agency_id);

-- Individual scraped pages (client or competitor)
CREATE TABLE IF NOT EXISTS content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    crawl_job_id UUID REFERENCES content_crawl_jobs(id),

    url TEXT NOT NULL,
    canonical_url TEXT,
    source_type TEXT NOT NULL DEFAULT 'client'
        CHECK (source_type IN ('client', 'competitor')),
    competitor_domain TEXT,              -- Set when source_type = 'competitor'

    page_type TEXT NOT NULL DEFAULT 'unknown'
        CHECK (page_type IN ('homepage', 'about', 'service', 'product',
                             'blog_post', 'case_study', 'testimonial',
                             'contact', 'team', 'faq', 'landing',
                             'category', 'portfolio', 'news', 'other', 'unknown')),
    classification_confidence REAL DEFAULT 0,
    classification_method TEXT
        CHECK (classification_method IN ('url_pattern', 'html_structure', 'llm', 'manual')),

    -- Extracted content
    title TEXT,
    meta_description TEXT,
    h1_tags TEXT[],
    h2_tags TEXT[],
    body_text TEXT,
    markdown_content TEXT,
    word_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER DEFAULT 0,

    -- Technical metadata
    http_status INTEGER,
    content_hash TEXT,                   -- SHA-256 of body_text for change detection
    schema_types TEXT[],
    has_canonical BOOLEAN DEFAULT FALSE,
    has_robots_meta BOOLEAN DEFAULT FALSE,
    robots_directives TEXT,
    internal_links_count INTEGER DEFAULT 0,
    external_links_count INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    images_missing_alt INTEGER DEFAULT 0,

    -- Timestamps
    first_scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(client_id, url)
);

CREATE INDEX IF NOT EXISTS idx_content_pages_client ON content_pages(client_id);
CREATE INDEX IF NOT EXISTS idx_content_pages_type ON content_pages(client_id, page_type);
CREATE INDEX IF NOT EXISTS idx_content_pages_source ON content_pages(client_id, source_type);

-- Content chunks for RAG (vector embeddings)
CREATE TABLE IF NOT EXISTS content_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES content_pages(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    summary TEXT,

    -- Embedding with model versioning
    embedding vector(768),
    embedding_model TEXT NOT NULL DEFAULT 'bge-base-en-v1.5',

    metadata JSONB DEFAULT '{}',        -- page_type, section_heading, source_type, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_client ON content_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_chunks_page ON content_chunks(page_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON content_chunks
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);

-- Brand voice profiles per client
CREATE TABLE IF NOT EXISTS brand_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Structured brand voice profile (generated by AI)
    profile JSONB NOT NULL,
    /*
    {
      "personality_traits": ["Confident", "Professional", "Approachable"],
      "tone_guidelines": {
        "default": "Warm and knowledgeable",
        "promotional": "Enthusiastic but not salesy",
        "educational": "Clear and authoritative"
      },
      "vocabulary": {
        "formality_level": "semi-formal",
        "industry_jargon": ["terms", "they", "use"],
        "avoided_terms": ["terms", "they", "never", "use"],
        "signature_phrases": ["phrases", "they", "repeat"]
      },
      "sentence_structure": {
        "avg_length": "medium",
        "active_passive": "predominantly_active",
        "uses_contractions": true
      },
      "messaging_pillars": [
        { "theme": "Quality craftsmanship", "evidence": "..." }
      ],
      "constraints": {
        "always": ["Use Australian spelling", "Reference local areas"],
        "never": ["Use American spelling", "Make unsubstantiated claims"]
      },
      "competitive_positioning": {
        "differentiators": ["..."],
        "industry_norms": ["..."],
        "gaps_to_fill": ["..."]
      }
    }
    */

    -- Source tracking
    source_type TEXT NOT NULL DEFAULT 'scrape'
        CHECK (source_type IN ('scrape', 'questionnaire', 'hybrid', 'manual')),
    source_page_ids UUID[],
    source_page_count INTEGER,
    questionnaire_id UUID,              -- Links to questionnaire_responses or form_submissions
    consultation_id UUID REFERENCES consultations(id),

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(client_id, version)
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_client ON brand_profiles(client_id);

-- ============================================================
-- SEO AUDIT: Tables (unchanged from V1)
-- ============================================================

CREATE TABLE IF NOT EXISTS seo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    crawl_job_id UUID REFERENCES content_crawl_jobs(id),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'complete', 'failed')),

    overall_score INTEGER,
    technical_score INTEGER,
    content_score INTEGER,
    backlink_score INTEGER,
    keyword_score INTEGER,

    total_pages INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    warning_issues INTEGER DEFAULT 0,
    passed_checks INTEGER DEFAULT 0,
    opportunities INTEGER DEFAULT 0,

    audit_config JSONB DEFAULT '{}',
    competitor_domains TEXT[],

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_audits_client ON seo_audits(client_id);

CREATE TABLE IF NOT EXISTS seo_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES seo_audits(id) ON DELETE CASCADE,
    page_id UUID REFERENCES content_pages(id),
    client_id UUID NOT NULL REFERENCES clients(id),

    category TEXT NOT NULL
        CHECK (category IN ('technical', 'content', 'meta', 'structure',
                            'performance', 'mobile', 'accessibility',
                            'backlinks', 'keywords', 'schema', 'internal_links')),
    severity TEXT NOT NULL
        CHECK (severity IN ('critical', 'warning', 'info', 'opportunity')),
    check_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    current_value TEXT,
    recommended_value TEXT,
    impact TEXT,

    ai_fix_available BOOLEAN DEFAULT FALSE,
    ai_fix_content TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_issues_audit ON seo_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_seo_issues_severity ON seo_issues(audit_id, severity);

CREATE TABLE IF NOT EXISTS backlink_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    audit_id UUID NOT NULL REFERENCES seo_audits(id) ON DELETE CASCADE,

    total_backlinks INTEGER DEFAULT 0,
    referring_domains INTEGER DEFAULT 0,
    dofollow_links INTEGER DEFAULT 0,
    nofollow_links INTEGER DEFAULT 0,
    domain_rank REAL,
    spam_score REAL,

    top_referring_domains JSONB DEFAULT '[]',
    anchor_text_distribution JSONB DEFAULT '[]',
    link_type_distribution JSONB DEFAULT '{}',
    new_lost_trend JSONB DEFAULT '[]',

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlink_profiles_client ON backlink_profiles(client_id);

CREATE TABLE IF NOT EXISTS keyword_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    audit_id UUID NOT NULL REFERENCES seo_audits(id) ON DELETE CASCADE,

    ranking_keywords JSONB DEFAULT '[]',
    keyword_gaps JSONB DEFAULT '[]',
    cannibalization JSONB DEFAULT '[]',

    total_ranking_keywords INTEGER DEFAULT 0,
    keywords_top_3 INTEGER DEFAULT 0,
    keywords_top_10 INTEGER DEFAULT 0,
    keywords_top_50 INTEGER DEFAULT 0,
    total_keyword_gaps INTEGER DEFAULT 0,
    estimated_traffic INTEGER DEFAULT 0,

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keyword_profiles_client ON keyword_profiles(client_id);

CREATE TABLE IF NOT EXISTS competitor_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    audit_id UUID REFERENCES seo_audits(id) ON DELETE CASCADE,

    competitor_domain TEXT NOT NULL,
    crawl_job_id UUID REFERENCES content_crawl_jobs(id),

    domain_rank REAL,
    total_backlinks INTEGER,
    referring_domains INTEGER,
    total_ranking_keywords INTEGER,
    estimated_traffic INTEGER,
    common_keywords INTEGER,
    unique_keywords INTEGER,

    -- Content analysis (from competitor crawl)
    content_themes JSONB DEFAULT '[]',       -- Main topics/themes found
    page_structure JSONB DEFAULT '{}',       -- Page types and counts
    avg_word_count INTEGER,
    content_quality_notes TEXT,              -- AI-generated summary

    comparison JSONB DEFAULT '{}',

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_client ON competitor_analyses(client_id);

-- ============================================================
-- CONTENT GENERATION: Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS content_copy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    page_id UUID REFERENCES content_pages(id),
    generated_by UUID REFERENCES users(id),

    copy_type TEXT NOT NULL
        CHECK (copy_type IN ('page_rewrite', 'new_page', 'meta_title',
                             'meta_description', 'h1_suggestion', 'section',
                             'blog_post', 'product_description', 'cta',
                             'site_structure')),

    title TEXT,
    content TEXT NOT NULL,
    target_keyword TEXT,
    target_word_count INTEGER,
    actual_word_count INTEGER,

    seo_score INTEGER,
    readability_score REAL,

    -- Simplified two-state workflow
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'final')),

    -- Generation metadata
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    model_used TEXT,
    generation_config JSONB DEFAULT '{}',

    -- Context tracking (what inputs were used)
    context_sources JSONB DEFAULT '{}',
    /*
    {
      "brand_profile_id": "uuid",
      "brand_source": "hybrid",
      "rag_chunks_used": 5,
      "seo_issues_referenced": 3,
      "questionnaire_id": "uuid",
      "consultation_id": "uuid",
      "competitor_domains_referenced": ["competitor1.com", "competitor2.com"]
    }
    */

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_copy_client ON content_copy(client_id);
CREATE INDEX IF NOT EXISTS idx_content_copy_page ON content_copy(page_id);
CREATE INDEX IF NOT EXISTS idx_content_copy_status ON content_copy(status);
```

---

## External API Integration

### Cloudflare Browser Rendering (Page Extraction)

Already within Webkit's Cloudflare ecosystem. Used as the rendering backend for Colly.

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/markdown` | Page → clean LLM-ready markdown | Primary content extraction |
| `/links` | Discover all outbound URLs | URL discovery for crawl frontier |
| `/scrape` | Extract via CSS selectors | Targeted extraction (testimonials, products) |
| `/json` | AI-powered structured extraction | Extract specific fields (prices, team members) |

**Pricing:** Workers Paid ($5/mo): 10 hours/month free. Overage $0.09/hour.

### Jina Reader (Fallback Extractor)

Prepend `https://r.jina.ai/` to any URL → get clean markdown. Zero config.

**Use for:** Fallback when CF Browser Rendering fails (anti-bot, timeouts). ~$0.02/million tokens.

### DataForSEO (SEO Data) — Path A Only

Pure pay-as-you-go, no minimum commitment.

| API | Purpose | Est. Cost/Client |
|-----|---------|-----------------|
| On-Page API | Technical SEO audit | ~$0.50 |
| Backlinks API | Backlink profile analysis | ~$0.80 |
| DataForSEO Labs | Keyword research + competitor gaps | ~$1.20 |
| Keywords Data API | Search volume + CPC | ~$0.30 |

**Total per full audit: ~$2.80** (reduced from V1 estimate — no SERP API needed in V2)

For Path B clients (no site), only keyword research + competitor analysis APIs are used (~$1.50/client).

### Anthropic API (AI Generation) — Existing Integration

**Models:**
- Claude Sonnet: Brand profiling, copy generation, SEO recommendations
- Claude Haiku: Page classification, meta descriptions, quick scoring

**Prompt caching:** Brand profile cached as system prompt. Subsequent calls read at 0.1× rate. ~75% savings on repeat calls per client.

### Workers AI (Embeddings) — Existing Infrastructure

`@cf/baai/bge-base-en-v1.5` — 768 dimensions, free on Workers Paid.

---

## Feature Specifications

### Feature 1: Website Content Import & Brand Profiling

#### Path A: Existing Website

1. Agency navigates to `/[agencySlug]/content/import`
2. Selects client, enters website URL
3. System validates URL, fetches robots.txt
4. **Crawl:** Colly orchestrates, CF Browser Rendering extracts
   - Sitemap.xml parsed first (if available)
   - Link discovery via `/links` for pages not in sitemap
   - Max depth: 3 (configurable). Max pages: 200 (safety limit)
5. **Classify:** Three-layer classification on each page
6. **Chunk:** Body text → 400-600 token chunks, 15% overlap
7. **Embed:** Chunks → Workers AI → pgvector
8. **Profile:** Top 10-15 pages + questionnaire data (if available) → Claude Sonnet → brand profile
9. Dashboard shows: all pages, types, brand profile, content stats

#### Path B: New Website

1. Agency navigates to `/[agencySlug]/content/import`
2. Selects client (no website URL) → system detects Path B
3. **Gather context:** Pull questionnaire + consultation data for this client
4. **Crawl competitors:** Up to 3 competitor URLs from questionnaire (15 core pages each)
   - Same crawl pipeline as Path A but tagged as `source_type: 'competitor'`
5. **Keyword research:** DataForSEO keyword_suggestions + keyword_ideas for industry + location
6. **Competitive landscape:** Analyse competitor content themes, page structures, word counts
7. **Profile:** Questionnaire data + competitor themes → Claude Sonnet → brand profile
8. **Generate site structure:** Recommended pages based on competitor analysis + industry norms
9. Dashboard shows: competitor analysis, brand profile, recommended site structure, keyword opportunities

#### Three-Layer Page Classification (unchanged from V1)

```
Layer 1: URL pattern matching (~70% accuracy, free)
Layer 2: HTML structure analysis (~80% accuracy, free)
Layer 3: LLM classification via Haiku (~95% accuracy, ~$0.0004/page)
  → Only fires for pages not confidently classified by layers 1-2
```

#### Re-Crawl Strategy (Simplified from V1)

**Default: Monthly incremental for all clients.**
- Change detection: SHA-256 hash of body_text (not raw HTML)
- On-demand full re-crawl available via UI
- Weekly re-crawl as explicit agency opt-in (shown with estimated cost)
- No automatic HEAD request polling (too unreliable across servers)

---

### Feature 2: SEO Audit (Path A Only)

Unchanged from V1 spec. Key points:

- Combines scraped content analysis + DataForSEO data
- Content SEO checks run against `content_pages` data (no extra API calls)
- Technical checks via DataForSEO On-Page API
- Backlink analysis via DataForSEO Backlinks API
- Keyword research + gaps via DataForSEO Labs API
- Competitor comparison (up to 3 domains, from questionnaire or manual entry)
- Overall score: weighted composite (technical 25%, content 30%, backlinks 25%, keywords 20%)
- PDF report via existing Gotenberg integration

**For Path B clients:** No SEO audit (no site to audit). Instead, the competitor analysis and keyword research provide the strategic context. The "SEO" value for new sites is baked into the copy generation — every generated page targets keywords and follows SEO best practices informed by the competitive research.

---

### Feature 3: AI Copy Generation

#### Context Assembly (Both Paths)

Every generation call assembles context from available sources:

```
Tier 1: Brand Voice Profile (~500-1,000 tokens) — ALWAYS PRESENT
  Path A: from scraped content (+ questionnaire if available)
  Path B: from questionnaire + competitor themes
  Cached via Anthropic prompt caching (system prompt)

Tier 2: Content Context (~1,500-2,500 tokens) — VARIES BY PATH
  Path A: RAG-retrieved chunks from client's own content (pgvector)
  Path B: RAG-retrieved chunks from competitor content + questionnaire brief

Tier 3: SEO Context (~500-1,000 tokens) — WHEN AVAILABLE
  Path A: target keyword + competitor analysis + page issues from audit
  Path B: target keyword + competitor analysis + industry keyword research

Tier 4: Client Brief (~200-500 tokens) — WHEN AVAILABLE
  Consultation data: goals, challenges, target audience, conversion goals
  Questionnaire data: required pages, feature requirements, content topics
```

#### Copy Types

| Copy Type | Available In | Input | Output |
|-----------|-------------|-------|--------|
| Page rewrite | Path A | Existing page + SEO issues + keyword | Improved copy in brand voice |
| New page | Both | Purpose + keyword + brand profile | Full page copy with headings |
| Site structure | Path B | Competitor analysis + questionnaire | Recommended pages + hierarchy |
| Meta title | Both | Page content/purpose + keyword | 50-60 char title tag |
| Meta description | Both | Page content/purpose + keyword | 150-160 char description |
| H1 suggestion | Both | Page purpose + keyword | 20-70 char heading |
| Blog post | Both | Topic + keyword + brand profile | 1000-2500 word article |
| Product description | Both | Product details + brand voice | 150-400 words |

#### Copy Audit Workflow (Path A)

1. View all pages with content quality scores
2. Per-page view: current content, SEO issues, keyword analysis
3. "Generate improved copy" → AI with full context
4. Side-by-side diff: original vs. generated
5. Edit in place → mark as final
6. Bulk generation for all flagged pages
7. Export as structured document for handoff

#### Copy Generation Workflow (Path B)

1. View recommended site structure (generated from competitor + questionnaire analysis)
2. Adjust page list: add/remove/rename pages
3. Per-page: set target keyword (suggested from research), purpose, notes
4. "Generate copy" → AI uses brand profile + competitor context + keyword data
5. Edit in place → mark as final
6. Export as structured document for development handoff

---

### Feature 4: Content Export

#### Per-Page Structured Content

Generated copy is stored per-page with structured sections. Each page's content follows a consistent structure that maps to common website layouts:

```json
{
  "page_slug": "services/web-design",
  "page_type": "service",
  "target_keyword": "web design Brisbane",
  "meta": {
    "title": "Professional Web Design Brisbane | Agency Name",
    "description": "Award-winning web design in Brisbane..."
  },
  "sections": [
    {
      "type": "hero",
      "heading": "...",
      "subheading": "...",
      "cta_text": "...",
      "cta_url": "/contact"
    },
    {
      "type": "intro",
      "body": "..."
    },
    {
      "type": "services_list",
      "heading": "...",
      "items": [
        { "title": "...", "description": "...", "icon_suggestion": "..." }
      ]
    },
    {
      "type": "cta_banner",
      "heading": "...",
      "body": "...",
      "cta_text": "...",
      "cta_url": "..."
    },
    {
      "type": "testimonial",
      "placeholder": true,
      "note": "Add client testimonial here"
    },
    {
      "type": "faq",
      "heading": "...",
      "items": [
        { "question": "...", "answer": "..." }
      ]
    }
  ],
  "word_count": 850,
  "seo_notes": "Primary keyword used 3x. H1 contains keyword. Internal links to /about and /contact."
}
```

Section types supported: `hero`, `intro`, `services_list`, `features_grid`, `cta_banner`, `testimonial`, `faq`, `team`, `process_steps`, `pricing`, `portfolio`, `stats`, `body_text`, `sidebar`. Not every page uses every type — the AI selects appropriate sections based on page purpose.

#### Export Formats

Three export options via `POST /api/content/copy/export/:clientId`:

**1. Markdown (`.md` per page, bundled as `.zip`)**
Default developer handoff format. Each page is a separate `.md` file with YAML frontmatter:

```markdown
---
title: "Professional Web Design Brisbane"
slug: services/web-design
page_type: service
target_keyword: web design Brisbane
meta_title: "Professional Web Design Brisbane | Agency Name"
meta_description: "Award-winning web design in Brisbane..."
---

# Professional Web Design Brisbane

[Hero subheading text...]

**[Get a Free Quote →](/contact)**

## Our Web Design Services

### Responsive Design
[Description...]

### E-Commerce Solutions
[Description...]

---

## Frequently Asked Questions

**Q: How long does a website take?**
A: [Answer...]
```

**2. Word Document (`.docx`)**
For agencies who hand off to non-technical content editors or clients for review. Single document with all pages as chapters, table of contents, page metadata in callout boxes. Generated via existing Gotenberg integration.

**3. Plain Text (`.txt` per page, bundled as `.zip`)**
Minimal format for copy-paste into any CMS. No markup, no frontmatter. Just headings (ALL CAPS) and body text with clear section separators:

```
PAGE: Services - Web Design
TARGET KEYWORD: web design Brisbane
META TITLE: Professional Web Design Brisbane | Agency Name
META DESCRIPTION: Award-winning web design in Brisbane...

========================================

PROFESSIONAL WEB DESIGN BRISBANE

[Hero subheading text...]

CTA: Get a Free Quote → /contact

----------------------------------------

OUR WEB DESIGN SERVICES

Responsive Design
[Description...]

E-Commerce Solutions
[Description...]
```

#### Export Scope Options

- **All final copy** — only pages marked `status: 'final'`
- **All copy** — both draft and final (drafts clearly marked)
- **Single page** — export one page at a time
- **Selected pages** — checkbox selection from copy list

---

### Feature 5: SEO Audit → Proposal Integration

When an agency has run an SEO audit for a client (Path A), the audit summary automatically becomes available as a data source for proposal generation. This turns the audit into an upsell tool — the agency can show the client what's wrong and propose fixing it.

#### How It Works

1. Agency runs SEO audit for a client (Feature 2)
2. Audit completes with scores and issues
3. Agency creates or edits a proposal for the same client
4. Proposal generator detects available SEO audit data
5. An "SEO Summary" section is offered as an optional proposal block
6. If included, the section is auto-generated from audit data

#### Proposal SEO Summary Section

The generated section uses traffic-light indicators for quick visual scanning:

```
SEO Health Summary for [client domain]
Audited: [date]

Overall Score: 62/100

🔴 Technical SEO: 45/100
   - 12 critical issues (broken links, missing meta tags, slow page speed)
   - Estimated fix effort: 2-3 days

🟡 Content Quality: 58/100
   - 8 pages with thin content (<300 words)
   - 5 pages missing H1 tags
   - Estimated fix effort: 1-2 days copywriting

🟢 Backlink Profile: 72/100
   - 340 referring domains
   - Healthy dofollow/nofollow ratio
   - 3 toxic links to disavow

🟡 Keyword Performance: 63/100
   - Ranking for 89 keywords (12 in top 10)
   - 45 keyword gaps vs. competitors
   - Top opportunity: "web design brisbane" (vol: 2,400, current: not ranking)

Recommended Actions:
1. Fix 12 critical technical issues (priority: immediate)
2. Rewrite 8 thin content pages with SEO-optimized copy
3. Target 10 high-opportunity keyword gaps
4. Disavow 3 toxic backlinks

Estimated Impact: +35-50% organic traffic within 6 months
```

#### Implementation

- **Data source:** `seo_audits` + `seo_issues` tables (already populated by Feature 2)
- **Generation:** Claude Haiku summarises the audit data into proposal-friendly language
- **Insertion point:** Proposals already support sections/blocks — this is a new block type `seo_summary`
- **Editable:** Agency can edit the generated summary before including in proposal
- **No extra API calls:** All data already exists from the audit; this is just a presentation layer

#### UX Flow

In the proposal editor, when SEO audit data exists for the client:
- A badge appears: "SEO audit available — add to proposal?"
- Clicking it generates and inserts the SEO summary section
- The section is editable like any other proposal block
- Traffic-light indicators render as colored badges in the proposal PDF/view

---

## Tenant Isolation Architecture (content-service)

### Current Webkit Pattern

The existing Webkit services use a two-layer auth model:

**Layer 1 — Go Backend (service-core):**
- Validates JWT on every request
- JWT contains: `user_id`, `access` (permission bits), `email`, `avatar`, `subscription_active`
- JWT does NOT contain `agency_id`
- Go middleware stores user in request context
- Go does not enforce agency-level data isolation (it doesn't know which agency)

**Layer 2 — SvelteKit (service-client):**
- Validates JWT (same token)
- Resolves agency from cookie → default agency → first membership via `getAgencyContext()`
- Verifies user is a member of the agency on every request
- All database queries use `withAgencyScope(agencyId, ...)` helper
- Agency ID is never trusted from client input — always resolved server-side

### content-service Auth Pattern

The new `content-service` Go microservice follows a hybrid approach: it receives requests from SvelteKit (which has already validated agency membership) but also validates independently.

**Request flow:**
```
Browser → SvelteKit → content-service (Go)
                ↓               ↓
         validates JWT    validates JWT
         resolves agency  validates agency_id header
         checks membership
         passes agency_id
         in X-Agency-ID header
```

**content-service middleware:**

```go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. Validate JWT (same as service-core)
        token := r.Header.Get("Authorization")
        claims, err := auth.ValidateAccessToken(token)
        if err != nil {
            http.Error(w, "unauthorized", 401)
            return
        }

        // 2. Read agency_id from header (set by SvelteKit)
        agencyID := r.Header.Get("X-Agency-ID")
        if agencyID == "" {
            http.Error(w, "missing agency context", 400)
            return
        }

        // 3. Verify user is member of this agency
        //    (prevents SvelteKit bypass or direct API access)
        isMember, err := db.CheckAgencyMembership(claims.ID, agencyID)
        if err != nil || !isMember {
            http.Error(w, "forbidden", 403)
            return
        }

        // 4. Store both in context
        ctx := context.WithValue(r.Context(), "user_id", claims.ID)
        ctx = context.WithValue(ctx, "agency_id", agencyID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Every database query in content-service scopes by `agency_id`:**

```go
// All queries MUST include agency_id WHERE clause
func GetClientPages(ctx context.Context, clientID, agencyID uuid.UUID) ([]ContentPage, error) {
    return db.Query(`
        SELECT * FROM content_pages cp
        JOIN clients c ON cp.client_id = c.id
        WHERE cp.client_id = $1 AND c.agency_id = $2
    `, clientID, agencyID)
}
```

**Key principles:**
- content-service never trusts agency_id from the request alone — it validates JWT + membership
- All queries join through `clients.agency_id` to ensure data isolation
- Direct API access (bypassing SvelteKit) is possible but requires valid JWT + agency membership
- NATS job messages include `agency_id` — job handlers validate before processing
- Background jobs (re-crawl, scheduled audits) re-validate agency context on execution

---

## API Endpoints (content-service)

### Crawling & Import
```
POST   /api/content/crawl                  # Start crawl (client or competitor)
GET    /api/content/crawl/:jobId           # Job status + progress
POST   /api/content/crawl/:jobId/cancel    # Cancel running crawl
GET    /api/content/pages/:clientId        # List scraped pages (filterable by source_type)
GET    /api/content/pages/:clientId/:pageId # Single page details
PATCH  /api/content/pages/:clientId/:pageId # Manual type override
```

### Brand Profiling
```
GET    /api/content/brand/:clientId        # Active brand profile
POST   /api/content/brand/:clientId/generate # Generate (auto-detects Path A/B)
PUT    /api/content/brand/:clientId        # Manual edit
```

### SEO Audit (Path A only)
```
POST   /api/content/audit/:clientId        # Start audit
GET    /api/content/audit/:auditId         # Results
GET    /api/content/audit/:auditId/issues  # Issues (filterable)
GET    /api/content/audit/:auditId/backlinks
GET    /api/content/audit/:auditId/keywords
GET    /api/content/audit/:auditId/competitors
POST   /api/content/audit/:auditId/report  # Generate PDF
```

### Content Generation
```
POST   /api/content/generate/copy          # Generate copy (single page)
POST   /api/content/generate/meta          # Generate meta title + description
POST   /api/content/generate/structure     # Generate site structure (Path B)
POST   /api/content/generate/bulk          # Bulk generation
GET    /api/content/copy/:clientId         # List generated copy
PATCH  /api/content/copy/:copyId           # Update status/content
DELETE /api/content/copy/:copyId           # Delete draft
POST   /api/content/copy/export/:clientId  # Export all final copy as document
```

All endpoints require `agency_id` scoping via auth middleware (matching Webkit's existing pattern).

---

## Cost Analysis (Revised)

### Per-Client Costs

| Component | Path A (Existing Site) | Path B (New Site) |
|-----------|----------------------|-------------------|
| CF Browser Rendering | ~$0.04 (50 pages) | ~$0.04 (45 competitor pages) |
| DataForSEO | ~$2.80 (full audit) | ~$1.50 (keywords + competitors only) |
| Anthropic (profiling) | ~$0.12 | ~$0.12 |
| Anthropic (copy gen) | ~$1.50 (5 rewrites) | ~$2.50 (10 new pages) |
| Workers AI (embeddings) | ~$0.00 | ~$0.00 |
| R2 storage | ~$0.02 | ~$0.02 |
| **Total per client** | **~$4.48** | **~$4.18** |

### Fixed Monthly Infrastructure

| Component | Monthly Cost |
|-----------|-------------|
| Cloudflare Workers Paid | $5.00 (already paying) |
| PostgreSQL hosting (incremental) | ~$10.00 |
| **Total new fixed costs** | **~$15/month** |

Note: Firecrawl ($83-700/mo) and Ayrshare ($49-599/mo) eliminated. DataForSEO is pure pay-as-you-go with no monthly minimum.

### Revenue Impact

Content Intelligence features justify tier increases:

| Tier | Current | With Content Intelligence | Margin per client |
|------|---------|--------------------------|-------------------|
| Starter | $29/mo | $49/mo | +$20 vs ~$4.50 cost |
| Growth | $79/mo | $129/mo | +$50 vs ~$4.50 cost |

**Break-even:** 1 paying client on any tier covers infrastructure. Margins are excellent.

---

## Development Roadmap (Revised)

### Phase 1: Foundation + Crawl (Weeks 1-5)

- [ ] `content-service` Go microservice scaffolding
- [ ] Database migration (all tables above)
- [ ] Colly integration with CF Browser Rendering custom transport
- [ ] CF Browser Rendering `/markdown` + `/links` client (`pkg/cfbrowser/`)
- [ ] Jina Reader fallback client (`pkg/jina/`)
- [ ] Sitemap.xml parser
- [ ] Three-layer page classification pipeline
- [ ] Content chunking (400-600 tokens, 15% overlap)
- [ ] Workers AI embedding pipeline (pgvector)
- [ ] NATS job queue for crawl pipeline
- [ ] Brand voice profile generation
  - [ ] Path A: from scraped content
  - [ ] Path B: from questionnaire + consultation data
  - [ ] Hybrid: merged inputs
- [ ] Questionnaire extensions (optional content strategy fields)
- [ ] R2 storage for markdown snapshots
- [ ] SvelteKit: `/content/import` (both paths)
- [ ] SvelteKit: `/content/[clientId]/pages`
- [ ] SvelteKit: `/content/[clientId]/brand` profile viewer/editor

### Phase 2: SEO Audit (Weeks 6-9)

- [ ] DataForSEO Go client (`pkg/dataforseo/`)
- [ ] On-Page API integration
- [ ] Backlinks API integration
- [ ] DataForSEO Labs integration (keywords + gaps)
- [ ] Content SEO checks (from scraped content — no API needed)
- [ ] Competitor crawl pipeline (crawl competitors, analyse themes)
- [ ] Competitor comparison (DataForSEO + content analysis)
- [ ] SEO score calculation engine
- [ ] NATS job queue for audit pipeline
- [ ] SvelteKit: audit pages (overview, technical, content, backlinks, keywords, competitors)
- [ ] PDF report generation via Gotenberg

### Phase 3: AI Copy Generation (Weeks 10-13)

- [ ] RAG retrieval pipeline (pgvector similarity search)
- [ ] Context assembly module (brand + RAG + SEO + brief)
- [ ] Copy generation prompts (all types in capability matrix)
- [ ] Path A: page-by-page copy audit + rewrite
- [ ] Path B: site structure generation + new page copy
- [ ] Side-by-side diff view (Path A)
- [ ] In-place editing + status tracking
- [ ] Bulk generation
- [ ] Export to structured document (Word/PDF via Gotenberg)
- [ ] SvelteKit: `/content/[clientId]/copy/audit` and `/copy/generate`

### Post-Phase 3: Stabilise + Iterate

- [ ] Performance tuning (pgvector HNSW parameters, NATS throughput)
- [ ] Re-crawl scheduling (monthly default, opt-in weekly)
- [ ] Change detection notifications
- [ ] Proposal enrichment (feed content intelligence into proposal generation)
- [ ] User feedback → iterate on generation quality

---

## Risk Assessment (Revised)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CF Browser Rendering rate limits during bulk crawls | High | Medium | NATS queue with 10 concurrent max; backoff on 429s |
| Brand profile quality varies by input quality | High | Medium | Hybrid mode (scrape + questionnaire); manual editing always available |
| DataForSEO API reliability | Medium | Medium | Cache all responses; retry with exponential backoff |
| Copy generation quality inconsistency | Medium | Medium | Always human-in-the-loop; never auto-publish |
| pgvector performance | Low | Low | ~25k vectors at 50 clients — well within comfortable range |
| Colly maintenance/breaking changes | Low | Low | Thin wrapper; could swap for raw HTTP + custom queue if needed |
| CF Browser Rendering pricing changes | Low | Medium | Jina Reader as full fallback; extraction logic abstracted behind interface |

---

## What NOT to Build (V2)

| Feature | Reason | Alternative |
|---------|--------|-------------|
| Social media publishing | Deferred to future spec. Not core to content intelligence value. | Phase 4 spec (future) |
| Social content calendar | Deferred. Agencies already use Hootsuite/Buffer. | Phase 4 spec (future) |
| Rank tracking over time | Adds ongoing DataForSEO cost; not needed for one-time audits | SE Ranking, AccuRanker |
| Link building outreach | Different workflow entirely | Pitchbox, BuzzStream |
| Full CMS | Agencies already have WordPress/Webflow | Existing CMS tools |
| Image generation | External tools more capable | Canva, DALL-E |
| Full approval workflow for copy | Overkill for 1-3 person agencies in V1 | Add when agencies request it |
| Automatic re-crawl scheduling | Monthly manual trigger is sufficient for V1 | Add cron-based scheduling later |
| Ad campaign management | Different domain | Meta Ads, Google Ads |

---

## Resolved Decisions

All questions from the initial V2 draft have been resolved:

| # | Question | Decision |
|---|----------|----------|
| 1 | Questionnaire extension approach | New page/section appended to existing Full Website Questionnaire — not a separate form. Agencies can create their own templates via form builder. System consumes responses generically. |
| 2 | Competitor crawl limits | Max 3 competitors, 15 core pages each (homepage, about, services, key blog posts). Skip policies, legal, etc. |
| 3 | Content export format | Three formats: Markdown (.md per page, .zip bundle), Word (.docx single document), Plain text (.txt per page, .zip bundle). Per-page structured content with hero/CTAs/services/FAQ sections. |
| 4 | SEO audit in proposals | Audit summary auto-generates a proposal section with traffic-light indicators per category. Upsell tool for agencies. New proposal block type: `seo_summary`. |
| 5 | Multi-language support | English only for V2. Multi-language deferred. |
| 6 | Tenant isolation | content-service validates JWT + agency membership on every request. All queries scope by `agency_id`. SvelteKit passes agency context via `X-Agency-ID` header. See "Tenant Isolation Architecture" section. |

---

## Wave 1 Foundation — Completed (2026-02-20)

All 5 foundation pieces built and committed (`11d3db9` on `feature/content-intelligence`):

- **Agent A**: Migration `021_content_intelligence.sql` (10 tables, pgvector, HNSW index) + Drizzle schema
- **Agent B**: Go `content-service` scaffold (26 routes, auth middleware, Dockerfile)
- **Agent C**: `app/pkg/cfbrowser/` + `app/pkg/jina/` Go clients
- **Agent D**: `app/pkg/dataforseo/` Go client (on-page, backlinks, keywords, labs)
- **Agent E**: `workers/browser-rendering/` Cloudflare Worker (Puppeteer)

### Follow-ups before Wave 2

- [ ] Add `content` service block to `docker-compose.production.yml` before deploying
- [ ] Add unit tests for `app/pkg/cfbrowser/` and `app/pkg/dataforseo/` packages
- [ ] Generate `public.pem` via setup script for JWT validation in content-service
