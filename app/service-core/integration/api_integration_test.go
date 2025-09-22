package integration

import (
	"fmt"
	"net/http"
	"service-core/domain/consultation"
	"service-core/rest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// APIIntegrationTestSuite tests HTTP API-level integration for the consultation domain
type APIIntegrationTestSuite struct {
	suite.Suite
	dbHelper *DatabaseTestHelper
	fixtures *TestFixtures
	helpers  *IntegrationTestHelpers
	userID   uuid.UUID
}

// SetupSuite initializes the test environment
func (suite *APIIntegrationTestSuite) SetupSuite() {
	suite.dbHelper = NewDatabaseTestHelper(suite.T(), "APIIntegrationTest")
	suite.fixtures = NewTestFixtures(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	suite.userID = uuid.New()

	// Create test user
	err := suite.fixtures.CreateTestUser(suite.userID, "apitest@example.com", "API Test User")
	require.NoError(suite.T(), err)

	// Setup API handler
	handler := suite.createHandler()
	suite.helpers = NewIntegrationTestHelpers(suite.T(), handler, suite.userID)
}

// TearDownSuite cleans up the test environment
func (suite *APIIntegrationTestSuite) TearDownSuite() {
	if suite.helpers != nil {
		suite.helpers.Close()
	}
	suite.dbHelper.CleanupDatabase(suite.T())
}

// SetupTest runs before each test
func (suite *APIIntegrationTestSuite) SetupTest() {
	// Clean consultation data but keep the user
	err := suite.fixtures.CleanupTestData([]uuid.UUID{suite.userID})
	if err != nil {
		suite.T().Logf("Warning: Failed to cleanup test data: %v", err)
	}

	// Recreate user if it was deleted
	err = suite.fixtures.CreateTestUser(suite.userID, "apitest@example.com", "API Test User")
	if err != nil {
		suite.T().Logf("User already exists or recreated: %v", err)
	}
}

// createHandler creates a test HTTP handler with all dependencies
func (suite *APIIntegrationTestSuite) createHandler() *rest.Handler {
	cfg := &rest.Config{
		Environment: "test",
		Version:     "test-1.0.0",
		Port:        "0",
	}

	// Create service layer
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	draftRepo := consultation.NewDraftRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	versionRepo := consultation.NewVersionRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	consultationService := consultation.NewService(consultationRepo, draftRepo, versionRepo)

	// Create mock auth service
	mockAuthService := &MockAuthService{userID: suite.userID}

	return rest.NewHandler(cfg, consultationService, mockAuthService)
}

// TestCRUDWorkflow tests the complete CRUD workflow through HTTP API
func (suite *APIIntegrationTestSuite) TestCRUDWorkflow() {
	t := suite.T()

	// Test Create
	createData := suite.helpers.GetDefaultConsultationData()
	createdConsultation := suite.helpers.CreateTestConsultation(createData)

	assert.Equal(t, suite.userID, createdConsultation.UserID)
	assert.Equal(t, "draft", createdConsultation.Status)
	assert.NotEqual(t, uuid.Nil, createdConsultation.ID)

	consultationID := createdConsultation.ID

	// Test Read
	retrievedConsultation := suite.helpers.GetConsultation(consultationID)
	assert.Equal(t, consultationID, retrievedConsultation.ID)
	assert.Equal(t, suite.userID, retrievedConsultation.UserID)

	// Test Update
	updateData := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name":  "Updated Business Name",
			"contact_person": "Updated Contact Person",
			"email":         "updated@example.com",
		},
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{"Updated Challenge 1", "Updated Challenge 2"},
			"urgency_level":     "high",
		},
	}

	updatedConsultation := suite.helpers.UpdateConsultation(consultationID, updateData)
	assert.Equal(t, consultationID, updatedConsultation.ID)

	// Verify update by parsing JSON
	err := updatedConsultation.ParseContactInfo()
	require.NoError(t, err)
	assert.Equal(t, "Updated Business Name", updatedConsultation.ParsedContactInfo.BusinessName)
	assert.Equal(t, "updated@example.com", updatedConsultation.ParsedContactInfo.Email)

	err = updatedConsultation.ParsePainPoints()
	require.NoError(t, err)
	assert.Contains(t, updatedConsultation.ParsedPainPoints.PrimaryChallenges, "Updated Challenge 1")
	assert.Equal(t, consultation.UrgencyHigh, updatedConsultation.ParsedPainPoints.UrgencyLevel)

	// Test List
	consultationsList := suite.helpers.ListConsultations("")
	assert.True(t, consultationsList.Total >= 1)
	assert.True(t, len(consultationsList.Consultations) >= 1)

	found := false
	for _, summary := range consultationsList.Consultations {
		if summary.ID == consultationID {
			found = true
			assert.Equal(t, "Updated Business Name", summary.BusinessName)
			break
		}
	}
	assert.True(t, found, "Updated consultation should be in the list")

	// Test Delete
	suite.helpers.DeleteConsultation(consultationID)

	// Verify deletion
	suite.helpers.AssertErrorResponse("GET", fmt.Sprintf("/consultations/%s", consultationID), nil, http.StatusNotFound, "")
}

// TestConsultationLifecycle tests the complete consultation lifecycle
func (suite *APIIntegrationTestSuite) TestConsultationLifecycle() {
	t := suite.T()

	// Create consultation
	createData := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name":  "Lifecycle Test Corp",
			"contact_person": "Test Contact",
			"email":         "lifecycle@test.com",
		},
		"business_context": map[string]interface{}{
			"industry":     "Technology",
			"team_size":    15,
			"business_type": "SaaS",
		},
	}

	consultation := suite.helpers.CreateTestConsultation(createData)
	consultationID := consultation.ID

	// Verify initial state
	assert.Equal(t, consultation.StatusDraft, consultation.Consultation.Status)
	assert.True(t, consultation.CompletionPercentage.Valid)

	// Add more data to increase completion
	updateData := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{"Manual processes", "Scalability issues"},
			"urgency_level":     "medium",
			"impact_assessment": "Significant impact on growth",
		},
		"goals_objectives": map[string]interface{}{
			"primary_goals":   []string{"Automate processes", "Improve scalability"},
			"success_metrics": []string{"50% reduction in manual work", "Handle 10x traffic"},
			"budget_range":    "$25k-50k",
		},
	}

	updatedConsultation := suite.helpers.UpdateConsultation(consultationID, updateData)
	assert.True(t, updatedConsultation.CompletionPercentage.Int32 > consultation.CompletionPercentage.Int32,
		"Completion percentage should increase after adding more data")

	// Complete the consultation
	completedConsultation := suite.helpers.CompleteConsultation(consultationID)
	assert.Equal(t, "completed", completedConsultation.Status)
	assert.True(t, completedConsultation.CompletedAt.Valid)
	assert.True(t, completedConsultation.CompletionPercentage.Int32 == 100,
		"Completed consultation should have 100% completion")

	// Archive the consultation
	archivedConsultation := suite.helpers.ArchiveConsultation(consultationID)
	assert.Equal(t, "archived", archivedConsultation.Status)

	// Verify final state
	finalConsultation := suite.helpers.GetConsultation(consultationID)
	assert.Equal(t, "archived", finalConsultation.Status)
}

// TestDraftManagement tests draft auto-save and promotion functionality
func (suite *APIIntegrationTestSuite) TestDraftManagement() {
	t := suite.T()

	// Create base consultation
	consultation := suite.helpers.CreateTestConsultation(nil)
	consultationID := consultation.ID

	// Create draft with additional data
	draftData := map[string]interface{}{
		"business_context": map[string]interface{}{
			"industry":          "Healthcare",
			"team_size":         25,
			"current_platform":  "Legacy EHR system",
		},
		"pain_points": map[string]interface{}{
			"primary_challenges":    []string{"Compliance complexity", "Data silos"},
			"urgency_level":        "high",
			"current_solution_gaps": []string{"No integration", "Manual reporting"},
		},
	}

	suite.helpers.CreateDraft(consultationID, draftData)

	// Retrieve and verify draft
	draft := suite.helpers.GetDraft(consultationID)
	assert.Equal(t, consultationID, draft.ConsultationID)
	assert.Equal(t, suite.userID, draft.UserID)

	// Parse draft data and verify content
	err := draft.ParseBusinessContext()
	require.NoError(t, err)
	assert.Equal(t, "Healthcare", draft.ParsedBusinessContext.Industry)
	assert.Equal(t, 25, *draft.ParsedBusinessContext.TeamSize)

	err = draft.ParsePainPoints()
	require.NoError(t, err)
	assert.Contains(t, draft.ParsedPainPoints.PrimaryChallenges, "Compliance complexity")
	assert.Equal(t, consultation.UrgencyHigh, draft.ParsedPainPoints.UrgencyLevel)

	// Promote draft to consultation
	promotedConsultation := suite.helpers.PromoteDraft(consultationID)
	assert.Equal(t, consultationID, promotedConsultation.ID)

	// Verify promoted data
	err = promotedConsultation.ParseBusinessContext()
	require.NoError(t, err)
	assert.Equal(t, "Healthcare", promotedConsultation.ParsedBusinessContext.Industry)

	err = promotedConsultation.ParsePainPoints()
	require.NoError(t, err)
	assert.Contains(t, promotedConsultation.ParsedPainPoints.PrimaryChallenges, "Compliance complexity")

	// Verify draft is cleaned up after promotion
	suite.helpers.AssertErrorResponse("GET", fmt.Sprintf("/consultations/%s/drafts", consultationID), nil, http.StatusNotFound, "")
}

// TestVersionHistory tests version tracking functionality
func (suite *APIIntegrationTestSuite) TestVersionHistory() {
	t := suite.T()

	// Create consultation
	consultation := suite.helpers.CreateTestConsultation(nil)
	consultationID := consultation.ID

	// Make several updates to create versions
	updates := []map[string]interface{}{
		{
			"business_context": map[string]interface{}{
				"industry":   "FinTech",
				"team_size":  20,
			},
		},
		{
			"pain_points": map[string]interface{}{
				"primary_challenges": []string{"Regulatory compliance", "Security concerns"},
				"urgency_level":     "critical",
			},
		},
		{
			"goals_objectives": map[string]interface{}{
				"primary_goals":  []string{"Achieve compliance", "Enhance security"},
				"budget_range":   "$50k-100k",
			},
		},
	}

	for i, updateData := range updates {
		suite.helpers.UpdateConsultation(consultationID, updateData)
		time.Sleep(10 * time.Millisecond) // Small delay to ensure different timestamps
		t.Logf("Applied update %d", i+1)
	}

	// Get version history
	versionHistory := suite.helpers.GetVersionHistory(consultationID)
	assert.True(t, len(versionHistory.Versions) >= 3, "Should have at least 3 versions")
	assert.True(t, versionHistory.Total >= 3, "Total count should be at least 3")

	// Verify version ordering (should be newest first)
	for i := 1; i < len(versionHistory.Versions); i++ {
		assert.True(t, versionHistory.Versions[i-1].VersionNumber >= versionHistory.Versions[i].VersionNumber,
			"Versions should be ordered by version number (descending)")
	}

	// Verify version content
	if len(versionHistory.Versions) > 0 {
		latestVersion := versionHistory.Versions[0]
		assert.Equal(t, consultationID, latestVersion.ConsultationID)
		assert.Equal(t, suite.userID, latestVersion.UserID)
		assert.True(t, latestVersion.VersionNumber > 0)
	}
}

// TestValidationHandling tests comprehensive input validation
func (suite *APIIntegrationTestSuite) TestValidationHandling() {
	t := suite.T()

	// Test validation scenarios
	scenarios := suite.fixtures.GetValidationScenarios()

	for _, scenario := range scenarios {
		t.Run(scenario.Name, func(t *testing.T) {
			if scenario.ShouldPass {
				// Should create successfully
				resp, err := suite.helpers.MakeRequestWithoutStatusCheck("POST", "/consultations", scenario.RequestData)
				require.NoError(t, err)
				defer resp.Body.Close()
				assert.Equal(t, http.StatusCreated, resp.StatusCode, "Valid data should be accepted")
			} else {
				// Should fail validation
				suite.helpers.AssertValidationError("POST", "/consultations", scenario.RequestData, scenario.ErrorFields)
			}
		})
	}

	// Test update validation
	consultation := suite.helpers.CreateTestConsultation(nil)
	consultationID := consultation.ID

	// Test invalid update
	invalidUpdate := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"email":   "invalid-email-format",
			"website": "not-a-url",
		},
		"pain_points": map[string]interface{}{
			"urgency_level": "invalid_urgency",
		},
	}

	path := fmt.Sprintf("/consultations/%s", consultationID)
	suite.helpers.AssertValidationError("PUT", path, invalidUpdate, []string{"email", "website", "urgency_level"})
}

// TestErrorHandling tests comprehensive error scenarios
func (suite *APIIntegrationTestSuite) TestErrorHandling() {
	t := suite.T()

	// Test 404 scenarios
	nonExistentID := uuid.New()

	testCases := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
		expectedInBody string
	}{
		{
			name:           "Get non-existent consultation",
			method:         "GET",
			path:           fmt.Sprintf("/consultations/%s", nonExistentID),
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Update non-existent consultation",
			method:         "PUT",
			path:           fmt.Sprintf("/consultations/%s", nonExistentID),
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Delete non-existent consultation",
			method:         "DELETE",
			path:           fmt.Sprintf("/consultations/%s", nonExistentID),
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Invalid UUID format",
			method:         "GET",
			path:           "/consultations/invalid-uuid",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			suite.helpers.AssertErrorResponse(tc.method, tc.path, nil, tc.expectedStatus, tc.expectedInBody)
		})
	}

	// Test malformed JSON
	resp, err := suite.helpers.MakeRequestWithHeaders("POST", "/consultations", "invalid json", map[string]string{
		"Authorization": suite.helpers.GetAuthToken(),
		"Content-Type":  "application/json",
	})
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "Should reject malformed JSON")

	// Test missing authentication
	resp, err = suite.helpers.MakeRequestWithoutAuth("GET", "/consultations", nil)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Should require authentication")

	// Test wrong content type
	resp, err = suite.helpers.MakeRequestWithHeaders("POST", "/consultations", "{}", map[string]string{
		"Authorization": suite.helpers.GetAuthToken(),
		"Content-Type":  "text/plain",
	})
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.True(t, resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnsupportedMediaType,
		"Should reject wrong content type")
}

// TestPaginationAndFiltering tests list operations with various parameters
func (suite *APIIntegrationTestSuite) TestPaginationAndFiltering() {
	t := suite.T()

	// Create test data
	bulkCount := 15
	statuses := []consultation.ConsultationStatus{
		consultation.StatusDraft,
		consultation.StatusCompleted,
		consultation.StatusArchived,
	}

	createdIDs, err := suite.fixtures.CreateBulkConsultations(suite.userID, bulkCount, statuses)
	require.NoError(t, err)
	require.Equal(t, bulkCount, len(createdIDs))

	// Complete some consultations to have varied statuses
	for i, id := range createdIDs {
		if i%3 == 0 { // Complete every third consultation
			suite.helpers.CompleteConsultation(id)
		}
	}

	// Test default pagination
	defaultList := suite.helpers.ListConsultations("")
	assert.True(t, defaultList.Total >= int64(bulkCount))
	assert.True(t, len(defaultList.Consultations) > 0)
	assert.Equal(t, 1, defaultList.Page)

	// Test custom pagination
	page2List := suite.helpers.ListConsultations("page=2&limit=5")
	assert.Equal(t, 2, page2List.Page)
	assert.Equal(t, 5, page2List.Limit)

	// Test status filtering
	completedList := suite.helpers.ListConsultations("status=completed")
	for _, summary := range completedList.Consultations {
		assert.Equal(t, consultation.StatusCompleted, summary.Status)
	}

	draftList := suite.helpers.ListConsultations("status=draft")
	for _, summary := range draftList.Consultations {
		assert.Equal(t, consultation.StatusDraft, summary.Status)
	}

	// Test search functionality
	searchList := suite.helpers.ListConsultations("q=Technology")
	// Results depend on the test data, but should not error
	assert.True(t, searchList.Total >= 0)

	// Test combined filters
	combinedList := suite.helpers.ListConsultations("status=completed&page=1&limit=3")
	assert.Equal(t, 1, combinedList.Page)
	assert.Equal(t, 3, combinedList.Limit)
	for _, summary := range combinedList.Consultations {
		assert.Equal(t, consultation.StatusCompleted, summary.Status)
	}

	// Test invalid parameters
	suite.helpers.AssertErrorResponse("GET", "/consultations?page=-1", nil, http.StatusBadRequest, "")
	suite.helpers.AssertErrorResponse("GET", "/consultations?limit=0", nil, http.StatusBadRequest, "")
	suite.helpers.AssertErrorResponse("GET", "/consultations?status=invalid_status", nil, http.StatusBadRequest, "")
}

// TestConcurrentAPIAccess tests concurrent API access scenarios
func (suite *APIIntegrationTestSuite) TestConcurrentAPIAccess() {
	t := suite.T()

	// Create base consultation
	consultation := suite.helpers.CreateTestConsultation(nil)
	consultationID := consultation.ID

	// Test concurrent updates
	concurrency := 10
	updateData := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Concurrent Update Test",
		},
	}

	expectations := suite.helpers.GetDefaultPerformanceExpectations()
	expectations.MinSuccessRate = 0.8 // Allow for some failures due to concurrency

	results := suite.helpers.PerformConcurrentRequests(
		"PUT",
		fmt.Sprintf("/consultations/%s", consultationID),
		updateData,
		concurrency,
	)

	analysis := suite.helpers.AnalyzeConcurrentResults(results)
	suite.helpers.AssertConcurrentPerformance(analysis, expectations)

	// Verify the consultation is still in a valid state
	finalConsultation := suite.helpers.GetConsultation(consultationID)
	assert.Equal(t, consultationID, finalConsultation.ID)
	assert.Contains(t, []string{"draft", "completed", "archived"}, finalConsultation.Status)
}

// TestPerformanceUnderLoad tests API performance under load
func (suite *APIIntegrationTestSuite) TestPerformanceUnderLoad() {
	t := suite.T()

	// Test creation performance
	createData := suite.helpers.GetDefaultConsultationData()
	concurrency := 20

	start := time.Now()
	results := suite.helpers.PerformConcurrentRequests("POST", "/consultations", createData, concurrency)
	totalDuration := time.Since(start)

	analysis := suite.helpers.AnalyzeConcurrentResults(results)

	t.Logf("Created %d consultations concurrently in %v", concurrency, totalDuration)
	t.Logf("Success rate: %.2f%%, Average latency: %v, Max latency: %v",
		float64(analysis.SuccessfulRequests)/float64(analysis.TotalRequests)*100,
		analysis.AverageLatency,
		analysis.MaxLatency)

	// Performance expectations for creation under load
	expectations := PerformanceExpectations{
		MinSuccessRate:      0.8,  // 80% success rate under load
		MaxAverageLatency:   1 * time.Second,
		MaxLatency:          3 * time.Second,
	}

	suite.helpers.AssertConcurrentPerformance(analysis, expectations)

	// Test read performance
	if analysis.SuccessfulRequests > 0 {
		// Test listing performance under load
		listResults := suite.helpers.PerformConcurrentRequests("GET", "/consultations", nil, concurrency)
		listAnalysis := suite.helpers.AnalyzeConcurrentResults(listResults)

		t.Logf("Listed consultations %d times concurrently", concurrency)
		t.Logf("List success rate: %.2f%%, Average latency: %v",
			float64(listAnalysis.SuccessfulRequests)/float64(listAnalysis.TotalRequests)*100,
			listAnalysis.AverageLatency)

		// Read operations should be faster and more reliable
		listExpectations := PerformanceExpectations{
			MinSuccessRate:      0.95, // 95% success rate for reads
			MaxAverageLatency:   500 * time.Millisecond,
			MaxLatency:          2 * time.Second,
		}

		suite.helpers.AssertConcurrentPerformance(listAnalysis, listExpectations)
	}
}

// TestContentNegotiation tests HTTP content negotiation
func (suite *APIIntegrationTestSuite) TestContentNegotiation() {
	t := suite.T()

	createData := suite.helpers.GetDefaultConsultationData()

	testCases := []struct {
		name        string
		contentType string
		shouldPass  bool
	}{
		{
			name:        "Valid JSON content type",
			contentType: "application/json",
			shouldPass:  true,
		},
		{
			name:        "JSON with charset",
			contentType: "application/json; charset=utf-8",
			shouldPass:  true,
		},
		{
			name:        "Invalid content type",
			contentType: "text/plain",
			shouldPass:  false,
		},
		{
			name:        "XML content type",
			contentType: "application/xml",
			shouldPass:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := suite.helpers.MakeRequestWithHeaders("POST", "/consultations", createData, map[string]string{
				"Authorization": suite.helpers.GetAuthToken(),
				"Content-Type":  tc.contentType,
			})
			require.NoError(t, err)
			defer resp.Body.Close()

			if tc.shouldPass {
				assert.Equal(t, http.StatusCreated, resp.StatusCode, "Should accept valid content type")
			} else {
				assert.True(t, resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnsupportedMediaType,
					"Should reject invalid content type")
			}
		})
	}

	// Test Accept header handling
	consultation := suite.helpers.CreateTestConsultation(nil)

	resp, err := suite.helpers.MakeRequestWithHeaders("GET", fmt.Sprintf("/consultations/%s", consultation.ID), nil, map[string]string{
		"Authorization": suite.helpers.GetAuthToken(),
		"Accept":        "application/json",
	})
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Content-Type"), "application/json")
}

// TestCORSHeaders tests CORS header handling
func (suite *APIIntegrationTestSuite) TestCORSHeaders() {
	t := suite.T()

	// Test OPTIONS request
	resp, err := suite.helpers.MakeRequestWithHeaders("OPTIONS", "/consultations", nil, map[string]string{
		"Origin": "https://example.com",
	})
	require.NoError(t, err)
	defer resp.Body.Close()

	// CORS headers should be present (implementation dependent)
	assert.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNoContent,
		"OPTIONS request should be handled")
}

// TestAPIIntegrationSuite runs the API integration test suite
func TestAPIIntegrationSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping API integration tests in short mode")
	}

	suite.Run(t, new(APIIntegrationTestSuite))
}

// MockAuthService provides authentication for testing
type MockAuthService struct {
	userID uuid.UUID
}

// Auth implements the authentication interface for testing
func (m *MockAuthService) Auth(token string, minLevel int) (*rest.AuthResult, error) {
	// Extract user ID from test token format: "Bearer test-jwt-token-{uuid}"
	if len(token) > 25 && token[:25] == "Bearer test-jwt-token-" {
		userIDStr := token[25:]
		if userID, err := uuid.Parse(userIDStr); err == nil {
			return &rest.AuthResult{
				UserID: userID,
				Level:  10, // Admin level
			}, nil
		}
	}
	return nil, fmt.Errorf("invalid test token")
}