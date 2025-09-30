/**
 * Client-safe API helper for browser environment
 * Uses native fetch API without server dependencies
 */
export class ApiClient {
	private baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || "";
	}

	async request<T>(
		endpoint: string,
		options?: RequestInit,
	): Promise<{ success: boolean; data?: T; message?: string }> {
		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				...options,
				headers: {
					"Content-Type": "application/json",
					...options?.headers,
				},
				credentials: "include", // for cookies
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					message: data.message || `Error: ${response.status}`,
				};
			}

			return {
				success: true,
				data,
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "Network error",
			};
		}
	}

	async get<T>(endpoint: string) {
		return this.request<T>(endpoint, { method: "GET" });
	}

	async post<T>(endpoint: string, body: any) {
		return this.request<T>(endpoint, {
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	async put<T>(endpoint: string, body: any) {
		return this.request<T>(endpoint, {
			method: "PUT",
			body: JSON.stringify(body),
		});
	}

	async delete<T>(endpoint: string) {
		return this.request<T>(endpoint, { method: "DELETE" });
	}
}

export const api = new ApiClient();
