package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"service-core/domain/consultation"
	"service-core/rest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// IntegrationTestHelpers provides utility functions for integration testing
type IntegrationTestHelpers struct {
	t         *testing.T
	server    *httptest.Server
	handler   *rest.Handler
	userID    uuid.UUID
	authToken string
}

// NewIntegrationTestHelpers creates a new test helpers instance
func NewIntegrationTestHelpers(t *testing.T, handler *rest.Handler, userID uuid.UUID) *IntegrationTestHelpers {
	server := httptest.NewServer(handler)

	return &IntegrationTestHelpers{
		t:         t,
		server:    server,
		handler:   handler,
		userID:    userID,
		authToken: fmt.Sprintf("Bearer test-jwt-token-%s", userID.String()),
	}
}

// Close cleans up the test server
func (h *IntegrationTestHelpers) Close() {
	if h.server != nil {
		h.server.Close()
	}
}

// GetBaseURL returns the test server base URL
func (h *IntegrationTestHelpers) GetBaseURL() string {
	return h.server.URL
}

// GetAuthToken returns the authentication token for the test user
func (h *IntegrationTestHelpers) GetAuthToken() string {
	return h.authToken
}

// SetUserID updates the user ID and corresponding auth token
func (h *IntegrationTestHelpers) SetUserID(userID uuid.UUID) {
	h.userID = userID
	h.authToken = fmt.Sprintf("Bearer test-jwt-token-%s", userID.String())
}

// HTTP Request Helpers

// MakeRequest performs an HTTP request with authentication and validates the status code
func (h *IntegrationTestHelpers) MakeRequest(method, path string, body interface{}, expectedStatus int) []byte {
	resp, err := h.MakeRequestWithoutStatusCheck(method, path, body)
	require.NoError(h.t, err, "Failed to make request")
	defer resp.Body.Close()

	require.Equal(h.t, expectedStatus, resp.StatusCode,
		"Unexpected status code for %s %s. Expected %d, got %d", method, path, expectedStatus, resp.StatusCode)

	responseBody, err := io.ReadAll(resp.Body)
	require.NoError(h.t, err, "Failed to read response body")

	return responseBody
}

// MakeRequestWithoutStatusCheck performs an HTTP request without validating the status code
func (h *IntegrationTestHelpers) MakeRequestWithoutStatusCheck(method, path string, body interface{}) (*http.Response, error) {
	return h.MakeRequestWithHeaders(method, path, body, map[string]string{
		"Authorization": h.authToken,
		"Content-Type":  "application/json",
	})
}

// MakeRequestWithHeaders performs an HTTP request with custom headers
func (h *IntegrationTestHelpers) MakeRequestWithHeaders(method, path string, body interface{}, headers map[string]string) (*http.Response, error) {
	var bodyReader io.Reader

	if body != nil {
		switch v := body.(type) {
		case string:
			bodyReader = strings.NewReader(v)
		case []byte:
			bodyReader = bytes.NewReader(v)
		default:
			jsonBody, err := json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}
			bodyReader = bytes.NewReader(jsonBody)
		}
	}

	url := h.server.URL + path
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	return client.Do(req)
}

// MakeRequestWithoutAuth performs an HTTP request without authentication
func (h *IntegrationTestHelpers) MakeRequestWithoutAuth(method, path string, body interface{}) (*http.Response, error) {
	headers := map[string]string{
		"Content-Type": "application/json",
	}
	return h.MakeRequestWithHeaders(method, path, body, headers)
}

// Consultation-specific helpers

// CreateTestConsultation creates a consultation for testing
func (h *IntegrationTestHelpers) CreateTestConsultation(data map[string]interface{}) *consultation.Consultation {
	if data == nil {
		data = h.GetDefaultConsultationData()
	}

	responseBody := h.MakeRequest("POST", "/consultations", data, http.StatusCreated)

	var consultation consultation.Consultation
	err := json.Unmarshal(responseBody, &consultation)
	require.NoError(h.t, err, "Failed to unmarshal consultation response")

	return &consultation
}

// GetDefaultConsultationData returns default consultation data for testing
func (h *IntegrationTestHelpers) GetDefaultConsultationData() map[string]interface{} {
	return map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name":  "Test Business",
			"contact_person": "John Doe",
			"email":         "john@test.com",
			"phone":         "+1-555-0123",
			"website":       "https://test.com",
		},
		"business_context": map[string]interface{}{
			"industry":     "Technology",
			"team_size":    10,
			"business_type": "SaaS",
		},
	}
}

// UpdateConsultation updates a consultation and returns the result
func (h *IntegrationTestHelpers) UpdateConsultation(consultationID uuid.UUID, data map[string]interface{}) *consultation.Consultation {
	path := fmt.Sprintf("/consultations/%s", consultationID)
	responseBody := h.MakeRequest("PUT", path, data, http.StatusOK)

	var consultation consultation.Consultation
	err := json.Unmarshal(responseBody, &consultation)
	require.NoError(h.t, err, "Failed to unmarshal consultation response")

	return &consultation
}

// GetConsultation retrieves a consultation by ID
func (h *IntegrationTestHelpers) GetConsultation(consultationID uuid.UUID) *consultation.Consultation {
	path := fmt.Sprintf("/consultations/%s", consultationID)
	responseBody := h.MakeRequest("GET", path, nil, http.StatusOK)

	var consultation consultation.Consultation
	err := json.Unmarshal(responseBody, &consultation)
	require.NoError(h.t, err, "Failed to unmarshal consultation response")

	return &consultation
}

// DeleteConsultation deletes a consultation by ID
func (h *IntegrationTestHelpers) DeleteConsultation(consultationID uuid.UUID) {
	path := fmt.Sprintf("/consultations/%s", consultationID)
	h.MakeRequest("DELETE", path, nil, http.StatusOK)
}

// CompleteConsultation marks a consultation as completed
func (h *IntegrationTestHelpers) CompleteConsultation(consultationID uuid.UUID) *consultation.Consultation {
	path := fmt.Sprintf("/consultations/%s/complete", consultationID)
	responseBody := h.MakeRequest("POST", path, nil, http.StatusOK)

	var consultation consultation.Consultation
	err := json.Unmarshal(responseBody, &consultation)
	require.NoError(h.t, err, "Failed to unmarshal consultation response")

	return &consultation
}

// ArchiveConsultation marks a consultation as archived
func (h *IntegrationTestHelpers) ArchiveConsultation(consultationID uuid.UUID) *consultation.Consultation {
	path := fmt.Sprintf("/consultations/%s/archive", consultationID)
	responseBody := h.MakeRequest("POST", path, nil, http.StatusOK)

	var consultation consultation.Consultation
	err := json.Unmarshal(responseBody, &consultation)
	require.NoError(h.t, err, "Failed to unmarshal consultation response")

	return &consultation
}

// ListConsultations retrieves a list of consultations with optional query parameters
func (h *IntegrationTestHelpers) ListConsultations(queryParams string) *ConsultationListResponse {
	path := "/consultations"
	if queryParams != "" {
		path += "?" + queryParams
	}

	responseBody := h.MakeRequest("GET", path, nil, http.StatusOK)

	var response ConsultationListResponse
	err := json.Unmarshal(responseBody, &response)
	require.NoError(h.t, err, "Failed to unmarshal consultations list response")

	return &response
}

// ConsultationListResponse represents the response structure for listing consultations
type ConsultationListResponse struct {
	Consultations []consultation.ConsultationSummary `json:"consultations"`
	Total         int                                `json:"total"`
	Page          int                                `json:"page"`
	Limit         int                                `json:"limit"`
}

// Draft management helpers

// CreateDraft creates or updates a consultation draft
func (h *IntegrationTestHelpers) CreateDraft(consultationID uuid.UUID, draftData map[string]interface{}) {
	path := fmt.Sprintf("/consultations/%s/drafts", consultationID)
	h.MakeRequest("POST", path, draftData, http.StatusOK)
}

// GetDraft retrieves a consultation draft
func (h *IntegrationTestHelpers) GetDraft(consultationID uuid.UUID) *consultation.ConsultationDraft {
	path := fmt.Sprintf("/consultations/%s/drafts", consultationID)
	responseBody := h.MakeRequest("GET", path, nil, http.StatusOK)

	var draft consultation.ConsultationDraft
	err := json.Unmarshal(responseBody, &draft)
	require.NoError(h.t, err, "Failed to unmarshal draft response")

	return &draft
}

// PromoteDraft promotes a draft to a consultation
func (h *IntegrationTestHelpers) PromoteDraft(consultationID uuid.UUID) *consultation.Consultation {
	path := fmt.Sprintf("/consultations/%s/drafts/promote", consultationID)
	responseBody := h.MakeRequest("POST", path, nil, http.StatusOK)

	var consultation consultation.Consultation
	err := json.Unmarshal(responseBody, &consultation)
	require.NoError(h.t, err, "Failed to unmarshal consultation response")

	return &consultation
}

// DeleteDraft deletes a consultation draft
func (h *IntegrationTestHelpers) DeleteDraft(consultationID uuid.UUID) {
	path := fmt.Sprintf("/consultations/%s/drafts", consultationID)
	h.MakeRequest("DELETE", path, nil, http.StatusOK)
}

// Version management helpers

// GetVersionHistory retrieves the version history for a consultation
func (h *IntegrationTestHelpers) GetVersionHistory(consultationID uuid.UUID) *VersionHistoryResponse {
	path := fmt.Sprintf("/consultations/%s/versions", consultationID)
	responseBody := h.MakeRequest("GET", path, nil, http.StatusOK)

	var response VersionHistoryResponse
	err := json.Unmarshal(responseBody, &response)
	require.NoError(h.t, err, "Failed to unmarshal version history response")

	return &response
}

// VersionHistoryResponse represents the response structure for version history
type VersionHistoryResponse struct {
	Versions []consultation.ConsultationVersion `json:"versions"`
	Total    int                                `json:"total"`
}

// RollbackToVersion rolls back a consultation to a specific version
func (h *IntegrationTestHelpers) RollbackToVersion(consultationID uuid.UUID, versionNumber int) *consultation.Consultation {
	path := fmt.Sprintf("/consultations/%s/versions/%d/rollback", consultationID, versionNumber)
	responseBody := h.MakeRequest("POST", path, nil, http.StatusOK)

	var consultation consultation.Consultation
	err := json.Unmarshal(responseBody, &consultation)
	require.NoError(h.t, err, "Failed to unmarshal consultation response")

	return &consultation
}

// Validation helpers

// AssertValidationError checks that a request returns a validation error with specific fields
func (h *IntegrationTestHelpers) AssertValidationError(method, path string, body interface{}, expectedErrorFields []string) {
	resp, err := h.MakeRequestWithoutStatusCheck(method, path, body)
	require.NoError(h.t, err, "Failed to make request")
	defer resp.Body.Close()

	assert.Equal(h.t, http.StatusBadRequest, resp.StatusCode, "Expected validation error")

	responseBody, err := io.ReadAll(resp.Body)
	require.NoError(h.t, err, "Failed to read error response")

	var errorResponse map[string]interface{}
	err = json.Unmarshal(responseBody, &errorResponse)
	require.NoError(h.t, err, "Failed to unmarshal error response")

	// Check that the error contains information about the expected fields
	errorStr := fmt.Sprintf("%v", errorResponse)
	for _, field := range expectedErrorFields {
		assert.Contains(h.t, errorStr, field, "Error should mention field: %s", field)
	}
}

// AssertErrorResponse checks that a request returns an error with specific status and message
func (h *IntegrationTestHelpers) AssertErrorResponse(method, path string, body interface{}, expectedStatus int, expectedMessageContains string) {
	resp, err := h.MakeRequestWithoutStatusCheck(method, path, body)
	require.NoError(h.t, err, "Failed to make request")
	defer resp.Body.Close()

	assert.Equal(h.t, expectedStatus, resp.StatusCode, "Expected status code: %d", expectedStatus)

	if expectedMessageContains != "" {
		responseBody, err := io.ReadAll(resp.Body)
		require.NoError(h.t, err, "Failed to read error response")

		responseStr := string(responseBody)
		assert.Contains(h.t, responseStr, expectedMessageContains, "Error message should contain: %s", expectedMessageContains)
	}
}

// Performance testing helpers

// MeasureRequestLatency measures the latency of a request
func (h *IntegrationTestHelpers) MeasureRequestLatency(method, path string, body interface{}) time.Duration {
	start := time.Now()
	resp, err := h.MakeRequestWithoutStatusCheck(method, path, body)
	duration := time.Since(start)

	require.NoError(h.t, err, "Failed to make request")
	resp.Body.Close()

	return duration
}

// PerformConcurrentRequests performs multiple requests concurrently and returns results
func (h *IntegrationTestHelpers) PerformConcurrentRequests(method, path string, body interface{}, concurrency int) []ConcurrentRequestResult {
	results := make([]ConcurrentRequestResult, concurrency)
	done := make(chan ConcurrentRequestResult, concurrency)

	start := time.Now()

	// Start concurrent requests
	for i := 0; i < concurrency; i++ {
		go func(index int) {
			requestStart := time.Now()
			resp, err := h.MakeRequestWithoutStatusCheck(method, path, body)
			latency := time.Since(requestStart)

			result := ConcurrentRequestResult{
				Index:   index,
				Latency: latency,
				Error:   err,
			}

			if resp != nil {
				result.StatusCode = resp.StatusCode
				resp.Body.Close()
			}

			done <- result
		}(i)
	}

	// Collect results
	for i := 0; i < concurrency; i++ {
		results[i] = <-done
	}

	totalDuration := time.Since(start)

	h.t.Logf("Concurrent requests completed: %d requests in %v", concurrency, totalDuration)

	return results
}

// ConcurrentRequestResult represents the result of a concurrent request
type ConcurrentRequestResult struct {
	Index      int
	StatusCode int
	Latency    time.Duration
	Error      error
}

// AnalyzeConcurrentResults analyzes the results of concurrent requests
func (h *IntegrationTestHelpers) AnalyzeConcurrentResults(results []ConcurrentRequestResult) ConcurrentAnalysis {
	analysis := ConcurrentAnalysis{
		TotalRequests: len(results),
	}

	var totalLatency time.Duration
	minLatency := time.Hour
	maxLatency := time.Duration(0)

	for _, result := range results {
		if result.Error == nil {
			analysis.SuccessfulRequests++
			if result.StatusCode >= 200 && result.StatusCode < 300 {
				analysis.SuccessfulResponses++
			}
		} else {
			analysis.FailedRequests++
		}

		totalLatency += result.Latency
		if result.Latency < minLatency {
			minLatency = result.Latency
		}
		if result.Latency > maxLatency {
			maxLatency = result.Latency
		}
	}

	analysis.AverageLatency = totalLatency / time.Duration(len(results))
	analysis.MinLatency = minLatency
	analysis.MaxLatency = maxLatency

	return analysis
}

// ConcurrentAnalysis represents analysis of concurrent request results
type ConcurrentAnalysis struct {
	TotalRequests        int
	SuccessfulRequests   int
	SuccessfulResponses  int
	FailedRequests       int
	AverageLatency       time.Duration
	MinLatency           time.Duration
	MaxLatency           time.Duration
}

// AssertConcurrentPerformance asserts that concurrent requests meet performance expectations
func (h *IntegrationTestHelpers) AssertConcurrentPerformance(analysis ConcurrentAnalysis, expectations PerformanceExpectations) {
	successRate := float64(analysis.SuccessfulRequests) / float64(analysis.TotalRequests)

	assert.GreaterOrEqual(h.t, successRate, expectations.MinSuccessRate,
		"Success rate %.2f%% should be at least %.2f%%", successRate*100, expectations.MinSuccessRate*100)

	assert.LessOrEqual(h.t, analysis.AverageLatency, expectations.MaxAverageLatency,
		"Average latency %v should be at most %v", analysis.AverageLatency, expectations.MaxAverageLatency)

	assert.LessOrEqual(h.t, analysis.MaxLatency, expectations.MaxLatency,
		"Maximum latency %v should be at most %v", analysis.MaxLatency, expectations.MaxLatency)

	h.t.Logf("Performance analysis: Success rate: %.2f%%, Avg latency: %v, Max latency: %v",
		successRate*100, analysis.AverageLatency, analysis.MaxLatency)
}

// PerformanceExpectations defines performance expectations for testing
type PerformanceExpectations struct {
	MinSuccessRate      float64       // Minimum success rate (0.0 to 1.0)
	MaxAverageLatency   time.Duration // Maximum acceptable average latency
	MaxLatency          time.Duration // Maximum acceptable latency for any request
}

// GetDefaultPerformanceExpectations returns reasonable default performance expectations
func (h *IntegrationTestHelpers) GetDefaultPerformanceExpectations() PerformanceExpectations {
	return PerformanceExpectations{
		MinSuccessRate:      0.95, // 95% success rate
		MaxAverageLatency:   500 * time.Millisecond,
		MaxLatency:          2 * time.Second,
	}
}

// Utility helpers

// WaitForCondition waits for a condition to be met or times out
func (h *IntegrationTestHelpers) WaitForCondition(condition func() bool, timeout time.Duration, checkInterval time.Duration) bool {
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		if condition() {
			return true
		}
		time.Sleep(checkInterval)
	}

	return false
}

// GenerateUniqueBusinessName generates a unique business name for testing
func (h *IntegrationTestHelpers) GenerateUniqueBusinessName() string {
	timestamp := time.Now().UnixNano() / int64(time.Millisecond)
	return fmt.Sprintf("Test Business %d", timestamp)
}

// AssertResponseContains checks that a response contains expected content
func (h *IntegrationTestHelpers) AssertResponseContains(responseBody []byte, expectedContent string) {
	responseStr := string(responseBody)
	assert.Contains(h.t, responseStr, expectedContent,
		"Response should contain: %s\nActual response: %s", expectedContent, responseStr)
}

// AssertJSONField checks that a JSON response contains a specific field with expected value
func (h *IntegrationTestHelpers) AssertJSONField(responseBody []byte, fieldPath string, expectedValue interface{}) {
	var responseData map[string]interface{}
	err := json.Unmarshal(responseBody, &responseData)
	require.NoError(h.t, err, "Failed to unmarshal response JSON")

	// Simple field path resolution (supports dot notation like "data.field")
	fields := strings.Split(fieldPath, ".")
	current := responseData

	for i, field := range fields {
		if i == len(fields)-1 {
			// Last field - check value
			assert.Equal(h.t, expectedValue, current[field],
				"Field %s should have value %v", fieldPath, expectedValue)
		} else {
			// Intermediate field - navigate deeper
			next, ok := current[field].(map[string]interface{})
			require.True(h.t, ok, "Field %s should be an object", field)
			current = next
		}
	}
}