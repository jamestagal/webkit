/**
 * Quotation Templates Remote Functions
 *
 * CRUD operations for quotation scope templates, terms templates,
 * parent templates, and junction table management.
 * Modelled on contract-templates.remote.ts patterns.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	quotationScopeTemplates,
	quotationTermsTemplates,
	quotationTemplates,
	quotationTemplateSections,
	quotationTemplateTerms,
} from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { logActivity } from "$lib/server/db-helpers";
import { hasPermission } from "$lib/server/permissions";
import { eq, and, desc, asc, count } from "drizzle-orm";

// =============================================================================
// Validation Schemas
// =============================================================================

// -- Scope Templates --

const CreateScopeTemplateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	description: v.optional(v.string()),
	category: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(100)))),
	workItems: v.optional(v.array(v.string())),
	defaultPrice: v.optional(v.nullable(v.string())),
});

const UpdateScopeTemplateSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	description: v.optional(v.string()),
	category: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(100)))),
	workItems: v.optional(v.array(v.string())),
	defaultPrice: v.optional(v.nullable(v.string())),
	sortOrder: v.optional(v.number()),
});

// -- Terms Templates --

const CreateTermsTemplateSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	content: v.pipe(v.string(), v.minLength(1)),
	isDefault: v.optional(v.boolean()),
});

const UpdateTermsTemplateSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	content: v.optional(v.pipe(v.string(), v.minLength(1))),
	isDefault: v.optional(v.boolean()),
	sortOrder: v.optional(v.number()),
});

// -- Parent Templates --

const CreateQuotationTemplateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	description: v.optional(v.string()),
	category: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(100)))),
	defaultValidityDays: v.optional(v.nullable(v.number())),
	isDefault: v.optional(v.boolean()),
});

const UpdateQuotationTemplateSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	description: v.optional(v.string()),
	category: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(100)))),
	defaultValidityDays: v.optional(v.nullable(v.number())),
	isDefault: v.optional(v.boolean()),
});

// -- Junction Tables --

const AddSectionToTemplateSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	scopeTemplateId: v.pipe(v.string(), v.uuid()),
	defaultSectionPrice: v.optional(v.nullable(v.string())),
});

const AddTermsToTemplateSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	termsTemplateId: v.pipe(v.string(), v.uuid()),
});

const ReorderSectionsSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	sectionIds: v.array(v.pipe(v.string(), v.uuid())),
});

const ReorderTermsSchema = v.object({
	templateId: v.pipe(v.string(), v.uuid()),
	termIds: v.array(v.pipe(v.string(), v.uuid())),
});

// =============================================================================
// Helper: Generate slug from name
// =============================================================================

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.slice(0, 100);
}

// =============================================================================
// Scope Template Queries
// =============================================================================

/**
 * Get all scope templates for the current agency.
 */
export const getScopeTemplates = query(
	v.optional(
		v.object({
			activeOnly: v.optional(v.boolean()),
		}),
	),
	async (filters) => {
		const context = await getAgencyContext();
		const { activeOnly = true } = filters || {};

		if (!hasPermission(context.role, "quotation_template:view")) {
			throw new Error("Permission denied");
		}

		const conditions = [eq(quotationScopeTemplates.agencyId, context.agencyId)];
		if (activeOnly) {
			conditions.push(eq(quotationScopeTemplates.isActive, true));
		}

		return db
			.select()
			.from(quotationScopeTemplates)
			.where(and(...conditions))
			.orderBy(asc(quotationScopeTemplates.sortOrder), asc(quotationScopeTemplates.name));
	},
);

/**
 * Get a single scope template by ID.
 */
export const getScopeTemplate = query(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:view")) {
			throw new Error("Permission denied");
		}

		const [template] = await db
			.select()
			.from(quotationScopeTemplates)
			.where(
				and(
					eq(quotationScopeTemplates.id, templateId),
					eq(quotationScopeTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!template) {
			throw new Error("Scope template not found");
		}

		return template;
	},
);

// =============================================================================
// Scope Template Commands
// =============================================================================

/**
 * Create a new scope template.
 */
export const createScopeTemplate = command(CreateScopeTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:create")) {
		throw new Error("Permission denied");
	}

	const slug = generateSlug(data.name);

	// Check for slug collision within agency
	const [existing] = await db
		.select({ id: quotationScopeTemplates.id })
		.from(quotationScopeTemplates)
		.where(
			and(
				eq(quotationScopeTemplates.agencyId, context.agencyId),
				eq(quotationScopeTemplates.slug, slug),
			),
		)
		.limit(1);

	const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

	const [template] = await db
		.insert(quotationScopeTemplates)
		.values({
			agencyId: context.agencyId,
			name: data.name,
			slug: finalSlug,
			description: data.description || "",
			category: data.category || null,
			workItems: data.workItems || [],
			defaultPrice: data.defaultPrice || null,
			createdBy: context.userId,
		})
		.returning();

	await logActivity("quotation_scope_template.created", "quotation_scope_template", template?.id, {
		newValues: { name: data.name },
	});

	return template;
});

/**
 * Update a scope template.
 */
export const updateScopeTemplate = command(UpdateScopeTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:edit")) {
		throw new Error("Permission denied");
	}

	const [existing] = await db
		.select()
		.from(quotationScopeTemplates)
		.where(
			and(
				eq(quotationScopeTemplates.id, data.templateId),
				eq(quotationScopeTemplates.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!existing) {
		throw new Error("Scope template not found");
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) {
		updates["name"] = data.name;
		updates["slug"] = generateSlug(data.name);
	}
	if (data.description !== undefined) updates["description"] = data.description;
	if (data.category !== undefined) updates["category"] = data.category;
	if (data.workItems !== undefined) updates["workItems"] = data.workItems;
	if (data.defaultPrice !== undefined) updates["defaultPrice"] = data.defaultPrice;
	if (data.sortOrder !== undefined) updates["sortOrder"] = data.sortOrder;

	const [template] = await db
		.update(quotationScopeTemplates)
		.set(updates)
		.where(eq(quotationScopeTemplates.id, data.templateId))
		.returning();

	await logActivity("quotation_scope_template.updated", "quotation_scope_template", data.templateId, {
		oldValues: { name: existing.name },
		newValues: updates,
	});

	return template;
});

/**
 * Delete (soft) a scope template.
 */
export const deleteScopeTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:delete")) {
			throw new Error("Permission denied");
		}

		const [existing] = await db
			.select()
			.from(quotationScopeTemplates)
			.where(
				and(
					eq(quotationScopeTemplates.id, templateId),
					eq(quotationScopeTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Scope template not found");
		}

		await db
			.update(quotationScopeTemplates)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(quotationScopeTemplates.id, templateId));

		await logActivity("quotation_scope_template.deleted", "quotation_scope_template", templateId, {
			oldValues: { name: existing.name },
		});
	},
);

// =============================================================================
// Terms Template Queries
// =============================================================================

/**
 * Get all terms templates for the current agency.
 */
export const getTermsTemplates = query(
	v.optional(
		v.object({
			activeOnly: v.optional(v.boolean()),
		}),
	),
	async (filters) => {
		const context = await getAgencyContext();
		const { activeOnly = true } = filters || {};

		if (!hasPermission(context.role, "quotation_template:view")) {
			throw new Error("Permission denied");
		}

		const conditions = [eq(quotationTermsTemplates.agencyId, context.agencyId)];
		if (activeOnly) {
			conditions.push(eq(quotationTermsTemplates.isActive, true));
		}

		return db
			.select()
			.from(quotationTermsTemplates)
			.where(and(...conditions))
			.orderBy(asc(quotationTermsTemplates.sortOrder), asc(quotationTermsTemplates.title));
	},
);

// =============================================================================
// Terms Template Commands
// =============================================================================

/**
 * Create a new terms template.
 */
export const createTermsTemplate = command(CreateTermsTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:create")) {
		throw new Error("Permission denied");
	}

	// If setting as default, unset others
	if (data.isDefault) {
		await db
			.update(quotationTermsTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(quotationTermsTemplates.agencyId, context.agencyId),
					eq(quotationTermsTemplates.isDefault, true),
				),
			);
	}

	const [template] = await db
		.insert(quotationTermsTemplates)
		.values({
			agencyId: context.agencyId,
			title: data.title,
			content: data.content,
			isDefault: data.isDefault || false,
			createdBy: context.userId,
		})
		.returning();

	await logActivity("quotation_terms_template.created", "quotation_terms_template", template?.id, {
		newValues: { title: data.title },
	});

	return template;
});

/**
 * Update a terms template.
 */
export const updateTermsTemplate = command(UpdateTermsTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:edit")) {
		throw new Error("Permission denied");
	}

	const [existing] = await db
		.select()
		.from(quotationTermsTemplates)
		.where(
			and(
				eq(quotationTermsTemplates.id, data.templateId),
				eq(quotationTermsTemplates.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!existing) {
		throw new Error("Terms template not found");
	}

	// If setting as default, unset others
	if (data.isDefault === true) {
		await db
			.update(quotationTermsTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(quotationTermsTemplates.agencyId, context.agencyId),
					eq(quotationTermsTemplates.isDefault, true),
				),
			);
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.title !== undefined) updates["title"] = data.title;
	if (data.content !== undefined) updates["content"] = data.content;
	if (data.isDefault !== undefined) updates["isDefault"] = data.isDefault;
	if (data.sortOrder !== undefined) updates["sortOrder"] = data.sortOrder;

	const [template] = await db
		.update(quotationTermsTemplates)
		.set(updates)
		.where(eq(quotationTermsTemplates.id, data.templateId))
		.returning();

	await logActivity("quotation_terms_template.updated", "quotation_terms_template", data.templateId, {
		oldValues: { title: existing.title },
		newValues: updates,
	});

	return template;
});

/**
 * Delete (soft) a terms template.
 */
export const deleteTermsTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:delete")) {
			throw new Error("Permission denied");
		}

		const [existing] = await db
			.select()
			.from(quotationTermsTemplates)
			.where(
				and(
					eq(quotationTermsTemplates.id, templateId),
					eq(quotationTermsTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Terms template not found");
		}

		await db
			.update(quotationTermsTemplates)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(quotationTermsTemplates.id, templateId));

		await logActivity("quotation_terms_template.deleted", "quotation_terms_template", templateId, {
			oldValues: { title: existing.title },
		});
	},
);

// =============================================================================
// Parent Template Queries
// =============================================================================

/**
 * Get all quotation templates with section/terms counts.
 */
export const getQuotationTemplates = query(
	v.optional(
		v.object({
			activeOnly: v.optional(v.boolean()),
		}),
	),
	async (filters) => {
		const context = await getAgencyContext();
		const { activeOnly = true } = filters || {};

		if (!hasPermission(context.role, "quotation_template:view")) {
			throw new Error("Permission denied");
		}

		const conditions = [eq(quotationTemplates.agencyId, context.agencyId)];
		if (activeOnly) {
			conditions.push(eq(quotationTemplates.isActive, true));
		}

		const templates = await db
			.select()
			.from(quotationTemplates)
			.where(and(...conditions))
			.orderBy(desc(quotationTemplates.isDefault), desc(quotationTemplates.createdAt));

		// Get section and terms counts for each template
		const templateIds = templates.map((t) => t.id);
		if (templateIds.length === 0) return [];

		const sectionCounts = await db
			.select({
				templateId: quotationTemplateSections.templateId,
				count: count(),
			})
			.from(quotationTemplateSections)
			.groupBy(quotationTemplateSections.templateId);

		const termsCounts = await db
			.select({
				templateId: quotationTemplateTerms.templateId,
				count: count(),
			})
			.from(quotationTemplateTerms)
			.groupBy(quotationTemplateTerms.templateId);

		const sectionMap = new Map(sectionCounts.map((s) => [s.templateId, s.count]));
		const termsMap = new Map(termsCounts.map((t) => [t.templateId, t.count]));

		return templates.map((t) => ({
			...t,
			sectionCount: sectionMap.get(t.id) || 0,
			termsCount: termsMap.get(t.id) || 0,
		}));
	},
);

/**
 * Get a single quotation template with linked sections and terms.
 */
export const getQuotationTemplate = query(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:view")) {
			throw new Error("Permission denied");
		}

		const [template] = await db
			.select()
			.from(quotationTemplates)
			.where(
				and(
					eq(quotationTemplates.id, templateId),
					eq(quotationTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!template) {
			throw new Error("Template not found");
		}

		// Get linked scope sections with their scope template details
		const sections = await db
			.select({
				id: quotationTemplateSections.id,
				scopeTemplateId: quotationTemplateSections.scopeTemplateId,
				defaultSectionPrice: quotationTemplateSections.defaultSectionPrice,
				sortOrder: quotationTemplateSections.sortOrder,
				scopeTemplateName: quotationScopeTemplates.name,
				scopeTemplateCategory: quotationScopeTemplates.category,
				scopeTemplateWorkItems: quotationScopeTemplates.workItems,
				scopeTemplateDefaultPrice: quotationScopeTemplates.defaultPrice,
			})
			.from(quotationTemplateSections)
			.innerJoin(
				quotationScopeTemplates,
				eq(quotationTemplateSections.scopeTemplateId, quotationScopeTemplates.id),
			)
			.where(eq(quotationTemplateSections.templateId, templateId))
			.orderBy(asc(quotationTemplateSections.sortOrder));

		// Get linked terms with their terms template details
		const terms = await db
			.select({
				id: quotationTemplateTerms.id,
				termsTemplateId: quotationTemplateTerms.termsTemplateId,
				sortOrder: quotationTemplateTerms.sortOrder,
				termsTemplateTitle: quotationTermsTemplates.title,
				termsTemplateContent: quotationTermsTemplates.content,
			})
			.from(quotationTemplateTerms)
			.innerJoin(
				quotationTermsTemplates,
				eq(quotationTemplateTerms.termsTemplateId, quotationTermsTemplates.id),
			)
			.where(eq(quotationTemplateTerms.templateId, templateId))
			.orderBy(asc(quotationTemplateTerms.sortOrder));

		return { template, sections, terms };
	},
);

// =============================================================================
// Parent Template Commands
// =============================================================================

/**
 * Create a new quotation template.
 */
export const createQuotationTemplate = command(CreateQuotationTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:create")) {
		throw new Error("Permission denied");
	}

	// If setting as default, unset others
	if (data.isDefault) {
		await db
			.update(quotationTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(quotationTemplates.agencyId, context.agencyId),
					eq(quotationTemplates.isDefault, true),
				),
			);
	}

	const [template] = await db
		.insert(quotationTemplates)
		.values({
			agencyId: context.agencyId,
			name: data.name,
			description: data.description || "",
			category: data.category || null,
			defaultValidityDays: data.defaultValidityDays || null,
			isDefault: data.isDefault || false,
			createdBy: context.userId,
		})
		.returning();

	await logActivity("quotation_template.created", "quotation_template", template?.id, {
		newValues: { name: data.name },
	});

	return template;
});

/**
 * Update a quotation template.
 */
export const updateQuotationTemplate = command(UpdateQuotationTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:edit")) {
		throw new Error("Permission denied");
	}

	const [existing] = await db
		.select()
		.from(quotationTemplates)
		.where(
			and(
				eq(quotationTemplates.id, data.templateId),
				eq(quotationTemplates.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!existing) {
		throw new Error("Template not found");
	}

	if (data.isDefault === true) {
		await db
			.update(quotationTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(quotationTemplates.agencyId, context.agencyId),
					eq(quotationTemplates.isDefault, true),
				),
			);
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) updates["name"] = data.name;
	if (data.description !== undefined) updates["description"] = data.description;
	if (data.category !== undefined) updates["category"] = data.category;
	if (data.defaultValidityDays !== undefined) updates["defaultValidityDays"] = data.defaultValidityDays;
	if (data.isDefault !== undefined) updates["isDefault"] = data.isDefault;

	const [template] = await db
		.update(quotationTemplates)
		.set(updates)
		.where(eq(quotationTemplates.id, data.templateId))
		.returning();

	await logActivity("quotation_template.updated", "quotation_template", data.templateId, {
		oldValues: { name: existing.name },
		newValues: updates,
	});

	return template;
});

/**
 * Delete (soft) a quotation template.
 */
export const deleteQuotationTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:delete")) {
			throw new Error("Permission denied");
		}

		const [existing] = await db
			.select()
			.from(quotationTemplates)
			.where(
				and(
					eq(quotationTemplates.id, templateId),
					eq(quotationTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Template not found");
		}

		await db
			.update(quotationTemplates)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(quotationTemplates.id, templateId));

		await logActivity("quotation_template.deleted", "quotation_template", templateId, {
			oldValues: { name: existing.name },
		});
	},
);

/**
 * Duplicate a quotation template with its sections and terms.
 */
export const duplicateQuotationTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:create")) {
			throw new Error("Permission denied");
		}

		const [existing] = await db
			.select()
			.from(quotationTemplates)
			.where(
				and(
					eq(quotationTemplates.id, templateId),
					eq(quotationTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Template not found");
		}

		// Create duplicate
		const [newTemplate] = await db
			.insert(quotationTemplates)
			.values({
				agencyId: context.agencyId,
				name: `${existing.name} (Copy)`,
				description: existing.description,
				category: existing.category,
				defaultValidityDays: existing.defaultValidityDays,
				isDefault: false,
				createdBy: context.userId,
			})
			.returning();

		if (!newTemplate) {
			throw new Error("Failed to duplicate template");
		}

		// Copy sections
		const existingSections = await db
			.select()
			.from(quotationTemplateSections)
			.where(eq(quotationTemplateSections.templateId, templateId));

		for (const section of existingSections) {
			await db.insert(quotationTemplateSections).values({
				templateId: newTemplate.id,
				scopeTemplateId: section.scopeTemplateId,
				defaultSectionPrice: section.defaultSectionPrice,
				sortOrder: section.sortOrder,
			});
		}

		// Copy terms
		const existingTerms = await db
			.select()
			.from(quotationTemplateTerms)
			.where(eq(quotationTemplateTerms.templateId, templateId));

		for (const term of existingTerms) {
			await db.insert(quotationTemplateTerms).values({
				templateId: newTemplate.id,
				termsTemplateId: term.termsTemplateId,
				sortOrder: term.sortOrder,
			});
		}

		await logActivity("quotation_template.duplicated", "quotation_template", newTemplate.id, {
			metadata: { sourceTemplateId: templateId },
		});

		return newTemplate;
	},
);

/**
 * Set a template as the default.
 */
export const setDefaultQuotationTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (templateId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:edit")) {
			throw new Error("Permission denied");
		}

		const [template] = await db
			.select()
			.from(quotationTemplates)
			.where(
				and(
					eq(quotationTemplates.id, templateId),
					eq(quotationTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!template) {
			throw new Error("Template not found");
		}

		// Unset all other defaults
		await db
			.update(quotationTemplates)
			.set({ isDefault: false, updatedAt: new Date() })
			.where(
				and(
					eq(quotationTemplates.agencyId, context.agencyId),
					eq(quotationTemplates.isDefault, true),
				),
			);

		// Set new default
		await db
			.update(quotationTemplates)
			.set({ isDefault: true, updatedAt: new Date() })
			.where(eq(quotationTemplates.id, templateId));

		await logActivity("quotation_template.set_default", "quotation_template", templateId, {
			newValues: { isDefault: true },
		});

		return template;
	},
);

// =============================================================================
// Junction Table Commands - Sections
// =============================================================================

/**
 * Add a scope template section to a parent template.
 */
export const addSectionToTemplate = command(AddSectionToTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:edit")) {
		throw new Error("Permission denied");
	}

	// Verify template belongs to agency
	const [template] = await db
		.select({ id: quotationTemplates.id })
		.from(quotationTemplates)
		.where(
			and(
				eq(quotationTemplates.id, data.templateId),
				eq(quotationTemplates.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!template) {
		throw new Error("Template not found");
	}

	// Get next sort order
	const [lastSection] = await db
		.select({ sortOrder: quotationTemplateSections.sortOrder })
		.from(quotationTemplateSections)
		.where(eq(quotationTemplateSections.templateId, data.templateId))
		.orderBy(desc(quotationTemplateSections.sortOrder))
		.limit(1);

	const sortOrder = (lastSection?.sortOrder ?? -1) + 1;

	const [section] = await db
		.insert(quotationTemplateSections)
		.values({
			templateId: data.templateId,
			scopeTemplateId: data.scopeTemplateId,
			defaultSectionPrice: data.defaultSectionPrice || null,
			sortOrder,
		})
		.returning();

	return section;
});

/**
 * Remove a scope template section from a parent template.
 */
export const removeSectionFromTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (sectionId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:edit")) {
			throw new Error("Permission denied");
		}

		// Verify section belongs to agency's template
		const [existing] = await db
			.select({
				section: quotationTemplateSections,
				agencyId: quotationTemplates.agencyId,
			})
			.from(quotationTemplateSections)
			.innerJoin(quotationTemplates, eq(quotationTemplateSections.templateId, quotationTemplates.id))
			.where(eq(quotationTemplateSections.id, sectionId))
			.limit(1);

		if (!existing || existing.agencyId !== context.agencyId) {
			throw new Error("Section not found");
		}

		await db.delete(quotationTemplateSections).where(eq(quotationTemplateSections.id, sectionId));
	},
);

/**
 * Reorder sections within a template.
 */
export const reorderTemplateSections = command(ReorderSectionsSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:edit")) {
		throw new Error("Permission denied");
	}

	// Verify template belongs to agency
	const [template] = await db
		.select({ id: quotationTemplates.id })
		.from(quotationTemplates)
		.where(
			and(
				eq(quotationTemplates.id, data.templateId),
				eq(quotationTemplates.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!template) {
		throw new Error("Template not found");
	}

	for (let i = 0; i < data.sectionIds.length; i++) {
		const sectionId = data.sectionIds[i];
		if (sectionId) {
			await db
				.update(quotationTemplateSections)
				.set({ sortOrder: i })
				.where(
					and(
						eq(quotationTemplateSections.id, sectionId),
						eq(quotationTemplateSections.templateId, data.templateId),
					),
				);
		}
	}
});

// =============================================================================
// Junction Table Commands - Terms
// =============================================================================

/**
 * Add a terms template to a parent template.
 */
export const addTermsToTemplate = command(AddTermsToTemplateSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:edit")) {
		throw new Error("Permission denied");
	}

	// Verify template belongs to agency
	const [template] = await db
		.select({ id: quotationTemplates.id })
		.from(quotationTemplates)
		.where(
			and(
				eq(quotationTemplates.id, data.templateId),
				eq(quotationTemplates.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!template) {
		throw new Error("Template not found");
	}

	// Get next sort order
	const [lastTerm] = await db
		.select({ sortOrder: quotationTemplateTerms.sortOrder })
		.from(quotationTemplateTerms)
		.where(eq(quotationTemplateTerms.templateId, data.templateId))
		.orderBy(desc(quotationTemplateTerms.sortOrder))
		.limit(1);

	const sortOrder = (lastTerm?.sortOrder ?? -1) + 1;

	const [term] = await db
		.insert(quotationTemplateTerms)
		.values({
			templateId: data.templateId,
			termsTemplateId: data.termsTemplateId,
			sortOrder,
		})
		.returning();

	return term;
});

/**
 * Remove a terms template from a parent template.
 */
export const removeTermsFromTemplate = command(
	v.pipe(v.string(), v.uuid()),
	async (termId: string) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation_template:edit")) {
			throw new Error("Permission denied");
		}

		// Verify term belongs to agency's template
		const [existing] = await db
			.select({
				term: quotationTemplateTerms,
				agencyId: quotationTemplates.agencyId,
			})
			.from(quotationTemplateTerms)
			.innerJoin(quotationTemplates, eq(quotationTemplateTerms.templateId, quotationTemplates.id))
			.where(eq(quotationTemplateTerms.id, termId))
			.limit(1);

		if (!existing || existing.agencyId !== context.agencyId) {
			throw new Error("Term not found");
		}

		await db.delete(quotationTemplateTerms).where(eq(quotationTemplateTerms.id, termId));
	},
);

/**
 * Reorder terms within a template.
 */
export const reorderTemplateTerms = command(ReorderTermsSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation_template:edit")) {
		throw new Error("Permission denied");
	}

	// Verify template belongs to agency
	const [template] = await db
		.select({ id: quotationTemplates.id })
		.from(quotationTemplates)
		.where(
			and(
				eq(quotationTemplates.id, data.templateId),
				eq(quotationTemplates.agencyId, context.agencyId),
			),
		)
		.limit(1);

	if (!template) {
		throw new Error("Template not found");
	}

	for (let i = 0; i < data.termIds.length; i++) {
		const termId = data.termIds[i];
		if (termId) {
			await db
				.update(quotationTemplateTerms)
				.set({ sortOrder: i })
				.where(
					and(
						eq(quotationTemplateTerms.id, termId),
						eq(quotationTemplateTerms.templateId, data.templateId),
					),
				);
		}
	}
});
