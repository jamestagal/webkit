import { env } from "$env/dynamic/private";
import { api } from "$lib/server/http";
import { redirect } from "@sveltejs/kit";

export const actions: import("./$types").Actions = {
	webhook: async ({ locals }) => {
		await api(env.CORE_URL + "/payments-webhook", {
			method: "POST",
			token: locals.token,
		});
		throw redirect(302, "/payments?success=true");
	},
};
