/**
 * Questionnaire Preview - Server Load
 *
 * Loads agency info for the questionnaire preview.
 * No actual questionnaire is created - this is just for previewing the form flow.
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { agency, agencyProfile } = await parent();

	return {
		agency,
		agencyProfile
	};
};
