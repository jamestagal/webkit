import type {
	Consultation,
	ConsultationDraft,
	CreateConsultationInput,
	UpdateConsultationInput,
	ConsultationFormSection,
	ConsultationFormState,
	DraftSavePayload,
	ContactInfo,
	BusinessContext,
	PainPoints,
	GoalsObjectives,
} from "$lib/types/consultation";
import { consultationApiService } from "$lib/services/consultation.service";
import { authService } from "$lib/services/auth";
import { debounce } from "$lib/utils/debounce";

const logger = {
	debug: (msg: string, data?: any) => console.debug(msg, data),
	error: (msg: string, error?: any) => console.error(msg, error),
	info: (msg: string, data?: any) => console.info(msg, data),
	warn: (msg: string, data?: any) => console.warn(msg, data)
};

/**
 * Consultation Form Store using proper Svelte 5 runes
 * Fixed to prevent circular dependencies
 */
class ConsultationStore {
	// Core state - only use $state for actual mutable data
	consultation = $state<Consultation | null>(null);
	draft = $state<ConsultationDraft | null>(null);

	// Form state - the single source of truth
	formState = $state<ConsultationFormState>({
		currentStep: 0,
		completedSteps: [],
		data: {},
		isDirty: false,
		isAutoSaving: false,
		errors: {},
	});

	// Loading states
	loading = $state(false);
	saving = $state(false);

	// Static configuration - no reactivity needed
	readonly steps = [
		{
			id: "contact_info",
			title: "Contact Information",
			section: "contact_info" as ConsultationFormSection,
		},
		{
			id: "business_context",
			title: "Business Context",
			section: "business_context" as ConsultationFormSection,
		},
		{
			id: "pain_points",
			title: "Pain Points",
			section: "pain_points" as ConsultationFormSection
		},
		{
			id: "goals_objectives",
			title: "Goals & Objectives",
			section: "goals_objectives" as ConsultationFormSection,
		},
	];

	// Simple computed values - no circular dependencies
	totalSteps = $derived(this.steps.length);
	currentStepInfo = $derived(this.steps[this.formState.currentStep] || this.steps[0]);
	isFirstStep = $derived(this.formState.currentStep === 0);
	isLastStep = $derived(this.formState.currentStep === this.steps.length - 1);

	// Auto-save configuration
	private readonly AUTO_SAVE_DELAY = 2000;
	private readonly MAX_RETRIES = 3;
	private debouncedAutoSave: ReturnType<typeof debounce>;
	private autoSaveRetries = 0;

	constructor() {
		this.debouncedAutoSave = debounce(this.performAutoSave.bind(this), this.AUTO_SAVE_DELAY);
	}

	// Simple utility methods - no reactive dependencies
	getTotalSteps(): number {
		return this.steps.length;
	}

	getCurrentStep(): number {
		return this.formState.currentStep;
	}

	getCompletedSteps(): number[] {
		return Array.isArray(this.formState.completedSteps) ? this.formState.completedSteps : [];
	}

	// Check if current step has valid data - no reactive dependencies
	canNavigateNext(): boolean {
		const step = this.steps[this.formState.currentStep];
		if (!step) return false;

		const sectionData = this.formState.data[step.section];
		if (!sectionData) return false;

		return Object.values(sectionData).some(
			(value) =>
				value !== null &&
				value !== undefined &&
				value !== "" &&
				(Array.isArray(value) ? value.length > 0 : true),
		);
	}

	/**
	 * Initialize consultation form
	 */
	async initialize(consultationId?: string): Promise<boolean> {
		this.loading = true;

		try {
			if (consultationId) {
				await this.loadConsultation(consultationId);
			} else {
				await this.createNewConsultation();
			}
			return true;
		} catch (error) {
			logger.error("Failed to initialize consultation form", error);
			return false;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Create new consultation
	 */
	private async createNewConsultation(): Promise<void> {
		const token = authService.getAccessToken();
		if (!token) {
			logger.warn("No authentication token available");
			this.consultation = null;
			this.resetFormState();
			return;
		}

		const response = await consultationApiService.createConsultation(token, {});

		if (!response.success) {
			logger.error("Failed to create consultation:", response.message);
			this.consultation = null;
			this.resetFormState();
			return;
		}

		this.consultation = response.data || null;
		this.resetFormState();
		await this.loadDraft();
	}

	/**
	 * Load existing consultation
	 */
	private async loadConsultation(consultationId: string): Promise<void> {
		const token = authService.getAccessToken();
		if (!token) throw new Error("No authentication token");

		const response = await consultationApiService.getConsultation(token, consultationId);

		if (!response.success) {
			throw new Error(response.message);
		}

		this.consultation = response.data || null;
		if (response.data) {
			this.populateFormFromConsultation(response.data);
		}
		await this.loadDraft();
	}

	/**
	 * Load consultation draft
	 */
	private async loadDraft(): Promise<void> {
		if (!this.consultation) return;

		const token = authService.getAccessToken();
		if (!token) return;

		const response = await consultationApiService.getDraft(token, this.consultation.id);

		if (response.success && response.data) {
			this.draft = response.data;
			this.populateFormFromDraft(response.data);
		}
	}

	/**
	 * Reset form state
	 */
	private resetFormState(): void {
		this.formState.currentStep = 0;
		this.formState.completedSteps = [];
		this.formState.data = {};
		this.formState.isDirty = false;
		this.formState.isAutoSaving = false;
		this.formState.errors = {};
	}

	/**
	 * Populate form from consultation
	 */
	private populateFormFromConsultation(consultation: Consultation): void {
		const data: Partial<CreateConsultationInput> = {};

		if (consultation.parsed_contact_info) {
			data.contact_info = consultation.parsed_contact_info;
		}
		if (consultation.parsed_business_context) {
			data.business_context = consultation.parsed_business_context;
		}
		if (consultation.parsed_pain_points) {
			data.pain_points = consultation.parsed_pain_points;
		}
		if (consultation.parsed_goals_objectives) {
			data.goals_objectives = consultation.parsed_goals_objectives;
		}

		this.formState.data = data;
		this.formState.isDirty = false;
	}

	/**
	 * Populate form from draft
	 */
	private populateFormFromDraft(draft: ConsultationDraft): void {
		const data: Partial<CreateConsultationInput> = {};

		if (draft.parsed_contact_info) {
			data.contact_info = draft.parsed_contact_info;
		}
		if (draft.parsed_business_context) {
			data.business_context = draft.parsed_business_context;
		}
		if (draft.parsed_pain_points) {
			data.pain_points = draft.parsed_pain_points;
		}
		if (draft.parsed_goals_objectives) {
			data.goals_objectives = draft.parsed_goals_objectives;
		}

		this.formState.data = { ...this.formState.data, ...data };
		this.formState.isDirty = false;
	}

	/**
	 * Update section data - simple state update, no derived dependencies
	 */
	updateSectionData(section: ConsultationFormSection, data: any): void {
		this.formState.data = {
			...this.formState.data,
			[section]: data,
		};

		this.formState.isDirty = true;
		this.clearSectionErrors(section);

		// Trigger auto-save
		if (this.consultation) {
			this.debouncedAutoSave();
		}
	}

	/**
	 * Navigate to next step
	 */
	nextStep(): boolean {
		if (!this.canNavigateNext() || this.isLastStep) return false;

		this.markStepCompleted(this.formState.currentStep);
		this.formState.currentStep++;
		return true;
	}

	/**
	 * Navigate to previous step
	 */
	previousStep(): boolean {
		if (this.isFirstStep) return false;

		this.formState.currentStep--;
		return true;
	}

	/**
	 * Navigate to specific step
	 */
	goToStep(stepIndex: number): boolean {
		if (stepIndex < 0 || stepIndex >= this.totalSteps) return false;

		this.formState.currentStep = stepIndex;
		return true;
	}

	/**
	 * Mark step as completed
	 */
	private markStepCompleted(stepIndex: number): void {
		if (!this.formState.completedSteps.includes(stepIndex)) {
			this.formState.completedSteps.push(stepIndex);
		}
	}

	/**
	 * Auto-save functionality
	 */
	private async performAutoSave(): Promise<void> {
		if (!this.consultation || !this.formState.isDirty) return;

		const token = authService.getAccessToken();
		if (!token) return;

		this.formState.isAutoSaving = true;

		try {
			const payload: DraftSavePayload = {
				data: this.formState.data,
				auto_save: true,
			};

			const response = await consultationApiService.saveDraft(token, this.consultation.id, payload);

			if (response.success) {
				this.draft = response.data || null;
				this.formState.isDirty = false;
				this.formState.lastSaved = new Date();
				this.autoSaveRetries = 0;
			} else {
				throw new Error(response.message);
			}
		} catch (error) {
			logger.error("Auto-save failed", error);

			if (this.autoSaveRetries < this.MAX_RETRIES) {
				this.autoSaveRetries++;
				const retryDelay = Math.pow(2, this.autoSaveRetries) * 1000;
				setTimeout(() => this.performAutoSave(), retryDelay);
			}
		} finally {
			this.formState.isAutoSaving = false;
		}
	}

	/**
	 * Manually save consultation
	 */
	async save(): Promise<boolean> {
		if (!this.consultation) return false;

		const token = authService.getAccessToken();
		if (!token) return false;

		this.saving = true;

		try {
			const input: UpdateConsultationInput = {
				...this.formState.data,
			};

			const response = await consultationApiService.updateConsultation(
				token,
				this.consultation.id,
				input,
			);

			if (response.success) {
				this.consultation = response.data || null;
				this.formState.isDirty = false;
				this.formState.lastSaved = new Date();
				return true;
			} else {
				logger.error("Failed to save consultation", response.message);
				return false;
			}
		} catch (error) {
			logger.error("Error saving consultation", error);
			return false;
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Validation and error handling
	 */
	setSectionErrors(section: ConsultationFormSection, errors: string[]): void {
		this.formState.errors = {
			...this.formState.errors,
			[section]: errors,
		};
	}

	private clearSectionErrors(section: ConsultationFormSection): void {
		const { [section]: _, ...rest } = this.formState.errors;
		this.formState.errors = rest;
	}

	getSectionErrors(section: ConsultationFormSection): string[] {
		return this.formState.errors[section] || [];
	}

	validateCurrentStep(): boolean {
		const currentStep = this.steps[this.formState.currentStep];
		if (!currentStep) return false;

		const sectionData = this.formState.data[currentStep.section];
		const errors: string[] = [];

		// Simplified validation logic
		if (!sectionData) {
			errors.push("Please complete this section");
		}

		if (errors.length > 0) {
			this.setSectionErrors(currentStep.section, errors);
			return false;
		}

		return true;
	}

	/**
	 * Reset the form completely
	 */
	reset(): void {
		this.consultation = null;
		this.draft = null;
		this.resetFormState();
	}
}

// Export singleton instance
export const consultationStore = new ConsultationStore();