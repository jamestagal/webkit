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

	seoSummary: `Generate an SEO health summary as a structured JSON object based on the SEO audit data provided.

If SEO audit data is available, return a JSON object with this exact structure:
{
  "overallScore": <number 0-100>,
  "overallAssessment": "<1-2 sentence plain-text business assessment of what the overall score means>",
  "categories": [
    {
      "name": "Technical SEO",
      "score": <number 0-100>,
      "status": "<green if 80-100, yellow if 50-79, red if 0-49>",
      "description": "<1-2 sentence plain-text explanation of what this score means for the business>"
    },
    { "name": "Content Quality", "score": ..., "status": ..., "description": ... },
    { "name": "Backlink Profile", "score": ..., "status": ..., "description": ... },
    { "name": "Keyword Performance", "score": ..., "status": ..., "description": ... }
  ],
  "criticalIssues": [
    { "title": "<issue name from audit>", "impact": "<1 sentence business impact>" }
  ],
  "recommendations": [
    { "action": "<bold action title>", "detail": "<1-2 sentence explanation>" }
  ]
}

Guidelines:
- overallAssessment: Focus on business impact, not technical jargon
- categories: Always include all 4 categories. Use scores from audit data. Status must be "green", "yellow", or "red"
- criticalIssues: Reference specific issues from the audit by name. Include 2-5 issues
- recommendations: 2-3 prioritised actions. Lead with the highest-impact recommendation
- All text values should be plain text (no HTML, no markdown)

If NO SEO audit data is available, return:
{
  "overallScore": 0,
  "overallAssessment": "A comprehensive SEO audit has not yet been conducted for this website. We recommend running a full audit as the first step to identify opportunities for improvement.",
  "categories": [],
  "criticalIssues": [],
  "recommendations": [{ "action": "Run a comprehensive SEO audit", "detail": "This will identify technical issues, content gaps, and keyword opportunities specific to your business." }]
}`,

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
