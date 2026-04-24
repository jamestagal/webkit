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
import { canRunSeoAudit } from "$lib/server/subscription";
import { generateShareToken } from "$lib/server/share-tokens";
import { buildShareUrl } from "$lib/server/share-helpers";
import { eq, and, desc } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { formatDate } from "$lib/utils/formatting";
import type {
	AuditResponse,
	PaginatedIssuesResponse,
	BacklinkProfileResponse,
	KeywordProfileResponse,
	CompetitorAnalysisResponse,
} from "./content-audit.types";

const ClientIdSchema = v.pipe(v.string(), v.uuid());
const AuditIdSchema = v.pipe(v.string(), v.uuid());

const RegionSchema = v.picklist(["au", "us", "uk", "nz", "ca"] as const);
const LanguageSchema = v.picklist(["en"] as const);

const StartAuditSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	targetRegion: v.optional(RegionSchema),
	targetLanguage: v.optional(LanguageSchema),
});

const AuditIssuesSchema = v.object({
	auditId: v.pipe(v.string(), v.uuid()),
	category: v.optional(v.string()),
	severity: v.optional(v.string()),
	page: v.optional(v.pipe(v.number(), v.minValue(1))),
	perPage: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
});

const CreateShareLinkSchema = v.object({
	auditId: v.pipe(v.string(), v.uuid()),
	expiresInDays: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(365))),
});

const AuditIdObjectSchema = v.object({
	auditId: v.pipe(v.string(), v.uuid()),
});

/** Start a new SEO audit for a client. Accepts optional target region + language. */
export const startAudit = command(StartAuditSchema, async ({ clientId, targetRegion, targetLanguage }) => {
	const context = await getAgencyContext();

	// Check + enforce quota (handles re-audit logic internally)
	const auditCheck = await canRunSeoAudit(context.agencyId, clientId);
	if (!auditCheck.allowed) {
		throw error(
			403,
			`Monthly SEO audit limit reached (${auditCheck.current}/${auditCheck.limit}). Limit resets on ${formatDate(auditCheck.resetsAt)}. Upgrade your plan for more audits.`,
		);
	}

	const body: Record<string, string> = {};
	if (targetRegion) body["target_region"] = targetRegion;
	if (targetLanguage) body["target_language"] = targetLanguage;

	const init: RequestInit =
		Object.keys(body).length > 0
			? { method: "POST", body: JSON.stringify(body) }
			: { method: "POST" };
	const result = await contentFetch<{ id: string }>(`/api/content/audit/${clientId}`, init);

	// No SvelteKit-side increment: content-service's handleStartAudit already
	// calls usage.Consume(FeatureSEOAudit) atomically. Re-audit discount is
	// also dropped (decision 9 — every audit counts equally).

	return result;
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

// =============================================================================
// Share Links (Phase 1)
// =============================================================================

/**
 * Create (or re-use) a share link for a completed audit. Idempotent — if a
 * non-revoked token already exists the same URL is returned with updated expiry.
 */
export const createShareLink = command(CreateShareLinkSchema, async ({ auditId, expiresInDays }) => {
	const context = await getAgencyContext();

	const [audit] = await db
		.select()
		.from(seoAudits)
		.where(and(eq(seoAudits.id, auditId), eq(seoAudits.agencyId, context.agencyId)))
		.limit(1);

	if (!audit) {
		throw error(404, "Audit not found");
	}

	if (audit.status !== "complete") {
		throw error(409, "Audit must finish before it can be shared");
	}

	const expiresAt = expiresInDays
		? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
		: null;

	let token = audit.shareToken;
	if (!token || audit.shareRevokedAt) {
		token = generateShareToken();
	}

	const now = new Date();
	await db
		.update(seoAudits)
		.set({
			shareToken: token,
			shareCreatedAt: audit.shareCreatedAt ?? now,
			shareExpiresAt: expiresAt,
			shareRevokedAt: null,
			updatedAt: now,
		})
		.where(eq(seoAudits.id, auditId));

	return {
		shareUrl: buildShareUrl(context.agency.slug, token),
		token,
		expiresAt: expiresAt?.toISOString() ?? null,
	};
});

/** Revoke an active share link. New token required to re-share after revoke. */
export const revokeShareLink = command(AuditIdObjectSchema, async ({ auditId }) => {
	const context = await getAgencyContext();

	const [audit] = await db
		.select({ id: seoAudits.id })
		.from(seoAudits)
		.where(and(eq(seoAudits.id, auditId), eq(seoAudits.agencyId, context.agencyId)))
		.limit(1);

	if (!audit) {
		throw error(404, "Audit not found");
	}

	await db
		.update(seoAudits)
		.set({ shareRevokedAt: new Date(), updatedAt: new Date() })
		.where(eq(seoAudits.id, auditId));

	return { ok: true as const };
});

/**
 * Re-enable a revoked share link. Clears share_revoked_at ONLY — does NOT
 * touch share_expires_at. If the token is also expired, the public route
 * still renders the branded expired page. To un-expire, call createShareLink
 * with a fresh expiresInDays value.
 */
export const reinstateShareLink = command(AuditIdObjectSchema, async ({ auditId }) => {
	const context = await getAgencyContext();

	const [audit] = await db
		.select()
		.from(seoAudits)
		.where(and(eq(seoAudits.id, auditId), eq(seoAudits.agencyId, context.agencyId)))
		.limit(1);

	if (!audit) {
		throw error(404, "Audit not found");
	}

	if (!audit.shareToken) {
		throw error(409, "No share link to re-enable");
	}

	await db
		.update(seoAudits)
		.set({ shareRevokedAt: null, updatedAt: new Date() })
		.where(eq(seoAudits.id, auditId));

	return {
		shareUrl: buildShareUrl(context.agency.slug, audit.shareToken),
	};
});

/**
 * Share-link status for an audit. Never throws for "no active token" — UI
 * renders the "Create share link" state instead.
 */
export const getShareStatus = query(AuditIdSchema, async (auditId) => {
	const context = await getAgencyContext();

	const [audit] = await db
		.select({
			id: seoAudits.id,
			shareToken: seoAudits.shareToken,
			shareCreatedAt: seoAudits.shareCreatedAt,
			shareExpiresAt: seoAudits.shareExpiresAt,
			shareRevokedAt: seoAudits.shareRevokedAt,
			shareViewCount: seoAudits.shareViewCount,
			shareFirstViewedAt: seoAudits.shareFirstViewedAt,
			shareLastViewedAt: seoAudits.shareLastViewedAt,
		})
		.from(seoAudits)
		.where(and(eq(seoAudits.id, auditId), eq(seoAudits.agencyId, context.agencyId)))
		.limit(1);

	if (!audit) {
		throw error(404, "Audit not found");
	}

	if (!audit.shareToken) {
		return { isShared: false as const };
	}

	const now = Date.now();
	const isRevoked = audit.shareRevokedAt != null;
	const isExpired =
		audit.shareExpiresAt != null && audit.shareExpiresAt.getTime() < now;

	return {
		isShared: true as const,
		isRevoked,
		isExpired,
		shareUrl: buildShareUrl(context.agency.slug, audit.shareToken),
		token: audit.shareToken,
		createdAt: audit.shareCreatedAt?.toISOString() ?? null,
		expiresAt: audit.shareExpiresAt?.toISOString() ?? null,
		viewCount: audit.shareViewCount,
		firstViewedAt: audit.shareFirstViewedAt?.toISOString() ?? null,
		lastViewedAt: audit.shareLastViewedAt?.toISOString() ?? null,
	};
});
