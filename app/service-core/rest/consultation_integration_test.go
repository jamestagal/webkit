package rest

import (
	"app/pkg/auth"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"service-core/config"
	"service-core/domain/consultation"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
)

// ConsultationIntegrationTestSuite tests the full API integration
type ConsultationIntegrationTestSuite struct {
	suite.Suite
	server              *httptest.Server
	consultationService consultation.ConsultationService
	authService         auth.AuthService
	testUserID          uuid.UUID
	validToken          string
}

// SetupSuite sets up the integration test environment
func (suite *ConsultationIntegrationTestSuite) SetupSuite() {
	// For integration tests, we would normally set up a test database
	// For now, we'll skip the database setup and focus on the API layer structure
	suite.testUserID = uuid.New()
	suite.validToken = "Bearer test-token"

	// Create a test configuration
	cfg := &config.Config{
		ClientURL:   "http://localhost:3000",
		HTTPPort:    "4001",
		HTTPTimeout: 30 * time.Second,
	}

	// Create mock services for integration testing
	// In a real scenario, these would be connected to a test database
	mockAuthService := &MockAuthService{}
	mockConsultationService := &MockConsultationService{}

	// Create handler
	handler := &Handler{
		cfg:                 cfg,
		authService:         mockAuthService,
		consultationService: mockConsultationService,
	}

	// Create test server
	mux := http.NewServeMux()
	mux.HandleFunc("/consultations", handler.handleConsultationsCollection)
	mux.HandleFunc("/consultations/{id}", handler.handleConsultationResource)
	mux.HandleFunc("/consultations/{id}/drafts", handler.handleConsultationDrafts)
	mux.HandleFunc("/consultations/{id}/versions", handler.handleConsultationVersions)
	mux.HandleFunc("/consultations/{id}/complete", handler.handleConsultationComplete)
	mux.HandleFunc("/consultations/{id}/archive", handler.handleConsultationArchive)
	mux.HandleFunc("/consultations/{id}/restore", handler.handleConsultationRestore)

	suite.server = httptest.NewServer(mux)
}

// TearDownSuite cleans up the test environment
func (suite *ConsultationIntegrationTestSuite) TearDownSuite() {
	if suite.server != nil {
		suite.server.Close()
	}
}

// TestCreateConsultationWorkflow tests the complete consultation creation workflow
func (suite *ConsultationIntegrationTestSuite) TestCreateConsultationWorkflow() {
	// Test data
	consultationData := map[string]interface{}{
		"contactInfo": map[string]interface{}{
			"businessName":  "Integration Test Business",
			"contactPerson": "Jane Doe",
			"email":         "jane@example.com",
			"phone":         "+1-555-0123",
			"website":       "https://example.com",
		},
		"businessContext": map[string]interface{}{
			"industry":    "Technology",
			"businessType": "SaaS",
			"teamSize":    25,
			"currentPlatform": "wordpress",
			"digitalPresence": []string{"website", "social-media"},
			"marketingChannels": []string{"seo", "paid-ads"},
		},
		"painPoints": map[string]interface{}{
			"primaryChallenges": []string{"Poor website performance", "Low conversion rates"},
			"technicalIssues":   []string{"Slow loading times", "Mobile responsiveness"},
			"urgencyLevel":      "high",
			"impactAssessment":  "Losing customers due to poor user experience",
		},
		"goalsObjectives": map[string]interface{}{
			"primaryGoals":    []string{"Improve website performance", "Increase conversions"},
			"secondaryGoals":  []string{"Better SEO", "Mobile-first design"},
			"successMetrics":  []string{"Page load time < 3s", "Conversion rate > 5%"},
			"budgetRange":     "$25k-50k",
		},
	}

	body, err := json.Marshal(consultationData)
	suite.Require().NoError(err)

	// Create HTTP request
	req, err := http.NewRequest(http.MethodPost, suite.server.URL+"/consultations", bytes.NewReader(body))
	suite.Require().NoError(err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", suite.validToken)

	// Make request
	client := &http.Client{}
	resp, err := client.Do(req)
	suite.Require().NoError(err)
	defer resp.Body.Close()

	// Assert response
	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)
	suite.Assert().Equal("application/json", resp.Header.Get("Content-Type"))

	// Parse response
	var consultation consultation.Consultation
	err = json.NewDecoder(resp.Body).Decode(&consultation)
	suite.Require().NoError(err)

	// Validate response structure
	suite.Assert().NotEqual(uuid.Nil, consultation.ID)
	suite.Assert().Equal(suite.testUserID, consultation.UserID)
	suite.Assert().Equal("draft", consultation.Status)
	suite.Assert().True(consultation.CompletionPercentage.Valid)
	suite.Assert().Greater(consultation.CompletionPercentage.Int32, int32(0))
}

// TestGetConsultationWithValidation tests retrieving a consultation with validation
func (suite *ConsultationIntegrationTestSuite) TestGetConsultationWithValidation() {
	consultationID := uuid.New()

	// Create HTTP request
	req, err := http.NewRequest(http.MethodGet, suite.server.URL+"/consultations/"+consultationID.String(), nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	// Make request
	client := &http.Client{}
	resp, err := client.Do(req)
	suite.Require().NoError(err)
	defer resp.Body.Close()

	// For this test, we expect a successful response (mocked)
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

// TestListConsultationsWithFilters tests listing consultations with various filters
func (suite *ConsultationIntegrationTestSuite) TestListConsultationsWithFilters() {
	testCases := []struct {
		name         string
		queryParams  string
		expectedCode int
	}{
		{
			name:         "Default pagination",
			queryParams:  "",
			expectedCode: http.StatusOK,
		},
		{
			name:         "Custom pagination",
			queryParams:  "?page=2&limit=10",
			expectedCode: http.StatusOK,
		},
		{
			name:         "Filter by status",
			queryParams:  "?status=draft&page=1&limit=20",
			expectedCode: http.StatusOK,
		},
		{
			name:         "Search query",
			queryParams:  "?search=technology&page=1&limit=20",
			expectedCode: http.StatusOK,
		},
		{
			name:         "Invalid status filter",
			queryParams:  "?status=invalid",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Invalid page number",
			queryParams:  "?page=0",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Invalid limit",
			queryParams:  "?limit=200",
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			// Create HTTP request
			req, err := http.NewRequest(http.MethodGet, suite.server.URL+"/consultations"+tc.queryParams, nil)
			suite.Require().NoError(err)
			req.Header.Set("Authorization", suite.validToken)

			// Make request
			client := &http.Client{}
			resp, err := client.Do(req)
			suite.Require().NoError(err)
			defer resp.Body.Close()

			// Assert response
			suite.Assert().Equal(tc.expectedCode, resp.StatusCode)

			if tc.expectedCode == http.StatusOK {
				// Validate response structure for successful requests
				var response consultation.ConsultationsResponse
				err = json.NewDecoder(resp.Body).Decode(&response)
				suite.Require().NoError(err)
				suite.Assert().GreaterOrEqual(response.Count, int64(0))
				suite.Assert().NotNil(response.Consultations)
			}
		})
	}
}

// TestUpdateConsultationWorkflow tests the consultation update workflow
func (suite *ConsultationIntegrationTestSuite) TestUpdateConsultationWorkflow() {
	consultationID := uuid.New()

	// Update data
	updateData := map[string]interface{}{
		"contactInfo": map[string]interface{}{
			"businessName": "Updated Business Name",
			"email":        "updated@example.com",
		},
		"status": "completed",
	}

	body, err := json.Marshal(updateData)
	suite.Require().NoError(err)

	// Create HTTP request
	req, err := http.NewRequest(http.MethodPut, suite.server.URL+"/consultations/"+consultationID.String(), bytes.NewReader(body))
	suite.Require().NoError(err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", suite.validToken)

	// Make request
	client := &http.Client{}
	resp, err := client.Do(req)
	suite.Require().NoError(err)
	defer resp.Body.Close()

	// Assert response
	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

// TestDraftManagementWorkflow tests the complete draft management workflow
func (suite *ConsultationIntegrationTestSuite) TestDraftManagementWorkflow() {
	consultationID := uuid.New()

	// 1. Create a draft
	draftData := map[string]interface{}{
		"contactInfo": map[string]interface{}{
			"businessName": "Draft Business",
		},
		"autoSaved":   true,
		"draftNotes": "Work in progress",
	}

	body, err := json.Marshal(draftData)
	suite.Require().NoError(err)

	req, err := http.NewRequest(http.MethodPost, suite.server.URL+"/consultations/"+consultationID.String()+"/drafts", bytes.NewReader(body))
	suite.Require().NoError(err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", suite.validToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusCreated, resp.StatusCode)

	// 2. Get the draft
	req, err = http.NewRequest(http.MethodGet, suite.server.URL+"/consultations/"+consultationID.String()+"/drafts", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	resp, err = client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// 3. Update the draft
	updatedDraftData := map[string]interface{}{
		"contactInfo": map[string]interface{}{
			"businessName": "Updated Draft Business",
		},
		"autoSaved":   true,
		"draftNotes": "Updated work in progress",
	}

	body, err = json.Marshal(updatedDraftData)
	suite.Require().NoError(err)

	req, err = http.NewRequest(http.MethodPut, suite.server.URL+"/consultations/"+consultationID.String()+"/drafts", bytes.NewReader(body))
	suite.Require().NoError(err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", suite.validToken)

	resp, err = client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// 4. Delete the draft
	req, err = http.NewRequest(http.MethodDelete, suite.server.URL+"/consultations/"+consultationID.String()+"/drafts", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	resp, err = client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusNoContent, resp.StatusCode)
}

// TestVersionHistoryWorkflow tests the version history endpoints
func (suite *ConsultationIntegrationTestSuite) TestVersionHistoryWorkflow() {
	consultationID := uuid.New()

	// 1. Get version history
	req, err := http.NewRequest(http.MethodGet, suite.server.URL+"/consultations/"+consultationID.String()+"/versions", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// 2. Get version history with pagination
	req, err = http.NewRequest(http.MethodGet, suite.server.URL+"/consultations/"+consultationID.String()+"/versions?page=1&limit=5", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	resp, err = client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// 3. Get specific version (this actually performs a rollback in our implementation)
	req, err = http.NewRequest(http.MethodGet, suite.server.URL+"/consultations/"+consultationID.String()+"/versions/1", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	resp, err = client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

// TestConsultationLifecycleWorkflow tests the complete consultation lifecycle
func (suite *ConsultationIntegrationTestSuite) TestConsultationLifecycleWorkflow() {
	consultationID := uuid.New()
	client := &http.Client{}

	// 1. Complete consultation
	req, err := http.NewRequest(http.MethodPost, suite.server.URL+"/consultations/"+consultationID.String()+"/complete", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	resp, err := client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// 2. Archive consultation
	req, err = http.NewRequest(http.MethodPost, suite.server.URL+"/consultations/"+consultationID.String()+"/archive", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	resp, err = client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)

	// 3. Restore consultation
	req, err = http.NewRequest(http.MethodPost, suite.server.URL+"/consultations/"+consultationID.String()+"/restore", nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	resp, err = client.Do(req)
	suite.Require().NoError(err)
	resp.Body.Close()

	suite.Assert().Equal(http.StatusOK, resp.StatusCode)
}

// TestDeleteConsultationWorkflow tests the consultation deletion workflow
func (suite *ConsultationIntegrationTestSuite) TestDeleteConsultationWorkflow() {
	consultationID := uuid.New()

	// Delete consultation
	req, err := http.NewRequest(http.MethodDelete, suite.server.URL+"/consultations/"+consultationID.String(), nil)
	suite.Require().NoError(err)
	req.Header.Set("Authorization", suite.validToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	suite.Require().NoError(err)
	defer resp.Body.Close()

	suite.Assert().Equal(http.StatusNoContent, resp.StatusCode)
	suite.Assert().Empty(resp.Header.Get("Content-Type"))
}

// TestErrorHandling tests various error scenarios
func (suite *ConsultationIntegrationTestSuite) TestErrorHandling() {
	client := &http.Client{}

	testCases := []struct {
		name         string
		method       string
		url          string
		body         string
		headers      map[string]string
		expectedCode int
	}{
		{
			name:         "Missing authentication",
			method:       http.MethodGet,
			url:          "/consultations",
			expectedCode: http.StatusUnauthorized,
		},
		{
			name:   "Invalid JSON body",
			method: http.MethodPost,
			url:    "/consultations",
			body:   `{"invalid": json}`,
			headers: map[string]string{
				"Authorization": suite.validToken,
				"Content-Type":  "application/json",
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name:   "Invalid consultation ID",
			method: http.MethodGet,
			url:    "/consultations/invalid-uuid",
			headers: map[string]string{
				"Authorization": suite.validToken,
			},
			expectedCode: http.StatusInternalServerError,
		},
		{
			name:   "Unsupported method",
			method: http.MethodPatch,
			url:    "/consultations",
			headers: map[string]string{
				"Authorization": suite.validToken,
			},
			expectedCode: http.StatusMethodNotAllowed,
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			var reqBody *strings.Reader
			if tc.body != "" {
				reqBody = strings.NewReader(tc.body)
			}

			req, err := http.NewRequest(tc.method, suite.server.URL+tc.url, reqBody)
			suite.Require().NoError(err)

			// Set headers
			for key, value := range tc.headers {
				req.Header.Set(key, value)
			}

			resp, err := client.Do(req)
			suite.Require().NoError(err)
			defer resp.Body.Close()

			suite.Assert().Equal(tc.expectedCode, resp.StatusCode)
		})
	}
}

// TestCORSHeaders tests that CORS headers are properly set
func (suite *ConsultationIntegrationTestSuite) TestCORSHeaders() {
	req, err := http.NewRequest(http.MethodOptions, suite.server.URL+"/consultations", nil)
	suite.Require().NoError(err)

	client := &http.Client{}
	resp, err := client.Do(req)
	suite.Require().NoError(err)
	defer resp.Body.Close()

	suite.Assert().Equal(http.StatusNoContent, resp.StatusCode)
	suite.Assert().Contains(resp.Header.Get("Access-Control-Allow-Methods"), "GET")
	suite.Assert().Contains(resp.Header.Get("Access-Control-Allow-Methods"), "POST")
	suite.Assert().Contains(resp.Header.Get("Access-Control-Allow-Methods"), "PUT")
	suite.Assert().Contains(resp.Header.Get("Access-Control-Allow-Methods"), "DELETE")
}

// TestRateLimitingAndThrottling tests rate limiting (when implemented)
func (suite *ConsultationIntegrationTestSuite) TestRateLimitingAndThrottling() {
	// This test would verify rate limiting when implemented
	// For now, we just test that multiple requests are handled correctly
	client := &http.Client{}

	for i := 0; i < 5; i++ {
		req, err := http.NewRequest(http.MethodGet, suite.server.URL+"/consultations", nil)
		suite.Require().NoError(err)
		req.Header.Set("Authorization", suite.validToken)

		resp, err := client.Do(req)
		suite.Require().NoError(err)
		resp.Body.Close()

		// All requests should succeed (no rate limiting implemented yet)
		suite.Assert().Equal(http.StatusOK, resp.StatusCode)
	}
}

// TestContentNegotiation tests content type handling
func (suite *ConsultationIntegrationTestSuite) TestContentNegotiation() {
	consultationData := map[string]interface{}{
		"contactInfo": map[string]interface{}{
			"businessName": "Content Test Business",
		},
	}

	body, err := json.Marshal(consultationData)
	suite.Require().NoError(err)

	testCases := []struct {
		name         string
		contentType  string
		expectedCode int
	}{
		{
			name:         "Valid JSON content type",
			contentType:  "application/json",
			expectedCode: http.StatusCreated,
		},
		{
			name:         "JSON with charset",
			contentType:  "application/json; charset=utf-8",
			expectedCode: http.StatusCreated,
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			req, err := http.NewRequest(http.MethodPost, suite.server.URL+"/consultations", bytes.NewReader(body))
			suite.Require().NoError(err)
			req.Header.Set("Content-Type", tc.contentType)
			req.Header.Set("Authorization", suite.validToken)

			client := &http.Client{}
			resp, err := client.Do(req)
			suite.Require().NoError(err)
			defer resp.Body.Close()

			suite.Assert().Equal(tc.expectedCode, resp.StatusCode)
		})
	}
}

// Run the integration test suite
func TestConsultationIntegrationSuite(t *testing.T) {
	suite.Run(t, new(ConsultationIntegrationTestSuite))
}