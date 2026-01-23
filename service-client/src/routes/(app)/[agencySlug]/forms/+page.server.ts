import type { PageServerLoad } from "./$types";
import { getAgencyFormSubmissions, getAgencyForms } from "$lib/api/forms.remote";

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get("status") as
		| "draft"
		| "completed"
		| "processing"
		| "processed"
		| "archived"
		| null;

	const [submissions, forms] = await Promise.all([
		getAgencyFormSubmissions(statusFilter ? { status: statusFilter } : {}),
		getAgencyForms({ activeOnly: true }),
	]);

	return {
		submissions,
		forms,
		statusFilter,
	};
};
