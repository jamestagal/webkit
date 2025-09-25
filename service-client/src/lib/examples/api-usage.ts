/**
 * API Usage Examples
 *
 * This file demonstrates how to use the new API infrastructure
 * for the consultation service and authentication.
 */

import { authService } from '../services/auth';
import { consultationApiService } from '../services/consultation.service';
import { httpClient } from '../server/http';
import { ConsultationSchema } from '../types/consultation';
import { apiEndpoints } from '../config/api';
import type { CreateConsultationInput } from '../types/consultation';

/**
 * Example 1: Authentication Flow
 */
export async function authenticationExample() {
  try {
    // Login
    const loginCredentials: LoginCredentials = {
      email: 'user@example.com',
      password: 'secure-password',
    };

    console.log('Logging in...');
    const loginResult = await authService.login(loginCredentials);

    if (!loginResult.success) {
      console.error('Login failed:', loginResult.message);
      return;
    }

    console.log('Login successful:', loginResult.data.user);

    // Check authentication status
    const isAuthenticated = authService.isAuthenticated();
    console.log('Is authenticated:', isAuthenticated);

    // Get current user
    const currentUser = authService.getUser();
    console.log('Current user:', currentUser);

    // Get auth token for API requests
    const token = authService.getAccessToken();
    console.log('Access token available:', !!token);

    return { user: loginResult.data.user, token };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Example 2: Consultation CRUD Operations
 */
export async function consultationCrudExample() {
  try {
    // First, ensure we're authenticated
    const token = authService.getAccessToken();
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    // Create a new consultation
    const consultationData: CreateConsultationInput = {
      contact_info: {
        business_name: 'Acme Corp',
        email: 'contact@acme.com',
        website: 'https://acme.com',
      },
      business_context: {
        business_type: 'e-commerce',
      },
      goals_objectives: {
        primary_goals: ['increase_sales', 'improve_conversion'],
      },
      pain_points: {
        primary_challenges: ['slow_website', 'poor_mobile_experience'],
      },
    };

    console.log('Creating consultation...');
    const createResult = await consultationApiService.createConsultation(token, consultationData);

    if (!createResult.success) {
      console.error('Failed to create consultation:', createResult.message);
      return;
    }

    console.log('Consultation created:', createResult.data);
    const consultationId = createResult.data.id;

    // Get the consultation
    console.log('Fetching consultation...');
    const getResult = await consultationApiService.getConsultation(token, consultationId);

    if (!getResult.success) {
      console.error('Failed to get consultation:', getResult.message);
      return;
    }

    console.log('Consultation retrieved:', getResult.data);

    // List consultations with pagination
    console.log('Listing consultations...');
    const listResult = await consultationApiService.listConsultations(token, {
      page: 1,
      limit: 10,
      status: 'draft',
    });

    if (!listResult.success) {
      console.error('Failed to list consultations:', listResult.message);
      return;
    }

    console.log('Consultations list:', listResult.data);

    // Update the consultation
    console.log('Updating consultation...');
    const updateResult = await consultationApiService.updateConsultation(token, consultationId, {
      contact_info: {
        business_name: 'Acme Corporation Updated',
      },
      goals_objectives: {
        primary_goals: ['increase_sales', 'improve_seo', 'enhance_ux'],
      },
    });

    if (!updateResult.success) {
      console.error('Failed to update consultation:', updateResult.message);
      return;
    }

    console.log('Consultation updated:', updateResult.data);

    return consultationId;
  } catch (error) {
    console.error('Consultation CRUD error:', error);
    throw error;
  }
}

/**
 * Example 3: Direct HTTP Client Usage with Validation
 */
export async function httpClientExample() {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    // Make a request with automatic validation
    console.log('Making validated API request...');
    const response = await httpClient.request(
      `${apiEndpoints.consultation}/consultation-123`,
      {
        method: 'GET',
        token,
        validateWith: ConsultationSchema,
        validationContext: 'get-consultation',
        timeout: 5000,
        retries: 2,
      }
    );

    if (!response.success) {
      console.error('API request failed:', response.message);
      return;
    }

    console.log('Validated consultation data:', response.data);

    // Make a JSON POST request
    console.log('Making JSON POST request...');
    const postResponse = await httpClient.request(
      `${apiEndpoints.consultation}/consultation-123/notes`,
      {
        method: 'POST',
        json: {
          note: 'Client prefers modern design with focus on mobile responsiveness',
          priority: 'high',
        },
        token,
        headers: {
          'X-Client-Version': '1.0.0',
        },
      }
    );

    if (!postResponse.success) {
      console.error('POST request failed:', postResponse.message);
      return;
    }

    console.log('Note added:', postResponse.data);

    return response.data;
  } catch (error) {
    console.error('HTTP client error:', error);
    throw error;
  }
}

/**
 * Example 4: Draft Management
 */
export async function draftManagementExample(consultationId: string) {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    // Create a draft
    console.log('Creating consultation draft...');
    const draftData = {
      data: {
        contact_info: {
          business_name: 'Draft Business Name',
        },
        goals_objectives: {
          primary_goals: ['improve_seo'],
        },
        notes: 'This is a work in progress',
      },
    };

    const createDraftResult = await consultationApiService.createDraft(token, consultationId, draftData);

    if (!createDraftResult.success) {
      console.error('Failed to create draft:', createDraftResult.message);
      return;
    }

    console.log('Draft created:', createDraftResult.data);

    // Auto-save draft updates
    console.log('Auto-saving draft...');
    const updatedDraftData = {
      data: {
        ...draftData.data,
        contact_info: {
          ...draftData.data.contact_info,
          business_name: 'Updated Draft Business Name',
        },
        pain_points: {
          primary_challenges: ['slow_website'],
        },
      },
    };

    const saveDraftResult = await consultationApiService.saveDraft(token, consultationId, updatedDraftData);

    if (!saveDraftResult.success) {
      console.error('Failed to save draft:', saveDraftResult.message);
      return;
    }

    console.log('Draft saved:', saveDraftResult.data);

    // Get draft
    console.log('Retrieving draft...');
    const getDraftResult = await consultationApiService.getDraft(token, consultationId);

    if (!getDraftResult.success) {
      console.error('Failed to get draft:', getDraftResult.message);
      return;
    }

    console.log('Draft retrieved:', getDraftResult.data);

    return getDraftResult.data;
  } catch (error) {
    console.error('Draft management error:', error);
    throw error;
  }
}

/**
 * Example 5: Error Handling and Retry Logic
 */
export async function errorHandlingExample() {
  try {
    console.log('Testing error handling...');

    // This will likely fail and demonstrate error handling
    const result = await httpClient.request('/api/non-existent-endpoint', {
      method: 'GET',
      retries: 2,
      retryDelay: 1000,
      timeout: 3000,
    });

    if (!result.success) {
      console.log('Expected error occurred:', result.message, 'Code:', result.code);

      // Handle different error types
      switch (result.code) {
        case 404:
          console.log('Resource not found - redirect to 404 page');
          break;
        case 401:
          console.log('Unauthorized - redirect to login');
          await authService.logout();
          break;
        case 500:
          console.log('Server error - show user-friendly message');
          break;
        case 0:
          console.log('Network error - check connection');
          break;
        default:
          console.log('Unknown error - log to monitoring service');
      }
    }

    return result;
  } catch (error) {
    console.error('Error handling example failed:', error);
    throw error;
  }
}

/**
 * Example 6: Complete Workflow
 * Demonstrates a full consultation workflow from login to completion
 */
export async function completeWorkflowExample() {
  try {
    console.log('Starting complete workflow example...');

    // Step 1: Authentication
    const authResult = await authenticationExample();
    if (!authResult) return;

    // Step 2: Create consultation
    const consultationId = await consultationCrudExample();
    if (!consultationId) return;

    // Step 3: Work with drafts
    await draftManagementExample(consultationId);

    // Step 4: Complete consultation
    const token = authService.getAccessToken()!;
    console.log('Completing consultation...');

    const completeResult = await consultationApiService.completeConsultation(token, consultationId);

    if (!completeResult.success) {
      console.error('Failed to complete consultation:', completeResult.message);
      return;
    }

    console.log('Consultation completed successfully:', completeResult.data);

    // Step 5: Get version history
    console.log('Fetching version history...');
    const historyResult = await consultationApiService.getVersionHistory(token, consultationId);

    if (!historyResult.success) {
      console.error('Failed to get version history:', historyResult.message);
      return;
    }

    console.log('Version history:', historyResult.data);

    console.log('Complete workflow finished successfully!');
    return completeResult.data;

  } catch (error) {
    console.error('Complete workflow failed:', error);
    throw error;
  }
}

/**
 * Utility function to run all examples
 */
export async function runAllExamples() {
  console.log('Running API usage examples...');

  try {
    await completeWorkflowExample();
    await errorHandlingExample();
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Examples failed:', error);
  }
}