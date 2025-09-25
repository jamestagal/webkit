# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-25-frontend-integration/spec.md

## Endpoints

### GET /api/v1/consultations

**Purpose:** Retrieve paginated list of consultations with filtering and search capabilities
**Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page (default 20, max 100)
- `status` (optional): Filter by consultation status (draft, completed, archived)
- `search` (optional): Search term for client name or consultation title
- `sort` (optional): Sort field (created_at, updated_at, client_name)
- `order` (optional): Sort direction (asc, desc)

**Response:** JSON object with consultations array, pagination metadata, and total count
**Errors:** 401 (unauthorized), 400 (invalid parameters), 500 (server error)

### POST /api/v1/consultations

**Purpose:** Create new consultation record
**Parameters:** JSON body with consultation data including client information, business context, and initial form data
**Response:** 201 status with created consultation object including generated ID and timestamps
**Errors:** 401 (unauthorized), 400 (validation errors), 422 (unprocessable entity), 500 (server error)

### GET /api/v1/consultations/{id}

**Purpose:** Retrieve specific consultation by ID with full details
**Parameters:** `id` - Consultation UUID in URL path
**Response:** Complete consultation object with all form data, metadata, and version information
**Errors:** 401 (unauthorized), 404 (not found), 403 (forbidden), 500 (server error)

### PUT /api/v1/consultations/{id}

**Purpose:** Update existing consultation with new form data
**Parameters:** `id` - Consultation UUID in URL path, JSON body with updated consultation data
**Response:** Updated consultation object with new timestamps and version information
**Errors:** 401 (unauthorized), 404 (not found), 400 (validation errors), 409 (conflict), 500 (server error)

### POST /api/v1/consultations/{id}/drafts

**Purpose:** Save consultation as draft without full validation
**Parameters:** `id` - Consultation UUID in URL path, JSON body with partial consultation data
**Response:** 200 status with updated draft object and auto-save timestamp
**Errors:** 401 (unauthorized), 404 (not found), 400 (malformed data), 500 (server error)

### DELETE /api/v1/consultations/{id}

**Purpose:** Delete consultation record (soft delete with archive)
**Parameters:** `id` - Consultation UUID in URL path
**Response:** 204 no content status on successful deletion
**Errors:** 401 (unauthorized), 404 (not found), 403 (forbidden), 500 (server error)

### GET /api/v1/consultations/{id}/versions

**Purpose:** Retrieve version history for consultation tracking
**Parameters:** `id` - Consultation UUID in URL path
**Response:** Array of consultation versions with timestamps and change metadata
**Errors:** 401 (unauthorized), 404 (not found), 403 (forbidden), 500 (server error)

## Authentication

All endpoints require `Authorization: Bearer <jwt-token>` header with valid JWT token. Tokens expire after 24 hours and require refresh using the `/auth/refresh` endpoint.

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User-friendly error message",
    "details": [
      {
        "field": "client_name",
        "message": "Client name is required"
      }
    ]
  },
  "request_id": "uuid-for-tracking"
}
```