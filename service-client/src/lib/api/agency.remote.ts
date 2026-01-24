/**
 * Agency Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for agency operations.
 * Follows the remote functions guide:
 * - Uses query() for read operations
 * - Uses command() for programmatic mutations
 * - Uses Valibot for validation (NOT Zod)
 */

import { query, command } from "$app/server";
import { env } from "$env/dynamic/public";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	agencies,
	agencyMemberships,
	agencyFormOptions,
	agencyForms,
	formTemplates,
	users,
	betaInvites,
} from "$lib/server/schema";
import { error } from "@sveltejs/kit";
import { getUserId } from "$lib/server/auth";
import {
	getAgencyContext,
	requireAgencyRole,
	generateSlug,
	isSlugAvailable,
	isValidSlug,
	switchAgency as switchAgencyContext,
} from "$lib/server/agency";
import { logActivity } from "$lib/server/db-helpers";
import { getEffectiveBranding } from "$lib/server/document-branding";
import { eq, and, desc, asc, ne, count, sql, isNull } from "drizzle-orm";
import { sendEmail } from "$lib/server/services/email.service";
import {
	generateTeamInvitationEmail,
	generateTeamAddedEmail,
	type TeamInvitationData,
} from "$lib/templates/email-templates";

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get the current agency context for the authenticated user.
 * Returns agency details, branding, and user's role.
 */
export const getCurrentAgency = query(async () => {
	const context = await getAgencyContext();
	return context;
});

/**
 * Get all agencies the user belongs to.
 * Used for the agency switcher component.
 */
export const getUserAgencies = query(async () => {
	const userId = getUserId();

	const results = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			role: agencyMemberships.role,
			status: agencies.status,
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.status, "active")))
		.orderBy(asc(agencies.name));

	return results;
});

/**
 * Get all form options for the current agency, grouped by category.
 * Returns a map of category -> options[].
 */
export const getAgencyFormOptions = query(async () => {
	const context = await getAgencyContext();

	const options = await db
		.select()
		.from(agencyFormOptions)
		.where(
			and(eq(agencyFormOptions.agencyId, context.agencyId), eq(agencyFormOptions.isActive, true)),
		)
		.orderBy(asc(agencyFormOptions.category), asc(agencyFormOptions.sortOrder));

	// Group by category
	const grouped: Record<string, typeof options> = {};
	for (const option of options) {
		const category = option.category;
		if (!grouped[category]) {
			grouped[category] = [];
		}
		grouped[category]!.push(option);
	}

	return grouped;
});

/**
 * Get form options for a specific category.
 */
export const getFormOptionsByCategory = query(
	v.pipe(v.string(), v.minLength(1)),
	async (category: string) => {
		const context = await getAgencyContext();

		return await db
			.select()
			.from(agencyFormOptions)
			.where(
				and(
					eq(agencyFormOptions.agencyId, context.agencyId),
					eq(agencyFormOptions.category, category),
					eq(agencyFormOptions.isActive, true),
				),
			)
			.orderBy(asc(agencyFormOptions.sortOrder));
	},
);

/**
 * Get agency members (admin/owner only).
 */
export const getAgencyMembers = query(async () => {
	const context = await requireAgencyRole(["owner", "admin"]);

	const members = await db
		.select({
			id: agencyMemberships.id,
			userId: agencyMemberships.userId,
			role: agencyMemberships.role,
			status: agencyMemberships.status,
			displayName: agencyMemberships.displayName,
			invitedAt: agencyMemberships.invitedAt,
			acceptedAt: agencyMemberships.acceptedAt,
			userEmail: users.email,
			userAvatar: users.avatar,
		})
		.from(agencyMemberships)
		.innerJoin(users, eq(agencyMemberships.userId, users.id))
		.where(eq(agencyMemberships.agencyId, context.agencyId))
		.orderBy(desc(agencyMemberships.createdAt));

	return members;
});

/**
 * Check if a slug is available.
 */
export const checkSlugAvailable = query(
	v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
	async (slug: string) => {
		const available = await isSlugAvailable(slug);
		const valid = isValidSlug(slug);
		return { available, valid };
	},
);

// =============================================================================
// Command Functions (Programmatic Mutations)
// =============================================================================

// Validation schemas
const CreateAgencySchema = v.object({
	name: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
	slug: v.optional(v.pipe(v.string(), v.minLength(3), v.maxLength(50))),
	inviteToken: v.optional(v.string()), // Beta invite token
});

const UpdateAgencyBrandingSchema = v.object({
	agencyId: v.optional(v.pipe(v.string(), v.uuid())),
	name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(100))),
	logoUrl: v.optional(v.string()), // Horizontal logo for documents
	logoAvatarUrl: v.optional(v.string()), // Square avatar logo for nav/UI
	primaryColor: v.optional(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/))),
	secondaryColor: v.optional(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/))),
	accentColor: v.optional(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/))),
	accentGradient: v.optional(v.string()), // CSS gradient string for backgrounds
});

const UpdateAgencyContactSchema = v.object({
	agencyId: v.optional(v.pipe(v.string(), v.uuid())),
	email: v.optional(v.pipe(v.string(), v.email())),
	phone: v.optional(v.string()),
	website: v.optional(v.string()),
});

const SwitchAgencySchema = v.pipe(v.string(), v.uuid());

const InviteMemberSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	role: v.picklist(["admin", "member"] as const),
	displayName: v.optional(v.pipe(v.string(), v.maxLength(100))),
});

const UpdateMemberRoleSchema = v.object({
	membershipId: v.pipe(v.string(), v.uuid()),
	role: v.picklist(["admin", "member"] as const),
});

const RemoveMemberSchema = v.pipe(v.string(), v.uuid());

const CancelInvitationSchema = v.pipe(v.string(), v.uuid());

const ResendInvitationSchema = v.pipe(v.string(), v.uuid());

/**
 * Get the base URL for public links in emails
 */
function getPublicBaseUrl(): string {
	return env.PUBLIC_CLIENT_URL || "https://webkit.au";
}

const UpdateFormOptionsSchema = v.object({
	category: v.string(),
	options: v.array(
		v.object({
			value: v.string(),
			label: v.string(),
			sortOrder: v.optional(v.number()),
			isDefault: v.optional(v.boolean()),
			isActive: v.optional(v.boolean()),
			metadata: v.optional(v.record(v.string(), v.unknown())),
		}),
	),
});

/**
 * Create a new agency.
 * The creating user becomes the owner.
 * If inviteToken is provided, validates the beta invite and grants freemium status.
 */
export const createAgency = command(CreateAgencySchema, async (data) => {
	const userId = getUserId();

	// Get the current user's email for invite validation
	const [currentUser] = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!currentUser) {
		throw error(401, "User not found");
	}

	// Validate invite token if provided
	let validInvite: { id: string; email: string; token: string } | null = null;

	if (data.inviteToken) {
		const [invite] = await db
			.select({
				id: betaInvites.id,
				email: betaInvites.email,
				token: betaInvites.token,
				status: betaInvites.status,
				expiresAt: betaInvites.expiresAt,
			})
			.from(betaInvites)
			.where(eq(betaInvites.token, data.inviteToken))
			.limit(1);

		if (!invite) {
			throw error(400, "Invalid invite token");
		}

		if (invite.status === "used") {
			throw error(400, "This invite has already been used");
		}

		if (invite.status === "revoked") {
			throw error(400, "This invite is no longer valid");
		}

		if (
			invite.status === "expired" ||
			(invite.expiresAt && new Date(invite.expiresAt) < new Date())
		) {
			throw error(400, "This invite has expired");
		}

		// Check email matches
		if (invite.email.toLowerCase() !== currentUser.email.toLowerCase()) {
			throw error(400, "This invite is for a different email address");
		}

		validInvite = { id: invite.id, email: invite.email, token: invite.token };
	}

	// Generate slug if not provided
	let slug = data.slug || generateSlug(data.name);

	// Ensure slug is available
	let counter = 1;
	let baseSlug = slug;
	while (!(await isSlugAvailable(slug))) {
		slug = `${baseSlug}-${counter}`;
		counter++;
		if (counter > 100) {
			throw new Error("Unable to generate unique slug");
		}
	}

	// Create agency - include freemium status if valid invite
	const agencyValues: Record<string, unknown> = {
		name: data.name,
		slug,
	};

	if (validInvite) {
		agencyValues["isFreemium"] = true;
		agencyValues["freemiumReason"] = "beta_tester";
		agencyValues["freemiumGrantedAt"] = new Date();
		agencyValues["freemiumGrantedBy"] = "system:beta_invite";
	}

	const [agency] = await db.insert(agencies).values(agencyValues).returning();

	if (!agency) {
		throw new Error("Failed to create agency");
	}

	// Create owner membership
	await db.insert(agencyMemberships).values({
		userId,
		agencyId: agency.id,
		role: "owner",
		status: "active",
		acceptedAt: new Date(),
	});

	// Auto-seed Full Discovery consultation form from template
	try {
		const [template] = await db
			.select()
			.from(formTemplates)
			.where(eq(formTemplates.slug, "full-discovery"))
			.limit(1);

		if (template) {
			await db.insert(agencyForms).values({
				agencyId: agency.id,
				name: template.name,
				slug: "full-discovery",
				description: template.description,
				formType: "consultation",
				schema: template.schema,
				uiConfig: template.uiConfig,
				isActive: true,
				isDefault: true,
				sourceTemplateId: template.id,
				createdBy: userId,
			});

			// Increment template usage count
			await db
				.update(formTemplates)
				.set({ usageCount: sql`${formTemplates.usageCount} + 1` })
				.where(eq(formTemplates.id, template.id));
		}
	} catch {
		// Non-critical: agency still works without auto-seeded form
	}

	// Mark invite as used
	if (validInvite) {
		await db
			.update(betaInvites)
			.set({
				status: "used",
				usedAt: new Date(),
				usedByAgencyId: agency.id,
			})
			.where(eq(betaInvites.id, validInvite.id));
	}

	// Set as user's default agency if they don't have one
	await db
		.update(users)
		.set({ defaultAgencyId: agency.id })
		.where(and(eq(users.id, userId), eq(users.defaultAgencyId, null as unknown as string)));

	// Switch to new agency
	await switchAgencyContext(agency.id);

	// Log activity
	await logActivity("agency.created", "agency", agency.id, {
		newValues: {
			name: data.name,
			slug: agency.slug,
			...(validInvite ? { isFreemium: true, freemiumReason: "beta_tester" } : {}),
		},
	});

	return { agencyId: agency.id, slug: agency.slug, isFreemium: !!validInvite };
});

/**
 * Update agency branding (admin/owner only).
 */
export const updateAgencyBranding = command(UpdateAgencyBrandingSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin"], data.agencyId);

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) updates["name"] = data.name;
	if (data.logoUrl !== undefined) updates["logoUrl"] = data.logoUrl;
	if (data.logoAvatarUrl !== undefined) updates["logoAvatarUrl"] = data.logoAvatarUrl;
	if (data.primaryColor !== undefined) updates["primaryColor"] = data.primaryColor;
	if (data.secondaryColor !== undefined) updates["secondaryColor"] = data.secondaryColor;
	if (data.accentColor !== undefined) updates["accentColor"] = data.accentColor;
	if (data.accentGradient !== undefined) updates["accentGradient"] = data.accentGradient;

	await db.update(agencies).set(updates).where(eq(agencies.id, context.agencyId));

	// Log activity
	await logActivity("agency.branding.updated", "agency", context.agencyId, {
		newValues: updates,
	});
});

/**
 * Update agency contact info (admin/owner only).
 */
export const updateAgencyContact = command(UpdateAgencyContactSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin"], data.agencyId);

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.email !== undefined) updates["email"] = data.email;
	if (data.phone !== undefined) updates["phone"] = data.phone;
	if (data.website !== undefined) updates["website"] = data.website;

	await db.update(agencies).set(updates).where(eq(agencies.id, context.agencyId));

	// Log activity
	await logActivity("agency.contact.updated", "agency", context.agencyId, {
		newValues: updates,
	});
});

/**
 * Switch to a different agency.
 */
export const switchAgency = command(SwitchAgencySchema, async (agencyId: string) => {
	await switchAgencyContext(agencyId);
});

/**
 * Invite a new member to the agency (admin/owner only).
 * For new users: Creates user with placeholder sub, sends invitation email
 * For existing users: Creates membership immediately, sends notification email
 */
export const inviteMember = command(InviteMemberSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin"]);
	const currentUserId = getUserId();

	// Get inviter details for email
	const [inviter] = await db
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(eq(users.id, currentUserId))
		.limit(1);

	// Find existing user by email
	const [existingUser] = await db
		.select({ id: users.id, sub: users.sub })
		.from(users)
		.where(eq(users.email, data.email))
		.limit(1);

	let targetUserId: string;
	let isNewUser = false;

	if (!existingUser) {
		// Create new user with placeholder sub
		isNewUser = true;
		const placeholderSub = `invited:${crypto.randomUUID()}`;
		const [newUser] = await db
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				email: data.email,
				sub: placeholderSub,
				access: 0, // Regular user (no special flags)
				apiKey: "", // Empty until they actually log in
			})
			.returning({ id: users.id });

		targetUserId = newUser.id;
	} else {
		targetUserId = existingUser.id;
	}

	// Check if user is already a member
	const [existingMembership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.userId, targetUserId),
				eq(agencyMemberships.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (existingMembership) {
		throw new Error("User is already a member of this agency");
	}

	// Create membership
	// For new users: acceptedAt is null (pending until first login)
	// For existing users: acceptedAt is now (immediately active)
	const [newMembership] = await db
		.insert(agencyMemberships)
		.values({
			userId: targetUserId,
			agencyId: context.agencyId,
			role: data.role,
			status: "active",
			displayName: data.displayName || null,
			invitedAt: new Date(),
			invitedBy: currentUserId,
			acceptedAt: isNewUser ? null : new Date(),
		})
		.returning({ id: agencyMemberships.id });

	// Get agency details for email
	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, context.agencyId),
	});

	if (!agency) {
		throw new Error("Agency not found");
	}

	// Get email-specific branding (with overrides if configured)
	const emailBranding = await getEffectiveBranding(context.agencyId, "email");

	// Build email data with email branding overrides
	const loginUrl = `${getPublicBaseUrl()}/login?return=/${agency.slug}`;
	const emailData: TeamInvitationData = {
		agency: {
			name: agency.name,
			primaryColor: emailBranding.primaryColor || agency.primaryColor || undefined,
			logoUrl: emailBranding.logoUrl || agency.logoUrl || undefined,
		},
		invitee: { email: data.email },
		inviter: { name: inviter?.email || "A team member" },
		role: data.role,
		loginUrl: isNewUser ? loginUrl : `${getPublicBaseUrl()}/${agency.slug}`,
	};

	// Send appropriate email
	const emailTemplate = isNewUser
		? generateTeamInvitationEmail(emailData)
		: generateTeamAddedEmail(emailData);

	const emailResult = await sendEmail({
		to: data.email,
		subject: emailTemplate.subject,
		html: emailTemplate.bodyHtml,
		replyTo: agency.email || undefined,
	});

	if (!emailResult.success) {
		console.error("Failed to send invitation email:", emailResult.error);
		// Don't throw - membership is created, email can be resent
	}

	// Log activity
	await logActivity("member.invited", "membership", newMembership?.id, {
		newValues: { email: data.email, role: data.role, userId: targetUserId, isNewUser },
	});

	return { success: true, isNewUser, emailSent: emailResult.success };
});

/**
 * Update a member's role (owner only for admin promotion, admin+ for member changes).
 */
export const updateMemberRole = command(UpdateMemberRoleSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin"]);

	// Get the membership to update
	const [membership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.id, data.membershipId),
				eq(agencyMemberships.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!membership) {
		throw new Error("Membership not found");
	}

	// Cannot change owner's role
	if (membership.role === "owner") {
		throw new Error("Cannot change owner role. Transfer ownership instead.");
	}

	// Only owner can promote to admin
	if (data.role === "admin" && context.role !== "owner") {
		throw new Error("Only the owner can promote members to admin");
	}

	const oldRole = membership.role;
	await db
		.update(agencyMemberships)
		.set({ role: data.role, updatedAt: new Date() })
		.where(eq(agencyMemberships.id, data.membershipId));

	// Log activity
	await logActivity("member.role.changed", "membership", data.membershipId, {
		oldValues: { role: oldRole },
		newValues: { role: data.role },
		metadata: { userId: membership.userId },
	});
});

/**
 * Remove a member from the agency (admin/owner only).
 */
export const removeMember = command(RemoveMemberSchema, async (membershipId: string) => {
	const context = await requireAgencyRole(["owner", "admin"]);

	// Get the membership to remove
	const [membership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(eq(agencyMemberships.id, membershipId), eq(agencyMemberships.agencyId, context.agencyId)),
		)
		.limit(1);

	if (!membership) {
		throw new Error("Membership not found");
	}

	// Cannot remove owner
	if (membership.role === "owner") {
		throw new Error("Cannot remove owner. Transfer ownership first.");
	}

	// Admin can only remove members, not other admins
	if (membership.role === "admin" && context.role !== "owner") {
		throw new Error("Only the owner can remove admins");
	}

	await db.delete(agencyMemberships).where(eq(agencyMemberships.id, membershipId));

	// Log activity
	await logActivity("member.removed", "membership", membershipId, {
		oldValues: { userId: membership.userId, role: membership.role },
	});
});

/**
 * Cancel a pending invitation (admin/owner only).
 * For users who haven't logged in yet (sub starts with 'invited:'),
 * also deletes the user if they have no other memberships.
 */
export const cancelInvitation = command(CancelInvitationSchema, async (membershipId: string) => {
	const context = await requireAgencyRole(["owner", "admin"]);

	// Get the membership to cancel
	const [membership] = await db
		.select({
			id: agencyMemberships.id,
			userId: agencyMemberships.userId,
			role: agencyMemberships.role,
			acceptedAt: agencyMemberships.acceptedAt,
		})
		.from(agencyMemberships)
		.where(
			and(eq(agencyMemberships.id, membershipId), eq(agencyMemberships.agencyId, context.agencyId)),
		)
		.limit(1);

	if (!membership) {
		throw new Error("Invitation not found");
	}

	// Cannot cancel owner
	if (membership.role === "owner") {
		throw new Error("Cannot cancel owner membership");
	}

	// Get the user to check their sub and other memberships
	const [user] = await db
		.select({ id: users.id, sub: users.sub, email: users.email })
		.from(users)
		.where(eq(users.id, membership.userId))
		.limit(1);

	// Delete the membership
	await db.delete(agencyMemberships).where(eq(agencyMemberships.id, membershipId));

	// If user has placeholder sub (never logged in) and no other memberships, delete user
	if (user && user.sub?.startsWith("invited:")) {
		const [otherMembership] = await db
			.select({ id: agencyMemberships.id })
			.from(agencyMemberships)
			.where(eq(agencyMemberships.userId, user.id))
			.limit(1);

		if (!otherMembership) {
			// No other memberships - safe to delete the orphan user
			await db.delete(users).where(eq(users.id, user.id));
		}
	}

	// Log activity
	await logActivity("invitation.cancelled", "membership", membershipId, {
		oldValues: { userId: membership.userId, role: membership.role },
	});

	return { success: true };
});

/**
 * Resend invitation email to a pending member (admin/owner only).
 * Only works for members who haven't accepted yet (acceptedAt is null).
 */
export const resendInvitation = command(ResendInvitationSchema, async (membershipId: string) => {
	const context = await requireAgencyRole(["owner", "admin"]);
	const currentUserId = getUserId();

	// Get the membership
	const [membership] = await db
		.select({
			id: agencyMemberships.id,
			userId: agencyMemberships.userId,
			role: agencyMemberships.role,
			acceptedAt: agencyMemberships.acceptedAt,
		})
		.from(agencyMemberships)
		.where(
			and(eq(agencyMemberships.id, membershipId), eq(agencyMemberships.agencyId, context.agencyId)),
		)
		.limit(1);

	if (!membership) {
		throw new Error("Invitation not found");
	}

	if (membership.acceptedAt !== null) {
		throw new Error("Cannot resend - member has already accepted");
	}

	// Get user details
	const [user] = await db
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(eq(users.id, membership.userId))
		.limit(1);

	if (!user) {
		throw new Error("User not found");
	}

	// Get inviter details
	const [inviter] = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, currentUserId))
		.limit(1);

	// Get agency details
	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, context.agencyId),
	});

	if (!agency) {
		throw new Error("Agency not found");
	}

	// Get email-specific branding (with overrides if configured)
	const emailBranding = await getEffectiveBranding(context.agencyId, "email");

	// Build and send email with email branding overrides
	const loginUrl = `${getPublicBaseUrl()}/login?return=/${agency.slug}`;
	const emailData: TeamInvitationData = {
		agency: {
			name: agency.name,
			primaryColor: emailBranding.primaryColor || agency.primaryColor || undefined,
			logoUrl: emailBranding.logoUrl || agency.logoUrl || undefined,
		},
		invitee: { email: user.email },
		inviter: { name: inviter?.email || "A team member" },
		role: membership.role as "admin" | "member",
		loginUrl,
	};

	const emailTemplate = generateTeamInvitationEmail(emailData);
	const emailResult = await sendEmail({
		to: user.email,
		subject: emailTemplate.subject,
		html: emailTemplate.bodyHtml,
		replyTo: agency.email || undefined,
	});

	if (!emailResult.success) {
		throw new Error(`Failed to send email: ${emailResult.error}`);
	}

	// Update invitedAt timestamp
	await db
		.update(agencyMemberships)
		.set({
			invitedAt: new Date(),
			invitedBy: currentUserId,
			updatedAt: new Date(),
		})
		.where(eq(agencyMemberships.id, membershipId));

	// Log activity
	await logActivity("invitation.resent", "membership", membershipId, {
		metadata: { email: user.email },
	});

	return { success: true };
});

/**
 * Update form options for a category (admin/owner only).
 * Uses upsert pattern - creates new options or updates existing ones.
 */
export const updateFormOptions = command(UpdateFormOptionsSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin"]);

	// Delete existing options for this category
	await db
		.delete(agencyFormOptions)
		.where(
			and(
				eq(agencyFormOptions.agencyId, context.agencyId),
				eq(agencyFormOptions.category, data.category),
			),
		);

	// Insert new options
	if (data.options.length > 0) {
		await db.insert(agencyFormOptions).values(
			data.options.map((opt, index) => ({
				agencyId: context.agencyId,
				category: data.category,
				value: opt.value,
				label: opt.label,
				sortOrder: opt.sortOrder ?? index,
				isDefault: opt.isDefault ?? false,
				isActive: opt.isActive ?? true,
				metadata: opt.metadata ?? {},
			})),
		);
	}

	// Log activity
	await logActivity("form.options.updated", "form_options", undefined, {
		newValues: { category: data.category, optionCount: data.options.length },
	});
});

/**
 * Set user's default agency.
 */
export const setDefaultAgency = command(SwitchAgencySchema, async (agencyId: string) => {
	const userId = getUserId();

	// Verify user has access
	const context = await getAgencyContext();
	if (context.agencyId !== agencyId) {
		await requireAgencyRole(["owner", "admin", "member"], agencyId);
	}

	await db.update(users).set({ defaultAgencyId: agencyId }).where(eq(users.id, userId));
});

// =============================================================================
// User Profile Functions
// =============================================================================

/**
 * Get current user's profile for the account page.
 * Returns user data (email, avatar) and membership data (displayName).
 */
export const getCurrentUserProfile = query(async () => {
	const userId = getUserId();
	const context = await getAgencyContext();

	const [user] = await db
		.select({
			id: users.id,
			email: users.email,
			avatar: users.avatar,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw new Error("User not found");
	}

	const [membership] = await db
		.select({
			displayName: agencyMemberships.displayName,
		})
		.from(agencyMemberships)
		.where(
			and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.agencyId, context.agencyId)),
		)
		.limit(1);

	return {
		id: user.id,
		email: user.email,
		avatar: user.avatar,
		displayName: membership?.displayName || "",
	};
});

/**
 * Update current user's display name for this agency.
 */
const UpdateDisplayNameSchema = v.object({
	displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
});

export const updateMyDisplayName = command(UpdateDisplayNameSchema, async (data) => {
	const userId = getUserId();
	const context = await getAgencyContext();

	await db
		.update(agencyMemberships)
		.set({ displayName: data.displayName, updatedAt: new Date() })
		.where(
			and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.agencyId, context.agencyId)),
		);

	// Log activity
	await logActivity("profile.displayName.updated", "membership", undefined, {
		newValues: { displayName: data.displayName },
	});
});

/**
 * Update another member's display name (owner/admin only).
 */
const UpdateMemberDisplayNameSchema = v.object({
	membershipId: v.pipe(v.string(), v.uuid()),
	displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
});

export const updateMemberDisplayName = command(UpdateMemberDisplayNameSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin"]);

	// Get the membership to update
	const [membership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.id, data.membershipId),
				eq(agencyMemberships.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!membership) {
		throw new Error("Membership not found");
	}

	// Cannot modify owner's name (unless you are the owner modifying yourself)
	if (membership.role === "owner" && membership.userId !== context.userId) {
		throw new Error("Cannot modify owner display name");
	}

	await db
		.update(agencyMemberships)
		.set({ displayName: data.displayName, updatedAt: new Date() })
		.where(eq(agencyMemberships.id, data.membershipId));

	// Log activity
	await logActivity("member.displayName.updated", "membership", data.membershipId, {
		newValues: { displayName: data.displayName },
	});
});

/**
 * Update current user's avatar URL.
 */
const UpdateAvatarSchema = v.object({
	avatarUrl: v.pipe(v.string(), v.maxLength(2048)),
});

export const updateMyAvatar = command(UpdateAvatarSchema, async (data) => {
	const userId = getUserId();

	await db.update(users).set({ avatar: data.avatarUrl }).where(eq(users.id, userId));

	// Log activity
	await logActivity("profile.avatar.updated", "user", userId, {
		newValues: { hasAvatar: data.avatarUrl.length > 0 },
	});
});
