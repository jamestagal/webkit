/**
 * Seed script to populate a proposal with comprehensive test data
 * Run with: npx tsx scripts/seed-proposal.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { eq } from 'drizzle-orm';
import { pgTable, uuid, text, jsonb, timestamp, varchar } from 'drizzle-orm/pg-core';

// Define just the proposals table schema we need
const proposals = pgTable('proposals', {
	id: uuid('id').primaryKey(),
	title: text('title').notNull().default(''),
	coverImage: text('cover_image'),
	executiveSummary: text('executive_summary').notNull().default(''),
	performanceData: jsonb('performance_data').notNull().default({}),
	opportunityContent: text('opportunity_content').notNull().default(''),
	currentIssues: jsonb('current_issues').notNull().default([]),
	complianceIssues: jsonb('compliance_issues').notNull().default([]),
	roiAnalysis: jsonb('roi_analysis').notNull().default({}),
	performanceStandards: jsonb('performance_standards').notNull().default([]),
	localAdvantageContent: text('local_advantage_content').notNull().default(''),
	proposedPages: jsonb('proposed_pages').notNull().default([]),
	timeline: jsonb('timeline').notNull().default([]),
	closingContent: text('closing_content').notNull().default(''),
	nextSteps: jsonb('next_steps').notNull().default([]),
	consultationPainPoints: jsonb('consultation_pain_points').notNull().default({}),
	consultationGoals: jsonb('consultation_goals').notNull().default({}),
	consultationChallenges: jsonb('consultation_challenges').notNull().default([]),
	clientBusinessName: text('client_business_name').notNull().default(''),
	clientContactName: text('client_contact_name').notNull().default(''),
	clientEmail: varchar('client_email', { length: 255 }).notNull().default(''),
	clientPhone: varchar('client_phone', { length: 50 }).notNull().default(''),
	clientWebsite: text('client_website').notNull().default(''),
	validUntil: timestamp('valid_until', { withTimezone: true }),
	status: varchar('status', { length: 50 }).notNull().default('draft'),
	sentAt: timestamp('sent_at', { withTimezone: true }),
	slug: varchar('slug', { length: 100 }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const PROPOSAL_ID = 'bbbbbbbb-2222-2222-2222-222222222222';

const seedData = {
	title: 'Professional Website Redesign for Murrays Plumbing',
	coverImage: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1200',

	executiveSummary: `Murray's Plumbing has built an excellent reputation over 15 years of serving the Brisbane community. However, your current website is limiting your growth potential and losing customers to competitors with modern online presence.

This proposal outlines a comprehensive website redesign that will transform your digital presence, improve search rankings, and convert more visitors into paying customers. We project a 200% increase in online leads within 6 months of launch.

Our approach combines stunning visual design with proven conversion optimization techniques, ensuring your new website works as hard as you do.`,

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
			'Not mobile responsive - text too small to read',
			'No structured data for local business',
			'Contact form is broken on mobile devices'
		]
	},

	opportunityContent: `The plumbing industry in Brisbane is experiencing significant digital transformation. Recent studies show:

**Market Opportunity:**
• 87% of homeowners search online before calling a plumber
• Emergency plumbing searches have increased 340% in the past 3 years
• Mobile searches for "plumber near me" peak between 6-9pm when most offices are closed
• Businesses with modern websites receive 3x more quote requests

**Your Competitive Advantage:**
Murray's Plumbing has something competitors can't easily replicate - 15 years of trusted service and hundreds of satisfied customers. A modern website will finally showcase this reputation to potential customers searching online.

**The Cost of Inaction:**
Every month without a modern website, you're losing an estimated 40-60 potential customers to competitors who appear more professional online. At an average job value of $450, that's $18,000-$27,000 in lost revenue monthly.`,

	currentIssues: [
		{ text: 'Website takes 6+ seconds to load, causing 53% of visitors to leave', checked: true },
		{ text: 'Not mobile-friendly - 73% of your traffic is mobile', checked: true },
		{ text: 'No online booking system - customers must call during business hours', checked: true },
		{ text: 'Missing Google Business integration and reviews display', checked: true },
		{ text: 'No emergency contact prominently displayed', checked: true },
		{ text: 'Services pages lack detail and pricing guidance', checked: true },
		{ text: 'No SSL certificate - browser shows "Not Secure" warning', checked: true },
		{ text: 'Contact form submissions going to spam folder', checked: false }
	],

	complianceIssues: [
		{ text: 'Missing privacy policy (required under Australian Privacy Act)', checked: true },
		{ text: 'No WCAG 2.1 accessibility compliance', checked: true },
		{ text: 'Cookie consent banner not implemented', checked: true },
		{ text: 'Terms and conditions page missing', checked: false }
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
		{ label: 'SEO Score', value: '90+', icon: 'Search' },
		{ label: 'Accessibility', value: 'WCAG 2.1 AA', icon: 'Eye' },
		{ label: 'Security', value: 'SSL + Security Headers', icon: 'Shield' },
		{ label: 'Uptime', value: '99.9% Guaranteed', icon: 'Server' }
	],

	localAdvantageContent: `**Dominate Brisbane Plumbing Searches**

Your new website will be optimized for local search, helping you capture customers in your service areas:

• **Google Business Profile Integration** - Display your 4.8-star rating prominently
• **Service Area Pages** - Dedicated pages for Brisbane CBD, Northside, Southside, and Western suburbs
• **Local Schema Markup** - Help Google understand your business and display rich results
• **"Near Me" Optimization** - Capture emergency searches from mobile users
• **Review Generation System** - Automated follow-ups to build your online reputation

**Projected Local Search Rankings:**
Within 6 months, we expect page 1 rankings for:
- "Emergency plumber Brisbane"
- "Hot water repairs [suburb]"
- "Blocked drain specialist Brisbane"
- "24 hour plumber near me"`,

	proposedPages: [
		{
			name: 'Home',
			description: 'High-converting landing page with emergency CTA, trust signals, and service overview',
			features: ['24/7 emergency banner', 'Click-to-call button', 'Google reviews widget', 'Service area map', 'Recent projects gallery']
		},
		{
			name: 'Services',
			description: 'Comprehensive service pages with pricing guides and booking integration',
			features: ['Emergency plumbing', 'Hot water systems', 'Blocked drains', 'Gas fitting', 'Bathroom renovations', 'Commercial plumbing']
		},
		{
			name: 'Service Areas',
			description: 'Location-specific pages for local SEO targeting',
			features: ['Brisbane CBD', 'Northside suburbs', 'Southside suburbs', 'Western corridor', 'Each with unique content']
		},
		{
			name: 'About Us',
			description: 'Build trust with your story, team profiles, and credentials',
			features: ['Company history', 'Meet the team', 'Licenses & insurance', 'Our values', 'Community involvement']
		},
		{
			name: 'Projects Gallery',
			description: 'Showcase your best work with before/after photos',
			features: ['Filterable gallery', 'Before/after slider', 'Project details', 'Customer testimonials']
		},
		{
			name: 'Reviews',
			description: 'Dedicated testimonials page with video reviews',
			features: ['Google reviews feed', 'Video testimonials', 'Case studies', 'Trust badges']
		},
		{
			name: 'Blog',
			description: 'SEO-focused content hub for plumbing tips and guides',
			features: ['DIY tips', 'Seasonal maintenance guides', 'Emergency preparation', 'Cost guides']
		},
		{
			name: 'Contact',
			description: 'Multiple contact options with instant booking',
			features: ['Online booking form', 'Live chat widget', 'Click-to-call', 'Service area map', 'Business hours']
		}
	],

	timeline: [
		{
			week: 'Week 1-2',
			title: 'Discovery & Strategy',
			description: 'Deep dive into your business, competitors, and target customers. Define site architecture, content strategy, and design direction.'
		},
		{
			week: 'Week 3-4',
			title: 'Design & Prototyping',
			description: 'Create visual designs for all key pages. You\'ll review and approve designs before any development begins.'
		},
		{
			week: 'Week 5-7',
			title: 'Development',
			description: 'Build your new website with all functionality including booking system, reviews integration, and contact forms.'
		},
		{
			week: 'Week 8',
			title: 'Content & SEO',
			description: 'Finalize all page content, implement SEO optimizations, and set up Google Analytics and Search Console.'
		},
		{
			week: 'Week 9',
			title: 'Testing & Training',
			description: 'Comprehensive testing across all devices. Training session on how to manage your new website.'
		},
		{
			week: 'Week 10',
			title: 'Launch & Support',
			description: 'Go live with your new website. We\'ll monitor performance and make any necessary adjustments.'
		}
	],

	closingContent: `**Why Choose Plentify Web Designs?**

We specialize in websites for trade businesses. We understand that you need a website that generates leads while you're on the tools, not just a pretty brochure.

**Our Guarantee:**
• If your new website doesn't generate more leads than your current site within 90 days, we'll work for free until it does
• 12 months of priority support included
• No hidden fees - the price you see is the price you pay

**Ready to Transform Your Online Presence?**

Every week without a modern website is costing you customers. Let's have a quick call to discuss how we can help Murray's Plumbing dominate online.

Click "Accept Proposal" below to get started, or "Request Changes" if you'd like to discuss any modifications.`,

	nextSteps: [
		{ text: 'Sign contract and pay 50% deposit', completed: false },
		{ text: 'Complete website questionnaire (15 mins)', completed: false },
		{ text: 'Provide logo files and brand guidelines', completed: false },
		{ text: 'Share login details for current hosting', completed: false },
		{ text: 'Schedule kickoff call', completed: false },
		{ text: 'Review and approve designs', completed: false },
		{ text: 'Provide content/photos for team page', completed: false },
		{ text: 'Final review before launch', completed: false }
	],

	consultationPainPoints: {
		primary_challenges: [
			'Not getting enough leads from website',
			'Competitors ranking higher on Google',
			'Website looks outdated and unprofessional'
		],
		technical_issues: [
			'Site is slow and crashes on mobile',
			'Contact form not working properly',
			'Can\'t update content ourselves'
		],
		solution_gaps: [
			'No online booking system',
			'No way to showcase reviews',
			'Missing emergency contact options'
		]
	},

	consultationGoals: {
		primary_goals: [
			'Generate more leads online',
			'Rank on first page of Google',
			'Look more professional than competitors'
		],
		secondary_goals: [
			'Reduce phone calls for basic questions',
			'Showcase our 15 years of experience',
			'Enable online booking for non-emergency jobs'
		],
		success_metrics: [
			'50+ new leads per month',
			'Top 3 ranking for "plumber Brisbane"',
			'90+ Google PageSpeed score'
		]
	},

	consultationChallenges: [
		'Current website is 8 years old and built on outdated technology',
		'Lost 3 large commercial contracts to competitors with better websites',
		'Spending $2000/month on Google Ads with poor landing page conversion',
		'Staff spending 2+ hours daily answering basic questions that could be on website'
	],

	clientBusinessName: 'Murrays Plumbing',
	clientContactName: 'Steve Murray',
	clientEmail: 'steve@murraysplumbing.com.au',
	clientPhone: '0412 345 678',
	clientWebsite: 'https://murraysplumbing.com.au',

	validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

async function seedProposal() {
	console.log('Connecting to database...');

	const pool = new Pool({
		host: 'localhost',
		port: 5432,
		database: 'postgres',
		user: 'postgres',
		password: 'postgres',
	});

	const db = drizzle(pool);

	console.log('Seeding proposal data...');

	try {
		const [updated] = await db
			.update(proposals)
			.set({
				title: seedData.title,
				coverImage: seedData.coverImage,
				executiveSummary: seedData.executiveSummary,
				performanceData: seedData.performanceData,
				opportunityContent: seedData.opportunityContent,
				currentIssues: seedData.currentIssues,
				complianceIssues: seedData.complianceIssues,
				roiAnalysis: seedData.roiAnalysis,
				performanceStandards: seedData.performanceStandards,
				localAdvantageContent: seedData.localAdvantageContent,
				proposedPages: seedData.proposedPages,
				timeline: seedData.timeline,
				closingContent: seedData.closingContent,
				nextSteps: seedData.nextSteps,
				consultationPainPoints: seedData.consultationPainPoints,
				consultationGoals: seedData.consultationGoals,
				consultationChallenges: seedData.consultationChallenges,
				clientBusinessName: seedData.clientBusinessName,
				clientContactName: seedData.clientContactName,
				clientEmail: seedData.clientEmail,
				clientPhone: seedData.clientPhone,
				clientWebsite: seedData.clientWebsite,
				validUntil: seedData.validUntil,
				status: 'draft',
				sentAt: null,
				updatedAt: new Date()
			})
			.where(eq(proposals.id, PROPOSAL_ID))
			.returning();

		if (updated) {
			console.log('✅ Proposal seeded successfully!');
			console.log(`   Title: ${updated.title}`);
			console.log(`   Status: ${updated.status}`);
			console.log(`   Slug: ${updated.slug}`);
			console.log(`\n   View at: http://localhost:3000/p/${updated.slug}`);
		} else {
			console.log('❌ Proposal not found with ID:', PROPOSAL_ID);
		}
	} catch (error) {
		console.error('Error seeding proposal:', error);
	}

	await pool.end();
	process.exit(0);
}

seedProposal();
