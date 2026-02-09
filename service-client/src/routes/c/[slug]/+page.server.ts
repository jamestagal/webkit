/**
 * Public Contract View - Server Load
 *
 * Loads contract by public slug without authentication.
 * Records view count and updates status if needed.
 */

import type { PageServerLoad, Actions } from "./$types";
import { db } from "$lib/server/db";
import { contracts, agencies, agencyProfiles, contractSchedules, emailLogs } from "$lib/server/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { error, fail } from "@sveltejs/kit";
import { sendEmail } from "$lib/server/services/email.service";
import {
	generateContractSignedClientEmail,
	generateContractSignedAgencyEmail,
} from "$lib/templates/email-templates";
import { env } from "$env/dynamic/public";
import { formatDateTime } from "$lib/utils/formatting";

export const load: PageServerLoad = async ({ params, url }) => {
	const { slug } = params;
	const isPreview = url.searchParams.get("preview") === "true";

	// Fetch contract by slug
	const [contract] = await db.select().from(contracts).where(eq(contracts.slug, slug)).limit(1);

	if (!contract) {
		throw error(404, "Contract not found");
	}

	// Check if expired
	const isExpired =
		contract.validUntil &&
		new Date(contract.validUntil) < new Date() &&
		!["signed", "completed"].includes(contract.status);

	// Record view only if NOT in preview mode (fire-and-forget, don't await)
	if (!isPreview) {
		const updates: Record<string, unknown> = {
			viewCount: sql`${contracts.viewCount} + 1`,
			lastViewedAt: new Date(),
		};

		// If status is 'sent', change to 'viewed'
		if (contract.status === "sent") {
			updates["status"] = "viewed";
		}

		db.update(contracts)
			.set(updates)
			.where(eq(contracts.id, contract.id))
			.then(() => {})
			.catch((err) => {
				console.error(`Failed to record contract view for ${contract.id}:`, err);
			});
	}

	// Fetch agency
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, contract.agencyId))
		.limit(1);

	// Fetch agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, contract.agencyId))
		.limit(1);

	// Fetch included schedule sections
	const includedScheduleIds = (contract.includedScheduleIds as string[]) || [];
	let includedSchedules: Array<{
		id: string;
		name: string;
		content: string;
		displayOrder: number;
	}> = [];

	if (includedScheduleIds.length > 0) {
		includedSchedules = await db
			.select({
				id: contractSchedules.id,
				name: contractSchedules.name,
				content: contractSchedules.content,
				displayOrder: contractSchedules.displayOrder,
			})
			.from(contractSchedules)
			.where(inArray(contractSchedules.id, includedScheduleIds))
			.orderBy(contractSchedules.displayOrder);
	}

	return {
		contract: {
			...contract,
			status: isExpired ? "expired" : contract.status,
		},
		agency,
		profile,
		includedSchedules,
		isPreview,
	};
};

export const actions: Actions = {
	sign: async ({ params, request, getClientAddress }) => {
		const { slug } = params;
		const formData = await request.formData();

		const signatoryName = formData.get("signatoryName")?.toString() || "";
		const signatoryTitle = formData.get("signatoryTitle")?.toString() || "";
		const agreedToTerms = formData.get("agreedToTerms") === "true";

		// Validation
		if (!signatoryName) {
			return fail(400, { error: "Signatory name is required" });
		}

		if (!agreedToTerms) {
			return fail(400, { error: "You must agree to the terms and conditions" });
		}

		// Fetch contract
		const [contract] = await db.select().from(contracts).where(eq(contracts.slug, slug)).limit(1);

		if (!contract) {
			return fail(404, { error: "Contract not found" });
		}

		// Verify contract can be signed
		if (!["sent", "viewed"].includes(contract.status)) {
			return fail(400, { error: "Contract cannot be signed in current state" });
		}

		// Check if expired
		if (contract.validUntil && new Date(contract.validUntil) < new Date()) {
			return fail(400, { error: "Contract has expired" });
		}

		// Get client info
		let clientIp = "";
		try {
			clientIp = getClientAddress();
		} catch {
			// IP not available
		}

		// Record signature
		await db
			.update(contracts)
			.set({
				status: "signed",
				clientSignatoryName: signatoryName,
				clientSignatoryTitle: signatoryTitle || null,
				clientSignedAt: new Date(),
				clientSignatureIp: clientIp,
				updatedAt: new Date(),
			})
			.where(eq(contracts.id, contract.id));

		// Send notification emails (fire-and-forget, don't block the response)
		const baseUrl = env.PUBLIC_CLIENT_URL || "https://webkit.au";
		const publicUrl = `${baseUrl}/c/${slug}`;
		const signedAt = formatDateTime(new Date());

		// Fetch agency for email templates
		db.select()
			.from(agencies)
			.where(eq(agencies.id, contract.agencyId))
			.limit(1)
			.then(async ([agency]) => {
				if (!agency) return;

				const notificationData = {
					agency: {
						name: agency.name,
						email: agency.email || undefined,
						primaryColor: agency.primaryColor || undefined,
						logoUrl: agency.logoUrl || undefined,
					},
					contract: {
						number: contract.contractNumber,
						publicUrl,
					},
					client: {
						name: contract.clientContactName || contract.clientBusinessName || "Client",
						businessName: contract.clientBusinessName || undefined,
						email: contract.clientEmail,
					},
					signedAt,
					signatoryName,
				};

				// Send confirmation to client
				if (contract.clientEmail) {
					const clientEmail = generateContractSignedClientEmail(notificationData);
					const clientResult = await sendEmail({
						to: contract.clientEmail,
						subject: clientEmail.subject,
						html: clientEmail.bodyHtml,
						...(agency.email ? { replyTo: agency.email } : {}),
					});

					// Log client email
					await db.insert(emailLogs).values({
						agencyId: contract.agencyId,
						contractId: contract.id,
						emailType: "contract_signed_client",
						recipientEmail: contract.clientEmail,
						recipientName: contract.clientContactName || contract.clientBusinessName || null,
						subject: clientEmail.subject,
						bodyHtml: clientEmail.bodyHtml,
						status: clientResult.success ? "sent" : "failed",
						resendMessageId: clientResult.messageId || null,
					});
				}

				// Send notification to agency
				const agencyEmail = agency.email;
				if (agencyEmail) {
					const agencyNotification = generateContractSignedAgencyEmail(notificationData);
					const agencyResult = await sendEmail({
						to: agencyEmail,
						subject: agencyNotification.subject,
						html: agencyNotification.bodyHtml,
					});

					// Log agency email
					await db.insert(emailLogs).values({
						agencyId: contract.agencyId,
						contractId: contract.id,
						emailType: "contract_signed_agency",
						recipientEmail: agencyEmail,
						recipientName: agency.name,
						subject: agencyNotification.subject,
						bodyHtml: agencyNotification.bodyHtml,
						status: agencyResult.success ? "sent" : "failed",
						resendMessageId: agencyResult.messageId || null,
					});
				}
			})
			.catch((err) => {
				console.error("Failed to send contract signing notification emails:", err);
			});

		return { success: true };
	},
};
