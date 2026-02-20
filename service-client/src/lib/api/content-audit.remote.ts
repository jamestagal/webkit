/**
 * SEO Audit Remote Functions
 * Proxies to Go content-service audit endpoints + Drizzle queries.
 */
import { query, command } from "$app/server";
import * as v from "valibot";
import { contentFetch } from "$lib/server/content-fetch";
import { db } from "$lib/server/db";
import { seoAudits } from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq, and, desc } from "drizzle-orm";
import type {
	AuditResponse,
	PaginatedIssuesResponse,
	BacklinkProfileResponse,
	KeywordProfileResponse,
	CompetitorAnalysisResponse,
} from "./content-audit.types";

const ClientIdSchema = v.pipe(v.string(), v.uuid());
const AuditIdSchema = v.pipe(v.string(), v.uuid());

const AuditIssuesSchema = v.object({
	auditId: v.pipe(v.string(), v.uuid()),
	category: v.optional(v.string()),
	severity: v.optional(v.string()),
	page: v.optional(v.pipe(v.number(), v.minValue(1))),
	perPage: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
});

/** Start a new SEO audit for a client */
export const startAudit = command(ClientIdSchema, async (clientId) => {
	return contentFetch<{ id: string }>(`/api/content/audit/${clientId}`, {
		method: "POST",
	});
});

/** Get audit details by ID */
export const getAudit = query(AuditIdSchema, async (auditId) => {
	return contentFetch<AuditResponse>(`/api/content/audit/${auditId}`);
});

/** Get audit issues with optional filters and pagination */
export const getAuditIssues = query(AuditIssuesSchema, async ({ auditId, category, severity, page, perPage }) => {
	const params = new URLSearchParams();
	if (category) params.set("category", category);
	if (severity) params.set("severity", severity);
	if (page) params.set("page", String(page));
	if (perPage) params.set("per_page", String(perPage));
	const qs = params.toString();
	return contentFetch<PaginatedIssuesResponse>(`/api/content/audit/${auditId}/issues${qs ? `?${qs}` : ""}`);
});

/** Get backlink profile for an audit */
export const getAuditBacklinks = query(AuditIdSchema, async (auditId) => {
	return contentFetch<BacklinkProfileResponse>(`/api/content/audit/${auditId}/backlinks`);
});

/** Get keyword profile for an audit */
export const getAuditKeywords = query(AuditIdSchema, async (auditId) => {
	return contentFetch<KeywordProfileResponse>(`/api/content/audit/${auditId}/keywords`);
});

/** Get competitor analyses for an audit */
export const getAuditCompetitors = query(AuditIdSchema, async (auditId) => {
	return contentFetch<CompetitorAnalysisResponse[]>(`/api/content/audit/${auditId}/competitors`);
});

/** Get all audits for a client (Drizzle direct query) */
export const getClientAudits = query(ClientIdSchema, async (clientId) => {
	const context = await getAgencyContext();
	return db
		.select()
		.from(seoAudits)
		.where(and(eq(seoAudits.clientId, clientId), eq(seoAudits.agencyId, context.agencyId)))
		.orderBy(desc(seoAudits.createdAt));
});
