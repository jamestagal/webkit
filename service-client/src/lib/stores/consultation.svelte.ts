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
  GoalsObjectives
} from '$lib/types/consultation';
import { consultationApiService } from '$lib/services/consultation.service';
import { authService } from '$lib/services/auth';
import { logger } from '$lib/server/logger';
import { debounce } from '$lib/utils/debounce';

/**
 * Consultation Form Store using Svelte 5 runes
 * Manages multi-step form state, validation, and auto-save functionality
 */
class ConsultationStore {
  // Core state
  consultation = $state<Consultation | null>(null);
  draft = $state<ConsultationDraft | null>(null);

  // Form state management
  formState = $state<ConsultationFormState>({
    currentStep: 0,
    completedSteps: [],
    data: {},
    isDirty: false,
    isAutoSaving: false,
    errors: {}
  });

  // Loading states
  loading = $state(false);
  saving = $state(false);

  // Auto-save configuration
  private readonly AUTO_SAVE_DELAY = 2000; // 2 seconds
  private readonly MAX_RETRIES = 3;
  private debouncedAutoSave: ReturnType<typeof debounce>;
  private autoSaveRetries = 0;

  // Step configuration
  readonly steps = [
    { id: 'contact_info', title: 'Contact Information', section: 'contact_info' as ConsultationFormSection },
    { id: 'business_context', title: 'Business Context', section: 'business_context' as ConsultationFormSection },
    { id: 'pain_points', title: 'Pain Points', section: 'pain_points' as ConsultationFormSection },
    { id: 'goals_objectives', title: 'Goals & Objectives', section: 'goals_objectives' as ConsultationFormSection }
  ];

  // Derived state
  currentStepInfo = $derived(() => this.steps[this.formState.currentStep]);
  totalSteps = $derived(() => this.steps.length);
  completionPercentage = $derived(() =>
    Math.round((this.formState.completedSteps.length / this.steps.length) * 100)
  );
  isFirstStep = $derived(() => this.formState.currentStep === 0);
  isLastStep = $derived(() => this.formState.currentStep === this.steps.length - 1);
  canNavigateNext = $derived(() => this.isStepValid(this.formState.currentStep));
  hasUnsavedChanges = $derived(() => this.formState.isDirty && !this.formState.isAutoSaving);

  constructor() {
    // Initialize debounced auto-save
    this.debouncedAutoSave = debounce(this.performAutoSave.bind(this), this.AUTO_SAVE_DELAY);
  }

  /**
   * Initialize consultation form - create new or load existing
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
      logger.error('Failed to initialize consultation form', error);
      return false;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Create a new consultation
   */
  private async createNewConsultation(): Promise<void> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('No authentication token');

    const response = await consultationApiService.createConsultation(token, {});

    if (!response.success) {
      throw new Error(response.message);
    }

    this.consultation = response.data;
    this.resetFormState();

    // Try to load any existing draft
    await this.loadDraft();
  }

  /**
   * Load existing consultation
   */
  private async loadConsultation(consultationId: string): Promise<void> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('No authentication token');

    const response = await consultationApiService.getConsultation(token, consultationId);

    if (!response.success) {
      throw new Error(response.message);
    }

    this.consultation = response.data;
    this.populateFormFromConsultation(response.data);

    // Try to load draft
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
   * Populate form state from consultation data
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
    this.updateCompletedSteps();
    this.formState.isDirty = false;
  }

  /**
   * Populate form state from draft data
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
    this.updateCompletedSteps();
    this.formState.isDirty = false;
  }

  /**
   * Reset form state to initial values
   */
  private resetFormState(): void {
    this.formState = {
      currentStep: 0,
      completedSteps: [],
      data: {},
      isDirty: false,
      isAutoSaving: false,
      errors: {}
    };
  }

  /**
   * Update section data and trigger auto-save
   */
  updateSectionData(section: ConsultationFormSection, data: any): void {
    this.formState.data = {
      ...this.formState.data,
      [section]: data
    };

    this.formState.isDirty = true;
    this.clearSectionErrors(section);
    this.updateCompletedSteps();

    // Trigger auto-save
    if (this.consultation) {
      this.debouncedAutoSave();
    }
  }

  /**
   * Navigate to next step
   */
  nextStep(): boolean {
    if (!this.canNavigateNext || this.isLastStep) return false;

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

    // Check if we can navigate to this step (must have completed all previous steps)
    for (let i = 0; i < stepIndex; i++) {
      if (!this.formState.completedSteps.includes(i)) {
        return false;
      }
    }

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
   * Update completed steps based on form data
   */
  private updateCompletedSteps(): void {
    const completedSteps: number[] = [];

    this.steps.forEach((step, index) => {
      if (this.isStepValid(index)) {
        completedSteps.push(index);
      }
    });

    this.formState.completedSteps = completedSteps;
  }

  /**
   * Check if step is valid/complete
   */
  private isStepValid(stepIndex: number): boolean {
    const step = this.steps[stepIndex];
    if (!step) return false;

    const sectionData = this.formState.data[step.section];
    if (!sectionData) return false;

    // Basic validation - check if section has any data
    return Object.values(sectionData).some(value =>
      value !== null && value !== undefined && value !== '' &&
      (Array.isArray(value) ? value.length > 0 : true)
    );
  }

  /**
   * Perform auto-save
   */
  private async performAutoSave(): Promise<void> {
    if (!this.consultation || !this.formState.isDirty) return;

    const token = authService.getAccessToken();
    if (!token) return;

    this.formState.isAutoSaving = true;

    try {
      const payload: DraftSavePayload = {
        data: this.formState.data,
        auto_save: true
      };

      const response = await consultationApiService.saveDraft(
        token,
        this.consultation.id,
        payload
      );

      if (response.success) {
        this.draft = response.data;
        this.formState.isDirty = false;
        this.formState.lastSaved = new Date();
        this.autoSaveRetries = 0;

        logger.debug('Auto-save successful', { consultationId: this.consultation.id });
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      logger.error('Auto-save failed', error);

      // Retry auto-save with exponential backoff
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
        ...this.formState.data
      };

      const response = await consultationApiService.updateConsultation(
        token,
        this.consultation.id,
        input
      );

      if (response.success) {
        this.consultation = response.data;
        this.formState.isDirty = false;
        this.formState.lastSaved = new Date();

        logger.debug('Consultation saved successfully');
        return true;
      } else {
        logger.error('Failed to save consultation', response.message);
        return false;
      }
    } catch (error) {
      logger.error('Error saving consultation', error);
      return false;
    } finally {
      this.saving = false;
    }
  }

  /**
   * Complete consultation
   */
  async complete(): Promise<boolean> {
    if (!this.consultation) return false;

    // Validate all steps are completed
    if (this.formState.completedSteps.length !== this.totalSteps) {
      return false;
    }

    const token = authService.getAccessToken();
    if (!token) return false;

    this.saving = true;

    try {
      const response = await consultationApiService.completeConsultation(
        token,
        this.consultation.id
      );

      if (response.success) {
        this.consultation = response.data;
        logger.debug('Consultation completed successfully');
        return true;
      } else {
        logger.error('Failed to complete consultation', response.message);
        return false;
      }
    } catch (error) {
      logger.error('Error completing consultation', error);
      return false;
    } finally {
      this.saving = false;
    }
  }

  /**
   * Set validation errors for a section
   */
  setSectionErrors(section: ConsultationFormSection, errors: string[]): void {
    this.formState.errors = {
      ...this.formState.errors,
      [section]: errors
    };
  }

  /**
   * Clear validation errors for a section
   */
  private clearSectionErrors(section: ConsultationFormSection): void {
    const { [section]: _, ...rest } = this.formState.errors;
    this.formState.errors = rest;
  }

  /**
   * Get validation errors for a section
   */
  getSectionErrors(section: ConsultationFormSection): string[] {
    return this.formState.errors[section] || [];
  }

  /**
   * Validate current step
   */
  validateCurrentStep(): boolean {
    const currentStep = this.currentStepInfo;
    if (!currentStep) return false;

    const sectionData = this.formState.data[currentStep.section];
    const errors: string[] = [];

    // Perform basic validation based on section
    switch (currentStep.section) {
      case 'contact_info':
        if (!sectionData?.email) {
          errors.push('Email is required');
        }
        break;
      case 'business_context':
        if (!sectionData?.industry) {
          errors.push('Industry is required');
        }
        break;
      case 'pain_points':
        if (!sectionData?.primary_challenges || sectionData.primary_challenges.length === 0) {
          errors.push('At least one primary challenge is required');
        }
        break;
      case 'goals_objectives':
        if (!sectionData?.primary_goals || sectionData.primary_goals.length === 0) {
          errors.push('At least one primary goal is required');
        }
        break;
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