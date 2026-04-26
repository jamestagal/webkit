/**
 * Stripe Connect - Refresh Account Status
 *
 * Called to refresh the connected account's status after onboarding.
 * This endpoint checks the account's capabilities and updates the database.
 *
 * GET /api/stripe/callback?agency_id={agencyId}
 */

import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { agencies, agencyProfiles } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { env } from "$env/dynamic/private";

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

export const GET: RequestHandler = async ({ url }) => {
	const agencyId = url.searchParams.get("agency_id");

	if (!agencyId) {
		return redirect(302, "/agencies?error=missing_agency");
	}

	// Get agency
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

	if (!profile?.stripeAccountId) {
		return redirect(302, `/${agency.slug}/settings/payments?error=no_account`);
	}

	try {
		// Retrieve account details
		const account = await getStripe().accounts.retrieve(profile.stripeAccountId);

		// Determine account status
		let status: "active" | "restricted" | "pending" | "disabled" = "pending";
		if (account.requirements?.disabled_reason) {
			status = "disabled";
		} else if (account.details_submitted && account.charges_enabled) {
			status = "active";
		} else if (
			account.requirements?.currently_due &&
			account.requirements.currently_due.length > 0
		) {
			status = "restricted";
		}

		// Update agency profile
		await db
			.update(agencyProfiles)
			.set({
				stripeAccountStatus: status,
				stripeOnboardingComplete: account.details_submitted || false,
				stripePayoutsEnabled: account.payouts_enabled || false,
				stripeChargesEnabled: account.charges_enabled || false,
				stripeConnectedAt: account.details_submitted ? new Date() : null,
				updatedAt: new Date(),
			})
			.where(eq(agencyProfiles.agencyId, agencyId));

		return redirect(302, `/${agency.slug}/settings/payments?connected=true`);
	} catch (err) {
		console.error("Error refreshing Stripe account status:", err);
		return redirect(302, `/${agency.slug}/settings/payments?error=refresh_failed`);
	}
};
