import type { PageServerLoad } from './$types';
import { getInvoiceBySlug, recordInvoiceView } from '$lib/api/invoices.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	const result = await getInvoiceBySlug(slug);

	if (!result || !result.invoice) {
		throw error(404, 'Invoice not found');
	}

	if (!result.agency) {
		throw error(404, 'Agency not found');
	}

	// Record view
	await recordInvoiceView(slug);

	return {
		invoice: result.invoice,
		lineItems: result.lineItems,
		agency: result.agency,
		profile: result.profile || null
	};
};
