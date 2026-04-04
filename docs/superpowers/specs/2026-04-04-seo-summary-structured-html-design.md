# SEO Health Summary: Structured HTML Output

**Date:** 2026-04-04
**Status:** Draft

## Problem

The AI generates `seoSummary` as a single plain text blob (200-400 words). When rendered in the public proposal page, it appears as a wall of text with no visual structure. The prompt explicitly says "Plain text only, no markdown formatting."

Since we're pre-release with no legacy content to preserve, we can change the AI output format directly.

## Solution

Update the `seoSummary` prompt to request structured HTML output instead of plain text. The rendering pipeline already supports this — `parseMarkdown()` detects HTML tags and routes through `sanitizeHtml()` (DOMPurify), which allows `h3`, `h4`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `span`, `style`.

No changes needed to: database schema, JSON validation schema, response parser, streaming transformer, public page renderer, or sanitization logic.

## Changes

### 1. Update section prompt

**File:** `service-client/src/lib/server/prompts/proposal-sections.ts` (lines 61-75)

Replace the `seoSummary` prompt. New prompt should instruct the AI to output HTML with:

- **Overall score heading** — `<h3>` with the score and a one-line business assessment
- **Category breakdown** — `<h4>` per category (Technical, Content, Backlinks, Keywords) with colored score indicator using `<span style="color: ...">` and 1-2 sentence explanation
  - GREEN (80-100): `color: #16a34a`
  - YELLOW (50-79): `color: #ca8a04`
  - RED (0-49): `color: #dc2626`
- **Critical issues** — `<ul>` list referencing specific issues by name with business impact
- **Recommendations** — `<h4>` heading + `<ol>` numbered list of 2-3 prioritised actions

When no SEO data is available, output a simple `<p>` placeholder.

Remove the "Plain text only" instruction. Replace with guidance on which HTML tags to use. Explicitly instruct: no `class` attributes (Tailwind classes won't apply inside `{@html}` blocks). Use inline `style` for colors only.

### 2. Update schema hint in prompt builder

**File:** `service-client/src/lib/server/prompts/prompt-builder.ts` (~line 298)

Change the seoSummary schema hint from:
```
"<string content with traffic-light indicators (GREEN/YELLOW/RED)>"
```
To:
```
"<HTML string with h3/h4 headings, colored score spans, ul/ol lists — see section prompt>"
```

## Files to modify

1. `service-client/src/lib/server/prompts/proposal-sections.ts` — rewrite seoSummary prompt
2. `service-client/src/lib/server/prompts/prompt-builder.ts` — update schema hint string

## What stays the same

- `ai-proposal.ts` JSON schema — still `{ type: "string" }`, just contains HTML now
- `response-parser.ts` — still passes string through
- `generate-stream/+server.ts` — no transformation needed
- `proposals.remote.ts` — saves string as-is
- `schema.ts` — `text` column stores HTML fine
- `p/[slug]/+page.svelte` — `parseMarkdown()` already detects and sanitizes HTML
- `sanitize.ts` — already allows all needed tags (h3, h4, p, ul, ol, li, strong, em, span + style attr)

## Verification

1. Run `cd service-client && npm run check`
2. Create/open a proposal with a linked client that has a completed SEO audit
3. Click "Generate with AI" with SEO data toggle enabled
4. Verify the seoSummary in the AI preview modal shows structured content (not a text blob)
5. Apply and save
6. Visit public URL `/p/[slug]` — SEO Health Summary should render with headings, colored scores, and lists
7. Browser print-to-PDF — verify structured layout appears in PDF
8. Test with no SEO audit data — should show a short placeholder paragraph
