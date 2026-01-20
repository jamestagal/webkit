/**
 * Integration Tests for Consultation Remote Functions
 *
 * These tests verify the remote functions work correctly with mocked API responses.
 * Tests cover:
 * - Successful API calls with valid data
 * - HTTP error handling (400, 401, 404, 500)
 * - Cookie-based authentication (credentials: 'include')
 * - Zod schema validation
 * - TASK 3: Form submission flow tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setRequestEvent } from "$app/server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock data fixtures
const mockConsultation = {
	id: "123e4567-e89b-12d3-a456-426614174000",
	user_id: "223e4567-e89b-12d3-a456-426614174000",
	contact_info: {},
	business_context: {},
	pain_points: {},
	goals_objectives: {},
	status: "draft" as const,
	completion_percentage: 0,
	created_at: "2025-10-24T10:00:00Z",
	updated_at: "2025-10-24T10:00:00Z",
};

const mockDraft = {
	id: "323e4567-e89b-12d3-a456-426614174000",
	consultation_id: "123e4567-e89b-12d3-a456-426614174000",
	user_id: "223e4567-e89b-12d3-a456-426614174000",
	contact_info: { business_name: "Test Corp" },
	business_context: {},
	pain_points: {},
	goals_objectives: {},
	created_at: "2025-10-24T10:00:00Z",
	updated_at: "2025-10-24T10:00:00Z",
};

describe("Consultation Remote Functions", () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		// Create mock fetch function
		mockFetch = vi.fn();

		// Create mock cookies
		mockCookies = {
			get: vi.fn().mockReturnValue("123e4567-e89b-12d3-a456-426614174000"), // Default consultation ID
			set: vi.fn(),
		};

		// Mock RequestEvent with fetch and cookies
		const mockRequestEvent = {
			fetch: mockFetch,
			cookies: mockCookies,
		} as unknown as RequestEvent;

		setRequestEvent(mockRequestEvent);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("getOrCreateConsultation", () => {
		it("should create new consultation with POST request", async () => {
			const { getOrCreateConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockConsultation,
			});

			const result = await getOrCreateConsultation();

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations",
				expect.objectContaining({
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				}),
			);

			expect(result).toEqual(mockConsultation);
		});

		it("should handle 401 Unauthorized error", async () => {
			const { getOrCreateConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				json: async () => ({ message: "Invalid token" }),
			});

			await expect(getOrCreateConsultation()).rejects.toThrow("Invalid token");
		});

		it("should handle 500 Internal Server Error", async () => {
			const { getOrCreateConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				json: async () => ({ message: "Database connection failed" }),
			});

			await expect(getOrCreateConsultation()).rejects.toThrow("Database connection failed");
		});

		it("should include credentials for cookie auth", async () => {
			const { getOrCreateConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockConsultation,
			});

			await getOrCreateConsultation();

			const fetchCall = mockFetch.mock.calls[0];
			expect(fetchCall[1].credentials).toBe("include");
		});
	});

	describe("getConsultation", () => {
		it("should fetch consultation by ID", async () => {
			const { getConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockConsultation,
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			const result = await getConsultation(consultationId);

			expect(mockFetch).toHaveBeenCalledWith(
				`http://localhost:4001/consultations/${consultationId}`,
				expect.objectContaining({
					credentials: "include",
				}),
			);

			expect(result).toEqual(mockConsultation);
		});

		it("should handle 404 Not Found error", async () => {
			const { getConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: async () => ({ message: "Consultation not found" }),
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			await expect(getConsultation(consultationId)).rejects.toThrow("Consultation not found");
		});

		it("should validate UUID parameter", async () => {
			const { getConsultation } = await import("./consultation.remote");

			const invalidId = "not-a-uuid";

			// Zod will throw validation error before API call
			await expect(getConsultation(invalidId as any)).rejects.toThrow();
		});
	});

	describe("getDraft", () => {
		it("should fetch draft by consultation ID", async () => {
			const { getDraft } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockDraft,
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			const result = await getDraft(consultationId);

			expect(mockFetch).toHaveBeenCalledWith(
				`http://localhost:4001/consultations/${consultationId}/drafts`,
				expect.objectContaining({
					credentials: "include",
				}),
			);

			expect(result).toEqual(mockDraft);
		});

		it("should return null for 404 Not Found (no draft exists)", async () => {
			const { getDraft } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: async () => ({ message: "Draft not found" }),
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			const result = await getDraft(consultationId);

			expect(result).toBeNull();
		});

		it("should throw on non-404 errors", async () => {
			const { getDraft } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				json: async () => ({ message: "Server error" }),
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			await expect(getDraft(consultationId)).rejects.toThrow("Server error");
		});
	});

	describe("autoSaveDraft", () => {
		it("should save draft data with POST request", async () => {
			const { autoSaveDraft } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockDraft,
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			const draftData = {
				contact_info: { business_name: "Test Corp" },
			};

			const result = await autoSaveDraft({
				consultationId,
				data: draftData,
			});

			expect(mockFetch).toHaveBeenCalledWith(
				`http://localhost:4001/consultations/${consultationId}/drafts`,
				expect.objectContaining({
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(draftData),
				}),
			);

			expect(result).toEqual(mockDraft);
		});

		it("should handle 400 Bad Request error", async () => {
			const { autoSaveDraft } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
				json: async () => ({ message: "Invalid draft data" }),
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";

			await expect(
				autoSaveDraft({
					consultationId,
					data: {},
				}),
			).rejects.toThrow("Invalid draft data");
		});
	});

	describe("completeConsultation", () => {
		it("should complete consultation with POST request", async () => {
			const { completeConsultation } = await import("./consultation.remote");

			const completedConsultation = {
				...mockConsultation,
				status: "completed" as const,
				completion_percentage: 100,
				completed_at: "2025-10-24T10:15:00Z",
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => completedConsultation,
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			const result = await completeConsultation({ consultationId });

			expect(mockFetch).toHaveBeenCalledWith(
				`http://localhost:4001/consultations/${consultationId}/complete`,
				expect.objectContaining({
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				}),
			);

			expect(result.status).toBe("completed");
			expect(result.completion_percentage).toBe(100);
		});

		it("should handle 404 Not Found error", async () => {
			const { completeConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: async () => ({ message: "Consultation not found" }),
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";

			await expect(completeConsultation({ consultationId })).rejects.toThrow(
				"Consultation not found",
			);
		});
	});

	describe("listConsultations", () => {
		it("should fetch paginated consultations", async () => {
			const { listConsultations } = await import("./consultation.remote");

			const mockList = {
				consultations: [mockConsultation],
				total: 1,
				page: 1,
				limit: 20,
				has_more: false,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockList,
			});

			const result = await listConsultations({
				page: 1,
				limit: 20,
			});

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations?page=1&limit=20",
				expect.objectContaining({
					credentials: "include",
				}),
			);

			expect(result).toEqual(mockList);
		});

		it("should include status filter in query string", async () => {
			const { listConsultations } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					consultations: [],
					total: 0,
					page: 1,
					limit: 20,
					has_more: false,
				}),
			});

			await listConsultations({
				page: 1,
				limit: 20,
				status: "completed",
			});

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations?page=1&limit=20&status=completed",
				expect.any(Object),
			);
		});

		it("should include search filter in query string", async () => {
			const { listConsultations } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					consultations: [],
					total: 0,
					page: 1,
					limit: 20,
					has_more: false,
				}),
			});

			await listConsultations({
				page: 1,
				limit: 20,
				search: "Acme Corp",
			});

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations?page=1&limit=20&search=Acme+Corp",
				expect.any(Object),
			);
		});
	});

	// ========================================
	// TASK 3: FORM SUBMISSION TESTS
	// ========================================

	describe("saveContactInfo", () => {
		it("should save contact info with PUT request", async () => {
			const { saveContactInfo } = await import("./consultation.remote");

			const contactInfoData = {
				business_name: "Acme Corp",
				email: "contact@acme.com",
				phone: "555-1234",
			};

			const updatedConsultation = {
				...mockConsultation,
				contact_info: contactInfoData,
				completion_percentage: 25,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => updatedConsultation,
			});

			const result = await saveContactInfo(contactInfoData);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations/123e4567-e89b-12d3-a456-426614174000",
				expect.objectContaining({
					method: "PUT",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ contact_info: contactInfoData }),
				}),
			);

			expect(result.completion_percentage).toBe(25);
		});

		it("should retrieve consultation ID from cookies", async () => {
			const { saveContactInfo } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockConsultation,
			});

			await saveContactInfo({ business_name: "Test Corp" });

			expect(mockCookies.get).toHaveBeenCalledWith("current_consultation_id");
		});

		it("should throw error if no consultation ID cookie exists", async () => {
			const { saveContactInfo } = await import("./consultation.remote");

			mockCookies.get.mockReturnValueOnce(undefined);

			await expect(saveContactInfo({ business_name: "Test Corp" })).rejects.toThrow(
				"No active consultation",
			);
		});

		it("should validate email format with Zod schema", async () => {
			const { saveContactInfo } = await import("./consultation.remote");

			const invalidData = {
				email: "not-an-email", // Invalid email format
			};

			// Zod validation should fail before API call
			await expect(saveContactInfo(invalidData as any)).rejects.toThrow();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe("saveBusinessContext", () => {
		it("should save business context with PUT request", async () => {
			const { saveBusinessContext } = await import("./consultation.remote");

			const businessContextData = {
				industry: "Technology",
				business_type: "SaaS",
				team_size: 15,
			};

			const updatedConsultation = {
				...mockConsultation,
				business_context: businessContextData,
				completion_percentage: 50,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => updatedConsultation,
			});

			const result = await saveBusinessContext(businessContextData);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations/123e4567-e89b-12d3-a456-426614174000",
				expect.objectContaining({
					method: "PUT",
					body: JSON.stringify({ business_context: businessContextData }),
				}),
			);

			expect(result.completion_percentage).toBe(50);
		});

		it("should validate team_size is positive integer", async () => {
			const { saveBusinessContext } = await import("./consultation.remote");

			const invalidData = {
				team_size: -5, // Negative number
			};

			await expect(saveBusinessContext(invalidData as any)).rejects.toThrow();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe("savePainPoints", () => {
		it("should save pain points with PUT request", async () => {
			const { savePainPoints } = await import("./consultation.remote");

			const painPointsData = {
				primary_challenges: ["Slow website", "Poor SEO"],
				urgency_level: "high" as const,
				impact_assessment: "High impact on revenue",
			};

			const updatedConsultation = {
				...mockConsultation,
				pain_points: painPointsData,
				completion_percentage: 75,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => updatedConsultation,
			});

			const result = await savePainPoints(painPointsData);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations/123e4567-e89b-12d3-a456-426614174000",
				expect.objectContaining({
					method: "PUT",
					body: JSON.stringify({ pain_points: painPointsData }),
				}),
			);

			expect(result.completion_percentage).toBe(75);
		});

		it("should validate urgency_level enum", async () => {
			const { savePainPoints } = await import("./consultation.remote");

			const invalidData = {
				urgency_level: "invalid-urgency", // Not in enum
			};

			await expect(savePainPoints(invalidData as any)).rejects.toThrow();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe("saveGoalsObjectives", () => {
		it("should save goals and objectives with PUT request", async () => {
			const { saveGoalsObjectives } = await import("./consultation.remote");

			const goalsObjectivesData = {
				primary_goals: ["Increase conversions", "Improve UX"],
				budget_range: "$10k-$20k",
				success_metrics: ["Conversion rate", "Page load time"],
			};

			const updatedConsultation = {
				...mockConsultation,
				goals_objectives: goalsObjectivesData,
				completion_percentage: 100,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => updatedConsultation,
			});

			const result = await saveGoalsObjectives(goalsObjectivesData);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4001/consultations/123e4567-e89b-12d3-a456-426614174000",
				expect.objectContaining({
					method: "PUT",
					body: JSON.stringify({ goals_objectives: goalsObjectivesData }),
				}),
			);

			expect(result.completion_percentage).toBe(100);
		});
	});

	describe("Form Submission Flow Integration", () => {
		it("should complete full 4-step consultation flow", async () => {
			const { saveContactInfo, saveBusinessContext, savePainPoints, saveGoalsObjectives } =
				await import("./consultation.remote");

			// Step 1: Contact Info
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ ...mockConsultation, completion_percentage: 25 }),
			});

			const step1Result = await saveContactInfo({
				business_name: "Acme Corp",
				email: "contact@acme.com",
			});

			expect(step1Result.completion_percentage).toBe(25);

			// Step 2: Business Context
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ ...mockConsultation, completion_percentage: 50 }),
			});

			const step2Result = await saveBusinessContext({
				industry: "Technology",
				team_size: 10,
			});

			expect(step2Result.completion_percentage).toBe(50);

			// Step 3: Pain Points
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ ...mockConsultation, completion_percentage: 75 }),
			});

			const step3Result = await savePainPoints({
				primary_challenges: ["Slow performance"],
				urgency_level: "high",
			});

			expect(step3Result.completion_percentage).toBe(75);

			// Step 4: Goals & Objectives
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ ...mockConsultation, completion_percentage: 100 }),
			});

			const step4Result = await saveGoalsObjectives({
				primary_goals: ["Increase speed"],
			});

			expect(step4Result.completion_percentage).toBe(100);

			// Verify all 4 PUT requests were made
			expect(mockFetch).toHaveBeenCalledTimes(4);
			expect(mockFetch).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("/consultations/"),
				expect.objectContaining({ method: "PUT" }),
			);
		});
	});

	describe("Error Handling", () => {
		it("should handle network errors", async () => {
			const { getConsultation } = await import("./consultation.remote");

			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			await expect(getConsultation(consultationId)).rejects.toThrow("Network error");
		});

		it("should handle non-JSON error responses", async () => {
			const { getConsultation } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				json: async () => {
					throw new Error("Not JSON");
				},
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			await expect(getConsultation(consultationId)).rejects.toThrow(
				"HTTP 500: Internal Server Error",
			);
		});

		it("should handle Zod validation errors", async () => {
			const { getConsultation } = await import("./consultation.remote");

			// Return invalid data that doesn't match schema
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "not-a-uuid", // Invalid UUID
					status: "invalid-status", // Invalid status
				}),
			});

			const consultationId = "123e4567-e89b-12d3-a456-426614174000";
			await expect(getConsultation(consultationId)).rejects.toThrow();
		});

		it("should handle form validation errors before API call", async () => {
			const { saveContactInfo } = await import("./consultation.remote");

			// Invalid email format should be caught by Zod
			await expect(saveContactInfo({ email: "not-an-email" } as any)).rejects.toThrow();

			// API call should not be made
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("should handle 400 Bad Request on form submission", async () => {
			const { saveContactInfo } = await import("./consultation.remote");

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
				json: async () => ({ message: "Invalid contact information" }),
			});

			await expect(saveContactInfo({ business_name: "Test" })).rejects.toThrow(
				"Invalid contact information",
			);
		});
	});
});
