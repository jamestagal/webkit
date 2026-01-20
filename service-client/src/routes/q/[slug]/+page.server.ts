/**
 * Public Questionnaire View - Server Load
 *
 * Loads questionnaire by slug without authentication.
 * Supports both:
 * 1. Questionnaire's own slug (standalone questionnaires)
 * 2. Contract slug (backward compatibility for contract-linked questionnaires)
 */

import type { PageServerLoad } from "./$types";
import { getQuestionnaireByOwnSlug, checkQuestionnaireAccess } from "$lib/api/questionnaire.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	// First, try to find questionnaire by its own slug (new method)
	const directResult = await getQuestionnaireByOwnSlug(slug);

	if (directResult) {
		// Found questionnaire directly by its slug
		const { questionnaire, agency, agencyProfile, contract } = directResult;

		// For standalone questionnaires (not linked to contract), always allow access
		// For contract-linked questionnaires, the access control is handled at creation time
		// (questionnaire is only created when contract is signed and first invoice paid)
		return {
			allowed: true,
			reason: questionnaire.status === "completed" ? "already_completed" : undefined,
			contract,
			agency,
			agencyProfile,
			questionnaire,
		};
	}

	// Fallback: Try to find by contract slug (backward compatibility)
	const result = await checkQuestionnaireAccess(slug);

	if (result.reason === "contract_not_found") {
		throw error(404, "Questionnaire not found");
	}

	return {
		allowed: result.allowed,
		reason: result.reason,
		contract: result.contract || null,
		agency: result.agency || null,
		agencyProfile: result.agencyProfile || null,
		questionnaire: result.questionnaire || null,
	};
};
