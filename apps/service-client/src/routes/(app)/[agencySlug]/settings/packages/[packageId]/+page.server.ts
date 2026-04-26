import type { PageServerLoad } from "./$types";
import { getAgencyPackage } from "$lib/api/agency-packages.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	try {
		const pkg = await getAgencyPackage(params.packageId);
		return { package: pkg };
	} catch (err) {
		throw error(404, "Package not found");
	}
};
