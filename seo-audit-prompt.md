# Comprehensive SEO Audit Prompt — plentify.au

> Use this prompt with an AI assistant that has web browsing, search, and document creation capabilities.

---

## The Prompt

Please conduct a comprehensive, independent SEO audit of **https://plentify.au/** — a plumbing services business based in Melbourne, Australia. Analyze every publicly accessible page on the site and produce a single combined deliverable containing all three sections described below.

---

### Part 1: Technical SEO Audit

Crawl and analyze the full site for technical health. Cover each of the following areas with specific findings, evidence (URLs, screenshots where possible), and severity ratings (Critical / Warning / Info / Opportunity).

**Crawlability & Indexing**
- Check robots.txt and XML sitemap(s) — are they present, valid, and submitted to Google Search Console?
- Identify orphan pages (pages not linked from the main navigation or internal links)
- Check for noindex/nofollow tags that may be accidentally blocking important pages
- Verify canonical tags are correct and consistent (no self-referencing issues, no conflicting canonicals)
- Check for redirect chains, redirect loops, and unnecessary 301/302 redirects
- Identify any 404 errors, soft 404s, or broken internal links
- Check hreflang implementation if multi-language/region targeting exists

**Site Speed & Core Web Vitals**
- Run Lighthouse / PageSpeed Insights on the homepage AND at least 2 inner pages (a service page and a contact/about page)
- Report on all three Core Web Vitals: LCP, INP (Interaction to Next Paint), CLS
- Identify the top 3-5 specific performance bottlenecks (e.g., unoptimized images, render-blocking JS, excessive DOM size, no lazy loading)
- Check if images use modern formats (WebP/AVIF) and have proper width/height attributes
- Evaluate server response time (TTFB)
- Check for proper caching headers and CDN usage

**Mobile-Friendliness**
- Test responsive design across mobile breakpoints
- Check tap target sizes, font readability, and viewport configuration
- Identify any horizontal scroll issues or content overflow
- Verify mobile menu functionality and usability

**Security & Infrastructure**
- Verify HTTPS implementation (mixed content issues, certificate validity)
- Check HTTP security headers (HSTS, X-Content-Type-Options, CSP, etc.)
- Assess URL structure cleanliness (readable, consistent, no excessive parameters)

**Structured Data & Rich Results**
- Check for Schema.org markup (LocalBusiness, Service, FAQPage, BreadcrumbList, etc.)
- Validate any existing structured data for errors/warnings
- Identify opportunities for additional schema that could win rich results (review stars, FAQs, How-To, etc.)

**On-Page Technical Elements (per page)**
- Title tags: length, keyword usage, uniqueness across pages
- Meta descriptions: length, persuasiveness, uniqueness
- Heading hierarchy: proper H1-H6 nesting, single H1 per page, keyword placement
- Image alt text: presence, descriptiveness, keyword relevance
- Internal linking structure and anchor text distribution

---

### Part 2: Content SEO Audit

Analyze the site's content strategy, keyword targeting, and competitive positioning.

**Keyword Analysis**
- Identify the primary keywords the site currently ranks for (or should rank for) based on page content
- For each major service page, assess: target keyword, current optimization level (weak/moderate/strong), search intent match
- Identify keyword cannibalization (multiple pages targeting the same keyword)
- Find missing high-value keywords the site should be targeting but isn't (content gaps)

**Content Quality & Depth**
- Assess thin content pages (under 300 words with no clear purpose)
- Identify pages with duplicate or near-duplicate content
- Evaluate E-E-A-T signals (Experience, Expertise, Authoritativeness, Trustworthiness):
  - Author bios, credentials, certifications mentioned?
  - Real project examples, case studies, before/after?
  - Customer testimonials and reviews integrated?
  - Industry affiliations, licenses, insurance mentioned?
- Check for fresh content signals — when was content last updated? Is there a blog or resource section?

**Topical Authority Assessment**
- Map out the site's topical clusters (e.g., "emergency plumbing", "bathroom renovations", "gas fitting")
- For each cluster, assess coverage depth vs. competitors
- Identify missing supporting content that would build topical authority (e.g., "How to detect a gas leak", "Signs your hot water system needs replacing", "Cost guide: bathroom renovation in Melbourne")
- Recommend a content silo structure if one doesn't exist

**Competitor Content Benchmarking**
- Identify the top 3-5 local competitors ranking for the same keywords
- Compare content depth, page count, and topical coverage
- Note any content types competitors use that plentify.au doesn't (videos, calculators, interactive tools, cost estimators, suburb landing pages)

---

### Part 3: Local SEO Audit

Assess local search visibility and optimization for the Melbourne market.

**Google Business Profile (GBP)**
- Check if a GBP listing exists and is claimed/verified
- Assess completeness: business name, address, phone, website, hours, categories, services, attributes
- Review photo quantity and quality
- Check for Google Posts activity and Q&A
- Assess review quantity, recency, average rating, and owner response rate/quality

**NAP Consistency**
- Verify Name, Address, Phone number consistency between the website, GBP, and major directories
- Check the following citation sources for presence and accuracy:
  - Google Business Profile
  - Apple Maps / Apple Business Connect
  - Bing Places
  - Yellow Pages Australia (yellowpages.com.au)
  - True Local (truelocal.com.au)
  - Hotfrog
  - Word of Mouth (wordofmouth.com.au)
  - Oneflare
  - hipages
  - ServiceSeeking
- Identify any duplicate or conflicting listings

**Local Content & Landing Pages**
- Does the site have suburb/area-specific landing pages? (e.g., "Plumber in Richmond", "Emergency Plumber South Melbourne")
- Assess local keyword optimization in title tags, headings, and content
- Check for embedded Google Maps on contact/location pages
- Evaluate local link building opportunities (local sponsorships, community involvement, local directories)

**Review Strategy**
- Total review count across platforms (Google, Facebook, ProductReview, etc.)
- Compare review volume and rating to top 3 local competitors
- Assess if there's a review generation strategy in place (review links on site, follow-up emails, etc.)

---

### Deliverable Format

Combine everything into a **single comprehensive document** with three major sections:

#### Section A — Audit Scorecard (2-3 pages)
A visual summary matrix scoring each area on a 1-10 scale:

| Category | Score | Priority | Key Finding |
|----------|-------|----------|-------------|
| Crawlability & Indexing | ?/10 | High/Med/Low | One-line summary |
| Site Speed & CWV | ?/10 | ... | ... |
| Mobile-Friendliness | ?/10 | ... | ... |
| Structured Data | ?/10 | ... | ... |
| On-Page SEO | ?/10 | ... | ... |
| Content Quality | ?/10 | ... | ... |
| Topical Authority | ?/10 | ... | ... |
| Local SEO / GBP | ?/10 | ... | ... |
| NAP & Citations | ?/10 | ... | ... |
| Reviews & Reputation | ?/10 | ... | ... |

**Overall SEO Health Score: ??/100**

#### Section B — Detailed Findings Report (10-20 pages)
The full audit findings organized by the three pillars above (Technical, Content, Local). For each issue found, include:
- **What**: Clear description of the issue
- **Where**: Specific URL(s) or page(s) affected
- **Why it matters**: Impact on rankings, traffic, or user experience
- **Evidence**: Data, screenshots, or tool outputs supporting the finding
- **Severity**: Critical / Warning / Info / Opportunity

#### Section C — Actionable Battlecard (2-3 pages)
A prioritized action plan organized by timeframe:

**Quick Wins (Week 1-2)** — High impact, low effort fixes:
- Fix [specific issue] on [specific page]
- Add [specific schema] to [specific pages]
- etc.

**Short-Term (Month 1)** — Important optimizations:
- Create [specific content pieces]
- Optimize [specific pages] for [specific keywords]
- etc.

**Medium-Term (Month 2-3)** — Strategic improvements:
- Build [specific content clusters]
- Implement [specific local SEO strategy]
- etc.

**Long-Term (Month 3-6)** — Competitive advantage plays:
- Develop [specific content assets]
- Build [specific link/citation strategy]
- etc.

Each action item should include: estimated effort (hours), expected impact (High/Med/Low), and the specific category it addresses.

---

### Additional Instructions

- Use real data from actually crawling and analyzing the site — do not fabricate findings
- Compare against competitors actually ranking in Melbourne for plumbing-related searches
- Be specific with URLs, not generic (e.g., "the /services/gas-fitting/ page is missing H1" not "some pages may be missing H1s")
- Include the date of the audit and tools/sources used
- Where possible, include before/after examples for recommended changes (e.g., "Current title tag: X → Recommended: Y")
- Focus on actionable, specific recommendations over generic SEO advice
