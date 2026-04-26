/**
 * Atomic Document Number Generation
 *
 * Uses UPDATE ... RETURNING to atomically increment counters,
 * preventing race conditions where concurrent requests could
 * generate duplicate document numbers.
 */

import { sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import { dataPipelineService } from "$lib/server/services/data-pipeline.service";

/**
 * Atomically get the next document number and increment the counter.
 * Uses a single UPDATE ... RETURNING to avoid read-then-write races.
 */
export async function getNextDocumentNumber(
	agencyId: string,
	type: "proposal" | "contract" | "invoice" | "quotation",
): Promise<string> {
	const columnMap = {
		proposal: { counter: "next_proposal_number", prefix: "proposal_prefix", defaultPrefix: "PROP" },
		contract: { counter: "next_contract_number", prefix: "contract_prefix", defaultPrefix: "CON" },
		invoice: { counter: "next_invoice_number", prefix: "invoice_prefix", defaultPrefix: "INV" },
		quotation: { counter: "next_quotation_number", prefix: "quotation_prefix", defaultPrefix: "QUO" },
	};

	const { counter, prefix: prefixCol, defaultPrefix } = columnMap[type];

	const result = await db.execute(sql`
		UPDATE agency_profiles
		SET ${sql.identifier(counter)} = ${sql.identifier(counter)} + 1,
		    updated_at = NOW()
		WHERE agency_id = ${agencyId}
		RETURNING ${sql.identifier(counter)} - 1 AS current_number,
		          ${sql.identifier(prefixCol)} AS prefix
	`);

	const row = result.rows?.[0];
	if (!row) {
		throw new Error(`Agency profile not found for agency ${agencyId}`);
	}

	const prefix = (row["prefix"] as string) || defaultPrefix;
	const number = row["current_number"] as number;

	if (type === "invoice" || type === "quotation") {
		// Invoices and quotations use format: PREFIX-YYYY-NNNN
		const year = new Date().getFullYear();
		const paddedNumber = String(number).padStart(4, "0");
		return `${prefix}-${year}-${paddedNumber}`;
	}

	return dataPipelineService.generateDocumentNumber(prefix, number);
}
