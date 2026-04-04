/**
 * Section-Specific Prompts for AI Proposal Generation
 *
 * Each prompt provides specific instructions for generating that section.
 * Placeholders like {industry}, {businessType} are replaced by the prompt builder.
 */

// Re-export shared constants for server-side use
export {
	ALL_SECTIONS,
	SECTION_DISPLAY_NAMES,
	type ProposalSection,
} from "$lib/constants/proposal-sections";

export const SECTION_PROMPTS: Record<string, string> = {
	executiveSummary: `Generate a 2-3 paragraph executive summary that:
- Opens with the client's core business challenge (from their stated challenges)
- Briefly acknowledges their goals
- Positions the proposed solution as the answer
- Ends with a confident but not pushy call to action
- Length: 150-250 words
- IMPORTANT: Plain text only, no markdown formatting`,

	opportunityContent: `Generate market opportunity content that:
- References their specific industry ({industry})
- Highlights why a strong web presence matters for {businessType} businesses
- Uses 1-2 relevant statistics if applicable (do not fabricate - use general knowledge)
- Connects opportunity to their stated goals
- Length: 100-200 words
- IMPORTANT: Plain text only, no markdown formatting (no **bold** or bullet points)`,

	currentIssues: `Analyze and list current website issues based on:
- Their stated primaryChallenges
- PageSpeed audit data (if provided)
- SEO audit data (if provided) — include relevant SEO issues with source "seo-audit"
- Common issues for {websiteStatus} websites

For each issue, provide:
- A clear, non-technical title
- A business-impact focused description (how it affects their customers/revenue)
- Impact level (high/medium/low)
- Source (pagespeed/seo-audit/consultation/inferred)

Generate 3-8 issues, prioritized by impact.`,

	performanceStandards: `Generate website performance improvement targets:

If PageSpeed audit data is provided:
- Focus on metrics that are currently "poor" or "needs-improvement"
- Include the specific current value and target value
- Set realistic targets (don't promise 100 scores)

If NO PageSpeed data is provided:
- Generate 3-5 industry-standard performance targets
- Use typical benchmarks: LCP < 2.5s, CLS < 0.1, INP < 200ms, FCP < 1.8s
- Set current values as "To be measured" and targets based on best practices
- Focus on metrics most relevant to {businessType} websites

Always express improvements in business terms where possible (e.g., "faster load = lower bounce rate").`,

	seoSummary: `Generate an SEO health summary section based on the SEO audit data provided.
Output as structured HTML (not plain text, not markdown).

If SEO audit data is available, structure the output as follows:

1. **Overall score** — An <h3> with the score (e.g. "Overall SEO Score: 85/100") and a one-sentence business assessment in a <p>.

2. **Category breakdown** — One <h4> per category (Technical SEO, Content Quality, Backlink Profile, Keyword Performance). Each <h4> should include the score with a colored <span> indicating status:
   - Score 80-100 (GREEN): <span style="color: #16a34a">GREEN 93/100</span>
   - Score 50-79 (YELLOW): <span style="color: #ca8a04">YELLOW 70/100</span>
   - Score 0-49 (RED): <span style="color: #dc2626">RED 35/100</span>
   Follow each heading with a <p> containing 1-2 sentences explaining what the score means in business terms.

3. **Critical issues** — An <h4>Critical Issues</h4> followed by a <ul> listing specific issues by name with their business impact.

4. **Recommendations** — An <h4>Recommended Actions</h4> followed by an <ol> of 2-3 prioritised improvement actions.

Length: 200-400 words of content.

If NO SEO audit data is available:
- Output a single <p> noting that a comprehensive SEO audit has not yet been conducted and suggesting running one as a first step.

IMPORTANT: Use only these HTML tags: h3, h4, p, ul, ol, li, strong, em, span.
Use inline style="color: ..." on <span> for score colors. Do NOT use class attributes.
Do NOT use markdown formatting.`,

	proposedPages: `Based on the business type ({businessType}), industry ({industry}), and goals, suggest appropriate website pages:
- Include essential pages for this type of business
- Add goal-specific pages (e.g., if goal is "generate leads", include a strong contact/quote page)
- For each page, include a brief purpose description
- Suggest 5-10 pages appropriate for their budget range`,

	timeline: `Generate a realistic project timeline based on:
- Their stated timeline preference ({timeline})
- Their budget range ({budgetRange})
- Typical phases: Discovery, Design, Development, Testing, Launch

Include:
- Phase name
- Duration (in weeks)
- Key deliverables
- Client responsibilities (if any)

Be realistic - don't overpromise speed.`,

	nextSteps: `Generate 3-5 clear next steps for the client, typically:
1. Review and approve this proposal
2. Sign agreement and pay deposit
3. Schedule kickoff call
4. Complete website questionnaire
5. Project begins

Customize based on their urgency level and any notes from consultation.`,

	closingContent: `Generate a personalized closing paragraph that:
- Addresses {contactPerson} by name
- References their main goal
- Expresses genuine interest in helping their business
- Includes a soft call to action
- Length: 50-100 words
- Tone: warm, confident, not salesy
- IMPORTANT: Plain text only, no markdown formatting`,
};
