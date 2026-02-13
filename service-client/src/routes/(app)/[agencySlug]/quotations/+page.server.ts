import type { PageServerLoad } from "./$types";
import { getQuotations, getQuotationStats } from "$lib/api/quotations.remote";

export const load: PageServerLoad = async () => {
	const [quotations, stats] = await Promise.all([getQuotations({}), getQuotationStats()]);
	return { quotations, stats };
};
