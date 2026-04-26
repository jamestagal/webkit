# Content Intelligence — Future Enhancements

Tracked-for-later improvements discovered while working in this area. Not yet
sized into specs; use these as prompts when planning the next content-service
iteration.

---

## Crawler resilience: sitemap-only discovery is fragile

**Observed** — 2026-04-18, smoke test against `suresealrv.com.au`:
- Sitemap parsed successfully with only 3 URLs (`/`, `/privacy-policy/`,
  `/thank-you/`)
- 1 page fetched cleanly (privacy policy via Jina renderer)
- 2 failed with `context deadline exceeded` on both Jina AND direct-HTTP
  fallback (homepage + thank-you)
- Crawl logs: `Crawl completed discovered=1 processed=1 failed=2`
- Re-running the crawl typically succeeds (confirming timeouts are transient)

### Two latent issues exposed

1. **Transient fetch failures leave the crawl record looking healthy.**
   The job completes with `status=complete`, but the user lands on a
   "Pages (1)" page that under-represents the site. The UI can't distinguish
   "site has one page" from "crawl half-failed". Consider surfacing a
   post-crawl summary banner — "X pages crawled, Y failed — Re-crawl?".

2. **Discovery is sitemap-only.** If a site has a weak / missing / stale
   sitemap, the crawler under-discovers even when all fetches succeed. Many
   small business sites don't maintain proper sitemaps. Falling back to
   homepage-link-following when sitemap yields <5 URLs would dramatically
   improve coverage on these sites.

### Suggested improvements (ordered by ROI)

1. **Longer / configurable fetch deadline for the renderer path.** Jina's
   `r.jina.ai` frequently times out on JS-heavy homepages; the current deadline
   is too aggressive for Cloudflare-challenged sites. Per-fetch retry with
   exponential backoff before marking the URL failed.

2. **Homepage-link-following fallback when sitemap discovery is thin.** If
   the sitemap returns <5 URLs, crawl the homepage and follow internal links
   up to `max_depth` as an additional discovery path, deduping against the
   sitemap set.

3. **Crawl-summary telemetry surfaced to the user.** After a crawl completes
   with `failed > 0`, the Pages tab header should show a banner: "N URLs
   couldn't be fetched — retry failed pages" with a button that re-queues
   only the failed set (not a full re-crawl).

4. **Per-URL retry on the failed set.** Today a second crawl re-processes
   everything. A targeted retry of just the failed URLs would be cheaper and
   faster feedback for the user.

5. **Cloudflare-aware fetch path.** If direct HTTP returns a CF challenge
   page, route via the existing `cfbrowser` worker before giving up.

### Where to make the changes

- `app/content-service/internal/crawler/crawler.go` — `Starting crawl` entry
  point; decides discovery strategy.
- `app/content-service/internal/crawler/sitemap.go` — thin-sitemap
  detection.
- `app/content-service/internal/crawler/transport.go` — Jina → direct HTTP
  fallback chain; deadline constants live here.
- `apps/service-client/src/routes/(app)/[agencySlug]/content/[clientId]/pages/+page.svelte`
  — surface the failed-URL count from crawl summary in the header.

### Not in scope for these changes

- Respecting custom `robots.txt` beyond what the current crawler already does
- Rendering strategy for pages that require auth
