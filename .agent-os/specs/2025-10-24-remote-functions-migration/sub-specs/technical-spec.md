# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-24-remote-functions-migration/spec.md

## Technical Requirements
**MANDATORY: Use sveltekit-specialist agent for all SvelteKit implementation**
### 1. Dependency Upgrades

**SvelteKit Core Dependencies:**
- `@sveltejs/kit`: ^2.16.0 → ^2.46.4 (enables remote functions, available since v2.27)
- `@sveltejs/vite-plugin-svelte`: ^5.0.0 → ^6.2.1 (compatibility with Kit v2.46+)
- `@sveltejs/adapter-node`: ^5.2.12 → ^6.1.1 (adapter compatibility)

**Compiler Dependencies:**
- `svelte`: ^5.0.0 (already compatible, no change needed)
- `vite`: ^6.2.6 (already compatible, no change needed)

**Risk Assessment:**
- Breaking changes review required for v2.16 → v2.46 migration
- Test all existing routes after upgrade
- Review SvelteKit changelog for deprecations

### 2. Configuration Changes

**svelte.config.js:**
```javascript
export default {
  kit: {
    adapter: adapter(),
    experimental: {
      remoteFunctions: true  // NEW: Enable remote functions
    }
  },
  compilerOptions: {
    experimental: {
      async: true  // NEW: Enable await in templates
    }
  }
}
```

### 3. Remote Functions Architecture

**File Structure:**
```
service-client/src/lib/api/
├── consultation.remote.ts  (NEW: Remote function definitions)
└── consultation.service.ts (DEPRECATE: To be removed after migration)

service-client/src/lib/stores/
└── consultation.svelte.ts  (DEPRECATE: To be removed after migration)
```

**consultation.remote.ts Structure:**
```typescript
import { query, form, command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import {
  ContactInfoSchema,
  BusinessContextSchema,
  PainPointsSchema,
  GoalsObjectivesSchema
} from '$lib/types/consultation';

// Query: Get or create consultation
export const getOrCreateConsultation = query(async () => {
  const { fetch, cookies } = getRequestEvent();
  // Cookie-based auth (access_token cookie automatically sent)
  const response = await fetch('/api/consultations', { method: 'POST' });
  return await response.json();
});

// Form: Save contact info step
export const saveContactInfo = form(ContactInfoSchema, async (data) => {
  const { fetch, cookies } = getRequestEvent();
  const consultationId = cookies.get('consultation_id');

  await fetch(`/api/consultations/${consultationId}`, {
    method: 'PUT',
    body: JSON.stringify({ contact_info: data })
  });

  return { success: true };
});

// Form: Complete consultation
export const completeConsultation = form(
  z.object({ consultationId: z.string().uuid() }),
  async ({ consultationId }) => {
    const { fetch } = getRequestEvent();

    // KEY FIX: Call the completion endpoint
    await fetch(`/api/consultations/${consultationId}/complete`, {
      method: 'POST'
    });

    redirect(303, '/consultation/success');
  }
);
```

### 4. Backend Integration Requirements

**Existing Go REST API Endpoints (NO CHANGES):**
- `POST /consultations` - Create new consultation
- `GET /consultations/{id}` - Get consultation
- `PUT /consultations/{id}` - Update consultation
- `POST /consultations/{id}/complete` - **CRITICAL: Must be called to change status**
- `POST /consultations/{id}/drafts` - Save draft
- `PUT /consultations/{id}/drafts` - Update draft

**Authentication:**
- Use existing cookie-based authentication
- `access_token` cookie automatically sent with fetch from `getRequestEvent()`
- Token refresh logic already handled by Go backend

**CORS Requirements:**
- SvelteKit dev server (localhost:3000) → Go backend (localhost:4001)
- Existing CORS configuration should work unchanged
- Credentials: 'include' for cookie authentication

### 5. Form Component Architecture

**Multi-Step Form Pattern:**
```svelte
<script lang="ts">
  import {
    getOrCreateConsultation,
    saveContactInfo,
    saveBusinessContext,
    savePainPoints,
    saveGoalsObjectives,
    completeConsultation
  } from '$lib/api/consultation.remote';

  // Initialize on mount
  const consultation = getOrCreateConsultation();
</script>

<!-- Step 1: Contact Info -->
<form {...saveContactInfo.enhance(async ({ submit }) => {
  await submit();
  goToNextStep();
})}>
  <input {...saveContactInfo.fields.business_name.as('text')} />
  <input {...saveContactInfo.fields.email.as('email')} />

  {#each saveContactInfo.fields.email.issues() as issue}
    <p class="error">{issue.message}</p>
  {/each}

  <button type="submit" disabled={saveContactInfo.pending}>Next</button>
</form>

<!-- Step 4: Complete -->
<form {...completeConsultation.enhance(async ({ submit }) => {
  await submit();
  // Automatically redirects to /consultation/success
})}>
  <input
    type="hidden"
    name="consultationId"
    value={await consultation.id}
  />
  <button type="submit">Complete Consultation</button>
</form>
```

### 6. Auto-Save Implementation

**Debounced Auto-Save:**
```svelte
<form
  {...saveContactInfo}
  oninput={() => saveContactInfo.validate()}
  onchange={() => {
    // Auto-submit after 2 second debounce
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveContactInfo.submit();
    }, 2000);
  }}
>
  <!-- form fields -->
</form>
```

### 7. Migration Strategy

**Phase 1: Parallel Implementation**
- Keep existing store/service code functional
- Implement remote functions alongside
- Create feature flag to switch between implementations

**Phase 2: Testing**
- Test all four form steps with remote functions
- Verify completion endpoint is called
- Confirm status changes from draft → completed
- Test auto-save functionality
- Verify validation errors display correctly

**Phase 3: Cutover**
- Switch production to remote functions
- Monitor for issues
- Keep old code for quick rollback if needed

**Phase 4: Cleanup**
- Remove deprecated store/service files
- Update documentation
- Remove feature flag

### 8. Error Handling

**Validation Errors:**
- Automatic via Zod schema validation
- Display via `.issues()` method on fields
- No custom error handling needed

**Network Errors:**
```svelte
<form {...saveContactInfo.enhance(async ({ submit }) => {
  try {
    await submit();
  } catch (error) {
    toast.error('Failed to save. Please try again.');
  }
})}>
```

**Token Refresh:**
- Handled automatically by Go backend
- Cookie-based auth means refreshed tokens are transparent to client
- No special handling needed in remote functions

### 9. Testing Requirements

**Unit Tests:**
- Validate Zod schemas with sample data
- Test form field validation

**Integration Tests:**
- Test complete flow from step 1 → 4 → completion
- Verify API calls are made correctly
- Confirm consultation status changes

**E2E Tests (Playwright):**
- Fill out complete consultation form
- Verify success page redirect
- Check database for completed status

**Progressive Enhancement Test:**
- Disable JavaScript
- Submit form
- Verify standard HTML form submission works

### 10. Performance Considerations

**Bundle Size Impact:**
- Remote functions add ~5KB to client bundle
- Removal of custom store/service saves ~15KB
- Net reduction: ~10KB

**Network Requests:**
- Auto-save creates more frequent requests
- Mitigated by 2-second debounce
- Single-flight mutations reduce redundant queries

**Caching:**
- Query results cached by SvelteKit
- Automatic cache invalidation after mutations
- Better than current manual cache management

## External Dependencies

No new external dependencies required. All functionality uses:
- SvelteKit built-in remote functions (after upgrade)
- Existing Zod schemas (already in project)
- Existing authentication system (cookie-based)
- Existing Go REST API (unchanged)
