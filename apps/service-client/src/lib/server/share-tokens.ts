/**
 * Shareable SEO audit report tokens.
 *
 * Server-only utilities. Called from remote commands AND from the public
 * report +page.server.ts load (which is unauthenticated).
 *
 * Security:
 * - Tokens are 32 random bytes (64-char hex). 2^256 search space.
 * - Token comparison is constant-time via crypto.timingSafeEqual.
 * - Revoked / not-found / slug-mismatch all return the same result — no existence leak.
 * - recordShareView is a no-op for revoked/expired tokens (silent).
 */

import { randomBytes, timingSafeEqual } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
	agencies,
	backlinkProfiles,
	clients,
	competitorAnalyses,
	keywordProfiles,
	seoAudits,
	seoIssues,
} from "./schema";

/** Minimal agency branding payload surfaced to public report viewers. */
export interface ReportAgencyBranding {
	id: string;
	name: string;
	slug: string;
	logoUrl: string;
	logoAvatarUrl: string;
	primaryColor: string;
	secondaryColor: string;
	accentColor: string;
	accentGradient: string;
	email: string;
	phone: string;
	website: string;
}

const AGENCY_BRANDING_COLUMNS = {
	id: agencies.id,
	name: agencies.name,
	slug: agencies.slug,
	logoUrl: agencies.logoUrl,
	logoAvatarUrl: agencies.logoAvatarUrl,
	primaryColor: agencies.primaryColor,
	secondaryColor: agencies.secondaryColor,
	accentColor: agencies.accentColor,
	accentGradient: agencies.accentGradient,
	email: agencies.email,
	phone: agencies.phone,
	website: agencies.website,
} as const;

export type ValidateShareTokenResult =
	| { status: "ok"; audit: typeof seoAudits.$inferSelect; agency: ReportAgencyBranding }
	| { status: "expired"; agency: ReportAgencyBranding }
	| { status: "revoked" }
	| { status: "not-found" };

/** Generate a cryptographically strong share token (64 hex chars). */
export function generateShareToken(): string {
	return randomBytes(32).toString("hex");
}

/**
 * Validate a share token against an agency slug.
 * Revoked / not-found / slug-mismatch all return distinct results for logging
 * but the public route MUST collapse revoked + not-found into a single 404.
 */
export async function validateShareToken(
	token: string,
	slug: string,
): Promise<ValidateShareTokenResult> {
	// Reject malformed tokens up-front — avoids DB round-trip on obvious junk.
	if (!/^[0-9a-f]{64}$/i.test(token)) {
		return { status: "not-found" };
	}

	const [row] = await db
		.select({
			audit: seoAudits,
			agency: AGENCY_BRANDING_COLUMNS,
		})
		.from(seoAudits)
		.innerJoin(agencies, eq(agencies.id, seoAudits.agencyId))
		.where(eq(seoAudits.shareToken, token))
		.limit(1);

	if (!row || !row.audit.shareToken) {
		return { status: "not-found" };
	}

	// Constant-time comparison. DB already matched exactly, but this shields
	// any future code path that might compare user-supplied tokens directly.
	const a = Buffer.from(token, "hex");
	const b = Buffer.from(row.audit.shareToken, "hex");
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		return { status: "not-found" };
	}

	// Slug mismatch → same as not-found (no information leak).
	if (row.agency.slug !== slug) {
		return { status: "not-found" };
	}

	if (row.audit.shareRevokedAt) {
		return { status: "revoked" };
	}

	if (row.audit.shareExpiresAt && row.audit.shareExpiresAt.getTime() < Date.now()) {
		return { status: "expired", agency: row.agency };
	}

	return { status: "ok", audit: row.audit, agency: row.agency };
}

export type PublicReportData =
	| {
			status: "ok";
			audit: typeof seoAudits.$inferSelect;
			agency: ReportAgencyBranding;
			client: typeof clients.$inferSelect | null;
			issues: (typeof seoIssues.$inferSelect)[];
			backlink: typeof backlinkProfiles.$inferSelect | null;
			keyword: typeof keywordProfiles.$inferSelect | null;
			competitors: (typeof competitorAnalyses.$inferSelect)[];
	  }
	| { status: "expired"; agency: ReportAgencyBranding }
	| { status: "revoked" }
	| { status: "not-found" };

/**
 * Validate the token and load every section needed to render the public report.
 * All related queries run after validation — no work happens for bad tokens.
 */
export async function loadPublicReport(token: string, slug: string): Promise<PublicReportData> {
	const validation = await validateShareToken(token, slug);
	if (validation.status !== "ok") return validation;

	const auditId = validation.audit.id;

	const [issues, backlinkRows, keywordRows, competitors, clientRows] = await Promise.all([
		db.select().from(seoIssues).where(eq(seoIssues.auditId, auditId)),
		db.select().from(backlinkProfiles).where(eq(backlinkProfiles.auditId, auditId)).limit(1),
		db.select().from(keywordProfiles).where(eq(keywordProfiles.auditId, auditId)).limit(1),
		db.select().from(competitorAnalyses).where(eq(competitorAnalyses.auditId, auditId)),
		db.select().from(clients).where(eq(clients.id, validation.audit.clientId)).limit(1),
	]);

	return {
		status: "ok",
		audit: validation.audit,
		agency: validation.agency,
		client: clientRows[0] ?? null,
		issues,
		backlink: backlinkRows[0] ?? null,
		keyword: keywordRows[0] ?? null,
		competitors,
	};
}

/**
 * Record a public view of a shared report. Atomic UPDATE that is silent when
 * the token is revoked or expired — revoked/expired views don't count.
 */
export async function recordShareView(token: string): Promise<void> {
	if (!/^[0-9a-f]{64}$/i.test(token)) return;
	await db.execute(sql`
		UPDATE seo_audits
		   SET share_view_count = share_view_count + 1,
		       share_last_viewed_at = NOW(),
		       share_first_viewed_at = COALESCE(share_first_viewed_at, NOW())
		 WHERE share_token = ${token}
		   AND share_revoked_at IS NULL
		   AND (share_expires_at IS NULL OR share_expires_at > NOW())
	`);
}

/**
 * Look up the branding payload for an agency slug. Used by the public layout
 * to render branded "expired" / "not available" pages without running a user
 * membership check. Keep column selection tight — public code path.
 */
export async function getAgencyBrandingBySlug(
	slug: string,
): Promise<ReportAgencyBranding | null> {
	const [row] = await db
		.select(AGENCY_BRANDING_COLUMNS)
		.from(agencies)
		.where(and(eq(agencies.slug, slug), eq(agencies.status, "active")))
		.limit(1);
	return row ?? null;
}
