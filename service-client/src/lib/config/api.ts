import { PUBLIC_CORE_URL } from "$env/static/public";
import { browser } from "$app/environment";

export interface ApiConfig {
	baseUrl: string;
	timeout: number;
	retries: number;
	retryDelay: number;
}

export interface ApiEndpoints {
	core: string;
	auth: string;
	consultation: string;
	audit: string;
	proposal: string;
	pdf: string;
	analytics: string;
}

/**
 * Get API configuration based on environment
 */
export function getApiConfig(): ApiConfig {
	// Use browser-accessible PUBLIC_CORE_URL for client-side requests
	const baseUrl = PUBLIC_CORE_URL || "http://localhost:4001";

	return {
		baseUrl: `${baseUrl}/api/v1`,
		timeout: 10000, // Default timeout
		retries: 3, // Default retries
		retryDelay: 1000, // Default retry delay
	};
}

/**
 * Get API endpoints configuration
 */
export function getApiEndpoints(): ApiEndpoints {
	const config = getApiConfig();
	const baseUrl = config.baseUrl;

	return {
		core: baseUrl,
		auth: `${baseUrl}/auth`,
		consultation: baseUrl, // Don't add /consultations here - the service adds it
		audit: `${baseUrl}/audits`,
		proposal: `${baseUrl}/proposals`,
		pdf: `${baseUrl}/pdf`,
		analytics: `${baseUrl}/analytics`,
	};
}

/**
 * Build URL with query parameters
 */
export function buildUrl(
	baseUrl: string,
	path: string,
	params?: Record<string, string | number | boolean>,
): string {
	let url = baseUrl;

	// Add path if provided
	if (path) {
		url = url.endsWith("/") ? url + path : `${url}/${path}`;
	}

	// Add query parameters if provided
	if (params && Object.keys(params).length > 0) {
		const searchParams = new URLSearchParams();

		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				searchParams.set(key, value.toString());
			}
		});

		const queryString = searchParams.toString();
		if (queryString) {
			url += `?${queryString}`;
		}
	}

	return url;
}

/**
 * Validate API base URL
 */
export function validateApiUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
	// Safe client-side environment detection
	const isDevelopment =
		browser && typeof window !== "undefined" && window.location.hostname === "localhost";
	const isProduction = !isDevelopment;
	const isTest = typeof process !== "undefined" && process.env["NODE_ENV"] === "test";

	return {
		isDevelopment,
		isProduction,
		isTest,
		logLevel: isDevelopment ? "debug" : "info",
		domain: browser && typeof window !== "undefined" ? window.location.hostname : "localhost",
		enableDebugLogging: isDevelopment,
	};
}

// Default configuration instances
export const apiConfig = getApiConfig();
export const apiEndpoints = getApiEndpoints();
export const environmentConfig = getEnvironmentConfig();

// Utility constants
export const API_CONSTANTS = {
	DEFAULT_TIMEOUT: 10000,
	DEFAULT_RETRIES: 3,
	DEFAULT_RETRY_DELAY: 1000,
	MAX_TIMEOUT: 60000,
	MAX_RETRIES: 5,
	MIN_RETRY_DELAY: 100,
	MAX_RETRY_DELAY: 10000,
} as const;

/**
 * Create API client configuration with overrides
 */
export function createApiConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
	const base = getApiConfig();

	return {
		baseUrl: overrides.baseUrl || base.baseUrl,
		timeout: Math.min(overrides.timeout || base.timeout, API_CONSTANTS.MAX_TIMEOUT),
		retries: Math.min(overrides.retries || base.retries, API_CONSTANTS.MAX_RETRIES),
		retryDelay: Math.max(
			Math.min(overrides.retryDelay || base.retryDelay, API_CONSTANTS.MAX_RETRY_DELAY),
			API_CONSTANTS.MIN_RETRY_DELAY,
		),
	};
}

/**
 * Get health check URL for API
 */
export function getHealthCheckUrl(): string {
	const config = getApiConfig();
	return `${config.baseUrl.replace("/api/v1", "")}/health`;
}

/**
 * Get WebSocket URL for real-time features
 */
export function getWebSocketUrl(): string {
	const config = getApiConfig();
	const wsProtocol = config.baseUrl.startsWith("https") ? "wss" : "ws";
	const baseUrl = config.baseUrl.replace(/^https?/, wsProtocol);
	return `${baseUrl}/ws`;
}
