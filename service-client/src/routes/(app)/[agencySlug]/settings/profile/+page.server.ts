import type { PageServerLoad } from "./$types";
import { getAgencyProfile } from "$lib/api/agency-profile.remote";

export const load: PageServerLoad = async () => {
	const profileData = await getAgencyProfile();
	return {
		profile: profileData.profile,
		agency: profileData.agency,
	};
};
