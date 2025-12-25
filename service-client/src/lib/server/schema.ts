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
	decimal
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
	nextProposalNumber: integer('next_proposal_number').notNull().default(1)
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
