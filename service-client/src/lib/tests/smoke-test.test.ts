import { describe, test, expect, beforeEach, vi } from "vitest";
import { authService } from "../services/auth";
import { consultationApiService } from "../services/consultation.service";
import { apiEndpoints, apiConfig } from "../config/api";

// Mock fetch for testing
global.fetch = vi.fn();

describe("API Infrastructure Smoke Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	// HTTP client tests removed - no longer using server httpClient in client code

	test("Auth service should be properly initialized", () => {
		expect(authService).toBeDefined();
		expect(typeof authService.login).toBe("function");
		expect(typeof authService.logout).toBe("function");
		expect(typeof authService.getAccessToken).toBe("function");
		expect(typeof authService.isAuthenticated).toBe("function");
	});

	test("Consultation API service should be properly initialized", () => {
		expect(consultationApiService).toBeDefined();
		expect(typeof consultationApiService.createConsultation).toBe("function");
		expect(typeof consultationApiService.listConsultations).toBe("function");
		expect(typeof consultationApiService.getConsultation).toBe("function");
	});

	test("API configuration should be properly set", () => {
		expect(apiConfig).toBeDefined();
		expect(apiConfig.baseUrl).toBeDefined();
		expect(apiConfig.timeout).toBeGreaterThan(0);
		expect(apiConfig.retries).toBeGreaterThanOrEqual(0);
	});

	test("API endpoints should be defined", () => {
		expect(apiEndpoints).toBeDefined();
		expect(apiEndpoints.core).toBeDefined();
		expect(apiEndpoints.auth).toBeDefined();
		expect(apiEndpoints.consultation).toBeDefined();
		expect(apiEndpoints.audit).toBeDefined();
		expect(apiEndpoints.proposal).toBeDefined();
	});

	// HTTP client request test removed - using service layer for API calls

	test("Auth service should handle token storage", () => {
		// Initially not authenticated
		expect(authService.isAuthenticated()).toBe(false);
		expect(authService.getAccessToken()).toBe(null);

		// Mock being authenticated
		localStorage.setItem("access_token", "test-token");
		localStorage.setItem(
			"user",
			JSON.stringify({ id: "1", email: "test@example.com", role: "user" }),
		);

		expect(authService.getAccessToken()).toBe("test-token");
		expect(authService.isAuthenticated()).toBe(true);

		const user = authService.getUser();
		expect(user).toEqual({ id: "1", email: "test@example.com", role: "user" });
	});

	test("Consultation service should use correct endpoints", () => {
		// Check that the consultation service is configured with the right base URL
		const service = new (consultationApiService.constructor as any)();
		expect(service.baseUrl).toBe(apiEndpoints.consultation);
	});
});
