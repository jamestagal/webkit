/**
 * Drizzle Schema for Remote Functions
 *
 * Mirrors the Go backend PostgreSQL schema exactly.
 * Used by remote functions for direct database access.
 */

import {
	pgTable,
	uuid,
	text,
	timestamp,
	integer,
	varchar,
	jsonb,
	boolean,
	bigint,
	unique,
	decimal,
	index
} from 'drizzle-orm/pg-core';

// =============================================================================
// USER TABLE
// =============================================================================

// Users table (referenced by consultations and agencies)
export const users = pgTable('users', {
	id: uuid('id').primaryKey(),
	created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
	updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
	email: text('email').notNull(),
	phone: text('phone').notNull().default(''),
	access: bigint('access', { mode: 'number' }).notNull(),
	sub: text('sub').notNull(),
	avatar: text('avatar').notNull().default(''),
	customerId: text('customer_id').notNull().default(''),
	subscriptionId: text('subscription_id').notNull().default(''),
	subscriptionEnd: timestamp('subscription_end', { withTimezone: true })
		.notNull()
		.default(new Date('2000-01-01')),
	apiKey: text('api_key').notNull().default(''),
	defaultAgencyId: uuid('default_agency_id') // Added for multi-tenancy
});

// =============================================================================
// AGENCY / MULTI-TENANCY TABLES
// =============================================================================

// Agencies table - Core tenant table
export const agencies = pgTable('agencies', {
	id: uuid('id').primaryKey().defaultRandom(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

	// Basic Information
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(), // URL-friendly identifier

	// Branding
	logoUrl: text('logo_url').notNull().default(''),
	primaryColor: text('primary_color').notNull().default('#4F46E5'),
	secondaryColor: text('secondary_color').notNull().default('#1E40AF'),
	accentColor: text('accent_color').notNull().default('#F59E0B'),
	accentGradient: text('accent_gradient').notNull().default(''), // CSS gradient for backgrounds

	// Contact
	email: text('email').notNull().default(''),
	phone: text('phone').notNull().default(''),
	website: text('website').notNull().default(''),

	// Status & Billing
	status: varchar('status', { length: 50 }).notNull().default('active'),
	subscriptionTier: varchar('subscription_tier', { length: 50 }).notNull().default('free'),
	subscriptionId: text('subscription_id').notNull().default(''),
	subscriptionEnd: timestamp('subscription_end', { withTimezone: true }),

	// Soft delete (GDPR compliance)
	deletedAt: timestamp('deleted_at', { withTimezone: true }),
	deletionScheduledFor: timestamp('deletion_scheduled_for', { withTimezone: true })
});

// Agency Memberships table - User-Agency relationships
export const agencyMemberships = pgTable(
	'agency_memberships',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Role within agency
		role: varchar('role', { length: 50 }).notNull().default('member'),

		// User-specific settings within agency
		displayName: text('display_name').notNull().default(''),

		// Status
		status: varchar('status', { length: 50 }).notNull().default('active'),
		invitedAt: timestamp('invited_at', { withTimezone: true }),
		invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
		acceptedAt: timestamp('accepted_at', { withTimezone: true })
	},
	(table) => ({
		uniqueUserAgency: unique().on(table.userId, table.agencyId)
	})
);

// Agency Form Options table - Configurable form presets per agency
export const agencyFormOptions = pgTable(
	'agency_form_options',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Option category
		category: varchar('category', { length: 100 }).notNull(),

		// Option details
		value: text('value').notNull(),
		label: text('label').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		isDefault: boolean('is_default').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),

		// Optional metadata
		metadata: jsonb('metadata').notNull().default({})
	},
	(table) => ({
		uniqueAgencyCategoryValue: unique().on(table.agencyId, table.category, table.value)
	})
);

// Agency Proposal Templates table - Proposal customization per agency
export const agencyProposalTemplates = pgTable('agency_proposal_templates', {
	id: uuid('id').primaryKey().defaultRandom(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

	agencyId: uuid('agency_id')
		.notNull()
		.references(() => agencies.id, { onDelete: 'cascade' }),

	name: text('name').notNull(),
	isDefault: boolean('is_default').notNull().default(false),

	// Template sections (JSONB for flexibility)
	sections: jsonb('sections').notNull().default([]),

	// Footer/Header content
	headerContent: text('header_content').notNull().default(''),
	footerContent: text('footer_content').notNull().default(''),

	// PDF/Document settings
	settings: jsonb('settings').notNull().default({})
});

// =============================================================================
// AUDIT TRAIL & COMPLIANCE
// =============================================================================

// Agency Activity Log table - Audit trail for compliance
export const agencyActivityLog = pgTable('agency_activity_log', {
	id: uuid('id').primaryKey().defaultRandom(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

	agencyId: uuid('agency_id')
		.notNull()
		.references(() => agencies.id, { onDelete: 'cascade' }),
	userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // Nullable for system actions

	// Action details
	action: varchar('action', { length: 100 }).notNull(), // e.g., 'member.invited', 'settings.updated'
	entityType: varchar('entity_type', { length: 50 }).notNull(), // e.g., 'member', 'consultation'
	entityId: uuid('entity_id'), // ID of the affected entity

	// Change details (for auditing)
	oldValues: jsonb('old_values'), // Previous values (for updates)
	newValues: jsonb('new_values'), // New values (for creates/updates)

	// Request context (for security)
	ipAddress: text('ip_address'), // Using text instead of inet for simplicity
	userAgent: text('user_agent'),

	// Additional metadata
	metadata: jsonb('metadata').notNull().default({})
});

// =============================================================================
// AGENCY PROFILE, PACKAGES & ADD-ONS (V2 Foundation)
// =============================================================================

// Agency Profiles table - Extended business details for documents
export const agencyProfiles = pgTable('agency_profiles', {
	id: uuid('id').primaryKey().defaultRandom(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

	agencyId: uuid('agency_id')
		.notNull()
		.unique()
		.references(() => agencies.id, { onDelete: 'cascade' }),

	// Business Registration
	abn: varchar('abn', { length: 20 }).notNull().default(''),
	acn: varchar('acn', { length: 20 }).notNull().default(''),
	legalEntityName: text('legal_entity_name').notNull().default(''),
	tradingName: text('trading_name').notNull().default(''),

	// Address
	addressLine1: text('address_line_1').notNull().default(''),
	addressLine2: text('address_line_2').notNull().default(''),
	city: varchar('city', { length: 100 }).notNull().default(''),
	state: varchar('state', { length: 50 }).notNull().default(''),
	postcode: varchar('postcode', { length: 20 }).notNull().default(''),
	country: varchar('country', { length: 100 }).notNull().default('Australia'),

	// Banking (for invoice display)
	bankName: varchar('bank_name', { length: 100 }).notNull().default(''),
	bsb: varchar('bsb', { length: 10 }).notNull().default(''),
	accountNumber: varchar('account_number', { length: 30 }).notNull().default(''),
	accountName: text('account_name').notNull().default(''),

	// Tax & GST
	gstRegistered: boolean('gst_registered').notNull().default(true),
	taxFileNumber: varchar('tax_file_number', { length: 20 }).notNull().default(''),
	gstRate: decimal('gst_rate', { precision: 5, scale: 2 }).notNull().default('10.00'),

	// Social & Branding
	tagline: text('tagline').notNull().default(''),
	socialLinkedin: text('social_linkedin').notNull().default(''),
	socialFacebook: text('social_facebook').notNull().default(''),
	socialInstagram: text('social_instagram').notNull().default(''),
	socialTwitter: text('social_twitter').notNull().default(''),
	brandFont: varchar('brand_font', { length: 100 }).notNull().default(''),

	// Document Defaults
	defaultPaymentTerms: varchar('default_payment_terms', { length: 50 }).notNull().default('NET_14'),
	invoicePrefix: varchar('invoice_prefix', { length: 20 }).notNull().default('INV'),
	invoiceFooter: text('invoice_footer').notNull().default(''),
	nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
	contractPrefix: varchar('contract_prefix', { length: 20 }).notNull().default('CON'),
	contractFooter: text('contract_footer').notNull().default(''),
	nextContractNumber: integer('next_contract_number').notNull().default(1),
	proposalPrefix: varchar('proposal_prefix', { length: 20 }).notNull().default('PROP'),
	nextProposalNumber: integer('next_proposal_number').notNull().default(1),

	// Stripe Connect
	stripeAccountId: varchar('stripe_account_id', { length: 255 }),
	stripeAccountStatus: varchar('stripe_account_status', { length: 50 })
		.notNull()
		.default('not_connected'), // not_connected, pending, active, restricted, disabled
	stripeOnboardingComplete: boolean('stripe_onboarding_complete').notNull().default(false),
	stripeConnectedAt: timestamp('stripe_connected_at', { withTimezone: true }),
	stripePayoutsEnabled: boolean('stripe_payouts_enabled').notNull().default(false),
	stripeChargesEnabled: boolean('stripe_charges_enabled').notNull().default(false)
});

// Agency Packages table - Configurable pricing tiers per agency
export const agencyPackages = pgTable(
	'agency_packages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Package Identity
		name: varchar('name', { length: 100 }).notNull(),
		slug: varchar('slug', { length: 50 }).notNull(),
		description: text('description').notNull().default(''),

		// Pricing Model
		pricingModel: varchar('pricing_model', { length: 50 }).notNull(), // subscription, lump_sum, hybrid

		// All prices in AUD dollars (DECIMAL for precision)
		setupFee: decimal('setup_fee', { precision: 10, scale: 2 }).notNull().default('0.00'),
		monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).notNull().default('0.00'),
		oneTimePrice: decimal('one_time_price', { precision: 10, scale: 2 }).notNull().default('0.00'),
		hostingFee: decimal('hosting_fee', { precision: 10, scale: 2 }).notNull().default('0.00'),

		// Terms
		minimumTermMonths: integer('minimum_term_months').notNull().default(12),
		cancellationFeeType: varchar('cancellation_fee_type', { length: 50 }), // none, fixed, remaining_balance
		cancellationFeeAmount: decimal('cancellation_fee_amount', { precision: 10, scale: 2 })
			.notNull()
			.default('0.00'),

		// Included Features (JSONB array of strings)
		includedFeatures: jsonb('included_features').notNull().default([]),
		maxPages: integer('max_pages'), // NULL = unlimited

		// Display Settings
		displayOrder: integer('display_order').notNull().default(0),
		isFeatured: boolean('is_featured').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true)
	},
	(table) => ({
		uniqueAgencySlug: unique().on(table.agencyId, table.slug)
	})
);

// Agency Add-ons table - Optional services per package
export const agencyAddons = pgTable(
	'agency_addons',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Add-on Identity
		name: varchar('name', { length: 100 }).notNull(),
		slug: varchar('slug', { length: 50 }).notNull(),
		description: text('description').notNull().default(''),

		// Pricing (AUD dollars)
		price: decimal('price', { precision: 10, scale: 2 }).notNull(),
		pricingType: varchar('pricing_type', { length: 50 }).notNull(), // one_time, monthly, per_unit
		unitLabel: varchar('unit_label', { length: 50 }), // e.g., "page", "hour" (for per_unit)

		// Availability (JSONB array of package slugs, empty = all packages)
		availablePackages: jsonb('available_packages').notNull().default([]),

		// Display Settings
		displayOrder: integer('display_order').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true)
	},
	(table) => ({
		uniqueAgencySlug: unique().on(table.agencyId, table.slug)
	})
);

// =============================================================================
// PROPOSALS (V2 Document Generation)
// =============================================================================

// Proposals table - Client proposals generated from consultations
export const proposals = pgTable(
	'proposals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Link to consultation (optional - can create standalone proposals)
		consultationId: uuid('consultation_id').references(() => consultations.id, {
			onDelete: 'set null'
		}),

		// Document identification
		proposalNumber: varchar('proposal_number', { length: 50 }).notNull(), // PROP-2025-0001
		slug: varchar('slug', { length: 100 }).notNull().unique(), // Public URL slug

		// Status workflow: draft, sent, viewed, accepted, declined, expired
		status: varchar('status', { length: 50 }).notNull().default('draft'),

		// Client info (denormalized for standalone proposals or overrides)
		clientBusinessName: text('client_business_name').notNull().default(''),
		clientContactName: text('client_contact_name').notNull().default(''),
		clientEmail: varchar('client_email', { length: 255 }).notNull().default(''),
		clientPhone: varchar('client_phone', { length: 50 }).notNull().default(''),
		clientWebsite: text('client_website').notNull().default(''),

		// Cover & Introduction
		title: text('title').notNull().default('Website Proposal'),
		coverImage: text('cover_image'), // Optional hero image URL

		// Performance Analysis (manual entry after PageSpeed audit)
		performanceData: jsonb('performance_data').notNull().default({}),
		// { performance: 45, accessibility: 78, bestPractices: 82, seo: 65, loadTime: '4.2s', issues: [...] }

		// The Opportunity (manual research about client's industry/business)
		opportunityContent: text('opportunity_content').notNull().default(''),

		// Current Issues (checklist items)
		currentIssues: jsonb('current_issues').notNull().default([]),
		// [{ text: 'Site is not mobile responsive', checked: true }, ...]

		// Compliance Issues (optional section)
		complianceIssues: jsonb('compliance_issues').notNull().default([]),
		// [{ text: 'WCAG accessibility standards not met', checked: true }, ...]

		// ROI Analysis (optional section)
		roiAnalysis: jsonb('roi_analysis').notNull().default({}),
		// { currentVisitors: 500, projectedVisitors: 1500, conversionRate: 2.5, projectedLeads: 37 }

		// Performance Standards (metrics the new site will achieve)
		performanceStandards: jsonb('performance_standards').notNull().default([]),
		// [{ label: 'Page Load', value: '<2s' }, { label: 'Mobile Score', value: '95+' }, ...]

		// Local Advantage (optional section for local SEO focus)
		localAdvantageContent: text('local_advantage_content').notNull().default(''),

		// Site Architecture (proposed pages)
		proposedPages: jsonb('proposed_pages').notNull().default([]),
		// [{ name: 'Home', description: 'Modern homepage with...', features: [...] }, ...]

		// Implementation Timeline
		timeline: jsonb('timeline').notNull().default([]),
		// [{ week: '1-2', title: 'Discovery & Design', description: '...' }, ...]

		// Closing section
		closingContent: text('closing_content').notNull().default(''),

		// Package selection
		selectedPackageId: uuid('selected_package_id').references(() => agencyPackages.id, {
			onDelete: 'set null'
		}),
		selectedAddons: jsonb('selected_addons').notNull().default([]), // addon IDs

		// Price overrides (if different from package defaults)
		customPricing: jsonb('custom_pricing'), // { setupFee, monthlyPrice, discountPercent, discountNote }

		// Validity
		validUntil: timestamp('valid_until', { withTimezone: true }),

		// Tracking
		viewCount: integer('view_count').notNull().default(0),
		lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }),
		declinedAt: timestamp('declined_at', { withTimezone: true }),

		// Client response fields (PART 2: Proposal Improvements)
		clientComments: text('client_comments').notNull().default(''), // Optional comments when client accepts
		declineReason: text('decline_reason').notNull().default(''), // Optional reason when client declines
		revisionRequestNotes: text('revision_request_notes').notNull().default(''), // Required notes for revision requests
		revisionRequestedAt: timestamp('revision_requested_at', { withTimezone: true }),

		// New content sections (PART 2: Proposal Improvements)
		executiveSummary: text('executive_summary').notNull().default(''), // Brief proposal overview
		nextSteps: jsonb('next_steps').notNull().default([]), // Array of {text, completed} items

		// Consultation data cache (PART 2: Proposal Improvements)
		consultationPainPoints: jsonb('consultation_pain_points').notNull().default({}), // Cached from consultation
		consultationGoals: jsonb('consultation_goals').notNull().default({}), // Cached from consultation
		consultationChallenges: jsonb('consultation_challenges').notNull().default([]), // Array of challenge strings

		// Creator
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' })
	},
	(table) => ({
		agencyIdx: index('proposals_agency_idx').on(table.agencyId),
		consultationIdx: index('proposals_consultation_idx').on(table.consultationId),
		statusIdx: index('proposals_status_idx').on(table.status)
	})
);

// =============================================================================
// CONTRACTS (V2 Document Generation)
// =============================================================================

// Contract Templates table - Agency contract configuration
export const contractTemplates = pgTable(
	'contract_templates',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Template identification
		name: varchar('name', { length: 255 }).notNull(), // "Plentify Service Agreement 2026"
		description: text('description').notNull().default(''),
		version: integer('version').notNull().default(1),

		// Cover page configuration (structured JSON)
		coverPageConfig: jsonb('cover_page_config').notNull().default({}),
		// { showLogo: true, showAgencyAddress: true, showClientAddress: true,
		//   customFields: [{label, mergeField}] }

		// Fixed terms & conditions content (rich text with merge fields)
		termsContent: text('terms_content').notNull().default(''),

		// Signature configuration
		signatureConfig: jsonb('signature_config').notNull().default({}),
		// { agencySignatory: "Benjamin Waller", agencyTitle: "Director",
		//   requireClientTitle: true, requireWitness: false }

		// Status
		isDefault: boolean('is_default').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),

		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' })
	},
	(table) => ({
		agencyIdx: index('contract_templates_agency_idx').on(table.agencyId),
		activeIdx: index('contract_templates_active_idx').on(table.agencyId, table.isActive)
	})
);

// Contract Schedules table - Package-specific terms
export const contractSchedules = pgTable(
	'contract_schedules',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		templateId: uuid('template_id')
			.notNull()
			.references(() => contractTemplates.id, { onDelete: 'cascade' }),

		// Link to package (determines when this schedule is used)
		packageId: uuid('package_id').references(() => agencyPackages.id, { onDelete: 'set null' }),

		// Schedule identification
		name: varchar('name', { length: 255 }).notNull(), // "Lump Sum Package Terms"
		displayOrder: integer('display_order').notNull().default(0),

		// Category for organizing the reusable schedule library
		// Categories: 'service_level', 'payment_billing', 'ownership', 'cancellation', 'package_terms', 'custom'
		sectionCategory: varchar('section_category', { length: 100 }).notNull().default('custom'),

		// Schedule content (rich text with merge fields)
		content: text('content').notNull().default(''),

		isActive: boolean('is_active').notNull().default(true)
	},
	(table) => ({
		templateIdx: index('contract_schedules_template_idx').on(table.templateId),
		packageIdx: index('contract_schedules_package_idx').on(table.packageId)
	})
);

// Contracts table - Generated from proposals
export const contracts = pgTable(
	'contracts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Link to proposal (required - contracts generated from proposals)
		proposalId: uuid('proposal_id')
			.notNull()
			.references(() => proposals.id, { onDelete: 'cascade' }),

		// Template used (for reference, content is snapshotted)
		templateId: uuid('template_id').references(() => contractTemplates.id, {
			onDelete: 'set null'
		}),

		// Document identification
		contractNumber: varchar('contract_number', { length: 50 }).notNull(), // CON-2025-0001
		slug: varchar('slug', { length: 100 }).notNull().unique(), // Public URL slug
		version: integer('version').notNull().default(1), // For future amendments

		// Status workflow: draft, sent, viewed, signed, completed, expired, terminated
		status: varchar('status', { length: 50 }).notNull().default('draft'),

		// Client info (snapshot from proposal at generation time)
		clientBusinessName: text('client_business_name').notNull().default(''),
		clientContactName: text('client_contact_name').notNull().default(''),
		clientEmail: varchar('client_email', { length: 255 }).notNull().default(''),
		clientPhone: varchar('client_phone', { length: 50 }).notNull().default(''),
		clientAddress: text('client_address').notNull().default(''),

		// Contract-specific fields (editable before sending)
		servicesDescription: text('services_description').notNull().default(''),
		commencementDate: timestamp('commencement_date', { withTimezone: true }),
		completionDate: timestamp('completion_date', { withTimezone: true }),
		specialConditions: text('special_conditions').notNull().default(''),

		// Price snapshot from proposal
		totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull().default('0'),
		priceIncludesGst: boolean('price_includes_gst').notNull().default(true),
		paymentTerms: text('payment_terms').notNull().default(''),

		// Generated content (resolved merge fields, stored for historical record)
		generatedCoverHtml: text('generated_cover_html'),
		generatedTermsHtml: text('generated_terms_html'),
		generatedScheduleHtml: text('generated_schedule_html'),

		// Validity
		validUntil: timestamp('valid_until', { withTimezone: true }),

		// Agency signature (pre-signed or on generation)
		agencySignatoryName: varchar('agency_signatory_name', { length: 255 }),
		agencySignatoryTitle: varchar('agency_signatory_title', { length: 100 }),
		agencySignedAt: timestamp('agency_signed_at', { withTimezone: true }),

		// Client signature
		clientSignatoryName: varchar('client_signatory_name', { length: 255 }),
		clientSignatoryTitle: varchar('client_signatory_title', { length: 100 }),
		clientSignedAt: timestamp('client_signed_at', { withTimezone: true }),
		clientSignatureIp: varchar('client_signature_ip', { length: 50 }),
		clientSignatureUserAgent: text('client_signature_user_agent'),

		// Tracking
		viewCount: integer('view_count').notNull().default(0),
		lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
		sentAt: timestamp('sent_at', { withTimezone: true }),

		// PDF storage (generated on signing)
		signedPdfUrl: text('signed_pdf_url'),

		// Field visibility - array of field keys to show on public view
		// Possible values: 'services', 'commencementDate', 'completionDate', 'price', 'paymentTerms', 'specialConditions'
		visibleFields: jsonb('visible_fields')
			.notNull()
			.default([
				'services',
				'commencementDate',
				'completionDate',
				'price',
				'paymentTerms',
				'specialConditions'
			]),

		// Schedule sections to include from library (array of schedule IDs)
		includedScheduleIds: jsonb('included_schedule_ids').notNull().default([]),

		// Creator
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' })
	},
	(table) => ({
		agencyIdx: index('contracts_agency_idx').on(table.agencyId),
		proposalIdx: index('contracts_proposal_idx').on(table.proposalId),
		statusIdx: index('contracts_status_idx').on(table.status),
		slugIdx: index('contracts_slug_idx').on(table.slug),
		createdAtIdx: index('contracts_created_at_idx').on(table.createdAt)
	})
);

// =============================================================================
// INVOICES (V2 Document Generation)
// =============================================================================

export const invoices = pgTable(
	'invoices',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Link to source documents (optional)
		proposalId: uuid('proposal_id').references(() => proposals.id, { onDelete: 'set null' }),
		contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'set null' }),

		// Document identification
		invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
		slug: varchar('slug', { length: 100 }).notNull().unique(),

		// Status workflow: draft, sent, viewed, paid, overdue, cancelled, refunded
		status: varchar('status', { length: 50 }).notNull().default('draft'),

		// Client info (snapshot at invoice creation)
		clientBusinessName: text('client_business_name').notNull(),
		clientContactName: text('client_contact_name').notNull().default(''),
		clientEmail: varchar('client_email', { length: 255 }).notNull(),
		clientPhone: varchar('client_phone', { length: 50 }).notNull().default(''),
		clientAddress: text('client_address').notNull().default(''),
		clientAbn: varchar('client_abn', { length: 20 }).notNull().default(''),

		// Dates
		issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
		dueDate: timestamp('due_date', { withTimezone: true }).notNull(),

		// Financials (all in AUD)
		subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
		discountAmount: decimal('discount_amount', { precision: 10, scale: 2 })
			.notNull()
			.default('0.00'),
		discountDescription: text('discount_description').notNull().default(''),
		gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
		total: decimal('total', { precision: 10, scale: 2 }).notNull(),

		// GST settings (snapshot from agency profile)
		gstRegistered: boolean('gst_registered').notNull().default(true),
		gstRate: decimal('gst_rate', { precision: 5, scale: 2 }).notNull().default('10.00'),

		// Payment terms
		paymentTerms: varchar('payment_terms', { length: 50 }).notNull().default('NET_14'),
		paymentTermsCustom: text('payment_terms_custom').notNull().default(''),

		// Notes
		notes: text('notes').notNull().default(''), // Internal notes
		publicNotes: text('public_notes').notNull().default(''), // Shown on invoice

		// Tracking
		viewCount: integer('view_count').notNull().default(0),
		lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		paidAt: timestamp('paid_at', { withTimezone: true }),

		// Payment recording
		paymentMethod: varchar('payment_method', { length: 50 }), // bank_transfer, card, cash, other
		paymentReference: text('payment_reference'), // Transaction ID, cheque number, etc.
		paymentNotes: text('payment_notes'),

		// PDF storage
		pdfUrl: text('pdf_url'),
		pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),

		// Stripe Payment
		stripePaymentLinkId: varchar('stripe_payment_link_id', { length: 255 }),
		stripePaymentLinkUrl: text('stripe_payment_link_url'),
		stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
		stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }),
		onlinePaymentEnabled: boolean('online_payment_enabled').notNull().default(true),

		// Creator
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' })
	},
	(table) => ({
		agencyIdx: index('invoices_agency_idx').on(table.agencyId),
		statusIdx: index('invoices_status_idx').on(table.status),
		dueDateIdx: index('invoices_due_date_idx').on(table.dueDate),
		slugIdx: index('invoices_slug_idx').on(table.slug),
		invoiceNumberIdx: index('invoices_number_idx').on(table.agencyId, table.invoiceNumber)
	})
);

export const invoiceLineItems = pgTable(
	'invoice_line_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		invoiceId: uuid('invoice_id')
			.notNull()
			.references(() => invoices.id, { onDelete: 'cascade' }),

		// Line item details
		description: text('description').notNull(),
		quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1.00'),
		unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
		amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // quantity * unitPrice

		// Tax handling per line item
		isTaxable: boolean('is_taxable').notNull().default(true),

		// Ordering
		sortOrder: integer('sort_order').notNull().default(0),

		// Optional categorization
		category: varchar('category', { length: 50 }), // setup, development, hosting, addon, other

		// Reference to package/addon if applicable
		packageId: uuid('package_id').references(() => agencyPackages.id, { onDelete: 'set null' }),
		addonId: uuid('addon_id').references(() => agencyAddons.id, { onDelete: 'set null' })
	},
	(table) => ({
		invoiceIdx: index('invoice_line_items_invoice_idx').on(table.invoiceId)
	})
);

// =============================================================================
// EMAIL LOGS TABLE
// =============================================================================

// Email logs table - tracks all emails sent from the agency
export const emailLogs = pgTable(
	'email_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

		// Agency scope
		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Related entities (all optional, at least one should be set)
		proposalId: uuid('proposal_id').references(() => proposals.id, { onDelete: 'set null' }),
		invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
		contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'set null' }),

		// Email type
		emailType: varchar('email_type', { length: 50 }).notNull(),
		// Types: 'proposal_sent', 'invoice_sent', 'contract_sent', 'payment_reminder', 'custom'

		// Email details
		recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
		recipientName: varchar('recipient_name', { length: 255 }),
		subject: varchar('subject', { length: 500 }).notNull(),
		bodyHtml: text('body_html').notNull(),

		// Attachment info
		hasAttachment: boolean('has_attachment').notNull().default(false),
		attachmentFilename: varchar('attachment_filename', { length: 255 }),

		// Resend tracking
		resendMessageId: varchar('resend_message_id', { length: 100 }),

		// Status
		status: varchar('status', { length: 50 }).notNull().default('pending'),
		// Values: 'pending', 'sent', 'delivered', 'opened', 'bounced', 'failed'

		sentAt: timestamp('sent_at', { withTimezone: true }),
		deliveredAt: timestamp('delivered_at', { withTimezone: true }),
		openedAt: timestamp('opened_at', { withTimezone: true }),

		// Error handling
		errorMessage: text('error_message'),
		retryCount: integer('retry_count').notNull().default(0),

		// Sender info
		sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' })
	},
	(table) => ({
		agencyIdx: index('email_logs_agency_idx').on(table.agencyId),
		proposalIdx: index('email_logs_proposal_idx').on(table.proposalId),
		invoiceIdx: index('email_logs_invoice_idx').on(table.invoiceId),
		contractIdx: index('email_logs_contract_idx').on(table.contractId)
	})
);

// =============================================================================
// QUESTIONNAIRE RESPONSES TABLE
// =============================================================================

// Questionnaire responses - stores Initial Website Questionnaire responses
// Now standalone entities that can be linked to contracts, proposals, or consultations
export const questionnaireResponses = pgTable(
	'questionnaire_responses',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		// Agency scope
		agencyId: uuid('agency_id')
			.notNull()
			.references(() => agencies.id, { onDelete: 'cascade' }),

		// Public URL slug (questionnaire's own slug for access)
		slug: varchar('slug', { length: 100 }).notNull().unique(),

		// Optional links to other entities (all nullable for standalone questionnaires)
		contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'set null' }),
		proposalId: uuid('proposal_id').references(() => proposals.id, { onDelete: 'set null' }),
		consultationId: uuid('consultation_id').references(() => consultations.id, {
			onDelete: 'set null'
		}),

		// Client identification (for standalone questionnaires without linked entities)
		clientBusinessName: text('client_business_name').notNull().default(''),
		clientEmail: varchar('client_email', { length: 255 }).notNull().default(''),

		// All responses stored as JSONB (39 fields across 8 sections)
		responses: jsonb('responses').notNull().default({}),

		// Progress tracking
		currentSection: integer('current_section').notNull().default(0),
		completionPercentage: integer('completion_percentage').notNull().default(0),

		// Status: not_started, in_progress, completed
		status: varchar('status', { length: 50 }).notNull().default('not_started'),

		// Timestamps
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow()
	},
	(table) => ({
		agencyIdx: index('questionnaire_responses_agency_idx').on(table.agencyId),
		slugIdx: index('questionnaire_responses_slug_idx').on(table.slug),
		contractIdx: index('questionnaire_responses_contract_idx').on(table.contractId),
		proposalIdx: index('questionnaire_responses_proposal_idx').on(table.proposalId),
		statusIdx: index('questionnaire_responses_status_idx').on(table.agencyId, table.status)
	})
);

export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect;
export type QuestionnaireResponseInsert = typeof questionnaireResponses.$inferInsert;
export type QuestionnaireStatus = 'not_started' | 'in_progress' | 'completed';

// =============================================================================
// CONSULTATION TABLES
// =============================================================================

// Consultations table
export const consultations = pgTable('consultations', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	agencyId: uuid('agency_id').references(() => agencies.id, { onDelete: 'cascade' }), // Added for multi-tenancy

	// JSONB fields for form data
	contactInfo: jsonb('contact_info').notNull().default({}),
	businessContext: jsonb('business_context').notNull().default({}),
	painPoints: jsonb('pain_points').notNull().default({}),
	goalsObjectives: jsonb('goals_objectives').notNull().default({}),

	// Metadata
	status: varchar('status', { length: 50 }).notNull().default('draft'),
	completionPercentage: integer('completion_percentage').notNull().default(0),

	// Timestamps
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	completedAt: timestamp('completed_at', { withTimezone: true })
});

// Consultation drafts table
export const consultationDrafts = pgTable(
	'consultation_drafts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		consultationId: uuid('consultation_id')
			.notNull()
			.references(() => consultations.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		agencyId: uuid('agency_id').references(() => agencies.id, { onDelete: 'cascade' }), // Added for multi-tenancy

		// Draft data (same structure as consultations)
		contactInfo: jsonb('contact_info').notNull().default({}),
		businessContext: jsonb('business_context').notNull().default({}),
		painPoints: jsonb('pain_points').notNull().default({}),
		goalsObjectives: jsonb('goals_objectives').notNull().default({}),

		// Draft metadata
		autoSaved: boolean('auto_saved').notNull().default(false),
		draftNotes: text('draft_notes'),

		// Timestamps
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		// Ensure one active draft per consultation
		uniqueConsultation: unique().on(table.consultationId)
	})
);

// Consultation versions table (for version history)
export const consultationVersions = pgTable(
	'consultation_versions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		consultationId: uuid('consultation_id')
			.notNull()
			.references(() => consultations.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		agencyId: uuid('agency_id').references(() => agencies.id, { onDelete: 'cascade' }), // Added for multi-tenancy
		versionNumber: integer('version_number').notNull(),

		// Snapshot of consultation data at this version
		contactInfo: jsonb('contact_info').notNull().default({}),
		businessContext: jsonb('business_context').notNull().default({}),
		painPoints: jsonb('pain_points').notNull().default({}),
		goalsObjectives: jsonb('goals_objectives').notNull().default({}),
		status: varchar('status', { length: 50 }).notNull(),
		completionPercentage: integer('completion_percentage').notNull(),

		// Version metadata
		changeSummary: text('change_summary'),
		changedFields: jsonb('changed_fields').notNull().default([]),

		// Timestamps
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		// Ensure unique version numbers per consultation
		uniqueVersion: unique().on(table.consultationId, table.versionNumber)
	})
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// User types
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// Agency types
export type Agency = typeof agencies.$inferSelect;
export type AgencyInsert = typeof agencies.$inferInsert;
export type AgencyMembership = typeof agencyMemberships.$inferSelect;
export type AgencyMembershipInsert = typeof agencyMemberships.$inferInsert;
export type AgencyFormOption = typeof agencyFormOptions.$inferSelect;
export type AgencyFormOptionInsert = typeof agencyFormOptions.$inferInsert;
export type AgencyProposalTemplate = typeof agencyProposalTemplates.$inferSelect;
export type AgencyProposalTemplateInsert = typeof agencyProposalTemplates.$inferInsert;

// Audit log types
export type AgencyActivityLog = typeof agencyActivityLog.$inferSelect;
export type AgencyActivityLogInsert = typeof agencyActivityLog.$inferInsert;

// Agency Profile types
export type AgencyProfile = typeof agencyProfiles.$inferSelect;
export type AgencyProfileInsert = typeof agencyProfiles.$inferInsert;

// Agency Package types
export type AgencyPackage = typeof agencyPackages.$inferSelect;
export type AgencyPackageInsert = typeof agencyPackages.$inferInsert;

// Agency Add-on types
export type AgencyAddon = typeof agencyAddons.$inferSelect;
export type AgencyAddonInsert = typeof agencyAddons.$inferInsert;

// Proposal types
export type Proposal = typeof proposals.$inferSelect;
export type ProposalInsert = typeof proposals.$inferInsert;

// Consultation types
export type Consultation = typeof consultations.$inferSelect;
export type ConsultationInsert = typeof consultations.$inferInsert;
export type ConsultationDraft = typeof consultationDrafts.$inferSelect;
export type ConsultationDraftInsert = typeof consultationDrafts.$inferInsert;
export type ConsultationVersion = typeof consultationVersions.$inferSelect;
export type ConsultationVersionInsert = typeof consultationVersions.$inferInsert;

// Agency role type
export type AgencyRole = 'owner' | 'admin' | 'member';
export type AgencyStatus = 'active' | 'suspended' | 'cancelled';
export type MembershipStatus = 'active' | 'invited' | 'suspended';

// Package & Pricing types (V2)
export type PricingModel = 'subscription' | 'lump_sum' | 'hybrid';
export type CancellationFeeType = 'none' | 'fixed' | 'remaining_balance';
export type PricingType = 'one_time' | 'monthly' | 'per_unit';
export type PaymentTerms = 'DUE_ON_RECEIPT' | 'NET_7' | 'NET_14' | 'NET_30';

// Proposal status type
export type ProposalStatus = 'draft' | 'ready' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'revision_requested' | 'expired';

// Contract Template types
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type ContractTemplateInsert = typeof contractTemplates.$inferInsert;

// Contract Schedule types
export type ContractSchedule = typeof contractSchedules.$inferSelect;
export type ContractScheduleInsert = typeof contractSchedules.$inferInsert;

// Contract types
export type Contract = typeof contracts.$inferSelect;
export type ContractInsert = typeof contracts.$inferInsert;
export type ContractStatus =
	| 'draft'
	| 'sent'
	| 'viewed'
	| 'signed'
	| 'completed'
	| 'expired'
	| 'terminated';

// Invoice types
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InvoiceLineItemInsert = typeof invoiceLineItems.$inferInsert;
export type InvoiceStatus =
	| 'draft'
	| 'sent'
	| 'viewed'
	| 'paid'
	| 'overdue'
	| 'cancelled'
	| 'refunded';
export type InvoicePaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'other';
export type LineItemCategory = 'setup' | 'development' | 'hosting' | 'addon' | 'other';

// Email log types
export type EmailLog = typeof emailLogs.$inferSelect;
export type EmailLogInsert = typeof emailLogs.$inferInsert;
export type EmailType = 'proposal_sent' | 'invoice_sent' | 'contract_sent' | 'payment_reminder' | 'custom';
export type EmailStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed';

// Cover page configuration (for contract templates)
export interface CoverPageConfig {
	showLogo?: boolean;
	showAgencyAddress?: boolean;
	showClientAddress?: boolean;
	customFields?: { label: string; mergeField: string }[];
}

// Signature configuration (for contract templates)
export interface SignatureConfig {
	agencySignatory?: string;
	agencyTitle?: string;
	requireClientTitle?: boolean;
	requireWitness?: boolean;
}

// Form option category type
export type FormOptionCategory =
	| 'budget_range'
	| 'industry'
	| 'business_type'
	| 'digital_presence'
	| 'marketing_channels'
	| 'urgency'
	| 'challenges'
	| 'technical_issues'
	| 'solution_gaps'
	| 'primary_goals'
	| 'secondary_goals'
	| 'success_metrics'
	| 'kpis'
	| 'budget_constraints';

// JSONB type definitions (matching Go backend)
export interface ContactInfo {
	business_name?: string;
	contact_person?: string;
	email?: string;
	phone?: string;
	website?: string;
	social_media?: Record<string, string>;
}

export interface BusinessContext {
	industry?: string;
	business_type?: string;
	team_size?: number;
	current_platform?: string;
	digital_presence?: string[];
	marketing_channels?: string[];
}

export interface PainPoints {
	primary_challenges?: string[];
	technical_issues?: string[];
	urgency_level?: 'low' | 'medium' | 'high' | 'critical';
	impact_assessment?: string;
	current_solution_gaps?: string[];
}

export interface GoalsObjectives {
	primary_goals?: string[];
	secondary_goals?: string[];
	success_metrics?: string[];
	kpis?: string[];
	timeline?: {
		desired_start?: string;
		target_completion?: string;
		milestones?: string[];
	};
	budget_range?: string;
	budget_constraints?: string[];
}

// Proposal JSONB type definitions
export interface PerformanceData {
	performance?: number; // 0-100
	accessibility?: number; // 0-100
	bestPractices?: number; // 0-100
	seo?: number; // 0-100
	loadTime?: string; // e.g., "4.2s"
	issues?: string[]; // List of key issues found
}

export interface ChecklistItem {
	text: string;
	checked: boolean;
}

export interface RoiAnalysis {
	currentVisitors?: number;
	projectedVisitors?: number;
	conversionRate?: number;
	projectedLeads?: number;
	averageProjectValue?: number;
	projectedRevenue?: number;
}

export interface PerformanceStandard {
	label: string;
	value: string;
	icon?: string;
}

export interface ProposedPage {
	name: string;
	description?: string;
	features?: string[];
}

export interface TimelinePhase {
	week: string;
	title: string;
	description: string;
}

export interface CustomPricing {
	setupFee?: string;
	monthlyPrice?: string;
	oneTimePrice?: string;
	hostingFee?: string;
	discountPercent?: number;
	discountNote?: string;
}

// PART 2: Proposal Improvements types
export interface NextStepItem {
	text: string;
	completed: boolean;
}

export interface ConsultationPainPoints {
	primary_challenges?: string[];
	technical_issues?: string[];
	solution_gaps?: string[];
}

export interface ConsultationGoals {
	primary_goals?: string[];
	secondary_goals?: string[];
	success_metrics?: string[];
}
