/**
 * Public Invoice View - Server Load
 *
 * Loads invoice by public slug without authentication.
 * Records view count and updates status if needed.
 */

import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { invoices, invoiceLineItems, agencies, agencyProfiles } from '$lib/server/schema';
import { eq, sql, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	// Fetch invoice by slug
	const [invoice] = await db
		.select()
		.from(invoices)
		.where(eq(invoices.slug, slug))
		.limit(1);

	if (!invoice) {
		throw error(404, 'Invoice not found');
	}

	// Record view (fire-and-forget, don't await)
	const updates: Record<string, unknown> = {
		viewCount: sql`${invoices.viewCount} + 1`,
		lastViewedAt: new Date()
	};

	// If status is 'sent', change to 'viewed'
	if (invoice.status === 'sent') {
		updates['status'] = 'viewed';
	}

	db.update(invoices)
		.set(updates)
		.where(eq(invoices.id, invoice.id))
		.then(() => {})
		.catch(() => {});

	// Fetch agency
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, invoice.agencyId))
		.limit(1);

	if (!agency) {
		throw error(404, 'Agency not found');
	}

	// Fetch agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, invoice.agencyId))
		.limit(1);

	// Fetch line items
	const lineItems = await db
		.select()
		.from(invoiceLineItems)
		.where(eq(invoiceLineItems.invoiceId, invoice.id))
		.orderBy(asc(invoiceLineItems.sortOrder));

	return {
		invoice,
		lineItems,
		agency,
		profile: profile || null
	};
};
