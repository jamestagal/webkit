import type { PageServerLoad } from "./$types";
import { getAgencyConsultations } from "$lib/api/consultation.remote";

export const load: PageServerLoad = async () => {
	const consultations = await getAgencyConsultations();
	return { consultations };
};
