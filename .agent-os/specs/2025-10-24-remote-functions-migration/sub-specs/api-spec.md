# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-24-remote-functions-migration/spec.md

## Overview

This spec documents how SvelteKit remote functions will interface with the existing Go REST API. **No backend API changes are required** - all endpoints already exist and work correctly. The issue is that the frontend never calls the completion endpoint.
**MANDATORY: Use sveltekit-specialist agent for all SvelteKit implementation**
## Existing Backend Endpoints

### POST /consultations

**Purpose:** Create a new consultation

**Request:**
```json
{}  // Empty body creates draft consultation
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "status": "draft",
  "completion_percentage": 0,
  "created_at": "2025-10-24T10:00:00Z",
  "updated_at": "2025-10-24T10:00:00Z",
  "contact_info": {},
  "business_context": {},
  "pain_points": {},
  "goals_objectives": {}
}
```

**Frontend Integration:**
```typescript
// consultation.remote.ts
export const getOrCreateConsultation = query(async () => {
  const { fetch } = getRequestEvent();
  const response = await fetch('http://localhost:4001/consultations', {
    method: 'POST',
    credentials: 'include'  // Send cookies
  });
  return await response.json();
});
```

---

### GET /consultations/{id}

**Purpose:** Retrieve consultation details

**Parameters:**
- `id` (path): UUID of consultation

**Response:**
```json
{
  "id": "uuid",
  "status": "draft",
  "parsed_contact_info": { ... },
  "parsed_business_context": { ... },
  "parsed_pain_points": { ... },
  "parsed_goals_objectives": { ... }
}
```

**Frontend Integration:**
```typescript
export const getConsultation = query(z.string().uuid(), async (id) => {
  const { fetch } = getRequestEvent();
  const response = await fetch(`http://localhost:4001/consultations/${id}`, {
    credentials: 'include'
  });
  return await response.json();
});
```

---

### PUT /consultations/{id}

**Purpose:** Update consultation data (saves to main consultation record)

**Parameters:**
- `id` (path): UUID of consultation

**Request:**
```json
{
  "contact_info": {
    "business_name": "Acme Corp",
    "email": "contact@acme.com"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "draft",
  "completion_percentage": 25,
  "parsed_contact_info": { ... },
  "updated_at": "2025-10-24T10:05:00Z"
}
```

**Frontend Integration:**
```typescript
export const saveContactInfo = form(ContactInfoSchema, async (data) => {
  const { fetch, cookies } = getRequestEvent();
  const consultationId = cookies.get('current_consultation_id');

  const response = await fetch(
    `http://localhost:4001/consultations/${consultationId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contact_info: data })
    }
  );

  return await response.json();
});
```

---

### POST /consultations/{id}/complete

**Purpose:** Mark consultation as completed (changes status from "draft" → "completed")

**Parameters:**
- `id` (path): UUID of consultation

**Request:**
```json
{}  // Empty body
```

**Response:**
```json
{
  "id": "uuid",
  "status": "completed",
  "completion_percentage": 100,
  "completed_at": "2025-10-24T10:15:00Z"
}
```

**Frontend Integration:**
```typescript
export const completeConsultation = form(
  z.object({ consultationId: z.string().uuid() }),
  async ({ consultationId }) => {
    const { fetch } = getRequestEvent();

    // THIS IS THE CRITICAL MISSING CALL
    const response = await fetch(
      `http://localhost:4001/consultations/${consultationId}/complete`,
      {
        method: 'POST',
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error('Failed to complete consultation');
    }

    // Redirect to success page
    redirect(303, '/consultation/success');
  }
);
```

**Current Bug:** The existing frontend never calls this endpoint, so consultations remain in "draft" status forever.

---

### POST /consultations/{id}/drafts

**Purpose:** Create or update auto-saved draft data (separate from main consultation)

**Parameters:**
- `id` (path): UUID of consultation

**Request:**
```json
{
  "data": {
    "contact_info": { ... },
    "business_context": { ... }
  },
  "auto_save": true
}
```

**Response:**
```json
{
  "id": "draft-uuid",
  "consultation_id": "uuid",
  "parsed_contact_info": { ... },
  "updated_at": "2025-10-24T10:03:00Z"
}
```

**Frontend Integration (Auto-Save):**
```typescript
export const autoSaveDraft = command(
  z.object({
    consultationId: z.string().uuid(),
    data: z.record(z.any())
  }),
  async ({ consultationId, data }) => {
    const { fetch } = getRequestEvent();

    await fetch(
      `http://localhost:4001/consultations/${consultationId}/drafts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data, auto_save: true })
      }
    );

    // Refresh draft query to update UI
    getDraft(consultationId).refresh();
  }
);
```

---

### GET /consultations/{id}/drafts

**Purpose:** Retrieve auto-saved draft data

**Parameters:**
- `id` (path): UUID of consultation

**Response:**
```json
{
  "id": "draft-uuid",
  "consultation_id": "uuid",
  "parsed_contact_info": { ... },
  "parsed_business_context": { ... }
}
```

**Frontend Integration:**
```typescript
export const getDraft = query(z.string().uuid(), async (consultationId) => {
  const { fetch } = getRequestEvent();
  const response = await fetch(
    `http://localhost:4001/consultations/${consultationId}/drafts`,
    {
      credentials: 'include'
    }
  );

  if (response.status === 404) {
    return null;  // No draft exists yet
  }

  return await response.json();
});
```

---

## Remote Function to API Mapping

| Remote Function | HTTP Method | Endpoint | Purpose |
|----------------|-------------|----------|---------|
| `getOrCreateConsultation()` | POST | `/consultations` | Initialize form |
| `getConsultation(id)` | GET | `/consultations/{id}` | Load existing |
| `saveContactInfo(data)` | PUT | `/consultations/{id}` | Step 1 save |
| `saveBusinessContext(data)` | PUT | `/consultations/{id}` | Step 2 save |
| `savePainPoints(data)` | PUT | `/consultations/{id}` | Step 3 save |
| `saveGoalsObjectives(data)` | PUT | `/consultations/{id}` | Step 4 save |
| `completeConsultation(id)` | POST | `/consultations/{id}/complete` | **Fix bug** |
| `autoSaveDraft(id, data)` | POST | `/consultations/{id}/drafts` | Auto-save |
| `getDraft(id)` | GET | `/consultations/{id}/drafts` | Load draft |

## Authentication Flow

**Cookie-Based Auth:**
1. User logs in → Go backend sets `access_token` cookie
2. SvelteKit `fetch` from `getRequestEvent()` automatically includes cookies
3. Go backend validates token from cookie
4. Token refresh handled transparently by backend

**Remote Function Pattern:**
```typescript
export const anyRemoteFunction = query(schema, async (input) => {
  const { fetch, cookies } = getRequestEvent();

  // fetch automatically includes cookies when using credentials: 'include'
  const response = await fetch('http://localhost:4001/api/endpoint', {
    credentials: 'include'  // Critical for cookie auth
  });

  return await response.json();
});
```

## Error Handling

**HTTP Error Status Codes:**
- `400 Bad Request` → Validation error (handled by Zod schema)
- `401 Unauthorized` → Token expired (Go backend handles refresh)
- `404 Not Found` → Consultation/draft doesn't exist
- `500 Internal Server Error` → Backend error

**Remote Function Error Handling:**
```typescript
export const saveContactInfo = form(ContactInfoSchema, async (data) => {
  const { fetch } = getRequestEvent();

  const response = await fetch('...', { ... });

  if (!response.ok) {
    // SvelteKit will catch this and show nearest error boundary
    throw new Error(`Failed to save: ${response.statusText}`);
  }

  return await response.json();
});
```

**Frontend Error Display:**
```svelte
<form {...saveContactInfo.enhance(async ({ submit }) => {
  try {
    await submit();
  } catch (error) {
    toast.error('Failed to save. Please try again.');
  }
})}>
```

## CORS Configuration

**Requirements:**
- Allow origin: `http://localhost:3000` (SvelteKit dev server)
- Allow credentials: `true` (for cookies)
- Allow methods: `GET, POST, PUT, DELETE, OPTIONS`
- Allow headers: `Content-Type, Authorization`

**Go Backend (Already Configured):**
```go
// app/service-core/rest/handler.go - Already exists
cors.AllowOrigin("http://localhost:3000")
cors.AllowCredentials(true)
```

## Testing API Integration

**Manual Test Flow:**
1. Start Go backend: `docker compose up`
2. Start SvelteKit dev: `npm run dev`
3. Open DevTools Network tab
4. Fill out consultation form
5. Verify requests:
   - POST `/consultations` → Creates consultation
   - PUT `/consultations/{id}` → Saves each step
   - POST `/consultations/{id}/complete` → **Should see this call**
6. Check database: `status` should be "completed"

**cURL Test for Completion Endpoint:**
```bash
# Get auth token first
TOKEN="your-access-token"

# Complete consultation
curl -X POST \
  http://localhost:4001/consultations/{uuid}/complete \
  -H "Cookie: access_token=$TOKEN" \
  -v
```

## Single-Flight Mutations

**Refresh Queries After Mutations:**
```typescript
export const saveContactInfo = form(ContactInfoSchema, async (data) => {
  // Save data
  await fetch(...);

  // Refresh the consultation query to get updated completion percentage
  await getConsultation(consultationId).refresh();
});
```

**Usage in Frontend:**
```svelte
<form {...saveContactInfo.enhance(async ({ submit }) => {
  await submit().updates(getConsultation(consultationId));
  // Updates consultation display immediately
})}>
```

This ensures the UI reflects the latest server state without manual cache management.
