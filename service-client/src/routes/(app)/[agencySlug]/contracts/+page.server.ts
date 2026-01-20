import type { PageServerLoad } from "./$types";
import { getContracts } from "$lib/api/contracts.remote";

export const load: PageServerLoad = async () => {
	const contracts = await getContracts({});
	return { contracts };
};
