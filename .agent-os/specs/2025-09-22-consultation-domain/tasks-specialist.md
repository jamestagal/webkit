# Consultation Domain Implementation Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-22-consultation-domain/spec.md

> Created: 2025-09-22
> Status: Ready for Implementation
> Source: Go-Backend Specialist Consultation

## Overview

This implementation follows specialist recommendations to address current compilation errors and implement a complete consultation domain service following GoFast architectural patterns. All tasks follow TDD approach: write tests first, implement functionality, verify tests pass.

## Task Dependencies

```
Task 1 (Fix Issues) → Task 2 (SQLC) → Task 3 (Services) → Task 4 (Repository) → Task 5 (HTTP API)
```

---

## Task 1: Fix Current Implementation Issues

**Goal:** Resolve all compilation errors and dependency issues
**Duration:** 4-6 hours
**Prerequisites:** None

### 1.1 Write Tests for Corrected Domain Models (45 min)

**Files:**
- `app/service-core/consultation/model_test.go` (new)

**Implementation:**
```go
func TestConsultationDomain_Validation(t *testing.T) {
    tests := []struct {
        name    string
        domain  ConsultationDomain
        wantErr bool
    }{
        {
            name: "valid consultation domain",
            domain: ConsultationDomain{
                ID:          uuid.New(),
                Title:       "Test Consultation",
                Description: "Valid description",
                Status:      StatusDraft,
                Questions:   []Question{{ID: uuid.New(), Text: "Q1", Type: QuestionTypeText}},
            },
            wantErr: false,
        },
        // Add more test cases
    }
    // Test implementation
}

func TestQuestion_JSONMarshaling(t *testing.T) {
    // Test JSON serialization/deserialization
}
```

**Success Criteria:** All model tests compile and validate domain logic

### 1.2 Resolve Type Conflicts in service.go and model.go (60 min)

**Files:**
- `app/service-core/consultation/service.go`
- `app/service-core/consultation/model.go`

**Issues to Fix:**
1. Remove duplicate type declarations
2. Fix `ConsultationDomain` vs `Consultation` naming conflicts
3. Resolve import circular dependencies

**Implementation Pattern:**
```go
// In model.go - single source of truth for types
type ConsultationDomain struct {
    ID            uuid.UUID `json:"id" db:"id"`
    Title         string    `json:"title" db:"title"`
    // ... other fields
}

// In service.go - use the model types
func (s *Service) CreateConsultation(ctx context.Context, req CreateConsultationRequest) (*ConsultationDomain, error) {
    // Implementation using model types
}
```

**Success Criteria:** No compilation errors related to type redeclarations

### 1.3 Fix Undefined Query References and Imports (45 min)

**Files:**
- `app/service-core/consultation/service.go`

**Issues to Fix:**
1. Undefined `q.CreateConsultation` references
2. Missing SQLC query imports
3. Incorrect database query calls

**Implementation:**
```go
// Add proper imports
import (
    "github.com/yourusername/gofast/app/service-core/storage/query"
    // other imports
)

// Fix query calls to match SQLC generated methods
func (s *Service) CreateConsultation(ctx context.Context, req CreateConsultationRequest) (*ConsultationDomain, error) {
    // Use proper SQLC query methods once generated
    consultation, err := s.queries.CreateConsultation(ctx, query.CreateConsultationParams{
        // params
    })
    // ...
}
```

**Success Criteria:** All query references resolve correctly

### 1.4 Implement Missing Validation Schema and Functions (90 min)

**Files:**
- `app/service-core/consultation/validate.go` (new)

**Implementation Pattern (following note/validate.go):**
```go
package consultation

import (
    "github.com/yourusername/gofast/app/pkg"
)

func validateCreateConsultationRequest(req CreateConsultationRequest) error {
    var errs pkg.ValidationErrors

    if req.Title == "" {
        errs.Add("title", "Title is required")
    }
    if len(req.Title) > 200 {
        errs.Add("title", "Title must be less than 200 characters")
    }
    if req.Description == "" {
        errs.Add("description", "Description is required")
    }
    if len(req.Questions) == 0 {
        errs.Add("questions", "At least one question is required")
    }

    // Validate questions
    for i, q := range req.Questions {
        if err := validateQuestion(q, fmt.Sprintf("questions[%d]", i)); err != nil {
            errs.AddNested(fmt.Sprintf("questions[%d]", i), err)
        }
    }

    return errs.ErrorOrNil()
}

func validateQuestion(q Question, fieldPrefix string) error {
    var errs pkg.ValidationErrors

    if q.Text == "" {
        errs.Add(fieldPrefix+".text", "Question text is required")
    }
    if q.Type == "" {
        errs.Add(fieldPrefix+".type", "Question type is required")
    }

    return errs.ErrorOrNil()
}
```

**Success Criteria:** Validation functions follow GoFast patterns and handle all edge cases

### 1.5 Correct Struct Field Usage in Service Methods (30 min)

**Files:**
- `app/service-core/consultation/service.go`

**Fix Issues:**
- Incorrect field access patterns
- Missing field mappings between request/response types
- Improper UUID handling

**Success Criteria:** All struct field access is type-safe and correct

### 1.6 Verify All Compilation Errors Resolved (15 min)

**Command:**
```bash
cd app/service-core && go build ./consultation/...
```

**Success Criteria:** Clean compilation with no errors

---

## Task 2: Implement SQLC Integration

**Goal:** Generate and integrate SQLC code following GoFast patterns
**Duration:** 6-8 hours
**Prerequisites:** Task 1 complete

### 2.1 Write Tests for SQLC Generated Functions (60 min)

**Files:**
- `app/service-core/consultation/repository_test.go` (new)

**Implementation:**
```go
func TestQueries_CreateConsultation(t *testing.T) {
    db := setupTestDB(t)
    q := query.New(db)

    params := query.CreateConsultationParams{
        ID:          uuid.New(),
        Title:       "Test Consultation",
        Description: "Test Description",
        Status:      "draft",
        Questions:   []byte(`[{"id":"...","text":"Q1","type":"text"}]`),
    }

    consultation, err := q.CreateConsultation(context.Background(), params)
    require.NoError(t, err)
    assert.Equal(t, params.Title, consultation.Title)
    // Additional assertions
}
```

**Success Criteria:** Comprehensive tests for all CRUD operations

### 2.2 Complete Missing SQLC Queries for Consultation CRUD (120 min)

**Files:**
- `app/service-core/storage/sql/consultation.sql` (new)

**Implementation:**
```sql
-- name: CreateConsultation :one
INSERT INTO consultations (
    id, title, description, status, questions,
    created_at, updated_at, created_by
) VALUES (
    $1, $2, $3, $4, $5, NOW(), NOW(), $6
) RETURNING *;

-- name: GetConsultationByID :one
SELECT * FROM consultations
WHERE id = $1 AND deleted_at IS NULL;

-- name: UpdateConsultation :one
UPDATE consultations
SET title = $2, description = $3, status = $4,
    questions = $5, updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteConsultation :exec
UPDATE consultations
SET deleted_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListConsultations :many
SELECT * FROM consultations
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetConsultationsByStatus :many
SELECT * FROM consultations
WHERE status = $1 AND deleted_at IS NULL
ORDER BY created_at DESC;
```

**Success Criteria:** All essential CRUD operations defined

### 2.3 Add Draft Management Queries (90 min)

**Files:**
- `app/service-core/storage/sql/consultation_drafts.sql` (new)

**Implementation:**
```sql
-- name: UpsertConsultationDraft :one
INSERT INTO consultation_drafts (
    consultation_id, user_id, draft_data, version, updated_at
) VALUES (
    $1, $2, $3, $4, NOW()
)
ON CONFLICT (consultation_id, user_id)
DO UPDATE SET
    draft_data = $3, version = $4, updated_at = NOW()
RETURNING *;

-- name: GetConsultationDraft :one
SELECT * FROM consultation_drafts
WHERE consultation_id = $1 AND user_id = $2;

-- name: DeleteConsultationDraft :exec
DELETE FROM consultation_drafts
WHERE consultation_id = $1 AND user_id = $2;

-- name: PromoteDraftToConsultation :one
UPDATE consultations
SET title = (draft_data->>'title')::text,
    description = (draft_data->>'description')::text,
    questions = (draft_data->'questions')::jsonb,
    status = 'published',
    updated_at = NOW()
WHERE id = $1
RETURNING *;
```

**Success Criteria:** Draft workflow fully supported by database queries

### 2.4 Add Version Tracking Queries (60 min)

**Files:**
- `app/service-core/storage/sql/consultation_versions.sql` (new)

**Implementation:**
```sql
-- name: CreateConsultationVersion :one
INSERT INTO consultation_versions (
    consultation_id, version_number, title, description,
    questions, status, created_at, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, NOW(), $7
) RETURNING *;

-- name: GetConsultationVersions :many
SELECT * FROM consultation_versions
WHERE consultation_id = $1
ORDER BY version_number DESC;

-- name: GetLatestVersion :one
SELECT MAX(version_number) as latest_version
FROM consultation_versions
WHERE consultation_id = $1;
```

**Success Criteria:** Version tracking queries support audit trail

### 2.5 Generate SQLC Code Using Existing Scripts (30 min)

**Command:**
```bash
sh scripts/sqlc.sh postgres
```

**Files Generated:**
- `app/service-core/storage/query/consultation.sql.go`
- Updated `app/service-core/storage/query/models.go`

**Success Criteria:** Clean SQLC generation with no errors

### 2.6 Integrate Generated Models with Domain Services (90 min)

**Files:**
- `app/service-core/consultation/service.go`

**Implementation Pattern:**
```go
type Repository interface {
    CreateConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error)
    GetConsultationByID(ctx context.Context, id uuid.UUID) (query.Consultation, error)
    // ... other methods
}

type Service struct {
    queries Repository
    // other dependencies
}

func (s *Service) CreateConsultation(ctx context.Context, req CreateConsultationRequest) (*ConsultationDomain, error) {
    if err := validateCreateConsultationRequest(req); err != nil {
        return nil, err
    }

    questionsJSON, err := json.Marshal(req.Questions)
    if err != nil {
        return nil, pkg.InternalError(err, "failed to marshal questions")
    }

    consultation, err := s.queries.CreateConsultation(ctx, query.CreateConsultationParams{
        ID:          uuid.New(),
        Title:       req.Title,
        Description: req.Description,
        Status:      string(StatusDraft),
        Questions:   questionsJSON,
        CreatedBy:   req.CreatedBy,
    })
    if err != nil {
        return nil, pkg.InternalError(err, "failed to create consultation")
    }

    return s.mapToConsultationDomain(consultation)
}

func (s *Service) mapToConsultationDomain(c query.Consultation) (*ConsultationDomain, error) {
    var questions []Question
    if err := json.Unmarshal(c.Questions, &questions); err != nil {
        return nil, pkg.InternalError(err, "failed to unmarshal questions")
    }

    return &ConsultationDomain{
        ID:          c.ID,
        Title:       c.Title,
        Description: c.Description,
        Status:      ConsultationStatus(c.Status),
        Questions:   questions,
        CreatedAt:   c.CreatedAt,
        UpdatedAt:   c.UpdatedAt,
        CreatedBy:   c.CreatedBy,
    }, nil
}
```

**Success Criteria:** Clean integration between SQLC models and domain types

### 2.7 Verify All SQLC Integration Tests Pass (30 min)

**Command:**
```bash
cd app/service-core && go test ./consultation/... -v
```

**Success Criteria:** All tests pass with proper SQLC integration

---

## Task 3: Complete Domain Services

**Goal:** Implement complete service layer following GoFast patterns
**Duration:** 8-10 hours
**Prerequisites:** Task 2 complete

### 3.1 Write Comprehensive Service Tests (120 min)

**Files:**
- `app/service-core/consultation/service_test.go` (enhanced)

**Implementation:**
```go
func TestService_CreateConsultation(t *testing.T) {
    tests := []struct {
        name    string
        req     CreateConsultationRequest
        mockFn  func(*mocks.MockRepository)
        want    *ConsultationDomain
        wantErr string
    }{
        {
            name: "successful creation",
            req: CreateConsultationRequest{
                Title:       "Test Consultation",
                Description: "Test Description",
                Questions: []Question{
                    {ID: uuid.New(), Text: "Q1", Type: QuestionTypeText},
                },
                CreatedBy: uuid.New(),
            },
            mockFn: func(m *mocks.MockRepository) {
                m.EXPECT().CreateConsultation(gomock.Any(), gomock.Any()).
                    Return(query.Consultation{
                        ID:          uuid.New(),
                        Title:       "Test Consultation",
                        Description: "Test Description",
                        Status:      "draft",
                        Questions:   []byte(`[{"id":"...","text":"Q1","type":"text"}]`),
                    }, nil)
            },
            want: &ConsultationDomain{
                Title:       "Test Consultation",
                Description: "Test Description",
                Status:      StatusDraft,
            },
        },
        {
            name: "validation error - empty title",
            req: CreateConsultationRequest{
                Title: "",
            },
            wantErr: "title is required",
        },
        // More test cases
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctrl := gomock.NewController(t)
            defer ctrl.Finish()

            mockRepo := mocks.NewMockRepository(ctrl)
            if tt.mockFn != nil {
                tt.mockFn(mockRepo)
            }

            s := &Service{queries: mockRepo}
            got, err := s.CreateConsultation(context.Background(), tt.req)

            if tt.wantErr != "" {
                assert.Error(t, err)
                assert.Contains(t, err.Error(), tt.wantErr)
                return
            }

            require.NoError(t, err)
            assert.Equal(t, tt.want.Title, got.Title)
            // Additional assertions
        })
    }
}
```

**Success Criteria:** Comprehensive test coverage for all service methods

### 3.2 Implement Proper Repository Interface Design (60 min)

**Files:**
- `app/service-core/consultation/repository.go` (new)

**Implementation:**
```go
package consultation

import (
    "context"
    "github.com/google/uuid"
    "github.com/yourusername/gofast/app/service-core/storage/query"
)

//go:generate mockgen -source=repository.go -destination=mocks/mock_repository.go

type Repository interface {
    // Consultation CRUD
    CreateConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error)
    GetConsultationByID(ctx context.Context, id uuid.UUID) (query.Consultation, error)
    UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error)
    DeleteConsultation(ctx context.Context, id uuid.UUID) error
    ListConsultations(ctx context.Context, params query.ListConsultationsParams) ([]query.Consultation, error)
    GetConsultationsByStatus(ctx context.Context, status string) ([]query.Consultation, error)

    // Draft Management
    UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error)
    GetConsultationDraft(ctx context.Context, params query.GetConsultationDraftParams) (query.ConsultationDraft, error)
    DeleteConsultationDraft(ctx context.Context, params query.DeleteConsultationDraftParams) error
    PromoteDraftToConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error)

    // Version Management
    CreateConsultationVersion(ctx context.Context, params query.CreateConsultationVersionParams) (query.ConsultationVersion, error)
    GetConsultationVersions(ctx context.Context, consultationID uuid.UUID) ([]query.ConsultationVersion, error)
    GetLatestVersion(ctx context.Context, consultationID uuid.UUID) (int32, error)
}

// SQLCRepository implements Repository using SQLC queries
type SQLCRepository struct {
    queries *query.Queries
}

func NewSQLCRepository(queries *query.Queries) *SQLCRepository {
    return &SQLCRepository{queries: queries}
}

func (r *SQLCRepository) CreateConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error) {
    return r.queries.CreateConsultation(ctx, params)
}

// Implement all other methods...
```

**Success Criteria:** Clean separation between service and data access layers

### 3.3 Add Service Constructor with Dependency Injection (45 min)

**Files:**
- `app/service-core/consultation/service.go`

**Implementation:**
```go
type Service struct {
    repo Repository
    // other dependencies like logger, metrics, etc.
}

type ServiceConfig struct {
    Repository Repository
    // other config
}

func NewService(config ServiceConfig) *Service {
    return &Service{
        repo: config.Repository,
    }
}

// Update all methods to use r.repo instead of r.queries
func (s *Service) CreateConsultation(ctx context.Context, req CreateConsultationRequest) (*ConsultationDomain, error) {
    if err := validateCreateConsultationRequest(req); err != nil {
        return nil, err
    }

    // Implementation using s.repo
    consultation, err := s.repo.CreateConsultation(ctx, query.CreateConsultationParams{
        // params
    })
    // ...
}
```

**Success Criteria:** Service properly initialized with dependency injection

### 3.4 Implement Validation Using pkg.ValidationErrors (90 min)

**Files:**
- `app/service-core/consultation/validate.go` (enhanced)

**Implementation:**
```go
func validateUpdateConsultationRequest(req UpdateConsultationRequest) error {
    var errs pkg.ValidationErrors

    if req.ID == uuid.Nil {
        errs.Add("id", "ID is required")
    }
    if req.Title == "" {
        errs.Add("title", "Title is required")
    }

    return errs.ErrorOrNil()
}

func validateQuestion(q Question) error {
    var errs pkg.ValidationErrors

    if q.Text == "" {
        errs.Add("text", "Question text is required")
    }
    if !isValidQuestionType(q.Type) {
        errs.Add("type", "Invalid question type")
    }

    // Validate options for choice-based questions
    if isChoiceType(q.Type) && len(q.Options) == 0 {
        errs.Add("options", "Options are required for choice questions")
    }

    return errs.ErrorOrNil()
}

func isValidQuestionType(qType QuestionType) bool {
    validTypes := []QuestionType{
        QuestionTypeText,
        QuestionTypeNumber,
        QuestionTypeChoice,
        QuestionTypeMultiChoice,
        QuestionTypeRating,
    }

    for _, validType := range validTypes {
        if qType == validType {
            return true
        }
    }
    return false
}
```

**Success Criteria:** Comprehensive validation covering all business rules

### 3.5 Add JSON Marshaling/Unmarshaling for JSONB Fields (60 min)

**Files:**
- `app/service-core/consultation/model.go`

**Implementation:**
```go
type Question struct {
    ID       uuid.UUID       `json:"id"`
    Text     string          `json:"text"`
    Type     QuestionType    `json:"type"`
    Options  []QuestionOption `json:"options,omitempty"`
    Required bool            `json:"required"`
    Order    int             `json:"order"`
}

type QuestionOption struct {
    ID    uuid.UUID `json:"id"`
    Text  string    `json:"text"`
    Value string    `json:"value"`
    Order int       `json:"order"`
}

// Custom marshaling for complex types if needed
func (q *Question) MarshalJSON() ([]byte, error) {
    type Alias Question
    return json.Marshal(&struct {
        *Alias
        TypeString string `json:"type"`
    }{
        Alias:      (*Alias)(q),
        TypeString: string(q.Type),
    })
}

func (q *Question) UnmarshalJSON(data []byte) error {
    type Alias Question
    aux := &struct {
        *Alias
        TypeString string `json:"type"`
    }{
        Alias: (*Alias)(q),
    }

    if err := json.Unmarshal(data, &aux); err != nil {
        return err
    }

    q.Type = QuestionType(aux.TypeString)
    return nil
}
```

**Success Criteria:** Proper JSON handling for all complex types

### 3.6 Implement Draft-to-Consultation Promotion Logic (120 min)

**Files:**
- `app/service-core/consultation/service.go`

**Implementation:**
```go
func (s *Service) PromoteDraftToConsultation(ctx context.Context, req PromoteDraftRequest) (*ConsultationDomain, error) {
    if err := validatePromoteDraftRequest(req); err != nil {
        return nil, err
    }

    // Get current draft
    draft, err := s.repo.GetConsultationDraft(ctx, query.GetConsultationDraftParams{
        ConsultationID: req.ConsultationID,
        UserID:         req.UserID,
    })
    if err != nil {
        return nil, pkg.NotFoundError("draft not found")
    }

    // Validate draft data
    var draftData ConsultationDraftData
    if err := json.Unmarshal(draft.DraftData, &draftData); err != nil {
        return nil, pkg.InternalError(err, "invalid draft data")
    }

    if err := validateDraftData(draftData); err != nil {
        return nil, err
    }

    // Check for version conflicts
    latestVersion, err := s.repo.GetLatestVersion(ctx, req.ConsultationID)
    if err != nil {
        return nil, pkg.InternalError(err, "failed to get latest version")
    }

    if draft.Version < latestVersion {
        return nil, pkg.ValidationError("draft is outdated, please refresh and try again")
    }

    // Promote draft to consultation
    consultation, err := s.repo.PromoteDraftToConsultation(ctx, req.ConsultationID)
    if err != nil {
        return nil, pkg.InternalError(err, "failed to promote draft")
    }

    // Create version entry
    _, err = s.repo.CreateConsultationVersion(ctx, query.CreateConsultationVersionParams{
        ConsultationID: consultation.ID,
        VersionNumber:  latestVersion + 1,
        Title:          consultation.Title,
        Description:    consultation.Description,
        Questions:      consultation.Questions,
        Status:         consultation.Status,
        CreatedBy:      req.UserID,
    })
    if err != nil {
        // Log error but don't fail the promotion
        // Version tracking is audit trail, not critical path
    }

    // Delete the draft
    if err := s.repo.DeleteConsultationDraft(ctx, query.DeleteConsultationDraftParams{
        ConsultationID: req.ConsultationID,
        UserID:         req.UserID,
    }); err != nil {
        // Log error but don't fail
    }

    return s.mapToConsultationDomain(consultation)
}
```

**Success Criteria:** Draft promotion handles conflicts and maintains data integrity

### 3.7 Add Version Tracking and Conflict Resolution (90 min)

**Files:**
- `app/service-core/consultation/service.go`

**Implementation:**
```go
func (s *Service) SaveDraft(ctx context.Context, req SaveDraftRequest) (*ConsultationDraft, error) {
    if err := validateSaveDraftRequest(req); err != nil {
        return nil, err
    }

    // Get current consultation for conflict detection
    consultation, err := s.repo.GetConsultationByID(ctx, req.ConsultationID)
    if err != nil {
        return nil, pkg.NotFoundError("consultation not found")
    }

    // Get latest version
    latestVersion, err := s.repo.GetLatestVersion(ctx, req.ConsultationID)
    if err != nil {
        latestVersion = 1 // First version
    }

    // Check if user's draft is based on latest version
    if req.BaseVersion < latestVersion {
        return nil, &pkg.ConflictError{
            Message: "consultation has been updated since your draft was created",
            Details: map[string]interface{}{
                "current_version": latestVersion,
                "draft_version":   req.BaseVersion,
            },
        }
    }

    draftData, err := json.Marshal(req.DraftData)
    if err != nil {
        return nil, pkg.InternalError(err, "failed to marshal draft data")
    }

    draft, err := s.repo.UpsertConsultationDraft(ctx, query.UpsertConsultationDraftParams{
        ConsultationID: req.ConsultationID,
        UserID:         req.UserID,
        DraftData:      draftData,
        Version:        latestVersion,
    })
    if err != nil {
        return nil, pkg.InternalError(err, "failed to save draft")
    }

    return s.mapToConsultationDraft(draft)
}

func (s *Service) GetConsultationWithConflictInfo(ctx context.Context, consultationID uuid.UUID, userID uuid.UUID) (*ConsultationWithDraft, error) {
    consultation, err := s.repo.GetConsultationByID(ctx, consultationID)
    if err != nil {
        return nil, pkg.NotFoundError("consultation not found")
    }

    domain, err := s.mapToConsultationDomain(consultation)
    if err != nil {
        return nil, err
    }

    result := &ConsultationWithDraft{
        Consultation: domain,
    }

    // Check for user's draft
    draft, err := s.repo.GetConsultationDraft(ctx, query.GetConsultationDraftParams{
        ConsultationID: consultationID,
        UserID:         userID,
    })
    if err == nil {
        draftDomain, err := s.mapToConsultationDraft(draft)
        if err == nil {
            result.Draft = draftDomain

            // Check for conflicts
            latestVersion, _ := s.repo.GetLatestVersion(ctx, consultationID)
            if draft.Version < latestVersion {
                result.HasConflict = true
                result.ConflictInfo = &ConflictInfo{
                    DraftVersion:   draft.Version,
                    CurrentVersion: latestVersion,
                    Message:        "Your draft is based on an older version",
                }
            }
        }
    }

    return result, nil
}
```

**Success Criteria:** Version conflicts properly detected and user-friendly resolution

### 3.8 Verify All Domain Service Tests Pass (30 min)

**Command:**
```bash
cd app/service-core && go test ./consultation/... -v -race
```

**Success Criteria:** All service tests pass with race detection

---

## Task 4: Add Repository Layer

**Goal:** Implement clean repository layer with proper error handling
**Duration:** 6-8 hours
**Prerequisites:** Task 3 complete

### 4.1 Write Repository Interface and Implementation Tests (90 min)

**Files:**
- `app/service-core/consultation/repository_integration_test.go` (new)

**Implementation:**
```go
func TestSQLCRepository_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }

    db := setupTestDB(t)
    queries := query.New(db)
    repo := NewSQLCRepository(queries)

    t.Run("CreateConsultation", func(t *testing.T) {
        params := query.CreateConsultationParams{
            ID:          uuid.New(),
            Title:       "Integration Test",
            Description: "Test Description",
            Status:      "draft",
            Questions:   []byte(`[{"id":"test","text":"Q1","type":"text"}]`),
            CreatedBy:   uuid.New(),
        }

        consultation, err := repo.CreateConsultation(context.Background(), params)
        require.NoError(t, err)
        assert.Equal(t, params.Title, consultation.Title)
        assert.NotZero(t, consultation.CreatedAt)
    })

    t.Run("GetConsultationByID_NotFound", func(t *testing.T) {
        _, err := repo.GetConsultationByID(context.Background(), uuid.New())
        assert.Error(t, err)
        // Verify it's the right type of error
    })

    // More integration tests
}
```

**Success Criteria:** Comprehensive integration tests for repository layer

### 4.2 Create Repository Interfaces Matching SQLC Patterns (60 min)

**Files:**
- `app/service-core/consultation/repository.go` (enhanced)

**Implementation:**
```go
// Extend the Repository interface with transaction support
type Repository interface {
    // ... existing methods

    // Transaction support
    WithTx(tx *sql.Tx) Repository
    BeginTx(ctx context.Context) (*sql.Tx, error)
}

type SQLCRepository struct {
    queries *query.Queries
    db      *sql.DB
}

func NewSQLCRepository(db *sql.DB) *SQLCRepository {
    return &SQLCRepository{
        queries: query.New(db),
        db:      db,
    }
}

func (r *SQLCRepository) WithTx(tx *sql.Tx) Repository {
    return &SQLCRepository{
        queries: r.queries.WithTx(tx),
        db:      r.db,
    }
}

func (r *SQLCRepository) BeginTx(ctx context.Context) (*sql.Tx, error) {
    return r.db.BeginTx(ctx, nil)
}

// Error handling wrapper
func (r *SQLCRepository) CreateConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error) {
    consultation, err := r.queries.CreateConsultation(ctx, params)
    if err != nil {
        return query.Consultation{}, r.handleDBError(err, "create consultation")
    }
    return consultation, nil
}

func (r *SQLCRepository) handleDBError(err error, operation string) error {
    if err == nil {
        return nil
    }

    // Handle specific database errors
    if err == sql.ErrNoRows {
        return pkg.NotFoundError("resource not found")
    }

    // Handle constraint violations
    if isUniqueViolation(err) {
        return pkg.ValidationError("resource already exists")
    }

    if isForeignKeyViolation(err) {
        return pkg.ValidationError("invalid reference")
    }

    // Default to internal error
    return pkg.InternalError(err, fmt.Sprintf("database error during %s", operation))
}
```

**Success Criteria:** Repository properly abstracts database operations

### 4.3 Implement Transaction Handling for Complex Operations (90 min)

**Files:**
- `app/service-core/consultation/service.go`

**Implementation:**
```go
func (s *Service) PromoteDraftToConsultation(ctx context.Context, req PromoteDraftRequest) (*ConsultationDomain, error) {
    // Start transaction for complex operation
    tx, err := s.repo.BeginTx(ctx)
    if err != nil {
        return nil, pkg.InternalError(err, "failed to begin transaction")
    }
    defer tx.Rollback() // Safe to call even after commit

    txRepo := s.repo.WithTx(tx)

    // Get and validate draft
    draft, err := txRepo.GetConsultationDraft(ctx, query.GetConsultationDraftParams{
        ConsultationID: req.ConsultationID,
        UserID:         req.UserID,
    })
    if err != nil {
        return nil, pkg.NotFoundError("draft not found")
    }

    // Validate and promote
    consultation, err := txRepo.PromoteDraftToConsultation(ctx, req.ConsultationID)
    if err != nil {
        return nil, pkg.InternalError(err, "failed to promote draft")
    }

    // Create version record
    latestVersion, _ := txRepo.GetLatestVersion(ctx, req.ConsultationID)
    _, err = txRepo.CreateConsultationVersion(ctx, query.CreateConsultationVersionParams{
        ConsultationID: consultation.ID,
        VersionNumber:  latestVersion + 1,
        Title:          consultation.Title,
        Description:    consultation.Description,
        Questions:      consultation.Questions,
        Status:         consultation.Status,
        CreatedBy:      req.UserID,
    })
    if err != nil {
        return nil, pkg.InternalError(err, "failed to create version record")
    }

    // Delete draft
    err = txRepo.DeleteConsultationDraft(ctx, query.DeleteConsultationDraftParams{
        ConsultationID: req.ConsultationID,
        UserID:         req.UserID,
    })
    if err != nil {
        return nil, pkg.InternalError(err, "failed to delete draft")
    }

    // Commit transaction
    if err := tx.Commit(); err != nil {
        return nil, pkg.InternalError(err, "failed to commit transaction")
    }

    return s.mapToConsultationDomain(consultation)
}
```

**Success Criteria:** Complex operations maintain data consistency

### 4.4 Add Proper Error Handling with GoFast Error Types (60 min)

**Files:**
- `app/service-core/consultation/errors.go` (new)

**Implementation:**
```go
package consultation

import (
    "database/sql/driver"
    "strings"
    "github.com/lib/pq"
    "github.com/yourusername/gofast/app/pkg"
)

// Database error detection helpers
func isUniqueViolation(err error) bool {
    if pqErr, ok := err.(*pq.Error); ok {
        return pqErr.Code == "23505" // unique_violation
    }
    return false
}

func isForeignKeyViolation(err error) bool {
    if pqErr, ok := err.(*pq.Error); ok {
        return pqErr.Code == "23503" // foreign_key_violation
    }
    return false
}

func isCheckViolation(err error) bool {
    if pqErr, ok := err.(*pq.Error); ok {
        return pqErr.Code == "23514" // check_violation
    }
    return false
}

// Business logic errors
var (
    ErrConsultationNotFound    = pkg.NotFoundError("consultation not found")
    ErrDraftNotFound          = pkg.NotFoundError("draft not found")
    ErrVersionConflict        = pkg.ConflictError{Message: "version conflict"}
    ErrInvalidStatus          = pkg.ValidationError("invalid consultation status")
    ErrCannotDeletePublished  = pkg.ValidationError("cannot delete published consultation")
)

// Error mapping for common scenarios
func mapConsultationError(err error, operation string) error {
    if err == nil {
        return nil
    }

    if err == sql.ErrNoRows {
        switch operation {
        case "get_consultation":
            return ErrConsultationNotFound
        case "get_draft":
            return ErrDraftNotFound
        default:
            return pkg.NotFoundError("resource not found")
        }
    }

    if isUniqueViolation(err) {
        if strings.Contains(err.Error(), "consultations_title_key") {
            return pkg.ValidationError("consultation with this title already exists")
        }
        return pkg.ValidationError("duplicate resource")
    }

    if isCheckViolation(err) {
        if strings.Contains(err.Error(), "status_check") {
            return ErrInvalidStatus
        }
        return pkg.ValidationError("constraint violation")
    }

    return pkg.InternalError(err, fmt.Sprintf("database error during %s", operation))
}
```

**Success Criteria:** Proper error types for all scenarios

### 4.5 Implement Context Handling and Timeout Management (45 min)

**Files:**
- `app/service-core/consultation/service.go`

**Implementation:**
```go
import (
    "context"
    "time"
)

const (
    DefaultOperationTimeout = 30 * time.Second
    DefaultQueryTimeout     = 10 * time.Second
)

func (s *Service) CreateConsultation(ctx context.Context, req CreateConsultationRequest) (*ConsultationDomain, error) {
    // Add timeout for database operations
    ctx, cancel := context.WithTimeout(ctx, DefaultOperationTimeout)
    defer cancel()

    if err := validateCreateConsultationRequest(req); err != nil {
        return nil, err
    }

    // Check context before expensive operations
    select {
    case <-ctx.Done():
        return nil, pkg.TimeoutError("operation cancelled")
    default:
    }

    questionsJSON, err := json.Marshal(req.Questions)
    if err != nil {
        return nil, pkg.InternalError(err, "failed to marshal questions")
    }

    consultation, err := s.repo.CreateConsultation(ctx, query.CreateConsultationParams{
        ID:          uuid.New(),
        Title:       req.Title,
        Description: req.Description,
        Status:      string(StatusDraft),
        Questions:   questionsJSON,
        CreatedBy:   req.CreatedBy,
    })
    if err != nil {
        return nil, err // Repository handles error mapping
    }

    return s.mapToConsultationDomain(consultation)
}

func (s *Service) ListConsultations(ctx context.Context, req ListConsultationsRequest) (*ListConsultationsResponse, error) {
    // Shorter timeout for list operations
    ctx, cancel := context.WithTimeout(ctx, DefaultQueryTimeout)
    defer cancel()

    consultations, err := s.repo.ListConsultations(ctx, query.ListConsultationsParams{
        Limit:  req.Limit,
        Offset: req.Offset,
    })
    if err != nil {
        return nil, err
    }

    result := &ListConsultationsResponse{
        Consultations: make([]*ConsultationDomain, len(consultations)),
        Total:         len(consultations), // Would need count query for real total
    }

    for i, c := range consultations {
        domain, err := s.mapToConsultationDomain(c)
        if err != nil {
            return nil, err
        }
        result.Consultations[i] = domain
    }

    return result, nil
}
```

**Success Criteria:** Proper timeout handling prevents hanging operations

### 4.6 Verify All Repository Tests Pass (30 min)

**Command:**
```bash
cd app/service-core && go test ./consultation/... -v -race -tags=integration
```

**Success Criteria:** All repository tests pass including integration tests

---

## Task 5: Implement HTTP API Layer

**Goal:** Create REST endpoints following GoFast patterns
**Duration:** 8-10 hours
**Prerequisites:** Task 4 complete

### 5.1 Write HTTP Handler Tests with Mock Services (120 min)

**Files:**
- `app/service-core/consultation/handler_test.go` (new)

**Implementation:**
```go
func TestHandler_CreateConsultation(t *testing.T) {
    tests := []struct {
        name       string
        body       string
        mockFn     func(*mocks.MockService)
        wantStatus int
        wantBody   string
    }{
        {
            name: "successful creation",
            body: `{
                "title": "Test Consultation",
                "description": "Test Description",
                "questions": [
                    {"text": "Question 1", "type": "text", "required": true}
                ]
            }`,
            mockFn: func(m *mocks.MockService) {
                m.EXPECT().CreateConsultation(gomock.Any(), gomock.Any()).
                    Return(&ConsultationDomain{
                        ID:          uuid.New(),
                        Title:       "Test Consultation",
                        Description: "Test Description",
                        Status:      StatusDraft,
                    }, nil)
            },
            wantStatus: http.StatusCreated,
            wantBody:   `"title":"Test Consultation"`,
        },
        {
            name:       "invalid JSON",
            body:       `{invalid json}`,
            wantStatus: http.StatusBadRequest,
            wantBody:   `"error":"invalid request body"`,
        },
        {
            name: "validation error",
            body: `{"title": "", "description": "test"}`,
            mockFn: func(m *mocks.MockService) {
                m.EXPECT().CreateConsultation(gomock.Any(), gomock.Any()).
                    Return(nil, pkg.ValidationError("title is required"))
            },
            wantStatus: http.StatusBadRequest,
            wantBody:   `"error":"title is required"`,
        },
        // More test cases
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctrl := gomock.NewController(t)
            defer ctrl.Finish()

            mockService := mocks.NewMockService(ctrl)
            if tt.mockFn != nil {
                tt.mockFn(mockService)
            }

            handler := NewHandler(mockService)

            req := httptest.NewRequest("POST", "/consultations", strings.NewReader(tt.body))
            req.Header.Set("Content-Type", "application/json")
            w := httptest.NewRecorder()

            handler.CreateConsultation(w, req)

            assert.Equal(t, tt.wantStatus, w.Code)
            if tt.wantBody != "" {
                assert.Contains(t, w.Body.String(), tt.wantBody)
            }
        })
    }
}
```

**Success Criteria:** Comprehensive handler test coverage

### 5.2 Create REST Endpoints Following GoFast Patterns (180 min)

**Files:**
- `app/service-core/consultation/handler.go` (new)

**Implementation:**
```go
package consultation

import (
    "encoding/json"
    "net/http"
    "strconv"

    "github.com/gorilla/mux"
    "github.com/google/uuid"
    "github.com/yourusername/gofast/app/pkg"
)

type Handler struct {
    service ConsultationService
}

type ConsultationService interface {
    CreateConsultation(ctx context.Context, req CreateConsultationRequest) (*ConsultationDomain, error)
    GetConsultationByID(ctx context.Context, id uuid.UUID) (*ConsultationDomain, error)
    UpdateConsultation(ctx context.Context, req UpdateConsultationRequest) (*ConsultationDomain, error)
    DeleteConsultation(ctx context.Context, id uuid.UUID) error
    ListConsultations(ctx context.Context, req ListConsultationsRequest) (*ListConsultationsResponse, error)

    SaveDraft(ctx context.Context, req SaveDraftRequest) (*ConsultationDraft, error)
    GetDraft(ctx context.Context, consultationID, userID uuid.UUID) (*ConsultationDraft, error)
    PromoteDraftToConsultation(ctx context.Context, req PromoteDraftRequest) (*ConsultationDomain, error)
}

func NewHandler(service ConsultationService) *Handler {
    return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r *mux.Router) {
    // Consultation CRUD
    r.HandleFunc("/consultations", h.CreateConsultation).Methods("POST")
    r.HandleFunc("/consultations", h.ListConsultations).Methods("GET")
    r.HandleFunc("/consultations/{id}", h.GetConsultation).Methods("GET")
    r.HandleFunc("/consultations/{id}", h.UpdateConsultation).Methods("PUT")
    r.HandleFunc("/consultations/{id}", h.DeleteConsultation).Methods("DELETE")

    // Draft management
    r.HandleFunc("/consultations/{id}/drafts", h.SaveDraft).Methods("POST")
    r.HandleFunc("/consultations/{id}/drafts", h.GetDraft).Methods("GET")
    r.HandleFunc("/consultations/{id}/drafts/promote", h.PromoteDraft).Methods("POST")
}

func (h *Handler) CreateConsultation(w http.ResponseWriter, r *http.Request) {
    var req CreateConsultationRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid request body")
        return
    }

    // Get user ID from context (set by auth middleware)
    userID, ok := pkg.GetUserID(r.Context())
    if !ok {
        pkg.WriteError(w, http.StatusUnauthorized, "authentication required")
        return
    }
    req.CreatedBy = userID

    consultation, err := h.service.CreateConsultation(r.Context(), req)
    if err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    pkg.WriteJSON(w, http.StatusCreated, consultation)
}

func (h *Handler) GetConsultation(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id, err := uuid.Parse(vars["id"])
    if err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid consultation ID")
        return
    }

    consultation, err := h.service.GetConsultationByID(r.Context(), id)
    if err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    pkg.WriteJSON(w, http.StatusOK, consultation)
}

func (h *Handler) UpdateConsultation(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id, err := uuid.Parse(vars["id"])
    if err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid consultation ID")
        return
    }

    var req UpdateConsultationRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid request body")
        return
    }
    req.ID = id

    // Get user ID from context
    userID, ok := pkg.GetUserID(r.Context())
    if !ok {
        pkg.WriteError(w, http.StatusUnauthorized, "authentication required")
        return
    }
    req.UpdatedBy = userID

    consultation, err := h.service.UpdateConsultation(r.Context(), req)
    if err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    pkg.WriteJSON(w, http.StatusOK, consultation)
}

func (h *Handler) DeleteConsultation(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id, err := uuid.Parse(vars["id"])
    if err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid consultation ID")
        return
    }

    if err := h.service.DeleteConsultation(r.Context(), id); err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListConsultations(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query()

    limit := 50 // default
    if l := query.Get("limit"); l != "" {
        if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
            limit = parsed
        }
    }

    offset := 0
    if o := query.Get("offset"); o != "" {
        if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
            offset = parsed
        }
    }

    req := ListConsultationsRequest{
        Limit:  int32(limit),
        Offset: int32(offset),
        Status: query.Get("status"),
    }

    response, err := h.service.ListConsultations(r.Context(), req)
    if err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    pkg.WriteJSON(w, http.StatusOK, response)
}

func (h *Handler) SaveDraft(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    consultationID, err := uuid.Parse(vars["id"])
    if err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid consultation ID")
        return
    }

    userID, ok := pkg.GetUserID(r.Context())
    if !ok {
        pkg.WriteError(w, http.StatusUnauthorized, "authentication required")
        return
    }

    var req SaveDraftRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid request body")
        return
    }
    req.ConsultationID = consultationID
    req.UserID = userID

    draft, err := h.service.SaveDraft(r.Context(), req)
    if err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    pkg.WriteJSON(w, http.StatusOK, draft)
}

func (h *Handler) GetDraft(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    consultationID, err := uuid.Parse(vars["id"])
    if err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid consultation ID")
        return
    }

    userID, ok := pkg.GetUserID(r.Context())
    if !ok {
        pkg.WriteError(w, http.StatusUnauthorized, "authentication required")
        return
    }

    draft, err := h.service.GetDraft(r.Context(), consultationID, userID)
    if err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    pkg.WriteJSON(w, http.StatusOK, draft)
}

func (h *Handler) PromoteDraft(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    consultationID, err := uuid.Parse(vars["id"])
    if err != nil {
        pkg.WriteError(w, http.StatusBadRequest, "invalid consultation ID")
        return
    }

    userID, ok := pkg.GetUserID(r.Context())
    if !ok {
        pkg.WriteError(w, http.StatusUnauthorized, "authentication required")
        return
    }

    req := PromoteDraftRequest{
        ConsultationID: consultationID,
        UserID:         userID,
    }

    consultation, err := h.service.PromoteDraftToConsultation(r.Context(), req)
    if err != nil {
        pkg.HandleServiceError(w, err)
        return
    }

    pkg.WriteJSON(w, http.StatusOK, consultation)
}
```

**Success Criteria:** REST endpoints follow GoFast conventions

### 5.3 Add Authentication Middleware Integration (60 min)

**Files:**
- `app/service-core/consultation/middleware.go` (new)

**Implementation:**
```go
package consultation

import (
    "context"
    "net/http"
    "github.com/yourusername/gofast/app/pkg"
)

// AuthMiddleware ensures request has valid authentication
func (h *Handler) AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // This would typically be handled by the main application
        // but we can add consultation-specific auth logic here

        userID, ok := pkg.GetUserID(r.Context())
        if !ok {
            pkg.WriteError(w, http.StatusUnauthorized, "authentication required")
            return
        }

        // Add any consultation-specific authorization logic
        ctx := context.WithValue(r.Context(), "authenticated_user_id", userID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Permission-based middleware for specific operations
func (h *Handler) RequireConsultationAccess(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userID, ok := pkg.GetUserID(r.Context())
        if !ok {
            pkg.WriteError(w, http.StatusUnauthorized, "authentication required")
            return
        }

        // Extract consultation ID from URL
        vars := mux.Vars(r)
        consultationID, err := uuid.Parse(vars["id"])
        if err != nil {
            pkg.WriteError(w, http.StatusBadRequest, "invalid consultation ID")
            return
        }

        // Check if user has access to this consultation
        // This could be based on ownership, permissions, etc.
        hasAccess, err := h.service.CheckUserAccess(r.Context(), consultationID, userID)
        if err != nil {
            pkg.HandleServiceError(w, err)
            return
        }

        if !hasAccess {
            pkg.WriteError(w, http.StatusForbidden, "access denied")
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

**Success Criteria:** Proper authentication and authorization

### 5.4 Implement Request/Response Validation (90 min)

**Files:**
- `app/service-core/consultation/dto.go` (new)

**Implementation:**
```go
package consultation

import (
    "time"
    "github.com/google/uuid"
)

// Request DTOs
type CreateConsultationRequest struct {
    Title       string     `json:"title" validate:"required,max=200"`
    Description string     `json:"description" validate:"required,max=2000"`
    Questions   []Question `json:"questions" validate:"required,min=1,dive"`
    CreatedBy   uuid.UUID  `json:"-"` // Set from auth context
}

type UpdateConsultationRequest struct {
    ID          uuid.UUID  `json:"-"` // From URL path
    Title       string     `json:"title" validate:"required,max=200"`
    Description string     `json:"description" validate:"required,max=2000"`
    Questions   []Question `json:"questions" validate:"required,min=1,dive"`
    UpdatedBy   uuid.UUID  `json:"-"` // Set from auth context
}

type ListConsultationsRequest struct {
    Limit  int32  `json:"limit" validate:"min=1,max=100"`
    Offset int32  `json:"offset" validate:"min=0"`
    Status string `json:"status" validate:"omitempty,oneof=draft published archived"`
}

type SaveDraftRequest struct {
    ConsultationID uuid.UUID              `json:"-"`                    // From URL
    UserID         uuid.UUID              `json:"-"`                    // From auth
    DraftData      ConsultationDraftData  `json:"draft_data" validate:"required"`
    BaseVersion    int32                  `json:"base_version" validate:"min=1"`
}

type PromoteDraftRequest struct {
    ConsultationID uuid.UUID `json:"-"` // From URL
    UserID         uuid.UUID `json:"-"` // From auth
}

// Response DTOs
type ListConsultationsResponse struct {
    Consultations []*ConsultationDomain `json:"consultations"`
    Total         int                   `json:"total"`
    Limit         int32                 `json:"limit"`
    Offset        int32                 `json:"offset"`
}

type ConsultationWithDraft struct {
    Consultation *ConsultationDomain `json:"consultation"`
    Draft        *ConsultationDraft  `json:"draft,omitempty"`
    HasConflict  bool               `json:"has_conflict"`
    ConflictInfo *ConflictInfo      `json:"conflict_info,omitempty"`
}

type ConflictInfo struct {
    DraftVersion   int32  `json:"draft_version"`
    CurrentVersion int32  `json:"current_version"`
    Message        string `json:"message"`
}

// Validation helpers
func (r *CreateConsultationRequest) Validate() error {
    return pkg.ValidateStruct(r)
}

func (r *UpdateConsultationRequest) Validate() error {
    return pkg.ValidateStruct(r)
}

func (r *ListConsultationsRequest) Validate() error {
    if r.Limit == 0 {
        r.Limit = 50 // default
    }
    return pkg.ValidateStruct(r)
}
```

**Success Criteria:** Proper validation for all request/response types

### 5.5 Add Proper Error Handling and Status Codes (60 min)

**Files:**
- `app/service-core/consultation/handler.go` (enhanced)

**Implementation:**
```go
// Update pkg.HandleServiceError to map consultation-specific errors
func HandleConsultationError(w http.ResponseWriter, err error) {
    switch {
    case pkg.IsNotFoundError(err):
        pkg.WriteError(w, http.StatusNotFound, err.Error())
    case pkg.IsValidationError(err):
        pkg.WriteError(w, http.StatusBadRequest, err.Error())
    case pkg.IsConflictError(err):
        pkg.WriteError(w, http.StatusConflict, err.Error())
    case pkg.IsUnauthorizedError(err):
        pkg.WriteError(w, http.StatusUnauthorized, err.Error())
    case pkg.IsForbiddenError(err):
        pkg.WriteError(w, http.StatusForbidden, err.Error())
    case pkg.IsTimeoutError(err):
        pkg.WriteError(w, http.StatusRequestTimeout, err.Error())
    default:
        pkg.WriteError(w, http.StatusInternalServerError, "internal server error")
    }
}

// Enhanced error responses with details
type ErrorResponse struct {
    Error   string                 `json:"error"`
    Code    string                 `json:"code,omitempty"`
    Details map[string]interface{} `json:"details,omitempty"`
}

func WriteConsultationError(w http.ResponseWriter, statusCode int, err error) {
    response := ErrorResponse{
        Error: err.Error(),
    }

    // Add specific error details for different types
    if validationErr, ok := err.(*pkg.ValidationErrors); ok {
        response.Code = "VALIDATION_ERROR"
        response.Details = map[string]interface{}{
            "fields": validationErr.Fields(),
        }
    } else if conflictErr, ok := err.(*pkg.ConflictError); ok {
        response.Code = "CONFLICT"
        response.Details = conflictErr.Details
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(response)
}
```

**Success Criteria:** Comprehensive error handling with appropriate status codes

### 5.6 Integrate with Existing GoFast Routing Patterns (90 min)

**Files:**
- `app/service-core/main.go` (update)
- `app/service-core/consultation/routes.go` (new)

**Implementation:**
```go
// In routes.go
package consultation

import (
    "database/sql"
    "github.com/gorilla/mux"
    "github.com/yourusername/gofast/app/service-core/storage/query"
)

func RegisterConsultationRoutes(r *mux.Router, db *sql.DB) {
    // Create service dependencies
    queries := query.New(db)
    repo := NewSQLCRepository(queries)
    service := NewService(ServiceConfig{
        Repository: repo,
    })
    handler := NewHandler(service)

    // Create subrouter for consultations
    consultationRouter := r.PathPrefix("/api/v1").Subrouter()

    // Apply middleware
    consultationRouter.Use(handler.AuthMiddleware)

    // Register routes
    handler.RegisterRoutes(consultationRouter)

    // Add protected routes that require additional permissions
    protectedRouter := consultationRouter.PathPrefix("").Subrouter()
    protectedRouter.Use(handler.RequireConsultationAccess)

    // These routes check consultation-specific permissions
    protectedRouter.HandleFunc("/consultations/{id}", handler.UpdateConsultation).Methods("PUT")
    protectedRouter.HandleFunc("/consultations/{id}", handler.DeleteConsultation).Methods("DELETE")
    protectedRouter.HandleFunc("/consultations/{id}/drafts", handler.SaveDraft).Methods("POST")
    protectedRouter.HandleFunc("/consultations/{id}/drafts/promote", handler.PromoteDraft).Methods("POST")
}

// In main.go (update to include consultation routes)
func setupRoutes(r *mux.Router, db *sql.DB) {
    // ... existing routes

    // Register consultation routes
    consultation.RegisterConsultationRoutes(r, db)
}
```

**Success Criteria:** Seamless integration with GoFast routing

### 5.7 Verify All API Integration Tests Pass (60 min)

**Files:**
- `app/service-core/consultation/integration_test.go` (new)

**Implementation:**
```go
func TestConsultationAPI_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }

    // Setup test server
    db := setupTestDB(t)
    server := setupTestServer(t, db)
    defer server.Close()

    client := &http.Client{}

    t.Run("Create and retrieve consultation", func(t *testing.T) {
        // Create consultation
        createReq := CreateConsultationRequest{
            Title:       "Integration Test Consultation",
            Description: "Test Description",
            Questions: []Question{
                {
                    Text:     "Test Question",
                    Type:     QuestionTypeText,
                    Required: true,
                    Order:    1,
                },
            },
        }

        body, _ := json.Marshal(createReq)
        req, _ := http.NewRequest("POST", server.URL+"/api/v1/consultations", bytes.NewReader(body))
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", "Bearer "+getTestToken(t))

        resp, err := client.Do(req)
        require.NoError(t, err)
        defer resp.Body.Close()

        assert.Equal(t, http.StatusCreated, resp.StatusCode)

        var consultation ConsultationDomain
        err = json.NewDecoder(resp.Body).Decode(&consultation)
        require.NoError(t, err)

        assert.Equal(t, createReq.Title, consultation.Title)
        assert.Equal(t, StatusDraft, consultation.Status)

        // Retrieve consultation
        req, _ = http.NewRequest("GET", server.URL+"/api/v1/consultations/"+consultation.ID.String(), nil)
        req.Header.Set("Authorization", "Bearer "+getTestToken(t))

        resp, err = client.Do(req)
        require.NoError(t, err)
        defer resp.Body.Close()

        assert.Equal(t, http.StatusOK, resp.StatusCode)
    })

    t.Run("Draft workflow", func(t *testing.T) {
        // Test draft save, update, and promotion
        // Implementation details...
    })

    t.Run("Error handling", func(t *testing.T) {
        // Test various error scenarios
        // Implementation details...
    })
}

func setupTestServer(t *testing.T, db *sql.DB) *httptest.Server {
    r := mux.NewRouter()
    consultation.RegisterConsultationRoutes(r, db)
    return httptest.NewServer(r)
}

func getTestToken(t *testing.T) string {
    // Return a valid test JWT token
    return "test-jwt-token"
}
```

**Success Criteria:** All API integration tests pass

---

## Success Criteria for Overall Implementation

### Compilation and Testing
1. All Go code compiles without errors
2. All unit tests pass with >90% coverage
3. All integration tests pass
4. Race condition tests pass

### Code Quality
1. Follows GoFast architectural patterns exactly
2. Proper error handling using pkg error types
3. SQLC integration matches existing services
4. Clean separation of concerns (handler -> service -> repository)

### Functionality
1. Complete CRUD operations for consultations
2. Draft management with conflict resolution
3. Version tracking and audit trail
4. Proper authentication and authorization
5. REST API following GoFast conventions

### Documentation and Maintenance
1. Comprehensive test coverage
2. Clear interface definitions
3. Proper error messages for all scenarios
4. Integration with existing GoFast infrastructure

## Implementation Notes

### TDD Approach
Each task follows Test-Driven Development:
1. Write failing tests first
2. Implement minimal code to pass tests
3. Refactor while keeping tests green
4. Verify comprehensive test coverage

### Error Handling
- Use pkg.ValidationErrors for input validation
- Use pkg.NotFoundError for missing resources
- Use pkg.ConflictError for version conflicts
- Use pkg.InternalError for system errors
- Use pkg.TimeoutError for context timeouts

### Database Patterns
- Follow SQLC naming conventions
- Use transactions for complex operations
- Implement proper error mapping
- Handle context cancellation correctly

### API Design
- RESTful endpoints with proper HTTP methods
- Consistent JSON request/response formats
- Appropriate HTTP status codes
- Authentication via JWT tokens
- Input validation and sanitization

This implementation plan ensures the consultation domain service integrates seamlessly with the existing GoFast architecture while providing robust functionality for consultation management.