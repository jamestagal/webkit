/**
 * Demo Data Constants
 *
 * Fixed demo data for Murray's Plumbing scenario.
 * All entity names are prefixed with "Demo:" for easy identification and cleanup.
 *
 * This data is used by demo.remote.ts to create a complete client journey:
 * Consultation → Proposal → Contract → Questionnaire → Invoice → Quotation
 */

// ============================================================================
// CONSULTATION DATA (v2 - Flat Columns)
// ============================================================================

export const DEMO_CONSULTATION = {
	// Step 1: Contact & Business
	businessName: "Demo: Murray's Plumbing",
	contactPerson: "Steve Murray",
	email: "steve@murraysplumbing.com.au",
	phone: "0412 345 678",
	website: "https://murraysplumbing.com.au",
	socialLinkedin: null as string | null,
	socialFacebook: "https://facebook.com/murraysplumbing",
	socialInstagram: "https://instagram.com/murrays_plumbing_brisbane",
	industry: "construction", // Maps to v2 industry options
	businessType: "small-business", // Maps to v2 business type options

	// Step 2: Situation & Challenges
	websiteStatus: "rebuild" as const,
	primaryChallenges: [
		"lead-generation",
		"seo-issues",
		"outdated-website",
		"poor-mobile",
		"competition",
	],
	urgencyLevel: "high" as const,

	// Step 3: Goals & Budget
	primaryGoals: ["generate-leads", "build-brand", "improve-conversion", "digital-presence"],
	conversionGoal: "form-submissions",
	budgetRange: "5k-10k",
	timeline: "1-3-months" as const,

	// Step 4: Preferences & Notes
	designStyles: ["modern-clean", "corporate-professional"],
	admiredWebsites: ["https://brisbane-plumbing.com.au", "https://jetplumbing.com.au"],
	consultationNotes: `15 years in business, 8 employees. Family-owned with 4.8 star Google rating (127 reviews).

Services: Emergency plumbing, hot water systems, blocked drains, gas fitting, bathroom renovations, commercial maintenance.

Service areas: Brisbane CBD, Northside, Southside, Western Suburbs, Ipswich.

Pain points:
- Only getting 5-10 leads/month from website
- Competitors ranking higher on Google
- Site takes 6+ seconds to load on mobile
- Lost 3 large commercial contracts to competitors with better websites

Goals:
- 50+ qualified leads per month from website
- Rank on first page of Google for "plumber Brisbane"
- Look more professional than top 3 competitors
- Reduce dependency on paid advertising`,
};

// ============================================================================
// PROPOSAL DATA
// ============================================================================

export const DEMO_PROPOSAL = {
	title: "Demo: Website Redesign Proposal for Murray's Plumbing",
	status: "draft" as const,
	coverImage: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1200",
	executiveSummary: `Murray's Plumbing has built an excellent reputation over 15 years of serving the Brisbane community. However, your current website is limiting your growth potential and losing customers to competitors with modern online presence.

This proposal outlines a comprehensive website redesign that will transform your digital presence, improve search rankings, and convert more visitors into paying customers. We project a 200% increase in online leads within 6 months of launch.`,

	performanceData: {
		performance: 34,
		accessibility: 52,
		bestPractices: 61,
		seo: 45,
		loadTime: "6.8s",
		issues: [
			"Page takes over 6 seconds to load on mobile",
			"Images are not optimized (3.2MB average)",
			"No SSL certificate installed",
			"Missing meta descriptions on all pages",
			"Not mobile responsive - text too small to read",
		],
	},

	opportunityContent: `The plumbing industry in Brisbane is experiencing significant digital transformation. Customers increasingly expect to find, compare, and book services online. Your competitors are capitalizing on this shift with modern websites that convert visitors into leads.`,

	currentIssues: [
		{
			text: "Website takes 6+ seconds to load, causing 53% of visitors to leave",
			checked: true,
		},
		{
			text: "Not mobile-friendly - 73% of your traffic is mobile",
			checked: true,
		},
		{
			text: "No online booking system - customers must call during business hours",
			checked: true,
		},
	],

	complianceIssues: [
		{
			text: "Missing privacy policy (required under Australian Privacy Act)",
			checked: true,
		},
		{ text: "No WCAG 2.1 accessibility compliance", checked: true },
	],

	roiAnalysis: {
		currentVisitors: 450,
		projectedVisitors: 1350,
		conversionRate: 4.5,
		projectedLeads: 61,
		averageProjectValue: 485,
		projectedRevenue: 29585,
	},

	performanceStandards: [
		{ label: "Page Load Speed", value: "Under 2 seconds", icon: "Zap" },
		{ label: "Mobile Score", value: "95+", icon: "Smartphone" },
		{ label: "SEO Score", value: "90+", icon: "Search" },
	],

	localAdvantageContent: `**Dominate Brisbane Plumbing Searches**

With proper local SEO optimization, your new website will target customers actively searching for plumbing services in your service areas.`,

	proposedPages: [
		{
			name: "Home",
			description: "High-converting landing page with emergency CTA",
			features: ["24/7 emergency banner", "Click-to-call button"],
		},
		{
			name: "Services",
			description: "Comprehensive service pages",
			features: ["Emergency plumbing", "Hot water systems"],
		},
		{
			name: "Contact",
			description: "Multiple contact options",
			features: ["Online booking form", "Live chat widget"],
		},
	],

	timeline: [
		{
			week: "Week 1-2",
			title: "Discovery & Strategy",
			description: "Deep dive into your business and create design strategy",
		},
		{
			week: "Week 3-4",
			title: "Design & Prototyping",
			description: "Create visual designs and interactive prototypes",
		},
		{
			week: "Week 5-7",
			title: "Development",
			description: "Build your new website with all features",
		},
	],

	closingContent: `**Why Choose Us?**

We specialize in helping trade businesses like yours succeed online. Our websites are built to convert visitors into customers, with a focus on mobile performance and local SEO.`,

	nextSteps: [
		{ text: "Sign contract and pay 50% deposit", completed: false },
		{ text: "Complete website questionnaire (15 mins)", completed: false },
	],

	consultationPainPoints: {
		primary_challenges: [
			"Not getting enough leads from website",
			"Competitors ranking higher on Google",
		],
		technical_issues: ["Site is slow and crashes on mobile", "Contact form not working properly"],
		solution_gaps: ["No online booking system", "No way to showcase reviews"],
	},

	consultationGoals: {
		primary_goals: ["Generate more leads online", "Rank on first page of Google"],
		secondary_goals: ["Reduce phone calls for basic questions"],
		success_metrics: ["50+ new leads per month", 'Top 3 ranking for "plumber Brisbane"'],
	},

	consultationChallenges: [
		"Current website is 8 years old and built on outdated technology",
		"Lost 3 large commercial contracts to competitors with better websites",
	],

	clientBusinessName: "Demo: Murray's Plumbing",
	clientContactName: "Steve Murray",
	clientEmail: "steve@murraysplumbing.com.au",
	clientPhone: "0412 345 678",
	clientWebsite: "https://murraysplumbing.com.au",

	// Note: selectedPackageId, selectedAddons, and customPricing are set dynamically
	// in demo.remote.ts by querying the agency's actual packages and addons
	validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
	viewCount: 0,
};

// ============================================================================
// CONTRACT DATA
// ============================================================================

export const DEMO_CONTRACT = {
	status: "draft" as const,
	version: 1,
	clientBusinessName: "Demo: Murray's Plumbing",
	clientContactName: "Steve Murray",
	clientEmail: "steve@murraysplumbing.com.au",
	clientPhone: "0412 345 678",
	clientAddress: "42 Trade Street\nEight Mile Plains QLD 4113",

	servicesDescription: `Website Design & Development Services

Package: Growth Package

This agreement covers the design, development, and launch of a professional business website including up to 12 custom-designed pages, mobile-responsive design, online booking integration, Google Business Profile setup, advanced SEO optimization, monthly content updates (2 hrs), and monthly performance reports.`,

	commencementDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	completionDate: new Date(Date.now() + 77 * 24 * 60 * 60 * 1000),

	specialConditions: `Additional Terms for Murray's Plumbing

1. Client to provide all content (text, images) within 2 weeks of project start.
2. Up to 3 rounds of design revisions included.
3. Training session (2 hours) included for content management.
4. 12-month hosting and support included.`,

	totalPrice: "4838.00",
	priceIncludesGst: true,
	paymentTerms: `Setup Fee: $2,450 (inc. GST) - due upon contract signing
Monthly Retainer: $199/month (inc. GST) - 12-month minimum term`,

	validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),

	agencySignatoryName: "Agency Director",
	agencySignatoryTitle: "Director",
	agencySignedAt: new Date(),

	viewCount: 0,
	visibleFields: [
		"services",
		"commencementDate",
		"completionDate",
		"price",
		"paymentTerms",
		"specialConditions",
	],
	includedScheduleIds: [] as string[],
};

// ============================================================================
// INVOICE DATA
// ============================================================================

export const DEMO_INVOICE = {
	status: "draft" as const,
	clientBusinessName: "Demo: Murray's Plumbing",
	clientContactName: "Steve Murray",
	clientEmail: "steve@murraysplumbing.com.au",
	clientPhone: "0412 345 678",
	clientAddress: "42 Trade Street\nEight Mile Plains QLD 4113",
	clientAbn: "",

	issueDate: new Date(),
	dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),

	subtotal: "2227.27",
	discountAmount: "0.00",
	discountDescription: "",
	gstAmount: "222.73",
	total: "2450.00",

	gstRegistered: true,
	gstRate: "10.00",
	paymentTerms: "NET_7" as const,
	paymentTermsCustom: "",

	notes: "Deposit invoice for website project",
	publicNotes: `Payment Details

Bank Transfer: Please use your invoice number as the reference.`,

	viewCount: 0,
	onlinePaymentEnabled: true,
};

// ============================================================================
// QUOTATION DATA
// ============================================================================

export const DEMO_QUOTATION = {
	quotationName: "Demo: Bathroom Shower Retile",
	status: "draft" as const,

	// Client info (snapshot)
	clientBusinessName: "Demo: Murray's Plumbing",
	clientContactName: "Steve Murray",
	clientEmail: "steve@murraysplumbing.com.au",
	clientPhone: "0412 345 678",
	clientAddress: "42 Trade Street\nEight Mile Plains QLD 4113",

	// Site details
	siteAddress: "17 Hillview Crescent\nIndooroopilly QLD 4068",
	siteReference: "Mrs. Thompson — Main bathroom shower retile",

	// Dates (prepared today, expires in 60 days)
	preparedDate: new Date(),
	expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),

	// Pricing (sum of sections below)
	subtotal: "5000.00",
	discountAmount: "0.00",
	discountDescription: "",
	gstAmount: "500.00",
	total: "5500.00",

	gstRegistered: true,
	gstRate: "10.00",

	// Terms blocks (frozen snapshot)
	termsBlocks: [
		{
			title: "Quotation Notes For Client Below:",
			content:
				"Please ensure that you have thoroughly reviewed your quotation and understand all items before approving the work. Kindly note that this quote has been provided based on the visible conditions and the information available to us at the time of the assessment.",
		},
		{
			title: "FIXED PRICE QUOTE",
			content:
				"This is a fixed price quote. Any unforeseen damage will be completed at no additional cost, including plumbing, flooring, and stud framing repairs within the shower recess. The only variation would be for additional tiling if required, or unforeseen asbestos removal by a licensed specialist.",
		},
		{
			title: "Payment Terms",
			content:
				"On signed acceptance of this quote, our payment schedule is: 30% deposit (please note that we cannot schedule any work until the deposit has been received), 70% final payment on completion of the job.",
		},
		{
			title: "CLIENT TO SUPPLY TILES OF THEIR CHOICE",
			content:
				"If you have existing wall tiles that you are trying to match, be mindful of the thickness of your new tiles. A thickness variance no greater than 2mm is recommended. Tiles need to be onsite prior to commencement. This quote does not include mosaic tiles, painting, or plastering.",
		},
	],

	optionsNotes:
		"Optional upgrades available: heated towel rail installation ($350+GST), exhaust fan replacement ($180+GST), shower niche installation ($220+GST).",
	notes: "Demo quotation for Murray's Plumbing scenario",
	viewCount: 0,
};

export const DEMO_QUOTATION_SECTIONS = [
	{
		title: "Main — Inspection & Assessment",
		workItems: [
			"Video inspection of shower and assessment of proposed scope of work",
			"Tap service and pressure test to ensure there are no significant plumbing issues",
		],
		sectionPrice: "550.00",
		sectionGst: "55.00",
		sectionTotal: "605.00",
		sortOrder: 0,
	},
	{
		title: "Full Shower Retile",
		workItems: [
			"Removing the old wall tiles in the shower",
			"Removing the existing shower screen",
			"Lifting the old floor and removing the bed",
			"Fill in sunken shower",
			"Re-sheet two shower walls with new villa board",
			"Prime the walls",
			"Waterproofing the shower walls",
			"Applying a new wet seal membrane to the floor and the bottom row of the walls",
			"Screeding a new 30mm raised bed and re-tiling the floor and bottom row of wall tiles",
			"Tiling the shower walls with tiles supplied",
			"Grouting the walls",
			"Grouting the shower floor",
			"Applying Re-seal to the wall to floor joints and the vertical grout joints on the first row of wall tiles",
			"Refitting the existing shower screen if possible",
			"Replacing the silicone on the shower screen",
			"Applying a penetrating sealer over the floor of the shower",
			"Disposal of all rubbish associated with the job",
			"Finish off any miscellaneous items",
		],
		sectionPrice: "4450.00",
		sectionGst: "445.00",
		sectionTotal: "4895.00",
		sortOrder: 1,
	},
];
