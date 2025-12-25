/**
 * Agency Packages Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for agency package operations.
 * Handles CRUD for pricing packages (subscription, lump_sum, hybrid).
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { agencyPackages } from '$lib/server/schema';
import { getAgencyContext, requireAgencyRole } from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import { eq, and, asc } from 'drizzle-orm';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreatePackageSchema = v.object({
	name: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
	slug: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(50))),
	description: v.optional(v.string()),
	pricingModel: v.picklist(['subscription', 'lump_sum', 'hybrid']),
	setupFee: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	monthlyPrice: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	oneTimePrice: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	hostingFee: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	minimumTermMonths: v.optional(v.pipe(v.number(), v.minValue(1))),
	cancellationFeeType: v.optional(v.picklist(['none', 'fixed', 'remaining_balance'])),
	cancellationFeeAmount: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	includedFeatures: v.optional(v.array(v.string())),
	maxPages: v.optional(v.nullable(v.pipe(v.number(), v.minValue(1)))),
	displayOrder: v.optional(v.number()),
	isFeatured: v.optional(v.boolean())
});

const UpdatePackageSchema = v.object({
	packageId: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(100))),
	slug: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(50))),
	description: v.optional(v.string()),
	pricingModel: v.optional(v.picklist(['subscription', 'lump_sum', 'hybrid'])),
	setupFee: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	monthlyPrice: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	oneTimePrice: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	hostingFee: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	minimumTermMonths: v.optional(v.pipe(v.number(), v.minValue(1))),
	cancellationFeeType: v.optional(v.nullable(v.picklist(['none', 'fixed', 'remaining_balance']))),
	cancellationFeeAmount: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/))),
	includedFeatures: v.optional(v.array(v.string())),
	maxPages: v.optional(v.nullable(v.pipe(v.number(), v.minValue(1)))),
	displayOrder: v.optional(v.number()),
	isFeatured: v.optional(v.boolean()),
	isActive: v.optional(v.boolean())
});

const ReorderPackagesSchema = v.array(
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
	const conditions = [eq(agencyPackages.agencyId, agencyId), eq(agencyPackages.slug, slug)];

	const [existing] = await db
		.select({ id: agencyPackages.id })
		.from(agencyPackages)
		.where(and(...conditions))
		.limit(1);

	if (!existing) return true;
	if (excludeId && existing.id === excludeId) return true;
	return false;
}

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all packages for the current agency.
 * Returns only active packages by default.
 */
export const getAgencyPackages = query(async () => {
	const context = await getAgencyContext();

	const packages = await db
		.select()
		.from(agencyPackages)
		.where(eq(agencyPackages.agencyId, context.agencyId))
		.orderBy(asc(agencyPackages.displayOrder), asc(agencyPackages.name));

	return packages;
});

/**
 * Get only active packages (for proposal selection).
 */
export const getActivePackages = query(async () => {
	const context = await getAgencyContext();

	const packages = await db
		.select()
		.from(agencyPackages)
		.where(and(eq(agencyPackages.agencyId, context.agencyId), eq(agencyPackages.isActive, true)))
		.orderBy(asc(agencyPackages.displayOrder), asc(agencyPackages.name));

	return packages;
});

/**
 * Get a single package by ID.
 */
export const getAgencyPackage = query(v.pipe(v.string(), v.uuid()), async (packageId: string) => {
	const context = await getAgencyContext();

	const [pkg] = await db
		.select()
		.from(agencyPackages)
		.where(and(eq(agencyPackages.id, packageId), eq(agencyPackages.agencyId, context.agencyId)))
		.limit(1);

	if (!pkg) {
		throw new Error('Package not found');
	}

	return pkg;
});

/**
 * Get a package by slug.
 */
export const getAgencyPackageBySlug = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug: string) => {
		const context = await getAgencyContext();

		const [pkg] = await db
			.select()
			.from(agencyPackages)
			.where(and(eq(agencyPackages.slug, slug), eq(agencyPackages.agencyId, context.agencyId)))
			.limit(1);

		return pkg || null;
	}
);

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Create a new package (admin/owner only).
 */
export const createAgencyPackage = command(CreatePackageSchema, async (data) => {
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

	// Get max display order
	const [maxOrder] = await db
		.select({ max: agencyPackages.displayOrder })
		.from(agencyPackages)
		.where(eq(agencyPackages.agencyId, context.agencyId))
		.orderBy(asc(agencyPackages.displayOrder))
		.limit(1);

	const displayOrder = data.displayOrder ?? (maxOrder?.max ?? 0) + 1;

	// Create package
	const [pkg] = await db
		.insert(agencyPackages)
		.values({
			agencyId: context.agencyId,
			name: data.name,
			slug,
			description: data.description ?? '',
			pricingModel: data.pricingModel,
			setupFee: data.setupFee ?? '0.00',
			monthlyPrice: data.monthlyPrice ?? '0.00',
			oneTimePrice: data.oneTimePrice ?? '0.00',
			hostingFee: data.hostingFee ?? '0.00',
			minimumTermMonths: data.minimumTermMonths ?? 12,
			cancellationFeeType: data.cancellationFeeType,
			cancellationFeeAmount: data.cancellationFeeAmount ?? '0.00',
			includedFeatures: data.includedFeatures ?? [],
			maxPages: data.maxPages,
			displayOrder,
			isFeatured: data.isFeatured ?? false,
			isActive: true
		})
		.returning();

	// Log activity
	await logActivity('package.created', 'agency_package', pkg?.id, {
		newValues: { name: data.name, slug, pricingModel: data.pricingModel }
	});

	return pkg;
});

/**
 * Update a package (admin/owner only).
 */
export const updateAgencyPackage = command(UpdatePackageSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Verify package belongs to agency
	const [existing] = await db
		.select()
		.from(agencyPackages)
		.where(
			and(eq(agencyPackages.id, data.packageId), eq(agencyPackages.agencyId, context.agencyId))
		)
		.limit(1);

	if (!existing) {
		throw new Error('Package not found');
	}

	// Check slug uniqueness if changing
	if (data.slug && data.slug !== existing.slug) {
		if (!(await isSlugUnique(context.agencyId, data.slug, data.packageId))) {
			throw new Error('Slug already in use');
		}
	}

	// Build update object
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) updates['name'] = data.name;
	if (data.slug !== undefined) updates['slug'] = data.slug;
	if (data.description !== undefined) updates['description'] = data.description;
	if (data.pricingModel !== undefined) updates['pricingModel'] = data.pricingModel;
	if (data.setupFee !== undefined) updates['setupFee'] = data.setupFee;
	if (data.monthlyPrice !== undefined) updates['monthlyPrice'] = data.monthlyPrice;
	if (data.oneTimePrice !== undefined) updates['oneTimePrice'] = data.oneTimePrice;
	if (data.hostingFee !== undefined) updates['hostingFee'] = data.hostingFee;
	if (data.minimumTermMonths !== undefined) updates['minimumTermMonths'] = data.minimumTermMonths;
	if (data.cancellationFeeType !== undefined)
		updates['cancellationFeeType'] = data.cancellationFeeType;
	if (data.cancellationFeeAmount !== undefined)
		updates['cancellationFeeAmount'] = data.cancellationFeeAmount;
	if (data.includedFeatures !== undefined) updates['includedFeatures'] = data.includedFeatures;
	if (data.maxPages !== undefined) updates['maxPages'] = data.maxPages;
	if (data.displayOrder !== undefined) updates['displayOrder'] = data.displayOrder;
	if (data.isFeatured !== undefined) updates['isFeatured'] = data.isFeatured;
	if (data.isActive !== undefined) updates['isActive'] = data.isActive;

	const [pkg] = await db
		.update(agencyPackages)
		.set(updates)
		.where(eq(agencyPackages.id, data.packageId))
		.returning();

	// Log activity
	await logActivity('package.updated', 'agency_package', data.packageId, {
		oldValues: { name: existing.name },
		newValues: updates
	});

	return pkg;
});

/**
 * Delete (deactivate) a package (owner only).
 * Uses soft delete by setting isActive = false.
 */
export const deleteAgencyPackage = command(
	v.pipe(v.string(), v.uuid()),
	async (packageId: string) => {
		const context = await requireAgencyRole(['owner']);

		// Verify package belongs to agency
		const [existing] = await db
			.select()
			.from(agencyPackages)
			.where(
				and(eq(agencyPackages.id, packageId), eq(agencyPackages.agencyId, context.agencyId))
			)
			.limit(1);

		if (!existing) {
			throw new Error('Package not found');
		}

		// Soft delete
		await db
			.update(agencyPackages)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(agencyPackages.id, packageId));

		// Log activity
		await logActivity('package.deleted', 'agency_package', packageId, {
			oldValues: { name: existing.name, isActive: true }
		});
	}
);

/**
 * Reorder packages (admin/owner only).
 */
export const reorderAgencyPackages = command(ReorderPackagesSchema, async (items) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Update each package's display order
	for (const item of items) {
		await db
			.update(agencyPackages)
			.set({ displayOrder: item.displayOrder, updatedAt: new Date() })
			.where(
				and(eq(agencyPackages.id, item.id), eq(agencyPackages.agencyId, context.agencyId))
			);
	}

	// Log activity
	await logActivity('packages.reordered', 'agency_packages', undefined, {
		newValues: { count: items.length }
	});
});

/**
 * Duplicate a package (admin/owner only).
 */
export const duplicateAgencyPackage = command(
	v.pipe(v.string(), v.uuid()),
	async (packageId: string) => {
		const context = await requireAgencyRole(['owner', 'admin']);

		// Get existing package
		const [existing] = await db
			.select()
			.from(agencyPackages)
			.where(
				and(eq(agencyPackages.id, packageId), eq(agencyPackages.agencyId, context.agencyId))
			)
			.limit(1);

		if (!existing) {
			throw new Error('Package not found');
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
			.select({ max: agencyPackages.displayOrder })
			.from(agencyPackages)
			.where(eq(agencyPackages.agencyId, context.agencyId))
			.orderBy(asc(agencyPackages.displayOrder))
			.limit(1);

		// Create duplicate
		const [pkg] = await db
			.insert(agencyPackages)
			.values({
				agencyId: context.agencyId,
				name: newName,
				slug,
				description: existing.description,
				pricingModel: existing.pricingModel,
				setupFee: existing.setupFee,
				monthlyPrice: existing.monthlyPrice,
				oneTimePrice: existing.oneTimePrice,
				hostingFee: existing.hostingFee,
				minimumTermMonths: existing.minimumTermMonths,
				cancellationFeeType: existing.cancellationFeeType,
				cancellationFeeAmount: existing.cancellationFeeAmount,
				includedFeatures: existing.includedFeatures,
				maxPages: existing.maxPages,
				displayOrder: (maxOrder?.max ?? 0) + 1,
				isFeatured: false,
				isActive: true
			})
			.returning();

		// Log activity
		await logActivity('package.duplicated', 'agency_package', pkg?.id, {
			metadata: { sourcePackageId: packageId }
		});

		return pkg;
	}
);

// =============================================================================
// Type Exports
// =============================================================================

export type AgencyPackageList = Awaited<ReturnType<typeof getAgencyPackages>>;
export type AgencyPackageData = Awaited<ReturnType<typeof getAgencyPackage>>;
