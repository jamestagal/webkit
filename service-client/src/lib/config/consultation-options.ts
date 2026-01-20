/**
 * Consultation Form v2 Options
 *
 * All preset options for the 4-step consultation form.
 * Total: 79 options across 10 categories
 *
 * Agencies can customize these via agency_form_options table.
 */

export interface SelectOption {
	value: string;
	label: string;
}

// ============================================
// STEP 1: Contact & Business Options
// ============================================

export const INDUSTRY_OPTIONS: SelectOption[] = [
	{ value: "technology", label: "Technology & Software" },
	{ value: "healthcare", label: "Healthcare & Medical" },
	{ value: "finance", label: "Finance & Banking" },
	{ value: "retail", label: "Retail & E-commerce" },
	{ value: "manufacturing", label: "Manufacturing" },
	{ value: "education", label: "Education" },
	{ value: "real-estate", label: "Real Estate" },
	{ value: "hospitality", label: "Hospitality & Tourism" },
	{ value: "legal", label: "Legal Services" },
	{ value: "marketing", label: "Marketing & Advertising" },
	{ value: "construction", label: "Construction" },
	{ value: "automotive", label: "Automotive" },
	{ value: "food-beverage", label: "Food & Beverage" },
	{ value: "entertainment", label: "Entertainment & Media" },
	{ value: "nonprofit", label: "Non-Profit" },
	{ value: "other", label: "Other" },
];

export const BUSINESS_TYPE_OPTIONS: SelectOption[] = [
	{ value: "startup", label: "Startup (< 2 years)" },
	{ value: "small-business", label: "Small Business (2-10 employees)" },
	{ value: "medium-business", label: "Medium Business (11-50 employees)" },
	{ value: "enterprise", label: "Enterprise (50+ employees)" },
	{ value: "freelancer", label: "Freelancer / Sole Proprietor" },
	{ value: "agency", label: "Agency" },
	{ value: "nonprofit", label: "Non-Profit Organization" },
];

// ============================================
// STEP 2: Situation & Challenges Options
// ============================================

export const WEBSITE_STATUS_OPTIONS: SelectOption[] = [
	{ value: "none", label: "No Current Website" },
	{ value: "refresh", label: "Needs Refresh" },
	{ value: "rebuild", label: "Complete Rebuild" },
];

export const PRIMARY_CHALLENGES_OPTIONS: SelectOption[] = [
	{ value: "lead-generation", label: "Lead Generation" },
	{ value: "conversion-rate", label: "Low Conversion Rates" },
	{ value: "brand-awareness", label: "Brand Awareness" },
	{ value: "customer-retention", label: "Customer Retention" },
	{ value: "competition", label: "Competitive Pressure" },
	{ value: "technology-adoption", label: "Technology Adoption" },
	{ value: "customer-experience", label: "Customer Experience" },
	{ value: "digital-transformation", label: "Digital Transformation" },
	{ value: "outdated-website", label: "Outdated Website" },
	{ value: "poor-mobile", label: "Poor Mobile Experience" },
	{ value: "seo-issues", label: "SEO / Search Visibility" },
	{ value: "no-online-presence", label: "No Online Presence" },
	{ value: "credibility", label: "Lack of Credibility/Trust" },
	{ value: "manual-processes", label: "Too Many Manual Processes" },
	{ value: "other", label: "Other" },
];

export const URGENCY_LEVEL_OPTIONS: SelectOption[] = [
	{ value: "low", label: "Low - Exploratory phase" },
	{ value: "medium", label: "Medium - Planning for next quarter" },
	{ value: "high", label: "High - Need to start within weeks" },
	{ value: "critical", label: "Critical - Urgent need" },
];

// Urgency level colors for UI
export const URGENCY_COLORS: Record<string, string> = {
	low: "badge-success",
	medium: "badge-warning",
	high: "badge-error",
	critical: "badge-error bg-red-700",
};

// ============================================
// STEP 3: Goals & Budget Options
// ============================================

export const PRIMARY_GOALS_OPTIONS: SelectOption[] = [
	{ value: "increase-revenue", label: "Increase Revenue" },
	{ value: "generate-leads", label: "Generate More Leads" },
	{ value: "improve-conversion", label: "Improve Conversion Rates" },
	{ value: "build-brand", label: "Build Brand Awareness" },
	{ value: "launch-product", label: "Launch New Product/Service" },
	{ value: "improve-retention", label: "Improve Customer Retention" },
	{ value: "enhance-experience", label: "Enhance Customer Experience" },
	{ value: "digital-presence", label: "Establish Digital Presence" },
	{ value: "competitive-advantage", label: "Gain Competitive Advantage" },
	{ value: "automate-processes", label: "Automate Business Processes" },
	{ value: "credibility", label: "Build Credibility & Trust" },
	{ value: "other", label: "Other" },
];

export const CONVERSION_GOAL_OPTIONS: SelectOption[] = [
	{ value: "phone-calls", label: "Phone Calls" },
	{ value: "form-submissions", label: "Form Submissions" },
	{ value: "email-inquiries", label: "Email Inquiries" },
	{ value: "bookings", label: "Bookings / Appointments" },
	{ value: "purchases", label: "Online Purchases" },
	{ value: "quote-requests", label: "Quote Requests" },
	{ value: "newsletter-signups", label: "Newsletter Signups" },
];

export const BUDGET_RANGE_OPTIONS: SelectOption[] = [
	{ value: "under-2k", label: "Under $2,000" },
	{ value: "2k-5k", label: "$2,000 - $5,000" },
	{ value: "5k-10k", label: "$5,000 - $10,000" },
	{ value: "10k-20k", label: "$10,000 - $20,000" },
	{ value: "20k-plus", label: "$20,000+" },
	{ value: "tbd", label: "To Be Determined" },
];

export const TIMELINE_OPTIONS: SelectOption[] = [
	{ value: "asap", label: "ASAP / Urgent" },
	{ value: "1-3-months", label: "1-3 Months" },
	{ value: "3-6-months", label: "3-6 Months" },
	{ value: "flexible", label: "Flexible / No Rush" },
];

// ============================================
// STEP 4: Preferences & Notes Options
// ============================================

export const DESIGN_STYLE_OPTIONS: SelectOption[] = [
	{ value: "modern-clean", label: "Modern & Clean" },
	{ value: "bold-creative", label: "Bold & Creative" },
	{ value: "corporate-professional", label: "Corporate & Professional" },
	{ value: "minimalist", label: "Minimalist" },
	{ value: "traditional-classic", label: "Traditional & Classic" },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get label for a value from an options array
 */
export function getOptionLabel(options: SelectOption[], value: string): string {
	return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Get labels for multiple values
 */
export function getOptionLabels(options: SelectOption[], values: string[]): string[] {
	return values.map((v) => getOptionLabel(options, v));
}

// ============================================
// Summary: Total 79 options
// ============================================
// Industry: 16
// Business Type: 7
// Website Status: 3
// Primary Challenges: 15
// Urgency Level: 4
// Primary Goals: 12
// Conversion Goal: 7
// Budget Range: 6
// Timeline: 4
// Design Styles: 5
// Total: 79
