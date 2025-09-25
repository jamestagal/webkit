import { api } from '$lib/server/http';
import { apiEndpoints, buildUrl } from '$lib/config/api';
import type {
  Consultation,
  ConsultationSummary,
  ConsultationDraft,
  ConsultationVersion,
  CreateConsultationInput,
  UpdateConsultationInput,
  ListConsultationsResponse,
  VersionHistoryResponse,
  ListConsultationsParams,
  SafeResponse,
  DraftSavePayload
} from '$lib/types/consultation';
import {
  ConsultationSchema,
  ConsultationSummarySchema,
  ConsultationDraftSchema,
  ConsultationVersionSchema,
  ListConsultationsResponseSchema,
  VersionHistoryResponseSchema,
  CreateConsultationInputSchema,
  UpdateConsultationInputSchema,
  ListConsultationsParamsSchema,
  SafeResponseSchema
} from '$lib/types/consultation';
import { logger } from '$lib/server/logger';
import type { Safe } from '$lib/server/safe';

export class ConsultationApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || apiEndpoints.consultation;
  }

  /**
   * List consultations with pagination and filtering
   */
  async listConsultations(
    token: string,
    params: ListConsultationsParams = {}
  ): Promise<Safe<ListConsultationsResponse>> {
    try {
      // Validate parameters
      const validatedParams = ListConsultationsParamsSchema.parse(params);

      // Build query string
      const queryParams = new URLSearchParams();
      queryParams.set('page', validatedParams.page.toString());
      queryParams.set('limit', validatedParams.limit.toString());

      if (validatedParams.status) {
        queryParams.set('status', validatedParams.status);
      }

      if (validatedParams.search) {
        queryParams.set('search', validatedParams.search);
      }

      const url = `${this.baseUrl}/consultations?${queryParams.toString()}`;

      logger.debug('Fetching consultations list', { url, params: validatedParams });

      const response = await api<ListConsultationsResponse>(url, {
        method: 'GET',
        token,
      });

      if (!response.success) {
        return response;
      }

      // Validate response structure
      const validatedData = ListConsultationsResponseSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Consultations retrieved successfully',
      };
    } catch (error) {
      logger.error('Error listing consultations', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to list consultations',
        code: 500,
      };
    }
  }

  /**
   * Create a new consultation
   */
  async createConsultation(
    token: string,
    input: CreateConsultationInput
  ): Promise<Safe<Consultation>> {
    try {
      // Validate input
      const validatedInput = CreateConsultationInputSchema.parse(input);

      logger.debug('Creating consultation', { input: validatedInput });

      const response = await api<Consultation>(`${this.baseUrl}/consultations`, {
        method: 'POST',
        token,
        json: validatedInput, // Send as JSON, not FormData
      });

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Consultation created successfully',
      };
    } catch (error) {
      logger.error('Error creating consultation', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create consultation',
        code: 500,
      };
    }
  }

  /**
   * Get a consultation by ID
   */
  async getConsultation(
    token: string,
    consultationId: string
  ): Promise<Safe<Consultation>> {
    try {
      const url = `${this.baseUrl}/consultations/${consultationId}`;

      logger.debug('Fetching consultation', { consultationId });

      const response = await api<Consultation>(url, {
        method: 'GET',
        token,
      });

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Consultation retrieved successfully',
      };
    } catch (error) {
      logger.error('Error getting consultation', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get consultation',
        code: 500,
      };
    }
  }

  /**
   * Update a consultation
   */
  async updateConsultation(
    token: string,
    consultationId: string,
    input: UpdateConsultationInput
  ): Promise<Safe<Consultation>> {
    try {
      // Validate input
      const validatedInput = UpdateConsultationInputSchema.parse(input);

      logger.debug('Updating consultation', { consultationId, input: validatedInput });

      const response = await api<Consultation>(`${this.baseUrl}/consultations/${consultationId}`, {
        method: 'PUT',
        token,
        json: validatedInput, // Send as JSON, not FormData
      });

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Consultation updated successfully',
      };
    } catch (error) {
      logger.error('Error updating consultation', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update consultation',
        code: 500,
      };
    }
  }

  /**
   * Delete a consultation
   */
  async deleteConsultation(
    token: string,
    consultationId: string
  ): Promise<Safe<void>> {
    try {
      logger.debug('Deleting consultation', { consultationId });

      const response = await api<void>(`${this.baseUrl}/consultations/${consultationId}`, {
        method: 'DELETE',
        token,
      });

      return response;
    } catch (error) {
      logger.error('Error deleting consultation', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete consultation',
        code: 500,
      };
    }
  }

  /**
   * Get consultation draft
   */
  async getDraft(
    token: string,
    consultationId: string
  ): Promise<Safe<ConsultationDraft>> {
    try {
      const url = `${this.baseUrl}/consultations/${consultationId}/drafts`;

      logger.debug('Fetching consultation draft', { consultationId });

      const response = await api<ConsultationDraft>(url, {
        method: 'GET',
        token,
      });

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationDraftSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Draft retrieved successfully',
      };
    } catch (error) {
      logger.error('Error getting consultation draft', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get draft',
        code: 500,
      };
    }
  }

  /**
   * Save consultation draft (auto-save)
   */
  async saveDraft(
    token: string,
    consultationId: string,
    payload: DraftSavePayload
  ): Promise<Safe<ConsultationDraft>> {
    try {
      logger.debug('Saving consultation draft', { consultationId, payload });

      const response = await api<ConsultationDraft>(
        `${this.baseUrl}/consultations/${consultationId}/drafts`,
        {
          method: 'PUT',
          token,
          json: payload.data, // Send draft data as JSON
        }
      );

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationDraftSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Draft saved successfully',
      };
    } catch (error) {
      logger.error('Error saving consultation draft', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save draft',
        code: 500,
      };
    }
  }

  /**
   * Create consultation draft
   */
  async createDraft(
    token: string,
    consultationId: string,
    payload: DraftSavePayload
  ): Promise<Safe<ConsultationDraft>> {
    try {
      logger.debug('Creating consultation draft', { consultationId, payload });

      const response = await api<ConsultationDraft>(
        `${this.baseUrl}/consultations/${consultationId}/drafts`,
        {
          method: 'POST',
          token,
          json: payload.data, // Send draft data as JSON
        }
      );

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationDraftSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Draft created successfully',
      };
    } catch (error) {
      logger.error('Error creating consultation draft', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create draft',
        code: 500,
      };
    }
  }

  /**
   * Delete consultation draft
   */
  async deleteDraft(
    token: string,
    consultationId: string
  ): Promise<Safe<void>> {
    try {
      logger.debug('Deleting consultation draft', { consultationId });

      const response = await api<void>(`${this.baseUrl}/consultations/${consultationId}/drafts`, {
        method: 'DELETE',
        token,
      });

      return response;
    } catch (error) {
      logger.error('Error deleting consultation draft', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete draft',
        code: 500,
      };
    }
  }

  /**
   * Get consultation version history
   */
  async getVersionHistory(
    token: string,
    consultationId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<Safe<VersionHistoryResponse>> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const url = `${this.baseUrl}/consultations/${consultationId}/versions?${queryParams.toString()}`;

      logger.debug('Fetching version history', { consultationId, page, limit });

      const response = await api<VersionHistoryResponse>(url, {
        method: 'GET',
        token,
      });

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = VersionHistoryResponseSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Version history retrieved successfully',
      };
    } catch (error) {
      logger.error('Error getting version history', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get version history',
        code: 500,
      };
    }
  }

  /**
   * Get specific consultation version
   */
  async getVersion(
    token: string,
    consultationId: string,
    versionNumber: number
  ): Promise<Safe<Consultation>> {
    try {
      const url = `${this.baseUrl}/consultations/${consultationId}/versions/${versionNumber}`;

      logger.debug('Fetching consultation version', { consultationId, versionNumber });

      const response = await api<Consultation>(url, {
        method: 'GET',
        token,
      });

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Version retrieved successfully',
      };
    } catch (error) {
      logger.error('Error getting consultation version', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get version',
        code: 500,
      };
    }
  }

  /**
   * Complete consultation
   */
  async completeConsultation(
    token: string,
    consultationId: string
  ): Promise<Safe<Consultation>> {
    try {
      logger.debug('Completing consultation', { consultationId });

      const response = await api<Consultation>(
        `${this.baseUrl}/consultations/${consultationId}/complete`,
        {
          method: 'POST',
          token,
        }
      );

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Consultation completed successfully',
      };
    } catch (error) {
      logger.error('Error completing consultation', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to complete consultation',
        code: 500,
      };
    }
  }

  /**
   * Archive consultation
   */
  async archiveConsultation(
    token: string,
    consultationId: string
  ): Promise<Safe<Consultation>> {
    try {
      logger.debug('Archiving consultation', { consultationId });

      const response = await api<Consultation>(
        `${this.baseUrl}/consultations/${consultationId}/archive`,
        {
          method: 'POST',
          token,
        }
      );

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Consultation archived successfully',
      };
    } catch (error) {
      logger.error('Error archiving consultation', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to archive consultation',
        code: 500,
      };
    }
  }

  /**
   * Restore consultation
   */
  async restoreConsultation(
    token: string,
    consultationId: string
  ): Promise<Safe<Consultation>> {
    try {
      logger.debug('Restoring consultation', { consultationId });

      const response = await api<Consultation>(
        `${this.baseUrl}/consultations/${consultationId}/restore`,
        {
          method: 'POST',
          token,
        }
      );

      if (!response.success) {
        return response;
      }

      // Validate response
      const validatedData = ConsultationSchema.parse(response.data);

      return {
        success: true,
        data: validatedData,
        message: 'Consultation restored successfully',
      };
    } catch (error) {
      logger.error('Error restoring consultation', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restore consultation',
        code: 500,
      };
    }
  }
}

// Default service instance
export const consultationApiService = new ConsultationApiService();