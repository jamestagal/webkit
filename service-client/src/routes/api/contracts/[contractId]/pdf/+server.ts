/**
 * Contract PDF Generation API Endpoint
 *
 * GET /api/contracts/[contractId]/pdf - Download contract as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires authentication and agency membership.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { contracts, agencies, agencyProfiles, contractSchedules, agencyMemberships } from "$lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import { generateContractPdfHtml } from "$lib/templates/contract-pdf";
import { convertHtmlToPdf, RateLimitError } from "$lib/server/gotenberg";

export const GET: RequestHandler = async ({ params, locals }) => {
	const { contractId } = params;

	if (!contractId) {
		return json({ error: "Contract ID is required" }, { status: 400 });
	}

	// Auth: require logged-in user
	if (!locals.user?.id) {
		return json({ error: "Authentication required" }, { status: 401 });
	}

	try {
		// Fetch contract
		const contract = await db.query.contracts.findFirst({
			where: eq(contracts.id, contractId),
		});

		if (!contract) {
			return json({ error: "Contract not found" }, { status: 404 });
		}

		// Auth: verify user has membership in this agency
		const membership = await db.query.agencyMemberships.findFirst({
			where: and(
				eq(agencyMemberships.userId, locals.user.id),
				eq(agencyMemberships.agencyId, contract.agencyId),
			),
		});

		if (!membership) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		// Fetch related data
		const [agency, profile] = await Promise.all([
			db.query.agencies.findFirst({
				where: eq(agencies.id, contract.agencyId),
			}),
			db.query.agencyProfiles.findFirst({
				where: eq(agencyProfiles.agencyId, contract.agencyId),
			}),
		]);

		if (!agency) {
			return json({ error: "Agency not found" }, { status: 404 });
		}

		// Fetch included schedules
		const includedScheduleIds = (contract.includedScheduleIds as string[]) || [];
		let includedSchedules: Awaited<ReturnType<typeof db.query.contractSchedules.findMany>> = [];

		if (includedScheduleIds.length > 0) {
			includedSchedules = await db.query.contractSchedules.findMany({
				where: inArray(contractSchedules.id, includedScheduleIds),
			});
		}

		// Generate HTML
		const html = generateContractPdfHtml({
			contract,
			agency,
			profile: profile || null,
			includedSchedules,
		});

		// Convert to PDF
		const pdfBuffer = await convertHtmlToPdf(html, locals.user.id);
		const filename = `${contract.contractNumber}.pdf`;

		return new Response(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Content-Length": pdfBuffer.byteLength.toString(),
				"Cache-Control": "private, max-age=60",
			},
		});
	} catch (err) {
		if (err instanceof RateLimitError) {
			return json({ error: err.message }, { status: 429 });
		}
		console.error("PDF generation error:", err);
		const message = err instanceof Error ? err.message : "PDF generation failed";
		return json({ error: message }, { status: 500 });
	}
};
