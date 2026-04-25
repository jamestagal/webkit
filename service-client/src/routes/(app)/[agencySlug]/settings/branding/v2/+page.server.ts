// MIRRORED FROM ../+page.server.ts — strangler pattern; cutover in step 7 removes this duplicate.
// If the original loader's return shape changes, mirror it here too until the cutover lands.
import type { PageServerLoad } from "./$types";
import { getAgencyProfile } from "$lib/api/agency-profile.remote";
import { getAllDocumentBrandings } from "$lib/api/document-branding.remote";

export const load: PageServerLoad = async () => {
	const [profileData, documentBrandings] = await Promise.all([
		getAgencyProfile(),
		getAllDocumentBrandings(),
	]);

	return {
		profile: profileData.profile,
		agency: profileData.agency,
		documentBrandings,
	};
};
