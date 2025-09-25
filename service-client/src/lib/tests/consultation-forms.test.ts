import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ClientInfoForm from '$lib/components/consultation/ClientInfoForm.svelte';
import BusinessContext from '$lib/components/consultation/BusinessContext.svelte';
import PainPointsCapture from '$lib/components/consultation/PainPointsCapture.svelte';
import GoalsObjectives from '$lib/components/consultation/GoalsObjectives.svelte';
import { consultationStore } from '$lib/stores/consultation.svelte';

// Mock the consultation store
vi.mock('$lib/stores/consultation.svelte', () => ({
  consultationStore: {
    formState: {
      isAutoSaving: false,
      lastSaved: undefined
    },
    updateSectionData: vi.fn()
  }
}));

describe('Consultation Form Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ClientInfoForm', () => {
    it('should render all required form fields', () => {
      let data = {};
      render(ClientInfoForm, { data });

      expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contact person/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/social media/i)).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const emailInput = screen.getByLabelText(/email address/i);
      await fireEvent.input(emailInput, { target: { value: 'invalid-email' } });

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should format phone number automatically', async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const phoneInput = screen.getByLabelText(/phone number/i);
      await fireEvent.input(phoneInput, { target: { value: '1234567890' } });

      await waitFor(() => {
        expect(phoneInput.value).toBe('(123) 456-7890');
      });
    });

    it('should add protocol to website URL', async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const websiteInput = screen.getByLabelText(/website/i);
      await fireEvent.input(websiteInput, { target: { value: 'example.com' } });
      await fireEvent.blur(websiteInput);

      await waitFor(() => {
        expect(data.website).toBe('https://example.com');
      });
    });

    it('should update consultation store when data changes', async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const businessNameInput = screen.getByLabelText(/business name/i);
      await fireEvent.input(businessNameInput, { target: { value: 'Test Corp' } });

      await waitFor(() => {
        expect(consultationStore.updateSectionData).toHaveBeenCalledWith(
          'contact_info',
          expect.objectContaining({ business_name: 'Test Corp' })
        );
      });
    });

    it('should show validation status indicator', async () => {
      let data = { email: 'test@example.com' };
      render(ClientInfoForm, { data });

      await waitFor(() => {
        expect(screen.getByText(/contact information is complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('BusinessContext', () => {
    it('should render industry and business type selects', () => {
      let data = {};
      render(BusinessContext, { data });

      expect(screen.getByLabelText(/industry/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/business type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/team size/i)).toBeInTheDocument();
    });

    it('should validate team size range', async () => {
      let data = {};
      render(BusinessContext, { data });

      const teamSizeInput = screen.getByLabelText(/team size/i);
      await fireEvent.input(teamSizeInput, { target: { value: '0' } });

      await waitFor(() => {
        expect(screen.getByText(/team size must be between 1 and 10,000/i)).toBeInTheDocument();
      });
    });

    it('should add digital presence items', async () => {
      let data = {};
      render(BusinessContext, { data });

      const websiteButton = screen.getByRole('button', { name: /\+ website/i });
      await fireEvent.click(websiteButton);

      await waitFor(() => {
        expect(screen.getByText('Website')).toBeInTheDocument();
      });
    });

    it('should allow custom digital presence input', async () => {
      let data = {};
      render(BusinessContext, { data });

      const customInput = screen.getByPlaceholderText(/add custom digital presence/i);
      await fireEvent.input(customInput, { target: { value: 'Custom Platform' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      await fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Custom Platform')).toBeInTheDocument();
      });
    });

    it('should remove digital presence items', async () => {
      let data = { digital_presence: ['Website', 'LinkedIn'] };
      render(BusinessContext, { data });

      const removeButton = screen.getAllByRole('button', { name: /remove/i })[0];
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(data.digital_presence).toEqual(['LinkedIn']);
      });
    });

    it('should show validation status', async () => {
      let data = { industry: 'technology', business_type: 'startup', team_size: 5 };
      render(BusinessContext, { data });

      await waitFor(() => {
        expect(screen.getByText(/business context is complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('PainPointsCapture', () => {
    it('should render all pain points sections', () => {
      let data = {};
      render(PainPointsCapture, { data });

      expect(screen.getByText(/primary challenges/i)).toBeInTheDocument();
      expect(screen.getByText(/technical issues/i)).toBeInTheDocument();
      expect(screen.getByText(/urgency level/i)).toBeInTheDocument();
      expect(screen.getByText(/impact assessment/i)).toBeInTheDocument();
      expect(screen.getByText(/current solution gaps/i)).toBeInTheDocument();
    });

    it('should add common challenges', async () => {
      let data = {};
      render(PainPointsCapture, { data });

      const challengeButton = screen.getByRole('button', { name: /\+ low website traffic/i });
      await fireEvent.click(challengeButton);

      await waitFor(() => {
        expect(screen.getByText('Low website traffic')).toBeInTheDocument();
      });
    });

    it('should validate urgency level requirement', async () => {
      let data = { primary_challenges: ['Test challenge'] };
      render(PainPointsCapture, { data });

      // Should show incomplete status without urgency level
      await waitFor(() => {
        expect(screen.getByText(/select urgency level/i)).toBeInTheDocument();
      });
    });

    it('should show urgency level color indicator', async () => {
      let data = { urgency_level: 'high' };
      render(PainPointsCapture, { data });

      await waitFor(() => {
        expect(screen.getByText(/high:/i)).toBeInTheDocument();
        expect(screen.getByText(/high:/i).closest('span')).toHaveClass('text-orange-700');
      });
    });

    it('should allow keyboard navigation for adding items', async () => {
      let data = {};
      render(PainPointsCapture, { data });

      const customInput = screen.getByPlaceholderText(/add a custom challenge/i);
      await fireEvent.input(customInput, { target: { value: 'Custom Challenge' } });
      await fireEvent.keyDown(customInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Custom Challenge')).toBeInTheDocument();
      });
    });

    it('should show completion status when valid', async () => {
      let data = {
        primary_challenges: ['Test challenge'],
        urgency_level: 'medium' as const
      };
      render(PainPointsCapture, { data });

      await waitFor(() => {
        expect(screen.getByText(/pain points assessment is complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('GoalsObjectives', () => {
    it('should render all goal sections', () => {
      let data = {};
      render(GoalsObjectives, { data });

      expect(screen.getByText(/primary goals/i)).toBeInTheDocument();
      expect(screen.getByText(/secondary goals/i)).toBeInTheDocument();
      expect(screen.getByText(/project timeline/i)).toBeInTheDocument();
      expect(screen.getByText(/budget information/i)).toBeInTheDocument();
      expect(screen.getByText(/success measurement/i)).toBeInTheDocument();
    });

    it('should add primary goals', async () => {
      let data = {};
      render(GoalsObjectives, { data });

      const goalButton = screen.getByRole('button', { name: /\+ increase website traffic/i });
      await fireEvent.click(goalButton);

      await waitFor(() => {
        expect(screen.getByText('Increase website traffic')).toBeInTheDocument();
      });
    });

    it('should handle date inputs for timeline', async () => {
      let data = {};
      render(GoalsObjectives, { data });

      const startDateInput = screen.getByLabelText(/desired start date/i);
      await fireEvent.input(startDateInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(data.timeline?.desired_start).toBeTruthy();
      });
    });

    it('should add and remove milestones', async () => {
      let data = {};
      render(GoalsObjectives, { data });

      const milestoneInput = screen.getByPlaceholderText(/add a project milestone/i);
      await fireEvent.input(milestoneInput, { target: { value: 'Phase 1 Complete' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      await fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Phase 1 Complete')).toBeInTheDocument();
      });
    });

    it('should validate required fields', async () => {
      let data = {};
      render(GoalsObjectives, { data });

      await waitFor(() => {
        expect(screen.getByText(/please add at least one primary goal and select a budget range/i)).toBeInTheDocument();
      });
    });

    it('should show completion status when valid', async () => {
      let data = {
        primary_goals: ['Test goal'],
        budget_range: '10k-25k'
      };
      render(GoalsObjectives, { data });

      await waitFor(() => {
        expect(screen.getByText(/goals and objectives are complete/i)).toBeInTheDocument();
      });
    });

    it('should handle budget constraints', async () => {
      let data = {};
      render(GoalsObjectives, { data });

      const constraintButton = screen.getByRole('button', { name: /\+ fixed annual budget/i });
      await fireEvent.click(constraintButton);

      await waitFor(() => {
        expect(screen.getByText('Fixed annual budget')).toBeInTheDocument();
      });
    });
  });

  describe('Form Integration', () => {
    it('should show auto-save indicator', async () => {
      // Mock auto-saving state
      const mockStore = {
        formState: {
          isAutoSaving: true,
          lastSaved: undefined
        },
        updateSectionData: vi.fn()
      };

      vi.mocked(consultationStore).formState = mockStore.formState;

      let data = {};
      render(ClientInfoForm, { data });

      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });
    });

    it('should show last saved timestamp', async () => {
      const lastSaved = new Date('2024-01-01T12:00:00Z');

      const mockStore = {
        formState: {
          isAutoSaving: false,
          lastSaved: lastSaved
        },
        updateSectionData: vi.fn()
      };

      vi.mocked(consultationStore).formState = mockStore.formState;

      let data = {};
      render(ClientInfoForm, { data });

      await waitFor(() => {
        expect(screen.getByText(/saved/i)).toBeInTheDocument();
      });
    });

    it('should handle form errors gracefully', async () => {
      let data = {};
      const errors = ['Email is required', 'Business name is required'];

      render(ClientInfoForm, { data, errors });

      expect(screen.getByText(/please correct the following errors/i)).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Business name is required')).toBeInTheDocument();
    });

    it('should disable form when disabled prop is true', () => {
      let data = {};
      render(ClientInfoForm, { data, disabled: true });

      const businessNameInput = screen.getByLabelText(/business name/i);
      expect(businessNameInput).toBeDisabled();
    });
  });

  describe('Form Validation Integration', () => {
    it('should validate email format in real-time', async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const emailInput = screen.getByLabelText(/email address/i);

      // Invalid email
      await fireEvent.input(emailInput, { target: { value: 'invalid' } });
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      // Valid email
      await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
      });
    });

    it('should validate JSON format for social media', async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const socialMediaInput = screen.getByPlaceholderText(/linkedin/i);

      // Invalid JSON
      await fireEvent.input(socialMediaInput, { target: { value: 'invalid json' } });
      await waitFor(() => {
        expect(screen.getByText(/invalid json format/i)).toBeInTheDocument();
      });

      // Valid JSON
      await fireEvent.input(socialMediaInput, { target: { value: '{"linkedin": "https://linkedin.com"}' } });
      await waitFor(() => {
        expect(screen.queryByText(/invalid json format/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      let data = {};
      render(ClientInfoForm, { data });

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
    });

    it('should use semantic form structure', () => {
      let data = {};
      render(ClientInfoForm, { data });

      expect(screen.getByRole('textbox', { name: /business name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    });

    it('should announce validation errors to screen readers', async () => {
      let data = {};
      render(ClientInfoForm, { data });

      const emailInput = screen.getByLabelText(/email address/i);
      await fireEvent.input(emailInput, { target: { value: 'invalid-email' } });

      await waitFor(() => {
        const errorMessage = screen.getByText(/please enter a valid email address/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });
});