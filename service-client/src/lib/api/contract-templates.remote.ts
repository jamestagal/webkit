/**
 * Contract Templates Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for contract template operations.
 * Handles CRUD for contract templates and their schedules (package-specific terms).
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import {
	contractTemplates,
	contractSchedules,
	agencyPackages,
	type CoverPageConfig,
	type SignatureConfig
} from '$lib/server/schema';
import { getAgencyContext } from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import { hasPermission } from '$lib/server/permissions';
import { eq, and, desc, asc } from 'drizzle-orm';

// =============================================================================
// Validation Schemas
// =============================================================================

const CoverPageConfigSchema = v.object({
	showLogo: v.optional(v.boolean()),
	showAgencyAddress: v.optional(v.boolean()),
	showClientAddress: v.optional(v.boolean()),
	customFields: v.optional(
		v.array(
			v.object({
				label: v.string(),
				mergeField: v.string()
			})
		)
	)
});

const SignatureConfigSchema = v.object({
	agencySignatory: v.optional(v.string()),
	agencyTitle: v.optional(v.string()),
	requireClientTitle: v.optional(v.boolean()),
	requireWitness: v.optional(v.boolean())
});

const CreateTemplateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	description: v.optional(v.string()),
	coverPageConfig: v.optional(CoverPageConfigSchema),
	termsContent: v.optional(v.string()),
	signatureConfig: v.optional(SignatureConfigSchema),
	isDefault: v.optional(v.boolean())
});

const UpdateTemplateSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	description: v.optional(v.string()),
	coverPageConfig: v.optional(CoverPageConfigSchema),
	termsContent: v.optional(v.string()),
	signatureConfig: v.optional(SignatureConfigSchema),
	isDefault: v.optional(v.boolean()),
	isActive: v.optional(v.boolean())
});

const CreateScheduleSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	packageId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	content: v.optional(v.string()),
	displayOrder: v.optional(v.number())
});

const UpdateScheduleSchema = v.object({
	scheduleId: v.pipe(v.string(), v.uuid()),
	packageId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	content: v.optional(v.string()),
	displayOrder: v.optional(v.number()),
	isActive: v.optional(v.boolean())
});

const ReorderSchedulesSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	scheduleIds: v.array(v.pipe(v.string(), v.uuid()))
});

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all contract templates for the current agency.
 */
export const getContractTemplates = query(
	v.optional(
		v.object({
			activeOnly: v.optional(v.boolean()),
			limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
			offset: v.optional(v.pipe(v.number(), v.minValue(0)))
		})
	),
	async (filters) => {
		const context = await getAgencyContext();
		const { activeOnly = true, limit = 50, offset = 0 } = filters || {};

		// Check permission
		if (!hasPermission(context.role, 'contract_template:view')) {
			throw new Error('Permission denied');
		}

		// Build conditions
		const conditions = [eq(contractTemplates.agencyId, context.agencyId)];
		if (activeOnly) {
			conditions.push(eq(contractTemplates.isActive, true));
		}

		const results = await db
			.select()
			.from(contractTemplates)
			.where(and(...conditions))
			.orderBy(desc(contractTemplates.isDefault), desc(contractTemplates.createdAt))
			.limit(limit)
			.offset(offset);

		return results;
	}
);

/**
 * Get a single contract template by ID with its schedules.
 */
export const getContractTemplate = query(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		// Check permission
		if (!hasPermission(context.role, 'contract_template:view')) {
			throw new Error('Permission denied');
		}

		const [template] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, templateId),
					eq(contractTemplates.agencyId, context.agencyId)
				)
			)
			.limit(1);

		if (!template) {
			throw new Error('Template not found');
		}

		// Fetch schedules for this template
		const schedules = await db
			.select()
			.from(contractSchedules)
			.where(eq(contractSchedules.templateId, templateId))
			.orderBy(asc(contractSchedules.displayOrder));

		// Fetch linked packages for schedule context
		const packageIds = schedules
			.map((s) => s.packageId)
			.filter((id): id is string => id !== null);

		let packages: (typeof agencyPackages.$inferSelect)[] = [];
		if (packageIds.length > 0) {
			packages = await db
				.select()
				.from(agencyPackages)
				.where(eq(agencyPackages.agencyId, context.agencyId));
		}

		// Map package names to schedules
		const schedulesWithPackages = schedules.map((schedule) => ({
			...schedule,
			package: packages.find((p) => p.id === schedule.packageId) || null
		}));

		return {
			template,
			schedules: schedulesWithPackages
		};
	}
);

/**
 * Get schedules for a template.
 */
export const getContractSchedules = query(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		// Check permission
		if (!hasPermission(context.role, 'contract_template:view')) {
			throw new Error('Permission denied');
		}

		// Verify template belongs to agency
		const [template] = await db
			.select({ id: contractTemplates.id })
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, templateId),
					eq(contractTemplates.agencyId, context.agencyId)
				)
			)
			.limit(1);

		if (!template) {
			throw new Error('Template not found');
		}

		const schedules = await db
			.select()
			.from(contractSchedules)
			.where(eq(contractSchedules.templateId, templateId))
			.orderBy(asc(contractSchedules.displayOrder));

		return schedules;
	}
);

/**
 * Get the default template for an agency.
 */
export const getDefaultTemplate = query(v.undefined(), async () => {
	const context = await getAgencyContext();

	const [template] = await db
		.select()
		.from(contractTemplates)
		.where(
			and(
				eq(contractTemplates.agencyId, context.agencyId),
				eq(contractTemplates.isDefault, true),
				eq(contractTemplates.isActive, true)
			)
		)
		.limit(1);

	return template || null;
});

// =============================================================================
// Command Functions (Mutations) - Templates
// =============================================================================

/**
 * Create a new contract template.
 */
export const createContractTemplate = command(CreateTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	// Check permission
	if (!hasPermission(context.role, 'contract_template:create')) {
		throw new Error('Permission denied');
	}

	// If setting as default, unset other defaults
	if (data.isDefault) {
		await db
			.update(contractTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(contractTemplates.agencyId, context.agencyId),
					eq(contractTemplates.isDefault, true)
				)
			);
	}

	const [template] = await db
		.insert(contractTemplates)
		.values({
			agencyId: context.agencyId,
			name: data.name,
			description: data.description || '',
			coverPageConfig: (data.coverPageConfig || {}) as CoverPageConfig,
			termsContent: data.termsContent || '',
			signatureConfig: (data.signatureConfig || {}) as SignatureConfig,
			isDefault: data.isDefault || false,
			createdBy: context.userId
		})
		.returning();

	// Log activity
	await logActivity('contract_template.created', 'contract_template', template?.id, {
		newValues: { name: data.name }
	});

	return template;
});

/**
 * Update a contract template.
 */
export const updateContractTemplate = command(UpdateTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	// Check permission
	if (!hasPermission(context.role, 'contract_template:edit')) {
		throw new Error('Permission denied');
	}

	// Verify template exists and belongs to agency
	const [existing] = await db
		.select()
		.from(contractTemplates)
		.where(
			and(
				eq(contractTemplates.id, data.templateId),
				eq(contractTemplates.agencyId, context.agencyId)
			)
		)
		.limit(1);

	if (!existing) {
		throw new Error('Template not found');
	}

	// If setting as default, unset other defaults
	if (data.isDefault === true) {
		await db
			.update(contractTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(contractTemplates.agencyId, context.agencyId),
					eq(contractTemplates.isDefault, true)
				)
			);
	}

	// Build update object
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) updates['name'] = data.name;
	if (data.description !== undefined) updates['description'] = data.description;
	if (data.coverPageConfig !== undefined) updates['coverPageConfig'] = data.coverPageConfig;
	if (data.termsContent !== undefined) updates['termsContent'] = data.termsContent;
	if (data.signatureConfig !== undefined) updates['signatureConfig'] = data.signatureConfig;
	if (data.isDefault !== undefined) updates['isDefault'] = data.isDefault;
	if (data.isActive !== undefined) updates['isActive'] = data.isActive;

	const [template] = await db
		.update(contractTemplates)
		.set(updates)
		.where(eq(contractTemplates.id, data.templateId))
		.returning();

	// Log activity
	await logActivity('contract_template.updated', 'contract_template', data.templateId, {
		oldValues: { name: existing.name },
		newValues: updates
	});

	return template;
});

/**
 * Delete a contract template.
 */
export const deleteContractTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		// Check permission (only owner can delete)
		if (!hasPermission(context.role, 'contract_template:delete')) {
			throw new Error('Permission denied');
		}

		// Verify template exists and belongs to agency
		const [existing] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, templateId),
					eq(contractTemplates.agencyId, context.agencyId)
				)
			)
			.limit(1);

		if (!existing) {
			throw new Error('Template not found');
		}

		// Soft delete - mark as inactive
		await db
			.update(contractTemplates)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(contractTemplates.id, templateId));

		// Log activity
		await logActivity('contract_template.deleted', 'contract_template', templateId, {
			oldValues: { name: existing.name }
		});
	}
);

/**
 * Duplicate a contract template.
 */
export const duplicateContractTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		// Check permission
		if (!hasPermission(context.role, 'contract_template:create')) {
			throw new Error('Permission denied');
		}

		// Get existing template with schedules
		const [existing] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, templateId),
					eq(contractTemplates.agencyId, context.agencyId)
				)
			)
			.limit(1);

		if (!existing) {
			throw new Error('Template not found');
		}

		// Create duplicate template
		const [newTemplate] = await db
			.insert(contractTemplates)
			.values({
				agencyId: context.agencyId,
				name: `${existing.name} (Copy)`,
				description: existing.description,
				coverPageConfig: existing.coverPageConfig as CoverPageConfig,
				termsContent: existing.termsContent,
				signatureConfig: existing.signatureConfig as SignatureConfig,
				isDefault: false, // Never copy as default
				createdBy: context.userId
			})
			.returning();

		if (!newTemplate) {
			throw new Error('Failed to create template');
		}

		// Copy schedules
		const existingSchedules = await db
			.select()
			.from(contractSchedules)
			.where(eq(contractSchedules.templateId, templateId));

		for (const schedule of existingSchedules) {
			await db.insert(contractSchedules).values({
				templateId: newTemplate.id,
				packageId: schedule.packageId,
				name: schedule.name,
				content: schedule.content,
				displayOrder: schedule.displayOrder,
				isActive: schedule.isActive
			});
		}

		// Log activity
		await logActivity('contract_template.duplicated', 'contract_template', newTemplate.id, {
			metadata: { sourceTemplateId: templateId }
		});

		return newTemplate;
	}
);

/**
 * Set a template as the default.
 */
export const setDefaultTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		// Check permission
		if (!hasPermission(context.role, 'contract_template:edit')) {
			throw new Error('Permission denied');
		}

		// Verify template exists and belongs to agency
		const [template] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, templateId),
					eq(contractTemplates.agencyId, context.agencyId)
				)
			)
			.limit(1);

		if (!template) {
			throw new Error('Template not found');
		}

		// Unset all other defaults
		await db
			.update(contractTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(contractTemplates.agencyId, context.agencyId),
					eq(contractTemplates.isDefault, true)
				)
			);

		// Set new default
		await db
			.update(contractTemplates)
			.set({ isDefault: true, updatedAt: new Date() })
			.where(eq(contractTemplates.id, templateId));

		// Log activity
		await logActivity('contract_template.set_default', 'contract_template', templateId, {
			newValues: { isDefault: true }
		});

		return template;
	}
);

// =============================================================================
// Command Functions (Mutations) - Schedules
// =============================================================================

/**
 * Create a new contract schedule.
 */
export const createContractSchedule = command(CreateScheduleSchema, async (data) => {
	const context = await getAgencyContext();

	// Check permission
	if (!hasPermission(context.role, 'contract_template:edit')) {
		throw new Error('Permission denied');
	}

	// Verify template belongs to agency
	const [template] = await db
		.select({ id: contractTemplates.id })
		.from(contractTemplates)
		.where(
			and(
				eq(contractTemplates.id, data.templateId),
				eq(contractTemplates.agencyId, context.agencyId)
			)
		)
		.limit(1);

	if (!template) {
		throw new Error('Template not found');
	}

	// Get next display order if not provided
	let displayOrder = data.displayOrder;
	if (displayOrder === undefined) {
		const [lastSchedule] = await db
			.select({ displayOrder: contractSchedules.displayOrder })
			.from(contractSchedules)
			.where(eq(contractSchedules.templateId, data.templateId))
			.orderBy(desc(contractSchedules.displayOrder))
			.limit(1);
		displayOrder = (lastSchedule?.displayOrder ?? -1) + 1;
	}

	const [schedule] = await db
		.insert(contractSchedules)
		.values({
			templateId: data.templateId,
			packageId: data.packageId,
			name: data.name,
			content: data.content || '',
			displayOrder
		})
		.returning();

	// Log activity
	await logActivity('contract_schedule.created', 'contract_schedule', schedule?.id, {
		newValues: { name: data.name, templateId: data.templateId }
	});

	return schedule;
});

/**
 * Update a contract schedule.
 */
export const updateContractSchedule = command(UpdateScheduleSchema, async (data) => {
	const context = await getAgencyContext();

	// Check permission
	if (!hasPermission(context.role, 'contract_template:edit')) {
		throw new Error('Permission denied');
	}

	// Verify schedule exists and belongs to agency's template
	const [existing] = await db
		.select({
			schedule: contractSchedules,
			agencyId: contractTemplates.agencyId
		})
		.from(contractSchedules)
		.innerJoin(contractTemplates, eq(contractSchedules.templateId, contractTemplates.id))
		.where(eq(contractSchedules.id, data.scheduleId))
		.limit(1);

	if (!existing || existing.agencyId !== context.agencyId) {
		throw new Error('Schedule not found');
	}

	// Build update object
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.packageId !== undefined) updates['packageId'] = data.packageId;
	if (data.name !== undefined) updates['name'] = data.name;
	if (data.content !== undefined) updates['content'] = data.content;
	if (data.displayOrder !== undefined) updates['displayOrder'] = data.displayOrder;
	if (data.isActive !== undefined) updates['isActive'] = data.isActive;

	const [schedule] = await db
		.update(contractSchedules)
		.set(updates)
		.where(eq(contractSchedules.id, data.scheduleId))
		.returning();

	// Log activity
	await logActivity('contract_schedule.updated', 'contract_schedule', data.scheduleId, {
		oldValues: { name: existing.schedule.name },
		newValues: updates
	});

	return schedule;
});

/**
 * Delete a contract schedule.
 */
export const deleteContractSchedule = command(
	v.pipe(v.string(), v.uuid()),
	async (scheduleId: string) => {
		const context = await getAgencyContext();

		// Check permission
		if (!hasPermission(context.role, 'contract_template:edit')) {
			throw new Error('Permission denied');
		}

		// Verify schedule exists and belongs to agency's template
		const [existing] = await db
			.select({
				schedule: contractSchedules,
				agencyId: contractTemplates.agencyId
			})
			.from(contractSchedules)
			.innerJoin(contractTemplates, eq(contractSchedules.templateId, contractTemplates.id))
			.where(eq(contractSchedules.id, scheduleId))
			.limit(1);

		if (!existing || existing.agencyId !== context.agencyId) {
			throw new Error('Schedule not found');
		}

		// Hard delete (schedules are not critical historical data)
		await db.delete(contractSchedules).where(eq(contractSchedules.id, scheduleId));

		// Log activity
		await logActivity('contract_schedule.deleted', 'contract_schedule', scheduleId, {
			oldValues: { name: existing.schedule.name }
		});
	}
);

/**
 * Reorder schedules within a template.
 */
export const reorderSchedules = command(ReorderSchedulesSchema, async (data) => {
	const context = await getAgencyContext();

	// Check permission
	if (!hasPermission(context.role, 'contract_template:edit')) {
		throw new Error('Permission denied');
	}

	// Verify template belongs to agency
	const [template] = await db
		.select({ id: contractTemplates.id })
		.from(contractTemplates)
		.where(
			and(
				eq(contractTemplates.id, data.templateId),
				eq(contractTemplates.agencyId, context.agencyId)
			)
		)
		.limit(1);

	if (!template) {
		throw new Error('Template not found');
	}

	// Update display order for each schedule
	for (let i = 0; i < data.scheduleIds.length; i++) {
		const scheduleId = data.scheduleIds[i];
		if (scheduleId) {
			await db
				.update(contractSchedules)
				.set({ displayOrder: i, updatedAt: new Date() })
				.where(
					and(
						eq(contractSchedules.id, scheduleId),
						eq(contractSchedules.templateId, data.templateId)
					)
				);
		}
	}

	// Log activity
	await logActivity('contract_schedule.reordered', 'contract_template', data.templateId, {
		metadata: { scheduleIds: data.scheduleIds }
	});
});

// =============================================================================
// Type Exports
// =============================================================================

export type ContractTemplateList = Awaited<ReturnType<typeof getContractTemplates>>;
export type ContractTemplateWithSchedules = Awaited<ReturnType<typeof getContractTemplate>>;
export type ContractScheduleList = Awaited<ReturnType<typeof getContractSchedules>>;
