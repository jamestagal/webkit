import { env } from "$env/dynamic/private";
import { api } from "$lib/server/http";
import { logger, perf } from "$lib/server/logger";
import type { Empty, Note, NoteResponse } from "$lib/types";
import { error, fail, redirect } from "@sveltejs/kit";

export const load: import("./$types").PageServerLoad = async ({ locals, params }) => {
	const end = perf("get_note_by_id");

	const r = await api<NoteResponse>(env.CORE_URL + `/notes/${params.note_id}`, {
		token: locals.token,
	});

	end(r);
	if (!r.success) {
		logger.error(`Error getting note: ${r.message}`);
		throw error(r.code, r.message);
	}
	return {
		note: r.data,
	};
};

export const actions: import("./$types").Actions = {
	update_note: async ({ locals, request, params }) => {
		const end = perf("update_note");

		const form = await request.formData();
		const r = await api<Note>(env.CORE_URL + "/notes/" + params.note_id, {
			token: locals.token,
			method: "PUT",
			form,
		});

		end(r);
		if (!r.success) {
			logger.error(`Error updating note: ${r.message}`);
			return fail(r.code, r);
		}
		return { success: true, data: r.data, message: "Note updated" };
	},
	delete_note: async ({ locals, params }) => {
		const end = perf("delete_note");

		const r = await api<Empty>(env.CORE_URL + `/notes/${params.note_id}`, {
			token: locals.token,
			method: "DELETE",
		});

		end(r);
		if (!r.success) {
			logger.error(`Error deleting note: ${r.message}`);
			return fail(r.code, r);
		}
		throw redirect(302, "/notes?deleted");
	},
};
