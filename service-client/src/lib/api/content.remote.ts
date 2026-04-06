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
import { eq, and, desc, sql } from "drizzle-orm";
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

/**
 * Content status per client for the Content Intelligence hub.
 */
export interface ClientContentStatus {
	client: {
		id: string;
		businessName: string;
		email: string;
		website: string;
		contactName: string | null;
		createdAt: Date;
	};
	crawl: {
		status: string | null;
		totalPages: number;
		lastCrawledAt: Date | null;
	};
	audit: {
		status: string | null;
		score: number | null;
		lastAuditedAt: Date | null;
	};
	brand: {
		hasProfile: boolean;
	};
	copy: {
		total: number;
	};
}

/**
 * Get all clients with aggregated content status (crawl, audit, brand, copy).
 * Single efficient query using lateral subqueries.
 */
export const getClientsWithContentStatus = query(async () => {
	const context = await getAgencyContext();

	const result = await db.execute<{
		id: string;
		business_name: string;
		email: string;
		website: string;
		contact_name: string | null;
		created_at: Date;
		crawl_status: string | null;
		crawl_pages: number | null;
		crawl_completed_at: Date | null;
		audit_status: string | null;
		audit_score: number | null;
		audit_completed_at: Date | null;
		has_brand: boolean;
		copy_count: number;
	}>(sql`
		SELECT
			c.id, c.business_name, c.email, COALESCE(c.website, '') AS website,
			c.contact_name, c.created_at,
			crawl.status AS crawl_status,
			crawl.pages_discovered AS crawl_pages,
			crawl.completed_at AS crawl_completed_at,
			audit.status AS audit_status,
			audit.overall_score AS audit_score,
			audit.completed_at AS audit_completed_at,
			(SELECT EXISTS(
				SELECT 1 FROM brand_profiles WHERE client_id = c.id AND is_active = true
			)) AS has_brand,
			(SELECT COUNT(*)::int FROM content_copy WHERE client_id = c.id) AS copy_count
		FROM clients c
		LEFT JOIN LATERAL (
			SELECT status, pages_discovered, completed_at
			FROM content_crawl_jobs
			WHERE client_id = c.id AND crawl_target = 'client'
			ORDER BY created_at DESC LIMIT 1
		) crawl ON true
		LEFT JOIN LATERAL (
			SELECT status, overall_score, completed_at
			FROM seo_audits
			WHERE client_id = c.id
			ORDER BY created_at DESC LIMIT 1
		) audit ON true
		WHERE c.agency_id = ${context.agencyId} AND c.status = 'active'
		ORDER BY GREATEST(
			crawl.completed_at, audit.completed_at, c.created_at
		) DESC NULLS LAST
	`);

	const rows = result.rows;
	return rows.map((row: typeof result.rows[number]): ClientContentStatus => ({
		client: {
			id: row.id,
			businessName: row.business_name,
			email: row.email,
			website: row.website,
			contactName: row.contact_name,
			createdAt: row.created_at,
		},
		crawl: {
			status: row.crawl_status,
			totalPages: row.crawl_pages ?? 0,
			lastCrawledAt: row.crawl_completed_at,
		},
		audit: {
			status: row.audit_status,
			score: row.audit_score,
			lastAuditedAt: row.audit_completed_at,
		},
		brand: {
			hasProfile: row.has_brand,
		},
		copy: {
			total: row.copy_count ?? 0,
		},
	}));
});
