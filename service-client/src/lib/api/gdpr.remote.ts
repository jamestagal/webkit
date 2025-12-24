/**
 * GDPR Compliance Remote Functions
 *
 * Provides data export, soft delete, and deletion scheduling
 * to comply with GDPR requirements.
 *
 * Key features:
 * - Full data export in JSON format
 * - Soft delete with 30-day grace period
 * - Deletion cancellation during grace period
 * - Activity log anonymization
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import {
	agencies,
	agencyMemberships,
	agencyFormOptions,
	agencyProposalTemplates,
	agencyActivityLog,
	consultations,
	consultationDrafts,
	consultationVersions,
	users
} from '$lib/server/schema';
import { getAgencyContext } from '$lib/server/agency';
import { requirePermission } from '$lib/server/permissions';
import { logActivity, AUDIT_ACTIONS, ENTITY_TYPES } from '$lib/server/db-helpers';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

// =============================================================================
// Constants
// =============================================================================

// Grace period for deletion (in days)
const DELETION_GRACE_PERIOD_DAYS = 30;

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get the deletion status of the current agency.
 * Returns null if not scheduled for deletion.
 */
export const getDeletionStatus = query(async () => {
	const context = await getAgencyContext();

	const [agency] = await db
		.select({
			deletedAt: agencies.deletedAt,
			deletionScheduledFor: agencies.deletionScheduledFor
		})
		.from(agencies)
		.where(eq(agencies.id, context.agencyId))
		.limit(1);

	if (!agency || !agency.deletionScheduledFor) {
		return null;
	}

	const now = new Date();
	const scheduledDate = new Date(agency.deletionScheduledFor);
	const daysRemaining = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

	return {
		scheduledFor: agency.deletionScheduledFor,
		daysRemaining: Math.max(0, daysRemaining),
		canCancel: daysRemaining > 0
	};
});

/**
 * Export all agency data for GDPR compliance.
 * Only accessible by agency owner.
 */
export const exportAgencyData = query(async () => {
	await requirePermission('data:export');
	const context = await getAgencyContext();

	// Get agency details
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, context.agencyId))
		.limit(1);

	if (!agency) {
		throw error(404, 'Agency not found');
	}

	// Get all members
	const members = await db
		.select({
			id: agencyMemberships.id,
			role: agencyMemberships.role,
			status: agencyMemberships.status,
			displayName: agencyMemberships.displayName,
			invitedAt: agencyMemberships.invitedAt,
			acceptedAt: agencyMemberships.acceptedAt,
			userEmail: users.email
		})
		.from(agencyMemberships)
		.innerJoin(users, eq(agencyMemberships.userId, users.id))
		.where(eq(agencyMemberships.agencyId, context.agencyId));

	// Get all form options
	const formOptions = await db
		.select()
		.from(agencyFormOptions)
		.where(eq(agencyFormOptions.agencyId, context.agencyId));

	// Get all proposal templates
	const templates = await db
		.select()
		.from(agencyProposalTemplates)
		.where(eq(agencyProposalTemplates.agencyId, context.agencyId));

	// Get all consultations
	const allConsultations = await db
		.select()
		.from(consultations)
		.where(eq(consultations.agencyId, context.agencyId));

	// Get all drafts
	const drafts = await db
		.select()
		.from(consultationDrafts)
		.where(eq(consultationDrafts.agencyId, context.agencyId));

	// Get all versions
	const versions = await db
		.select()
		.from(consultationVersions)
		.where(eq(consultationVersions.agencyId, context.agencyId));

	// Get activity log (last 90 days for performance)
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	const activityLog = await db
		.select({
			action: agencyActivityLog.action,
			entityType: agencyActivityLog.entityType,
			createdAt: agencyActivityLog.createdAt,
			metadata: agencyActivityLog.metadata
		})
		.from(agencyActivityLog)
		.where(eq(agencyActivityLog.agencyId, context.agencyId))
		.limit(1000);

	// Log the export action
	await logActivity(AUDIT_ACTIONS.DATA_EXPORTED, ENTITY_TYPES.AGENCY, context.agencyId);

	return {
		exportedAt: new Date().toISOString(),
		exportVersion: '1.0',
		agency: {
			id: agency.id,
			name: agency.name,
			slug: agency.slug,
			email: agency.email,
			phone: agency.phone,
			website: agency.website,
			branding: {
				logoUrl: agency.logoUrl,
				primaryColor: agency.primaryColor,
				secondaryColor: agency.secondaryColor,
				accentColor: agency.accentColor
			},
			subscription: {
				tier: agency.subscriptionTier,
				status: agency.status
			},
			createdAt: agency.createdAt,
			updatedAt: agency.updatedAt
		},
		members: members.map((m) => ({
			id: m.id,
			email: m.userEmail,
			displayName: m.displayName,
			role: m.role,
			status: m.status,
			invitedAt: m.invitedAt,
			acceptedAt: m.acceptedAt
		})),
		formOptions: formOptions.map((opt) => ({
			category: opt.category,
			value: opt.value,
			label: opt.label,
			isDefault: opt.isDefault,
			isActive: opt.isActive,
			metadata: opt.metadata
		})),
		templates: templates.map((t) => ({
			id: t.id,
			name: t.name,
			isDefault: t.isDefault,
			sections: t.sections,
			headerContent: t.headerContent,
			footerContent: t.footerContent,
			settings: t.settings,
			createdAt: t.createdAt
		})),
		consultations: allConsultations.map((c) => ({
			id: c.id,
			status: c.status,
			completionPercentage: c.completionPercentage,
			contactInfo: c.contactInfo,
			businessContext: c.businessContext,
			painPoints: c.painPoints,
			goalsObjectives: c.goalsObjectives,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
			completedAt: c.completedAt
		})),
		drafts: drafts.map((d) => ({
			id: d.id,
			consultationId: d.consultationId,
			contactInfo: d.contactInfo,
			businessContext: d.businessContext,
			painPoints: d.painPoints,
			goalsObjectives: d.goalsObjectives,
			draftNotes: d.draftNotes,
			createdAt: d.createdAt,
			updatedAt: d.updatedAt
		})),
		versions: versions.map((v) => ({
			id: v.id,
			consultationId: v.consultationId,
			versionNumber: v.versionNumber,
			status: v.status,
			changeSummary: v.changeSummary,
			createdAt: v.createdAt
		})),
		activityLog: activityLog.map((a) => ({
			action: a.action,
			entityType: a.entityType,
			createdAt: a.createdAt
			// Note: Sensitive details omitted for privacy
		}))
	};
});

// =============================================================================
// Command Functions
// =============================================================================

/**
 * Schedule agency deletion with grace period.
 * Only accessible by agency owner.
 */
export const scheduleAgencyDeletion = command(
	v.object({
		confirmationPhrase: v.pipe(v.string(), v.minLength(1))
	}),
	async (data) => {
		await requirePermission('agency:delete');
		const context = await getAgencyContext();

		// Get agency name for confirmation
		const [agency] = await db
			.select({ name: agencies.name })
			.from(agencies)
			.where(eq(agencies.id, context.agencyId))
			.limit(1);

		if (!agency) {
			throw error(404, 'Agency not found');
		}

		// Require exact name match for confirmation
		const expectedPhrase = `delete ${agency.name}`;
		if (data.confirmationPhrase.toLowerCase() !== expectedPhrase.toLowerCase()) {
			throw error(400, `Please type "delete ${agency.name}" to confirm deletion`);
		}

		// Check if already scheduled
		const [current] = await db
			.select({ deletionScheduledFor: agencies.deletionScheduledFor })
			.from(agencies)
			.where(eq(agencies.id, context.agencyId))
			.limit(1);

		if (current?.deletionScheduledFor) {
			throw error(400, 'Agency is already scheduled for deletion');
		}

		// Schedule deletion
		const deletionDate = new Date();
		deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

		await db
			.update(agencies)
			.set({
				deletionScheduledFor: deletionDate,
				updatedAt: new Date()
			})
			.where(eq(agencies.id, context.agencyId));

		// Log the action
		await logActivity(AUDIT_ACTIONS.AGENCY_DELETION_SCHEDULED, ENTITY_TYPES.AGENCY, context.agencyId, {
			newValues: {
				deletionScheduledFor: deletionDate.toISOString(),
				gracePeriodDays: DELETION_GRACE_PERIOD_DAYS
			}
		});

		return {
			scheduledFor: deletionDate,
			gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
			message: `Agency scheduled for deletion on ${deletionDate.toLocaleDateString()}. You can cancel this within ${DELETION_GRACE_PERIOD_DAYS} days.`
		};
	}
);

/**
 * Cancel a scheduled agency deletion.
 * Only accessible by agency owner during grace period.
 */
export const cancelAgencyDeletion = command(async () => {
	await requirePermission('agency:delete');
	const context = await getAgencyContext();

	// Check if scheduled for deletion
	const [agency] = await db
		.select({
			deletionScheduledFor: agencies.deletionScheduledFor,
			deletedAt: agencies.deletedAt
		})
		.from(agencies)
		.where(eq(agencies.id, context.agencyId))
		.limit(1);

	if (!agency) {
		throw error(404, 'Agency not found');
	}

	if (agency.deletedAt) {
		throw error(400, 'Agency has already been deleted');
	}

	if (!agency.deletionScheduledFor) {
		throw error(400, 'Agency is not scheduled for deletion');
	}

	// Check if still within grace period
	const now = new Date();
	if (new Date(agency.deletionScheduledFor) <= now) {
		throw error(400, 'Grace period has expired. Deletion cannot be cancelled.');
	}

	// Cancel deletion
	await db
		.update(agencies)
		.set({
			deletionScheduledFor: null,
			updatedAt: new Date()
		})
		.where(eq(agencies.id, context.agencyId));

	// Log the action
	await logActivity(AUDIT_ACTIONS.AGENCY_DELETION_CANCELLED, ENTITY_TYPES.AGENCY, context.agencyId, {
		oldValues: {
			deletionScheduledFor: agency.deletionScheduledFor
		}
	});

	return {
		message: 'Agency deletion has been cancelled. Your agency will not be deleted.'
	};
});

/**
 * Perform soft delete on an agency.
 * This is called by a background job after grace period expires.
 * NOT exposed as a user-callable command.
 */
export async function performSoftDelete(agencyId: string): Promise<void> {
	// Verify grace period has expired
	const [agency] = await db
		.select({
			deletionScheduledFor: agencies.deletionScheduledFor,
			deletedAt: agencies.deletedAt
		})
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	if (!agency) {
		throw new Error('Agency not found');
	}

	if (agency.deletedAt) {
		throw new Error('Agency already deleted');
	}

	if (!agency.deletionScheduledFor) {
		throw new Error('Agency not scheduled for deletion');
	}

	const now = new Date();
	if (new Date(agency.deletionScheduledFor) > now) {
		throw new Error('Grace period has not expired');
	}

	// Perform soft delete
	await db
		.update(agencies)
		.set({
			deletedAt: now,
			status: 'cancelled',
			updatedAt: now
		})
		.where(eq(agencies.id, agencyId));

	// Deactivate all memberships
	await db
		.update(agencyMemberships)
		.set({
			status: 'suspended',
			updatedAt: now
		})
		.where(eq(agencyMemberships.agencyId, agencyId));

	// Anonymize activity logs (remove user details, keep actions)
	await db
		.update(agencyActivityLog)
		.set({
			userId: null,
			ipAddress: null,
			userAgent: null,
			metadata: {}
		})
		.where(eq(agencyActivityLog.agencyId, agencyId));

	// Clear user default agency references
	await db
		.update(users)
		.set({ defaultAgencyId: null })
		.where(eq(users.defaultAgencyId, agencyId));
}

/**
 * Request personal data export for GDPR.
 * Exports user's data across all agencies they belong to.
 */
export const exportUserData = query(async () => {
	const context = await getAgencyContext();

	// Get user details
	const [user] = await db
		.select({
			id: users.id,
			email: users.email,
			phone: users.phone,
			avatar: users.avatar,
			created: users.created,
			updated: users.updated
		})
		.from(users)
		.where(eq(users.id, context.userId))
		.limit(1);

	if (!user) {
		throw error(404, 'User not found');
	}

	// Get all memberships
	const memberships = await db
		.select({
			agencyId: agencyMemberships.agencyId,
			agencyName: agencies.name,
			role: agencyMemberships.role,
			status: agencyMemberships.status,
			displayName: agencyMemberships.displayName,
			invitedAt: agencyMemberships.invitedAt,
			acceptedAt: agencyMemberships.acceptedAt
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(eq(agencyMemberships.userId, context.userId));

	// Get consultations created by user
	const userConsultations = await db
		.select({
			id: consultations.id,
			agencyId: consultations.agencyId,
			status: consultations.status,
			createdAt: consultations.createdAt
		})
		.from(consultations)
		.where(eq(consultations.userId, context.userId));

	return {
		exportedAt: new Date().toISOString(),
		exportVersion: '1.0',
		user: {
			id: user.id,
			email: user.email,
			phone: user.phone,
			avatar: user.avatar,
			accountCreated: user.created,
			lastUpdated: user.updated
		},
		memberships: memberships.map((m) => ({
			agencyId: m.agencyId,
			agencyName: m.agencyName,
			role: m.role,
			status: m.status,
			displayName: m.displayName,
			invitedAt: m.invitedAt,
			acceptedAt: m.acceptedAt
		})),
		consultationsCreated: userConsultations.length,
		consultationIds: userConsultations.map((c) => c.id)
	};
});

// =============================================================================
// Type Exports
// =============================================================================

export type AgencyExportData = Awaited<ReturnType<typeof exportAgencyData>>;
export type UserExportData = Awaited<ReturnType<typeof exportUserData>>;
export type DeletionStatus = Awaited<ReturnType<typeof getDeletionStatus>>;
