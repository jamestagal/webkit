import type { PageServerLoad, Actions } from './$types';
import {
	getStripeConnectionStatus,
	disconnectStripeAccount,
	refreshStripeAccountStatus
} from '$lib/api/stripe.remote';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	// If returning from Stripe onboarding, refresh the account status
	if (url.searchParams.get('connected') === 'true') {
		await refreshStripeAccountStatus();
	}

	const stripeStatus = await getStripeConnectionStatus();

	// Check if we need to resume onboarding (refresh param)
	const needsRefresh = url.searchParams.get('refresh') === 'true';

	return {
		stripeStatus,
		needsRefresh
	};
};

export const actions: Actions = {
	connect: async ({ locals, params }) => {
		const { agencySlug } = params;

		// Get agency ID from the current agency context
		const { getAgencyContext } = await import('$lib/server/agency');
		const { env } = await import('$env/dynamic/private');
		const { env: publicEnv } = await import('$env/dynamic/public');
		const { db } = await import('$lib/server/db');
		const { agencies, agencyProfiles, agencyMemberships } = await import('$lib/server/schema');
		const { eq, and } = await import('drizzle-orm');
		const Stripe = (await import('stripe')).default;

		try {
			const context = await getAgencyContext();

			// Check permission - only owners can connect
			if (context.role !== 'owner') {
				return fail(403, { error: 'Only agency owners can connect Stripe' });
			}

			const agencyId = context.agencyId;

			// Get agency
			const agency = await db.query.agencies.findFirst({
				where: eq(agencies.id, agencyId)
			});

			if (!agency) {
				return fail(404, { error: 'Agency not found' });
			}

			// Get or create Stripe account
			const profile = await db.query.agencyProfiles.findFirst({
				where: eq(agencyProfiles.agencyId, agencyId)
			});

			const secretKey = env['STRIPE_SECRET_KEY'];
			if (!secretKey) {
				return fail(500, { error: 'Stripe is not configured' });
			}

			const stripe = new Stripe(secretKey);

			let stripeAccountId = profile?.stripeAccountId;

			// Create a new Connect account if one doesn't exist
			if (!stripeAccountId) {
				const account = await stripe.accounts.create({
					type: 'express',
					country: 'AU',
					email: agency.email || undefined,
					business_type: 'company',
					company: {
						name: agency.name
					},
					capabilities: {
						card_payments: { requested: true },
						transfers: { requested: true }
					},
					metadata: {
						agency_id: agencyId,
						agency_slug: agency.slug
					}
				});

				stripeAccountId = account.id;

				// Store the account ID in the profile
				await db
					.update(agencyProfiles)
					.set({
						stripeAccountId: stripeAccountId,
						stripeAccountStatus: 'pending',
						updatedAt: new Date()
					})
					.where(eq(agencyProfiles.agencyId, agencyId));
			}

			// Create an account link for onboarding
			const clientUrl = env['PUBLIC_CLIENT_URL'] || publicEnv['PUBLIC_CLIENT_URL'];
			const returnUrl = `${clientUrl}/${agency.slug}/settings/payments?connected=true`;
			const refreshUrl = `${clientUrl}/${agency.slug}/settings/payments?refresh=true`;

			const accountLink = await stripe.accountLinks.create({
				account: stripeAccountId,
				refresh_url: refreshUrl,
				return_url: returnUrl,
				type: 'account_onboarding'
			});

			// Return redirect URL
			return { success: true, redirectUrl: accountLink.url };
		} catch (err) {
			console.error('Error creating Stripe account:', err);
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to connect Stripe'
			});
		}
	},

	disconnect: async () => {
		try {
			await disconnectStripeAccount();
			return { success: true };
		} catch (err) {
			console.error('Error disconnecting Stripe:', err);
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to disconnect Stripe'
			});
		}
	}
};
