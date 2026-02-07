/**
 * Stripe Webhook Handler
 *
 * Processes webhook events from Stripe for both platform and connected accounts.
 * Handles payment completions, account updates, and disconnections.
 *
 * POST /api/stripe/webhook
 *
 * Events handled:
 * - checkout.session.completed: Mark invoice as paid
 * - payment_intent.succeeded: Update payment details
 * - account.updated: Update agency Stripe status
 * - account.application.deauthorized: Mark as disconnected
 */

import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { invoices, agencies, agencyProfiles, emailLogs } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { sendEmail } from "$lib/server/services/email.service";
import {
	generateInvoicePaidClientEmail,
	generateInvoicePaidAgencyEmail,
} from "$lib/templates/email-templates";

// Lazy-initialize Stripe to avoid build-time errors
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
	if (!_stripe) {
		const secretKey = env.STRIPE_SECRET_KEY;
		if (!secretKey) {
			throw new Error("STRIPE_SECRET_KEY is not configured");
		}
		_stripe = new Stripe(secretKey);
	}
	return _stripe;
}

export const POST: RequestHandler = async ({ request }) => {
	const payload = await request.text();
	const sig = request.headers.get("stripe-signature");

	if (!sig) {
		return new Response("Missing stripe-signature header", { status: 400 });
	}

	const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
	if (!webhookSecret) {
		console.error("STRIPE_WEBHOOK_SECRET is not configured");
		return new Response("Webhook not configured", { status: 500 });
	}

	let event: Stripe.Event;

	try {
		event = getStripe().webhooks.constructEvent(payload, sig, webhookSecret);
	} catch (err) {
		console.error("Webhook signature verification failed:", err);
		return new Response("Webhook signature verification failed", { status: 400 });
	}

	// For Connect webhooks, check if it's from a connected account
	const connectedAccountId = event.account;

	try {
		switch (event.type) {
			case "checkout.session.completed":
				await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
				break;

			case "payment_intent.succeeded":
				await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
				break;

			case "account.updated":
				await handleAccountUpdate(event.data.object as Stripe.Account);
				break;

			case "account.application.deauthorized":
				if (connectedAccountId) {
					await handleAccountDeauthorized(connectedAccountId);
				}
				break;

			default:
				// Log unhandled events for debugging
				console.log(`Unhandled Stripe event: ${event.type}`);
		}

		return new Response("OK", { status: 200 });
	} catch (err) {
		console.error("Error processing webhook:", err);
		return new Response("Webhook processing failed", { status: 500 });
	}
};

/**
 * Handle successful checkout session - marks invoice as paid
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
	const invoiceId = session.metadata?.['invoice_id'];

	if (!invoiceId) {
		console.log("Checkout completed but no invoice_id in metadata");
		return;
	}

	// Get the invoice
	const invoice = await db.query.invoices.findFirst({
		where: eq(invoices.id, invoiceId),
	});

	if (!invoice) {
		console.error(`Invoice not found: ${invoiceId}`);
		return;
	}

	// Skip if already paid (idempotency)
	if (invoice.status === "paid") {
		console.log(`Invoice ${invoiceId} already marked as paid`);
		return;
	}

	// Update invoice to paid status
	await db
		.update(invoices)
		.set({
			status: "paid",
			paidAt: new Date(),
			paymentMethod: "card",
			paymentReference: (session.payment_intent as string) || session.id,
			paymentNotes: `Stripe payment - ${session.customer_email || "Online checkout"}`,
			stripeCheckoutSessionId: session.id,
			stripePaymentIntentId: session.payment_intent as string,
			updatedAt: new Date(),
		})
		.where(eq(invoices.id, invoiceId));

	console.log(`Invoice ${invoiceId} marked as paid via Stripe checkout`);

	// Send payment notification emails (fire-and-forget)
	sendInvoicePaidNotifications(invoice, "Card (Stripe)").catch((err) => {
		console.error("Failed to send invoice paid notification emails:", err);
	});
}

/**
 * Handle successful payment intent - updates payment details
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
	const invoiceId = paymentIntent.metadata?.['invoice_id'];

	if (!invoiceId) {
		// Not all payment intents are for our invoices
		return;
	}

	// Update the invoice with payment intent ID if not already set
	await db
		.update(invoices)
		.set({
			stripePaymentIntentId: paymentIntent.id,
			updatedAt: new Date(),
		})
		.where(eq(invoices.id, invoiceId));
}

/**
 * Handle account updates - syncs agency Stripe status
 */
async function handleAccountUpdate(account: Stripe.Account) {
	// Find agency profile with this Stripe account
	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.stripeAccountId, account.id),
	});

	if (!profile) {
		// This account isn't connected to our platform
		return;
	}

	// Determine account status
	let status: "active" | "restricted" | "disabled" = "active";
	if (account.requirements?.disabled_reason) {
		status = "disabled";
	} else if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
		status = "restricted";
	}

	// Update agency profile with latest account status
	await db
		.update(agencyProfiles)
		.set({
			stripeAccountStatus: status,
			stripeOnboardingComplete: account.details_submitted || false,
			stripePayoutsEnabled: account.payouts_enabled || false,
			stripeChargesEnabled: account.charges_enabled || false,
			updatedAt: new Date(),
		})
		.where(eq(agencyProfiles.id, profile.id));

	console.log(`Updated Stripe status for agency profile ${profile.id}: ${status}`);
}

/**
 * Handle account deauthorization - marks agency as disconnected
 */
async function handleAccountDeauthorized(stripeAccountId: string) {
	// Find and update the agency profile
	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.stripeAccountId, stripeAccountId),
	});

	if (!profile) {
		return;
	}

	// Clear Stripe connection from agency
	await db
		.update(agencyProfiles)
		.set({
			stripeAccountId: null,
			stripeAccountStatus: "not_connected",
			stripeOnboardingComplete: false,
			stripePayoutsEnabled: false,
			stripeChargesEnabled: false,
			stripeConnectedAt: null,
			updatedAt: new Date(),
		})
		.where(eq(agencyProfiles.id, profile.id));

	// Also clear payment links from invoices for this agency
	await db
		.update(invoices)
		.set({
			stripePaymentLinkId: null,
			stripePaymentLinkUrl: null,
			updatedAt: new Date(),
		})
		.where(eq(invoices.agencyId, profile.agencyId));

	console.log(`Agency ${profile.agencyId} disconnected from Stripe`);
}

/**
 * Send payment notification emails to both client and agency
 */
async function sendInvoicePaidNotifications(
	invoice: { id: string; agencyId: string; invoiceNumber: string; slug: string; total: string; clientEmail: string; clientContactName: string; clientBusinessName: string },
	paymentMethod: string
) {
	const baseUrl = publicEnv.PUBLIC_CLIENT_URL || "https://webkit.au";
	const publicUrl = `${baseUrl}/i/${invoice.slug}`;
	const paidAt = new Date().toLocaleDateString("en-AU", {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, invoice.agencyId))
		.limit(1);

	if (!agency) return;

	const notificationData = {
		agency: {
			name: agency.name,
			email: agency.email || undefined,
			primaryColor: agency.primaryColor || undefined,
			logoUrl: agency.logoUrl || undefined,
		},
		invoice: {
			number: invoice.invoiceNumber,
			total: invoice.total,
			publicUrl,
		},
		client: {
			name: invoice.clientContactName || invoice.clientBusinessName || "Client",
			businessName: invoice.clientBusinessName || undefined,
			email: invoice.clientEmail,
		},
		paidAt,
		paymentMethod,
	};

	// Send receipt to client
	if (invoice.clientEmail) {
		const clientEmail = generateInvoicePaidClientEmail(notificationData);
		const clientResult = await sendEmail({
			to: invoice.clientEmail,
			subject: clientEmail.subject,
			html: clientEmail.bodyHtml,
			...(agency.email ? { replyTo: agency.email } : {}),
		});

		await db.insert(emailLogs).values({
			agencyId: invoice.agencyId,
			invoiceId: invoice.id,
			emailType: "invoice_paid_client",
			recipientEmail: invoice.clientEmail,
			recipientName: invoice.clientContactName || invoice.clientBusinessName || null,
			subject: clientEmail.subject,
			bodyHtml: clientEmail.bodyHtml,
			status: clientResult.success ? "sent" : "failed",
			resendMessageId: clientResult.messageId || null,
		});
	}

	// Send notification to agency
	if (agency.email) {
		const agencyNotification = generateInvoicePaidAgencyEmail(notificationData);
		const agencyResult = await sendEmail({
			to: agency.email,
			subject: agencyNotification.subject,
			html: agencyNotification.bodyHtml,
		});

		await db.insert(emailLogs).values({
			agencyId: invoice.agencyId,
			invoiceId: invoice.id,
			emailType: "invoice_paid_agency",
			recipientEmail: agency.email,
			recipientName: agency.name,
			subject: agencyNotification.subject,
			bodyHtml: agencyNotification.bodyHtml,
			status: agencyResult.success ? "sent" : "failed",
			resendMessageId: agencyResult.messageId || null,
		});
	}
}
