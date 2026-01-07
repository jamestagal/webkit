/**
 * Questionnaire Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for questionnaire operations.
 * Handles the Initial Website Questionnaire - a multi-step form linked to contracts.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import { env } from '$env/dynamic/public';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import {
	questionnaireResponses,
	contracts,
	invoices,
	agencies,
	agencyProfiles,
	type QuestionnaireResponse
} from '$lib/server/schema';
import { getAgencyContext } from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import { canAccessResource } from '$lib/server/permissions';
import { eq, and, asc } from 'drizzle-orm';
import { sendEmail } from '$lib/server/services/email.service';
import { generateQuestionnaireCompletedEmail } from '$lib/templates/email-templates';

// =============================================================================
// Types
// =============================================================================

export type QuestionnaireResponses = {
	// Section 1: Personal Information
	first_name?: string;
	last_name?: string;
	email?: string;

	// Section 2: Company Details
	company_name?: string;
	registered_address?: string;

	// Section 3: Information to be Displayed
	displayed_business_name?: string;
	displayed_address?: string;
	displayed_phone?: string;
	displayed_email?: string;
	social_media_accounts?: string;
	opening_hours?: string;

	// Section 4: Domain & Technical
	has_domain?: 'yes' | 'no';
	domain_name?: string;
	has_google_business?: 'yes' | 'no';

	// Section 5: About Your Business
	business_story?: string;
	business_emails?: string;
	areas_served?: string;
	target_customers?: string;
	top_services?: string;
	other_services?: string;
	differentiators?: string;
	statistics_awards?: string;
	additional_business_details?: string;

	// Section 6: Website Content
	pages_wanted?: string;
	customer_actions?: string;
	key_information?: string;
	calls_to_action?: string;
	regularly_updated_content?: string;
	additional_content_details?: string;

	// Section 7: Website Design
	competitor_websites?: string;
	reference_websites?: string;
	aesthetic_description?: string;
	branding_guidelines?: string;
	additional_design_details?: string;

	// Section 8: Final Details
	timeline?: string;
	google_analytics?: 'yes' | 'no';
	referral_source?: string;
	other_services_interest?: string[];
	marketing_permissions?: string[];
};

export type QuestionnaireAccessResult = {
	allowed: boolean;
	reason?: 'contract_not_found' | 'contract_not_signed' | 'payment_required' | 'already_completed';
	contract?: typeof contracts.$inferSelect;
	agency?: typeof agencies.$inferSelect;
	agencyProfile?: typeof agencyProfiles.$inferSelect;
	questionnaire?: QuestionnaireResponse;
};

// =============================================================================
// Validation Schemas
// =============================================================================

const QuestionnaireStatusSchema = v.picklist(['not_started', 'in_progress', 'completed']);

const SaveProgressSchema = v.object({
	questionnaireId: v.pipe(v.string(), v.uuid()),
	responses: v.record(v.string(), v.any()),
	currentSection: v.pipe(v.number(), v.minValue(0), v.maxValue(7))
});

const SubmitQuestionnaireSchema = v.object({
	questionnaireId: v.pipe(v.string(), v.uuid())
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate completion percentage based on filled fields.
 * Total of 39 fields across 8 sections.
 */
function calculateCompletionPercentage(responses: QuestionnaireResponses): number {
	const requiredFields = [
		// Section 1 (3 required)
		'first_name',
		'last_name',
		'email',
		// Section 2 (2 required)
		'company_name',
		'registered_address',
		// Section 3 (1 required)
		'displayed_business_name',
		// Section 4 (2 required)
		'has_domain',
		'has_google_business',
		// Section 5 (5 required)
		'business_story',
		'areas_served',
		'target_customers',
		'top_services',
		'differentiators',
		// Section 6 (4 required)
		'pages_wanted',
		'customer_actions',
		'key_information',
		'calls_to_action',
		// Section 7 (2 required)
		'reference_websites',
		'aesthetic_description',
		// Section 8 (2 required)
		'timeline',
		'google_analytics'
	];

	let filledCount = 0;
	for (const field of requiredFields) {
		const value = responses[field as keyof QuestionnaireResponses];
		if (value !== undefined && value !== null && value !== '') {
			filledCount++;
		}
	}

	return Math.round((filledCount / requiredFields.length) * 100);
}

/**
 * Build pre-fill data from contract.
 */
function getPrefillData(contract: typeof contracts.$inferSelect): Partial<QuestionnaireResponses> {
	const nameParts = (contract.clientContactName || '').split(' ');
	return {
		// Personal info from contract
		first_name: nameParts[0] || '',
		last_name: nameParts.slice(1).join(' ') || '',
		email: contract.clientEmail || '',
		// Company from contract
		company_name: contract.clientBusinessName || '',
		// Display info defaults to company name (client can change)
		displayed_business_name: contract.clientBusinessName || ''
	};
}

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get questionnaire by contract ID (authenticated).
 */
export const getQuestionnaireByContract = query(
	v.pipe(v.string(), v.uuid()),
	async (contractId: string) => {
		const context = await getAgencyContext();

		// Verify contract belongs to agency
		const [contract] = await db
			.select()
			.from(contracts)
			.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
			.limit(1);

		if (!contract) {
			throw new Error('Contract not found');
		}

		// Check access permission
		if (!canAccessResource(context.role, contract.createdBy || '', context.userId, 'contract')) {
			throw new Error('Permission denied');
		}

		// Get questionnaire if exists
		const [questionnaire] = await db
			.select()
			.from(questionnaireResponses)
			.where(eq(questionnaireResponses.contractId, contractId))
			.limit(1);

		return questionnaire || null;
	}
);

/**
 * Check questionnaire access and return data (public, no auth).
 * Uses contract slug to find the questionnaire.
 */
export const checkQuestionnaireAccess = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug: string): Promise<QuestionnaireAccessResult> => {
		// Find contract by slug
		const [contract] = await db
			.select()
			.from(contracts)
			.where(eq(contracts.slug, slug))
			.limit(1);

		if (!contract) {
			return { allowed: false, reason: 'contract_not_found' };
		}

		// Get agency info for display
		const [agency] = await db
			.select()
			.from(agencies)
			.where(eq(agencies.id, contract.agencyId))
			.limit(1);

		const [agencyProfile] = await db
			.select()
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, contract.agencyId))
			.limit(1);

		// Check 1: Contract must be signed
		if (!['signed', 'completed'].includes(contract.status)) {
			return {
				allowed: false,
				reason: 'contract_not_signed',
				contract,
				...(agency && { agency }),
				...(agencyProfile && { agencyProfile })
			};
		}

		// Check 2: First invoice must be paid (if any invoices exist)
		const [firstInvoice] = await db
			.select()
			.from(invoices)
			.where(eq(invoices.contractId, contract.id))
			.orderBy(asc(invoices.createdAt))
			.limit(1);

		if (firstInvoice && firstInvoice.status !== 'paid') {
			return {
				allowed: false,
				reason: 'payment_required',
				contract,
				...(agency && { agency }),
				...(agencyProfile && { agencyProfile })
			};
		}

		// Get or create questionnaire
		let [questionnaire] = await db
			.select()
			.from(questionnaireResponses)
			.where(eq(questionnaireResponses.contractId, contract.id))
			.limit(1);

		// If questionnaire already completed, still allow view but flag it
		if (questionnaire?.status === 'completed') {
			return {
				allowed: true,
				reason: 'already_completed',
				contract,
				...(agency && { agency }),
				...(agencyProfile && { agencyProfile }),
				questionnaire
			};
		}

		// Create questionnaire if doesn't exist
		if (!questionnaire) {
			const prefillData = getPrefillData(contract);

			const [newQuestionnaire] = await db
				.insert(questionnaireResponses)
				.values({
					agencyId: contract.agencyId,
					contractId: contract.id,
					responses: prefillData,
					currentSection: 0,
					completionPercentage: calculateCompletionPercentage(prefillData),
					status: 'not_started'
				})
				.returning();

			questionnaire = newQuestionnaire;
		}

		if (!questionnaire) {
			throw new Error('Failed to create or retrieve questionnaire');
		}

		return {
			allowed: true,
			contract,
			...(agency && { agency }),
			...(agencyProfile && { agencyProfile }),
			questionnaire
		};
	}
);

/**
 * Get questionnaire responses by slug (public, no auth).
 * Used by the public form to load saved progress.
 */
export const getQuestionnaireBySlug = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug: string) => {
		// Find contract by slug
		const [contract] = await db
			.select()
			.from(contracts)
			.where(eq(contracts.slug, slug))
			.limit(1);

		if (!contract) {
			return null;
		}

		// Get questionnaire
		const [questionnaire] = await db
			.select()
			.from(questionnaireResponses)
			.where(eq(questionnaireResponses.contractId, contract.id))
			.limit(1);

		if (!questionnaire) {
			return null;
		}

		// Get agency profile for logo
		const [agencyProfile] = await db
			.select()
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, contract.agencyId))
			.limit(1);

		return {
			questionnaire,
			agencyProfile: agencyProfile || null
		};
	}
);

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Save questionnaire progress (public, no auth).
 * Called when navigating between sections.
 */
export const saveQuestionnaireProgress = command(SaveProgressSchema, async (data) => {
	// Verify questionnaire exists
	const [existing] = await db
		.select()
		.from(questionnaireResponses)
		.where(eq(questionnaireResponses.id, data.questionnaireId))
		.limit(1);

	if (!existing) {
		throw new Error('Questionnaire not found');
	}

	// Cannot modify completed questionnaire
	if (existing.status === 'completed') {
		throw new Error('Questionnaire already completed');
	}

	// Merge responses (preserve existing, update with new)
	const existingResponses = (existing.responses || {}) as QuestionnaireResponses;
	const mergedResponses = {
		...existingResponses,
		...data.responses
	} as QuestionnaireResponses;

	// Calculate completion percentage
	const completionPercentage = calculateCompletionPercentage(mergedResponses);

	// Determine status
	const status = completionPercentage > 0 ? 'in_progress' : 'not_started';

	// Update questionnaire
	const [questionnaire] = await db
		.update(questionnaireResponses)
		.set({
			responses: mergedResponses,
			currentSection: data.currentSection,
			completionPercentage,
			status,
			startedAt: existing.startedAt || (status === 'in_progress' ? new Date() : null),
			lastActivityAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(questionnaireResponses.id, data.questionnaireId))
		.returning();

	return questionnaire;
});

/**
 * Submit completed questionnaire (public, no auth).
 * Marks as completed and sends notification email to agency.
 */
export const submitQuestionnaire = command(SubmitQuestionnaireSchema, async (data) => {
	// Verify questionnaire exists
	const [existing] = await db
		.select()
		.from(questionnaireResponses)
		.where(eq(questionnaireResponses.id, data.questionnaireId))
		.limit(1);

	if (!existing) {
		throw new Error('Questionnaire not found');
	}

	// Cannot submit already completed
	if (existing.status === 'completed') {
		throw new Error('Questionnaire already submitted');
	}

	// Get contract for logging and email
	const [contract] = await db
		.select()
		.from(contracts)
		.where(eq(contracts.id, existing.contractId))
		.limit(1);

	if (!contract) {
		throw new Error('Associated contract not found');
	}

	// Get agency and profile for email
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, existing.agencyId))
		.limit(1);

	const [agencyProfile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, existing.agencyId))
		.limit(1);

	// Update to completed
	const [questionnaire] = await db
		.update(questionnaireResponses)
		.set({
			status: 'completed',
			completionPercentage: 100,
			completedAt: new Date(),
			lastActivityAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(questionnaireResponses.id, data.questionnaireId))
		.returning();

	if (!questionnaire) {
		throw new Error('Failed to update questionnaire');
	}

	// Log activity
	await logActivity('questionnaire.completed', 'questionnaire', questionnaire.id, {
		newValues: {
			contractId: existing.contractId,
			clientName: contract.clientContactName || 'Unknown'
		}
	});

	// Send notification email to agency
	if (agency?.email) {
		try {
			const baseUrl = env.PUBLIC_CLIENT_URL || 'https://webkit.au';
			const questionnaireUrl = `${baseUrl}/${agency.slug}/contracts/${contract.id}`;

			const emailContent = generateQuestionnaireCompletedEmail({
				agency: {
					name: agencyProfile?.tradingName || agency.name,
					primaryColor: agency.primaryColor || undefined,
					logoUrl: agency.logoUrl || undefined
				},
				client: {
					name: contract.clientContactName || contract.clientBusinessName,
					businessName: contract.clientBusinessName || undefined,
					email: contract.clientEmail
				},
				contract: {
					number: contract.contractNumber
				},
				questionnaireUrl
			});

			await sendEmail({
				to: agency.email,
				subject: emailContent.subject,
				html: emailContent.bodyHtml
			});
		} catch (err) {
			// Log error but don't fail the submission
			console.error('Failed to send questionnaire completion email:', err);
		}
	}

	return { success: true, questionnaire };
});

/**
 * Get all questionnaires for the current agency (authenticated).
 */
export const getQuestionnaires = query(
	v.optional(
		v.object({
			status: v.optional(QuestionnaireStatusSchema),
			limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
			offset: v.optional(v.pipe(v.number(), v.minValue(0)))
		})
	),
	async (filters) => {
		const context = await getAgencyContext();
		const { status, limit = 50, offset = 0 } = filters || {};

		// Build where conditions
		const conditions = [eq(questionnaireResponses.agencyId, context.agencyId)];

		if (status) {
			conditions.push(eq(questionnaireResponses.status, status));
		}

		const results = await db
			.select()
			.from(questionnaireResponses)
			.where(and(...conditions))
			.orderBy(questionnaireResponses.createdAt)
			.limit(limit)
			.offset(offset);

		return results;
	}
);
