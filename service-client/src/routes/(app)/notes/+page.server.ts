import { env } from "$env/dynamic/private";
import { api } from "$lib/server/http";
import { logger, perf } from "$lib/server/logger";
import type { Note, NotesResponse } from "$lib/types";
import { error, fail } from "@sveltejs/kit";

export const load: import("./$types").PageServerLoad = async ({ locals, url }) => {
	const end = perf("get_notes_by_user_id");

	const page = url.searchParams.get("page") || "1";
	const limit = url.searchParams.get("limit") || "2";
	const r = await api<NotesResponse>(env.CORE_URL + `/notes?page=${page}&limit=${limit}`, {
		token: locals.token,
	});

	end(r);
	if (!r.success) {
		logger.error(`Error fetching notes: ${r.message}`);
		throw error(r.code, r);
	}
	return {
		total: r.data.count,
		page: parseInt(page),
		limit: parseInt(limit),
		notes: r.data.notes,
	};
};

export const actions: import("./$types").Actions = {
	insert_note: async ({ locals, request }) => {
		const end = perf("insert_note");

		const form = await request.formData();
		const r = await api<Note>(env.CORE_URL + "/notes", {
			token: locals.token,
			method: "POST",
			form,
		});

		end(r);
		if (!r.success) {
			logger.error(`Error inserting note: ${r.message}`);
			return fail(r.code, r);
		}
		return { success: true, data: r.data, message: "Note inserted" };
	},
};
