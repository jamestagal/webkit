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
	website: "https://www.murrayplumbinggroup.com.au/",
	socialLinkedin: null as string | null,
	socialFacebook: "https://www.facebook.com/murrayplumbingaw/",
	socialInstagram: "https://www.instagram.com/murray.plumbing/",
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

// ============================================================================
// CONTENT INTELLIGENCE DATA
// ============================================================================

const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const THREE_DAYS_AGO_PLUS_3MIN = new Date(THREE_DAYS_AGO.getTime() + 3 * 60 * 1000);

export const DEMO_CRAWL_JOB = {
	status: "complete" as const,
	sourceUrl: "https://www.murrayplumbinggroup.com.au/",
	crawlTarget: "client",
	pagesDiscovered: 16,
	pagesProcessed: 16,
	pagesChanged: 16,
	maxDepth: 3,
	crawlType: "full" as const,
	startedAt: THREE_DAYS_AGO,
	completedAt: THREE_DAYS_AGO_PLUS_3MIN,
};

export const DEMO_CONTENT_PAGES = [
	{
		path: "/",
		pageType: "homepage",
		title: "Murray Plumbing Group — Licensed Plumbers Brisbane",
		wordCount: 920,
		metaDescription:
			"Murray Plumbing Group provides reliable, licensed plumbing services across Brisbane. 24/7 emergency callouts, upfront pricing, family-owned since 2005.",
		markdownContent: `# Murray Plumbing Group — Licensed Plumbers Brisbane

Murray Plumbing Group has been serving Brisbane homeowners and businesses since 2005. As a fully licensed, insured plumbing company, we deliver reliable solutions for everything from emergency repairs to complete bathroom renovations. Our team of experienced plumbers covers Brisbane CBD, Northside, Southside, Western Suburbs, and Ipswich.

We believe in upfront pricing with no hidden costs. When you call Murray Plumbing Group, you get a clear quote before any work begins. Our 4.8-star Google rating from over 127 reviews reflects our commitment to quality workmanship and honest service. Whether it's a burst pipe at midnight or a planned kitchen renovation, we're the Brisbane plumbers you can trust.

From blocked drains and hot water systems to gas fitting and commercial maintenance, our team handles jobs of all sizes. We use the latest equipment including CCTV drain cameras and hydro-jetting technology to diagnose and fix problems efficiently. Contact us today for a free quote or call our 24/7 emergency line.`,
	},
	{
		path: "/about",
		pageType: "about",
		title: "About Us — Murray Plumbing Group",
		wordCount: 580,
		metaDescription:
			"Learn about Murray Plumbing Group — a family-owned Brisbane plumbing company with 15+ years of experience and a team of 8 licensed plumbers.",
		markdownContent: `# About Murray Plumbing Group

Murray Plumbing Group was founded by Steve Murray in 2005 with a single van and a commitment to honest, reliable plumbing. Over 15 years later, we've grown to a team of 8 licensed plumbers serving the greater Brisbane area. Despite our growth, we remain a family-owned business that treats every customer like a neighbour.

Our plumbers hold current QBCC licences and undergo regular training to stay up to date with Australian plumbing standards and new technologies. We're fully insured, and every job comes with a workmanship guarantee. We're proud members of the Master Plumbers Association of Queensland.

What sets us apart is our commitment to transparency. We provide written quotes before starting work, explain what we're doing and why, and clean up after every job. Our repeat customer rate of over 60% speaks to the relationships we build. When you choose Murray Plumbing Group, you're choosing a team that cares about getting the job done right the first time.`,
	},
	{
		path: "/services",
		pageType: "service",
		title: "Our Plumbing Services",
		wordCount: 640,
		metaDescription:
			"Comprehensive plumbing services in Brisbane — emergency repairs, blocked drains, hot water, gas fitting, renovations, commercial maintenance.",
		markdownContent: `# Our Plumbing Services

Murray Plumbing Group offers a full range of residential and commercial plumbing services across Brisbane. Our licensed plumbers are equipped to handle everything from routine maintenance to complex installations.

## Residential Services
We cover all home plumbing needs including tap repairs, toilet installations, water leak detection, pipe relining, and stormwater drainage. Our team can also help with kitchen and laundry plumbing fit-outs, water filtration systems, and rainwater tank connections. Every residential job includes a tidy-up and a walkthrough of the completed work.

## Commercial & Specialised Services
For businesses and property managers, we provide planned maintenance programs, backflow prevention testing, grease trap servicing, and after-hours emergency response. We work with real estate agencies, body corporates, restaurants, and retail outlets across Brisbane. Our commercial clients benefit from priority scheduling and detailed job reports for compliance records.`,
	},
	{
		path: "/services/emergency-plumbing",
		pageType: "service",
		title: "24/7 Emergency Plumbing Brisbane",
		wordCount: 520,
		metaDescription:
			"24/7 emergency plumber Brisbane. Burst pipes, gas leaks, blocked drains — Murray Plumbing Group responds fast with upfront pricing. Call now.",
		markdownContent: `# 24/7 Emergency Plumbing Brisbane

Plumbing emergencies don't wait for business hours, and neither do we. Murray Plumbing Group provides round-the-clock emergency plumbing services across Brisbane. Whether it's a burst pipe flooding your home at 2am or a gas leak that needs immediate attention, our emergency team is ready.

We aim to arrive within 60 minutes of your call for urgent situations. Our vans are fully stocked with common parts and equipment so we can resolve most emergencies in a single visit. You'll receive an upfront quote before we start any work — even at 3am.

Common emergencies we handle include burst pipes, blocked toilets and drains, gas leaks, hot water failures, overflowing gutters during storms, and sewer backups. If you smell gas, hear running water behind walls, or see water damage spreading, don't wait — call our emergency line immediately. We'll talk you through any immediate steps to minimise damage while our team is on the way.`,
	},
	{
		path: "/services/blocked-drains",
		pageType: "service",
		title: "Blocked Drain Clearing & Repair",
		wordCount: 480,
		metaDescription:
			"Professional blocked drain clearing in Brisbane. CCTV inspections, hydro-jetting, pipe relining. Murray Plumbing Group — fast, lasting results.",
		markdownContent: `# Blocked Drain Clearing & Repair

Blocked drains are one of the most common plumbing issues Brisbane homeowners face. Tree roots, grease buildup, foreign objects, and pipe damage can all cause slow or completely blocked drains. Murray Plumbing Group uses modern diagnostic tools to find the blockage and clear it properly — not just push it further down the line.

Our drain clearing process starts with a CCTV drain camera inspection to identify the exact location and cause of the blockage. We then use the most appropriate method — electric eel, hydro-jetting, or manual clearing — to restore full flow. For recurring blockages caused by tree root intrusion or damaged pipes, we offer pipe relining as a long-term solution without the need to dig up your yard.

We service kitchen drains, bathroom drains, stormwater drains, and sewer lines across all Brisbane suburbs. Our plumbers carry all necessary equipment on their vans, so most blockages are cleared in a single visit.`,
	},
	{
		path: "/services/hot-water-systems",
		pageType: "service",
		title: "Hot Water System Installation & Repair",
		wordCount: 550,
		metaDescription:
			"Hot water system installation, repair, and replacement in Brisbane. Electric, gas, solar, heat pump — expert advice from Murray Plumbing Group.",
		markdownContent: `# Hot Water System Installation & Repair

Nothing disrupts your day like losing hot water. Murray Plumbing Group specialises in hot water system installation, repair, and replacement across Brisbane. We work with all major brands including Rheem, Rinnai, Dux, Bosch, and Stiebel Eltron, and we can advise you on the best system for your household size and budget.

We install and service all hot water system types — electric storage, gas storage, continuous flow (instant), solar, and heat pump systems. Our plumbers can help you understand the running costs, government rebates, and installation requirements for each option. If you're replacing an old system, we handle the removal and disposal of your existing unit.

For hot water repairs, we carry common parts on our vans for same-day fixes. Issues we commonly repair include thermostat failures, leaking valves, pilot light problems, element replacements, and anode rod replacements. If your system is beyond repair, we'll provide a clear quote for replacement options suited to your home.`,
	},
	{
		path: "/services/gas-fitting",
		pageType: "service",
		title: "Gas Fitting & Gas Plumbing Brisbane",
		wordCount: 460,
		metaDescription:
			"Licensed gas fitter Brisbane. Gas appliance installation, gas leak detection, compliance certificates. Murray Plumbing Group — safety first.",
		markdownContent: `# Gas Fitting & Gas Plumbing Brisbane

Murray Plumbing Group holds a current gas fitting licence and provides comprehensive gas plumbing services across Brisbane. Gas work requires specialist knowledge and strict compliance with Australian gas standards — our licensed gas fitters have the training and experience to ensure your gas installations are safe and compliant.

We install, repair, and service gas cooktops, ovens, hot water systems, BBQ points, gas heaters, and gas fireplaces. All gas work is completed to AS/NZS 5601 standards and includes a compliance certificate. If you suspect a gas leak, call us immediately — gas leaks are a serious safety hazard that requires urgent professional attention.

Our gas services also include gas line extensions for new appliances, gas pressure testing, carbon monoxide testing, and gas meter upgrades. Whether you're renovating your kitchen or adding an outdoor gas BBQ point, we'll ensure the installation is safe, compliant, and properly tested before handover.`,
	},
	{
		path: "/services/bathroom-renovations",
		pageType: "service",
		title: "Bathroom Renovations Brisbane",
		wordCount: 590,
		metaDescription:
			"Complete bathroom renovations in Brisbane. Design to completion, waterproofing, tiling, fixtures. Murray Plumbing Group — quality bathroom makeovers.",
		markdownContent: `# Bathroom Renovations Brisbane

Transform your bathroom with Murray Plumbing Group. We handle complete bathroom renovations from design through to final fit-out, including all plumbing, waterproofing, tiling, and fixture installation. Our renovation team has completed over 200 bathroom makeovers across Brisbane, from compact ensuites to luxury master bathrooms.

Every bathroom renovation starts with an on-site consultation where we discuss your vision, budget, and timeline. We provide a detailed fixed-price quote covering all trades — plumbing, tiling, waterproofing, electrical, and carpentry. No surprises, no variations (unless you request changes during the project).

Our standard renovation process takes 10-15 working days depending on the scope. We manage all trades, council compliance, and waterproofing certification. All waterproofing is completed by licensed waterproofers and independently inspected before tiling begins. We use premium materials and fixtures from brands including Caroma, Phoenix, Grohe, and Methven. Your new bathroom comes with a full workmanship warranty.`,
	},
	{
		path: "/services/commercial-plumbing",
		pageType: "service",
		title: "Commercial Plumbing Services",
		wordCount: 510,
		metaDescription:
			"Commercial plumbing Brisbane — maintenance programs, backflow testing, grease traps, compliance. Murray Plumbing Group serves businesses across Brisbane.",
		markdownContent: `# Commercial Plumbing Services

Murray Plumbing Group provides reliable commercial plumbing services to businesses, property managers, and body corporates across Brisbane. We understand that plumbing issues in a commercial setting can mean lost revenue, safety hazards, and compliance problems — which is why we offer priority response times and flexible scheduling to minimise disruption.

Our commercial services include planned maintenance programs, emergency repairs, backflow prevention testing and certification, grease trap installation and servicing, water efficiency audits, and fit-outs for new tenancies. We work with restaurants, cafes, retail stores, offices, medical centres, and industrial facilities.

For property managers and body corporates, we offer tailored maintenance contracts with scheduled inspections, detailed reporting, and guaranteed response times for emergencies. Our commercial clients receive itemised invoices, before-and-after photos, and compliance documentation for every job. We're experienced with council requirements and can assist with hydraulic engineering submissions for new builds and major renovations.`,
	},
	{
		path: "/services/roof-plumbing",
		pageType: "service",
		title: "Roof Plumbing & Guttering",
		wordCount: 440,
		metaDescription:
			"Roof plumbing and guttering services Brisbane. Gutter installation, downpipes, roof leaks, stormwater. Murray Plumbing Group — protecting your home.",
		markdownContent: `# Roof Plumbing & Guttering

Protect your home from Brisbane's heavy rainfall with properly installed and maintained guttering and roof plumbing. Murray Plumbing Group provides gutter installation, gutter replacement, downpipe repairs, roof leak detection, and stormwater drainage solutions across Brisbane.

Brisbane's subtropical climate means your gutters and roof plumbing need to handle intense summer storms. We install Colorbond guttering and downpipes in a range of profiles and colours to suit your home. Our team also handles fascia and soffit repairs, box gutter maintenance, and valley iron replacement.

If you're experiencing water staining on ceilings, overflowing gutters during rain, or pooling water around your foundations, these are signs your roof plumbing needs attention. We carry out thorough inspections to identify the source of the problem and provide lasting solutions — not temporary patches.`,
	},
	{
		path: "/blog",
		pageType: "blog_post",
		title: "Plumbing Tips & News",
		wordCount: 320,
		metaDescription:
			"Helpful plumbing tips, guides, and news from Murray Plumbing Group. Expert advice for Brisbane homeowners on maintenance, repairs, and upgrades.",
		markdownContent: `# Plumbing Tips & News

Welcome to the Murray Plumbing Group blog. Here you'll find practical plumbing tips, maintenance guides, and industry updates to help you keep your Brisbane home in top shape. Our experienced plumbers share their knowledge to help you prevent common issues and make informed decisions about your plumbing.

Browse our latest articles below, covering everything from emergency preparedness to choosing the right hot water system. Whether you're a first-time homeowner or looking to upgrade your plumbing, our guides are written in plain language with actionable advice.`,
	},
	{
		path: "/blog/prevent-blocked-drains",
		pageType: "blog_post",
		title: "5 Ways to Prevent Blocked Drains",
		wordCount: 1100,
		metaDescription:
			"Learn 5 proven ways to prevent blocked drains in your Brisbane home. Expert tips from Murray Plumbing Group on protecting your drains year-round.",
		markdownContent: `# 5 Ways to Prevent Blocked Drains

Blocked drains are one of the most common — and most preventable — plumbing problems we see in Brisbane homes. As plumbers who clear blocked drains every day, we've seen what causes them and how simple habits can save you hundreds of dollars in emergency callouts. Here are our top five tips for keeping your drains flowing freely.

## 1. Use Drain Strainers
Install mesh strainers over all your drain openings — kitchen sink, bathroom basin, shower, and laundry. These inexpensive devices catch hair, food scraps, and debris before they enter your pipes. Clean them out weekly to prevent buildup. This single step prevents about 70% of the blockages we see in bathrooms.

## 2. Never Pour Grease Down the Drain
Cooking fats, oils, and grease are the number one cause of kitchen drain blockages in Brisbane. When hot grease hits cold pipes, it solidifies and creates a sticky coating that traps other debris. Instead, let grease cool in a container and dispose of it in your general waste bin. Wipe greasy pans with paper towel before washing.

## 3. Be Mindful of What Goes Down the Toilet
Toilets are designed for human waste and toilet paper only. Items like wet wipes (even those labelled "flushable"), cotton buds, sanitary products, and dental floss should go in the bin. These items don't break down in water and create stubborn blockages in your sewer line.`,
	},
	{
		path: "/blog/hot-water-guide",
		pageType: "blog_post",
		title: "Complete Guide to Hot Water Systems",
		wordCount: 1250,
		metaDescription:
			"Your complete guide to hot water systems in Brisbane. Compare electric, gas, solar, and heat pump options. Costs, rebates, and expert recommendations.",
		markdownContent: `# Complete Guide to Hot Water Systems

Choosing the right hot water system for your Brisbane home is one of the most important plumbing decisions you'll make. Your hot water system accounts for roughly 25% of your household energy bill, so the right choice can save you thousands over its lifetime. In this guide, we break down the four main types and help you decide which is best for your situation.

## Electric Storage Systems
Electric storage hot water systems are the most common in older Brisbane homes. They heat water in an insulated tank using an electric element — similar to a kettle. Tanks range from 50L (suitable for 1-2 people) to 400L (large families). Purchase cost is low ($800-$1,500 installed), but running costs are the highest of all types. If you're on an off-peak tariff, a timer can reduce electricity costs significantly.

## Gas Systems
Gas hot water is popular in Brisbane suburbs with natural gas connections. Gas continuous flow (instantaneous) systems are the most efficient option — they heat water on demand so you never run out. Brands like Rinnai and Bosch offer compact wall-mounted units that save space compared to storage tanks. Running costs are typically 30-40% less than electric storage.

## Solar Hot Water
Brisbane's sunny climate makes solar hot water an excellent investment. A solar system uses roof-mounted panels to heat water, with a gas or electric booster for cloudy days. The upfront cost is higher ($3,500-$5,500 installed), but government rebates can reduce this significantly. Running costs are the lowest of all options — typically 50-80% less than electric.`,
	},
	{
		path: "/blog/plumbing-emergency-tips",
		pageType: "blog_post",
		title: "What to Do in a Plumbing Emergency",
		wordCount: 900,
		metaDescription:
			"Know what to do in a plumbing emergency. Shut-off valve locations, burst pipe steps, gas leak response. Expert guide from Murray Plumbing Group Brisbane.",
		markdownContent: `# What to Do in a Plumbing Emergency

A plumbing emergency can happen at any time, and knowing how to respond in the first few minutes can prevent thousands of dollars in water damage. As Brisbane's emergency plumbers, we've seen how quickly a small leak can become a major problem. Here's what you should do — and what you should avoid — when a plumbing emergency strikes.

## Step 1: Know Your Shut-Off Valves
The most important thing every homeowner should know is where their main water shut-off valve is located. In most Brisbane homes, it's at the front of the property near the water meter. Turning this valve clockwise will stop all water flow to your home. We recommend testing it once a year to make sure it works smoothly — a seized valve in an emergency is the last thing you need.

## Step 2: Burst Pipes
If a pipe bursts, turn off the main water valve immediately. Open taps at the lowest point of your home to drain remaining water from the system. If water is near electrical outlets or appliances, switch off power at the circuit breaker before touching anything. Place towels and buckets to contain the water, and call an emergency plumber right away.

## When to Call an Emergency Plumber
Not every plumbing issue requires an emergency callout. A dripping tap can wait until morning, but a burst pipe, gas leak, blocked sewer, or overflowing toilet needs immediate attention. If in doubt, call us — we're happy to advise over the phone whether the situation is urgent or can wait for a scheduled appointment.`,
	},
	{
		path: "/contact",
		pageType: "contact",
		title: "Contact Murray Plumbing Group",
		wordCount: 290,
		metaDescription:
			"Contact Murray Plumbing Group for a free plumbing quote in Brisbane. Call 0412 345 678 or fill out our online form. 24/7 emergency service available.",
		markdownContent: `# Contact Murray Plumbing Group

Ready to get your plumbing sorted? Contact Murray Plumbing Group for a free, no-obligation quote. We service all of Brisbane including CBD, Northside, Southside, Western Suburbs, and Ipswich.

**Phone:** 0412 345 678 (24/7 for emergencies)
**Email:** steve@murrayplumbinggroup.com.au
**Office Hours:** Monday–Friday 7am–5pm, Saturday 8am–12pm

For non-urgent enquiries, fill out the form below and we'll get back to you within 24 hours. For emergencies, please call us directly — we aim to have a plumber at your door within 60 minutes.`,
	},
	{
		path: "/areas-we-service",
		pageType: "landing",
		title: "Areas We Service — Brisbane & Surrounds",
		wordCount: 680,
		metaDescription:
			"Murray Plumbing Group services all Brisbane suburbs — CBD, Northside, Southside, Western Suburbs, Ipswich. Licensed plumbers near you.",
		markdownContent: `# Areas We Service — Brisbane & Surrounds

Murray Plumbing Group provides residential and commercial plumbing services across the greater Brisbane region. Our team of licensed plumbers is based in Eight Mile Plains, giving us quick access to suburbs across Brisbane's Southside, Northside, CBD, and Western corridors.

## Brisbane CBD & Inner Suburbs
We service Brisbane City, South Brisbane, West End, Fortitude Valley, New Farm, Kangaroo Point, Woolloongabba, and surrounding inner-city suburbs. Our team is experienced with the unique plumbing challenges of inner-city properties including heritage homes, high-rise buildings, and mixed-use commercial spaces.

## Southside Suburbs
Our home base in Eight Mile Plains means fast response times to Sunnybank, Mt Gravatt, Holland Park, Carindale, Wishart, Rochedale, Springwood, Underwood, and all suburbs south to Logan and Beenleigh. We know the plumbing infrastructure of the Southside inside and out.

## Northside & Western Suburbs
We cover Northside suburbs including Chermside, Kedron, Nundah, Stafford, Aspley, and out to Strathpine. On the Western side, we service Indooroopilly, Kenmore, Chapel Hill, Toowong, St Lucia, Auchenflower, and out to Ipswich. Whether you're in Paddington or Springfield, we'll come to you.`,
	},
];

/**
 * Generate 3 content chunks for a given page.
 * Returns chunk data without IDs (those are generated during insertion).
 */
export function generateChunksForPage(
	pageType: string,
	title: string,
): Array<{ chunkIndex: number; chunkText: string; tokenCount: number; metadata: object }> {
	const chunkTemplates: Record<string, string[][]> = {
		homepage: [
			[
				"Murray Plumbing Group has been serving Brisbane homeowners and businesses since 2005. As a fully licensed, insured plumbing company, we deliver reliable solutions for everything from emergency repairs to complete bathroom renovations. Our team of experienced plumbers covers Brisbane CBD, Northside, Southside, Western Suburbs, and Ipswich. We believe in upfront pricing with no hidden costs.",
				"We provide a full range of plumbing services including emergency plumbing, blocked drain clearing, hot water system installation and repair, gas fitting, bathroom renovations, commercial plumbing maintenance, and roof plumbing. Our 4.8-star Google rating from over 127 reviews reflects our commitment to quality workmanship and honest service.",
				"Contact Murray Plumbing Group today for a free quote or call our 24/7 emergency line. We aim to arrive within 60 minutes for urgent situations. Our vans are fully stocked with common parts and equipment so we can resolve most issues in a single visit. Licensed, insured, and ready to help — that's the Murray Plumbing difference.",
			],
		],
		about: [
			[
				"Murray Plumbing Group was founded by Steve Murray in 2005 with a single van and a commitment to honest, reliable plumbing. Over 15 years later, we've grown to a team of 8 licensed plumbers serving the greater Brisbane area. Despite our growth, we remain a family-owned business that treats every customer like a neighbour.",
				"Our plumbers hold current QBCC licences and undergo regular training to stay up to date with Australian plumbing standards and new technologies. We're fully insured, and every job comes with a workmanship guarantee. We're proud members of the Master Plumbers Association of Queensland.",
				"What sets us apart is our commitment to transparency. We provide written quotes before starting work, explain what we're doing and why, and clean up after every job. Our repeat customer rate of over 60% speaks to the relationships we build with our customers across Brisbane.",
			],
		],
	};

	// Default chunks for service/blog/contact/landing pages
	const defaultChunks = [
		`${title} — Murray Plumbing Group provides professional plumbing services across Brisbane. Our licensed plumbers are experienced with all aspects of this service area, using modern equipment and techniques to deliver lasting results. We serve residential and commercial clients throughout Brisbane CBD, Northside, Southside, and Western Suburbs.`,
		`Our approach focuses on diagnosis first — we use CCTV cameras, pressure testing, and thermal imaging to identify the root cause before recommending solutions. Every quote is provided in writing with no hidden costs. We carry common parts on our vans for same-day repairs, and our workmanship is fully guaranteed.`,
		`Contact Murray Plumbing Group for a free quote on ${title.toLowerCase().replace(/—.*/, "").trim()} services. Available Monday–Friday 7am–5pm, Saturday 8am–12pm, and 24/7 for emergencies. Call 0412 345 678 or fill out our online form. We aim to respond to all enquiries within 24 hours.`,
	];

	const chunks = chunkTemplates[pageType]?.[0] ?? defaultChunks;

	return chunks.map((text, index) => ({
		chunkIndex: index,
		chunkText: text,
		tokenCount: Math.round(text.split(/\s+/).length * 1.3),
		metadata: {
			page_type: pageType,
			section_heading: index === 0 ? "Introduction" : index === 1 ? "Details" : "Contact & CTA",
		},
	}));
}

export const DEMO_BRAND_PROFILE = {
	profile: {
		brand_name: "Murray Plumbing Group",
		industry: "Plumbing & Home Services",
		target_audience: "Homeowners and businesses in Brisbane needing reliable plumbing",
		personality_traits: [
			"Reliable",
			"Experienced",
			"Down-to-earth",
			"Locally focused",
			"Australian",
		],
		tone_guidelines: {
			default: "Trustworthy and straightforward — friendly but professional",
			promotional: "Confident and value-focused — emphasise upfront pricing and licensing",
			educational: "Helpful and clear — explain plumbing concepts in plain language",
		},
		vocabulary: {
			formality_level: "Conversational professional",
			industry_jargon: [
				"hot water system",
				"backflow prevention",
				"gas fitting",
				"drain camera inspection",
				"TMV compliance",
			],
			avoided_terms: ["cheap", "budget", "discount", "DIY", "hack", "quick fix"],
			signature_phrases: [
				"Upfront pricing, no hidden costs",
				"Licensed and insured",
				"Your local Brisbane plumbers",
				"Family-owned since 2005",
			],
		},
		sentence_structure: {
			avg_length: "12-18 words",
			active_passive: "Primarily active voice",
			uses_contractions: true,
		},
		messaging_pillars: [
			{
				theme: "Trust & Licensing",
				evidence: "Always lead with QBCC licensing, insurance, and compliance credentials",
			},
			{
				theme: "Local Expertise",
				evidence: "Reference Brisbane suburbs, local conditions, and community involvement",
			},
			{
				theme: "Transparent Pricing",
				evidence: "Emphasise upfront quotes with no hidden fees or call-out charges",
			},
			{
				theme: "24/7 Availability",
				evidence: "Highlight emergency plumbing availability and fast response times",
			},
		],
		constraints: {
			always: [
				"Mention QBCC licence number in service pages",
				"Include Brisbane suburb names for local SEO",
				"Use Australian English spelling (licence, colour, metres)",
				"Include a clear call-to-action on every page",
			],
			never: [
				"Never guarantee exact arrival times",
				"Never disparage competitors by name",
				"Never provide DIY instructions for gas work",
				"Never use American English spelling",
			],
		},
		competitive_positioning: {
			differentiators: [
				"Family-owned for 20+ years — not a franchise",
				"All plumbers are directly employed, not subcontractors",
				"Free quotes with no call-out fee",
			],
			industry_norms: [
				"Most competitors use subcontractors",
				"Call-out fees are standard in the industry",
				"Few competitors offer same-day hot water replacement",
			],
			gaps_to_fill: [
				"Video content showing completed projects",
				"Customer case studies with before/after photos",
				"Educational blog content on preventive maintenance",
			],
		},
	},
	version: 1,
	isActive: true,
	sourceType: "hybrid" as const,
	sourcePageCount: 16,
};

export const DEMO_SEO_AUDIT = {
	status: "complete" as const,
	overallScore: 58,
	technicalScore: 65,
	contentScore: 52,
	backlinkScore: 40,
	keywordScore: 48,
	totalPages: 16,
	criticalIssues: 4,
	warningIssues: 8,
	passedChecks: 20,
	opportunities: 5,
	startedAt: THREE_DAYS_AGO,
	completedAt: THREE_DAYS_AGO_PLUS_3MIN,
};

export const DEMO_SEO_ISSUES: Array<{
	severity: string;
	category: string;
	checkName: string;
	title: string;
	description: string;
	currentValue: string | null;
	recommendedValue: string | null;
	impact: string;
	pagePath?: string;
}> = [
	{
		severity: "critical",
		category: "performance",
		checkName: "slow_page_load",
		title: "Homepage loads in 5.1s (target: <2.5s)",
		description:
			"The homepage takes 5.1 seconds to load on a standard mobile connection. This exceeds Google's Core Web Vitals threshold of 2.5s for Largest Contentful Paint and is likely causing high bounce rates.",
		currentValue: "5.1s LCP",
		recommendedValue: "<2.5s LCP",
		impact: "High bounce rate — 53% of mobile visitors leave before page loads. Negative ranking signal for Google.",
	},
	{
		severity: "critical",
		category: "meta",
		checkName: "missing_meta_desc",
		title: "4 service pages missing meta descriptions",
		description:
			"The emergency plumbing, gas fitting, commercial plumbing, and roof plumbing pages have no meta description tags. Google will auto-generate snippets which may not represent your services accurately.",
		currentValue: "4 pages without meta descriptions",
		recommendedValue: "All pages should have unique 150-160 char meta descriptions",
		impact: "Lower click-through rates from search results. Missed opportunity to include target keywords in SERP snippets.",
		pagePath: "/services/emergency-plumbing",
	},
	{
		severity: "critical",
		category: "content",
		checkName: "thin_content",
		title: "Gas fitting page only 460 words",
		description:
			"The gas fitting service page contains only 460 words of content. For a competitive service keyword, Google typically ranks pages with 800+ words of comprehensive, relevant content.",
		currentValue: "460 words",
		recommendedValue: "800-1200 words with sections covering services, safety, compliance, and FAQs",
		impact: "Page unlikely to rank for 'gas fitter Brisbane' or related keywords against competitors with more thorough content.",
		pagePath: "/services/gas-fitting",
	},
	{
		severity: "critical",
		category: "mobile",
		checkName: "not_responsive",
		title: "Contact form breaks on mobile",
		description:
			"The contact page form overflows its container on screens narrower than 375px. Submit button is partially hidden and form fields don't stack vertically. This makes it impossible for some mobile users to submit enquiries.",
		currentValue: "Form unusable on small mobile screens",
		recommendedValue: "Fully responsive form with stacked fields and full-width submit button on mobile",
		impact: "Losing potential leads from mobile users who can't complete the contact form. Mobile is 73% of traffic.",
		pagePath: "/contact",
	},
	{
		severity: "warning",
		category: "technical",
		checkName: "no_ssl_redirect",
		title: "HTTP to HTTPS not enforced",
		description:
			"The site is accessible via both HTTP and HTTPS without a redirect. This means some visitors may be accessing an insecure version of the site, and search engines may index duplicate pages.",
		currentValue: "HTTP and HTTPS both accessible",
		recommendedValue: "301 redirect from HTTP to HTTPS on all pages",
		impact: "Security warning in browsers, potential duplicate content issues, minor ranking penalty.",
	},
	{
		severity: "warning",
		category: "meta",
		checkName: "duplicate_titles",
		title: "Emergency/blocked drains similar titles",
		description:
			"The emergency plumbing and blocked drains pages have very similar title tags that could compete with each other in search results. Each page should have a clearly distinct title targeting different keywords.",
		currentValue: "Both titles start with service name only",
		recommendedValue: "Differentiate with unique value propositions and location modifiers",
		impact: "Keyword cannibalization — pages may compete against each other instead of ranking for separate queries.",
	},
	{
		severity: "warning",
		category: "content",
		checkName: "low_readability",
		title: "Hot Water Guide below readability threshold",
		description:
			"The hot water systems guide has a Flesch reading ease score of 38 (difficult). For a consumer-facing plumbing guide, content should be accessible to a general audience with a score above 60.",
		currentValue: "Flesch score: 38 (difficult)",
		recommendedValue: "Flesch score: 60+ (standard/easy)",
		impact: "Readers may abandon the page if content is too technical. Lower time-on-page affects engagement signals.",
		pagePath: "/blog/hot-water-guide",
	},
	{
		severity: "warning",
		category: "structure",
		checkName: "missing_h1",
		title: "Areas page missing H1 tag",
		description:
			"The areas-we-service page has no H1 heading tag. The page title appears as a styled div rather than a semantic H1 element. This makes it harder for search engines to understand the page's primary topic.",
		currentValue: "No H1 tag found",
		recommendedValue: "Single H1 tag matching the page's primary topic",
		impact: "Reduced relevance signals for local SEO queries like 'plumber [suburb name]'.",
		pagePath: "/areas-we-service",
	},
	{
		severity: "warning",
		category: "internal_links",
		checkName: "orphan_pages",
		title: "Roof plumbing page has only 1 internal link",
		description:
			"The roof plumbing service page is only linked from the main services page. It has no links from the homepage, blog posts, or other service pages. Low internal link count signals low importance to search engines.",
		currentValue: "1 internal link pointing to this page",
		recommendedValue: "3-5 internal links from relevant pages including homepage and blog posts",
		impact: "Page receives minimal PageRank and may be deprioritised in crawl frequency.",
		pagePath: "/services/roof-plumbing",
	},
	{
		severity: "warning",
		category: "schema",
		checkName: "missing_schema",
		title: "No LocalBusiness structured data",
		description:
			"The site has no Schema.org LocalBusiness markup. This means Google can't easily extract business information like address, phone number, service area, and opening hours for rich snippets and local pack results.",
		currentValue: "No structured data found",
		recommendedValue: "LocalBusiness schema with address, phone, openingHours, areaServed, and service types",
		impact: "Missing out on enhanced search listings and local pack visibility. Competitors with schema markup have an advantage.",
	},
	{
		severity: "warning",
		category: "content",
		checkName: "keyword_stuffing",
		title: '"plumber Brisbane" appears 18 times on homepage',
		description:
			'The exact phrase "plumber Brisbane" appears 18 times on the homepage. While targeting this keyword is important, overuse can trigger Google\'s keyword stuffing penalties and makes the content read unnaturally.',
		currentValue: '"plumber Brisbane" × 18 on homepage',
		recommendedValue: "3-5 natural uses with semantic variations (e.g., 'Brisbane plumbing services', 'plumbers in Brisbane')",
		impact: "Risk of ranking penalty. Content reads poorly which reduces trust and conversion.",
	},
	{
		severity: "warning",
		category: "accessibility",
		checkName: "missing_alt_text",
		title: "12 images missing alt text",
		description:
			"12 images across the site have no alt text attribute. Alt text is important for accessibility (screen readers) and helps search engines understand image content, which can drive traffic from Google Image Search.",
		currentValue: "12 images without alt text",
		recommendedValue: "Descriptive alt text on all images including relevant keywords where natural",
		impact: "Accessibility compliance issue. Missing image SEO opportunity for local search visibility.",
	},
	{
		severity: "info",
		category: "technical",
		checkName: "robots_txt",
		title: "robots.txt allows all crawling (review recommended)",
		description:
			"The robots.txt file allows all search engine crawlers unrestricted access. While this is generally fine, it's worth reviewing to ensure no admin pages, staging content, or duplicate paths are being indexed.",
		currentValue: "User-agent: * Allow: /",
		recommendedValue: "Review for any paths that should be excluded from indexing",
		impact: "Low priority — but reviewing ensures no unwanted pages appear in search results.",
	},
	{
		severity: "info",
		category: "meta",
		checkName: "long_meta_desc",
		title: "About page meta description is 178 characters",
		description:
			"The about page meta description is 178 characters, which exceeds Google's typical display limit of 155-160 characters. The description will be truncated in search results.",
		currentValue: "178 characters",
		recommendedValue: "150-160 characters",
		impact: "Minor — description truncation may cut off important information in search snippets.",
		pagePath: "/about",
	},
	{
		severity: "info",
		category: "content",
		checkName: "no_blog_dates",
		title: "Blog posts missing publication dates",
		description:
			"The three blog posts don't display publication dates. Including dates helps users assess content freshness and allows Google to show date snippets in search results.",
		currentValue: "No dates displayed on blog posts",
		recommendedValue: "Add published and last-updated dates using structured data",
		impact: "Users may perceive undated content as outdated. Missing date rich snippets in search results.",
	},
	{
		severity: "opportunity",
		category: "keywords",
		checkName: "keyword_gap",
		title: 'Missing "emergency plumber near me" keyword',
		description:
			'The site doesn\'t target the high-intent keyword "emergency plumber near me" which has significant monthly search volume in Brisbane. This is a missed opportunity for capturing urgent, high-converting traffic.',
		currentValue: "Keyword not targeted on any page",
		recommendedValue: "Create or optimise emergency plumbing page to target 'emergency plumber near me' + Brisbane",
		impact: "Missing high-intent search traffic. Users searching 'near me' keywords have strong purchase intent.",
	},
	{
		severity: "opportunity",
		category: "backlinks",
		checkName: "low_backlinks",
		title: "Only 8 referring domains (industry avg: 35)",
		description:
			"The site has only 8 unique domains linking to it, compared to an industry average of 35 for Brisbane plumbing businesses. Low backlink count limits domain authority and ranking potential.",
		currentValue: "8 referring domains",
		recommendedValue: "25+ referring domains from relevant local and industry sources",
		impact: "Limited domain authority restricts ability to rank for competitive keywords like 'plumber Brisbane'.",
	},
];

const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

export const DEMO_WEB_COPY = [
	{
		copyType: "page_rewrite",
		title: "Homepage — Rewritten for SEO & Conversions",
		content: `# Brisbane's Most Trusted Plumbers — Murray Plumbing Group

When a pipe bursts at 2am or your hot water stops working on a winter morning, you need a plumber you can trust. Murray Plumbing Group has been Brisbane's go-to plumbing team since 2005 — fully licensed, insured, and committed to getting the job done right the first time.

## Why Brisbane Homeowners Choose Murray Plumbing Group

**24/7 Emergency Response** — Plumbing emergencies don't wait, and neither do we. Our emergency plumbers aim to be at your door within 60 minutes, any time of day or night. No call-out fees during business hours.

**Upfront, Honest Pricing** — You'll receive a clear written quote before we touch a single pipe. No hidden costs, no surprise charges. Our 4.8-star Google rating from 127+ reviews proves we deliver on this promise.

**Licensed & Experienced** — Every plumber on our team holds a current QBCC licence and undergoes regular training. We're members of the Master Plumbers Association of Queensland and fully insured for your peace of mind.

## Our Most Popular Services

- **Emergency Plumbing** — Burst pipes, gas leaks, flooding
- **Blocked Drains** — CCTV inspection, hydro-jetting, pipe relining
- **Hot Water Systems** — Installation, repair, replacement
- **Bathroom Renovations** — Design to completion, fully project-managed
- **Gas Fitting** — Licensed gas work with compliance certificates

## Serving All of Brisbane

From our base in Eight Mile Plains, we service Brisbane CBD, Northside (Chermside, Aspley, Strathpine), Southside (Sunnybank, Mt Gravatt, Logan), Western Suburbs (Indooroopilly, Kenmore), and out to Ipswich. Wherever you are in Brisbane, Murray Plumbing Group comes to you.

**Call 0412 345 678 for a free quote** or book online. Emergency? We're available 24/7.`,
		targetKeyword: "plumber brisbane",
		targetWordCount: 1000,
		actualWordCount: 980,
		status: "final" as const,
		promptTokens: 1850,
		completionTokens: 1420,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			task: "page_rewrite",
			target_audience: "Brisbane homeowners",
			tone: "professional, trustworthy",
			seo_focus: true,
			target_keyword: "plumber brisbane",
		},
		createdAt: new Date(twoWeeksAgo + 1 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "page_rewrite",
		title: "About Us — Rewritten",
		content: `# About Murray Plumbing Group — Your Local Brisbane Plumbing Company

Steve Murray started Murray Plumbing Group in 2005 with one van and a simple promise: honest work at a fair price. Today, we're a team of 8 licensed plumbers serving thousands of Brisbane homes and businesses — but that original promise hasn't changed.

## Family-Owned, Locally Operated

We're not a franchise or a call centre. When you call Murray Plumbing Group, you're dealing directly with a Brisbane-based team who know the local area, the local plumbing infrastructure, and the unique challenges Brisbane's climate throws at your pipes. Our office is in Eight Mile Plains and our plumbers live across Brisbane's suburbs.

## Qualified and Committed to Quality

Every Murray Plumbing Group plumber holds a current Queensland Building and Construction Commission (QBCC) licence. We carry $20 million in public liability insurance and provide a written workmanship guarantee on every job. Our team undertakes regular CPD training to stay current with Australian plumbing standards, water efficiency requirements, and new technologies.`,
		targetKeyword: "plumbing company brisbane",
		targetWordCount: 700,
		actualWordCount: 640,
		status: "draft" as const,
		promptTokens: 1620,
		completionTokens: 980,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			task: "page_rewrite",
			target_audience: "Brisbane homeowners",
			tone: "warm, personal, trustworthy",
			seo_focus: true,
			target_keyword: "plumbing company brisbane",
		},
		createdAt: new Date(twoWeeksAgo + 3 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "meta_title",
		title: "Homepage Meta Title",
		content: "Murray Plumbing Group — Licensed Plumber Brisbane | 24/7 Emergency",
		targetKeyword: null,
		targetWordCount: null,
		actualWordCount: 10,
		status: "final" as const,
		promptTokens: 420,
		completionTokens: 28,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			task: "meta_title",
			max_chars: 60,
			include_brand: true,
		},
		createdAt: new Date(twoWeeksAgo + 2 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "meta_description",
		title: "Homepage Meta Description",
		content:
			"Murray Plumbing Group — Brisbane's trusted licensed plumbers since 2005. 24/7 emergency service, upfront pricing, 4.8★ rated. Call 0412 345 678 for a free quote.",
		targetKeyword: "plumber brisbane",
		targetWordCount: null,
		actualWordCount: 22,
		status: "final" as const,
		promptTokens: 480,
		completionTokens: 42,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			task: "meta_description",
			max_chars: 160,
			include_cta: true,
		},
		createdAt: new Date(twoWeeksAgo + 2 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "blog_post",
		title: "When to Call a Plumber vs DIY — A Brisbane Homeowner's Guide",
		content: `# When to Call a Plumber vs DIY — A Brisbane Homeowner's Guide

There's a time for YouTube tutorials and a time for picking up the phone. As licensed Brisbane plumbers, we see the aftermath of DIY plumbing gone wrong every week — and it usually costs more to fix than the original problem. Here's our honest guide to what you can safely handle yourself and when you should call a professional.

## Safe for DIY

**Changing a tap washer** — If your tap is dripping, replacing the washer is a straightforward job. Turn off the water supply to that tap, unscrew the handle, replace the washer (take the old one to Bunnings to match the size), and reassemble. Total cost: about $3.

**Clearing a slow shower drain** — Remove the drain cover, pull out any hair buildup, and flush with boiling water. If that doesn't work, try a drain cleaning product. If it's still slow after that, it's time to call us.

**Replacing a shower head** — Unscrew the old one, wrap the thread with plumber's tape (3-4 wraps clockwise), and screw on the new one. No tools needed other than a rag for grip.

## Call a Plumber

**Anything involving gas** — Gas work must be done by a licensed gas fitter in Queensland. It's not just illegal to DIY gas work — it's genuinely dangerous. Gas leaks cause explosions and carbon monoxide poisoning. Always call a licensed professional.

**Hot water system issues** — These involve electricity, gas, or both, combined with pressurised water. A faulty tempering valve can deliver scalding water. A leaking pressure relief valve may indicate dangerous pressure buildup. Leave hot water to the professionals.

**Blocked sewer lines** — A blocked toilet might seem simple, but if plunging doesn't fix it, the blockage is likely in your sewer line. This requires professional equipment (CCTV camera, electric eel, or hydro-jetter) and knowledge of pipe layouts. Digging in the wrong spot can cause thousands in damage.

## The Cost of Getting It Wrong

We regularly see DIY repairs that have caused more damage than the original problem. A common one: homeowners using chemical drain cleaners repeatedly, which corrodes old clay or PVC pipes and creates a much bigger (and more expensive) problem. Another classic: over-tightening tap fittings and cracking the ceramic basin.

**Our advice:** if you're not 100% confident, call a plumber. A professional diagnosis costs far less than repairing water damage from a DIY job gone wrong.`,
		targetKeyword: "plumbing diy",
		targetWordCount: 1400,
		actualWordCount: 1350,
		status: "draft" as const,
		promptTokens: 2100,
		completionTokens: 1680,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			task: "blog_post",
			target_audience: "Brisbane homeowners",
			tone: "helpful, honest, authoritative",
			seo_focus: true,
			target_keyword: "plumbing diy",
		},
		createdAt: new Date(twoWeeksAgo + 7 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "h1_suggestion",
		title: "Services Page H1 Suggestion",
		content: "Professional Plumbing Services in Brisbane — Residential & Commercial",
		targetKeyword: null,
		targetWordCount: null,
		actualWordCount: 8,
		status: "final" as const,
		promptTokens: 380,
		completionTokens: 18,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			task: "h1_suggestion",
			current_h1: "Our Plumbing Services",
			seo_guidance: "Include location and service type modifiers",
		},
		createdAt: new Date(twoWeeksAgo + 5 * 24 * 60 * 60 * 1000),
	},
];

export const DEMO_SOCIAL_POSTS = [
	{
		copyType: "social_post" as const,
		title: "Emergency Plumbing Services — Facebook",
		content: `🔧 Plumbing emergencies don't wait for business hours — and neither do we!

Murray Plumbing Group is Brisbane's 24/7 emergency plumbing team. Burst pipe at 2am? Blocked drain ruining your Sunday? Gas smell that needs urgent attention?

We aim to be at your door within 60 minutes, any time of day or night.

✅ Licensed & insured
✅ Upfront pricing — even at 3am
✅ Fully stocked vans for one-visit fixes
✅ 4.8★ Google rating from 127+ reviews

Save our number: 0412 345 678

Don't wait for a plumbing disaster to find a plumber you can trust. Share this post so your friends and family have our number when they need it! 💧

#BrisbanePlumber #EmergencyPlumbing #MurrayPlumbingGroup #24HourPlumber #BrisbaneTrades`,
		targetKeyword: "emergency plumber brisbane",
		actualWordCount: 105,
		status: "final" as const,
		promptTokens: 890,
		completionTokens: 320,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			platform: "facebook",
			angle: "engaging",
			topic: "Emergency plumbing services",
			hashtags: [
				"BrisbanePlumber",
				"EmergencyPlumbing",
				"MurrayPlumbingGroup",
				"24HourPlumber",
				"BrisbaneTrades",
			],
			post_goal: "awareness",
			prompt_version: "v1",
		},
		createdAt: new Date(twoWeeksAgo + 2 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "social_post" as const,
		title: "Bathroom Renovation Behind the Scenes — Instagram",
		content: `Before → After: This Indooroopilly bathroom transformation took 12 days from demolition to final handover 🛁✨

Swipe through to see the full journey:

📸 1. The original bathroom — dated tiles, leaking shower, no ventilation
📸 2. Demo day — stripping everything back to the studs
📸 3. New waterproofing membrane applied and inspected
📸 4. Underfloor heating installed before tiling
📸 5. Feature wall with herringbone tiles going in
📸 6. Final result — frameless shower, wall-hung vanity, heated towel rail

The homeowner's brief: "Modern, low-maintenance, and bright." We delivered all three plus a few unexpected touches — like the recessed shampoo niche and the matte black tapware that ties the whole room together.

This was a full gut renovation including all plumbing, waterproofing, tiling, and electrical. Fixed-price quote, no variations, completed on schedule.

Thinking about a bathroom renovation? DM us or call 0412 345 678 for a free consultation and quote.

#BathroomRenovation #BathroomMakeover #BrisbaneBathroom #BeforeAndAfter #PlumberBrisbane #BathroomDesign #HomeRenovation #MurrayPlumbingGroup #IndooroopillyReno`,
		targetKeyword: "bathroom renovation brisbane",
		actualWordCount: 165,
		status: "draft" as const,
		promptTokens: 1100,
		completionTokens: 480,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			platform: "instagram",
			angle: "story_driven",
			topic: "Behind the scenes bathroom reno",
			hashtags: [
				"BathroomRenovation",
				"BathroomMakeover",
				"BrisbaneBathroom",
				"BeforeAndAfter",
				"PlumberBrisbane",
				"BathroomDesign",
				"HomeRenovation",
				"MurrayPlumbingGroup",
			],
			post_goal: "engagement",
			prompt_version: "v1",
		},
		createdAt: new Date(twoWeeksAgo + 6 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "social_post" as const,
		title: "Why Plumbing Maintenance Saves Money — LinkedIn",
		content: `The most expensive plumbing job is the one you could have prevented.

After 15 years of running Murray Plumbing Group in Brisbane, I've seen a clear pattern: businesses that invest in planned plumbing maintenance spend 60-70% less on plumbing overall compared to those who only call when something breaks.

Here's what a basic annual plumbing inspection covers:

→ Check all visible pipes for leaks, corrosion, or damage
→ Test water pressure (high pressure kills hot water systems early)
→ Inspect hot water system anode rod and valves
→ Clear gutters and check downpipe connections
→ CCTV inspection of main sewer line for root intrusion
→ Test backflow prevention devices (mandatory for commercial)

For a typical Brisbane home, this inspection takes 60-90 minutes and costs around $250. Compare that to the average emergency burst pipe repair: $1,200 plus water damage restoration.

For commercial properties, the numbers are even more compelling. A restaurant we service in Fortitude Valley saved $14,000 last year by catching a deteriorating grease trap before it failed — which would have meant a health department closure notice.

The best time to think about your plumbing is when everything's working fine. That's when prevention is cheapest and most effective.

If you manage commercial property or want to protect your home investment, let's chat about a maintenance plan. Link in comments.

#PlumbingMaintenance #PropertyManagement #FacilitiesManagement #Brisbane #PreventiveMaintenance #CommercialPlumbing #PropertyInvestment`,
		targetKeyword: "plumbing maintenance brisbane",
		actualWordCount: 215,
		status: "final" as const,
		promptTokens: 1250,
		completionTokens: 560,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			platform: "linkedin",
			angle: "informative",
			topic: "Why plumbing maintenance saves money",
			hashtags: [
				"PlumbingMaintenance",
				"PropertyManagement",
				"FacilitiesManagement",
				"Brisbane",
				"PreventiveMaintenance",
				"CommercialPlumbing",
			],
			post_goal: "traffic",
			prompt_version: "v1",
		},
		createdAt: new Date(twoWeeksAgo + 10 * 24 * 60 * 60 * 1000),
	},
	{
		copyType: "social_post" as const,
		title: "Quick Tip: Pipe Burst Response — Twitter/X",
		content: `🚨 Pipe burst? Here's what to do RIGHT NOW:

1. Turn off main water valve (front of house, near meter)
2. Open lowest tap to drain remaining water
3. Switch off power if water is near electrics
4. Call us: 0412 345 678

⏱️ We aim to arrive within 60 mins, 24/7.

Most burst pipe damage happens in the first 10 minutes. Knowing where your shut-off valve is can save you thousands.

#BrisbanePlumber #PlumbingTips #EmergencyPlumber`,
		targetKeyword: "burst pipe brisbane",
		actualWordCount: 72,
		status: "draft" as const,
		promptTokens: 620,
		completionTokens: 180,
		modelUsed: "claude-3-5-haiku-20241022",
		generationConfig: {
			platform: "twitter",
			angle: "engaging",
			topic: "Quick tip: pipe burst response",
			hashtags: ["BrisbanePlumber", "PlumbingTips", "EmergencyPlumber"],
			post_goal: "engagement",
			prompt_version: "v1",
		},
		createdAt: new Date(twoWeeksAgo + 12 * 24 * 60 * 60 * 1000),
	},
];
