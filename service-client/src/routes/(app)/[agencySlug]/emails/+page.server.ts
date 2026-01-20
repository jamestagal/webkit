import { getEmailLogs } from "$lib/api/email.remote";

export async function load() {
	const emailLogs = await getEmailLogs({});

	return {
		emailLogs,
	};
}
