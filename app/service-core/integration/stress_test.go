package integration

import (
	"context"
	"fmt"
	"service-core/domain/consultation"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// StressTestSuite performs stress testing for the consultation domain
type StressTestSuite struct {
	suite.Suite
	dbHelper *DatabaseTestHelper
	fixtures *TestFixtures
	helpers  *IntegrationTestHelpers
	userIDs  []uuid.UUID
}

// SetupSuite initializes the stress test environment
func (suite *StressTestSuite) SetupSuite() {
	suite.dbHelper = NewDatabaseTestHelper(suite.T(), "StressTest")
	suite.fixtures = NewTestFixtures(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Create multiple test users for stress testing
	userCount := 5
	var err error
	suite.userIDs, err = suite.fixtures.CreateTestUsers(userCount)
	require.NoError(suite.T(), err)
	require.Equal(suite.T(), userCount, len(suite.userIDs))

	// Setup API handler using the first user
	handler := suite.createHandler(suite.userIDs[0])
	suite.helpers = NewIntegrationTestHelpers(suite.T(), handler, suite.userIDs[0])
}

// TearDownSuite cleans up the stress test environment
func (suite *StressTestSuite) TearDownSuite() {
	if suite.helpers != nil {
		suite.helpers.Close()
	}
	suite.dbHelper.CleanupDatabase(suite.T())
}

// SetupTest runs before each stress test
func (suite *StressTestSuite) SetupTest() {
	// Clean up all test data
	err := suite.fixtures.CleanupTestData(suite.userIDs)
	if err != nil {
		suite.T().Logf("Warning: Failed to cleanup test data: %v", err)
	}

	// Recreate users
	for i, userID := range suite.userIDs {
		err := suite.fixtures.CreateTestUser(userID, fmt.Sprintf("stresstest%d@example.com", i), fmt.Sprintf("Stress Test User %d", i))
		if err != nil {
			suite.T().Logf("User %d already exists or recreated: %v", i, err)
		}
	}
}

// createHandler creates a test HTTP handler
func (suite *StressTestSuite) createHandler(userID uuid.UUID) *rest.Handler {
	cfg := &rest.Config{
		Environment: "test",
		Version:     "test-1.0.0",
		Port:        "0",
	}

	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	draftRepo := consultation.NewDraftRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	versionRepo := consultation.NewVersionRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	consultationService := consultation.NewService(consultationRepo, draftRepo, versionRepo)

	mockAuthService := &MultiUserMockAuthService{userIDs: suite.userIDs}
	return rest.NewHandler(cfg, consultationService, mockAuthService)
}

// TestHighVolumeConsultationCreation tests creating many consultations
func (suite *StressTestSuite) TestHighVolumeConsultationCreation() {
	t := suite.T()

	scenarios := []struct {
		name               string
		consultationCount  int
		concurrentUsers    int
		expectedMaxTime    time.Duration
		expectedMinTPS     float64
	}{
		{
			name:               "Medium Load - 100 consultations",
			consultationCount:  100,
			concurrentUsers:    5,
			expectedMaxTime:    30 * time.Second,
			expectedMinTPS:     3.0,
		},
		{
			name:               "High Load - 500 consultations",
			consultationCount:  500,
			concurrentUsers:    10,
			expectedMaxTime:    120 * time.Second,
			expectedMinTPS:     4.0,
		},
	}

	for _, scenario := range scenarios {
		if testing.Short() && scenario.consultationCount > 100 {
			t.Skipf("Skipping high volume test %s in short mode", scenario.name)
			continue
		}

		t.Run(scenario.name, func(t *testing.T) {
			suite.runHighVolumeCreationTest(t, scenario.consultationCount, scenario.concurrentUsers, scenario.expectedMaxTime, scenario.expectedMinTPS)
		})
	}
}

// runHighVolumeCreationTest performs the actual high volume creation test
func (suite *StressTestSuite) runHighVolumeCreationTest(t *testing.T, consultationCount, concurrentUsers int, maxTime time.Duration, minTPS float64) {
	var wg sync.WaitGroup
	var successCount int64
	var totalLatency time.Duration
	var mu sync.Mutex

	consultationsPerUser := consultationCount / concurrentUsers
	businessTypes := suite.fixtures.GetBusinessTypes()

	start := time.Now()

	// Start concurrent workers
	for i := 0; i < concurrentUsers; i++ {
		wg.Add(1)
		go func(userIndex int) {
			defer wg.Done()

			userID := suite.userIDs[userIndex]
			suite.helpers.SetUserID(userID)

			for j := 0; j < consultationsPerUser; j++ {
				// Use different business types for variety
				businessType := businessTypes[j%len(businessTypes)]
				fixture := suite.fixtures.GenerateRealisticConsultation(userID, businessType, consultation.StatusDraft)

				createData := map[string]interface{}{
					"contact_info":      fixture.ContactInfo,
					"business_context":  fixture.BusinessContext,
					"pain_points":       fixture.PainPoints,
					"goals_objectives":  fixture.GoalsObjectives,
				}

				requestStart := time.Now()
				resp, err := suite.helpers.MakeRequestWithoutStatusCheck("POST", "/consultations", createData)
				requestDuration := time.Since(requestStart)

				mu.Lock()
				totalLatency += requestDuration
				if err == nil && resp.StatusCode == 201 {
					successCount++
				}
				if resp != nil {
					resp.Body.Close()
				}
				mu.Unlock()

				if err != nil {
					t.Logf("Creation failed for user %d, consultation %d: %v", userIndex, j, err)
				}
			}
		}(i)
	}

	wg.Wait()
	totalDuration := time.Since(start)

	// Calculate metrics
	actualTPS := float64(successCount) / totalDuration.Seconds()
	averageLatency := totalLatency / time.Duration(successCount)
	successRate := float64(successCount) / float64(consultationCount)

	t.Logf("High Volume Creation Results:")
	t.Logf("  Total time: %v", totalDuration)
	t.Logf("  Successful creations: %d/%d (%.2f%%)", successCount, consultationCount, successRate*100)
	t.Logf("  TPS: %.2f", actualTPS)
	t.Logf("  Average latency: %v", averageLatency)

	// Assertions
	assert.True(t, totalDuration < maxTime, "Total time %v should be less than %v", totalDuration, maxTime)
	assert.True(t, actualTPS >= minTPS, "TPS %.2f should be at least %.2f", actualTPS, minTPS)
	assert.True(t, successRate >= 0.95, "Success rate %.2f%% should be at least 95%%", successRate*100)
	assert.True(t, averageLatency < 2*time.Second, "Average latency %v should be less than 2s", averageLatency)
}

// TestConcurrentReadWrite tests mixed read/write workloads
func (suite *StressTestSuite) TestConcurrentReadWrite() {
	t := suite.T()

	if testing.Short() {
		t.Skip("Skipping concurrent read/write stress test in short mode")
	}

	// Pre-populate with some consultations
	setupCount := 50
	preCreated, err := suite.fixtures.CreateBulkConsultations(suite.userIDs[0], setupCount, []consultation.ConsultationStatus{
		consultation.StatusDraft,
		consultation.StatusCompleted,
	})
	require.NoError(t, err)

	// Run mixed workload
	duration := 30 * time.Second
	var wg sync.WaitGroup
	var stats struct {
		reads    int64
		writes   int64
		updates  int64
		errors   int64
		mu       sync.Mutex
	}

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	// Reader workers
	readerCount := 3
	for i := 0; i < readerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			userID := suite.userIDs[workerID%len(suite.userIDs)]
			suite.helpers.SetUserID(userID)

			for {
				select {
				case <-ctx.Done():
					return
				default:
					// List consultations
					_, err := suite.helpers.MakeRequestWithoutStatusCheck("GET", "/consultations?limit=10", nil)
					stats.mu.Lock()
					if err == nil {
						stats.reads++
					} else {
						stats.errors++
					}
					stats.mu.Unlock()

					time.Sleep(50 * time.Millisecond)
				}
			}
		}(i)
	}

	// Writer workers
	writerCount := 2
	for i := 0; i < writerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			userID := suite.userIDs[(workerID+1)%len(suite.userIDs)]
			suite.helpers.SetUserID(userID)

			businessTypes := suite.fixtures.GetBusinessTypes()

			for {
				select {
				case <-ctx.Done():
					return
				default:
					// Create consultation
					businessType := businessTypes[workerID%len(businessTypes)]
					fixture := suite.fixtures.GenerateRealisticConsultation(userID, businessType, consultation.StatusDraft)

					createData := map[string]interface{}{
						"contact_info": fixture.ContactInfo,
					}

					_, err := suite.helpers.MakeRequestWithoutStatusCheck("POST", "/consultations", createData)
					stats.mu.Lock()
					if err == nil {
						stats.writes++
					} else {
						stats.errors++
					}
					stats.mu.Unlock()

					time.Sleep(100 * time.Millisecond)
				}
			}
		}(i)
	}

	// Update workers
	updaterCount := 2
	for i := 0; i < updaterCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			suite.helpers.SetUserID(suite.userIDs[0]) // Use first user for updates

			for {
				select {
				case <-ctx.Done():
					return
				default:
					// Update random consultation
					if len(preCreated) > 0 {
						consultationID := preCreated[workerID%len(preCreated)]
						updateData := map[string]interface{}{
							"contact_info": map[string]interface{}{
								"business_name": fmt.Sprintf("Updated Business %d", time.Now().UnixNano()),
							},
						}

						path := fmt.Sprintf("/consultations/%s", consultationID)
						_, err := suite.helpers.MakeRequestWithoutStatusCheck("PUT", path, updateData)
						stats.mu.Lock()
						if err == nil {
							stats.updates++
						} else {
							stats.errors++
						}
						stats.mu.Unlock()
					}

					time.Sleep(200 * time.Millisecond)
				}
			}
		}(i)
	}

	wg.Wait()

	t.Logf("Concurrent Read/Write Results over %v:", duration)
	t.Logf("  Reads: %d", stats.reads)
	t.Logf("  Writes: %d", stats.writes)
	t.Logf("  Updates: %d", stats.updates)
	t.Logf("  Errors: %d", stats.errors)

	totalOps := stats.reads + stats.writes + stats.updates
	errorRate := float64(stats.errors) / float64(totalOps+stats.errors)
	opsPerSecond := float64(totalOps) / duration.Seconds()

	t.Logf("  Total operations: %d", totalOps)
	t.Logf("  Operations per second: %.2f", opsPerSecond)
	t.Logf("  Error rate: %.2f%%", errorRate*100)

	// Assertions
	assert.True(t, stats.reads > 0, "Should have performed read operations")
	assert.True(t, stats.writes > 0, "Should have performed write operations")
	assert.True(t, errorRate < 0.05, "Error rate %.2f%% should be less than 5%%", errorRate*100)
	assert.True(t, opsPerSecond > 10.0, "Should achieve at least 10 ops/second")
}

// TestMemoryUsageUnderLoad tests memory usage during heavy operations
func (suite *StressTestSuite) TestMemoryUsageUnderLoad() {
	t := suite.T()

	if testing.Short() {
		t.Skip("Skipping memory usage stress test in short mode")
	}

	// Create a large number of consultations to test memory handling
	bulkCount := 1000
	statuses := []consultation.ConsultationStatus{
		consultation.StatusDraft,
		consultation.StatusCompleted,
		consultation.StatusArchived,
	}

	start := time.Now()
	createdIDs, err := suite.fixtures.CreateBulkConsultations(suite.userIDs[0], bulkCount, statuses)
	creationTime := time.Since(start)

	require.NoError(t, err)
	require.Equal(t, bulkCount, len(createdIDs))

	t.Logf("Created %d consultations in %v", bulkCount, creationTime)

	// Test large list operations
	suite.helpers.SetUserID(suite.userIDs[0])

	start = time.Now()
	largeList := suite.helpers.ListConsultations("limit=1000")
	listTime := time.Since(start)

	assert.True(t, largeList.Total >= int64(bulkCount))
	t.Logf("Listed %d consultations in %v", len(largeList.Consultations), listTime)

	// Test pagination through large datasets
	pageSize := 50
	totalPages := (bulkCount + pageSize - 1) / pageSize

	start = time.Now()
	totalRetrieved := 0

	for page := 1; page <= totalPages; page++ {
		pageList := suite.helpers.ListConsultations(fmt.Sprintf("page=%d&limit=%d", page, pageSize))
		totalRetrieved += len(pageList.Consultations)

		// Small delay to prevent overwhelming the system
		if page%10 == 0 {
			time.Sleep(10 * time.Millisecond)
		}
	}

	paginationTime := time.Since(start)

	t.Logf("Retrieved %d consultations through pagination in %v", totalRetrieved, paginationTime)
	assert.True(t, totalRetrieved >= bulkCount, "Should retrieve at least all created consultations")

	// Performance assertions
	assert.True(t, creationTime < 60*time.Second, "Bulk creation should complete within 60s")
	assert.True(t, listTime < 5*time.Second, "Large list should complete within 5s")
	assert.True(t, paginationTime < 30*time.Second, "Pagination should complete within 30s")
}

// TestDatabaseConnectionPooling tests behavior under connection pressure
func (suite *StressTestSuite) TestDatabaseConnectionPooling() {
	t := suite.T()

	if testing.Short() {
		t.Skip("Skipping database connection pooling test in short mode")
	}

	// Simulate many concurrent connections
	concurrency := 50
	var wg sync.WaitGroup
	var successCount int64
	var mu sync.Mutex

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			userID := suite.userIDs[workerID%len(suite.userIDs)]

			// Create repository directly to test database connections
			consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

			// Perform multiple operations to hold connections longer
			for j := 0; j < 10; j++ {
				businessType := suite.fixtures.GetBusinessTypes()[j%len(suite.fixtures.GetBusinessTypes())]
				fixture := suite.fixtures.GenerateRealisticConsultation(userID, businessType, consultation.StatusDraft)

				createInput := &consultation.CreateConsultationInput{
					UserID:      userID,
					ContactInfo: fixture.ContactInfo,
				}

				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_, err := consultationRepo.Create(ctx, createInput)
				cancel()

				mu.Lock()
				if err == nil {
					successCount++
				} else {
					t.Logf("Database operation failed for worker %d, op %d: %v", workerID, j, err)
				}
				mu.Unlock()

				// Small delay to simulate processing time
				time.Sleep(50 * time.Millisecond)
			}
		}(i)
	}

	start := time.Now()
	wg.Wait()
	duration := time.Since(start)

	totalOperations := int64(concurrency * 10)
	successRate := float64(successCount) / float64(totalOperations)

	t.Logf("Database Connection Pool Results:")
	t.Logf("  Concurrent workers: %d", concurrency)
	t.Logf("  Total operations: %d", totalOperations)
	t.Logf("  Successful operations: %d", successCount)
	t.Logf("  Success rate: %.2f%%", successRate*100)
	t.Logf("  Total duration: %v", duration)

	// Assertions
	assert.True(t, successRate >= 0.95, "Success rate %.2f%% should be at least 95%%", successRate*100)
	assert.True(t, duration < 60*time.Second, "Should complete within reasonable time")
}

// TestErrorRecovery tests system behavior during and after errors
func (suite *StressTestSuite) TestErrorRecovery() {
	t := suite.T()

	// Create some initial data
	consultation := suite.helpers.CreateTestConsultation(nil)
	consultationID := consultation.ID

	// Simulate various error scenarios
	errorScenarios := []struct {
		name   string
		method string
		path   string
		data   interface{}
	}{
		{
			name:   "Invalid UUID",
			method: "GET",
			path:   "/consultations/invalid-uuid",
			data:   nil,
		},
		{
			name:   "Non-existent consultation",
			method: "GET",
			path:   fmt.Sprintf("/consultations/%s", uuid.New()),
			data:   nil,
		},
		{
			name:   "Malformed JSON",
			method: "POST",
			path:   "/consultations",
			data:   "invalid json",
		},
		{
			name:   "Invalid validation data",
			method: "PUT",
			path:   fmt.Sprintf("/consultations/%s", consultationID),
			data:   map[string]interface{}{"contact_info": map[string]interface{}{"email": "invalid-email"}},
		},
	}

	// Generate errors in parallel
	concurrency := 10
	var wg sync.WaitGroup

	for _, scenario := range errorScenarios {
		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(s struct {
				name   string
				method string
				path   string
				data   interface{}
			}) {
				defer wg.Done()

				// Make the error request
				_, err := suite.helpers.MakeRequestWithoutStatusCheck(s.method, s.path, s.data)
				// We expect these to fail, so we don't assert on the error
				_ = err
			}(scenario)
		}
	}

	wg.Wait()

	// Verify system is still functional after error scenarios
	healthCheckConsultation := suite.helpers.CreateTestConsultation(nil)
	assert.NotEqual(t, uuid.Nil, healthCheckConsultation.ID, "System should still be functional after error scenarios")

	retrievedConsultation := suite.helpers.GetConsultation(healthCheckConsultation.ID)
	assert.Equal(t, healthCheckConsultation.ID, retrievedConsultation.ID, "System should handle normal operations after errors")

	// Verify original consultation is still intact
	originalConsultation := suite.helpers.GetConsultation(consultationID)
	assert.Equal(t, consultationID, originalConsultation.ID, "Original data should be unaffected by error scenarios")
}

// TestStressSuite runs the stress test suite
func TestStressSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping stress tests in short mode")
	}

	// Only run stress tests if explicitly requested
	if testing.Short() {
		t.Skip("Stress tests require long mode: go test -v -timeout=10m")
	}

	suite.Run(t, new(StressTestSuite))
}

// MultiUserMockAuthService provides authentication for multiple test users
type MultiUserMockAuthService struct {
	userIDs []uuid.UUID
}

// Auth implements the authentication interface for multiple users
func (m *MultiUserMockAuthService) Auth(token string, minLevel int) (*rest.AuthResult, error) {
	if len(token) > 25 && token[:25] == "Bearer test-jwt-token-" {
		userIDStr := token[25:]
		if userID, err := uuid.Parse(userIDStr); err == nil {
			// Verify the user ID is in our test users list
			for _, testUserID := range m.userIDs {
				if userID == testUserID {
					return &rest.AuthResult{
						UserID: userID,
						Level:  10,
					}, nil
				}
			}
		}
	}
	return nil, fmt.Errorf("invalid test token or user not found")
}