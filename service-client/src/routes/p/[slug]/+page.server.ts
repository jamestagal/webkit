/**
 * Public Proposal View - Server Load & Actions
 *
 * Loads proposal by public slug without authentication.
 * Records view count.
 * Handles client response actions (accept, decline, revision request).
 */

import type { PageServerLoad, Actions } from "./$types";
import { db } from "$lib/server/db";
import {
	proposals,
	agencies,
	agencyProfiles,
	agencyPackages,
	agencyAddons,
} from "$lib/server/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { error, fail } from "@sveltejs/kit";
import {
	acceptProposal,
	declineProposal,
	requestProposalRevision,
} from "$lib/api/proposals.remote";

export const load: PageServerLoad = async ({ params, url }) => {
	const { slug } = params;
	const isPreview = url.searchParams.get("preview") === "true";

	// Fetch proposal by slug
	const [proposal] = await db.select().from(proposals).where(eq(proposals.slug, slug)).limit(1);

	if (!proposal) {
		throw error(404, "Proposal not found");
	}

	// Check if expired
	const isExpired = proposal.validUntil && new Date(proposal.validUntil) < new Date();

	// Record view only if NOT in preview mode (fire-and-forget, don't await)
	if (!isPreview) {
		const updates: Record<string, unknown> = {
			viewCount: sql`${proposals.viewCount} + 1`,
			lastViewedAt: new Date(),
		};

		// If status is 'sent', change to 'viewed'
		if (proposal.status === "sent") {
			updates["status"] = "viewed";
		}

		db.update(proposals)
			.set(updates)
			.where(eq(proposals.id, proposal.id))
			.then(() => {})
			.catch(() => {});
	}

	// Fetch agency
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, proposal.agencyId))
		.limit(1);

	// Fetch agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, proposal.agencyId))
		.limit(1);

	// Fetch selected package if any
	let selectedPackage = null;
	if (proposal.selectedPackageId) {
		const [pkg] = await db
			.select()
			.from(agencyPackages)
			.where(eq(agencyPackages.id, proposal.selectedPackageId))
			.limit(1);
		selectedPackage = pkg || null;
	}

	// Fetch selected addons
	const addonIds = (proposal.selectedAddons as string[]) || [];
	let selectedAddons: (typeof agencyAddons.$inferSelect)[] = [];
	if (addonIds.length > 0) {
		selectedAddons = await db.select().from(agencyAddons).where(inArray(agencyAddons.id, addonIds));
	}

	return {
		proposal: {
			...proposal,
			status: isExpired ? "expired" : proposal.status,
		},
		agency,
		profile,
		selectedPackage,
		selectedAddons,
		isPreview,
	};
};

// Form actions for client responses (PART 2: Proposal Improvements)
export const actions: Actions = {
	accept: async ({ params, request }) => {
		const data = await request.formData();
		const comments = data.get("comments")?.toString() || "";

		try {
			const result = await acceptProposal({
				slug: params.slug,
				comments: comments || undefined,
			});
			return { success: true, action: "accepted", contractSlug: result.contractSlug };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : "Failed to accept proposal",
			});
		}
	},

	decline: async ({ params, request }) => {
		const data = await request.formData();
		const reason = data.get("reason")?.toString() || "";

		try {
			await declineProposal({
				slug: params.slug,
				reason: reason || undefined,
			});
			return { success: true, action: "declined" };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : "Failed to decline proposal",
			});
		}
	},

	requestRevision: async ({ params, request }) => {
		const data = await request.formData();
		const notes = data.get("notes")?.toString() || "";

		try {
			await requestProposalRevision({
				slug: params.slug,
				notes,
			});
			return { success: true, action: "revision_requested" };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : "Failed to request revision",
			});
		}
	},
};
