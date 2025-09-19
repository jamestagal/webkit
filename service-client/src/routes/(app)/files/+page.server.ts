import { env } from "$env/dynamic/private";
import { api } from "$lib/server/http";
import { logger, perf } from "$lib/server/logger";
import type { Empty, File } from "$lib/types";
import { error, fail } from "@sveltejs/kit";

export const load: import("./$types").PageServerLoad = async ({ locals }) => {
	const end = perf("get_files_by_user_id");

	const r = await api<File[]>(env.CORE_URL + `/files`, {
		token: locals.token,
	});
	end(r);
	if (!r.success) {
		logger.error(`Error fetching files: ${r.message}`);
		throw error(r.code, r.message);
	}
	return {
		files: r.data,
	};
};

export const actions: import("./$types").Actions = {
	upload_files: async ({ locals, request }) => {
		const end = perf("upload_file");

		const form = await request.formData();
		const files = form.getAll("files");
		if (files.length === 0) {
			return { success: false, message: "No files provided", code: 400 };
		}
		// Client side validation
		for (const file of files) {
			if (!(file instanceof File)) {
				return { success: false, message: "Invalid file", code: 400 };
			}
			if (file.size === 0) {
				return { success: false, message: "No file provided", code: 400 };
			}
			// Max size is 10 MB
			if (file.size > 10 * 1024 * 1024) {
				return { success: false, message: "File too large", code: 400 };
			}
		}
		const formData = new FormData();
		for (const file of files) {
			formData.append("files", file);
		}
		const r = await api<Empty>(env.CORE_URL + "/files", {
			method: "POST",
			form: formData,
			token: locals.token,
		});

		end(r);
		if (!r.success) {
			logger.error(`Error uploading files: ${r.message}`);
			return fail(r.code, r);
		}
		return { success: true, data: r.data, message: "File uploaded" };
	},
	delete_file: async ({ locals, request }) => {
		const end = perf("delete_file");

		const form = await request.formData();
		const fileId = form.get("file_id")?.toString();
		if (!fileId) {
			return { success: false, message: "No file ID provided", code: 400 };
		}
		const r = await api<Empty>(env.CORE_URL + `/files/${fileId}`, {
			method: "DELETE",
			token: locals.token,
		});

		end(r);
		if (!r.success) {
			logger.error(`Error deleting file: ${r.message}`);
			return fail(r.code, r);
		}
		return { success: true, message: "File deleted" };
	},
};
