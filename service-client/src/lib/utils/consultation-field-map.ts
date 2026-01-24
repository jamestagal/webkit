/**
 * Consultation Field Mapping
 *
 * Maps DynamicForm field names to consultation table columns.
 * Fields not in this map go to customData JSONB.
 */

// Known field mappings: form field name → consultation column
const FIELD_MAP: Record<string, string> = {
	// Step 1: Contact & Business
	businessName: "businessName",
	contactPerson: "contactPerson",
	email: "email",
	phone: "phone",
	website: "website",
	socialLinkedin: "socialLinkedin",
	socialFacebook: "socialFacebook",
	socialInstagram: "socialInstagram",
	industry: "industry",
	businessType: "businessType",

	// Step 2: Situation & Challenges
	websiteStatus: "websiteStatus",
	primaryChallenges: "primaryChallenges",
	urgencyLevel: "urgencyLevel",

	// Step 3: Goals & Budget
	primaryGoals: "primaryGoals",
	conversionGoal: "conversionGoal",
	budgetRange: "budgetRange",
	timeline: "timeline",

	// Step 4: Preferences & Notes
	designStyles: "designStyles",
	admiredWebsites: "admiredWebsites",
	consultationNotes: "consultationNotes",
};

// Fields to exclude from mapping entirely (agency-side data, not form input)
const EXCLUDED_FIELDS = ["performanceData"];

export interface MappedConsultationData {
	mapped: Record<string, unknown>;
	custom: Record<string, unknown>;
}

/**
 * Map dynamic form data to consultation table structure.
 * Known fields go to `mapped`, unknown fields go to `custom` (stored as customData JSONB).
 */
export function mapFormDataToConsultation(
	formData: Record<string, unknown>,
): MappedConsultationData {
	const mapped: Record<string, unknown> = {};
	const custom: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(formData)) {
		// Skip excluded fields
		if (EXCLUDED_FIELDS.includes(key)) continue;

		// Skip empty values
		if (value === undefined || value === null || value === "") continue;

		if (FIELD_MAP[key]) {
			// Known field → map to consultation column
			mapped[FIELD_MAP[key]] = value;
		} else {
			// Unknown field → store in customData
			custom[key] = value;
		}
	}

	return { mapped, custom };
}

/**
 * Reverse map: consultation columns → form field names.
 * Used for populating DynamicForm initialData from existing consultation.
 */
export function consultationToFormData(
	consultation: Record<string, unknown>,
	customData?: Record<string, unknown>,
): Record<string, unknown> {
	const formData: Record<string, unknown> = {};

	// Reverse map known columns
	for (const [formField, dbColumn] of Object.entries(FIELD_MAP)) {
		const value = consultation[dbColumn];
		if (value !== undefined && value !== null) {
			formData[formField] = value;
		}
	}

	// Merge in custom data
	if (customData) {
		Object.assign(formData, customData);
	}

	return formData;
}

/**
 * Get list of mapped column names (for partial updates)
 */
export function getMappedColumns(): string[] {
	return Object.values(FIELD_MAP);
}
