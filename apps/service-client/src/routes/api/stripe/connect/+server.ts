/**
 * Stripe Connect - Create Account Link
 *
 * Creates a Stripe Connect Express account (if needed) and generates
 * an onboarding link for the agency to complete their Stripe setup.
 *
 * GET /api/stripe/connect?agency_id={agencyId}
 */

import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { agencies, agencyMemberships, agencyProfiles } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import Stripe from "stripe";

// Lazy-initialize Stripe
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
	if (!_stripe) {
		const secretKey = env["STRIPE_SECRET_KEY"];
		if (!secretKey) {
			throw new Error("STRIPE_SECRET_KEY not configured");
		}
		_stripe = new Stripe(secretKey);
	}
	return _stripe;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const agencyId = url.searchParams.get("agency_id");

	if (!agencyId) {
		return redirect(302, "/agencies?error=missing_agency");
	}

	// Check if Stripe is configured
	if (!env["STRIPE_SECRET_KEY"]) {
		console.error("STRIPE_SECRET_KEY is not configured");
		return redirect(302, "/agencies?error=stripe_not_configured");
	}

	// Verify user is authenticated
	const user = locals.user;
	if (!user?.id) {
		return redirect(302, "/login?redirect=" + encodeURIComponent(url.pathname + url.search));
	}

	// Verify user is owner of the agency
	const membership = await db.query.agencyMemberships.findFirst({
		where: and(eq(agencyMemberships.agencyId, agencyId), eq(agencyMemberships.userId, user.id)),
	});

	if (!membership || membership.role !== "owner") {
		const agency = await db.query.agencies.findFirst({
			where: eq(agencies.id, agencyId),
		});
		const slug = agency?.slug || "";
		return redirect(302, `/${slug}/settings/payments?error=permission_denied`);
	}

	// Get agency details
	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, agencyId),
	});

	if (!agency) {
		return redirect(302, "/agencies?error=agency_not_found");
	}

	// Get agency profile
	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, agencyId),
	});

	const clientUrl = env["PUBLIC_CLIENT_URL"] || publicEnv["PUBLIC_CLIENT_URL"];
	const returnUrl = `${clientUrl}/${agency.slug}/settings/payments?connected=true`;
	const refreshUrl = `${clientUrl}/api/stripe/connect?agency_id=${agencyId}`;

	try {
		let stripeAccountId = profile?.stripeAccountId;

		// Create a new Connect account if one doesn't exist
		if (!stripeAccountId) {
			const account = await getStripe().accounts.create({
				type: "express",
				country: "AU",
				...(agency.email ? { email: agency.email } : {}),
				business_type: "company",
				company: {
					name: agency.name,
				},
				capabilities: {
					card_payments: { requested: true },
					transfers: { requested: true },
				},
				metadata: {
					agency_id: agencyId,
					agency_slug: agency.slug,
				},
			});

			stripeAccountId = account.id;

			// Store the account ID in the profile
			await db
				.update(agencyProfiles)
				.set({
					stripeAccountId: stripeAccountId,
					stripeAccountStatus: "pending",
					updatedAt: new Date(),
				})
				.where(eq(agencyProfiles.agencyId, agencyId));
		}

		// Create an account link for onboarding
		const accountLink = await getStripe().accountLinks.create({
			account: stripeAccountId,
			refresh_url: refreshUrl,
			return_url: returnUrl,
			type: "account_onboarding",
		});

		// Redirect to Stripe onboarding
		return redirect(302, accountLink.url);
	} catch (err) {
		console.error("Error creating Stripe account link:", err);
		return redirect(302, `/${agency.slug}/settings/payments?error=connection_failed`);
	}
};
