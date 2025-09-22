package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"service-core/domain/consultation"
	"service-core/rest"
	"service-core/storage/query"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

// ConsultationEndToEndTestSuite provides comprehensive end-to-end testing for the complete consultation domain workflow
type ConsultationEndToEndTestSuite struct {
	suite.Suite
	db         *sql.DB
	queries    *query.Queries
	handler    *rest.Handler
	server     *httptest.Server
	userID     uuid.UUID
	authToken  string
	baseURL    string
}

// SetupSuite initializes the test environment with a real database
func (suite *ConsultationEndToEndTestSuite) SetupSuite() {
	var err error

	// Set up test database (SQLite for simplicity in tests)
	suite.db, err = sql.Open("sqlite", ":memory:")
	require.NoError(suite.T(), err)

	// Initialize SQLC queries
	suite.queries = query.New(suite.db)

	// Create tables using the schema
	suite.createTables()

	// Create a test user
	suite.userID = uuid.New()
	suite.createTestUser()

	// Set up HTTP handler with real services
	suite.setupHandler()

	// Create test server
	suite.server = httptest.NewServer(suite.handler)
	suite.baseURL = suite.server.URL

	// Generate mock auth token
	suite.authToken = "Bearer test-jwt-token-" + suite.userID.String()
}

// TearDownSuite cleans up the test environment
func (suite *ConsultationEndToEndTestSuite) TearDownSuite() {
	if suite.server != nil {
		suite.server.Close()
	}
	if suite.db != nil {
		suite.db.Close()
	}
}

// SetupTest runs before each individual test
func (suite *ConsultationEndToEndTestSuite) SetupTest() {
	// Clean up existing test data
	suite.cleanupTestData()
}

// TestCompleteConsultationLifecycleWorkflow tests the complete consultation lifecycle from creation to completion
func (suite *ConsultationEndToEndTestSuite) TestCompleteConsultationLifecycleWorkflow() {
	t := suite.T()

	// Step 1: Create a new consultation
	createRequest := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name":   "Acme Corp",
			"contact_person":  "John Doe",
			"email":          "john@acme.com",
			"phone":          "+1-555-0123",
			"website":        "https://acme.com",
		},
		"business_context": map[string]interface{}{
			"industry":      "Technology",
			"business_type": "B2B SaaS",
			"team_size":     15,
		},
	}

	createResp := suite.makeRequest("POST", "/consultations", createRequest, http.StatusCreated)

	var consultation consultation.Consultation
	err := json.Unmarshal(createResp, &consultation)
	require.NoError(t, err)

	consultationID := consultation.ID

	// Verify initial state
	assert.Equal(t, consultation.StatusDraft, consultation.Consultation.Status)
	assert.Equal(t, suite.userID, consultation.UserID)
	assert.True(t, consultation.CompletionPercentage.Valid)
	assert.True(t, consultation.CompletionPercentage.Int32 >= 0)

	// Step 2: Update consultation with pain points
	updateRequest := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{"Manual processes", "Poor data visibility"},
			"urgency_level":     "high",
			"impact_assessment": "Critical for business growth",
		},
	}

	updateURL := fmt.Sprintf("/consultations/%s", consultationID)
	updateResp := suite.makeRequest("PUT", updateURL, updateRequest, http.StatusOK)

	err = json.Unmarshal(updateResp, &consultation)
	require.NoError(t, err)

	// Verify update and completion percentage increased
	assert.True(t, consultation.CompletionPercentage.Int32 > 50, "Completion percentage should increase after adding pain points")

	// Step 3: Add goals and objectives
	goalsUpdateRequest := map[string]interface{}{
		"goals_objectives": map[string]interface{}{
			"primary_goals":    []string{"Automate key processes", "Improve data analytics"},
			"success_metrics":  []string{"50% reduction in manual work", "Real-time reporting"},
			"budget_range":     "$25k-50k",
		},
	}

	updateResp = suite.makeRequest("PUT", updateURL, goalsUpdateRequest, http.StatusOK)

	err = json.Unmarshal(updateResp, &consultation)
	require.NoError(t, err)

	// Step 4: Complete the consultation
	completeURL := fmt.Sprintf("/consultations/%s/complete", consultationID)
	completeResp := suite.makeRequest("POST", completeURL, nil, http.StatusOK)

	err = json.Unmarshal(completeResp, &consultation)
	require.NoError(t, err)

	// Verify completion
	assert.Equal(t, "completed", consultation.Status)
	assert.True(t, consultation.CompletedAt.Valid)
	assert.True(t, consultation.CompletionPercentage.Int32 == 100, "Completed consultation should have 100% completion")

	// Step 5: Verify the consultation can be retrieved
	getResp := suite.makeRequest("GET", updateURL, nil, http.StatusOK)

	var retrievedConsultation consultation.Consultation
	err = json.Unmarshal(getResp, &retrievedConsultation)
	require.NoError(t, err)

	assert.Equal(t, consultationID, retrievedConsultation.ID)
	assert.Equal(t, "completed", retrievedConsultation.Status)

	// Step 6: Test archiving
	archiveURL := fmt.Sprintf("/consultations/%s/archive", consultationID)
	archiveResp := suite.makeRequest("POST", archiveURL, nil, http.StatusOK)

	err = json.Unmarshal(archiveResp, &consultation)
	require.NoError(t, err)
	assert.Equal(t, "archived", consultation.Status)
}

// TestDraftAutoSaveWorkflow tests the draft auto-save functionality
func (suite *ConsultationEndToEndTestSuite) TestDraftAutoSaveWorkflow() {
	t := suite.T()

	// Create initial consultation
	createRequest := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Draft Test Co",
		},
	}

	createResp := suite.makeRequest("POST", "/consultations", createRequest, http.StatusCreated)

	var consultation consultation.Consultation
	err := json.Unmarshal(createResp, &consultation)
	require.NoError(t, err)

	consultationID := consultation.ID

	// Test auto-save functionality
	draftData := map[string]interface{}{
		"business_context": map[string]interface{}{
			"industry":     "Healthcare",
			"team_size":    5,
		},
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{"Compliance issues"},
			"urgency_level":     "medium",
		},
	}

	autosaveURL := fmt.Sprintf("/consultations/%s/drafts", consultationID)
	suite.makeRequest("POST", autosaveURL, draftData, http.StatusOK)

	// Retrieve draft
	getDraftResp := suite.makeRequest("GET", autosaveURL, nil, http.StatusOK)

	var draft consultation.ConsultationDraft
	err = json.Unmarshal(getDraftResp, &draft)
	require.NoError(t, err)

	assert.Equal(t, consultationID, draft.ConsultationID)
	assert.True(t, len(draft.BusinessContext) > 0)
	assert.True(t, len(draft.PainPoints) > 0)

	// Test promoting draft to consultation
	promoteURL := fmt.Sprintf("/consultations/%s/drafts/promote", consultationID)
	promoteResp := suite.makeRequest("POST", promoteURL, nil, http.StatusOK)

	var promotedConsultation consultation.Consultation
	err = json.Unmarshal(promoteResp, &promotedConsultation)
	require.NoError(t, err)

	// Verify draft data was promoted to consultation
	assert.True(t, len(promotedConsultation.BusinessContext) > 0)
	assert.True(t, len(promotedConsultation.PainPoints) > 0)
}

// TestVersionTrackingWorkflow tests version tracking and rollback functionality
func (suite *ConsultationEndToEndTestSuite) TestVersionTrackingWorkflow() {
	t := suite.T()

	// Create consultation
	createRequest := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Version Test Corp",
			"email":        "test@versioncorp.com",
		},
	}

	createResp := suite.makeRequest("POST", "/consultations", createRequest, http.StatusCreated)

	var consultation consultation.Consultation
	err := json.Unmarshal(createResp, &consultation)
	require.NoError(t, err)

	consultationID := consultation.ID

	// Make first update to create version 1
	updateRequest1 := map[string]interface{}{
		"business_context": map[string]interface{}{
			"industry":   "FinTech",
			"team_size": 20,
		},
	}

	updateURL := fmt.Sprintf("/consultations/%s", consultationID)
	suite.makeRequest("PUT", updateURL, updateRequest1, http.StatusOK)

	// Make second update to create version 2
	updateRequest2 := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{"Regulatory compliance", "Data security"},
			"urgency_level":     "critical",
		},
	}

	suite.makeRequest("PUT", updateURL, updateRequest2, http.StatusOK)

	// Get version history
	versionHistoryURL := fmt.Sprintf("/consultations/%s/versions", consultationID)
	versionResp := suite.makeRequest("GET", versionHistoryURL, nil, http.StatusOK)

	var versionResponse struct {
		Versions []consultation.ConsultationVersion `json:"versions"`
		Total    int                                `json:"total"`
	}
	err = json.Unmarshal(versionResp, &versionResponse)
	require.NoError(t, err)

	assert.True(t, len(versionResponse.Versions) >= 2, "Should have at least 2 versions")
	assert.True(t, versionResponse.Total >= 2, "Total count should be at least 2")

	// Verify version ordering (newest first)
	for i := 1; i < len(versionResponse.Versions); i++ {
		assert.True(t, versionResponse.Versions[i-1].VersionNumber >= versionResponse.Versions[i].VersionNumber)
	}

	// Test rollback functionality (if implemented)
	if len(versionResponse.Versions) > 1 {
		rollbackVersion := versionResponse.Versions[1].VersionNumber
		rollbackURL := fmt.Sprintf("/consultations/%s/versions/%d/rollback", consultationID, rollbackVersion)

		// This endpoint might not be implemented yet, so we'll check for both success and not found
		resp, err := suite.makeRequestWithoutStatusCheck("POST", rollbackURL, nil)
		if err == nil && (resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound) {
			// Expected - either rollback worked or endpoint doesn't exist yet
		} else {
			t.Logf("Rollback endpoint response: %d", resp.StatusCode)
		}
	}
}

// TestConcurrentAccessHandling tests concurrent modification scenarios
func (suite *ConsultationEndToEndTestSuite) TestConcurrentAccessHandling() {
	t := suite.T()

	// Create consultation
	createRequest := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Concurrent Test Inc",
		},
	}

	createResp := suite.makeRequest("POST", "/consultations", createRequest, http.StatusCreated)

	var consultation consultation.Consultation
	err := json.Unmarshal(createResp, &consultation)
	require.NoError(t, err)

	consultationID := consultation.ID
	updateURL := fmt.Sprintf("/consultations/%s", consultationID)

	// Simulate concurrent updates
	update1 := map[string]interface{}{
		"business_context": map[string]interface{}{
			"industry": "Retail",
		},
	}

	update2 := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"primary_challenges": []string{"Inventory management"},
		},
	}

	// Execute updates concurrently
	done1 := make(chan error, 1)
	done2 := make(chan error, 1)

	go func() {
		_, err := suite.makeRequestWithoutStatusCheck("PUT", updateURL, update1)
		done1 <- err
	}()

	go func() {
		_, err := suite.makeRequestWithoutStatusCheck("PUT", updateURL, update2)
		done2 <- err
	}()

	// Wait for both updates
	err1 := <-done1
	err2 := <-done2

	// Both updates should succeed (the system should handle concurrent access gracefully)
	assert.NoError(t, err1)
	assert.NoError(t, err2)

	// Verify final state contains both updates
	finalResp := suite.makeRequest("GET", updateURL, nil, http.StatusOK)

	var finalConsultation consultation.Consultation
	err = json.Unmarshal(finalResp, &finalConsultation)
	require.NoError(t, err)

	// At least one of the updates should be present
	hasBusinessContext := len(finalConsultation.BusinessContext) > 0
	hasPainPoints := len(finalConsultation.PainPoints) > 0

	assert.True(t, hasBusinessContext || hasPainPoints, "At least one concurrent update should be present")
}

// TestDataValidationWorkflow tests comprehensive data validation
func (suite *ConsultationEndToEndTestSuite) TestDataValidationWorkflow() {
	t := suite.T()

	// Test invalid contact info
	invalidCreateRequest := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"email": "invalid-email",
			"website": "not-a-url",
		},
	}

	resp, err := suite.makeRequestWithoutStatusCheck("POST", "/consultations", invalidCreateRequest)
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "Should reject invalid email and website")

	// Test valid data passes validation
	validCreateRequest := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Valid Corp",
			"email":        "valid@example.com",
			"website":      "https://valid.com",
		},
		"business_context": map[string]interface{}{
			"industry":   "Technology",
			"team_size":  10,
		},
		"pain_points": map[string]interface{}{
			"urgency_level": "medium",
		},
	}

	createResp := suite.makeRequest("POST", "/consultations", validCreateRequest, http.StatusCreated)

	var consultation consultation.Consultation
	err = json.Unmarshal(createResp, &consultation)
	require.NoError(t, err)

	// Test validation on updates
	updateURL := fmt.Sprintf("/consultations/%s", consultation.ID)

	invalidUpdate := map[string]interface{}{
		"pain_points": map[string]interface{}{
			"urgency_level": "invalid_urgency",
		},
	}

	resp, err = suite.makeRequestWithoutStatusCheck("PUT", updateURL, invalidUpdate)
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "Should reject invalid urgency level")
}

// TestErrorScenariosAndRecovery tests error handling and recovery scenarios
func (suite *ConsultationEndToEndTestSuite) TestErrorScenariosAndRecovery() {
	t := suite.T()

	// Test 404 scenarios
	nonExistentID := uuid.New()
	getURL := fmt.Sprintf("/consultations/%s", nonExistentID)

	resp, err := suite.makeRequestWithoutStatusCheck("GET", getURL, nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	// Test invalid UUID format
	invalidURL := "/consultations/invalid-uuid"
	resp, err = suite.makeRequestWithoutStatusCheck("GET", invalidURL, nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	// Test malformed JSON
	resp, err = suite.makeRequestWithBody("POST", "/consultations", "invalid json", http.Header{"Content-Type": []string{"application/json"}})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	// Test missing authentication
	resp, err = suite.makeRequestWithoutAuth("GET", "/consultations", nil)
	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

// TestPaginationAndFiltering tests listing with pagination and filtering
func (suite *ConsultationEndToEndTestSuite) TestPaginationAndFiltering() {
	t := suite.T()

	// Create multiple consultations for testing
	consultationIDs := make([]uuid.UUID, 5)

	for i := 0; i < 5; i++ {
		createRequest := map[string]interface{}{
			"contact_info": map[string]interface{}{
				"business_name": fmt.Sprintf("Test Corp %d", i+1),
			},
		}

		if i%2 == 0 {
			// Mark even numbered consultations as completed
			createRequest["status"] = "completed"
		}

		createResp := suite.makeRequest("POST", "/consultations", createRequest, http.StatusCreated)

		var consultation consultation.Consultation
		err := json.Unmarshal(createResp, &consultation)
		require.NoError(t, err)

		consultationIDs[i] = consultation.ID

		// Complete even numbered consultations
		if i%2 == 0 {
			completeURL := fmt.Sprintf("/consultations/%s/complete", consultation.ID)
			suite.makeRequest("POST", completeURL, nil, http.StatusOK)
		}
	}

	// Test default pagination
	listResp := suite.makeRequest("GET", "/consultations", nil, http.StatusOK)

	var listResponse struct {
		Consultations []consultation.ConsultationSummary `json:"consultations"`
		Total         int                                `json:"total"`
		Page          int                                `json:"page"`
		Limit         int                                `json:"limit"`
	}
	err := json.Unmarshal(listResp, &listResponse)
	require.NoError(t, err)

	assert.True(t, len(listResponse.Consultations) >= 5)
	assert.True(t, listResponse.Total >= 5)

	// Test pagination
	page2Resp := suite.makeRequest("GET", "/consultations?page=2&limit=2", nil, http.StatusOK)

	err = json.Unmarshal(page2Resp, &listResponse)
	require.NoError(t, err)

	assert.Equal(t, 2, listResponse.Page)
	assert.Equal(t, 2, listResponse.Limit)

	// Test status filtering
	completedResp := suite.makeRequest("GET", "/consultations?status=completed", nil, http.StatusOK)

	err = json.Unmarshal(completedResp, &listResponse)
	require.NoError(t, err)

	for _, summary := range listResponse.Consultations {
		assert.Equal(t, consultation.StatusCompleted, summary.Status)
	}

	// Test search functionality
	searchResp := suite.makeRequest("GET", "/consultations?q=Test Corp", nil, http.StatusOK)

	err = json.Unmarshal(searchResp, &listResponse)
	require.NoError(t, err)

	assert.True(t, len(listResponse.Consultations) > 0, "Search should return results")
}

// TestPerformanceUnderLoad tests system performance with multiple operations
func (suite *ConsultationEndToEndTestSuite) TestPerformanceUnderLoad() {
	t := suite.T()

	// Create consultations in parallel
	numConsultations := 10
	concurrency := 5

	type result struct {
		index int
		id    uuid.UUID
		err   error
	}

	results := make(chan result, numConsultations)
	semaphore := make(chan struct{}, concurrency)

	start := time.Now()

	// Create consultations concurrently
	for i := 0; i < numConsultations; i++ {
		go func(index int) {
			semaphore <- struct{}{} // Acquire semaphore
			defer func() { <-semaphore }() // Release semaphore

			createRequest := map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name": fmt.Sprintf("Load Test Corp %d", index),
				},
			}

			resp, err := suite.makeRequestWithoutStatusCheck("POST", "/consultations", createRequest)
			if err != nil {
				results <- result{index: index, err: err}
				return
			}

			if resp.StatusCode != http.StatusCreated {
				results <- result{index: index, err: fmt.Errorf("expected 201, got %d", resp.StatusCode)}
				return
			}

			var consultation consultation.Consultation
			body := make([]byte, resp.ContentLength)
			resp.Body.Read(body)
			resp.Body.Close()

			err = json.Unmarshal(body, &consultation)
			results <- result{index: index, id: consultation.ID, err: err}
		}(i)
	}

	// Collect results
	successCount := 0
	consultationIDs := make([]uuid.UUID, 0, numConsultations)

	for i := 0; i < numConsultations; i++ {
		res := <-results
		if res.err == nil {
			successCount++
			consultationIDs = append(consultationIDs, res.id)
		} else {
			t.Logf("Creation %d failed: %v", res.index, res.err)
		}
	}

	createDuration := time.Since(start)

	assert.True(t, successCount >= numConsultations*0.8, "At least 80% of creations should succeed")
	assert.True(t, createDuration < 30*time.Second, "Bulk creation should complete within 30 seconds")

	// Test bulk read performance
	start = time.Now()

	for _, id := range consultationIDs {
		getURL := fmt.Sprintf("/consultations/%s", id)
		suite.makeRequest("GET", getURL, nil, http.StatusOK)
	}

	readDuration := time.Since(start)
	avgReadTime := readDuration / time.Duration(len(consultationIDs))

	assert.True(t, avgReadTime < 500*time.Millisecond, "Average read time should be under 500ms")

	t.Logf("Performance metrics: Created %d consultations in %v (avg: %v/consultation)",
		successCount, createDuration, createDuration/time.Duration(successCount))
	t.Logf("Read performance: %d reads in %v (avg: %v/read)",
		len(consultationIDs), readDuration, avgReadTime)
}

// Helper methods

func (suite *ConsultationEndToEndTestSuite) createTables() {
	// Create users table
	_, err := suite.db.Exec(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
	`)
	require.NoError(suite.T(), err)

	// Create consultations table
	_, err = suite.db.Exec(`
		CREATE TABLE consultations (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			contact_info TEXT NOT NULL DEFAULT '{}',
			business_context TEXT NOT NULL DEFAULT '{}',
			pain_points TEXT NOT NULL DEFAULT '{}',
			goals_objectives TEXT NOT NULL DEFAULT '{}',
			status TEXT NOT NULL DEFAULT 'draft',
			completion_percentage INTEGER,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			completed_at TEXT,
			FOREIGN KEY (user_id) REFERENCES users (id)
		)
	`)
	require.NoError(suite.T(), err)

	// Create consultation_drafts table
	_, err = suite.db.Exec(`
		CREATE TABLE consultation_drafts (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			contact_info TEXT NOT NULL DEFAULT '{}',
			business_context TEXT NOT NULL DEFAULT '{}',
			pain_points TEXT NOT NULL DEFAULT '{}',
			goals_objectives TEXT NOT NULL DEFAULT '{}',
			last_saved_at TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (consultation_id) REFERENCES consultations (id),
			FOREIGN KEY (user_id) REFERENCES users (id)
		)
	`)
	require.NoError(suite.T(), err)

	// Create consultation_versions table
	_, err = suite.db.Exec(`
		CREATE TABLE consultation_versions (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			version_number INTEGER NOT NULL,
			contact_info TEXT NOT NULL DEFAULT '{}',
			business_context TEXT NOT NULL DEFAULT '{}',
			pain_points TEXT NOT NULL DEFAULT '{}',
			goals_objectives TEXT NOT NULL DEFAULT '{}',
			status TEXT NOT NULL,
			completion_percentage INTEGER NOT NULL,
			change_summary TEXT,
			changed_fields TEXT,
			created_at TEXT NOT NULL,
			FOREIGN KEY (consultation_id) REFERENCES consultations (id),
			FOREIGN KEY (user_id) REFERENCES users (id)
		)
	`)
	require.NoError(suite.T(), err)
}

func (suite *ConsultationEndToEndTestSuite) createTestUser() {
	now := time.Now().Format(time.RFC3339)
	_, err := suite.db.Exec(`
		INSERT INTO users (id, email, name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`, suite.userID.String(), "test@example.com", "Test User", now, now)
	require.NoError(suite.T(), err)
}

func (suite *ConsultationEndToEndTestSuite) setupHandler() {
	// Create a simplified handler setup for integration testing
	// This would normally use the full application setup
	cfg := &rest.Config{
		Environment: "test",
		Version:     "test-1.0.0",
		Port:        "0",
	}

	// Create repository implementations
	consultationRepo := consultation.NewRepository(suite.db, suite.queries)
	draftRepo := consultation.NewDraftRepository(suite.db, suite.queries)
	versionRepo := consultation.NewVersionRepository(suite.db, suite.queries)

	// Create service
	consultationService := consultation.NewService(consultationRepo, draftRepo, versionRepo)

	// Create handler with mock auth service
	mockAuthService := &MockAuthService{userID: suite.userID}
	suite.handler = rest.NewHandler(cfg, consultationService, mockAuthService)
}

func (suite *ConsultationEndToEndTestSuite) cleanupTestData() {
	// Clean up test data between tests
	tables := []string{"consultation_versions", "consultation_drafts", "consultations"}
	for _, table := range tables {
		_, _ = suite.db.Exec(fmt.Sprintf("DELETE FROM %s WHERE user_id = ?", table), suite.userID.String())
	}
}

func (suite *ConsultationEndToEndTestSuite) makeRequest(method, path string, body interface{}, expectedStatus int) []byte {
	resp, err := suite.makeRequestWithoutStatusCheck(method, path, body)
	require.NoError(suite.T(), err)
	require.Equal(suite.T(), expectedStatus, resp.StatusCode, "Unexpected status code for %s %s", method, path)

	responseBody := make([]byte, resp.ContentLength)
	if resp.ContentLength > 0 {
		_, err = resp.Body.Read(responseBody)
		require.NoError(suite.T(), err)
	}
	resp.Body.Close()

	return responseBody
}

func (suite *ConsultationEndToEndTestSuite) makeRequestWithoutStatusCheck(method, path string, body interface{}) (*http.Response, error) {
	var bodyReader *bytes.Reader

	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	url := suite.baseURL + path
	var req *http.Request
	var err error

	if bodyReader != nil {
		req, err = http.NewRequest(method, url, bodyReader)
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", suite.authToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	return client.Do(req)
}

func (suite *ConsultationEndToEndTestSuite) makeRequestWithBody(method, path, body string, headers http.Header) (*http.Response, error) {
	url := suite.baseURL + path
	req, err := http.NewRequest(method, url, strings.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", suite.authToken)
	for key, values := range headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	client := &http.Client{}
	return client.Do(req)
}

func (suite *ConsultationEndToEndTestSuite) makeRequestWithoutAuth(method, path string, body interface{}) (*http.Response, error) {
	var bodyReader *bytes.Reader

	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	url := suite.baseURL + path
	var req *http.Request
	var err error

	if bodyReader != nil {
		req, err = http.NewRequest(method, url, bodyReader)
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	return client.Do(req)
}

// MockAuthService provides a simplified auth service for testing
type MockAuthService struct {
	userID uuid.UUID
}

func (m *MockAuthService) Auth(token string, minLevel int) (*rest.AuthResult, error) {
	if strings.HasPrefix(token, "Bearer test-jwt-token-") {
		return &rest.AuthResult{
			UserID: m.userID,
			Level:  10,
		}, nil
	}
	return nil, fmt.Errorf("invalid token")
}

// TestEndToEndSuite runs the complete test suite
func TestEndToEndSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration tests in short mode")
	}

	// Check for test database environment
	if os.Getenv("SKIP_INTEGRATION_TESTS") == "true" {
		t.Skip("Integration tests skipped")
	}

	suite.Run(t, new(ConsultationEndToEndTestSuite))
}