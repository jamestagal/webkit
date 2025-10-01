import { apiEndpoints, buildUrl } from "$lib/config/api";
import { goto } from "$app/navigation";

// Track if we're currently refreshing to prevent concurrent refresh requests
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh_token cookie
 * Returns true if refresh succeeded, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
	// If already refreshing, wait for that request to complete
	if (isRefreshing && refreshPromise) {
		console.log("⏳ Already refreshing token, waiting...");
		return refreshPromise;
	}

	console.log("🔑 Starting token refresh...");
	isRefreshing = true;
	refreshPromise = (async () => {
		try {
			const refreshUrl = `${apiEndpoints.core}/refresh`;
			console.log("📡 Calling refresh endpoint:", refreshUrl);
			const response = await fetch(refreshUrl, {
				method: "POST",
				credentials: "include", // Send cookies including refresh_token
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (response.ok) {
				console.log("✅ Token refresh successful");
				return true;
			} else {
				console.error("❌ Token refresh failed with status:", response.status);
				const text = await response.text();
				console.error("Response body:", text);
				// Redirect to login on refresh failure
				if (typeof window !== "undefined") {
					console.log("↩️ Redirecting to /login");
					await goto("/login");
				}
				return false;
			}
		} catch (error) {
			console.error("❌ Token refresh error:", error);
			return false;
		} finally {
			isRefreshing = false;
			refreshPromise = null;
			console.log("🏁 Token refresh finished");
		}
	})();

	return refreshPromise;
}

/**
 * Enhanced fetch wrapper with automatic token refresh on 401
 */
async function fetchWithTokenRefresh(
	url: string,
	options: RequestInit,
	isRetry = false,
): Promise<Response> {
	const response = await fetch(url, options);

	// If we get a 401 and haven't retried yet, try to refresh the token
	if (response.status === 401 && !isRetry) {
		console.log("🔄 Received 401, attempting token refresh for:", url);
		const refreshSuccess = await refreshAccessToken();

		if (refreshSuccess) {
			// Retry the original request with the new token
			console.log("✅ Retrying request after successful token refresh");
			return fetch(url, options);
		} else {
			console.error("❌ Token refresh failed, returning 401 response");
		}
	}

	return response;
}

// Client-side HTTP client using fetch with automatic token refresh
const api = {
	async get<T>(
		url: string,
		token?: string,
	): Promise<{ success: boolean; data?: T; message?: string }> {
		try {
			const headers: HeadersInit = {
				"Content-Type": "application/json",
			};
			// Only add Authorization header if token is provided and not empty
			if (token && token.trim() !== "") {
				headers["Authorization"] = `Bearer ${token}`;
			}
			const response = await fetchWithTokenRefresh(url, {
				credentials: "include", // This sends cookies automatically
				headers,
			});
			return await response.json();
		} catch (error) {
			console.error("API GET error:", error);
			return {
				success: false,
				message: "Network error: " + (error instanceof Error ? error.message : String(error)),
			};
		}
	},
	async post<T>(
		url: string,
		data: any,
		token?: string,
	): Promise<{ success: boolean; data?: T; message?: string }> {
		try {
			const headers: HeadersInit = {
				"Content-Type": "application/json",
			};
			// Only add Authorization header if token is provided and not empty
			if (token && token.trim() !== "") {
				headers["Authorization"] = `Bearer ${token}`;
			}
			const response = await fetchWithTokenRefresh(url, {
				method: "POST",
				credentials: "include", // This sends cookies automatically
				headers,
				body: JSON.stringify(data),
			});
			return await response.json();
		} catch (error) {
			console.error("API POST error:", error);
			return {
				success: false,
				message: "Network error: " + (error instanceof Error ? error.message : String(error)),
			};
		}
	},
	async put<T>(
		url: string,
		data: any,
		token?: string,
	): Promise<{ success: boolean; data?: T; message?: string }> {
		try {
			const headers: HeadersInit = {
				"Content-Type": "application/json",
			};
			// Only add Authorization header if token is provided and not empty
			if (token && token.trim() !== "") {
				headers["Authorization"] = `Bearer ${token}`;
			}
			const response = await fetchWithTokenRefresh(url, {
				method: "PUT",
				credentials: "include", // This sends cookies automatically
				headers,
				body: JSON.stringify(data),
			});
			return await response.json();
		} catch (error) {
			console.error("API PUT error:", error);
			return {
				success: false,
				message: "Network error: " + (error instanceof Error ? error.message : String(error)),
			};
		}
	},
	async delete<T>(
		url: string,
		token?: string,
	): Promise<{ success: boolean; data?: T; message?: string }> {
		try {
			const headers: HeadersInit = {
				"Content-Type": "application/json",
			};
			// Only add Authorization header if token is provided and not empty
			if (token && token.trim() !== "") {
				headers["Authorization"] = `Bearer ${token}`;
			}
			const response = await fetchWithTokenRefresh(url, {
				method: "DELETE",
				credentials: "include", // This sends cookies automatically
				headers,
			});
			return await response.json();
		} catch (error) {
			console.error("API DELETE error:", error);
			return {
				success: false,
				message: "Network error: " + (error instanceof Error ? error.message : String(error)),
			};
		}
	},
};
import type {
	Consultation,
	ConsultationSummary,
	ConsultationDraft,
	ConsultationVersion,
	CreateConsultationInput,
	UpdateConsultationInput,
	ListConsultationsResponse,
	VersionHistoryResponse,
	ListConsultationsParams,
	SafeResponse,
	DraftSavePayload,
} from "$lib/types/consultation";
import {
	ConsultationSchema,
	ConsultationSummarySchema,
	ConsultationDraftSchema,
	ConsultationVersionSchema,
	ListConsultationsResponseSchema,
	VersionHistoryResponseSchema,
	CreateConsultationInputSchema,
	UpdateConsultationInputSchema,
	ListConsultationsParamsSchema,
	SafeResponseSchema,
} from "$lib/types/consultation";
// Client-side logging - cannot use server logger
const logger = {
	debug: (msg: string, data?: any) => console.debug(msg, data),
	error: (msg: string, error?: any) => console.error(msg, error),
	info: (msg: string, data?: any) => console.info(msg, data),
	warn: (msg: string, data?: any) => console.warn(msg, data),
};
// Client-side Safe type (simplified version)
type Safe<T> = {
	success: boolean;
	data?: T;
	message?: string;
	code?: number;
};

export class ConsultationApiService {
	private baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl || apiEndpoints.consultation;
	}

	/**
	 * List consultations with pagination and filtering
	 */
	async listConsultations(
		token: string,
		params: Partial<ListConsultationsParams> = {},
	): Promise<Safe<ListConsultationsResponse>> {
		try {
			// Validate parameters
			const validatedParams = ListConsultationsParamsSchema.parse(params);

			// Build query string
			const queryParams = new URLSearchParams();
			queryParams.set("page", validatedParams.page.toString());
			queryParams.set("limit", validatedParams.limit.toString());

			if (validatedParams.status) {
				queryParams.set("status", validatedParams.status);
			}

			if (validatedParams.search) {
				queryParams.set("search", validatedParams.search);
			}

			const url = `${this.baseUrl}/consultations?${queryParams.toString()}`;

			logger.debug("Fetching consultations list", { url, params: validatedParams });

			const response = await api.get<ListConsultationsResponse>(url, token);

			if (!response.success) {
				return response;
			}

			// Validate response structure
			const validatedData = ListConsultationsResponseSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Consultations retrieved successfully",
			};
		} catch (error) {
			logger.error("Error listing consultations", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to list consultations",
				code: 500,
			};
		}
	}

	/**
	 * Create a new consultation
	 */
	async createConsultation(
		token: string,
		input: CreateConsultationInput,
	): Promise<Safe<Consultation>> {
		try {
			// Validate input
			const validatedInput = CreateConsultationInputSchema.parse(input);

			logger.debug("Creating consultation", { input: validatedInput });

			const response = await api.post<Consultation>(
				`${this.baseUrl}/consultations`,
				validatedInput,
				token,
			);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Consultation created successfully",
			};
		} catch (error) {
			logger.error("Error creating consultation", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to create consultation",
				code: 500,
			};
		}
	}

	/**
	 * Get a consultation by ID
	 */
	async getConsultation(token: string, consultationId: string): Promise<Safe<Consultation>> {
		try {
			const url = `${this.baseUrl}/consultations/${consultationId}`;

			logger.debug("Fetching consultation", { consultationId });

			const response = await api.get<Consultation>(url, token);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Consultation retrieved successfully",
			};
		} catch (error) {
			logger.error("Error getting consultation", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to get consultation",
				code: 500,
			};
		}
	}

	/**
	 * Update a consultation
	 */
	async updateConsultation(
		token: string,
		consultationId: string,
		input: UpdateConsultationInput,
	): Promise<Safe<Consultation>> {
		try {
			// Validate input
			const validatedInput = UpdateConsultationInputSchema.parse(input);

			logger.debug("Updating consultation", { consultationId, input: validatedInput });

			const response = await api.put<Consultation>(
				`${this.baseUrl}/consultations/${consultationId}`,
				validatedInput,
				token,
			);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Consultation updated successfully",
			};
		} catch (error) {
			logger.error("Error updating consultation", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to update consultation",
				code: 500,
			};
		}
	}

	/**
	 * Delete a consultation
	 */
	async deleteConsultation(token: string, consultationId: string): Promise<Safe<void>> {
		try {
			logger.debug("Deleting consultation", { consultationId });

			const response = await api.delete<void>(
				`${this.baseUrl}/consultations/${consultationId}`,
				token,
			);

			return response;
		} catch (error) {
			logger.error("Error deleting consultation", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to delete consultation",
				code: 500,
			};
		}
	}

	/**
	 * Get consultation draft
	 */
	async getDraft(token: string, consultationId: string): Promise<Safe<ConsultationDraft>> {
		try {
			const url = `${this.baseUrl}/consultations/${consultationId}/drafts`;

			logger.debug("Fetching consultation draft", { consultationId });

			const response = await api.get<ConsultationDraft>(url, token);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationDraftSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Draft retrieved successfully",
			};
		} catch (error) {
			logger.error("Error getting consultation draft", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to get draft",
				code: 500,
			};
		}
	}

	/**
	 * Save consultation draft (auto-save)
	 */
	async saveDraft(
		token: string,
		consultationId: string,
		payload: DraftSavePayload,
	): Promise<Safe<ConsultationDraft>> {
		try {
			logger.debug("Saving consultation draft", { consultationId, payload });

			const response = await api.put<ConsultationDraft>(
				`${this.baseUrl}/consultations/${consultationId}/drafts`,
				payload.data,
				token,
			);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationDraftSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Draft saved successfully",
			};
		} catch (error) {
			logger.error("Error saving consultation draft", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to save draft",
				code: 500,
			};
		}
	}

	/**
	 * Create consultation draft
	 */
	async createDraft(
		token: string,
		consultationId: string,
		payload: DraftSavePayload,
	): Promise<Safe<ConsultationDraft>> {
		try {
			logger.debug("Creating consultation draft", { consultationId, payload });

			const response = await api.post<ConsultationDraft>(
				`${this.baseUrl}/consultations/${consultationId}/drafts`,
				payload.data,
				token,
			);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationDraftSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Draft created successfully",
			};
		} catch (error) {
			logger.error("Error creating consultation draft", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to create draft",
				code: 500,
			};
		}
	}

	/**
	 * Delete consultation draft
	 */
	async deleteDraft(token: string, consultationId: string): Promise<Safe<void>> {
		try {
			logger.debug("Deleting consultation draft", { consultationId });

			const response = await api.delete<void>(
				`${this.baseUrl}/consultations/${consultationId}/drafts`,
				token,
			);

			return response;
		} catch (error) {
			logger.error("Error deleting consultation draft", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to delete draft",
				code: 500,
			};
		}
	}

	/**
	 * Get consultation version history
	 */
	async getVersionHistory(
		token: string,
		consultationId: string,
		page: number = 1,
		limit: number = 10,
	): Promise<Safe<VersionHistoryResponse>> {
		try {
			const queryParams = new URLSearchParams({
				page: page.toString(),
				limit: limit.toString(),
			});

			const url = `${this.baseUrl}/consultations/${consultationId}/versions?${queryParams.toString()}`;

			logger.debug("Fetching version history", { consultationId, page, limit });

			const response = await api.get<VersionHistoryResponse>(url, token);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = VersionHistoryResponseSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Version history retrieved successfully",
			};
		} catch (error) {
			logger.error("Error getting version history", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to get version history",
				code: 500,
			};
		}
	}

	/**
	 * Get specific consultation version
	 */
	async getVersion(
		token: string,
		consultationId: string,
		versionNumber: number,
	): Promise<Safe<Consultation>> {
		try {
			const url = `${this.baseUrl}/consultations/${consultationId}/versions/${versionNumber}`;

			logger.debug("Fetching consultation version", { consultationId, versionNumber });

			const response = await api.get<Consultation>(url, token);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Version retrieved successfully",
			};
		} catch (error) {
			logger.error("Error getting consultation version", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to get version",
				code: 500,
			};
		}
	}

	/**
	 * Complete consultation
	 */
	async completeConsultation(token: string, consultationId: string): Promise<Safe<Consultation>> {
		try {
			logger.debug("Completing consultation", { consultationId });

			const response = await api.post<Consultation>(
				`${this.baseUrl}/consultations/${consultationId}/complete`,
				{},
				token,
			);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Consultation completed successfully",
			};
		} catch (error) {
			logger.error("Error completing consultation", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to complete consultation",
				code: 500,
			};
		}
	}

	/**
	 * Archive consultation
	 */
	async archiveConsultation(token: string, consultationId: string): Promise<Safe<Consultation>> {
		try {
			logger.debug("Archiving consultation", { consultationId });

			const response = await api.post<Consultation>(
				`${this.baseUrl}/consultations/${consultationId}/archive`,
				{},
				token,
			);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Consultation archived successfully",
			};
		} catch (error) {
			logger.error("Error archiving consultation", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to archive consultation",
				code: 500,
			};
		}
	}

	/**
	 * Restore consultation
	 */
	async restoreConsultation(token: string, consultationId: string): Promise<Safe<Consultation>> {
		try {
			logger.debug("Restoring consultation", { consultationId });

			const response = await api.post<Consultation>(
				`${this.baseUrl}/consultations/${consultationId}/restore`,
				{},
				token,
			);

			if (!response.success) {
				return response;
			}

			// Validate response
			const validatedData = ConsultationSchema.parse(response.data);

			return {
				success: true,
				data: validatedData,
				message: "Consultation restored successfully",
			};
		} catch (error) {
			logger.error("Error restoring consultation", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to restore consultation",
				code: 500,
			};
		}
	}
}

// Default service instance
export const consultationApiService = new ConsultationApiService();
