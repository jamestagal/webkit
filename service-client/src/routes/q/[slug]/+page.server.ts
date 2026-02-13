/**
 * Public Quotation View - Server Load
 *
 * Loads quotation by public slug without authentication.
 * Records view count and updates status if needed.
 * Handles accept/decline form actions.
 */

import type { PageServerLoad, Actions } from "./$types";
import { db } from "$lib/server/db";
import { quotations, quotationScopeSections, agencies, agencyProfiles } from "$lib/server/schema";
import { eq, sql, asc } from "drizzle-orm";
import { error, fail } from "@sveltejs/kit";
import { decryptProfileFields } from "$lib/server/crypto";
import { logActivity } from "$lib/server/db-helpers";

function getEffectiveStatus(quotation: { status: string; expiryDate: Date | null }): string {
	if (
		["sent", "viewed"].includes(quotation.status) &&
		quotation.expiryDate &&
		new Date(quotation.expiryDate) < new Date()
	) {
		return "expired";
	}
	return quotation.status;
}

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	// Fetch quotation by slug
	const [quotation] = await db
		.select()
		.from(quotations)
		.where(eq(quotations.slug, slug))
		.limit(1);

	if (!quotation) {
		throw error(404, "Quotation not found");
	}

	const effectiveStatus = getEffectiveStatus(quotation);

	// Record view (fire-and-forget, don't await)
	const updates: Record<string, unknown> = {
		viewCount: sql`${quotations.viewCount} + 1`,
		lastViewedAt: new Date(),
	};

	// If status is 'sent', change to 'viewed'
	if (quotation.status === "sent") {
		updates["status"] = "viewed";
	}

	db.update(quotations)
		.set(updates)
		.where(eq(quotations.id, quotation.id))
		.then(() => {})
		.catch((err) => {
			console.error(`Failed to record quotation view for ${quotation.id}:`, err);
		});

	// Fetch scope sections
	const sections = await db
		.select()
		.from(quotationScopeSections)
		.where(eq(quotationScopeSections.quotationId, quotation.id))
		.orderBy(asc(quotationScopeSections.sortOrder));

	// Fetch agency
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, quotation.agencyId))
		.limit(1);

	// Fetch agency profile (decrypt banking/tax fields for display)
	const [rawProfile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, quotation.agencyId))
		.limit(1);

	const profile = rawProfile ? decryptProfileFields(rawProfile) : null;

	return {
		quotation: {
			...quotation,
			effectiveStatus,
		},
		sections,
		agency,
		profile,
	};
};

export const actions: Actions = {
	accept: async ({ params, request }) => {
		const { slug } = params;
		const formData = await request.formData();

		const acceptedByName = formData.get("acceptedByName")?.toString() || "";
		const acceptedByTitle = formData.get("acceptedByTitle")?.toString() || "";

		if (!acceptedByName) {
			return fail(400, { error: "Your name is required" });
		}

		// Fetch quotation
		const [quotation] = await db
			.select()
			.from(quotations)
			.where(eq(quotations.slug, slug))
			.limit(1);

		if (!quotation) {
			return fail(404, { error: "Quotation not found" });
		}

		// Verify quotation can be accepted
		const effective = getEffectiveStatus(quotation);
		if (!["sent", "viewed"].includes(effective)) {
			return fail(400, { error: "Quotation is not available for acceptance" });
		}

		const now = new Date();

		await db
			.update(quotations)
			.set({
				status: "accepted",
				acceptedByName,
				acceptedByTitle: acceptedByTitle || null,
				acceptedAt: now,
				updatedAt: now,
			})
			.where(eq(quotations.id, quotation.id));

		await logActivity("quotation.accepted", "quotation", quotation.id, {
			newValues: {
				acceptedByName,
				acceptedAt: now.toISOString(),
			},
		});

		return { success: true, action: "accepted" };
	},

	decline: async ({ params, request }) => {
		const { slug } = params;
		const formData = await request.formData();

		const reason = formData.get("reason")?.toString() || "";

		// Fetch quotation
		const [quotation] = await db
			.select()
			.from(quotations)
			.where(eq(quotations.slug, slug))
			.limit(1);

		if (!quotation) {
			return fail(404, { error: "Quotation not found" });
		}

		// Verify quotation can be declined
		const effective = getEffectiveStatus(quotation);
		if (!["sent", "viewed"].includes(effective)) {
			return fail(400, { error: "Quotation is not available for declining" });
		}

		const now = new Date();

		await db
			.update(quotations)
			.set({
				status: "declined",
				declinedAt: now,
				declineReason: reason,
				updatedAt: now,
			})
			.where(eq(quotations.id, quotation.id));

		await logActivity("quotation.declined", "quotation", quotation.id, {
			newValues: {
				declinedAt: now.toISOString(),
				reason,
			},
		});

		return { success: true, action: "declined" };
	},
};
