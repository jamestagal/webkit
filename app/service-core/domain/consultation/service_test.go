package consultation

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"service-core/storage/query"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) CountConsultations(ctx context.Context, userID uuid.UUID) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockRepository) SelectConsultations(ctx context.Context, params query.ListConsultationsByUserParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) SelectConsultationsByStatus(ctx context.Context, params query.ListConsultationsByStatusParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) SelectConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockRepository) InsertConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockRepository) UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockRepository) UpdateConsultationStatus(ctx context.Context, params query.UpdateConsultationStatusParams) (query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockRepository) DeleteConsultation(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) SelectConsultationDraft(ctx context.Context, params query.GetConsultationDraftByUserParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockRepository) InsertConsultationDraft(ctx context.Context, params query.CreateConsultationDraftParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockRepository) UpdateConsultationDraft(ctx context.Context, params query.UpdateConsultationDraftParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockRepository) UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockRepository) DeleteConsultationDraft(ctx context.Context, consultationID uuid.UUID) error {
	args := m.Called(ctx, consultationID)
	return args.Error(0)
}

func (m *MockRepository) DeleteConsultationDraftByUser(ctx context.Context, params query.DeleteConsultationDraftByUserParams) error {
	args := m.Called(ctx, params)
	return args.Error(0)
}

func (m *MockRepository) CleanupOldDrafts(ctx context.Context, params CleanupOldDraftsParams) error {
	args := m.Called(ctx, params)
	return args.Error(0)
}

func (m *MockRepository) SelectConsultationVersions(ctx context.Context, consultationID uuid.UUID) ([]query.ConsultationVersion, error) {
	args := m.Called(ctx, consultationID)
	return args.Get(0).([]query.ConsultationVersion), args.Error(1)
}

func (m *MockRepository) SelectConsultationVersion(ctx context.Context, params query.GetConsultationVersionParams) (query.ConsultationVersion, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationVersion), args.Error(1)
}

func (m *MockRepository) GetLatestVersionNumber(ctx context.Context, consultationID uuid.UUID) (int32, error) {
	args := m.Called(ctx, consultationID)
	return args.Get(0).(int32), args.Error(1)
}

func (m *MockRepository) InsertConsultationVersion(ctx context.Context, params query.CreateConsultationVersionParams) (query.ConsultationVersion, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationVersion), args.Error(1)
}

func (m *MockRepository) DeleteConsultationVersions(ctx context.Context, consultationID uuid.UUID) error {
	args := m.Called(ctx, consultationID)
	return args.Error(0)
}

func (m *MockRepository) GetConsultationsByBusinessName(ctx context.Context, params query.GetConsultationsByBusinessNameParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) GetConsultationsByIndustry(ctx context.Context, params query.GetConsultationsByIndustryParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) GetConsultationsByUrgency(ctx context.Context, params query.GetConsultationsByUrgencyParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) SearchConsultations(ctx context.Context, params query.SearchConsultationsParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) ListConsultationsByCompletion(ctx context.Context, params query.ListConsultationsByCompletionParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) ListConsultationsByDateRange(ctx context.Context, params query.ListConsultationsByDateRangeParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockRepository) SelectUser(ctx context.Context, id uuid.UUID) (query.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(query.User), args.Error(1)
}

// MockDraftRepository is a mock implementation of the DraftRepository interface
type MockDraftRepository struct {
	mock.Mock
}

func (m *MockDraftRepository) AutoSave(ctx context.Context, consultationID, userID uuid.UUID, draftData map[string]interface{}) error {
	args := m.Called(ctx, consultationID, userID, draftData)
	return args.Error(0)
}

func (m *MockDraftRepository) GetAutoSavedDraft(ctx context.Context, consultationID, userID uuid.UUID) (*ConsultationDraft, error) {
	args := m.Called(ctx, consultationID, userID)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*ConsultationDraft), args.Error(1)
}

func (m *MockDraftRepository) PromoteDraftToConsultation(ctx context.Context, consultationID, userID uuid.UUID) (*Consultation, error) {
	args := m.Called(ctx, consultationID, userID)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*Consultation), args.Error(1)
}

func (m *MockDraftRepository) HasConflictingDraft(ctx context.Context, consultationID, userID uuid.UUID, lastModified time.Time) (bool, error) {
	args := m.Called(ctx, consultationID, userID, lastModified)
	return args.Bool(0), args.Error(1)
}

func (m *MockDraftRepository) CleanupAbandonedDrafts(ctx context.Context, olderThan time.Time) error {
	args := m.Called(ctx, olderThan)
	return args.Error(0)
}

func (m *MockDraftRepository) GetDraftsSummary(ctx context.Context, userID uuid.UUID) ([]DraftSummary, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]DraftSummary), args.Error(1)
}

// MockVersionRepository is a mock implementation of the VersionRepository interface
type MockVersionRepository struct {
	mock.Mock
}

func (m *MockVersionRepository) CreateVersionFromConsultation(ctx context.Context, consultation *Consultation, changeSummary string, changedFields []string) (*ConsultationVersion, error) {
	args := m.Called(ctx, consultation, changeSummary, changedFields)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*ConsultationVersion), args.Error(1)
}

func (m *MockVersionRepository) GetVersionHistory(ctx context.Context, consultationID uuid.UUID, limit, offset int32) ([]ConsultationVersion, error) {
	args := m.Called(ctx, consultationID, limit, offset)
	return args.Get(0).([]ConsultationVersion), args.Error(1)
}

func (m *MockVersionRepository) CompareVersions(ctx context.Context, consultationID uuid.UUID, version1, version2 int32) (*VersionComparison, error) {
	args := m.Called(ctx, consultationID, version1, version2)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*VersionComparison), args.Error(1)
}

func (m *MockVersionRepository) RollbackToVersion(ctx context.Context, consultationID uuid.UUID, versionNumber int32, userID uuid.UUID) (*Consultation, error) {
	args := m.Called(ctx, consultationID, versionNumber, userID)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*Consultation), args.Error(1)
}

func (m *MockVersionRepository) DetectChanges(ctx context.Context, current, previous *Consultation) ([]string, error) {
	args := m.Called(ctx, current, previous)
	return args.Get(0).([]string), args.Error(1)
}

// Test helper functions
func createValidContactInfo() *ContactInfo {
	return &ContactInfo{
		BusinessName:  "Test Business",
		ContactPerson: "John Doe",
		Email:         "john@testbusiness.com",
		Phone:         "+1-555-123-4567",
		Website:       "https://testbusiness.com",
	}
}

func createValidBusinessContext() *BusinessContext {
	return &BusinessContext{
		Industry:          "Technology",
		BusinessType:      "Startup",
		TeamSize:          &[]int{10}[0],
		CurrentPlatform:   "WordPress",
		DigitalPresence:   []string{"website", "social_media"},
		MarketingChannels: []string{"email", "social_media"},
	}
}

func createValidPainPoints() *PainPoints {
	return &PainPoints{
		PrimaryChallenges:    []string{"slow website", "poor mobile experience"},
		TechnicalIssues:      []string{"outdated platform", "security vulnerabilities"},
		UrgencyLevel:         UrgencyHigh,
		ImpactAssessment:     "High impact on customer conversion rates",
		CurrentSolutionGaps:  []string{"no mobile optimization", "poor SEO"},
	}
}

func createValidGoalsObjectives() *GoalsObjectives {
	return &GoalsObjectives{
		PrimaryGoals:      []string{"increase conversion rate", "improve mobile experience"},
		SecondaryGoals:    []string{"better SEO", "faster loading times"},
		SuccessMetrics:    []string{"conversion rate +20%", "page load time <2s"},
		KPIs:              []string{"bounce rate", "session duration"},
		BudgetRange:       "$10,000 - $25,000",
		BudgetConstraints: []string{"limited timeline", "must launch before Q4"},
	}
}

func createTestConsultation() *Consultation {
	consultation := &Consultation{
		Consultation: query.Consultation{
			ID:     uuid.New(),
			UserID: uuid.New(),
			Status: string(StatusDraft),
			CompletionPercentage: sql.NullInt32{Int32: 0, Valid: true},
		},
	}

	// Set up parsed fields
	consultation.ParsedContactInfo = createValidContactInfo()
	consultation.ParsedBusinessContext = createValidBusinessContext()
	consultation.ParsedPainPoints = createValidPainPoints()
	consultation.ParsedGoalsObjectives = createValidGoalsObjectives()

	return consultation
}

// Helper function to create a query.Consultation with valid JSON fields
func createQueryConsultationWithJSON(id, userID uuid.UUID, status string) (query.Consultation, error) {
	contactInfoJSON, err := json.Marshal(createValidContactInfo())
	if err != nil {
		return query.Consultation{}, err
	}

	businessContextJSON, err := json.Marshal(createValidBusinessContext())
	if err != nil {
		return query.Consultation{}, err
	}

	painPointsJSON, err := json.Marshal(createValidPainPoints())
	if err != nil {
		return query.Consultation{}, err
	}

	goalsObjectivesJSON, err := json.Marshal(createValidGoalsObjectives())
	if err != nil {
		return query.Consultation{}, err
	}

	return query.Consultation{
		ID:                   id,
		UserID:               userID,
		Status:               status,
		ContactInfo:          contactInfoJSON,
		BusinessContext:      businessContextJSON,
		PainPoints:           painPointsJSON,
		GoalsObjectives:      goalsObjectivesJSON,
		CompletionPercentage: sql.NullInt32{Int32: 100, Valid: true},
	}, nil
}

// Service Tests
func TestConsultationService_CreateConsultation(t *testing.T) {
	tests := []struct {
		name        string
		input       *CreateConsultationInput
		setupMocks  func(*MockRepository, *MockDraftRepository, *MockVersionRepository)
		wantErr     bool
		errContains string
	}{
		{
			name: "valid consultation creation",
			input: &CreateConsultationInput{
				UserID:            uuid.New(),
				ContactInfo:       createValidContactInfo(),
				BusinessContext:   createValidBusinessContext(),
				PainPoints:        createValidPainPoints(),
				GoalsObjectives:   createValidGoalsObjectives(),
				Status:            StatusDraft,
			},
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				repo.On("InsertConsultation", mock.Anything, mock.AnythingOfType("query.CreateConsultationParams")).
					Return(query.Consultation{}, nil)
			},
			wantErr: false,
		},
		{
			name: "missing required user_id",
			input: &CreateConsultationInput{
				ContactInfo: createValidContactInfo(),
			},
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {},
			wantErr:     true,
			errContains: "user_id is required",
		},
		{
			name: "invalid status",
			input: &CreateConsultationInput{
				UserID: uuid.New(),
				Status: ConsultationStatus("invalid_status"),
			},
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {},
			wantErr:     true,
			errContains: "invalid status",
		},
		{
			name: "repository error",
			input: &CreateConsultationInput{
				UserID:      uuid.New(),
				ContactInfo: createValidContactInfo(),
				Status:      StatusDraft,
			},
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				repo.On("InsertConsultation", mock.Anything, mock.AnythingOfType("query.CreateConsultationParams")).
					Return(query.Consultation{}, errors.New("database error"))
			},
			wantErr:     true,
			errContains: "database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			mockDraft := new(MockDraftRepository)
			mockVersion := new(MockVersionRepository)

			tt.setupMocks(mockRepo, mockDraft, mockVersion)

			service := NewConsultationService(mockRepo, mockDraft, mockVersion)
			ctx := context.Background()

			result, err := service.CreateConsultation(ctx, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			mockRepo.AssertExpectations(t)
			mockDraft.AssertExpectations(t)
			mockVersion.AssertExpectations(t)
		})
	}
}

func TestConsultationService_UpdateConsultation(t *testing.T) {
	consultationID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name        string
		id          uuid.UUID
		input       *UpdateConsultationInput
		setupMocks  func(*MockRepository, *MockDraftRepository, *MockVersionRepository)
		wantErr     bool
		errContains string
	}{
		{
			name: "valid consultation update",
			id:   consultationID,
			input: &UpdateConsultationInput{
				ContactInfo: createValidContactInfo(),
			},
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				// Get existing consultation
				existing := query.Consultation{
					ID:     consultationID,
					UserID: userID,
					Status: string(StatusDraft),
				}
				repo.On("SelectConsultation", mock.Anything, consultationID).Return(existing, nil)

				// Update consultation
				repo.On("UpdateConsultation", mock.Anything, mock.AnythingOfType("query.UpdateConsultationParams")).
					Return(existing, nil)

				// Detect changes
				version.On("DetectChanges", mock.Anything, mock.AnythingOfType("*consultation.Consultation"), mock.AnythingOfType("*consultation.Consultation")).
					Return([]string{"contact_info"}, nil)

				// Create version
				version.On("CreateVersionFromConsultation", mock.Anything, mock.AnythingOfType("*consultation.Consultation"), mock.AnythingOfType("string"), mock.AnythingOfType("[]string")).
					Return(&ConsultationVersion{}, nil)
			},
			wantErr: false,
		},
		{
			name: "consultation not found",
			id:   consultationID,
			input: &UpdateConsultationInput{
				ContactInfo: createValidContactInfo(),
			},
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				repo.On("SelectConsultation", mock.Anything, consultationID).
					Return(query.Consultation{}, sql.ErrNoRows)
			},
			wantErr:     true,
			errContains: "consultation not found",
		},
		{
			name: "invalid status transition",
			id:   consultationID,
			input: &UpdateConsultationInput{
				Status: &[]ConsultationStatus{StatusDraft}[0], // Try to set archived back to draft
			},
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				existing := query.Consultation{
					ID:     consultationID,
					UserID: userID,
					Status: string(StatusArchived), // Already archived
				}
				repo.On("SelectConsultation", mock.Anything, consultationID).Return(existing, nil)
			},
			wantErr:     true,
			errContains: "invalid status transition",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			mockDraft := new(MockDraftRepository)
			mockVersion := new(MockVersionRepository)

			tt.setupMocks(mockRepo, mockDraft, mockVersion)

			service := NewConsultationService(mockRepo, mockDraft, mockVersion)
			ctx := context.Background()

			result, err := service.UpdateConsultation(ctx, tt.id, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			mockRepo.AssertExpectations(t)
			mockDraft.AssertExpectations(t)
			mockVersion.AssertExpectations(t)
		})
	}
}

func TestConsultationService_ValidateContactInfo(t *testing.T) {
	service := &consultationServiceImpl{}

	tests := []struct {
		name        string
		contactInfo *ContactInfo
		wantErr     bool
		errContains string
	}{
		{
			name:        "valid contact info",
			contactInfo: createValidContactInfo(),
			wantErr:     false,
		},
		{
			name: "missing business name",
			contactInfo: &ContactInfo{
				ContactPerson: "John Doe",
				Email:         "john@example.com",
			},
			wantErr:     true,
			errContains: "business_name is required",
		},
		{
			name: "invalid email format",
			contactInfo: &ContactInfo{
				BusinessName:  "Test Business",
				ContactPerson: "John Doe",
				Email:         "invalid-email",
			},
			wantErr:     true,
			errContains: "invalid email format",
		},
		{
			name: "invalid website URL",
			contactInfo: &ContactInfo{
				BusinessName:  "Test Business",
				ContactPerson: "John Doe",
				Email:         "john@example.com",
				Website:       "not-a-url",
			},
			wantErr:     true,
			errContains: "invalid website URL",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateContactInfo(tt.contactInfo)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConsultationService_ValidateBusinessContext(t *testing.T) {
	service := &consultationServiceImpl{}

	tests := []struct {
		name            string
		businessContext *BusinessContext
		wantErr         bool
		errContains     string
	}{
		{
			name:            "valid business context",
			businessContext: createValidBusinessContext(),
			wantErr:         false,
		},
		{
			name: "missing industry",
			businessContext: &BusinessContext{
				BusinessType: "Startup",
			},
			wantErr:     true,
			errContains: "industry is required",
		},
		{
			name: "invalid team size",
			businessContext: &BusinessContext{
				Industry:     "Technology",
				BusinessType: "Startup",
				TeamSize:     &[]int{-1}[0], // Negative team size
			},
			wantErr:     true,
			errContains: "team_size must be positive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateBusinessContext(tt.businessContext)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConsultationService_ValidatePainPoints(t *testing.T) {
	service := &consultationServiceImpl{}

	tests := []struct {
		name        string
		painPoints  *PainPoints
		wantErr     bool
		errContains string
	}{
		{
			name:       "valid pain points",
			painPoints: createValidPainPoints(),
			wantErr:    false,
		},
		{
			name: "invalid urgency level",
			painPoints: &PainPoints{
				PrimaryChallenges: []string{"challenge 1"},
				UrgencyLevel:      UrgencyLevel("invalid"),
			},
			wantErr:     true,
			errContains: "invalid urgency level",
		},
		{
			name: "empty primary challenges",
			painPoints: &PainPoints{
				PrimaryChallenges: []string{},
				UrgencyLevel:      UrgencyMedium,
			},
			wantErr:     true,
			errContains: "at least one primary challenge is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidatePainPoints(tt.painPoints)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConsultationService_ValidateGoalsObjectives(t *testing.T) {
	service := &consultationServiceImpl{}

	tests := []struct {
		name            string
		goalsObjectives *GoalsObjectives
		wantErr         bool
		errContains     string
	}{
		{
			name:            "valid goals and objectives",
			goalsObjectives: createValidGoalsObjectives(),
			wantErr:         false,
		},
		{
			name: "empty primary goals",
			goalsObjectives: &GoalsObjectives{
				PrimaryGoals:   []string{},
				SecondaryGoals: []string{"goal 1"},
			},
			wantErr:     true,
			errContains: "at least one primary goal is required",
		},
		{
			name: "invalid budget range format",
			goalsObjectives: &GoalsObjectives{
				PrimaryGoals: []string{"goal 1"},
				BudgetRange:  "invalid range",
			},
			wantErr:     true,
			errContains: "invalid budget range format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateGoalsObjectives(tt.goalsObjectives)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConsultationService_ValidateStatusTransition(t *testing.T) {
	service := &consultationServiceImpl{}

	tests := []struct {
		name        string
		from        ConsultationStatus
		to          ConsultationStatus
		wantErr     bool
		errContains string
	}{
		{
			name:    "draft to completed",
			from:    StatusDraft,
			to:      StatusCompleted,
			wantErr: false,
		},
		{
			name:    "draft to archived",
			from:    StatusDraft,
			to:      StatusArchived,
			wantErr: false,
		},
		{
			name:    "completed to archived",
			from:    StatusCompleted,
			to:      StatusArchived,
			wantErr: false,
		},
		{
			name:        "archived to draft (invalid)",
			from:        StatusArchived,
			to:          StatusDraft,
			wantErr:     true,
			errContains: "cannot transition from archived to draft",
		},
		{
			name:        "completed to draft (invalid)",
			from:        StatusCompleted,
			to:          StatusDraft,
			wantErr:     true,
			errContains: "cannot transition from completed to draft",
		},
		{
			name:        "archived to completed (invalid)",
			from:        StatusArchived,
			to:          StatusCompleted,
			wantErr:     true,
			errContains: "cannot transition from archived to completed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateStatusTransition(tt.from, tt.to)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConsultationService_AutoSaveDraft(t *testing.T) {
	consultationID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name        string
		setupMocks  func(*MockRepository, *MockDraftRepository, *MockVersionRepository)
		wantErr     bool
		errContains string
	}{
		{
			name: "successful auto-save",
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				draft.On("AutoSave", mock.Anything, consultationID, userID, mock.AnythingOfType("map[string]interface {}")).
					Return(nil)
			},
			wantErr: false,
		},
		{
			name: "draft repository error",
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				draft.On("AutoSave", mock.Anything, consultationID, userID, mock.AnythingOfType("map[string]interface {}")).
					Return(errors.New("draft save error"))
			},
			wantErr:     true,
			errContains: "draft save error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			mockDraft := new(MockDraftRepository)
			mockVersion := new(MockVersionRepository)

			tt.setupMocks(mockRepo, mockDraft, mockVersion)

			service := NewConsultationService(mockRepo, mockDraft, mockVersion)
			ctx := context.Background()

			draftData := map[string]interface{}{
				"contact_info": createValidContactInfo(),
			}

			err := service.AutoSaveDraft(ctx, consultationID, userID, draftData)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
			mockDraft.AssertExpectations(t)
			mockVersion.AssertExpectations(t)
		})
	}
}

func TestConsultationService_CompleteConsultation(t *testing.T) {
	consultationID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name        string
		setupMocks  func(*MockRepository, *MockDraftRepository, *MockVersionRepository)
		wantErr     bool
		errContains string
	}{
		{
			name: "successful completion",
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				// Create a properly populated consultation with JSON fields
				existing, err := createQueryConsultationWithJSON(consultationID, userID, string(StatusDraft))
				require.NoError(t, err)

				repo.On("SelectConsultation", mock.Anything, consultationID).Return(existing, nil)

				// Update status to completed
				completed := existing
				completed.Status = string(StatusCompleted)
				repo.On("UpdateConsultationStatus", mock.Anything, mock.AnythingOfType("query.UpdateConsultationStatusParams")).
					Return(completed, nil)

				// Create version
				version.On("CreateVersionFromConsultation", mock.Anything, mock.AnythingOfType("*consultation.Consultation"), mock.AnythingOfType("string"), mock.AnythingOfType("[]string")).
					Return(&ConsultationVersion{}, nil)
			},
			wantErr: false,
		},
		{
			name: "consultation not fully completed",
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				existing := query.Consultation{
					ID:                   consultationID,
					UserID:               userID,
					Status:               string(StatusDraft),
					ContactInfo:          json.RawMessage("{}"), // Empty JSON
					BusinessContext:      json.RawMessage("{}"),
					PainPoints:           json.RawMessage("{}"),
					GoalsObjectives:      json.RawMessage("{}"),
					CompletionPercentage: sql.NullInt32{Int32: 75, Valid: true}, // Only 75% complete
				}
				repo.On("SelectConsultation", mock.Anything, consultationID).Return(existing, nil)
			},
			wantErr:     true,
			errContains: "consultation must be 100% complete before marking as completed",
		},
		{
			name: "consultation already completed",
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				existing := query.Consultation{
					ID:                   consultationID,
					UserID:               userID,
					Status:               string(StatusCompleted), // Already completed
					CompletionPercentage: sql.NullInt32{Int32: 100, Valid: true},
				}
				repo.On("SelectConsultation", mock.Anything, consultationID).Return(existing, nil)
			},
			wantErr:     true,
			errContains: "consultation is already completed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			mockDraft := new(MockDraftRepository)
			mockVersion := new(MockVersionRepository)

			tt.setupMocks(mockRepo, mockDraft, mockVersion)

			service := NewConsultationService(mockRepo, mockDraft, mockVersion)
			ctx := context.Background()

			result, err := service.CompleteConsultation(ctx, consultationID)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, StatusCompleted, ConsultationStatus(result.Status))
			}

			mockRepo.AssertExpectations(t)
			mockDraft.AssertExpectations(t)
			mockVersion.AssertExpectations(t)
		})
	}
}

func TestConsultationService_CalculateCompletionPercentage(t *testing.T) {
	tests := []struct {
		name                 string
		consultation         *Consultation
		expectedPercentage   int32
	}{
		{
			name: "fully completed consultation",
			consultation: func() *Consultation {
				c := createTestConsultation()
				c.ParsedContactInfo.BusinessName = "Test Business"
				c.ParsedBusinessContext.Industry = "Technology"
				c.ParsedPainPoints.PrimaryChallenges = []string{"challenge 1"}
				c.ParsedGoalsObjectives.PrimaryGoals = []string{"goal 1"}
				return c
			}(),
			expectedPercentage: 100,
		},
		{
			name: "partially completed consultation",
			consultation: func() *Consultation {
				c := createTestConsultation()
				c.ParsedContactInfo.BusinessName = "Test Business"
				c.ParsedBusinessContext.Industry = "Technology"
				// Pain points and goals objectives are empty
				c.ParsedPainPoints.PrimaryChallenges = []string{}
				c.ParsedGoalsObjectives.PrimaryGoals = []string{}
				return c
			}(),
			expectedPercentage: 50,
		},
		{
			name: "empty consultation",
			consultation: func() *Consultation {
				c := createTestConsultation()
				c.ParsedContactInfo.BusinessName = ""
				c.ParsedBusinessContext.Industry = ""
				c.ParsedPainPoints.PrimaryChallenges = []string{}
				c.ParsedGoalsObjectives.PrimaryGoals = []string{}
				return c
			}(),
			expectedPercentage: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &consultationServiceImpl{}
			percentage := service.CalculateCompletionPercentage(tt.consultation)
			assert.Equal(t, tt.expectedPercentage, percentage)
		})
	}
}

func TestConsultationService_GetConsultationWithValidation(t *testing.T) {
	consultationID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name        string
		setupMocks  func(*MockRepository, *MockDraftRepository, *MockVersionRepository)
		wantErr     bool
		errContains string
	}{
		{
			name: "successful retrieval",
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				consultation := query.Consultation{
					ID:     consultationID,
					UserID: userID,
					Status: string(StatusDraft),
				}
				repo.On("SelectConsultation", mock.Anything, consultationID).Return(consultation, nil)
			},
			wantErr: false,
		},
		{
			name: "consultation not found",
			setupMocks: func(repo *MockRepository, draft *MockDraftRepository, version *MockVersionRepository) {
				repo.On("SelectConsultation", mock.Anything, consultationID).
					Return(query.Consultation{}, sql.ErrNoRows)
			},
			wantErr:     true,
			errContains: "consultation not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			mockDraft := new(MockDraftRepository)
			mockVersion := new(MockVersionRepository)

			tt.setupMocks(mockRepo, mockDraft, mockVersion)

			service := NewConsultationService(mockRepo, mockDraft, mockVersion)
			ctx := context.Background()

			result, err := service.GetConsultationWithValidation(ctx, consultationID)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, consultationID, result.ID)
			}

			mockRepo.AssertExpectations(t)
			mockDraft.AssertExpectations(t)
			mockVersion.AssertExpectations(t)
		})
	}
}

// Benchmark tests for performance
func BenchmarkConsultationService_ValidateContactInfo(b *testing.B) {
	service := &consultationServiceImpl{}
	contactInfo := createValidContactInfo()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = service.ValidateContactInfo(contactInfo)
	}
}

func BenchmarkConsultationService_CalculateCompletionPercentage(b *testing.B) {
	service := &consultationServiceImpl{}
	consultation := createTestConsultation()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = service.CalculateCompletionPercentage(consultation)
	}
}

// Integration-style tests with real struct behavior
func TestConsultationService_Integration_CreateAndUpdate(t *testing.T) {
	mockRepo := new(MockRepository)
	mockDraft := new(MockDraftRepository)
	mockVersion := new(MockVersionRepository)

	service := NewConsultationService(mockRepo, mockDraft, mockVersion)
	ctx := context.Background()

	userID := uuid.New()

	// Test creating consultation
	createInput := &CreateConsultationInput{
		UserID:      userID,
		ContactInfo: createValidContactInfo(),
		Status:      StatusDraft,
	}

	// Mock successful creation
	mockRepo.On("InsertConsultation", mock.Anything, mock.AnythingOfType("query.CreateConsultationParams")).
		Return(query.Consultation{
			ID:     uuid.New(),
			UserID: userID,
			Status: string(StatusDraft),
		}, nil)

	consultation, err := service.CreateConsultation(ctx, createInput)
	require.NoError(t, err)
	require.NotNil(t, consultation)

	// Test updating the same consultation
	updateInput := &UpdateConsultationInput{
		BusinessContext: createValidBusinessContext(),
	}

	// Mock retrieval and update
	mockRepo.On("SelectConsultation", mock.Anything, consultation.ID).
		Return(consultation.Consultation, nil)

	mockRepo.On("UpdateConsultation", mock.Anything, mock.AnythingOfType("query.UpdateConsultationParams")).
		Return(consultation.Consultation, nil)

	mockVersion.On("DetectChanges", mock.Anything, mock.AnythingOfType("*consultation.Consultation"), mock.AnythingOfType("*consultation.Consultation")).
		Return([]string{"business_context"}, nil)

	mockVersion.On("CreateVersionFromConsultation", mock.Anything, mock.AnythingOfType("*consultation.Consultation"), mock.AnythingOfType("string"), mock.AnythingOfType("[]string")).
		Return(&ConsultationVersion{}, nil)

	updatedConsultation, err := service.UpdateConsultation(ctx, consultation.ID, updateInput)
	require.NoError(t, err)
	require.NotNil(t, updatedConsultation)

	// Verify mocks were called as expected
	mockRepo.AssertExpectations(t)
	mockDraft.AssertExpectations(t)
	mockVersion.AssertExpectations(t)
}