/**
 * Agency Add-ons Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for agency add-on operations.
 * Handles CRUD for optional services (one_time, monthly, per_unit pricing).
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { agencyAddons, agencyPackages } from '$lib/server/schema';
import { getAgencyContext, requireAgencyRole } from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import { eq, and, asc } from 'drizzle-orm';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateAddonSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
	slug: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(50))),
	description: v.optional(v.string()),
	price: v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid decimal')),
	pricingType: v.picklist(['one_time', 'monthly', 'per_unit']),
	unitLabel: v.optional(v.pipe(v.string(), v.maxLength(50))),
	availablePackages: v.optional(v.array(v.string())), // Package slugs
	displayOrder: v.optional(v.number())
});

const UpdateAddonSchema = v.object({
	addonId: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(100))),
	slug: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(50))),
	description: v.optional(v.string()),
	price: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	pricingType: v.optional(v.picklist(['one_time', 'monthly', 'per_unit'])),
	unitLabel: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(50)))),
	availablePackages: v.optional(v.array(v.string())),
	displayOrder: v.optional(v.number()),
	isActive: v.optional(v.boolean())
});

const ReorderAddonsSchema = v.array(
	v.object({
		id: v.pipe(v.string(), v.uuid()),
		displayOrder: v.number()
	})
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a URL-friendly slug from a name.
 */
function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50);
}

/**
 * Check if a slug is unique for the agency.
 */
async function isSlugUnique(agencyId: string, slug: string, excludeId?: string): Promise<boolean> {
	const [existing] = await db
		.select({ id: agencyAddons.id })
		.from(agencyAddons)
		.where(and(eq(agencyAddons.agencyId, agencyId), eq(agencyAddons.slug, slug)))
		.limit(1);

	if (!existing) return true;
	if (excludeId && existing.id === excludeId) return true;
	return false;
}

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all add-ons for the current agency.
 */
export const getAgencyAddons = query(async () => {
	const context = await getAgencyContext();

	const addons = await db
		.select()
		.from(agencyAddons)
		.where(eq(agencyAddons.agencyId, context.agencyId))
		.orderBy(asc(agencyAddons.displayOrder), asc(agencyAddons.name));

	return addons;
});

/**
 * Get only active add-ons (for proposal selection).
 */
export const getActiveAddons = query(async () => {
	const context = await getAgencyContext();

	const addons = await db
		.select()
		.from(agencyAddons)
		.where(and(eq(agencyAddons.agencyId, context.agencyId), eq(agencyAddons.isActive, true)))
		.orderBy(asc(agencyAddons.displayOrder), asc(agencyAddons.name));

	return addons;
});

/**
 * Get a single add-on by ID.
 */
export const getAgencyAddon = query(v.pipe(v.string(), v.uuid()), async (addonId: string) => {
	const context = await getAgencyContext();

	const [addon] = await db
		.select()
		.from(agencyAddons)
		.where(and(eq(agencyAddons.id, addonId), eq(agencyAddons.agencyId, context.agencyId)))
		.limit(1);

	if (!addon) {
		throw new Error('Add-on not found');
	}

	return addon;
});

/**
 * Get add-ons available for a specific package.
 * Returns add-ons where availablePackages is empty (all) or includes the package slug.
 */
export const getAddonsForPackage = query(
	v.pipe(v.string(), v.minLength(1)),
	async (packageSlug: string) => {
		const context = await getAgencyContext();

		// Get all active add-ons
		const allAddons = await db
			.select()
			.from(agencyAddons)
			.where(and(eq(agencyAddons.agencyId, context.agencyId), eq(agencyAddons.isActive, true)))
			.orderBy(asc(agencyAddons.displayOrder), asc(agencyAddons.name));

		// Filter by package availability
		return allAddons.filter((addon) => {
			const available = addon.availablePackages as string[];
			// Empty array means available for all packages
			if (!available || available.length === 0) return true;
			return available.includes(packageSlug);
		});
	}
);

/**
 * Get add-on by slug.
 */
export const getAgencyAddonBySlug = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug: string) => {
		const context = await getAgencyContext();

		const [addon] = await db
			.select()
			.from(agencyAddons)
			.where(and(eq(agencyAddons.slug, slug), eq(agencyAddons.agencyId, context.agencyId)))
			.limit(1);

		return addon || null;
	}
);

/**
 * Get add-ons with their available package details.
 */
export const getAddonsWithPackages = query(async () => {
	const context = await getAgencyContext();

	// Get all add-ons
	const addons = await db
		.select()
		.from(agencyAddons)
		.where(eq(agencyAddons.agencyId, context.agencyId))
		.orderBy(asc(agencyAddons.displayOrder), asc(agencyAddons.name));

	// Get all packages for reference
	const packages = await db
		.select({ slug: agencyPackages.slug, name: agencyPackages.name })
		.from(agencyPackages)
		.where(and(eq(agencyPackages.agencyId, context.agencyId), eq(agencyPackages.isActive, true)))
		.orderBy(asc(agencyPackages.displayOrder));

	// Map add-ons with package names
	return addons.map((addon) => {
		const available = addon.availablePackages as string[];
		const packageNames =
			!available || available.length === 0
				? ['All packages']
				: available
						.map((slug) => packages.find((p) => p.slug === slug)?.name)
						.filter(Boolean) as string[];

		return {
			...addon,
			packageNames
		};
	});
});

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Create a new add-on (admin/owner only).
 */
export const createAgencyAddon = command(CreateAddonSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Generate slug if not provided
	let slug = data.slug || generateSlug(data.name);

	// Ensure slug is unique
	let counter = 1;
	const baseSlug = slug;
	while (!(await isSlugUnique(context.agencyId, slug))) {
		slug = `${baseSlug}-${counter}`;
		counter++;
		if (counter > 100) {
			throw new Error('Unable to generate unique slug');
		}
	}

	// Validate availablePackages exist if provided
	if (data.availablePackages && data.availablePackages.length > 0) {
		const packages = await db
			.select({ slug: agencyPackages.slug })
			.from(agencyPackages)
			.where(
				and(eq(agencyPackages.agencyId, context.agencyId), eq(agencyPackages.isActive, true))
			);

		const validSlugs = packages.map((p) => p.slug);
		const invalidSlugs = data.availablePackages.filter((s) => !validSlugs.includes(s));
		if (invalidSlugs.length > 0) {
			throw new Error(`Invalid package slugs: ${invalidSlugs.join(', ')}`);
		}
	}

	// Get max display order
	const [maxOrder] = await db
		.select({ max: agencyAddons.displayOrder })
		.from(agencyAddons)
		.where(eq(agencyAddons.agencyId, context.agencyId))
		.orderBy(asc(agencyAddons.displayOrder))
		.limit(1);

	const displayOrder = data.displayOrder ?? (maxOrder?.max ?? 0) + 1;

	// Create add-on
	const [addon] = await db
		.insert(agencyAddons)
		.values({
			agencyId: context.agencyId,
			name: data.name,
			slug,
			description: data.description ?? '',
			price: data.price,
			pricingType: data.pricingType,
			unitLabel: data.unitLabel,
			availablePackages: data.availablePackages ?? [],
			displayOrder,
			isActive: true
		})
		.returning();

	// Log activity
	await logActivity('addon.created', 'agency_addon', addon?.id, {
		newValues: { name: data.name, slug, price: data.price, pricingType: data.pricingType }
	});

	return addon;
});

/**
 * Update an add-on (admin/owner only).
 */
export const updateAgencyAddon = command(UpdateAddonSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Verify add-on belongs to agency
	const [existing] = await db
		.select()
		.from(agencyAddons)
		.where(and(eq(agencyAddons.id, data.addonId), eq(agencyAddons.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error('Add-on not found');
	}

	// Check slug uniqueness if changing
	if (data.slug && data.slug !== existing.slug) {
		if (!(await isSlugUnique(context.agencyId, data.slug, data.addonId))) {
			throw new Error('Slug already in use');
		}
	}

	// Validate availablePackages if provided
	if (data.availablePackages && data.availablePackages.length > 0) {
		const packages = await db
			.select({ slug: agencyPackages.slug })
			.from(agencyPackages)
			.where(
				and(eq(agencyPackages.agencyId, context.agencyId), eq(agencyPackages.isActive, true))
			);

		const validSlugs = packages.map((p) => p.slug);
		const invalidSlugs = data.availablePackages.filter((s) => !validSlugs.includes(s));
		if (invalidSlugs.length > 0) {
			throw new Error(`Invalid package slugs: ${invalidSlugs.join(', ')}`);
		}
	}

	// Build update object
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) updates['name'] = data.name;
	if (data.slug !== undefined) updates['slug'] = data.slug;
	if (data.description !== undefined) updates['description'] = data.description;
	if (data.price !== undefined) updates['price'] = data.price;
	if (data.pricingType !== undefined) updates['pricingType'] = data.pricingType;
	if (data.unitLabel !== undefined) updates['unitLabel'] = data.unitLabel;
	if (data.availablePackages !== undefined) updates['availablePackages'] = data.availablePackages;
	if (data.displayOrder !== undefined) updates['displayOrder'] = data.displayOrder;
	if (data.isActive !== undefined) updates['isActive'] = data.isActive;

	const [addon] = await db
		.update(agencyAddons)
		.set(updates)
		.where(eq(agencyAddons.id, data.addonId))
		.returning();

	// Log activity
	await logActivity('addon.updated', 'agency_addon', data.addonId, {
		oldValues: { name: existing.name },
		newValues: updates
	});

	return addon;
});

/**
 * Delete (deactivate) an add-on (owner only).
 * Uses soft delete by setting isActive = false.
 */
export const deleteAgencyAddon = command(v.pipe(v.string(), v.uuid()), async (addonId: string) => {
	const context = await requireAgencyRole(['owner']);

	// Verify add-on belongs to agency
	const [existing] = await db
		.select()
		.from(agencyAddons)
		.where(and(eq(agencyAddons.id, addonId), eq(agencyAddons.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error('Add-on not found');
	}

	// Soft delete
	await db
		.update(agencyAddons)
		.set({ isActive: false, updatedAt: new Date() })
		.where(eq(agencyAddons.id, addonId));

	// Log activity
	await logActivity('addon.deleted', 'agency_addon', addonId, {
		oldValues: { name: existing.name, isActive: true }
	});
});

/**
 * Reorder add-ons (admin/owner only).
 */
export const reorderAgencyAddons = command(ReorderAddonsSchema, async (items) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Update each add-on's display order
	for (const item of items) {
		await db
			.update(agencyAddons)
			.set({ displayOrder: item.displayOrder, updatedAt: new Date() })
			.where(and(eq(agencyAddons.id, item.id), eq(agencyAddons.agencyId, context.agencyId)));
	}

	// Log activity
	await logActivity('addons.reordered', 'agency_addons', undefined, {
		newValues: { count: items.length }
	});
});

/**
 * Duplicate an add-on (admin/owner only).
 */
export const duplicateAgencyAddon = command(
	v.pipe(v.string(), v.uuid()),
	async (addonId: string) => {
		const context = await requireAgencyRole(['owner', 'admin']);

		// Get existing add-on
		const [existing] = await db
			.select()
			.from(agencyAddons)
			.where(and(eq(agencyAddons.id, addonId), eq(agencyAddons.agencyId, context.agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error('Add-on not found');
		}

		// Generate new name and slug
		const newName = `${existing.name} (Copy)`;
		let slug = generateSlug(newName);

		let counter = 1;
		const baseSlug = slug;
		while (!(await isSlugUnique(context.agencyId, slug))) {
			slug = `${baseSlug}-${counter}`;
			counter++;
		}

		// Get max display order
		const [maxOrder] = await db
			.select({ max: agencyAddons.displayOrder })
			.from(agencyAddons)
			.where(eq(agencyAddons.agencyId, context.agencyId))
			.orderBy(asc(agencyAddons.displayOrder))
			.limit(1);

		// Create duplicate
		const [addon] = await db
			.insert(agencyAddons)
			.values({
				agencyId: context.agencyId,
				name: newName,
				slug,
				description: existing.description,
				price: existing.price,
				pricingType: existing.pricingType,
				unitLabel: existing.unitLabel,
				availablePackages: existing.availablePackages,
				displayOrder: (maxOrder?.max ?? 0) + 1,
				isActive: true
			})
			.returning();

		// Log activity
		await logActivity('addon.duplicated', 'agency_addon', addon?.id, {
			metadata: { sourceAddonId: addonId }
		});

		return addon;
	}
);

