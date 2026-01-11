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
// CONSULTATION DATA
// ============================================================================

export const DEMO_CONSULTATION = {
	contactInfo: {
		business_name: "Demo: Murray's Plumbing",
		contact_person: 'Steve Murray',
		email: 'steve@murraysplumbing.com.au',
		phone: '0412 345 678',
		website: 'https://murraysplumbing.com.au',
		social_media: {
			facebook: 'facebook.com/murraysplumbing',
			instagram: '@murrays_plumbing_brisbane',
			google_business: "Murray's Plumbing Brisbane"
		}
	},

	businessContext: {
		industry: 'trades_services',
		business_type: 'established_business',
		team_size: 8,
		years_in_business: 15,
		annual_revenue: '$800,000 - $1,200,000',
		current_platform: 'WordPress (outdated theme)',
		platform_age_years: 8,
		service_areas: [
			'Brisbane CBD',
			'Northside',
			'Southside',
			'Western Suburbs',
			'Ipswich'
		],
		digital_presence: ['website', 'google_business', 'facebook', 'instagram'],
		marketing_channels: [
			'google_ads',
			'word_of_mouth',
			'vehicle_signage',
			'local_sponsorships'
		],
		competitors: ['Brisbane Plumbing Co', 'Jet Plumbing', 'Salmon Plumbing'],
		unique_selling_points: [
			'15 years local experience',
			'24/7 emergency service',
			'Licensed gas fitter',
			'Family-owned business',
			'4.8 star Google rating (127 reviews)'
		],
		services_offered: [
			'Emergency plumbing',
			'Hot water system installation & repairs',
			'Blocked drains & drain cleaning',
			'Gas fitting & gas leak detection',
			'Bathroom renovations',
			'Commercial plumbing maintenance',
			'Backflow prevention testing',
			'Water leak detection'
		]
	},

	painPoints: {
		primary_challenges: [
			'Not getting enough leads from website - currently only 5-10 per month',
			'Competitors ranking higher on Google for key search terms',
			'Website looks outdated and unprofessional compared to competitors',
			'Spending $2,000/month on Google Ads with 2% conversion rate',
			'Losing potential commercial contracts due to poor online presence'
		],
		technical_issues: [
			'Site takes 6+ seconds to load on mobile devices',
			'Contact form submissions often go to spam folder',
			'Cannot update content ourselves - need to pay developer each time',
			'Website crashes when traffic spikes during emergencies',
			'Images are not optimized - homepage is 4MB+',
			'No SSL certificate - shows "Not Secure" warning'
		],
		urgency_level: 'high',
		impact_assessment:
			'Estimating $18,000-$27,000 in lost monthly revenue due to website issues. Lost 3 large commercial contracts ($15,000+) in past 6 months to competitors with better websites.',
		current_solution_gaps: [
			'No online booking system - must call during business hours only',
			'No way to showcase 127 Google reviews on website',
			'Missing emergency contact button - buried in footer',
			'No service area pages for local SEO',
			'No way to display before/after project photos',
			'Cannot accept online payments for deposits'
		]
	},

	goalsObjectives: {
		primary_goals: [
			'Generate 50+ qualified leads per month from website',
			'Rank on first page of Google for "plumber Brisbane" and related terms',
			'Look more professional than top 3 competitors',
			'Reduce dependency on paid advertising over time'
		],
		secondary_goals: [
			'Reduce phone calls for basic questions',
			'Showcase 15 years of experience and trusted reputation',
			'Enable online booking for non-emergency jobs',
			'Build email list for seasonal maintenance reminders'
		],
		success_metrics: [
			'50+ new leads per month within 6 months',
			'Top 3 ranking for "emergency plumber Brisbane"',
			'90+ Google PageSpeed score',
			'5% conversion rate on website traffic'
		],
		kpis: [
			'Monthly website leads',
			'Google search ranking positions',
			'Website conversion rate',
			'Cost per lead'
		],
		timeline: {
			desired_start: 'As soon as possible',
			target_completion: 'Within 10 weeks',
			milestones: [
				'Design approval within 2 weeks',
				'Development complete within 6 weeks',
				'Launch and training within 10 weeks'
			]
		},
		budget_range: '$5,000 - $10,000',
		budget_constraints: [
			'Prefer lower upfront with monthly payments over lump sum',
			'Need to see clear ROI justification',
			'Monthly ongoing costs must be under $300'
		]
	}
};

// ============================================================================
// PROPOSAL DATA
// ============================================================================

export const DEMO_PROPOSAL = {
	title: "Demo: Website Redesign Proposal for Murray's Plumbing",
	status: 'draft' as const,
	coverImage:
		'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1200',
	executiveSummary: `Murray's Plumbing has built an excellent reputation over 15 years of serving the Brisbane community. However, your current website is limiting your growth potential and losing customers to competitors with modern online presence.

This proposal outlines a comprehensive website redesign that will transform your digital presence, improve search rankings, and convert more visitors into paying customers. We project a 200% increase in online leads within 6 months of launch.`,

	performanceData: {
		performance: 34,
		accessibility: 52,
		bestPractices: 61,
		seo: 45,
		loadTime: '6.8s',
		issues: [
			'Page takes over 6 seconds to load on mobile',
			'Images are not optimized (3.2MB average)',
			'No SSL certificate installed',
			'Missing meta descriptions on all pages',
			'Not mobile responsive - text too small to read'
		]
	},

	opportunityContent: `The plumbing industry in Brisbane is experiencing significant digital transformation. Customers increasingly expect to find, compare, and book services online. Your competitors are capitalizing on this shift with modern websites that convert visitors into leads.`,

	currentIssues: [
		{
			text: 'Website takes 6+ seconds to load, causing 53% of visitors to leave',
			checked: true
		},
		{
			text: 'Not mobile-friendly - 73% of your traffic is mobile',
			checked: true
		},
		{
			text: 'No online booking system - customers must call during business hours',
			checked: true
		}
	],

	complianceIssues: [
		{
			text: 'Missing privacy policy (required under Australian Privacy Act)',
			checked: true
		},
		{ text: 'No WCAG 2.1 accessibility compliance', checked: true }
	],

	roiAnalysis: {
		currentVisitors: 450,
		projectedVisitors: 1350,
		conversionRate: 4.5,
		projectedLeads: 61,
		averageProjectValue: 485,
		projectedRevenue: 29585
	},

	performanceStandards: [
		{ label: 'Page Load Speed', value: 'Under 2 seconds', icon: 'Zap' },
		{ label: 'Mobile Score', value: '95+', icon: 'Smartphone' },
		{ label: 'SEO Score', value: '90+', icon: 'Search' }
	],

	localAdvantageContent: `**Dominate Brisbane Plumbing Searches**

With proper local SEO optimization, your new website will target customers actively searching for plumbing services in your service areas.`,

	proposedPages: [
		{
			name: 'Home',
			description: 'High-converting landing page with emergency CTA',
			features: ['24/7 emergency banner', 'Click-to-call button']
		},
		{
			name: 'Services',
			description: 'Comprehensive service pages',
			features: ['Emergency plumbing', 'Hot water systems']
		},
		{
			name: 'Contact',
			description: 'Multiple contact options',
			features: ['Online booking form', 'Live chat widget']
		}
	],

	timeline: [
		{
			week: 'Week 1-2',
			title: 'Discovery & Strategy',
			description: 'Deep dive into your business and create design strategy'
		},
		{
			week: 'Week 3-4',
			title: 'Design & Prototyping',
			description: 'Create visual designs and interactive prototypes'
		},
		{
			week: 'Week 5-7',
			title: 'Development',
			description: 'Build your new website with all features'
		}
	],

	closingContent: `**Why Choose Us?**

We specialize in helping trade businesses like yours succeed online. Our websites are built to convert visitors into customers, with a focus on mobile performance and local SEO.`,

	nextSteps: [
		{ text: 'Sign contract and pay 50% deposit', completed: false },
		{ text: 'Complete website questionnaire (15 mins)', completed: false }
	],

	consultationPainPoints: {
		primary_challenges: [
			'Not getting enough leads from website',
			'Competitors ranking higher on Google'
		],
		technical_issues: [
			'Site is slow and crashes on mobile',
			'Contact form not working properly'
		],
		solution_gaps: [
			'No online booking system',
			'No way to showcase reviews'
		]
	},

	consultationGoals: {
		primary_goals: [
			'Generate more leads online',
			'Rank on first page of Google'
		],
		secondary_goals: ['Reduce phone calls for basic questions'],
		success_metrics: [
			'50+ new leads per month',
			'Top 3 ranking for "plumber Brisbane"'
		]
	},

	consultationChallenges: [
		'Current website is 8 years old and built on outdated technology',
		'Lost 3 large commercial contracts to competitors with better websites'
	],

	clientBusinessName: "Demo: Murray's Plumbing",
	clientContactName: 'Steve Murray',
	clientEmail: 'steve@murraysplumbing.com.au',
	clientPhone: '0412 345 678',
	clientWebsite: 'https://murraysplumbing.com.au',

	// Note: selectedPackageId, selectedAddons, and customPricing are set dynamically
	// in demo.remote.ts by querying the agency's actual packages and addons
	validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
	viewCount: 0
};

// ============================================================================
// CONTRACT DATA
// ============================================================================

export const DEMO_CONTRACT = {
	status: 'draft' as const,
	version: 1,
	clientBusinessName: "Demo: Murray's Plumbing",
	clientContactName: 'Steve Murray',
	clientEmail: 'steve@murraysplumbing.com.au',
	clientPhone: '0412 345 678',
	clientAddress: '42 Trade Street\nEight Mile Plains QLD 4113',

	servicesDescription: `## Website Design & Development Services

### Package: Growth Package

This agreement covers the design, development, and launch of a professional business website including:

- Up to 12 custom-designed pages
- Mobile-responsive design
- Online booking integration
- Google Business Profile setup
- Advanced SEO optimization
- Monthly content updates (2 hrs)
- Monthly performance reports`,

	commencementDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	completionDate: new Date(Date.now() + 77 * 24 * 60 * 60 * 1000),

	specialConditions: `## Additional Terms for Murray's Plumbing

1. Client to provide all content (text, images) within 2 weeks of project start
2. Up to 3 rounds of design revisions included
3. Training session (2 hours) included for content management
4. 12-month hosting and support included`,

	totalPrice: '4838.00',
	priceIncludesGst: true,
	paymentTerms: `Setup Fee: $2,450 (inc. GST) - due upon contract signing
Monthly Retainer: $199/month (inc. GST) - 12-month minimum term`,

	validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),

	agencySignatoryName: 'Agency Director',
	agencySignatoryTitle: 'Director',
	agencySignedAt: new Date(),

	viewCount: 0,
	visibleFields: [
		'services',
		'commencementDate',
		'completionDate',
		'price',
		'paymentTerms',
		'specialConditions'
	],
	includedScheduleIds: [] as string[]
};

// ============================================================================
// QUESTIONNAIRE DATA
// ============================================================================

export const DEMO_QUESTIONNAIRE = {
	clientBusinessName: "Demo: Murray's Plumbing",
	clientEmail: 'steve@murraysplumbing.com.au',
	responses: {
		// Section 1: Business Overview
		business_name: "Murray's Plumbing",
		business_tagline: "Brisbane's Most Trusted Plumber Since 2010",
		business_description: `Murray's Plumbing is a family-owned plumbing business serving the Greater Brisbane area for over 15 years. We specialize in residential and commercial plumbing services with a team of 8 licensed plumbers providing 24/7 emergency services.`,
		years_in_business: '15',
		number_of_employees: '8',
		target_audience: `Primary customers: Homeowners in Brisbane suburbs (ages 35-65), property managers, small to medium commercial businesses.`,
		unique_selling_points: `24/7 Emergency Response, 15 Years Experience, Transparent Pricing, Licensed Gas Fitters, Family Values`,
		main_services: [
			'Emergency plumbing (24/7)',
			'Hot water system installation',
			'Blocked drain clearing',
			'Gas fitting',
			'Bathroom renovations'
		],
		service_areas:
			'Greater Brisbane including CBD, Northside, Southside, Western Suburbs, and Ipswich',

		// Section 2: Brand Identity
		existing_logo: 'yes',
		logo_satisfaction: 'satisfied_minor_updates',
		brand_colors: 'Primary Blue: #0066CC, Accent Orange: #FF6600, White: #FFFFFF',
		brand_personality:
			'Trustworthy, Professional, Approachable, Family-oriented, Responsive',
		brand_tone_of_voice: 'friendly_professional',

		// Section 3: Current Website
		has_current_website: 'yes',
		current_website_url: 'https://murraysplumbing.com.au',
		current_website_likes: 'Phone number displayed, basic contact form, Google Maps',
		current_website_dislikes:
			'Slow loading (6+ seconds), not mobile friendly, outdated design, broken forms',
		domain_hosting_access: 'yes',

		// Section 4: Website Goals
		primary_website_goal: 'lead_generation',
		secondary_website_goals: ['brand_awareness', 'customer_support'],
		target_monthly_leads: '50+',
		success_metrics:
			'50+ leads/month, Top 3 Google ranking, 5% conversion rate, 90+ PageSpeed score',

		// Section 5: Content & Features
		required_pages: [
			'Home',
			'About Us',
			'Services',
			'Contact',
			'Book Online'
		],
		must_have_features: [
			'Click-to-call button',
			'Online booking',
			'Google Reviews',
			'Service area map'
		],

		// Section 6: Design Preferences
		design_style_preference: 'modern_professional',
		mobile_importance: '10_critical',

		// Section 7: Technical Requirements
		cms_preference: 'open_to_recommendation',
		integrations_required: [
			'Google Analytics',
			'Google Business',
			'Live chat'
		],

		// Section 8: Timeline & Budget
		ideal_launch_date: 'Within 10 weeks',
		budget_range: '$5,000 - $10,000',
		decision_makers: 'Steve Murray (Owner), Karen Murray (Office Manager)'
	},
	currentSection: 8,
	completionPercentage: 100,
	status: 'completed' as const,
	startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
	completedAt: new Date(),
	lastActivityAt: new Date()
};

// ============================================================================
// INVOICE DATA
// ============================================================================

export const DEMO_INVOICE = {
	status: 'draft' as const,
	clientBusinessName: "Demo: Murray's Plumbing",
	clientContactName: 'Steve Murray',
	clientEmail: 'steve@murraysplumbing.com.au',
	clientPhone: '0412 345 678',
	clientAddress: '42 Trade Street\nEight Mile Plains QLD 4113',
	clientAbn: '',

	issueDate: new Date(),
	dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),

	subtotal: '2227.27',
	discountAmount: '0.00',
	discountDescription: '',
	gstAmount: '222.73',
	total: '2450.00',

	gstRegistered: true,
	gstRate: '10.00',
	paymentTerms: 'NET_7' as const,
	paymentTermsCustom: '',

	notes: 'Deposit invoice for website project',
	publicNotes: `## Payment Details

**Bank Transfer:**
Please use your invoice number as the reference.`,

	viewCount: 0,
	onlinePaymentEnabled: true
};
