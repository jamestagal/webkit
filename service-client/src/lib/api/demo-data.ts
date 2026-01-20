/**
 * Demo Data Constants
 *
 * Fixed demo data for Murray's Plumbing scenario.
 * All entity names are prefixed with "Demo:" for easy identification and cleanup.
 *
 * This data is used by demo.remote.ts to create a complete client journey:
 * Consultation → Proposal → Contract → Questionnaire → Invoice
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
	admiredWebsites: "https://brisbane-plumbing.com.au\nhttps://jetplumbing.com.au",
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
// QUESTIONNAIRE DATA
// ============================================================================

export const DEMO_QUESTIONNAIRE = {
	clientBusinessName: "Demo: Murray's Plumbing",
	clientEmail: "steve@murraysplumbing.com.au",
	responses: {
		// Section 1: Personal Information
		first_name: "Steve",
		last_name: "Murray",
		email: "steve@murraysplumbing.com.au",

		// Section 2: Company Details
		company_name: "Murray's Plumbing Pty Ltd",
		registered_address: "42 Trade Street, Eight Mile Plains QLD 4113",

		// Section 3: Display Information
		displayed_business_name: "Murray's Plumbing",
		displayed_address: "42 Trade Street, Eight Mile Plains QLD 4113",
		displayed_phone: "0412 345 678",
		displayed_email: "info@murraysplumbing.com.au",
		social_media_accounts:
			"Facebook: facebook.com/murraysplumbing\nInstagram: @murrays_plumbing_brisbane",
		opening_hours: "Mon-Fri: 7am-6pm\nSat: 8am-2pm\nEmergency: 24/7",

		// Section 4: Domain & Technical
		has_domain: "yes",
		domain_name: "murraysplumbing.com.au",
		has_google_business: "yes",

		// Section 5: About Your Business
		business_story: `Murray's Plumbing is a family-owned plumbing business serving the Greater Brisbane area for over 15 years. Founded by Steve Murray, we've grown from a one-man operation to a team of 8 licensed plumbers providing 24/7 emergency services. Our 4.8 star Google rating (127 reviews) reflects our commitment to quality workmanship and customer satisfaction.`,
		business_emails: "info@murraysplumbing.com.au, quotes@murraysplumbing.com.au",
		areas_served:
			"Greater Brisbane including CBD, Northside, Southside, Western Suburbs, and Ipswich",
		target_customers:
			"Homeowners in Brisbane suburbs (ages 35-65), property managers, small to medium commercial businesses",
		top_services:
			"Emergency plumbing (24/7), Hot water system installation, Blocked drain clearing, Gas fitting, Bathroom renovations",
		other_services: "Commercial maintenance, Pipe relining, Water leak detection",
		differentiators:
			"24/7 Emergency Response, 15 Years Experience, Transparent Pricing, Licensed Gas Fitters, Family Values",
		statistics_awards:
			"15 years in business, 8 licensed plumbers, 4.8 star rating (127 reviews), Master Plumbers Association member",
		additional_business_details:
			"We pride ourselves on transparent pricing - no hidden fees. All our plumbers are fully licensed and insured.",

		// Section 6: Website Content
		pages_wanted:
			"Home, About Us, Services (with sub-pages for each service), Contact, Book Online, Testimonials",
		customer_actions: "Request a quote, Book an appointment online, Call for emergency service",
		key_information:
			"Service areas, Pricing guide, Emergency contact, Licensed and insured credentials",
		calls_to_action: "Book Now, Get a Free Quote, Call 24/7 Emergency Line",
		regularly_updated_content: "Blog posts about plumbing tips, seasonal specials and promotions",
		additional_content_details:
			"Would like to showcase before/after photos of bathroom renovations",

		// Section 7: Website Design
		competitor_websites: "brisbane-plumbing.com.au, jetplumbing.com.au",
		reference_websites: "We like the clean, professional look of jetplumbing.com.au",
		aesthetic_description:
			"Modern, professional, trustworthy. Blue and orange color scheme. Clean and easy to navigate.",
		branding_guidelines:
			"Primary Blue: #0066CC, Accent Orange: #FF6600, White: #FFFFFF. We have an existing logo.",
		additional_design_details:
			"Mobile-first design is critical - most of our customers find us on their phones during emergencies",

		// Section 8: Final Details
		timeline: "Within 10 weeks",
		google_analytics: "yes",
		referral_source: "Google search",
		other_services_interest: "SEO, Google Ads management",
		marketing_permissions: "yes",
	},
	currentSection: 8,
	completionPercentage: 100,
	status: "completed" as const,
	startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
	completedAt: new Date(),
	lastActivityAt: new Date(),
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
