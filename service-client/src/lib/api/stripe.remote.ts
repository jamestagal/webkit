/**
 * Stripe Remote Functions
 *
 * Server-side functions for managing Stripe Connect and Payment Links.
 * All functions are protected by permission checks and agency scoping.
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { agencyProfiles, invoices } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { getAgencyContext } from '$lib/server/agency';
import { hasPermission } from '$lib/server/permissions';
import Stripe from 'stripe';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

// Lazy-initialize Stripe to avoid module-load-time errors
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
	if (!_stripe) {
		const secretKey = privateEnv['STRIPE_SECRET_KEY'];
		if (!secretKey) {
			throw new Error('STRIPE_SECRET_KEY environment variable is not set');
		}
		_stripe = new Stripe(secretKey);
	}
	return _stripe;
}

function isStripeConfigured(): boolean {
	return !!privateEnv['STRIPE_SECRET_KEY'];
}

// =============================================================================
// Validation Schemas
// =============================================================================

const CreatePaymentLinkSchema = v.object({
	invoiceId: v.pipe(v.string(), v.uuid())
});

const DisablePaymentLinkSchema = v.object({
	invoiceId: v.pipe(v.string(), v.uuid())
});

// =============================================================================
// Connection Management
// =============================================================================

/**
 * Get the Stripe connection status for the current agency.
 */
export const getStripeConnectionStatus = query(async () => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'stripe:view_status')) {
		throw error(403, 'Permission denied: stripe:view_status');
	}

	// Check if Stripe is configured
	if (!isStripeConfigured()) {
		return {
			connected: false,
			status: 'not_configured' as const,
			accountId: null,
			chargesEnabled: false,
			payoutsEnabled: false,
			onboardingComplete: false,
			connectedAt: null
		};
	}

	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId)
	});

	if (!profile) {
		return {
			connected: false,
			status: 'not_connected' as const,
			accountId: null,
			chargesEnabled: false,
			payoutsEnabled: false,
			onboardingComplete: false,
			connectedAt: null
		};
	}

	return {
		connected: !!profile.stripeAccountId,
		status: profile.stripeAccountStatus as
			| 'not_connected'
			| 'not_configured'
			| 'pending'
			| 'active'
			| 'restricted'
			| 'disabled',
		accountId: profile.stripeAccountId,
		chargesEnabled: profile.stripeChargesEnabled,
		payoutsEnabled: profile.stripePayoutsEnabled,
		onboardingComplete: profile.stripeOnboardingComplete,
		connectedAt: profile.stripeConnectedAt
	};
});

/**
 * Disconnect the agency's Stripe account.
 * Clears all payment links from invoices.
 */
export const disconnectStripeAccount = command(async () => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'stripe:disconnect')) {
		throw error(403, 'Permission denied: stripe:disconnect');
	}

	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId)
	});

	if (!profile?.stripeAccountId) {
		return { success: true }; // Already disconnected
	}

	// Note: We don't revoke the OAuth token from Stripe because
	// Stripe Connect Standard accounts are owned by the agency.
	// They can manage their connection from their Stripe Dashboard.

	// Clear all payment links for this agency's invoices
	await db
		.update(invoices)
		.set({
			stripePaymentLinkId: null,
			stripePaymentLinkUrl: null,
			updatedAt: new Date()
		})
		.where(eq(invoices.agencyId, context.agencyId));

	// Clear Stripe account from agency profile
	await db
		.update(agencyProfiles)
		.set({
			stripeAccountId: null,
			stripeAccountStatus: 'not_connected',
			stripeOnboardingComplete: false,
			stripePayoutsEnabled: false,
			stripeChargesEnabled: false,
			stripeConnectedAt: null,
			updatedAt: new Date()
		})
		.where(eq(agencyProfiles.agencyId, context.agencyId));

	return { success: true };
});

/**
 * Refresh the Stripe account status from Stripe API.
 */
export const refreshStripeAccountStatus = command(async () => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'stripe:view_status')) {
		throw error(403, 'Permission denied: stripe:view_status');
	}

	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId)
	});

	if (!profile?.stripeAccountId) {
		return { success: false, error: 'No Stripe account connected' };
	}

	try {
		const account = await getStripe().accounts.retrieve(profile.stripeAccountId);

		// Determine account status based on actual capabilities
		// Prioritize charges_enabled as the key indicator
		let status: 'active' | 'restricted' | 'disabled' = 'active';
		if (account.charges_enabled) {
			// If charges are enabled, account is functional
			status = 'active';
		} else if (account.requirements?.disabled_reason) {
			status = 'disabled';
		} else if (
			account.requirements?.currently_due &&
			account.requirements.currently_due.length > 0
		) {
			status = 'restricted';
		}

		// Update agency profile
		await db
			.update(agencyProfiles)
			.set({
				stripeAccountStatus: status,
				stripeOnboardingComplete: account.details_submitted || false,
				stripePayoutsEnabled: account.payouts_enabled || false,
				stripeChargesEnabled: account.charges_enabled || false,
				updatedAt: new Date()
			})
			.where(eq(agencyProfiles.id, profile.id));

		return {
			success: true,
			status,
			chargesEnabled: account.charges_enabled,
			payoutsEnabled: account.payouts_enabled,
			onboardingComplete: account.details_submitted
		};
	} catch (err) {
		console.error('Error refreshing Stripe account status:', err);
		return { success: false, error: 'Failed to refresh account status' };
	}
});

// =============================================================================
// Payment Links
// =============================================================================

/**
 * Create a Stripe Payment Link for an invoice.
 */
export const createPaymentLink = command(CreatePaymentLinkSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:create_payment_link')) {
		throw error(403, 'Permission denied: invoice:create_payment_link');
	}

	// Get the invoice
	const invoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, data.invoiceId)
	});

	if (!invoice) {
		throw new Error('Invoice not found');
	}

	// Verify invoice belongs to this agency
	if (invoice.agencyId !== context.agencyId) {
		throw new Error('Invoice not found');
	}

	// Check invoice status - can only create payment link for sent/viewed/overdue invoices
	if (!['sent', 'viewed', 'overdue'].includes(invoice.status)) {
		throw new Error(
			`Cannot create payment link for invoice with status: ${invoice.status}`
		);
	}

	// Check if payment link already exists
	if (invoice.stripePaymentLinkUrl) {
		return {
			success: true,
			paymentLinkId: invoice.stripePaymentLinkId,
			paymentLinkUrl: invoice.stripePaymentLinkUrl
		};
	}

	// Get agency profile for Stripe account
	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId)
	});

	if (!profile?.stripeAccountId) {
		throw new Error('Stripe account not connected');
	}

	if (!profile.stripeChargesEnabled) {
		throw new Error('Stripe charges not enabled. Complete Stripe onboarding first.');
	}

	try {
		// Create a price for this invoice on the connected account
		const price = await getStripe().prices.create(
			{
				currency: 'aud',
				unit_amount: Math.round(parseFloat(invoice.total as string) * 100),
				product_data: {
					name: `Invoice ${invoice.invoiceNumber}`,
					metadata: {
						invoice_id: invoice.id,
						agency_id: invoice.agencyId,
						invoice_number: invoice.invoiceNumber
					}
				}
			},
			{
				stripeAccount: profile.stripeAccountId
			}
		);

		// Create payment link
		const paymentLink = await getStripe().paymentLinks.create(
			{
				line_items: [{ price: price.id, quantity: 1 }],
				metadata: {
					invoice_id: invoice.id,
					invoice_number: invoice.invoiceNumber,
					agency_id: invoice.agencyId
				},
				after_completion: {
					type: 'redirect',
					redirect: {
						url: `${env['PUBLIC_CLIENT_URL']}/i/${invoice.slug}?paid=true`
					}
				}
			},
			{
				stripeAccount: profile.stripeAccountId
			}
		);

		// Store payment link on invoice
		await db
			.update(invoices)
			.set({
				stripePaymentLinkId: paymentLink.id,
				stripePaymentLinkUrl: paymentLink.url,
				updatedAt: new Date()
			})
			.where(eq(invoices.id, invoice.id));

		return {
			success: true,
			paymentLinkId: paymentLink.id,
			paymentLinkUrl: paymentLink.url
		};
	} catch (err) {
		console.error('Error creating payment link:', err);
		if (err instanceof Stripe.errors.StripeError) {
			throw new Error(`Stripe error: ${err.message}`);
		}
		throw new Error('Failed to create payment link');
	}
});

/**
 * Get the payment link for an invoice.
 */
export const getPaymentLink = query(v.pipe(v.string(), v.uuid()), async (invoiceId) => {
	const context = await getAgencyContext();

	const invoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, invoiceId)
	});

	if (!invoice || invoice.agencyId !== context.agencyId) {
		return null;
	}

	return {
		paymentLinkId: invoice.stripePaymentLinkId,
		paymentLinkUrl: invoice.stripePaymentLinkUrl,
		hasPaymentLink: !!invoice.stripePaymentLinkUrl
	};
});

/**
 * Disable/deactivate a payment link for an invoice.
 * Called when cancelling an invoice or manually disabling payments.
 */
export const disablePaymentLink = command(DisablePaymentLinkSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:cancel')) {
		throw error(403, 'Permission denied: invoice:cancel');
	}

	// Get the invoice
	const invoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, data.invoiceId)
	});

	if (!invoice || invoice.agencyId !== context.agencyId) {
		throw new Error('Invoice not found');
	}

	// If no payment link, nothing to disable
	if (!invoice.stripePaymentLinkId) {
		return { success: true };
	}

	// Get agency profile for Stripe account
	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId)
	});

	if (!profile?.stripeAccountId) {
		// If no Stripe account, just clear the link from DB
		await db
			.update(invoices)
			.set({
				stripePaymentLinkId: null,
				stripePaymentLinkUrl: null,
				updatedAt: new Date()
			})
			.where(eq(invoices.id, invoice.id));

		return { success: true };
	}

	try {
		// Deactivate the payment link in Stripe
		await getStripe().paymentLinks.update(
			invoice.stripePaymentLinkId,
			{ active: false },
			{ stripeAccount: profile.stripeAccountId }
		);
	} catch (err) {
		// Log but don't fail - the payment link might already be deactivated
		console.error('Error deactivating payment link in Stripe:', err);
	}

	// Clear from invoice record
	await db
		.update(invoices)
		.set({
			stripePaymentLinkId: null,
			stripePaymentLinkUrl: null,
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoice.id));

	return { success: true };
});
