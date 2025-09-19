import { logger } from "./logger";
import { safe, type Safe } from "./safe";

export async function api<T>(
	url: string,
	{
		method = "GET",
		form,
		token,
	}: {
		method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
		form?: FormData | undefined;
		token?: string;
	} = {},
): Promise<Safe<T>> {
	const headers = new Headers();
	if (token) {
		headers.append("Authorization", `Bearer ${token}`);
	}

	logger.debug(`api: ${method} ${url}`);
	const res = await safe(
		fetch(url, {
			method,
			headers,
			body: form ?? null,
		}),
	);

	if (!res.success) {
		return { success: false, message: res.message, code: res.code };
	}

	// check if error response
	if (!res.data.ok) {
		try {
			return { success: false, message: await res.data.text(), code: res.data.status };
		} catch (e) {
			logger.error(e);
			return { success: false, message: res.data.statusText, code: res.data.status };
		}
	}

	// check if empty response
	if (res.data.status === 204) {
		const empty = {} as T;
		return { success: true, data: empty, message: "Success" };
	}
	// check if invalid response
	if (!res.data.headers.get("content-type")?.includes("application/json")) {
		return { success: false, message: "Response was not JSON", code: res.data.status };
	}
	const data = await res.data.json();
	return { success: true, data, message: "Success" };
}
