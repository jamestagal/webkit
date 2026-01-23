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
	emailLogs,
} from "$lib/server/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { error, fail } from "@sveltejs/kit";
import {
	acceptProposal,
	declineProposal,
	requestProposalRevision,
} from "$lib/api/proposals.remote";
import { sendEmail } from "$lib/server/services/email.service";
import {
	generateProposalAcceptedAgencyEmail,
	generateProposalDeclinedAgencyEmail,
	generateProposalRevisionRequestedAgencyEmail,
} from "$lib/templates/email-templates";
import { env } from "$env/dynamic/public";

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
			.catch((err) => {
				console.error(`Failed to record proposal view for ${proposal.id}:`, err);
			});
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

			// Send notification to agency (fire-and-forget)
			const baseUrl = env.PUBLIC_CLIENT_URL || "https://webkit.au";
			const respondedAt = new Date().toLocaleDateString("en-AU", {
				day: "numeric",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});

			db.select()
				.from(proposals)
				.where(eq(proposals.slug, params.slug))
				.limit(1)
				.then(async ([proposal]) => {
					if (!proposal) return;

					const [agency] = await db
						.select()
						.from(agencies)
						.where(eq(agencies.id, proposal.agencyId))
						.limit(1);

					if (!agency?.email) return;

					const notificationData = {
						agency: {
							name: agency.name,
							...(agency.email ? { email: agency.email } : {}),
							...(agency.primaryColor ? { primaryColor: agency.primaryColor } : {}),
							...(agency.logoUrl ? { logoUrl: agency.logoUrl } : {}),
						},
						proposal: {
							number: proposal.proposalNumber,
							publicUrl: `${baseUrl}/p/${params.slug}`,
						},
						client: {
							name: proposal.clientContactName || proposal.clientBusinessName || "Client",
							...(proposal.clientBusinessName ? { businessName: proposal.clientBusinessName } : {}),
							email: proposal.clientEmail,
						},
						respondedAt,
						...(comments ? { comments } : {}),
						...(result.contractSlug ? { contractSlug: result.contractSlug } : {}),
					};

					const emailTemplate = generateProposalAcceptedAgencyEmail(notificationData);
					const emailResult = await sendEmail({
						to: agency.email,
						subject: emailTemplate.subject,
						html: emailTemplate.bodyHtml,
					});

					await db.insert(emailLogs).values({
						agencyId: proposal.agencyId,
						proposalId: proposal.id,
						emailType: "proposal_accepted_agency",
						recipientEmail: agency.email,
						recipientName: agency.name,
						subject: emailTemplate.subject,
						bodyHtml: emailTemplate.bodyHtml,
						status: emailResult.success ? "sent" : "failed",
						resendMessageId: emailResult.messageId || null,
					});
				})
				.catch((err) => {
					console.error("Failed to send proposal accepted notification:", err);
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

			// Send notification to agency (fire-and-forget)
			const baseUrl = env.PUBLIC_CLIENT_URL || "https://webkit.au";
			const respondedAt = new Date().toLocaleDateString("en-AU", {
				day: "numeric",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});

			db.select()
				.from(proposals)
				.where(eq(proposals.slug, params.slug))
				.limit(1)
				.then(async ([proposal]) => {
					if (!proposal) return;

					const [agency] = await db
						.select()
						.from(agencies)
						.where(eq(agencies.id, proposal.agencyId))
						.limit(1);

					if (!agency?.email) return;

					const notificationData = {
						agency: {
							name: agency.name,
							...(agency.email ? { email: agency.email } : {}),
							...(agency.primaryColor ? { primaryColor: agency.primaryColor } : {}),
							...(agency.logoUrl ? { logoUrl: agency.logoUrl } : {}),
						},
						proposal: {
							number: proposal.proposalNumber,
							publicUrl: `${baseUrl}/p/${params.slug}`,
						},
						client: {
							name: proposal.clientContactName || proposal.clientBusinessName || "Client",
							...(proposal.clientBusinessName ? { businessName: proposal.clientBusinessName } : {}),
							email: proposal.clientEmail,
						},
						respondedAt,
						...(reason ? { reason } : {}),
					};

					const emailTemplate = generateProposalDeclinedAgencyEmail(notificationData);
					const emailResult = await sendEmail({
						to: agency.email,
						subject: emailTemplate.subject,
						html: emailTemplate.bodyHtml,
					});

					await db.insert(emailLogs).values({
						agencyId: proposal.agencyId,
						proposalId: proposal.id,
						emailType: "proposal_declined_agency",
						recipientEmail: agency.email,
						recipientName: agency.name,
						subject: emailTemplate.subject,
						bodyHtml: emailTemplate.bodyHtml,
						status: emailResult.success ? "sent" : "failed",
						resendMessageId: emailResult.messageId || null,
					});
				})
				.catch((err) => {
					console.error("Failed to send proposal declined notification:", err);
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

			// Send notification to agency (fire-and-forget)
			const baseUrl = env.PUBLIC_CLIENT_URL || "https://webkit.au";
			const respondedAt = new Date().toLocaleDateString("en-AU", {
				day: "numeric",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});

			db.select()
				.from(proposals)
				.where(eq(proposals.slug, params.slug))
				.limit(1)
				.then(async ([proposal]) => {
					if (!proposal) return;

					const [agency] = await db
						.select()
						.from(agencies)
						.where(eq(agencies.id, proposal.agencyId))
						.limit(1);

					if (!agency?.email) return;

					const notificationData = {
						agency: {
							name: agency.name,
							...(agency.email ? { email: agency.email } : {}),
							...(agency.primaryColor ? { primaryColor: agency.primaryColor } : {}),
							...(agency.logoUrl ? { logoUrl: agency.logoUrl } : {}),
						},
						proposal: {
							number: proposal.proposalNumber,
							publicUrl: `${baseUrl}/p/${params.slug}`,
						},
						client: {
							name: proposal.clientContactName || proposal.clientBusinessName || "Client",
							...(proposal.clientBusinessName ? { businessName: proposal.clientBusinessName } : {}),
							email: proposal.clientEmail,
						},
						respondedAt,
						...(notes ? { notes } : {}),
					};

					const emailTemplate = generateProposalRevisionRequestedAgencyEmail(notificationData);
					const emailResult = await sendEmail({
						to: agency.email,
						subject: emailTemplate.subject,
						html: emailTemplate.bodyHtml,
					});

					await db.insert(emailLogs).values({
						agencyId: proposal.agencyId,
						proposalId: proposal.id,
						emailType: "proposal_revision_requested_agency",
						recipientEmail: agency.email,
						recipientName: agency.name,
						subject: emailTemplate.subject,
						bodyHtml: emailTemplate.bodyHtml,
						status: emailResult.success ? "sent" : "failed",
						resendMessageId: emailResult.messageId || null,
					});
				})
				.catch((err) => {
					console.error("Failed to send proposal revision requested notification:", err);
				});

			return { success: true, action: "revision_requested" };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : "Failed to request revision",
			});
		}
	},
};
