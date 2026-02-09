import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { agencyProfiles, agencyPackages, agencies } from "$lib/server/schema";
import { eq, and, count } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
	const { agency, membership } = await parent();

	// Only owners can access onboarding
	if (membership.role !== "owner") {
		throw redirect(302, `/${agency.slug}`);
	}

	// Check current setup status
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, agency.id))
		.limit(1);

	// If onboarding already completed, redirect to dashboard
	if (profile?.onboardingCompletedAt) {
		throw redirect(302, `/${agency.slug}`);
	}

	// Get agency details for branding step
	const [agencyDetails] = await db
		.select({
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			email: agencies.email,
			phone: agencies.phone,
		})
		.from(agencies)
		.where(eq(agencies.id, agency.id))
		.limit(1);

	// Count packages
	const [packagesResult] = await db
		.select({ count: count() })
		.from(agencyPackages)
		.where(and(eq(agencyPackages.agencyId, agency.id), eq(agencyPackages.isActive, true)));

	const hasProfile = !!(profile?.legalEntityName || profile?.tradingName);
	const hasAddress = !!(profile?.addressLine1 && profile?.city);
	const hasBranding = !!agencyDetails?.logoUrl;
	const hasPackages = (packagesResult?.count ?? 0) > 0;
	const hasStripe = profile?.stripeOnboardingComplete ?? false;

	return {
		profile: profile ?? null,
		agencyDetails,
		packageCount: packagesResult?.count ?? 0,
		completionStatus: {
			hasProfile,
			hasAddress,
			hasBranding,
			hasPackages,
			hasStripe,
		},
	};
};
