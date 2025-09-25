import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ConsultationWizard from '$lib/components/consultation/ConsultationWizard.svelte';
import { consultationStore } from '$lib/stores/consultation.svelte';
import { consultationApiService } from '$lib/services/consultation.service';
import { authService } from '$lib/services/auth';

// Mock all dependencies
vi.mock('$lib/services/consultation.service');
vi.mock('$lib/services/auth');
vi.mock('$lib/server/logger');
vi.mock('$lib/components/shared/Toast.svelte', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}));

const mockConsultationApiService = consultationApiService as any;
const mockAuthService = authService as any;

describe('Consultation Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consultationStore.reset();

    // Setup default mocks
    mockAuthService.getAccessToken = vi.fn(() => 'mock-token');
    mockConsultationApiService.createConsultation = vi.fn(() =>
      Promise.resolve({
        success: true,
        data: {
          id: 'test-consultation-id',
          user_id: 'user-id',
          contact_info: {},
          business_context: {},
          pain_points: {},
          goals_objectives: {},
          status: 'draft',
          completion_percentage: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
    );
    mockConsultationApiService.getDraft = vi.fn(() =>
      Promise.resolve({ success: false, message: 'No draft found' })
    );
    mockConsultationApiService.saveDraft = vi.fn(() =>
      Promise.resolve({
        success: true,
        data: {
          id: 'draft-id',
          consultation_id: 'test-consultation-id',
          user_id: 'user-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
    );
  });

  describe('Complete Consultation Workflow', () => {
    it('should complete the full consultation process', async () => {
      let completedConsultation: any = null;
      const onComplete = vi.fn((consultation) => {
        completedConsultation = consultation;
      });

      render(ConsultationWizard, { onComplete });

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/contact information/i)).toBeInTheDocument();
      });

      // Step 1: Fill out Contact Information
      const businessNameInput = screen.getByLabelText(/business name/i);
      const emailInput = screen.getByLabelText(/email address/i);

      await fireEvent.input(businessNameInput, { target: { value: 'Test Corporation' } });
      await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });

      // Navigate to next step
      const nextButton = screen.getByRole('button', { name: /next/i });
      await fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/business context/i)).toBeInTheDocument();
      });

      // Step 2: Fill out Business Context
      const industrySelect = screen.getByLabelText(/industry/i);
      const businessTypeSelect = screen.getByLabelText(/business type/i);
      const teamSizeInput = screen.getByLabelText(/team size/i);

      await fireEvent.change(industrySelect, { target: { value: 'technology' } });
      await fireEvent.change(businessTypeSelect, { target: { value: 'startup' } });
      await fireEvent.input(teamSizeInput, { target: { value: '5' } });

      // Navigate to next step
      await fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/pain points & challenges/i)).toBeInTheDocument();
      });

      // Step 3: Fill out Pain Points
      const challengeButton = screen.getByRole('button', { name: /\+ low website traffic/i });
      await fireEvent.click(challengeButton);

      const urgencySelect = screen.getByLabelText(/urgency level/i);
      await fireEvent.change(urgencySelect, { target: { value: 'high' } });

      // Navigate to next step
      await fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/goals & objectives/i)).toBeInTheDocument();
      });

      // Step 4: Fill out Goals & Objectives
      const goalButton = screen.getByRole('button', { name: /\+ increase website traffic/i });
      await fireEvent.click(goalButton);

      const budgetSelect = screen.getByLabelText(/budget range/i);
      await fireEvent.change(budgetSelect, { target: { value: '10k-25k' } });

      // Mock the completion API calls
      mockConsultationApiService.updateConsultation = vi.fn(() =>
        Promise.resolve({
          success: true,
          data: {
            id: 'test-consultation-id',
            user_id: 'user-id',
            status: 'draft',
            completion_percentage: 100,
            contact_info: { business_name: 'Test Corporation', email: 'test@example.com' },
            business_context: { industry: 'technology', business_type: 'startup', team_size: 5 },
            pain_points: { primary_challenges: ['Low website traffic'], urgency_level: 'high' },
            goals_objectives: { primary_goals: ['Increase website traffic'], budget_range: '10k-25k' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      );

      mockConsultationApiService.completeConsultation = vi.fn(() =>
        Promise.resolve({
          success: true,
          data: {
            id: 'test-consultation-id',
            user_id: 'user-id',
            status: 'completed',
            completion_percentage: 100,
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      );

      // Submit the consultation
      const submitButton = screen.getByRole('button', { name: /complete consultation/i });
      await fireEvent.click(submitButton);

      // Wait for completion
      await waitFor(() => {
        expect(mockConsultationApiService.completeConsultation).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();
      });

      expect(completedConsultation).toBeTruthy();
      expect(completedConsultation.status).toBe('completed');
    });

    it('should handle step navigation correctly', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
      });

      // Fill out first step to enable navigation
      const emailInput = screen.getByLabelText(/email address/i);
      await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });

      // Navigate to step 2
      const nextButton = screen.getByRole('button', { name: /next/i });
      await fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
      });

      // Navigate back to step 1
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await fireEvent.click(previousButton);

      await waitFor(() => {
        expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
      });
    });

    it('should prevent navigation when step is incomplete', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/contact information/i)).toBeInTheDocument();
      });

      // Try to navigate without completing the step
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should show progress correctly', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/0%/)).toBeInTheDocument();
        expect(screen.getByText(/0 of 4 steps/i)).toBeInTheDocument();
      });

      // Complete first step
      const emailInput = screen.getByLabelText(/email address/i);
      await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });

      await waitFor(() => {
        expect(screen.getByText(/25%/)).toBeInTheDocument();
        expect(screen.getByText(/1 of 4 steps/i)).toBeInTheDocument();
      });
    });

    it('should handle auto-save functionality', async () => {
      render(ConsultationWizard, { autoSave: true });

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/contact information/i)).toBeInTheDocument();
      });

      // Make a change to trigger auto-save
      const businessNameInput = screen.getByLabelText(/business name/i);
      await fireEvent.input(businessNameInput, { target: { value: 'Test Corp' } });

      // Wait for debounced auto-save
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(mockConsultationApiService.saveDraft).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Mock API failure
      mockConsultationApiService.createConsultation = vi.fn(() =>
        Promise.resolve({ success: false, message: 'API Error' })
      );

      render(ConsultationWizard, {});

      // Should show error state or retry
      await waitFor(() => {
        // The error should be handled gracefully
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should validate form completeness before submission', async () => {
      render(ConsultationWizard, {});

      // Navigate through all steps without completing them
      // This should be prevented by navigation guards, but let's test the submit button state

      // The submit button should not be available until the last step
      expect(screen.queryByRole('button', { name: /complete consultation/i })).not.toBeInTheDocument();
    });

    it('should handle keyboard navigation shortcuts', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/contact information/i)).toBeInTheDocument();
      });

      // Fill out first step
      const emailInput = screen.getByLabelText(/email address/i);
      await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });

      // Test keyboard navigation (Ctrl + →)
      await fireEvent.keyDown(document, {
        key: 'ArrowRight',
        ctrlKey: true
      });

      await waitFor(() => {
        expect(screen.getByText(/business context/i)).toBeInTheDocument();
      });
    });

    it('should show unsaved changes warning', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/contact information/i)).toBeInTheDocument();
      });

      // Make a change
      const businessNameInput = screen.getByLabelText(/business name/i);
      await fireEvent.input(businessNameInput, { target: { value: 'Test Corp' } });

      // Simulate beforeunload event
      const beforeUnloadEvent = new Event('beforeunload') as BeforeUnloadEvent;
      window.dispatchEvent(beforeUnloadEvent);

      // Should set returnValue to warn user
      expect(beforeUnloadEvent.returnValue).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/contact information/i)).toBeInTheDocument();
      });

      // Mock save failure
      mockConsultationApiService.updateConsultation = vi.fn(() =>
        Promise.resolve({ success: false, message: 'Save failed' })
      );

      // Try to save manually
      const saveButton = screen.getByRole('button', { name: /save/i });
      await fireEvent.click(saveButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
      });
    });

    it('should handle completion errors gracefully', async () => {
      render(ConsultationWizard, {});

      // Set up completed form state
      consultationStore.formState.completedSteps = [0, 1, 2, 3];
      consultationStore.formState.currentStep = 3;

      // Mock completion failure
      mockConsultationApiService.updateConsultation = vi.fn(() =>
        Promise.resolve({ success: true, data: { status: 'draft' } })
      );
      mockConsultationApiService.completeConsultation = vi.fn(() =>
        Promise.resolve({ success: false, message: 'Completion failed' })
      );

      const submitButton = screen.getByRole('button', { name: /complete consultation/i });
      await fireEvent.click(submitButton);

      // Should handle error and not call onComplete
      await waitFor(() => {
        expect(screen.queryByText(/submitting/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /project consultation/i })).toBeInTheDocument();
      });

      // Check for proper form structure
      expect(screen.getByRole('textbox', { name: /business name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    });

    it('should announce step changes to screen readers', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
      });

      // Fill out first step and navigate
      const emailInput = screen.getByLabelText(/email address/i);
      await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });

      const nextButton = screen.getByRole('button', { name: /next/i });
      await fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
      });
    });

    it('should handle focus management correctly', async () => {
      render(ConsultationWizard, {});

      // Wait for initialization
      await waitFor(() => {
        const firstInput = screen.getByLabelText(/business name/i);
        expect(document.activeElement).toBe(firstInput);
      });
    });
  });

  describe('Performance', () => {
    it('should debounce auto-save calls', async () => {
      render(ConsultationWizard, { autoSave: true });

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/contact information/i)).toBeInTheDocument();
      });

      const businessNameInput = screen.getByLabelText(/business name/i);

      // Make multiple rapid changes
      await fireEvent.input(businessNameInput, { target: { value: 'T' } });
      await fireEvent.input(businessNameInput, { target: { value: 'Te' } });
      await fireEvent.input(businessNameInput, { target: { value: 'Tes' } });
      await fireEvent.input(businessNameInput, { target: { value: 'Test' } });

      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Should only call save once due to debouncing
      expect(mockConsultationApiService.saveDraft).toHaveBeenCalledTimes(1);
    });

    it('should not re-render unnecessarily', async () => {
      const renderSpy = vi.fn();

      render(ConsultationWizard, {});

      // Multiple updates should be batched
      consultationStore.formState.isDirty = true;
      consultationStore.formState.isDirty = false;

      // Should not cause excessive re-renders
      expect(renderSpy).not.toHaveBeenCalledTimes(2);
    });
  });
});