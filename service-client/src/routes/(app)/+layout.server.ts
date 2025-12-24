import { db } from '$lib/server/db';
import { agencies, agencyMemberships, agencyFormOptions, users } from '$lib/server/schema';
import { eq, and, asc } from 'drizzle-orm';
import { groupOptionsByCategory, mergeWithDefaults } from '$lib/stores/agency-config.svelte';
import type { AgencyConfig } from '$lib/stores/agency-config.svelte';

export const load: import('./$types').LayoutServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;

	// Default response without agency context
	let agencyConfig: AgencyConfig | null = null;
	let currentAgency: {
		id: string;
		name: string;
		slug: string;
		logoUrl: string;
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
	} | null = null;
	let userRole: 'owner' | 'admin' | 'member' | null = null;

	if (userId) {
		try {
			// Get user's default agency or first agency they belong to
			const [user] = await db
				.select({ defaultAgencyId: users.defaultAgencyId })
				.from(users)
				.where(eq(users.id, userId))
				.limit(1);

			let agencyId = user?.defaultAgencyId;

			// If no default agency, get first active membership
			if (!agencyId) {
				const [membership] = await db
					.select({ agencyId: agencyMemberships.agencyId })
					.from(agencyMemberships)
					.where(
						and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.status, 'active'))
					)
					.limit(1);

				agencyId = membership?.agencyId;
			}

			// If user has an agency, load the context
			if (agencyId) {
				// Get agency details and user's role
				const [result] = await db
					.select({
						agencyId: agencies.id,
						agencyName: agencies.name,
						agencySlug: agencies.slug,
						logoUrl: agencies.logoUrl,
						primaryColor: agencies.primaryColor,
						secondaryColor: agencies.secondaryColor,
						accentColor: agencies.accentColor,
						role: agencyMemberships.role
					})
					.from(agencyMemberships)
					.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
					.where(
						and(
							eq(agencyMemberships.userId, userId),
							eq(agencyMemberships.agencyId, agencyId),
							eq(agencyMemberships.status, 'active'),
							eq(agencies.status, 'active')
						)
					)
					.limit(1);

				if (result) {
					currentAgency = {
						id: result.agencyId,
						name: result.agencyName,
						slug: result.agencySlug,
						logoUrl: result.logoUrl,
						primaryColor: result.primaryColor,
						secondaryColor: result.secondaryColor,
						accentColor: result.accentColor
					};
					userRole = result.role as 'owner' | 'admin' | 'member';

					// Load form options for this agency
					const options = await db
						.select({
							category: agencyFormOptions.category,
							value: agencyFormOptions.value,
							label: agencyFormOptions.label,
							isDefault: agencyFormOptions.isDefault,
							sortOrder: agencyFormOptions.sortOrder,
							metadata: agencyFormOptions.metadata
						})
						.from(agencyFormOptions)
						.where(
							and(
								eq(agencyFormOptions.agencyId, agencyId),
								eq(agencyFormOptions.isActive, true)
							)
						)
						.orderBy(asc(agencyFormOptions.category), asc(agencyFormOptions.sortOrder));

					// Group by category and merge with defaults
					const grouped = groupOptionsByCategory(
						options.map((opt) => ({
							...opt,
							metadata: opt.metadata as Record<string, unknown>
						}))
					);
					agencyConfig = mergeWithDefaults(grouped);
				}
			}
		} catch (error) {
			// Log error but don't fail the page load
			console.error('Error loading agency context:', error);
		}
	}

	return {
		access: locals.user?.access ?? 0,
		subscription_active: locals.user?.subscription_active ?? false,
		agencyConfig,
		currentAgency,
		userRole
	};
};
