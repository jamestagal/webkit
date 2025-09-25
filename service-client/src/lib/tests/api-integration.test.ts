import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { authService } from "../services/auth";
import { consultationApiService } from "../services/consultation.service";
import type { AuthResponse, LoginCredentials } from "../services/auth";
import type { Consultation, CreateConsultationInput } from "../types/consultation";
import { ConsultationSchema } from "../types/consultation";

// Mock fetch for testing
global.fetch = vi.fn();

describe("API Integration Tests", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		vi.clearAllMocks();
		// Clear localStorage
		localStorage.clear();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// HttpClient tests removed - no longer using server httpClient in client code

	describe("AuthService", () => {
		test("should handle successful login", async () => {
			const credentials: LoginCredentials = {
				email: "test@example.com",
				password: "password",
			};

			const mockAuthResponse: AuthResponse = {
				user: { id: "1", email: credentials.email, role: "user", name: "Test User" },
				tokens: { access_token: "access123", refresh_token: "refresh123" },
			};

			const mockResponse = new Response(JSON.stringify(mockAuthResponse), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

			const result = await authService.login(credentials);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.user.email).toBe(credentials.email);
				expect(result.data.tokens.access_token).toBe("access123");
			}

			// Check that tokens were stored
			expect(localStorage.getItem("access_token")).toBe("access123");
			expect(localStorage.getItem("refresh_token")).toBe("refresh123");

			// Verify FormData was sent
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/auth/login"),
				expect.objectContaining({
					method: "POST",
					body: expect.any(FormData),
				}),
			);
		});

		test("should handle login failure", async () => {
			const credentials: LoginCredentials = {
				email: "invalid@example.com",
				password: "wrongpassword",
			};

			const mockResponse = new Response(JSON.stringify({ message: "Invalid credentials" }), {
				status: 401,
				statusText: "Unauthorized",
				headers: { "Content-Type": "application/json" },
			});

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

			const result = await authService.login(credentials);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.code).toBe(401);
				expect(result.message).toBe("Invalid credentials");
			}

			// Tokens should not be stored
			expect(localStorage.getItem("access_token")).toBeNull();
			expect(localStorage.getItem("refresh_token")).toBeNull();
		});

		test("should get stored user data", () => {
			const userData = { id: "1", email: "test@example.com", role: "user" };
			localStorage.setItem("user", JSON.stringify(userData));

			const user = authService.getUser();
			expect(user).toEqual(userData);
		});

		test("should check authentication status", () => {
			expect(authService.isAuthenticated()).toBe(false);

			localStorage.setItem("access_token", "token123");
			localStorage.setItem(
				"user",
				JSON.stringify({ id: "1", email: "test@example.com", role: "user" }),
			);

			expect(authService.isAuthenticated()).toBe(true);
		});

		test("should handle logout", async () => {
			// Set up authenticated state
			localStorage.setItem("access_token", "token123");
			localStorage.setItem("refresh_token", "refresh123");
			localStorage.setItem(
				"user",
				JSON.stringify({ id: "1", email: "test@example.com", role: "user" }),
			);

			const mockResponse = new Response("", { status: 204 });
			vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

			const result = await authService.logout();

			expect(result.success).toBe(true);

			// Check that tokens were cleared
			expect(localStorage.getItem("access_token")).toBeNull();
			expect(localStorage.getItem("refresh_token")).toBeNull();
			expect(localStorage.getItem("user")).toBeNull();
		});
	});

	describe("ConsultationApiService", () => {
		beforeEach(() => {
			// Set up authenticated state for consultation tests
			localStorage.setItem("access_token", "valid-token");
			localStorage.setItem(
				"user",
				JSON.stringify({ id: "1", email: "test@example.com", role: "user" }),
			);
		});

		test("should create consultation", async () => {
			const consultationInput: CreateConsultationInput = {
				business_name: "Test Company",
				contact_email: "contact@test.com",
				website_url: "https://test.com",
				business_type: "e-commerce",
				primary_goals: ["increase_sales"],
				current_challenges: ["slow_website"],
				project_timeline: "3-6 months",
				budget_range: "$5000-10000",
			};

			const mockConsultation: Partial<Consultation> = {
				id: "consultation-123",
				business_name: consultationInput.business_name,
				contact_email: consultationInput.contact_email,
				status: "draft",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const mockResponse = new Response(JSON.stringify(mockConsultation), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

			const result = await consultationApiService.createConsultation(
				"valid-token",
				consultationInput,
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.business_name).toBe(consultationInput.business_name);
				expect(result.data.contact_email).toBe(consultationInput.contact_email);
			}

			// Verify the request was made correctly
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/consultations"),
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer valid-token",
					}),
					body: expect.any(FormData),
				}),
			);
		});

		test("should list consultations with pagination", async () => {
			const mockListResponse = {
				consultations: [],
				pagination: {
					page: 1,
					limit: 10,
					total: 0,
					pages: 0,
				},
			};

			const mockResponse = new Response(JSON.stringify(mockListResponse), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

			const result = await consultationApiService.listConsultations("valid-token", {
				page: 1,
				limit: 10,
				status: "draft",
			});

			expect(result.success).toBe(true);

			// Verify query parameters were added
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("page=1"),
				expect.objectContaining({
					method: "GET",
					headers: expect.objectContaining({
						Authorization: "Bearer valid-token",
					}),
				}),
			);
		});

		test("should handle API errors gracefully", async () => {
			const mockResponse = new Response(JSON.stringify({ message: "Consultation not found" }), {
				status: 404,
				statusText: "Not Found",
				headers: { "Content-Type": "application/json" },
			});

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

			const result = await consultationApiService.getConsultation("valid-token", "non-existent-id");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.code).toBe(404);
				expect(result.message).toBe("Consultation not found");
			}
		});
	});

	// Error handling tests removed - testing now happens through service layer

	describe("Integration Workflow", () => {
		test("should complete full consultation workflow", async () => {
			// Step 1: Login
			const loginResponse = new Response(
				JSON.stringify({
					user: { id: "1", email: "user@test.com", role: "user" },
					tokens: { access_token: "token123", refresh_token: "refresh123" },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);

			// Step 2: Create consultation
			const consultationResponse = new Response(
				JSON.stringify({
					id: "consultation-123",
					business_name: "Test Co",
					status: "draft",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				}),
				{ status: 201, headers: { "Content-Type": "application/json" } },
			);

			// Step 3: Get consultation
			const getResponse = new Response(
				JSON.stringify({
					id: "consultation-123",
					business_name: "Test Co",
					status: "draft",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);

			vi.mocked(fetch)
				.mockResolvedValueOnce(loginResponse)
				.mockResolvedValueOnce(consultationResponse)
				.mockResolvedValueOnce(getResponse);

			// Execute workflow
			const loginResult = await authService.login({
				email: "user@test.com",
				password: "password",
			});

			expect(loginResult.success).toBe(true);

			const token = authService.getAccessToken()!;
			const createResult = await consultationApiService.createConsultation(token, {
				business_name: "Test Co",
				contact_email: "contact@test.co",
				website_url: "https://test.co",
				business_type: "e-commerce",
				primary_goals: ["increase_sales"],
				current_challenges: ["slow_website"],
				project_timeline: "3-6 months",
				budget_range: "$5000-10000",
			});

			expect(createResult.success).toBe(true);

			const getResult = await consultationApiService.getConsultation(token, "consultation-123");
			expect(getResult.success).toBe(true);

			// Verify all requests were made
			expect(fetch).toHaveBeenCalledTimes(3);
		});
	});
});
