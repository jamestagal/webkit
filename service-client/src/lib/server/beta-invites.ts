/**
 * Beta Invites Server Utilities
 *
 * Internal functions for beta invite management.
 * These are used during agency creation and are not directly exposed via remote functions.
 */

import { db } from "$lib/server/db";
import { betaInvites } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";

/**
 * Mark an invite as used (called during agency creation)
 */
export async function markInviteAsUsed(token: string, agencyId: string): Promise<void> {
	await db
		.update(betaInvites)
		.set({
			status: "used",
			usedAt: new Date(),
			usedByAgencyId: agencyId,
		})
		.where(eq(betaInvites.token, token));
}

/**
 * Validate and get invite by token for internal use (during agency creation)
 */
export async function getInviteForAgencyCreation(token: string): Promise<{
	valid: boolean;
	email?: string;
	reason?: string;
}> {
	const [invite] = await db
		.select({
			id: betaInvites.id,
			email: betaInvites.email,
			status: betaInvites.status,
			expiresAt: betaInvites.expiresAt,
		})
		.from(betaInvites)
		.where(eq(betaInvites.token, token))
		.limit(1);

	if (!invite) {
		return { valid: false, reason: "Invalid invite token" };
	}

	if (invite.status === "used") {
		return { valid: false, reason: "This invite has already been used" };
	}

	if (invite.status === "revoked") {
		return { valid: false, reason: "This invite is no longer valid" };
	}

	if (invite.status === "expired") {
		return { valid: false, reason: "This invite has expired" };
	}

	// Check if expired by date
	if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
		// Update status to expired
		await db.update(betaInvites).set({ status: "expired" }).where(eq(betaInvites.id, invite.id));

		return { valid: false, reason: "This invite has expired" };
	}

	return { valid: true, email: invite.email };
}
