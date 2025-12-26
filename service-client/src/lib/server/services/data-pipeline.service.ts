/**
 * Data Pipeline Service
 *
 * Provides merge field resolution for auto-populating documents
 * (proposals, contracts, invoices) from various data sources.
 *
 * Merge Field Syntax: {{source.field_name}}
 * - {{agency.business_name}} - Agency profile data
 * - {{client.email}} - Consultation contact info
 * - {{client.goals}} - Array rendered as comma-separated list
 * - {{proposal.total}} - Currency formatted
 * - {{computed.full_address}} - Derived/calculated field
 */

import type {
	Agency,
	AgencyProfile,
	Consultation,
	ContactInfo,
	BusinessContext,
	PainPoints,
	GoalsObjectives
} from '$lib/server/schema';

// =============================================================================
// Type Definitions
// =============================================================================

export interface AgencyMergeFields {
	// Core identity
	business_name: string;
	trading_name: string;
	legal_entity_name: string;
	abn: string;
	acn: string;

	// Contact
	email: string;
	phone: string;
	website: string;
	logo_url: string;

	// Address
	address_line1: string;
	address_line2: string;
	city: string;
	state: string;
	postcode: string;
	country: string;
	full_address: string; // Formatted complete address

	// Banking
	bank_name: string;
	bank_bsb: string;
	bank_account_number: string;
	bank_account_name: string;

	// Tax
	gst_registered: boolean;
	gst_rate: string;

	// Branding
	primary_color: string;
	secondary_color: string;
	accent_color: string;
	tagline: string;

	// Socials
	social_linkedin: string;
	social_facebook: string;
	social_instagram: string;
	social_twitter: string;
}

export interface ClientMergeFields {
	// Contact
	business_name: string;
	contact_person: string;
	email: string;
	phone: string;
	website: string;

	// Business context
	industry: string;
	business_type: string;
	team_size: number | string;
	current_platform: string;
	digital_presence: string; // Comma-separated
	digital_presence_list: string[];
	marketing_channels: string; // Comma-separated
	marketing_channels_list: string[];

	// Pain points
	primary_challenges: string; // Comma-separated
	primary_challenges_list: string[];
	technical_issues: string;
	technical_issues_list: string[];
	urgency_level: string;
	impact_assessment: string;
	solution_gaps: string;
	solution_gaps_list: string[];

	// Goals
	primary_goals: string; // Comma-separated
	primary_goals_list: string[];
	secondary_goals: string;
	secondary_goals_list: string[];
	success_metrics: string;
	success_metrics_list: string[];
	kpis: string;
	kpis_list: string[];
	budget_range: string;
	budget_constraints: string;
	budget_constraints_list: string[];

	// Timeline
	timeline_start: string;
	timeline_end: string;
	timeline_milestones: string;
	timeline_milestones_list: string[];
}

export interface ProposalMergeFields {
	number: string; // PROP-2025-0001
	date: string;
	valid_until: string;
	package_name: string;
	package_description: string;
	setup_fee: string;
	monthly_price: string;
	one_time_price: string;
	hosting_fee: string;
	addons: string; // Formatted list
	subtotal: string;
	gst: string;
	total: string;
}

export interface ContractMergeFields {
	number: string; // CON-2025-0001
	date: string;
	minimum_term: string;
	cancellation_terms: string;
	start_date: string;
	end_date: string;
}

export interface InvoiceMergeFields {
	number: string; // INV-2025-0001
	date: string;
	due_date: string;
	payment_terms: string;
	subtotal: string;
	gst: string;
	total: string;
	amount_paid: string;
	amount_due: string;
}

export interface ComputedMergeFields {
	current_date: string;
	current_year: string;
	project_duration: string;
	total_contract_value: string;
}

export interface MergeFieldData {
	agency?: AgencyMergeFields;
	client?: ClientMergeFields;
	proposal?: ProposalMergeFields;
	contract?: ContractMergeFields;
	invoice?: InvoiceMergeFields;
	computed?: ComputedMergeFields;
}

// =============================================================================
// Data Pipeline Service Class
// =============================================================================

export class DataPipelineService {
	// =========================================================================
	// Merge Field Builders
	// =========================================================================

	/**
	 * Build agency merge fields from agency + profile data.
	 */
	buildAgencyMergeFields(agency: Agency, profile: AgencyProfile | null): AgencyMergeFields {
		// Build full address
		const addressParts = [
			profile?.addressLine1,
			profile?.addressLine2,
			profile?.city,
			profile?.state,
			profile?.postcode,
			profile?.country
		].filter(Boolean);
		const fullAddress = addressParts.join(', ');

		return {
			// Core identity
			business_name: agency.name,
			trading_name: profile?.tradingName || agency.name,
			legal_entity_name: profile?.legalEntityName || agency.name,
			abn: profile?.abn || '',
			acn: profile?.acn || '',

			// Contact
			email: agency.email,
			phone: agency.phone,
			website: agency.website,
			logo_url: agency.logoUrl,

			// Address
			address_line1: profile?.addressLine1 || '',
			address_line2: profile?.addressLine2 || '',
			city: profile?.city || '',
			state: profile?.state || '',
			postcode: profile?.postcode || '',
			country: profile?.country || 'Australia',
			full_address: fullAddress,

			// Banking
			bank_name: profile?.bankName || '',
			bank_bsb: profile?.bsb || '',
			bank_account_number: profile?.accountNumber || '',
			bank_account_name: profile?.accountName || '',

			// Tax
			gst_registered: profile?.gstRegistered ?? true,
			gst_rate: profile?.gstRate || '10.00',

			// Branding
			primary_color: agency.primaryColor,
			secondary_color: agency.secondaryColor,
			accent_color: agency.accentColor,
			tagline: profile?.tagline || '',

			// Socials
			social_linkedin: profile?.socialLinkedin || '',
			social_facebook: profile?.socialFacebook || '',
			social_instagram: profile?.socialInstagram || '',
			social_twitter: profile?.socialTwitter || ''
		};
	}

	/**
	 * Build client merge fields from consultation data.
	 */
	buildClientMergeFields(consultation: Consultation): ClientMergeFields {
		const contact = (consultation.contactInfo as ContactInfo) || {};
		const business = (consultation.businessContext as BusinessContext) || {};
		const pain = (consultation.painPoints as PainPoints) || {};
		const goals = (consultation.goalsObjectives as GoalsObjectives) || {};

		return {
			// Contact
			business_name: contact.business_name || '',
			contact_person: contact.contact_person || '',
			email: contact.email || '',
			phone: contact.phone || '',
			website: contact.website || '',

			// Business context
			industry: business.industry || '',
			business_type: business.business_type || '',
			team_size: business.team_size || '',
			current_platform: business.current_platform || '',
			digital_presence: this.formatAsCommaSeparated(business.digital_presence || []),
			digital_presence_list: business.digital_presence || [],
			marketing_channels: this.formatAsCommaSeparated(business.marketing_channels || []),
			marketing_channels_list: business.marketing_channels || [],

			// Pain points
			primary_challenges: this.formatAsCommaSeparated(pain.primary_challenges || []),
			primary_challenges_list: pain.primary_challenges || [],
			technical_issues: this.formatAsCommaSeparated(pain.technical_issues || []),
			technical_issues_list: pain.technical_issues || [],
			urgency_level: pain.urgency_level || '',
			impact_assessment: pain.impact_assessment || '',
			solution_gaps: this.formatAsCommaSeparated(pain.current_solution_gaps || []),
			solution_gaps_list: pain.current_solution_gaps || [],

			// Goals
			primary_goals: this.formatAsCommaSeparated(goals.primary_goals || []),
			primary_goals_list: goals.primary_goals || [],
			secondary_goals: this.formatAsCommaSeparated(goals.secondary_goals || []),
			secondary_goals_list: goals.secondary_goals || [],
			success_metrics: this.formatAsCommaSeparated(goals.success_metrics || []),
			success_metrics_list: goals.success_metrics || [],
			kpis: this.formatAsCommaSeparated(goals.kpis || []),
			kpis_list: goals.kpis || [],
			budget_range: goals.budget_range || '',
			budget_constraints: this.formatAsCommaSeparated(goals.budget_constraints || []),
			budget_constraints_list: goals.budget_constraints || [],

			// Timeline
			timeline_start: goals.timeline?.desired_start || '',
			timeline_end: goals.timeline?.target_completion || '',
			timeline_milestones: this.formatAsCommaSeparated(goals.timeline?.milestones || []),
			timeline_milestones_list: goals.timeline?.milestones || []
		};
	}

	/**
	 * Build computed merge fields (derived values).
	 */
	buildComputedMergeFields(): ComputedMergeFields {
		const now = new Date();
		return {
			current_date: this.formatDate(now),
			current_year: now.getFullYear().toString(),
			project_duration: '', // Calculated when proposal data is available
			total_contract_value: '' // Calculated when contract data is available
		};
	}

	/**
	 * Build proposal merge fields from proposal data and related package/addons.
	 */
	buildProposalMergeFields(
		proposal: {
			proposalNumber: string;
			title: string;
			createdAt: Date;
			validUntil?: Date | null;
			customPricing?: {
				setupFee?: string;
				monthlyPrice?: string;
				oneTimePrice?: string;
				hostingFee?: string;
				discountPercent?: number;
				discountNote?: string;
			} | null;
		},
		selectedPackage?: {
			name: string;
			description: string;
			setupFee: string;
			monthlyPrice: string;
			oneTimePrice: string;
			hostingFee: string;
		} | null,
		selectedAddons?: { name: string; price: string }[]
	): ProposalMergeFields {
		// Use custom pricing if provided, otherwise fall back to package pricing
		const setupFee = proposal.customPricing?.setupFee ?? selectedPackage?.setupFee ?? '0.00';
		const monthlyPrice =
			proposal.customPricing?.monthlyPrice ?? selectedPackage?.monthlyPrice ?? '0.00';
		const oneTimePrice =
			proposal.customPricing?.oneTimePrice ?? selectedPackage?.oneTimePrice ?? '0.00';
		const hostingFee =
			proposal.customPricing?.hostingFee ?? selectedPackage?.hostingFee ?? '0.00';

		// Calculate addons total
		const addonsTotal =
			selectedAddons?.reduce((sum, addon) => sum + parseFloat(addon.price || '0'), 0) ?? 0;

		// Calculate subtotal (setup + one-time + addons)
		const subtotal =
			parseFloat(setupFee) + parseFloat(oneTimePrice) + addonsTotal;

		// Apply discount if present
		const discountPercent = proposal.customPricing?.discountPercent ?? 0;
		const discountedSubtotal = subtotal * (1 - discountPercent / 100);

		// Calculate GST (default 10%)
		const gst = this.calculateGST(discountedSubtotal);
		const total = discountedSubtotal + gst;

		return {
			number: proposal.proposalNumber,
			date: this.formatDate(proposal.createdAt),
			valid_until: proposal.validUntil ? this.formatDate(proposal.validUntil) : '',
			package_name: selectedPackage?.name ?? '',
			package_description: selectedPackage?.description ?? '',
			setup_fee: this.formatCurrency(parseFloat(setupFee)),
			monthly_price: this.formatCurrency(parseFloat(monthlyPrice)),
			one_time_price: this.formatCurrency(parseFloat(oneTimePrice)),
			hosting_fee: this.formatCurrency(parseFloat(hostingFee)),
			addons: selectedAddons?.map((a) => a.name).join(', ') ?? '',
			subtotal: this.formatCurrency(discountedSubtotal),
			gst: this.formatCurrency(gst),
			total: this.formatCurrency(total)
		};
	}

	// =========================================================================
	// Merge Field Resolution
	// =========================================================================

	/**
	 * Resolve all merge fields in a template string.
	 * Handles nested paths and array formatting.
	 */
	resolveMergeFields(template: string, data: MergeFieldData): string {
		const mergeFieldRegex = /\{\{(\w+)\.([a-zA-Z0-9_.]+)\}\}/g;

		return template.replace(mergeFieldRegex, (match, source, fieldPath) => {
			const sourceData = data[source as keyof MergeFieldData];
			if (!sourceData) return match;

			// Handle nested paths (e.g., timeline.desired_start)
			const parts = fieldPath.split('.');
			let value: unknown = sourceData;

			for (const part of parts) {
				if (value && typeof value === 'object' && part in value) {
					value = (value as Record<string, unknown>)[part];
				} else {
					return match; // Field not found, keep original
				}
			}

			// Format based on type
			if (Array.isArray(value)) {
				return this.formatAsCommaSeparated(value as string[]);
			}
			if (value instanceof Date) {
				return this.formatDate(value);
			}
			if (typeof value === 'number') {
				// Check if it looks like a currency field
				if (
					fieldPath.includes('fee') ||
					fieldPath.includes('price') ||
					fieldPath.includes('total') ||
					fieldPath.includes('subtotal') ||
					fieldPath.includes('gst') ||
					fieldPath.includes('amount')
				) {
					return this.formatCurrency(value);
				}
				return value.toString();
			}
			if (typeof value === 'boolean') {
				return value ? 'Yes' : 'No';
			}

			return String(value ?? '');
		});
	}

	/**
	 * Get list of all available merge fields for a source.
	 */
	getAvailableMergeFields(source: keyof MergeFieldData): string[] {
		const fields: Record<keyof MergeFieldData, string[]> = {
			agency: [
				'business_name',
				'trading_name',
				'legal_entity_name',
				'abn',
				'acn',
				'email',
				'phone',
				'website',
				'logo_url',
				'address_line1',
				'address_line2',
				'city',
				'state',
				'postcode',
				'country',
				'full_address',
				'bank_name',
				'bank_bsb',
				'bank_account_number',
				'bank_account_name',
				'gst_registered',
				'gst_rate',
				'primary_color',
				'secondary_color',
				'accent_color',
				'tagline',
				'social_linkedin',
				'social_facebook',
				'social_instagram',
				'social_twitter'
			],
			client: [
				'business_name',
				'contact_person',
				'email',
				'phone',
				'website',
				'industry',
				'business_type',
				'team_size',
				'current_platform',
				'digital_presence',
				'marketing_channels',
				'primary_challenges',
				'technical_issues',
				'urgency_level',
				'impact_assessment',
				'solution_gaps',
				'primary_goals',
				'secondary_goals',
				'success_metrics',
				'kpis',
				'budget_range',
				'budget_constraints',
				'timeline_start',
				'timeline_end',
				'timeline_milestones'
			],
			proposal: [
				'number',
				'date',
				'valid_until',
				'package_name',
				'package_description',
				'setup_fee',
				'monthly_price',
				'one_time_price',
				'hosting_fee',
				'addons',
				'subtotal',
				'gst',
				'total'
			],
			contract: [
				'number',
				'date',
				'minimum_term',
				'cancellation_terms',
				'start_date',
				'end_date'
			],
			invoice: [
				'number',
				'date',
				'due_date',
				'payment_terms',
				'subtotal',
				'gst',
				'total',
				'amount_paid',
				'amount_due'
			],
			computed: ['current_date', 'current_year', 'project_duration', 'total_contract_value']
		};

		return fields[source] || [];
	}

	// =========================================================================
	// Formatting Helpers
	// =========================================================================

	/**
	 * Format a number as Australian currency.
	 */
	formatCurrency(value: number | string): string {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (isNaN(num)) return '$0.00';

		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(num);
	}

	/**
	 * Format a date in Australian format (e.g., "25 Dec 2025").
	 */
	formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		if (isNaN(d.getTime())) return '';

		return d.toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	/**
	 * Format a date as ISO string (YYYY-MM-DD).
	 */
	formatDateISO(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		if (isNaN(d.getTime())) return '';
		return d.toISOString().split('T')[0] || '';
	}

	/**
	 * Format an array as a bullet list.
	 */
	formatAsBulletList(items: string[]): string {
		if (!items || items.length === 0) return '';
		return items.map((item) => `• ${item}`).join('\n');
	}

	/**
	 * Format an array as a comma-separated list.
	 */
	formatAsCommaSeparated(items: string[]): string {
		if (!items || items.length === 0) return '';
		return items.join(', ');
	}

	/**
	 * Format an array as a numbered list.
	 */
	formatAsNumberedList(items: string[]): string {
		if (!items || items.length === 0) return '';
		return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
	}

	// =========================================================================
	// Document Number Generation
	// =========================================================================

	/**
	 * Generate a formatted document number.
	 * Format: PREFIX-YYYY-NNNN (e.g., PROP-2025-0001)
	 */
	generateDocumentNumber(prefix: string, nextNumber: number, year?: number): string {
		const y = year ?? new Date().getFullYear();
		return `${prefix}-${y}-${nextNumber.toString().padStart(4, '0')}`;
	}

	// =========================================================================
	// GST Calculation
	// =========================================================================

	/**
	 * Calculate GST from subtotal.
	 */
	calculateGST(subtotal: number, gstRate: number = 10): number {
		return subtotal * (gstRate / 100);
	}

	/**
	 * Calculate total including GST.
	 */
	calculateTotalWithGST(subtotal: number, gstRate: number = 10): number {
		return subtotal + this.calculateGST(subtotal, gstRate);
	}

	/**
	 * Extract subtotal from GST-inclusive total.
	 */
	extractSubtotalFromTotal(total: number, gstRate: number = 10): number {
		return total / (1 + gstRate / 100);
	}

	// =========================================================================
	// Payment Terms Helpers
	// =========================================================================

	/**
	 * Calculate due date based on payment terms.
	 */
	calculateDueDate(invoiceDate: Date, paymentTerms: string): Date {
		const dueDate = new Date(invoiceDate);

		switch (paymentTerms) {
			case 'DUE_ON_RECEIPT':
				// Same day
				break;
			case 'NET_7':
				dueDate.setDate(dueDate.getDate() + 7);
				break;
			case 'NET_14':
				dueDate.setDate(dueDate.getDate() + 14);
				break;
			case 'NET_30':
				dueDate.setDate(dueDate.getDate() + 30);
				break;
			default:
				dueDate.setDate(dueDate.getDate() + 14); // Default to NET_14
		}

		return dueDate;
	}

	/**
	 * Get human-readable payment terms label.
	 */
	getPaymentTermsLabel(paymentTerms: string): string {
		const labels: Record<string, string> = {
			DUE_ON_RECEIPT: 'Due on Receipt',
			NET_7: 'Net 7 Days',
			NET_14: 'Net 14 Days',
			NET_30: 'Net 30 Days'
		};
		return labels[paymentTerms] || paymentTerms;
	}
}

// =============================================================================
// Singleton Export
// =============================================================================

export const dataPipelineService = new DataPipelineService();
