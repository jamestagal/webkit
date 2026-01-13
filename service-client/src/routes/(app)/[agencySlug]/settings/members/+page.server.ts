import { getAgencyMembers } from '$lib/api/agency.remote';

export const load = async () => {
	const members = await getAgencyMembers();
	return { members };
};
