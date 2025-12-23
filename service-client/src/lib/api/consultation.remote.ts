/**
 * Remote Functions API Layer for Consultation Management
 *
 * This module provides type-safe, server-side API integration using SvelteKit remote functions.
 * All functions use cookie-based authentication (credentials: 'include').
 *
 * Pattern: Remote Functions API Layer
 * Cognitive Load: ~50 (11 functions × 4-5 average)
 *
 * Architecture:
 * - Query functions: Read operations with automatic caching
 * - Command functions: Write operations with manual invalidation
 * - Form functions: Multi-step form submissions with validation
 * - All fetch calls include credentials for cookie-based auth
 * - Proper error handling for all HTTP status codes
 */

import { redirect } from '@sveltejs/kit';
import { query, command, form, getRequestEvent } from '$app/server';
import { z } from 'zod';
import {
  ConsultationSchema,
  ConsultationDraftSchema,
  ContactInfoSchema,
  BusinessContextSchema,
  PainPointsSchema,
  GoalsObjectivesSchema,
  type Consultation,
  type ConsultationDraft
} from '$lib/types/consultation';

// API Configuration
// Use Docker service name when running in server context, localhost for browser
const API_BASE_URL = typeof window === 'undefined'
  ? 'http://webkit-core:4001'  // Server-side (Docker network)
  : 'http://localhost:4001';    // Client-side (browser)

/**
 * Helper function to handle API responses with proper error handling
 *
 * Cognitive Load: 4
 * - Fetch execution: 1
 * - Status check: 1
 * - Error parsing: 1
 * - JSON parsing: 1
 */
async function fetchAPI<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // CRITICAL: credentials: 'include' for cookie-based auth
  const response = await fetch(url, {
    ...options,
    credentials: 'include'
  });

  // Handle HTTP errors
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // If error response is not JSON, use status text
    }

    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Query: Get or Create Consultation
 *
 * Creates a new consultation if user doesn't have an active draft.
 * Uses POST /consultations with empty body to create draft consultation.
 *
 * Cognitive Load: 4
 * - Query definition: 1
 * - API call: 2 (via fetchAPI)
 * - Validation: 1
 *
 * @returns Consultation object with draft status
 * @throws Error on API failure or validation error
 */
export const getOrCreateConsultation = query(async () => {
  const consultation = await fetchAPI<Consultation>(
    `${API_BASE_URL}/consultations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // Empty body creates draft
    }
  );

  // Validate response against schema
  const validatedConsultation = ConsultationSchema.parse(consultation);

  return validatedConsultation;
});

/**
 * Query: Get Consultation by ID
 *
 * Retrieves a specific consultation with all parsed fields.
 *
 * Cognitive Load: 4
 * - Query with parameter: 1
 * - API call: 2 (via fetchAPI)
 * - Validation: 1
 *
 * @param id - UUID of the consultation
 * @returns Consultation object
 * @throws Error if consultation not found (404) or other API errors
 */
export const getConsultation = query(z.string().uuid(), async (id) => {
  const consultation = await fetchAPI<Consultation>(
    `${API_BASE_URL}/consultations/${id}`
  );

  // Validate response
  const validatedConsultation = ConsultationSchema.parse(consultation);

  return validatedConsultation;
});

/**
 * Query: Get Draft for Consultation
 *
 * Retrieves auto-saved draft data for a consultation.
 * Returns null if no draft exists (404 is expected behavior).
 *
 * Cognitive Load: 5
 * - Query with parameter: 1
 * - API call with try-catch: 3
 * - Validation: 1
 *
 * @param consultationId - UUID of the consultation
 * @returns ConsultationDraft object or null if not found
 * @throws Error on unexpected API errors (not 404)
 */
export const getDraft = query(z.string().uuid(), async (consultationId) => {
  try {
    const draft = await fetchAPI<ConsultationDraft>(
      `${API_BASE_URL}/consultations/${consultationId}/drafts`
    );

    // Validate and return draft
    const validatedDraft = ConsultationDraftSchema.parse(draft);
    return validatedDraft;

  } catch (error) {
    // 404 is expected if no draft exists yet
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }

    // Re-throw unexpected errors
    throw error;
  }
});

/**
 * Command: Auto-Save Draft
 *
 * Saves draft data for a consultation. Creates new draft or updates existing.
 * Uses POST /consultations/{id}/drafts which handles upsert logic.
 *
 * Cognitive Load: 5
 * - Command with validation: 1
 * - Destructure params: 1
 * - API call: 2 (via fetchAPI)
 * - Validation: 1
 *
 * @param params.consultationId - UUID of the consultation
 * @param params.data - Draft data to save (arbitrary JSON structure)
 * @returns Saved ConsultationDraft object
 * @throws Error on API failure
 */
export const autoSaveDraft = command(
  z.object({
    consultationId: z.string().uuid(),
    data: z.record(z.string(), z.any()) // Accept any JSON-serializable draft data
  }),
  async ({ consultationId, data }) => {
    const draft = await fetchAPI<ConsultationDraft>(
      `${API_BASE_URL}/consultations/${consultationId}/drafts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }
    );

    // Validate response
    const validatedDraft = ConsultationDraftSchema.parse(draft);

    // Note: Caller should manually invalidate getDraft query if needed
    // Example: await getDraft(consultationId).refresh();

    return validatedDraft;
  }
);

/**
 * Command: Complete Consultation
 *
 * CRITICAL: This is the missing endpoint call that fixes the bug.
 * Marks consultation as "completed" and changes status from "draft" to "completed".
 *
 * Cognitive Load: 4
 * - Command with validation: 1
 * - API call: 2 (via fetchAPI)
 * - Validation: 1
 *
 * @param consultationId - UUID of the consultation to complete
 * @returns Updated Consultation object with "completed" status
 * @throws Error on API failure
 */
export const completeConsultation = command(
  z.object({ consultationId: z.string().uuid() }),
  async ({ consultationId }) => {
    const consultation = await fetchAPI<Consultation>(
      `${API_BASE_URL}/consultations/${consultationId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body
      }
    );

    // Validate response
    const validatedConsultation = ConsultationSchema.parse(consultation);

    // Caller should redirect to success page after this completes
    // Example: redirect(303, '/consultation/success');

    return validatedConsultation;
  }
);

/**
 * Query: List Consultations
 *
 * Retrieves paginated list of consultations for current user.
 * Optional filters: status, search query.
 *
 * Cognitive Load: 5
 * - Query with params: 1
 * - URL building: 1
 * - API call: 2 (via fetchAPI)
 * - Validation: 1
 *
 * @param params - Optional pagination and filter parameters
 * @returns Paginated consultation list with metadata
 * @throws Error on API failure
 */
export const listConsultations = query(
  z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    status: z.enum(['draft', 'completed', 'archived']).optional(),
    search: z.string().optional()
  }).optional(),
  async (params) => {
    // Build query string
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);

    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/consultations${queryString ? `?${queryString}` : ''}`;

    const response = await fetchAPI<{
      consultations: Consultation[];
      total: number;
      page: number;
      limit: number;
      has_more: boolean;
    }>(url);

    return response;
  }
);

// ========================================
// TASK 3: FORM STEP REMOTE FUNCTIONS
// ========================================

/**
 * Command: Save Contact Information (Step 1)
 *
 * Saves contact information for a consultation using PUT /consultations/{id}.
 * Validates data with ContactInfoSchema before sending to API.
 *
 * Pattern: Command with Zod validation
 * Cognitive Load: 5
 * - Command with schema validation: 1
 * - Cookie retrieval: 1
 * - API call with payload wrapping: 2
 * - Response validation: 1
 *
 * @param data - Contact information data validated by ContactInfoSchema
 * @returns Updated Consultation object with contact_info saved
 * @throws Error on API failure or validation error
 */
export const saveContactInfo = command(ContactInfoSchema, async (data) => {
  const { cookies } = getRequestEvent();
  const consultationId = cookies.get('current_consultation_id');

  if (!consultationId) {
    throw new Error('No active consultation. Please start a new consultation.');
  }

  // PUT /consultations/{id} with contact_info field
  const consultation = await fetchAPI<Consultation>(
    `${API_BASE_URL}/consultations/${consultationId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_info: data })
    }
  );

  // Validate response
  const validatedConsultation = ConsultationSchema.parse(consultation);

  return validatedConsultation;
});

/**
 * Command: Save Business Context (Step 2)
 *
 * Saves business context for a consultation using PUT /consultations/{id}.
 * Validates data with BusinessContextSchema before sending to API.
 *
 * Pattern: Command with Zod validation
 * Cognitive Load: 5
 * - Command with schema validation: 1
 * - Cookie retrieval: 1
 * - API call with payload wrapping: 2
 * - Response validation: 1
 *
 * @param data - Business context data validated by BusinessContextSchema
 * @returns Updated Consultation object with business_context saved
 * @throws Error on API failure or validation error
 */
export const saveBusinessContext = command(BusinessContextSchema, async (data) => {
  const { cookies } = getRequestEvent();
  const consultationId = cookies.get('current_consultation_id');

  if (!consultationId) {
    throw new Error('No active consultation. Please start a new consultation.');
  }

  // PUT /consultations/{id} with business_context field
  const consultation = await fetchAPI<Consultation>(
    `${API_BASE_URL}/consultations/${consultationId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_context: data })
    }
  );

  // Validate response
  const validatedConsultation = ConsultationSchema.parse(consultation);

  return validatedConsultation;
});

/**
 * Command: Save Pain Points (Step 3)
 *
 * Saves pain points for a consultation using PUT /consultations/{id}.
 * Validates data with PainPointsSchema before sending to API.
 *
 * Pattern: Command with Zod validation
 * Cognitive Load: 5
 * - Command with schema validation: 1
 * - Cookie retrieval: 1
 * - API call with payload wrapping: 2
 * - Response validation: 1
 *
 * @param data - Pain points data validated by PainPointsSchema
 * @returns Updated Consultation object with pain_points saved
 * @throws Error on API failure or validation error
 */
export const savePainPoints = command(PainPointsSchema, async (data) => {
  const { cookies } = getRequestEvent();
  const consultationId = cookies.get('current_consultation_id');

  if (!consultationId) {
    throw new Error('No active consultation. Please start a new consultation.');
  }

  // PUT /consultations/{id} with pain_points field
  const consultation = await fetchAPI<Consultation>(
    `${API_BASE_URL}/consultations/${consultationId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pain_points: data })
    }
  );

  // Validate response
  const validatedConsultation = ConsultationSchema.parse(consultation);

  return validatedConsultation;
});

/**
 * Command: Save Goals and Objectives (Step 4)
 *
 * Saves goals and objectives for a consultation using PUT /consultations/{id}.
 * Validates data with GoalsObjectivesSchema before sending to API.
 *
 * Pattern: Command with Zod validation
 * Cognitive Load: 5
 * - Command with schema validation: 1
 * - Cookie retrieval: 1
 * - API call with payload wrapping: 2
 * - Response validation: 1
 *
 * @param data - Goals and objectives data validated by GoalsObjectivesSchema
 * @returns Updated Consultation object with goals_objectives saved
 * @throws Error on API failure or validation error
 */
export const saveGoalsObjectives = command(GoalsObjectivesSchema, async (data) => {
  const { cookies } = getRequestEvent();
  const consultationId = cookies.get('current_consultation_id');

  if (!consultationId) {
    throw new Error('No active consultation. Please start a new consultation.');
  }

  // PUT /consultations/{id} with goals_objectives field
  const consultation = await fetchAPI<Consultation>(
    `${API_BASE_URL}/consultations/${consultationId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goals_objectives: data })
    }
  );

  // Validate response
  const validatedConsultation = ConsultationSchema.parse(consultation);

  return validatedConsultation;
});

/**
 * Form: Complete Consultation with Redirect
 *
 * CRITICAL BUG FIX: Calls POST /consultations/{id}/complete to change status.
 * This form function is used for the final step submission and redirects to success page.
 *
 * Pattern: Form completion with redirect
 * Cognitive Load: 5
 * - Form with validation: 1
 * - Cookie retrieval: 1
 * - API call via completeConsultation: 2
 * - Redirect: 1
 *
 * @param data - Consultation ID to complete
 * @throws Redirect to /consultation/success on success
 * @throws Error on API failure
 */
export const completeConsultationWithRedirect = form(
  z.object({ consultationId: z.string().uuid() }),
  async ({ consultationId }) => {
    // Call the completion endpoint
    const consultation = await fetchAPI<Consultation>(
      `${API_BASE_URL}/consultations/${consultationId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body
      }
    );

    // Validate response
    ConsultationSchema.parse(consultation);

    // Redirect to success page
    redirect(303, '/consultation/success');
  }
);

// Export type helpers for use in components
export type GetOrCreateConsultationResult = Awaited<ReturnType<typeof getOrCreateConsultation>>;
export type GetConsultationResult = Awaited<ReturnType<typeof getConsultation>>;
export type GetDraftResult = Awaited<ReturnType<typeof getDraft>>;
export type AutoSaveDraftResult = Awaited<ReturnType<typeof autoSaveDraft>>;
export type CompleteConsultationResult = Awaited<ReturnType<typeof completeConsultation>>;
export type ListConsultationsResult = Awaited<ReturnType<typeof listConsultations>>;

// Command result types for form steps
export type SaveContactInfoResult = Awaited<ReturnType<typeof saveContactInfo>>;
export type SaveBusinessContextResult = Awaited<ReturnType<typeof saveBusinessContext>>;
export type SavePainPointsResult = Awaited<ReturnType<typeof savePainPoints>>;
export type SaveGoalsObjectivesResult = Awaited<ReturnType<typeof saveGoalsObjectives>>;
