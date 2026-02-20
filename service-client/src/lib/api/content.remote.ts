/**
 * Content Intelligence Remote Functions
 *
 * Server-side functions for content intelligence features.
 * Proxies to the Go content-service, plus direct Drizzle queries for dashboard aggregation.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { clients, contentCrawlJobs } from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq, and, desc } from "drizzle-orm";
import { contentFetch } from "$lib/server/content-fetch";
import type { CrawlJob, ContentPage } from "./content.types";

// =============================================================================
// Validation Schemas
// =============================================================================

const StartCrawlSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	sourceUrl: v.pipe(v.string(), v.url()),
	maxDepth: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(5))),
});

const CrawlIdSchema = v.pipe(v.string(), v.uuid());

const PageQuerySchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	pageId: v.pipe(v.string(), v.uuid()),
});

const UpdatePageTypeSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	pageId: v.pipe(v.string(), v.uuid()),
	pageType: v.string(),
});

// =============================================================================
// Content-Service Proxy Functions
// =============================================================================

/** Start a crawl job for a client website */
export const startCrawl = command(StartCrawlSchema, async (data) => {
	return contentFetch<{ id: string }>("/api/content/crawl", {
		method: "POST",
		body: JSON.stringify({
			client_id: data.clientId,
			source_url: data.sourceUrl,
			max_depth: data.maxDepth ?? 3,
		}),
	});
});

/** Get crawl job status by ID */
export const getCrawlStatus = query(CrawlIdSchema, async (jobId) => {
	return contentFetch<CrawlJob>(`/api/content/crawl/${jobId}`);
});

/** Cancel a running crawl job */
export const cancelCrawl = command(CrawlIdSchema, async (jobId) => {
	return contentFetch<{ status: string }>(`/api/content/crawl/${jobId}/cancel`, {
		method: "POST",
	});
});

/** Get all content pages for a client */
export const getContentPages = query(v.pipe(v.string(), v.uuid()), async (clientId) => {
	return contentFetch<ContentPage[]>(`/api/content/pages/${clientId}`);
});

/** Get a single content page by ID */
export const getContentPage = query(PageQuerySchema, async ({ clientId, pageId }) => {
	return contentFetch<ContentPage>(`/api/content/pages/${clientId}/${pageId}`);
});

/** Update a page's classification type */
export const updatePageType = command(UpdatePageTypeSchema, async (data) => {
	return contentFetch<ContentPage>(`/api/content/pages/${data.clientId}/${data.pageId}`, {
		method: "PATCH",
		body: JSON.stringify({ page_type: data.pageType }),
	});
});

// =============================================================================
// Direct Drizzle Queries (Dashboard Aggregation)
// =============================================================================

/**
 * Get all clients with their latest crawl job data.
 * Uses Drizzle directly since both tables are in the shared PostgreSQL DB.
 * Used by the content dashboard to show clients with crawl status.
 */
export const getClientsWithCrawls = query(async () => {
	const context = await getAgencyContext();

	// Get all active clients for this agency
	const agencyClients = await db
		.select()
		.from(clients)
		.where(and(eq(clients.agencyId, context.agencyId), eq(clients.status, "active")));

	// Get the latest crawl job for each client
	const latestCrawls = await db
		.select()
		.from(contentCrawlJobs)
		.where(eq(contentCrawlJobs.agencyId, context.agencyId))
		.orderBy(desc(contentCrawlJobs.createdAt));

	// Build a map of clientId -> latest crawl job
	const crawlMap = new Map<string, (typeof latestCrawls)[number]>();
	for (const crawl of latestCrawls) {
		if (!crawlMap.has(crawl.clientId)) {
			crawlMap.set(crawl.clientId, crawl);
		}
	}

	// Combine clients with their latest crawl (only include clients that have been crawled)
	const clientsWithCrawls = agencyClients
		.filter((client) => crawlMap.has(client.id))
		.map((client) => ({
			client,
			latestCrawl: crawlMap.get(client.id)!,
		}));

	// Also return clients without crawls for the dashboard "all clients" view
	const clientsWithoutCrawls = agencyClients.filter((client) => !crawlMap.has(client.id));

	return {
		clientsWithCrawls,
		clientsWithoutCrawls,
		totalClients: agencyClients.length,
	};
});
