/**
 * Shared Gotenberg PDF conversion client.
 * Handles FormData construction, timeout, retry, and rate limiting.
 */

import { env } from "$env/dynamic/private";

const GOTENBERG_URL = env["GOTENBERG_URL"] || "http://localhost:3003";
const CONVERT_ENDPOINT = `${GOTENBERG_URL}/forms/chromium/convert/html`;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_REQUESTS_PER_MINUTE = 10;

/** A4 paper options for Gotenberg (dimensions in inches). */
export const A4_OPTIONS = {
	paperWidth: "8.27",
	paperHeight: "11.69",
	marginTop: "0.4",
	marginBottom: "0.4",
	marginLeft: "0.4",
	marginRight: "0.4",
	printBackground: "true",
	preferCssPageSize: "true",
} as const;

export interface GotenbergOptions {
	paperWidth?: string;
	paperHeight?: string;
	marginTop?: string;
	marginBottom?: string;
	marginLeft?: string;
	marginRight?: string;
	printBackground?: string;
	preferCssPageSize?: string;
}

// Simple in-memory rate limiter: userId -> timestamps of recent requests
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
	const now = Date.now();
	const windowMs = 60_000;
	const timestamps = rateLimitMap.get(userId) || [];

	// Remove expired entries
	const recent = timestamps.filter((t) => now - t < windowMs);
	rateLimitMap.set(userId, recent);

	if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
		return true;
	}

	recent.push(now);
	return false;
}

/**
 * Convert HTML to PDF via Gotenberg.
 * Includes timeout (30s), single retry on 502/503, and per-user rate limiting.
 *
 * @throws Error on rate limit, timeout, or Gotenberg failure
 */
export async function convertHtmlToPdf(
	html: string,
	userId: string,
	options?: GotenbergOptions,
): Promise<ArrayBuffer> {
	if (isRateLimited(userId)) {
		throw new RateLimitError("PDF generation rate limit exceeded. Try again in a minute.");
	}

	const opts = { ...A4_OPTIONS, ...options };

	async function attempt(): Promise<ArrayBuffer> {
		const formData = new FormData();
		formData.append("files", new Blob([html], { type: "text/html" }), "index.html");

		for (const [key, value] of Object.entries(opts)) {
			formData.append(key, value);
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

		try {
			const response = await fetch(CONVERT_ENDPOINT, {
				method: "POST",
				body: formData,
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new GotenbergError(
					`Gotenberg returned ${response.status}: ${errorText}`,
					response.status,
				);
			}

			return await response.arrayBuffer();
		} finally {
			clearTimeout(timer);
		}
	}

	try {
		return await attempt();
	} catch (err) {
		// Retry once on 502/503 (Gotenberg temporarily overloaded)
		if (err instanceof GotenbergError && (err.status === 502 || err.status === 503)) {
			return await attempt();
		}
		throw err;
	}
}

export class GotenbergError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "GotenbergError";
	}
}

export class RateLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RateLimitError";
	}
}
