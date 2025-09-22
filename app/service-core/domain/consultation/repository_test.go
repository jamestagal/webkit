package consultation

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"service-core/storage/query"
)

// MockQuerier is a mock implementation of the query.Querier interface
type MockQuerier struct {
	mock.Mock
}

// Consultation CRUD operations
func (m *MockQuerier) CountConsultationsByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuerier) ListConsultationsByUser(ctx context.Context, params query.ListConsultationsByUserParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockQuerier) ListConsultationsByStatus(ctx context.Context, params query.ListConsultationsByStatusParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockQuerier) GetConsultation(ctx context.Context, id uuid.UUID) (query.Consultation, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockQuerier) CreateConsultation(ctx context.Context, params query.CreateConsultationParams) (query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockQuerier) UpdateConsultation(ctx context.Context, params query.UpdateConsultationParams) (query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockQuerier) UpdateConsultationStatus(ctx context.Context, params query.UpdateConsultationStatusParams) (query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockQuerier) DeleteConsultation(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// Consultation Draft operations
func (m *MockQuerier) GetConsultationDraft(ctx context.Context, consultationID uuid.UUID) (query.ConsultationDraft, error) {
	args := m.Called(ctx, consultationID)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockQuerier) GetConsultationDraftByUser(ctx context.Context, params query.GetConsultationDraftByUserParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockQuerier) CreateConsultationDraft(ctx context.Context, params query.CreateConsultationDraftParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockQuerier) UpdateConsultationDraft(ctx context.Context, params query.UpdateConsultationDraftParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockQuerier) UpsertConsultationDraft(ctx context.Context, params query.UpsertConsultationDraftParams) (query.ConsultationDraft, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationDraft), args.Error(1)
}

func (m *MockQuerier) DeleteConsultationDraft(ctx context.Context, consultationID uuid.UUID) error {
	args := m.Called(ctx, consultationID)
	return args.Error(0)
}

func (m *MockQuerier) DeleteConsultationDraftByUser(ctx context.Context, params query.DeleteConsultationDraftByUserParams) error {
	args := m.Called(ctx, params)
	return args.Error(0)
}

func (m *MockQuerier) CleanupOldDrafts(ctx context.Context, updatedAt sql.NullTime) error {
	args := m.Called(ctx, updatedAt)
	return args.Error(0)
}

// Consultation Version operations
func (m *MockQuerier) ListConsultationVersions(ctx context.Context, params query.ListConsultationVersionsParams) ([]query.ConsultationVersion, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.ConsultationVersion), args.Error(1)
}

func (m *MockQuerier) GetConsultationVersion(ctx context.Context, params query.GetConsultationVersionParams) (query.ConsultationVersion, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationVersion), args.Error(1)
}

func (m *MockQuerier) GetNextVersionNumber(ctx context.Context, consultationID uuid.UUID) (int32, error) {
	args := m.Called(ctx, consultationID)
	return args.Get(0).(int32), args.Error(1)
}

func (m *MockQuerier) CreateConsultationVersion(ctx context.Context, params query.CreateConsultationVersionParams) (query.ConsultationVersion, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.ConsultationVersion), args.Error(1)
}

func (m *MockQuerier) DeleteConsultationVersions(ctx context.Context, consultationID uuid.UUID) error {
	args := m.Called(ctx, consultationID)
	return args.Error(0)
}

// User operations
func (m *MockQuerier) SelectUser(ctx context.Context, id uuid.UUID) (query.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(query.User), args.Error(1)
}

// Additional required methods for interface compliance
func (m *MockQuerier) CountConsultationVersions(ctx context.Context, consultationID uuid.UUID) (int64, error) {
	args := m.Called(ctx, consultationID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuerier) CountConsultationsByStatus(ctx context.Context, params query.CountConsultationsByStatusParams) (int64, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuerier) GetConsultationByUser(ctx context.Context, params query.GetConsultationByUserParams) (query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(query.Consultation), args.Error(1)
}

func (m *MockQuerier) GetConsultationsByBusinessName(ctx context.Context, params query.GetConsultationsByBusinessNameParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockQuerier) GetConsultationsByIndustry(ctx context.Context, params query.GetConsultationsByIndustryParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockQuerier) GetConsultationsByUrgency(ctx context.Context, params query.GetConsultationsByUrgencyParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockQuerier) GetLatestConsultationVersion(ctx context.Context, consultationID uuid.UUID) (query.ConsultationVersion, error) {
	args := m.Called(ctx, consultationID)
	return args.Get(0).(query.ConsultationVersion), args.Error(1)
}

func (m *MockQuerier) ListConsultationsByCompletion(ctx context.Context, params query.ListConsultationsByCompletionParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockQuerier) ListConsultationsByDateRange(ctx context.Context, params query.ListConsultationsByDateRangeParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

func (m *MockQuerier) SearchConsultations(ctx context.Context, params query.SearchConsultationsParams) ([]query.Consultation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]query.Consultation), args.Error(1)
}

// Add stub implementations for other required methods that we don't test in this domain
func (m *MockQuerier) CountNotes(ctx context.Context, userID uuid.UUID) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuerier) DeleteFile(ctx context.Context, id uuid.UUID) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockQuerier) DeleteNote(ctx context.Context, id uuid.UUID) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockQuerier) DeleteTokens(ctx context.Context) error {
	return m.Called(ctx).Error(0)
}

func (m *MockQuerier) InsertEmail(ctx context.Context, arg query.InsertEmailParams) (query.Email, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.Email), args.Error(1)
}

func (m *MockQuerier) InsertEmailAttachment(ctx context.Context, arg query.InsertEmailAttachmentParams) (query.EmailAttachment, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.EmailAttachment), args.Error(1)
}

func (m *MockQuerier) InsertFile(ctx context.Context, arg query.InsertFileParams) (query.File, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.File), args.Error(1)
}

func (m *MockQuerier) InsertNote(ctx context.Context, arg query.InsertNoteParams) (query.Note, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.Note), args.Error(1)
}

func (m *MockQuerier) InsertToken(ctx context.Context, arg query.InsertTokenParams) (query.Token, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.Token), args.Error(1)
}

func (m *MockQuerier) InsertUser(ctx context.Context, arg query.InsertUserParams) (query.User, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.User), args.Error(1)
}

func (m *MockQuerier) SelectEmailAttachments(ctx context.Context, emailID uuid.UUID) ([]query.EmailAttachment, error) {
	args := m.Called(ctx, emailID)
	return args.Get(0).([]query.EmailAttachment), args.Error(1)
}

func (m *MockQuerier) SelectEmails(ctx context.Context, userID uuid.UUID) ([]query.Email, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]query.Email), args.Error(1)
}

func (m *MockQuerier) SelectFile(ctx context.Context, id uuid.UUID) (query.File, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(query.File), args.Error(1)
}

func (m *MockQuerier) SelectFiles(ctx context.Context, userID uuid.UUID) ([]query.File, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]query.File), args.Error(1)
}

func (m *MockQuerier) SelectNote(ctx context.Context, id uuid.UUID) (query.Note, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(query.Note), args.Error(1)
}

func (m *MockQuerier) SelectNotes(ctx context.Context, arg query.SelectNotesParams) ([]query.Note, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).([]query.Note), args.Error(1)
}

func (m *MockQuerier) SelectToken(ctx context.Context, id string) (query.Token, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(query.Token), args.Error(1)
}

func (m *MockQuerier) SelectUserByCustomerID(ctx context.Context, customerID string) (query.User, error) {
	args := m.Called(ctx, customerID)
	return args.Get(0).(query.User), args.Error(1)
}

func (m *MockQuerier) SelectUserByEmailAndSub(ctx context.Context, arg query.SelectUserByEmailAndSubParams) (query.User, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.User), args.Error(1)
}

func (m *MockQuerier) SelectUsers(ctx context.Context) ([]query.User, error) {
	args := m.Called(ctx)
	return args.Get(0).([]query.User), args.Error(1)
}

func (m *MockQuerier) UpdateNote(ctx context.Context, arg query.UpdateNoteParams) (query.Note, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.Note), args.Error(1)
}

func (m *MockQuerier) UpdateToken(ctx context.Context, arg query.UpdateTokenParams) error {
	return m.Called(ctx, arg).Error(0)
}

func (m *MockQuerier) UpdateUser(ctx context.Context, arg query.UpdateUserParams) (query.User, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.User), args.Error(1)
}

func (m *MockQuerier) UpdateUserAccess(ctx context.Context, arg query.UpdateUserAccessParams) (query.User, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(query.User), args.Error(1)
}

func (m *MockQuerier) UpdateUserActivity(ctx context.Context, id uuid.UUID) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockQuerier) UpdateUserCustomerID(ctx context.Context, arg query.UpdateUserCustomerIDParams) error {
	return m.Called(ctx, arg).Error(0)
}

func (m *MockQuerier) UpdateUserPhone(ctx context.Context, arg query.UpdateUserPhoneParams) error {
	return m.Called(ctx, arg).Error(0)
}

func (m *MockQuerier) UpdateUserSubscription(ctx context.Context, arg query.UpdateUserSubscriptionParams) error {
	return m.Called(ctx, arg).Error(0)
}

// Test functions for repository interface

func TestRepository_CountConsultations(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	userID := uuid.New()

	mockQuerier.On("CountConsultationsByUser", ctx, userID).Return(int64(5), nil)

	count, err := repo.CountConsultations(ctx, userID)

	require.NoError(t, err)
	assert.Equal(t, int64(5), count)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_GetConsultation(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	consultationID := uuid.New()

	expectedConsultation := query.Consultation{
		ID:     consultationID,
		UserID: uuid.New(),
		Status: "draft",
		ContactInfo: json.RawMessage(`{
			"business_name": "Test Company",
			"contact_person": "John Doe",
			"email": "john@test.com"
		}`),
		BusinessContext: json.RawMessage(`{
			"industry": "technology",
			"team_size": 10
		}`),
		PainPoints: json.RawMessage(`{
			"primary_challenges": ["slow website"],
			"urgency_level": "high"
		}`),
		GoalsObjectives: json.RawMessage(`{
			"primary_goals": ["increase conversions"],
			"budget_range": "$10k-$20k"
		}`),
		CreatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	}

	mockQuerier.On("GetConsultation", ctx, consultationID).Return(expectedConsultation, nil)

	consultation, err := repo.SelectConsultation(ctx, consultationID)

	require.NoError(t, err)
	assert.Equal(t, expectedConsultation.ID, consultation.ID)
	assert.Equal(t, expectedConsultation.Status, consultation.Status)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_CreateConsultation(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()

	contactInfo := ContactInfo{
		BusinessName:  "Test Company",
		ContactPerson: "John Doe",
		Email:         "john@test.com",
		Phone:         "+1234567890",
	}
	businessContext := BusinessContext{
		Industry: "technology",
		TeamSize: func() *int { i := 10; return &i }(),
	}
	painPoints := PainPoints{
		PrimaryChallenges: []string{"slow website", "low conversions"},
		UrgencyLevel:      UrgencyHigh,
	}
	goalsObjectives := GoalsObjectives{
		PrimaryGoals: []string{"increase conversions"},
		BudgetRange:  "$10k-$20k",
	}

	contactInfoJSON, _ := MarshalContactInfo(&contactInfo)
	businessContextJSON, _ := MarshalBusinessContext(&businessContext)
	painPointsJSON, _ := MarshalPainPoints(&painPoints)
	goalsObjectivesJSON, _ := MarshalGoalsObjectives(&goalsObjectives)

	params := query.CreateConsultationParams{
		ID:                   uuid.New(),
		UserID:               uuid.New(),
		ContactInfo:          contactInfoJSON,
		BusinessContext:      businessContextJSON,
		PainPoints:           painPointsJSON,
		GoalsObjectives:      goalsObjectivesJSON,
		Status:               "draft",
		CompletionPercentage: sql.NullInt32{Int32: 0, Valid: true},
	}

	expectedConsultation := query.Consultation{
		ID:                   params.ID,
		UserID:               params.UserID,
		ContactInfo:          params.ContactInfo,
		BusinessContext:      params.BusinessContext,
		PainPoints:           params.PainPoints,
		GoalsObjectives:      params.GoalsObjectives,
		Status:               params.Status,
		CompletionPercentage: params.CompletionPercentage,
		CreatedAt:            sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:            sql.NullTime{Time: time.Now(), Valid: true},
	}

	mockQuerier.On("CreateConsultation", ctx, params).Return(expectedConsultation, nil)

	consultation, err := repo.InsertConsultation(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, expectedConsultation.ID, consultation.ID)
	assert.Equal(t, expectedConsultation.Status, consultation.Status)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_UpdateConsultation(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()

	params := query.UpdateConsultationParams{
		ID:     uuid.New(),
		Status: "completed",
		ContactInfo: json.RawMessage(`{
			"business_name": "Updated Company",
			"contact_person": "Jane Doe",
			"email": "jane@test.com"
		}`),
		BusinessContext: json.RawMessage(`{
			"industry": "healthcare",
			"team_size": 15
		}`),
		PainPoints: json.RawMessage(`{
			"primary_challenges": ["compliance issues"],
			"urgency_level": "critical"
		}`),
		GoalsObjectives: json.RawMessage(`{
			"primary_goals": ["streamline processes"],
			"budget_range": "$20k-$50k"
		}`),
	}

	expectedConsultation := query.Consultation{
		ID:              params.ID,
		Status:          params.Status,
		ContactInfo:     params.ContactInfo,
		BusinessContext: params.BusinessContext,
		PainPoints:      params.PainPoints,
		GoalsObjectives: params.GoalsObjectives,
		UpdatedAt:       sql.NullTime{Time: time.Now(), Valid: true},
	}

	mockQuerier.On("UpdateConsultation", ctx, params).Return(expectedConsultation, nil)

	consultation, err := repo.UpdateConsultation(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, expectedConsultation.ID, consultation.ID)
	assert.Equal(t, expectedConsultation.Status, consultation.Status)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_DeleteConsultation(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	consultationID := uuid.New()

	mockQuerier.On("DeleteConsultation", ctx, consultationID).Return(nil)

	err := repo.DeleteConsultation(ctx, consultationID)

	require.NoError(t, err)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_ListConsultations(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	userID := uuid.New()

	params := query.ListConsultationsByUserParams{
		UserID: userID,
		Limit:  10,
		Offset: 0,
	}

	expectedConsultations := []query.Consultation{
		{
			ID:     uuid.New(),
			UserID: userID,
			Status: "draft",
			ContactInfo: json.RawMessage(`{
				"business_name": "Company 1",
				"contact_person": "Person 1"
			}`),
		},
		{
			ID:     uuid.New(),
			UserID: userID,
			Status: "completed",
			ContactInfo: json.RawMessage(`{
				"business_name": "Company 2",
				"contact_person": "Person 2"
			}`),
		},
	}

	mockQuerier.On("ListConsultationsByUser", ctx, params).Return(expectedConsultations, nil)

	consultations, err := repo.SelectConsultations(ctx, params)

	require.NoError(t, err)
	assert.Len(t, consultations, 2)
	assert.Equal(t, expectedConsultations[0].ID, consultations[0].ID)
	assert.Equal(t, expectedConsultations[1].ID, consultations[1].ID)
	mockQuerier.AssertExpectations(t)
}

// Draft management tests

func TestRepository_GetConsultationDraft(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	consultationID := uuid.New()
	userID := uuid.New()

	expectedDraft := query.ConsultationDraft{
		ID:             uuid.New(),
		ConsultationID: consultationID,
		UserID:         userID,
		ContactInfo: json.RawMessage(`{
			"business_name": "Draft Company",
			"contact_person": "Draft Person"
		}`),
		AutoSaved: sql.NullBool{Bool: true, Valid: true},
		CreatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	}

	params := query.GetConsultationDraftByUserParams{
		ConsultationID: consultationID,
		UserID:         userID,
	}

	mockQuerier.On("GetConsultationDraftByUser", ctx, params).Return(expectedDraft, nil)

	draft, err := repo.SelectConsultationDraft(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, expectedDraft.ConsultationID, draft.ConsultationID)
	assert.Equal(t, expectedDraft.UserID, draft.UserID)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_UpsertConsultationDraft(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()

	params := query.UpsertConsultationDraftParams{
		ID:             uuid.New(),
		ConsultationID: uuid.New(),
		UserID:         uuid.New(),
		ContactInfo: json.RawMessage(`{
			"business_name": "Draft Company",
			"contact_person": "Draft Person"
		}`),
		BusinessContext: json.RawMessage(`{
			"industry": "technology"
		}`),
		AutoSaved:  sql.NullBool{Bool: true, Valid: true},
		DraftNotes: sql.NullString{String: "Auto-saved at step 2", Valid: true},
	}

	expectedDraft := query.ConsultationDraft{
		ID:              params.ID,
		ConsultationID:  params.ConsultationID,
		UserID:          params.UserID,
		ContactInfo:     params.ContactInfo,
		BusinessContext: params.BusinessContext,
		AutoSaved:       params.AutoSaved,
		DraftNotes:      params.DraftNotes,
		UpdatedAt:       sql.NullTime{Time: time.Now(), Valid: true},
	}

	mockQuerier.On("UpsertConsultationDraft", ctx, params).Return(expectedDraft, nil)

	draft, err := repo.UpsertConsultationDraft(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, expectedDraft.ConsultationID, draft.ConsultationID)
	assert.Equal(t, expectedDraft.UserID, draft.UserID)
	mockQuerier.AssertExpectations(t)
}

// Version tracking tests

func TestRepository_GetNextVersionNumber(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	consultationID := uuid.New()

	mockQuerier.On("GetNextVersionNumber", ctx, consultationID).Return(int32(2), nil)

	versionNumber, err := repo.GetLatestVersionNumber(ctx, consultationID)

	require.NoError(t, err)
	assert.Equal(t, int32(2), versionNumber)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_CreateConsultationVersion(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()

	params := query.CreateConsultationVersionParams{
		ID:                   uuid.New(),
		ConsultationID:       uuid.New(),
		UserID:               uuid.New(),
		VersionNumber:        1,
		ContactInfo:          json.RawMessage(`{"business_name": "Test Company"}`),
		BusinessContext:      json.RawMessage(`{"industry": "technology"}`),
		PainPoints:           json.RawMessage(`{"primary_challenges": ["speed"]}`),
		GoalsObjectives:      json.RawMessage(`{"primary_goals": ["performance"]}`),
		Status:               "completed",
		CompletionPercentage: 100,
		ChangeSummary:        sql.NullString{String: "Initial version", Valid: true},
	}

	expectedVersion := query.ConsultationVersion{
		ID:                   params.ID,
		ConsultationID:       params.ConsultationID,
		UserID:               params.UserID,
		VersionNumber:        params.VersionNumber,
		ContactInfo:          params.ContactInfo,
		BusinessContext:      params.BusinessContext,
		PainPoints:           params.PainPoints,
		GoalsObjectives:      params.GoalsObjectives,
		Status:               params.Status,
		CompletionPercentage: params.CompletionPercentage,
		ChangeSummary:        params.ChangeSummary,
		CreatedAt:            sql.NullTime{Time: time.Now(), Valid: true},
	}

	mockQuerier.On("CreateConsultationVersion", ctx, params).Return(expectedVersion, nil)

	version, err := repo.InsertConsultationVersion(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, expectedVersion.ConsultationID, version.ConsultationID)
	assert.Equal(t, expectedVersion.VersionNumber, version.VersionNumber)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_ListConsultationVersions(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	consultationID := uuid.New()

	// The repository uses a default limit of 100
	params := query.ListConsultationVersionsParams{
		ConsultationID: consultationID,
		Limit:          100,
		Offset:         0,
	}

	expectedVersions := []query.ConsultationVersion{
		{
			ID:             uuid.New(),
			ConsultationID: consultationID,
			VersionNumber:  1,
			ChangeSummary:  sql.NullString{String: "Initial version", Valid: true},
		},
		{
			ID:             uuid.New(),
			ConsultationID: consultationID,
			VersionNumber:  2,
			ChangeSummary:  sql.NullString{String: "Updated goals", Valid: true},
		},
	}

	mockQuerier.On("ListConsultationVersions", ctx, params).Return(expectedVersions, nil)

	versions, err := repo.SelectConsultationVersions(ctx, consultationID)

	require.NoError(t, err)
	assert.Len(t, versions, 2)
	assert.Equal(t, expectedVersions[0].VersionNumber, versions[0].VersionNumber)
	assert.Equal(t, expectedVersions[1].VersionNumber, versions[1].VersionNumber)
	mockQuerier.AssertExpectations(t)
}

// Error handling tests

func TestRepository_GetConsultation_NotFound(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	consultationID := uuid.New()

	mockQuerier.On("GetConsultation", ctx, consultationID).Return(query.Consultation{}, sql.ErrNoRows)

	_, err := repo.SelectConsultation(ctx, consultationID)

	require.Error(t, err)
	assert.Equal(t, sql.ErrNoRows, err)
	mockQuerier.AssertExpectations(t)
}

func TestRepository_CreateConsultation_DatabaseError(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()

	params := query.CreateConsultationParams{
		ID:     uuid.New(),
		UserID: uuid.New(),
		Status: "draft",
	}

	mockQuerier.On("CreateConsultation", ctx, params).Return(query.Consultation{}, assert.AnError)

	_, err := repo.InsertConsultation(ctx, params)

	require.Error(t, err)
	assert.Equal(t, assert.AnError, err)
	mockQuerier.AssertExpectations(t)
}

// Concurrent access tests

func TestRepository_ConcurrentDraftUpdates(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	consultationID := uuid.New()
	userID := uuid.New()

	// Simulate two concurrent draft updates
	params1 := query.UpsertConsultationDraftParams{
		ID:             uuid.New(),
		ConsultationID: consultationID,
		UserID:         userID,
		ContactInfo:    json.RawMessage(`{"business_name": "Company A"}`),
		AutoSaved:      sql.NullBool{Bool: true, Valid: true},
	}

	params2 := query.UpsertConsultationDraftParams{
		ID:             uuid.New(),
		ConsultationID: consultationID,
		UserID:         userID,
		ContactInfo:    json.RawMessage(`{"business_name": "Company B"}`),
		AutoSaved:      sql.NullBool{Bool: true, Valid: true},
	}

	// First update succeeds
	mockQuerier.On("UpsertConsultationDraft", ctx, params1).Return(query.ConsultationDraft{
		ID:             params1.ID,
		ConsultationID: params1.ConsultationID,
		UserID:         params1.UserID,
		ContactInfo:    params1.ContactInfo,
	}, nil).Once()

	// Second update also succeeds (last one wins)
	mockQuerier.On("UpsertConsultationDraft", ctx, params2).Return(query.ConsultationDraft{
		ID:             params2.ID,
		ConsultationID: params2.ConsultationID,
		UserID:         params2.UserID,
		ContactInfo:    params2.ContactInfo,
	}, nil).Once()

	// Execute both updates
	_, err1 := repo.UpsertConsultationDraft(ctx, params1)
	_, err2 := repo.UpsertConsultationDraft(ctx, params2)

	require.NoError(t, err1)
	require.NoError(t, err2)
	mockQuerier.AssertExpectations(t)
}

// Filtering and pagination tests

func TestRepository_FilterConsultationsByStatus(t *testing.T) {
	mockQuerier := new(MockQuerier)
	repo := NewRepository(mockQuerier)
	ctx := context.Background()
	userID := uuid.New()

	params := query.ListConsultationsByStatusParams{
		UserID: userID,
		Status: "draft",
		Limit:  5,
		Offset: 0,
	}

	expectedConsultations := []query.Consultation{
		{
			ID:     uuid.New(),
			UserID: userID,
			Status: "draft",
		},
	}

	mockQuerier.On("ListConsultationsByStatus", ctx, params).Return(expectedConsultations, nil)

	consultations, err := repo.SelectConsultationsByStatus(ctx, params)

	require.NoError(t, err)
	assert.Len(t, consultations, 1)
	assert.Equal(t, "draft", consultations[0].Status)
	mockQuerier.AssertExpectations(t)
}