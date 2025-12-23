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
	unique
} from 'drizzle-orm/pg-core';

// Users table (referenced by consultations)
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
	apiKey: text('api_key').notNull().default('')
});

// Consultations table
export const consultations = pgTable('consultations', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),

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

// Type exports for use in remote functions
export type User = typeof users.$inferSelect;
export type Consultation = typeof consultations.$inferSelect;
export type ConsultationInsert = typeof consultations.$inferInsert;
export type ConsultationDraft = typeof consultationDrafts.$inferSelect;
export type ConsultationDraftInsert = typeof consultationDrafts.$inferInsert;
export type ConsultationVersion = typeof consultationVersions.$inferSelect;
export type ConsultationVersionInsert = typeof consultationVersions.$inferInsert;

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
