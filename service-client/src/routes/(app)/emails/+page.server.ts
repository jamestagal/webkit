import { env } from "$env/dynamic/private";
import { api } from "$lib/server/http";
import { logger, perf } from "$lib/server/logger";
import type { File, Empty, EmailResponse } from "$lib/types";
import { error, fail } from "@sveltejs/kit";

export const load: import("./$types").PageServerLoad = async ({ locals }) => {
	const end = perf("get_emails_by_user_id");

	const re = api<EmailResponse[]>(env.CORE_URL + `/emails`, {
		token: locals.token,
	});

	const rf = api<File[]>(env.CORE_URL + `/files`, {
		token: locals.token,
	});

	const [e, f] = await Promise.all([re, rf]);

	end({ emails: e, files: f });
	if (!e.success) {
		logger.error(`Error fetching email: ${e.message}`);
		throw error(e.code, e.message);
	}
	if (!f.success) {
		logger.error(`Error fetching files: ${f.message}`);
		throw error(f.code, f.message);
	}

	return { emails: e.data, files: f.data, message: "Emails fetched" };
};

export const actions: import("./$types").Actions = {
	send_email: async ({ locals, request }) => {
		const end = perf("send_email");

		const form = await request.formData();
		const r = await api<Empty>(env.CORE_URL + `/emails`, {
			method: "POST",
			token: locals.token,
			form,
		});

		end(r);
		if (!r.success) {
			logger.error(`Error sending email: ${r.message}`);
			return fail(r.code, r);
		}
		return { success: true, data: r.data, message: "Email sent" };
	},
};
