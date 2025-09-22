# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-22-consultation-domain/spec.md

> Created: 2025-09-22
> Version: 1.0.0

## Endpoints

### Base URL
All consultation endpoints are prefixed with `/api/v1/consultations`

### Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## Core Consultation Operations

### POST /consultations
Create a new consultation record.

**Request Body:**
```json
{
  "contactInfo": {
    "businessName": "string",
    "contactPerson": "string",
    "email": "string",
    "phone": "string",
    "website": "string",
    "socialMedia": {
      "linkedin": "string",
      "facebook": "string",
      "instagram": "string"
    }
  },
  "businessContext": {
    "industry": "string",
    "businessType": "string",
    "teamSize": 10,
    "currentPlatform": "string",
    "digitalPresence": ["website", "social-media"],
    "marketingChannels": ["seo", "paid-ads", "social"]
  },
  "painPoints": {
    "primaryChallenges": ["string"],
    "technicalIssues": ["string"],
    "urgencyLevel": "medium",
    "impactAssessment": "string",
    "currentSolutionGaps": ["string"]
  },
  "goalsObjectives": {
    "primaryGoals": ["string"],
    "secondaryGoals": ["string"],
    "successMetrics": ["string"],
    "kpis": ["string"],
    "timeline": {
      "desiredStart": "2025-10-01",
      "targetCompletion": "2025-12-31",
      "milestones": ["string"]
    },
    "budgetRange": "10k-25k",
    "budgetConstraints": ["string"]
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "contactInfo": { /* ... */ },
  "businessContext": { /* ... */ },
  "painPoints": { /* ... */ },
  "goalsObjectives": { /* ... */ },
  "status": "draft",
  "completionPercentage": 75,
  "createdAt": "2025-09-22T10:00:00Z",
  "updatedAt": "2025-09-22T10:00:00Z",
  "completedAt": null
}
```

### GET /consultations
List consultations with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (`draft`, `completed`, `archived`)
- `industry` (optional): Filter by business industry
- `urgency` (optional): Filter by urgency level (`low`, `medium`, `high`, `critical`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `sort` (optional): Sort field (`created_at`, `updated_at`, `business_name`)
- `order` (optional): Sort order (`asc`, `desc`, default: `desc`)
- `search` (optional): Search in business name and contact person

**Response (200 OK):**
```json
{
  "consultations": [
    {
      "id": "uuid",
      "userId": "uuid",
      "contactInfo": {
        "businessName": "string",
        "contactPerson": "string",
        "email": "string"
      },
      "businessContext": {
        "industry": "string",
        "teamSize": 10
      },
      "status": "draft",
      "completionPercentage": 75,
      "createdAt": "2025-09-22T10:00:00Z",
      "updatedAt": "2025-09-22T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### GET /consultations/{id}
Get detailed consultation information.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "contactInfo": { /* full contact info */ },
  "businessContext": { /* full business context */ },
  "painPoints": { /* full pain points */ },
  "goalsObjectives": { /* full goals */ },
  "status": "completed",
  "completionPercentage": 100,
  "createdAt": "2025-09-22T10:00:00Z",
  "updatedAt": "2025-09-22T12:00:00Z",
  "completedAt": "2025-09-22T12:00:00Z"
}
```

### PUT /consultations/{id}
Update existing consultation. Supports partial updates.

**Request Body:** Same as POST, but all fields optional
**Response (200 OK):** Updated consultation object

### DELETE /consultations/{id}
Delete consultation record.

**Response (204 No Content):** Empty response body

## Draft Management

### POST /consultations/{id}/drafts
Save consultation draft for auto-save functionality.

**Request Body:**
```json
{
  "contactInfo": { /* partial data */ },
  "businessContext": { /* partial data */ },
  "painPoints": { /* partial data */ },
  "goalsObjectives": { /* partial data */ },
  "autoSaved": true,
  "draftNotes": "Work in progress notes"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "consultationId": "uuid",
  "contactInfo": { /* ... */ },
  "businessContext": { /* ... */ },
  "painPoints": { /* ... */ },
  "goalsObjectives": { /* ... */ },
  "autoSaved": true,
  "draftNotes": "string",
  "createdAt": "2025-09-22T10:30:00Z",
  "updatedAt": "2025-09-22T10:30:00Z"
}
```

### GET /consultations/{id}/drafts
Get latest draft for consultation.

**Response (200 OK):** Draft object (same as POST response)
**Response (404 Not Found):** If no draft exists

### PUT /consultations/{id}/drafts
Update existing draft.

**Request Body:** Same as POST drafts
**Response (200 OK):** Updated draft object

### DELETE /consultations/{id}/drafts
Delete consultation draft.

**Response (204 No Content):** Empty response body

## Version History

### GET /consultations/{id}/versions
Get version history for consultation.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)

**Response (200 OK):**
```json
{
  "versions": [
    {
      "id": "uuid",
      "consultationId": "uuid",
      "versionNumber": 3,
      "changeSummary": "Updated goals and timeline",
      "changedFields": ["goalsObjectives.timeline", "status"],
      "createdAt": "2025-09-22T12:00:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

### GET /consultations/{id}/versions/{versionNumber}
Get specific version of consultation.

**Response (200 OK):** Full consultation object at specified version

## Controllers

### ConsultationController
- **CreateConsultation** - Handle POST /consultations
- **ListConsultations** - Handle GET /consultations with filtering
- **GetConsultation** - Handle GET /consultations/{id}
- **UpdateConsultation** - Handle PUT /consultations/{id}
- **DeleteConsultation** - Handle DELETE /consultations/{id}

### ConsultationDraftController
- **SaveDraft** - Handle POST /consultations/{id}/drafts
- **GetDraft** - Handle GET /consultations/{id}/drafts
- **UpdateDraft** - Handle PUT /consultations/{id}/drafts
- **DeleteDraft** - Handle DELETE /consultations/{id}/drafts

### ConsultationVersionController
- **GetVersionHistory** - Handle GET /consultations/{id}/versions
- **GetVersionDetail** - Handle GET /consultations/{id}/versions/{versionNumber}

## Error Responses

### 400 Bad Request
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "contactInfo.email": "Invalid email format",
    "painPoints.urgencyLevel": "Must be one of: low, medium, high, critical"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing authentication token"
}
```

### 403 Forbidden
```json
{
  "error": "FORBIDDEN",
  "message": "You don't have permission to access this consultation"
}
```

### 404 Not Found
```json
{
  "error": "NOT_FOUND",
  "message": "Consultation not found"
}
```

### 409 Conflict
```json
{
  "error": "CONFLICT",
  "message": "Consultation has been modified by another user",
  "details": {
    "currentVersion": 3,
    "attemptedVersion": 2
  }
}
```

### 500 Internal Server Error
```json
{
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "requestId": "uuid"
}
```