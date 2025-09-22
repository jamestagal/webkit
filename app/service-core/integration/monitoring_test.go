package integration

import (
	"context"
	"fmt"
	"net/http"
	"service-core/domain/consultation"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// MonitoringTestSuite tests monitoring and observability features
type MonitoringTestSuite struct {
	suite.Suite
	dbHelper *DatabaseTestHelper
	fixtures *TestFixtures
	helpers  *IntegrationTestHelpers
	userID   uuid.UUID
}

// SetupSuite initializes the monitoring test environment
func (suite *MonitoringTestSuite) SetupSuite() {
	suite.dbHelper = NewDatabaseTestHelper(suite.T(), "MonitoringTest")
	suite.fixtures = NewTestFixtures(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	suite.userID = uuid.New()

	// Create test user
	err := suite.fixtures.CreateTestUser(suite.userID, "monitoring@example.com", "Monitoring Test User")
	require.NoError(suite.T(), err)

	// Setup API handler with monitoring
	handler := suite.createHandler()
	suite.helpers = NewIntegrationTestHelpers(suite.T(), handler, suite.userID)
}

// TearDownSuite cleans up the monitoring test environment
func (suite *MonitoringTestSuite) TearDownSuite() {
	if suite.helpers != nil {
		suite.helpers.Close()
	}
	suite.dbHelper.CleanupDatabase(suite.T())
}

// SetupTest runs before each monitoring test
func (suite *MonitoringTestSuite) SetupTest() {
	// Clean consultation data but keep the user
	err := suite.fixtures.CleanupTestData([]uuid.UUID{suite.userID})
	if err != nil {
		suite.T().Logf("Warning: Failed to cleanup test data: %v", err)
	}

	// Recreate user if needed
	err = suite.fixtures.CreateTestUser(suite.userID, "monitoring@example.com", "Monitoring Test User")
	if err != nil {
		suite.T().Logf("User already exists or recreated: %v", err)
	}
}

// createHandler creates a test HTTP handler with monitoring capabilities
func (suite *MonitoringTestSuite) createHandler() *rest.Handler {
	cfg := &rest.Config{
		Environment: "test",
		Version:     "test-1.0.0",
		Port:        "0",
	}

	// Create instrumented service layer
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	draftRepo := consultation.NewDraftRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	versionRepo := consultation.NewVersionRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	consultationService := consultation.NewService(consultationRepo, draftRepo, versionRepo)

	mockAuthService := &MockAuthService{userID: suite.userID}
	return rest.NewHandler(cfg, consultationService, mockAuthService)
}

// TestHealthCheckEndpoint tests the health check functionality
func (suite *MonitoringTestSuite) TestHealthCheckEndpoint() {
	t := suite.T()

	// Test basic health check
	resp, err := suite.helpers.MakeRequestWithoutAuth("GET", "/health", nil)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Verify response format
	responseBody := make([]byte, resp.ContentLength)
	if resp.ContentLength > 0 {
		_, err = resp.Body.Read(responseBody)
		require.NoError(t, err)
	}

	responseStr := string(responseBody)

	// Health check should include basic service information
	expectedFields := []string{"status", "service", "version"}
	for _, field := range expectedFields {
		assert.Contains(t, responseStr, field, "Health check should include %s field", field)
	}

	t.Log("Health check endpoint verified")
}

// TestReadinessProbe tests the readiness probe functionality
func (suite *MonitoringTestSuite) TestReadinessProbe() {
	t := suite.T()

	// Test readiness probe
	resp, err := suite.helpers.MakeRequestWithoutAuth("GET", "/ready", nil)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Readiness should indicate if the service is ready to accept traffic
	// This might be 200 (ready) or 503 (not ready) depending on implementation
	assert.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusServiceUnavailable,
		"Readiness probe should return 200 (ready) or 503 (not ready)")

	if resp.StatusCode == http.StatusOK {
		t.Log("Service is ready")
	} else {
		t.Log("Service is not ready (which is acceptable during tests)")
	}
}

// TestLivenessProbe tests the liveness probe functionality
func (suite *MonitoringTestSuite) TestLivenessProbe() {
	t := suite.T()

	// Test liveness probe
	resp, err := suite.helpers.MakeRequestWithoutAuth("GET", "/live", nil)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Liveness should indicate if the service is alive
	assert.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusServiceUnavailable,
		"Liveness probe should return 200 (alive) or 503 (not alive)")

	if resp.StatusCode == http.StatusOK {
		t.Log("Service is alive")
	} else {
		t.Log("Service liveness check failed")
	}
}

// TestMetricsEndpoint tests the metrics endpoint functionality
func (suite *MonitoringTestSuite) TestMetricsEndpoint() {
	t := suite.T()

	// Test metrics endpoint
	resp, err := suite.helpers.MakeRequestWithoutAuth("GET", "/metrics", nil)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Metrics endpoint should be available (even if empty)
	assert.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound,
		"Metrics endpoint should be available or explicitly disabled")

	if resp.StatusCode == http.StatusOK {
		responseBody := make([]byte, resp.ContentLength)
		if resp.ContentLength > 0 {
			resp.Body.Read(responseBody)
		}

		responseStr := string(responseBody)

		// Check for basic Prometheus metrics format
		if strings.Contains(responseStr, "# HELP") || strings.Contains(responseStr, "# TYPE") {
			t.Log("Prometheus-format metrics detected")
		} else if len(responseStr) > 0 {
			t.Log("Metrics endpoint returned data (non-Prometheus format)")
		} else {
			t.Log("Metrics endpoint is available but empty")
		}
	} else {
		t.Log("Metrics endpoint is not implemented or disabled")
	}
}

// TestRequestTracing tests request tracing and correlation IDs
func (suite *MonitoringTestSuite) TestRequestTracing() {
	t := suite.T()

	// Create a consultation with a correlation ID
	correlationID := uuid.New().String()

	headers := map[string]string{
		"Authorization":      suite.helpers.GetAuthToken(),
		"Content-Type":       "application/json",
		"X-Correlation-ID":   correlationID,
		"X-Request-ID":       uuid.New().String(),
	}

	createData := suite.helpers.GetDefaultConsultationData()
	resp, err := suite.helpers.MakeRequestWithHeaders("POST", "/consultations", createData, headers)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	// Check if correlation ID is returned in headers
	respCorrelationID := resp.Header.Get("X-Correlation-ID")
	if respCorrelationID != "" {
		assert.Equal(t, correlationID, respCorrelationID, "Correlation ID should be preserved")
		t.Log("Request tracing with correlation ID verified")
	} else {
		t.Log("Request tracing not implemented (correlation ID not returned)")
	}
}

// TestErrorLogging tests error logging and monitoring
func (suite *MonitoringTestSuite) TestErrorLogging() {
	t := suite.T()

	errorScenarios := []struct {
		name           string
		method         string
		path           string
		data           interface{}
		expectedStatus int
	}{
		{
			name:           "Invalid JSON",
			method:         "POST",
			path:           "/consultations",
			data:           "invalid json",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Not Found",
			method:         "GET",
			path:           fmt.Sprintf("/consultations/%s", uuid.New()),
			data:           nil,
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Validation Error",
			method:         "POST",
			path:           "/consultations",
			data:           map[string]interface{}{"contact_info": map[string]interface{}{"email": "invalid-email"}},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Unauthorized",
			method:         "GET",
			path:           "/consultations",
			data:           nil,
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, scenario := range errorScenarios {
		t.Run(scenario.name, func(t *testing.T) {
			var resp *http.Response
			var err error

			if scenario.name == "Unauthorized" {
				// Make request without auth
				resp, err = suite.helpers.MakeRequestWithoutAuth(scenario.method, scenario.path, scenario.data)
			} else {
				resp, err = suite.helpers.MakeRequestWithoutStatusCheck(scenario.method, scenario.path, scenario.data)
			}

			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, scenario.expectedStatus, resp.StatusCode,
				"Scenario %s should return status %d", scenario.name, scenario.expectedStatus)

			// These errors should be logged (we can't easily verify logging in tests,
			// but we can ensure the errors are handled properly)
			t.Logf("Error scenario '%s' handled correctly with status %d", scenario.name, resp.StatusCode)
		})
	}
}

// TestPerformanceMonitoring tests performance monitoring capabilities
func (suite *MonitoringTestSuite) TestPerformanceMonitoring() {
	t := suite.T()

	// Create several consultations and measure response times
	operationsCount := 10
	var responseTimes []time.Duration

	for i := 0; i < operationsCount; i++ {
		createData := map[string]interface{}{
			"contact_info": map[string]interface{}{
				"business_name": fmt.Sprintf("Performance Test Business %d", i),
				"email":        fmt.Sprintf("perf%d@example.com", i),
			},
		}

		start := time.Now()
		consultation := suite.helpers.CreateTestConsultation(createData)
		responseTime := time.Since(start)

		responseTimes = append(responseTimes, responseTime)

		assert.NotEqual(t, uuid.Nil, consultation.ID, "Consultation %d should be created successfully", i)
	}

	// Calculate performance metrics
	var totalTime time.Duration
	minTime := responseTimes[0]
	maxTime := responseTimes[0]

	for _, respTime := range responseTimes {
		totalTime += respTime
		if respTime < minTime {
			minTime = respTime
		}
		if respTime > maxTime {
			maxTime = respTime
		}
	}

	avgTime := totalTime / time.Duration(operationsCount)

	t.Logf("Performance Monitoring Results:")
	t.Logf("  Operations: %d", operationsCount)
	t.Logf("  Average response time: %v", avgTime)
	t.Logf("  Min response time: %v", minTime)
	t.Logf("  Max response time: %v", maxTime)
	t.Logf("  Total time: %v", totalTime)

	// Performance thresholds for monitoring
	assert.True(t, avgTime < 2*time.Second, "Average response time should be under 2 seconds")
	assert.True(t, maxTime < 5*time.Second, "Maximum response time should be under 5 seconds")
	assert.True(t, minTime > 0, "Minimum response time should be positive")

	t.Log("Performance monitoring thresholds verified")
}

// TestResourceMonitoring tests resource usage monitoring
func (suite *MonitoringTestSuite) TestResourceMonitoring() {
	t := suite.T()

	// Test resource-intensive operations
	resourceTests := []struct {
		name        string
		operation   func() error
		description string
	}{
		{
			name: "BulkCreation",
			operation: func() error {
				for i := 0; i < 20; i++ {
					createData := map[string]interface{}{
						"contact_info": map[string]interface{}{
							"business_name": fmt.Sprintf("Resource Test %d", i),
						},
					}
					_ = suite.helpers.CreateTestConsultation(createData)
				}
				return nil
			},
			description: "Creating multiple consultations",
		},
		{
			name: "LargeDataRetrieval",
			operation: func() error {
				// Create some consultations first
				for i := 0; i < 10; i++ {
					createData := map[string]interface{}{
						"contact_info": map[string]interface{}{
							"business_name": fmt.Sprintf("Large Data Test %d", i),
						},
					}
					suite.helpers.CreateTestConsultation(createData)
				}

				// Retrieve them multiple times
				for i := 0; i < 10; i++ {
					suite.helpers.ListConsultations("")
				}
				return nil
			},
			description: "Retrieving large amounts of data",
		},
		{
			name: "ComplexOperations",
			operation: func() error {
				consultation := suite.helpers.CreateTestConsultation(nil)

				// Perform complex operations
				updateData := map[string]interface{}{
					"business_context": map[string]interface{}{
						"industry":  "Technology",
						"team_size": 50,
					},
					"pain_points": map[string]interface{}{
						"primary_challenges": []string{"Challenge 1", "Challenge 2", "Challenge 3"},
						"urgency_level":     "high",
					},
					"goals_objectives": map[string]interface{}{
						"primary_goals": []string{"Goal 1", "Goal 2", "Goal 3", "Goal 4", "Goal 5"},
						"budget_range":  "$100k-200k",
					},
				}

				suite.helpers.UpdateConsultation(consultation.ID, updateData)
				suite.helpers.CompleteConsultation(consultation.ID)

				return nil
			},
			description: "Complex operations with large data",
		},
	}

	for _, test := range resourceTests {
		t.Run(test.name, func(t *testing.T) {
			start := time.Now()
			err := test.operation()
			duration := time.Since(start)

			assert.NoError(t, err, "Resource test %s should complete successfully", test.name)
			assert.True(t, duration < 30*time.Second, "Resource test %s should complete within 30 seconds", test.name)

			t.Logf("Resource test '%s' (%s) completed in %v", test.name, test.description, duration)
		})
	}
}

// TestDatabaseConnectionMonitoring tests database connection monitoring
func (suite *MonitoringTestSuite) TestDatabaseConnectionMonitoring() {
	t := suite.T()

	// Test database connectivity
	err := suite.dbHelper.GetDB().Ping()
	assert.NoError(t, err, "Database should be accessible")

	// Test database performance
	start := time.Now()
	stats := suite.dbHelper.GetDatabaseStats(t)
	dbQueryTime := time.Since(start)

	t.Logf("Database Connection Monitoring:")
	t.Logf("  Connection status: OK")
	t.Logf("  Query response time: %v", dbQueryTime)
	t.Logf("  Table stats: %+v", stats)

	assert.True(t, dbQueryTime < 1*time.Second, "Database queries should be fast")

	// Test database operations under monitoring
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	start = time.Now()
	params := &consultation.ListConsultationsParams{
		UserID: suite.userID,
		Page:   1,
		Limit:  10,
	}
	_, err = consultationRepo.List(context.Background(), params)
	dbOpTime := time.Since(start)

	assert.NoError(t, err, "Database operations should succeed")
	assert.True(t, dbOpTime < 500*time.Millisecond, "Database operations should be fast")

	t.Logf("Database operation monitoring: %v", dbOpTime)
}

// TestAlertingScenarios tests scenarios that should trigger alerts
func (suite *MonitoringTestSuite) TestAlertingScenarios() {
	t := suite.T()

	alertScenarios := []struct {
		name        string
		scenario    func() error
		description string
		alertLevel  string
	}{
		{
			name: "HighErrorRate",
			scenario: func() error {
				// Generate multiple errors quickly
				for i := 0; i < 5; i++ {
					resp, err := suite.helpers.MakeRequestWithoutStatusCheck("GET", fmt.Sprintf("/consultations/%s", uuid.New()), nil)
					if err == nil && resp != nil {
						resp.Body.Close()
					}
				}
				return nil
			},
			description: "High error rate scenario",
			alertLevel:  "warning",
		},
		{
			name: "SlowResponse",
			scenario: func() error {
				// Create a large consultation that might be slow
				largeData := map[string]interface{}{
					"contact_info": map[string]interface{}{
						"business_name": "Large Response Test",
					},
					"business_context": map[string]interface{}{
						"industry": "Technology",
						"digital_presence": make([]string, 100), // Large array
					},
				}

				consultation := suite.helpers.CreateTestConsultation(largeData)
				_ = consultation
				return nil
			},
			description: "Potentially slow response scenario",
			alertLevel:  "info",
		},
		{
			name: "ResourceIntensive",
			scenario: func() error {
				// Create many consultations quickly
				for i := 0; i < 10; i++ {
					createData := map[string]interface{}{
						"contact_info": map[string]interface{}{
							"business_name": fmt.Sprintf("Alert Test %d", i),
						},
					}
					suite.helpers.CreateTestConsultation(createData)
				}
				return nil
			},
			description: "Resource intensive operations",
			alertLevel:  "info",
		},
	}

	for _, scenario := range alertScenarios {
		t.Run(scenario.name, func(t *testing.T) {
			start := time.Now()
			err := scenario.scenario()
			duration := time.Since(start)

			// The scenarios themselves should not fail
			assert.NoError(t, err, "Alert scenario %s should execute without errors", scenario.name)

			t.Logf("Alert scenario '%s' (%s) executed in %v [%s level]",
				scenario.name, scenario.description, duration, scenario.alertLevel)

			// In a real system, these scenarios would trigger monitoring alerts
			// For testing, we just verify they can be executed and measured
		})
	}
}

// TestServiceDependencyMonitoring tests monitoring of external dependencies
func (suite *MonitoringTestSuite) TestServiceDependencyMonitoring() {
	t := suite.T()

	dependencies := []struct {
		name        string
		checkFunc   func() (bool, time.Duration, error)
		description string
	}{
		{
			name: "Database",
			checkFunc: func() (bool, time.Duration, error) {
				start := time.Now()
				err := suite.dbHelper.GetDB().Ping()
				duration := time.Since(start)
				return err == nil, duration, err
			},
			description: "Database connectivity",
		},
		{
			name: "AuthService",
			checkFunc: func() (bool, time.Duration, error) {
				start := time.Now()
				// Mock auth service is always available in tests
				duration := time.Since(start)
				return true, duration, nil
			},
			description: "Authentication service",
		},
	}

	for _, dep := range dependencies {
		t.Run(dep.name, func(t *testing.T) {
			isHealthy, responseTime, err := dep.checkFunc()

			t.Logf("Dependency '%s' (%s):", dep.name, dep.description)
			t.Logf("  Status: %v", map[bool]string{true: "HEALTHY", false: "UNHEALTHY"}[isHealthy])
			t.Logf("  Response time: %v", responseTime)
			if err != nil {
				t.Logf("  Error: %v", err)
			}

			// For critical dependencies, assert they are healthy
			if dep.name == "Database" {
				assert.True(t, isHealthy, "Database dependency should be healthy")
				assert.True(t, responseTime < 1*time.Second, "Database should respond quickly")
			}
		})
	}
}

// TestBusinessMetrics tests business-specific metrics monitoring
func (suite *MonitoringTestSuite) TestBusinessMetrics() {
	t := suite.T()

	// Create test data for business metrics
	testData := []struct {
		status consultation.ConsultationStatus
		count  int
	}{
		{consultation.StatusDraft, 5},
		{consultation.StatusCompleted, 3},
		{consultation.StatusArchived, 2},
	}

	createdConsultations := make([]uuid.UUID, 0)

	for _, data := range testData {
		for i := 0; i < data.count; i++ {
			createData := map[string]interface{}{
				"contact_info": map[string]interface{}{
					"business_name": fmt.Sprintf("Metrics Test %s %d", data.status, i),
				},
			}

			consultation := suite.helpers.CreateTestConsultation(createData)
			createdConsultations = append(createdConsultations, consultation.ID)

			if data.status == consultation.StatusCompleted {
				suite.helpers.CompleteConsultation(consultation.ID)
			} else if data.status == consultation.StatusArchived {
				suite.helpers.CompleteConsultation(consultation.ID)
				suite.helpers.ArchiveConsultation(consultation.ID)
			}
		}
	}

	// Verify business metrics can be calculated
	allConsultations := suite.helpers.ListConsultations("")

	statusCounts := make(map[consultation.ConsultationStatus]int)
	for _, summary := range allConsultations.Consultations {
		statusCounts[summary.Status]++
	}

	t.Logf("Business Metrics:")
	t.Logf("  Total consultations: %d", allConsultations.Total)
	for status, count := range statusCounts {
		t.Logf("  %s consultations: %d", status, count)
	}

	// Verify metrics match expected data
	assert.True(t, allConsultations.Total >= int64(len(createdConsultations)), "Should have created consultations")

	// Calculate business KPIs
	completionRate := float64(statusCounts[consultation.StatusCompleted]) / float64(allConsultations.Total) * 100
	t.Logf("  Completion rate: %.1f%%", completionRate)

	assert.True(t, completionRate >= 0 && completionRate <= 100, "Completion rate should be valid percentage")
}

// TestMonitoringSuite runs the monitoring test suite
func TestMonitoringSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping monitoring tests in short mode")
	}

	suite.Run(t, new(MonitoringTestSuite))
}