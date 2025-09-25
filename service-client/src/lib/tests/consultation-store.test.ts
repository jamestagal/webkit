import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { consultationStore } from '$lib/stores/consultation.svelte';
import { consultationApiService } from '$lib/services/consultation.service';
import { authService } from '$lib/services/auth';
import type { Consultation, ConsultationDraft } from '$lib/types/consultation';

// Mock dependencies
vi.mock('$lib/services/consultation.service');
vi.mock('$lib/services/auth');
vi.mock('$lib/server/logger');

const mockConsultationApiService = consultationApiService as any;
const mockAuthService = authService as any;

describe('ConsultationStore', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset store state
    consultationStore.reset();

    // Setup default auth mock
    mockAuthService.getAccessToken = vi.fn(() => 'mock-token');
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      expect(consultationStore.consultation).toBe(null);
      expect(consultationStore.draft).toBe(null);
      expect(consultationStore.formState.currentStep).toBe(0);
      expect(consultationStore.formState.completedSteps).toEqual([]);
      expect(consultationStore.formState.data).toEqual({});
      expect(consultationStore.formState.isDirty).toBe(false);
    });

    it('should create new consultation when initialized without ID', async () => {
      const mockConsultation: Consultation = {
        id: 'test-id',
        user_id: 'user-id',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      const result = await consultationStore.initialize();

      expect(result).toBe(true);
      expect(consultationStore.consultation).toEqual(mockConsultation);
      expect(mockConsultationApiService.createConsultation).toHaveBeenCalledWith('mock-token', {});
    });

    it('should load existing consultation when initialized with ID', async () => {
      const mockConsultation: Consultation = {
        id: 'existing-id',
        user_id: 'user-id',
        contact_info: { email: 'test@example.com' },
        business_context: { industry: 'technology' },
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        parsed_contact_info: { email: 'test@example.com' },
        parsed_business_context: { industry: 'technology' }
      };

      mockConsultationApiService.getConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      const result = await consultationStore.initialize('existing-id');

      expect(result).toBe(true);
      expect(consultationStore.consultation).toEqual(mockConsultation);
      expect(consultationStore.formState.data.contact_info).toEqual({ email: 'test@example.com' });
    });
  });

  describe('form navigation', () => {
    beforeEach(async () => {
      // Initialize with a consultation
      const mockConsultation: Consultation = {
        id: 'test-id',
        user_id: 'user-id',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      await consultationStore.initialize();
    });

    it('should navigate to next step when current step is valid', () => {
      // Make current step valid by adding required data
      consultationStore.updateSectionData('contact_info', { email: 'test@example.com' });

      const result = consultationStore.nextStep();

      expect(result).toBe(true);
      expect(consultationStore.formState.currentStep).toBe(1);
      expect(consultationStore.formState.completedSteps).toContain(0);
    });

    it('should not navigate to next step when current step is invalid', () => {
      const result = consultationStore.nextStep();

      expect(result).toBe(false);
      expect(consultationStore.formState.currentStep).toBe(0);
    });

    it('should navigate to previous step', () => {
      consultationStore.formState.currentStep = 1;

      const result = consultationStore.previousStep();

      expect(result).toBe(true);
      expect(consultationStore.formState.currentStep).toBe(0);
    });

    it('should not navigate to previous step from first step', () => {
      const result = consultationStore.previousStep();

      expect(result).toBe(false);
      expect(consultationStore.formState.currentStep).toBe(0);
    });

    it('should navigate to specific step if all previous steps are completed', () => {
      // Mark steps as completed
      consultationStore.formState.completedSteps = [0, 1];

      const result = consultationStore.goToStep(2);

      expect(result).toBe(true);
      expect(consultationStore.formState.currentStep).toBe(2);
    });

    it('should not navigate to step if previous steps are not completed', () => {
      const result = consultationStore.goToStep(2);

      expect(result).toBe(false);
      expect(consultationStore.formState.currentStep).toBe(0);
    });
  });

  describe('data management', () => {
    beforeEach(async () => {
      // Initialize with a consultation
      const mockConsultation: Consultation = {
        id: 'test-id',
        user_id: 'user-id',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      await consultationStore.initialize();
    });

    it('should update section data and trigger auto-save', () => {
      const contactData = { email: 'test@example.com', business_name: 'Test Corp' };

      consultationStore.updateSectionData('contact_info', contactData);

      expect(consultationStore.formState.data.contact_info).toEqual(contactData);
      expect(consultationStore.formState.isDirty).toBe(true);
    });

    it('should validate step completion', () => {
      // Add data that makes contact_info step valid
      consultationStore.updateSectionData('contact_info', { email: 'test@example.com' });

      // Step should now be marked as completed
      expect(consultationStore.formState.completedSteps).toContain(0);
    });

    it('should calculate completion percentage correctly', () => {
      // Complete first two steps
      consultationStore.updateSectionData('contact_info', { email: 'test@example.com' });
      consultationStore.updateSectionData('business_context', { industry: 'technology', business_type: 'startup', team_size: 5 });

      const percentage = consultationStore.completionPercentage;

      expect(percentage).toBe(50); // 2 out of 4 steps completed
    });
  });

  describe('auto-save functionality', () => {
    beforeEach(async () => {
      const mockConsultation: Consultation = {
        id: 'test-id',
        user_id: 'user-id',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      await consultationStore.initialize();
    });

    it('should trigger auto-save when data is updated', async () => {
      const mockDraft: ConsultationDraft = {
        id: 'draft-id',
        consultation_id: 'test-id',
        user_id: 'user-id',
        contact_info: { email: 'test@example.com' },
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.saveDraft = vi.fn(() =>
        Promise.resolve({ success: true, data: mockDraft })
      );

      consultationStore.updateSectionData('contact_info', { email: 'test@example.com' });

      // Wait for debounced auto-save
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(mockConsultationApiService.saveDraft).toHaveBeenCalledWith(
        'mock-token',
        'test-id',
        {
          data: { contact_info: { email: 'test@example.com' } },
          auto_save: true
        }
      );
    });
  });

  describe('form validation', () => {
    it('should validate contact_info step requires email', () => {
      consultationStore.formState.currentStep = 0;
      consultationStore.formState.data = { contact_info: {} };

      const isValid = consultationStore.validateCurrentStep();

      expect(isValid).toBe(false);
      expect(consultationStore.getSectionErrors('contact_info')).toContain('Email is required');
    });

    it('should validate business_context step requires industry', () => {
      consultationStore.formState.currentStep = 1;
      consultationStore.formState.data = { business_context: {} };

      const isValid = consultationStore.validateCurrentStep();

      expect(isValid).toBe(false);
      expect(consultationStore.getSectionErrors('business_context')).toContain('Industry is required');
    });

    it('should validate pain_points step requires challenges', () => {
      consultationStore.formState.currentStep = 2;
      consultationStore.formState.data = { pain_points: {} };

      const isValid = consultationStore.validateCurrentStep();

      expect(isValid).toBe(false);
      expect(consultationStore.getSectionErrors('pain_points')).toContain('At least one primary challenge is required');
    });

    it('should validate goals_objectives step requires goals', () => {
      consultationStore.formState.currentStep = 3;
      consultationStore.formState.data = { goals_objectives: {} };

      const isValid = consultationStore.validateCurrentStep();

      expect(isValid).toBe(false);
      expect(consultationStore.getSectionErrors('goals_objectives')).toContain('At least one primary goal is required');
    });
  });

  describe('save and complete', () => {
    beforeEach(async () => {
      const mockConsultation: Consultation = {
        id: 'test-id',
        user_id: 'user-id',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      await consultationStore.initialize();
    });

    it('should save consultation successfully', async () => {
      const updatedConsultation: Consultation = {
        ...consultationStore.consultation!,
        status: 'draft',
        completion_percentage: 50
      };

      mockConsultationApiService.updateConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: updatedConsultation })
      );

      const result = await consultationStore.save();

      expect(result).toBe(true);
      expect(consultationStore.consultation).toEqual(updatedConsultation);
      expect(consultationStore.formState.isDirty).toBe(false);
    });

    it('should complete consultation when all steps are valid', async () => {
      // Set up all steps as completed
      consultationStore.formState.completedSteps = [0, 1, 2, 3];

      const completedConsultation: Consultation = {
        ...consultationStore.consultation!,
        status: 'completed',
        completion_percentage: 100,
        completed_at: new Date().toISOString()
      };

      mockConsultationApiService.completeConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: completedConsultation })
      );

      const result = await consultationStore.complete();

      expect(result).toBe(true);
      expect(consultationStore.consultation!.status).toBe('completed');
    });

    it('should not complete consultation when steps are incomplete', async () => {
      // Only first step completed
      consultationStore.formState.completedSteps = [0];

      const result = await consultationStore.complete();

      expect(result).toBe(false);
    });
  });

  describe('derived state', () => {
    it('should correctly identify first and last steps', () => {
      expect(consultationStore.isFirstStep).toBe(true);
      expect(consultationStore.isLastStep).toBe(false);

      consultationStore.formState.currentStep = 3;
      expect(consultationStore.isFirstStep).toBe(false);
      expect(consultationStore.isLastStep).toBe(true);
    });

    it('should track unsaved changes', () => {
      expect(consultationStore.hasUnsavedChanges).toBe(false);

      consultationStore.formState.isDirty = true;
      consultationStore.formState.isAutoSaving = false;
      expect(consultationStore.hasUnsavedChanges).toBe(true);

      consultationStore.formState.isAutoSaving = true;
      expect(consultationStore.hasUnsavedChanges).toBe(false);
    });

    it('should provide current step info', () => {
      const stepInfo = consultationStore.currentStepInfo;
      expect(stepInfo.id).toBe('contact_info');
      expect(stepInfo.title).toBe('Contact Information');
      expect(stepInfo.section).toBe('contact_info');
    });
  });

  describe('error handling', () => {
    it('should handle initialization failure gracefully', async () => {
      mockAuthService.getAccessToken = vi.fn(() => null);

      const result = await consultationStore.initialize();

      expect(result).toBe(false);
    });

    it('should handle API errors during save', async () => {
      const mockConsultation: Consultation = {
        id: 'test-id',
        user_id: 'user-id',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      await consultationStore.initialize();

      mockConsultationApiService.updateConsultation = vi.fn(() =>
        Promise.resolve({ success: false, message: 'Save failed' })
      );

      const result = await consultationStore.save();

      expect(result).toBe(false);
    });

    it('should retry auto-save on failure', async () => {
      const mockConsultation: Consultation = {
        id: 'test-id',
        user_id: 'user-id',
        contact_info: {},
        business_context: {},
        pain_points: {},
        goals_objectives: {},
        status: 'draft',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: mockConsultation })
      );
      mockConsultationApiService.getDraft = vi.fn(() =>
        Promise.resolve({ success: false, message: 'No draft found' })
      );

      await consultationStore.initialize();

      // First call fails, second succeeds
      mockConsultationApiService.saveDraft = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({ success: false, message: 'Network error' }))
        .mockImplementationOnce(() => Promise.resolve({
          success: true,
          data: { id: 'draft-id', consultation_id: 'test-id', user_id: 'user-id', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        }));

      consultationStore.updateSectionData('contact_info', { email: 'test@example.com' });

      // Wait for auto-save and retry
      await new Promise(resolve => setTimeout(resolve, 3100));

      expect(mockConsultationApiService.saveDraft).toHaveBeenCalledTimes(2);
    });
  });
});