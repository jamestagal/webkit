# Spec Requirements Document

> Spec: Remote Functions Migration for Consultation Forms
> Created: 2025-10-24
**MANDATORY: Use sveltekit-specialist agent for all SvelteKit implementation**
## Overview

Migrate the consultation form system from custom store/service architecture to SvelteKit's remote functions pattern (available since v2.27), eliminating 500+ lines of boilerplate while fixing the missing completion endpoint bug and gaining type-safe, progressive enhancement capabilities.

## User Stories

### Seamless Consultation Completion

As a user filling out the multi-step consultation form, I want my data to be automatically saved and properly submitted when I complete all steps, so that my consultation status changes from "draft" to "completed" without manual intervention.

**Current Problem:** The consultation form saves draft data but never calls the `POST /consultations/{id}/complete` endpoint, leaving consultations stuck in draft status. The complex custom store (443 lines) and service layer (200+ lines) require manual synchronization between client state and server state.

**Solution:** Remote functions provide built-in form submission with automatic backend integration, ensuring the completion endpoint is called and the consultation status is properly updated.

### Simplified Form Development

As a developer maintaining the consultation forms, I want to use SvelteKit's native remote functions pattern instead of custom stores and services, so that I can reduce code complexity, improve type safety, and leverage progressive enhancement.

**Current Problem:** The current architecture requires maintaining:
- Custom Svelte store with manual reactive state management (443 lines)
- Separate API service layer with manual fetch calls (200+ lines)
- Manual debouncing for auto-save
- Manual error handling and retry logic
- Manual form state synchronization across steps

**Solution:** Remote functions eliminate all custom boilerplate by providing:
- Built-in validation using existing Zod schemas
- Automatic query invalidation after mutations
- Progressive enhancement (works without JavaScript)
- Type-safe client-server communication
- Direct `await` syntax in Svelte 5 templates

### Progressive Enhancement

As a user with JavaScript disabled or slow network, I want the consultation form to still work reliably, so that I can complete my consultation regardless of technical constraints.

**Current Problem:** The current implementation requires JavaScript for all functionality and has no fallback for network failures.

**Solution:** Remote functions provide native progressive enhancement - forms submit via standard HTML form actions when JavaScript is unavailable.

## Spec Scope

1. **SvelteKit Dependency Upgrade** - Upgrade from v2.16.0 to v2.46.4+ to enable remote functions feature (available since v2.27)

2. **Remote Functions Configuration** - Enable experimental remote functions and async compiler options in svelte.config.js

3. **Backend Integration Layer** - Create `consultation.remote.ts` with query/form/command functions that interface with existing Go REST API endpoints

4. **Multi-Step Form Refactor** - Replace custom ConsultationStore (443 lines) with remote function form handlers for each step

5. **Completion Endpoint Integration** - Implement proper `completeConsultation` form handler that calls `POST /consultations/{id}/complete` endpoint

6. **Auto-Save Implementation** - Use remote function form enhancements with debouncing for automatic draft saves

7. **Validation Integration** - Wire existing Zod schemas (ContactInfoSchema, BusinessContextSchema, etc.) into remote function validation

## Out of Scope

- Changes to Go backend API endpoints (existing REST API remains unchanged)
- Modifications to database schema or SQL queries
- Changes to consultation business logic or validation rules
- UI/UX changes to form components (visual design stays the same)
- Migration of other parts of the application to remote functions
- Performance optimization beyond what remote functions provide natively

## Expected Deliverable

1. **Working Consultation Form** - All four steps (Contact Info, Business Context, Pain Points, Goals & Objectives) work with remote functions pattern, including auto-save and proper completion endpoint call

2. **Reduced Code Complexity** - Elimination of custom ConsultationStore (~443 lines) and significant reduction in API service layer code

3. **Type Safety Verification** - TypeScript compilation succeeds with full type safety between client and server using Zod schemas

4. **Progressive Enhancement Test** - Form works with JavaScript disabled, submitting via standard HTML form actions

5. **Completion Status Fix** - Consultations properly transition from "draft" to "completed" status when user finishes all steps, verifiable via database query or admin interface
