import type { PageServerLoad } from "./$types";
import { getInvoices, getInvoiceStats } from "$lib/api/invoices.remote";

export const load: PageServerLoad = async () => {
	const [invoices, stats] = await Promise.all([getInvoices({}), getInvoiceStats()]);
	return { invoices, stats };
};
