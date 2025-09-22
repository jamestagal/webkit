package rest

import (
	"app/pkg/auth"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"service-core/domain/consultation"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

// MockConsultationService implements consultation.ConsultationService for testing
type MockConsultationService struct {
	mock.Mock
}

// Implement all methods from the ConsultationService interface
func (m *MockConsultationService) CreateConsultation(ctx context.Context, input *consultation.CreateConsultationInput) (*consultation.Consultation, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) GetConsultation(ctx context.Context, id uuid.UUID) (*consultation.Consultation, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) GetConsultationWithValidation(ctx context.Context, id uuid.UUID) (*consultation.Consultation, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) UpdateConsultation(ctx context.Context, id uuid.UUID, input *consultation.UpdateConsultationInput) (*consultation.Consultation, error) {
	args := m.Called(ctx, id, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) DeleteConsultation(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockConsultationService) ListConsultations(ctx context.Context, params *consultation.ListConsultationsParams) (*consultation.ConsultationsResponse, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationsResponse), args.Error(1)
}

func (m *MockConsultationService) ListConsultationsByStatus(ctx context.Context, userID uuid.UUID, status consultation.ConsultationStatus, page, limit int32) (*consultation.ConsultationsResponse, error) {
	args := m.Called(ctx, userID, status, page, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationsResponse), args.Error(1)
}

func (m *MockConsultationService) SearchConsultations(ctx context.Context, userID uuid.UUID, query string, page, limit int32) (*consultation.ConsultationsResponse, error) {
	args := m.Called(ctx, userID, query, page, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationsResponse), args.Error(1)
}

func (m *MockConsultationService) ValidateContactInfo(contactInfo *consultation.ContactInfo) error {
	args := m.Called(contactInfo)
	return args.Error(0)
}

func (m *MockConsultationService) ValidateBusinessContext(businessContext *consultation.BusinessContext) error {
	args := m.Called(businessContext)
	return args.Error(0)
}

func (m *MockConsultationService) ValidatePainPoints(painPoints *consultation.PainPoints) error {
	args := m.Called(painPoints)
	return args.Error(0)
}

func (m *MockConsultationService) ValidateGoalsObjectives(goalsObjectives *consultation.GoalsObjectives) error {
	args := m.Called(goalsObjectives)
	return args.Error(0)
}

func (m *MockConsultationService) ValidateStatusTransition(from, to consultation.ConsultationStatus) error {
	args := m.Called(from, to)
	return args.Error(0)
}

func (m *MockConsultationService) ValidateConsultationCompletion(c *consultation.Consultation) error {
	args := m.Called(c)
	return args.Error(0)
}

func (m *MockConsultationService) CompleteConsultation(ctx context.Context, id uuid.UUID) (*consultation.Consultation, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) ArchiveConsultation(ctx context.Context, id uuid.UUID) (*consultation.Consultation, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) RestoreConsultation(ctx context.Context, id uuid.UUID) (*consultation.Consultation, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) AutoSaveDraft(ctx context.Context, consultationID, userID uuid.UUID, draftData map[string]interface{}) error {
	args := m.Called(ctx, consultationID, userID, draftData)
	return args.Error(0)
}

func (m *MockConsultationService) GetDraft(ctx context.Context, consultationID, userID uuid.UUID) (*consultation.ConsultationDraft, error) {
	args := m.Called(ctx, consultationID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationDraft), args.Error(1)
}

func (m *MockConsultationService) PromoteDraftToConsultation(ctx context.Context, consultationID, userID uuid.UUID) (*consultation.Consultation, error) {
	args := m.Called(ctx, consultationID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) DeleteDraft(ctx context.Context, consultationID, userID uuid.UUID) error {
	args := m.Called(ctx, consultationID, userID)
	return args.Error(0)
}

func (m *MockConsultationService) CreateVersion(ctx context.Context, consultationID uuid.UUID, changeSummary string, changedFields []string) (*consultation.ConsultationVersion, error) {
	args := m.Called(ctx, consultationID, changeSummary, changedFields)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationVersion), args.Error(1)
}

func (m *MockConsultationService) GetVersionHistory(ctx context.Context, consultationID uuid.UUID, page, limit int32) (*consultation.ConsultationVersionsResponse, error) {
	args := m.Called(ctx, consultationID, page, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationVersionsResponse), args.Error(1)
}

func (m *MockConsultationService) RollbackToVersion(ctx context.Context, consultationID uuid.UUID, versionNumber int32, userID uuid.UUID) (*consultation.Consultation, error) {
	args := m.Called(ctx, consultationID, versionNumber, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.Consultation), args.Error(1)
}

func (m *MockConsultationService) CalculateCompletionPercentage(c *consultation.Consultation) int32 {
	args := m.Called(c)
	return args.Get(0).(int32)
}

func (m *MockConsultationService) GetConsultationProgress(ctx context.Context, id uuid.UUID) (*consultation.ConsultationProgress, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationProgress), args.Error(1)
}

func (m *MockConsultationService) DetectChangedFields(current, previous *consultation.Consultation) []string {
	args := m.Called(current, previous)
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).([]string)
}

func (m *MockConsultationService) BulkArchiveConsultations(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error {
	args := m.Called(ctx, userID, ids)
	return args.Error(0)
}

func (m *MockConsultationService) BulkDeleteConsultations(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error {
	args := m.Called(ctx, userID, ids)
	return args.Error(0)
}

func (m *MockConsultationService) GetConsultationStats(ctx context.Context, userID uuid.UUID) (*consultation.ConsultationStats, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.ConsultationStats), args.Error(1)
}

func (m *MockConsultationService) GetCompletionRateByPeriod(ctx context.Context, userID uuid.UUID, period string) (*consultation.CompletionRateStats, error) {
	args := m.Called(ctx, userID, period)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*consultation.CompletionRateStats), args.Error(1)
}

// MockAuthService implements auth.AuthService for testing
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) Auth(token string, access int64) (*auth.AccessTokenClaims, error) {
	args := m.Called(token, access)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*auth.AccessTokenClaims), args.Error(1)
}

func (m *MockAuthService) ValidateAccessToken(token string) (*auth.AccessTokenClaims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*auth.AccessTokenClaims), args.Error(1)
}

func (m *MockAuthService) HasAccess(access int64, userAccess int64) bool {
	args := m.Called(access, userAccess)
	return args.Bool(0)
}

func (m *MockAuthService) UpdateAccess(userAccess int64, access int64) (int64, error) {
	args := m.Called(userAccess, access)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockAuthService) HasAccessABAC(access int64, userAccess int64, userAttr auth.UserAttr) bool {
	args := m.Called(access, userAccess, userAttr)
	return args.Bool(0)
}

func (m *MockAuthService) GenerateSessionToken(userID, phone string) (string, error) {
	args := m.Called(userID, phone)
	return args.String(0), args.Error(1)
}

func (m *MockAuthService) ValidateSessionToken(token string) (*auth.SessionTokenClaims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*auth.SessionTokenClaims), args.Error(1)
}

func (m *MockAuthService) GenerateTokens(refreshTokenID, userID string, access int64, avatar, email string, subscriptionActive bool) (string, string, error) {
	args := m.Called(refreshTokenID, userID, access, avatar, email, subscriptionActive)
	return args.String(0), args.String(1), args.Error(2)
}

func (m *MockAuthService) ValidateRefreshToken(token string) (*auth.RefreshTokenClaims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*auth.RefreshTokenClaims), args.Error(1)
}

// ConsultationHandlerTestSuite defines our test suite
type ConsultationHandlerTestSuite struct {
	suite.Suite
	handler            *Handler
	mockService        *MockConsultationService
	mockAuthService    *MockAuthService
	testUserID         uuid.UUID
	testConsultationID uuid.UUID
	validAccessToken   string
}

func (suite *ConsultationHandlerTestSuite) SetupTest() {
	suite.mockService = new(MockConsultationService)
	suite.mockAuthService = new(MockAuthService)
	suite.testUserID = uuid.New()
	suite.testConsultationID = uuid.New()
	suite.validAccessToken = "valid-token"

	// Create handler with mocks
	suite.handler = &Handler{
		consultationService: suite.mockService,
		authService:         suite.mockAuthService,
	}
}

func (suite *ConsultationHandlerTestSuite) TearDownTest() {
	suite.mockService.AssertExpectations(suite.T())
	suite.mockAuthService.AssertExpectations(suite.T())
}

// Test createConsultation (lowercase method name)
func (suite *ConsultationHandlerTestSuite) TestCreateConsultation_Success() {
	// Setup auth mock
	userClaims := &auth.AccessTokenClaims{
		ID:     suite.testUserID,
		Access: auth.GetConsultations,
	}
	suite.mockAuthService.On("Auth", suite.validAccessToken, mock.AnythingOfType("int64")).Return(userClaims, nil)

	// Setup service mock
	expectedConsultation := &consultation.Consultation{}
	expectedConsultation.ID = suite.testConsultationID
	expectedConsultation.UserID = suite.testUserID
	suite.mockService.On("CreateConsultation", mock.Anything, mock.AnythingOfType("*consultation.CreateConsultationInput")).Return(expectedConsultation, nil)

	// Create request body
	requestBody := map[string]interface{}{
		"contactInfo": map[string]interface{}{
			"businessName": "Test Business",
			"email":        "test@example.com",
		},
	}
	body, _ := json.Marshal(requestBody)

	// Create request
	req := httptest.NewRequest(http.MethodPost, "/consultations", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+suite.validAccessToken)
	w := httptest.NewRecorder()

	// Execute request
	suite.handler.createConsultation(w, req)

	// Assert response
	suite.Equal(http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	suite.NoError(err)
	suite.Equal("success", response["status"])
	suite.NotNil(response["data"])
}

// Test listConsultations
func (suite *ConsultationHandlerTestSuite) TestListConsultations_Success() {
	// Setup auth mock
	userClaims := &auth.AccessTokenClaims{
		ID:     suite.testUserID,
		Access: auth.GetConsultations,
	}
	suite.mockAuthService.On("Auth", suite.validAccessToken, mock.AnythingOfType("int64")).Return(userClaims, nil)

	// Setup service mock
	expectedResponse := &consultation.ConsultationsResponse{
		Consultations: []*consultation.ConsultationSummary{
			{
				ID:           suite.testConsultationID,
				UserID:       suite.testUserID,
				BusinessName: "Test Business",
			},
		},
		Count: 1,
	}
	suite.mockService.On("ListConsultations", mock.Anything, mock.AnythingOfType("*consultation.ListConsultationsParams")).Return(expectedResponse, nil)

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/consultations", nil)
	req.Header.Set("Authorization", "Bearer "+suite.validAccessToken)
	w := httptest.NewRecorder()

	// Execute request
	suite.handler.listConsultations(w, req)

	// Assert response
	suite.Equal(http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	suite.NoError(err)
	suite.Equal("success", response["status"])
	suite.NotNil(response["data"])
}

// Run the test suite
func TestConsultationHandlerTestSuite(t *testing.T) {
	suite.Run(t, new(ConsultationHandlerTestSuite))
}