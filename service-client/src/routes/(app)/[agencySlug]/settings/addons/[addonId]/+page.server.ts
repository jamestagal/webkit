import type { PageServerLoad } from './$types';
import { getAgencyAddon } from '$lib/api/agency-addons.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	try {
		const addon = await getAgencyAddon(params.addonId);
		return { addon };
	} catch (err) {
		throw error(404, 'Add-on not found');
	}
};
