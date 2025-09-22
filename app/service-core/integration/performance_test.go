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

// PerformanceTestSuite provides comprehensive performance testing for the consultation domain
type PerformanceTestSuite struct {
	suite.Suite
	dbHelper *DatabaseTestHelper
	fixtures *TestFixtures
	helpers  *IntegrationTestHelpers
	userIDs  []uuid.UUID
}

// SetupSuite initializes the performance test environment
func (suite *PerformanceTestSuite) SetupSuite() {
	suite.dbHelper = NewDatabaseTestHelper(suite.T(), "PerformanceTest")
	suite.fixtures = NewTestFixtures(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Create multiple test users for performance testing
	userCount := 10
	var err error
	suite.userIDs, err = suite.fixtures.CreateTestUsers(userCount)
	require.NoError(suite.T(), err)

	// Setup API handler
	handler := suite.createHandler(suite.userIDs[0])
	suite.helpers = NewIntegrationTestHelpers(suite.T(), handler, suite.userIDs[0])
}

// TearDownSuite cleans up the performance test environment
func (suite *PerformanceTestSuite) TearDownSuite() {
	if suite.helpers != nil {
		suite.helpers.Close()
	}
	suite.dbHelper.CleanupDatabase(suite.T())
}

// SetupTest runs before each performance test
func (suite *PerformanceTestSuite) SetupTest() {
	// Clean up test data
	err := suite.fixtures.CleanupTestData(suite.userIDs)
	if err != nil {
		suite.T().Logf("Warning: Failed to cleanup test data: %v", err)
	}

	// Recreate users
	for i, userID := range suite.userIDs {
		err := suite.fixtures.CreateTestUser(userID, fmt.Sprintf("perftest%d@example.com", i), fmt.Sprintf("Performance Test User %d", i))
		if err != nil {
			suite.T().Logf("User %d already exists or recreated: %v", i, err)
		}
	}
}

// createHandler creates a test HTTP handler
func (suite *PerformanceTestSuite) createHandler(userID uuid.UUID) *rest.Handler {
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

// BenchmarkConsultationCreation benchmarks consultation creation performance
func (suite *PerformanceTestSuite) TestBenchmarkConsultationCreation() {
	t := suite.T()

	scenarios := []struct {
		name        string
		concurrency int
		operations  int
		maxTime     time.Duration
		minTPS      float64
	}{
		{
			name:        "Light Load",
			concurrency: 5,
			operations:  50,
			maxTime:     10 * time.Second,
			minTPS:      5.0,
		},
		{
			name:        "Medium Load",
			concurrency: 10,
			operations:  100,
			maxTime:     20 * time.Second,
			minTPS:      5.0,
		},
		{
			name:        "Heavy Load",
			concurrency: 20,
			operations:  200,
			maxTime:     60 * time.Second,
			minTPS:      3.0,
		},
	}

	for _, scenario := range scenarios {
		if testing.Short() && scenario.operations > 50 {
			t.Skipf("Skipping %s in short mode", scenario.name)
			continue
		}

		t.Run(scenario.name, func(t *testing.T) {
			suite.runCreationBenchmark(t, scenario.concurrency, scenario.operations, scenario.maxTime, scenario.minTPS)
		})
	}
}

// runCreationBenchmark performs the actual creation benchmark
func (suite *PerformanceTestSuite) runCreationBenchmark(t *testing.T, concurrency, operations int, maxTime time.Duration, minTPS float64) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]time.Duration, 0, operations)
	errors := 0

	operationsPerWorker := operations / concurrency
	businessTypes := suite.fixtures.GetBusinessTypes()

	start := time.Now()

	// Start concurrent workers
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			userID := suite.userIDs[workerID%len(suite.userIDs)]
			suite.helpers.SetUserID(userID)

			for j := 0; j < operationsPerWorker; j++ {
				// Generate realistic test data
				businessType := businessTypes[j%len(businessTypes)]
				fixture := suite.fixtures.GenerateRealisticConsultation(userID, businessType, consultation.StatusDraft)

				createData := map[string]interface{}{
					"contact_info":     fixture.ContactInfo,
					"business_context": fixture.BusinessContext,
				}

				// Measure individual operation time
				opStart := time.Now()
				resp, err := suite.helpers.MakeRequestWithoutStatusCheck("POST", "/consultations", createData)
				opDuration := time.Since(opStart)

				mu.Lock()
				if err == nil && resp != nil && resp.StatusCode == 201 {
					results = append(results, opDuration)
				} else {
					errors++
				}
				if resp != nil {
					resp.Body.Close()
				}
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()
	totalDuration := time.Since(start)

	// Calculate performance metrics
	successfulOps := len(results)
	actualTPS := float64(successfulOps) / totalDuration.Seconds()
	successRate := float64(successfulOps) / float64(operations)

	// Calculate latency statistics
	var totalLatency time.Duration
	minLatency := time.Hour
	maxLatency := time.Duration(0)

	for _, latency := range results {
		totalLatency += latency
		if latency < minLatency {
			minLatency = latency
		}
		if latency > maxLatency {
			maxLatency = latency
		}
	}

	avgLatency := time.Duration(0)
	if successfulOps > 0 {
		avgLatency = totalLatency / time.Duration(successfulOps)
	}

	// Calculate percentiles
	p95Latency, p99Latency := suite.calculatePercentiles(results)

	t.Logf("Creation Benchmark Results:")
	t.Logf("  Concurrency: %d workers", concurrency)
	t.Logf("  Operations: %d requested, %d successful", operations, successfulOps)
	t.Logf("  Total time: %v", totalDuration)
	t.Logf("  Success rate: %.2f%%", successRate*100)
	t.Logf("  TPS: %.2f", actualTPS)
	t.Logf("  Latency - Min: %v, Avg: %v, Max: %v", minLatency, avgLatency, maxLatency)
	t.Logf("  Latency - P95: %v, P99: %v", p95Latency, p99Latency)
	t.Logf("  Errors: %d", errors)

	// Performance assertions
	assert.True(t, totalDuration < maxTime, "Total time %v should be less than %v", totalDuration, maxTime)
	assert.True(t, actualTPS >= minTPS, "TPS %.2f should be at least %.2f", actualTPS, minTPS)
	assert.True(t, successRate >= 0.95, "Success rate %.2f%% should be at least 95%%", successRate*100)
	assert.True(t, avgLatency < 2*time.Second, "Average latency %v should be less than 2s", avgLatency)
	assert.True(t, p95Latency < 3*time.Second, "P95 latency %v should be less than 3s", p95Latency)
}

// BenchmarkConsultationRetrieval benchmarks consultation retrieval performance
func (suite *PerformanceTestSuite) TestBenchmarkConsultationRetrieval() {
	t := suite.T()

	// Pre-populate database with test data
	userID := suite.userIDs[0]
	bulkCount := 100

	statuses := []consultation.ConsultationStatus{
		consultation.StatusDraft,
		consultation.StatusCompleted,
		consultation.StatusArchived,
	}

	preCreated, err := suite.fixtures.CreateBulkConsultations(userID, bulkCount, statuses)
	require.NoError(t, err)
	require.Equal(t, bulkCount, len(preCreated))

	suite.helpers.SetUserID(userID)

	scenarios := []struct {
		name        string
		operation   string
		concurrency int
		duration    time.Duration
		minTPS      float64
		maxLatency  time.Duration
	}{
		{
			name:        "Single Consultation Retrieval",
			operation:   "single",
			concurrency: 10,
			duration:    10 * time.Second,
			minTPS:      50.0,
			maxLatency:  200 * time.Millisecond,
		},
		{
			name:        "List Consultations",
			operation:   "list",
			concurrency: 5,
			duration:    10 * time.Second,
			minTPS:      20.0,
			maxLatency:  500 * time.Millisecond,
		},
		{
			name:        "Filtered List",
			operation:   "filtered",
			concurrency: 5,
			duration:    10 * time.Second,
			minTPS:      15.0,
			maxLatency:  1 * time.Second,
		},
	}

	for _, scenario := range scenarios {
		if testing.Short() && scenario.duration > 5*time.Second {
			t.Skipf("Skipping %s in short mode", scenario.name)
			continue
		}

		t.Run(scenario.name, func(t *testing.T) {
			suite.runRetrievalBenchmark(t, preCreated, scenario.operation, scenario.concurrency, scenario.duration, scenario.minTPS, scenario.maxLatency)
		})
	}
}

// runRetrievalBenchmark performs the actual retrieval benchmark
func (suite *PerformanceTestSuite) runRetrievalBenchmark(t *testing.T, consultationIDs []uuid.UUID, operation string, concurrency int, duration time.Duration, minTPS float64, maxLatency time.Duration) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]time.Duration, 0)
	errors := 0

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	start := time.Now()

	// Start concurrent workers
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			for {
				select {
				case <-ctx.Done():
					return
				default:
					var path string
					switch operation {
					case "single":
						// Get random consultation
						id := consultationIDs[workerID%len(consultationIDs)]
						path = fmt.Sprintf("/consultations/%s", id)
					case "list":
						path = "/consultations?limit=20"
					case "filtered":
						filters := []string{
							"status=draft",
							"status=completed",
							"q=Technology",
						}
						filter := filters[workerID%len(filters)]
						path = fmt.Sprintf("/consultations?%s&limit=10", filter)
					}

					opStart := time.Now()
					resp, err := suite.helpers.MakeRequestWithoutStatusCheck("GET", path, nil)
					opDuration := time.Since(opStart)

					mu.Lock()
					if err == nil && resp != nil && resp.StatusCode == 200 {
						results = append(results, opDuration)
					} else {
						errors++
					}
					if resp != nil {
						resp.Body.Close()
					}
					mu.Unlock()

					// Small delay to prevent overwhelming
					time.Sleep(10 * time.Millisecond)
				}
			}
		}(i)
	}

	wg.Wait()
	totalDuration := time.Since(start)

	// Calculate performance metrics
	successfulOps := len(results)
	actualTPS := float64(successfulOps) / totalDuration.Seconds()

	// Calculate latency statistics
	var totalLatency time.Duration
	minLatency := time.Hour
	maxLatency := time.Duration(0)

	for _, latency := range results {
		totalLatency += latency
		if latency < minLatency {
			minLatency = latency
		}
		if latency > maxLatency {
			maxLatency = latency
		}
	}

	avgLatency := time.Duration(0)
	if successfulOps > 0 {
		avgLatency = totalLatency / time.Duration(successfulOps)
	}

	p95Latency, p99Latency := suite.calculatePercentiles(results)

	t.Logf("Retrieval Benchmark Results (%s):", operation)
	t.Logf("  Concurrency: %d workers", concurrency)
	t.Logf("  Duration: %v", totalDuration)
	t.Logf("  Operations: %d successful", successfulOps)
	t.Logf("  TPS: %.2f", actualTPS)
	t.Logf("  Latency - Min: %v, Avg: %v, Max: %v", minLatency, avgLatency, maxLatency)
	t.Logf("  Latency - P95: %v, P99: %v", p95Latency, p99Latency)
	t.Logf("  Errors: %d", errors)

	// Performance assertions
	assert.True(t, actualTPS >= minTPS, "TPS %.2f should be at least %.2f", actualTPS, minTPS)
	assert.True(t, avgLatency < maxLatency, "Average latency %v should be less than %v", avgLatency, maxLatency)
	assert.True(t, p95Latency < maxLatency*2, "P95 latency %v should be reasonable", p95Latency)
}

// BenchmarkDraftOperations benchmarks draft auto-save performance
func (suite *PerformanceTestSuite) TestBenchmarkDraftOperations() {
	t := suite.T()

	if testing.Short() {
		t.Skip("Skipping draft operations benchmark in short mode")
	}

	// Create base consultations
	userID := suite.userIDs[0]
	baseConsultations := 20

	consultationIDs := make([]uuid.UUID, baseConsultations)
	for i := 0; i < baseConsultations; i++ {
		consultation := suite.helpers.CreateTestConsultation(map[string]interface{}{
			"contact_info": map[string]interface{}{
				"business_name": fmt.Sprintf("Draft Test Business %d", i),
			},
		})
		consultationIDs[i] = consultation.ID
	}

	suite.helpers.SetUserID(userID)

	concurrency := 10
	duration := 15 * time.Second

	var wg sync.WaitGroup
	var mu sync.Mutex
	draftSaves := 0
	draftRetrieves := 0
	draftPromotes := 0
	errors := 0

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	start := time.Now()

	// Start concurrent draft workers
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			for {
				select {
				case <-ctx.Done():
					return
				default:
					consultationID := consultationIDs[workerID%len(consultationIDs)]

					// Simulate draft save
					draftData := map[string]interface{}{
						"business_context": map[string]interface{}{
							"industry":  fmt.Sprintf("Industry %d", time.Now().UnixNano()%100),
							"team_size": 10 + (workerID % 50),
						},
					}

					resp, err := suite.helpers.MakeRequestWithoutStatusCheck("POST", fmt.Sprintf("/consultations/%s/drafts", consultationID), draftData)

					mu.Lock()
					if err == nil && resp != nil && (resp.StatusCode == 200 || resp.StatusCode == 201) {
						draftSaves++
					} else {
						errors++
					}
					if resp != nil {
						resp.Body.Close()
					}
					mu.Unlock()

					// Occasionally retrieve draft
					if workerID%3 == 0 {
						resp, err := suite.helpers.MakeRequestWithoutStatusCheck("GET", fmt.Sprintf("/consultations/%s/drafts", consultationID), nil)

						mu.Lock()
						if err == nil && resp != nil && resp.StatusCode == 200 {
							draftRetrieves++
						} else {
							errors++
						}
						if resp != nil {
							resp.Body.Close()
						}
						mu.Unlock()
					}

					time.Sleep(100 * time.Millisecond)
				}
			}
		}(i)
	}

	wg.Wait()
	totalDuration := time.Since(start)

	totalOps := draftSaves + draftRetrieves + draftPromotes
	actualTPS := float64(totalOps) / totalDuration.Seconds()

	t.Logf("Draft Operations Benchmark Results:")
	t.Logf("  Concurrency: %d workers", concurrency)
	t.Logf("  Duration: %v", totalDuration)
	t.Logf("  Draft saves: %d", draftSaves)
	t.Logf("  Draft retrieves: %d", draftRetrieves)
	t.Logf("  Draft promotes: %d", draftPromotes)
	t.Logf("  Total operations: %d", totalOps)
	t.Logf("  TPS: %.2f", actualTPS)
	t.Logf("  Errors: %d", errors)

	// Performance assertions
	assert.True(t, actualTPS >= 5.0, "Draft operations TPS %.2f should be at least 5.0", actualTPS)
	assert.True(t, draftSaves > 0, "Should have performed draft saves")
	assert.True(t, float64(errors)/float64(totalOps+errors) < 0.05, "Error rate should be less than 5%%")
}

// BenchmarkDatabaseOperations benchmarks raw database performance
func (suite *PerformanceTestSuite) TestBenchmarkDatabaseOperations() {
	t := testing.T()

	if testing.Short() {
		t.Skip("Skipping database operations benchmark in short mode")
	}

	// Direct database operations benchmark
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	userID := suite.userIDs[0]

	scenarios := []struct {
		name       string
		operations int
		operation  string
		minTPS     float64
	}{
		{
			name:       "Database Insertions",
			operations: 100,
			operation:  "insert",
			minTPS:     50.0,
		},
		{
			name:       "Database Retrievals",
			operations: 500,
			operation:  "select",
			minTPS:     200.0,
		},
		{
			name:       "Database Updates",
			operations: 200,
			operation:  "update",
			minTPS:     100.0,
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			switch scenario.operation {
			case "insert":
				suite.benchmarkDatabaseInserts(t, consultationRepo, userID, scenario.operations, scenario.minTPS)
			case "select":
				suite.benchmarkDatabaseSelects(t, consultationRepo, userID, scenario.operations, scenario.minTPS)
			case "update":
				suite.benchmarkDatabaseUpdates(t, consultationRepo, userID, scenario.operations, scenario.minTPS)
			}
		})
	}
}

// benchmarkDatabaseInserts benchmarks database insert operations
func (suite *PerformanceTestSuite) benchmarkDatabaseInserts(t *testing.T, repo consultation.ConsultationRepository, userID uuid.UUID, operations int, minTPS float64) {
	businessTypes := suite.fixtures.GetBusinessTypes()

	start := time.Now()

	for i := 0; i < operations; i++ {
		businessType := businessTypes[i%len(businessTypes)]
		fixture := suite.fixtures.GenerateRealisticConsultation(userID, businessType, consultation.StatusDraft)

		createInput := &consultation.CreateConsultationInput{
			UserID:          userID,
			ContactInfo:     fixture.ContactInfo,
			BusinessContext: fixture.BusinessContext,
		}

		_, err := repo.Create(context.Background(), createInput)
		if err != nil {
			t.Logf("Insert operation %d failed: %v", i, err)
		}
	}

	duration := time.Since(start)
	actualTPS := float64(operations) / duration.Seconds()

	t.Logf("Database Insert Benchmark:")
	t.Logf("  Operations: %d", operations)
	t.Logf("  Duration: %v", duration)
	t.Logf("  TPS: %.2f", actualTPS)
	t.Logf("  Avg time per insert: %v", duration/time.Duration(operations))

	assert.True(t, actualTPS >= minTPS, "Insert TPS %.2f should be at least %.2f", actualTPS, minTPS)
}

// benchmarkDatabaseSelects benchmarks database select operations
func (suite *PerformanceTestSuite) benchmarkDatabaseSelects(t *testing.T, repo consultation.ConsultationRepository, userID uuid.UUID, operations int, minTPS float64) {
	// Pre-populate with some data
	setupCount := 50
	preCreated, err := suite.fixtures.CreateBulkConsultations(userID, setupCount, []consultation.ConsultationStatus{consultation.StatusDraft})
	require.NoError(t, err)

	start := time.Now()

	for i := 0; i < operations; i++ {
		if i%3 == 0 {
			// List operation
			params := &consultation.ListConsultationsParams{
				UserID: userID,
				Page:   1,
				Limit:  10,
			}
			_, err := repo.List(context.Background(), params)
			if err != nil {
				t.Logf("List operation %d failed: %v", i, err)
			}
		} else {
			// Get by ID operation
			id := preCreated[i%len(preCreated)]
			_, err := repo.GetByID(context.Background(), id)
			if err != nil {
				t.Logf("GetByID operation %d failed: %v", i, err)
			}
		}
	}

	duration := time.Since(start)
	actualTPS := float64(operations) / duration.Seconds()

	t.Logf("Database Select Benchmark:")
	t.Logf("  Operations: %d", operations)
	t.Logf("  Duration: %v", duration)
	t.Logf("  TPS: %.2f", actualTPS)
	t.Logf("  Avg time per select: %v", duration/time.Duration(operations))

	assert.True(t, actualTPS >= minTPS, "Select TPS %.2f should be at least %.2f", actualTPS, minTPS)
}

// benchmarkDatabaseUpdates benchmarks database update operations
func (suite *PerformanceTestSuite) benchmarkDatabaseUpdates(t *testing.T, repo consultation.ConsultationRepository, userID uuid.UUID, operations int, minTPS float64) {
	// Pre-populate with data to update
	setupCount := operations
	preCreated, err := suite.fixtures.CreateBulkConsultations(userID, setupCount, []consultation.ConsultationStatus{consultation.StatusDraft})
	require.NoError(t, err)

	start := time.Now()

	for i := 0; i < operations; i++ {
		consultationID := preCreated[i%len(preCreated)]

		updateInput := &consultation.UpdateConsultationInput{
			ContactInfo: &consultation.ContactInfo{
				BusinessName: fmt.Sprintf("Updated Business %d", i),
			},
		}

		_, err := repo.Update(context.Background(), consultationID, updateInput)
		if err != nil {
			t.Logf("Update operation %d failed: %v", i, err)
		}
	}

	duration := time.Since(start)
	actualTPS := float64(operations) / duration.Seconds()

	t.Logf("Database Update Benchmark:")
	t.Logf("  Operations: %d", operations)
	t.Logf("  Duration: %v", duration)
	t.Logf("  TPS: %.2f", actualTPS)
	t.Logf("  Avg time per update: %v", duration/time.Duration(operations))

	assert.True(t, actualTPS >= minTPS, "Update TPS %.2f should be at least %.2f", actualTPS, minTPS)
}

// BenchmarkScalabilityLimits tests system behavior at scale limits
func (suite *PerformanceTestSuite) TestBenchmarkScalabilityLimits() {
	t := suite.T()

	if testing.Short() {
		t.Skip("Skipping scalability limits test in short mode")
	}

	// Test increasing loads to find system limits
	loadTests := []struct {
		name         string
		consultations int
		concurrency   int
		expectSuccess bool
	}{
		{
			name:          "Normal Load",
			consultations: 100,
			concurrency:   5,
			expectSuccess: true,
		},
		{
			name:          "High Load",
			consultations: 500,
			concurrency:   10,
			expectSuccess: true,
		},
		{
			name:          "Very High Load",
			consultations: 1000,
			concurrency:   20,
			expectSuccess: true,
		},
		{
			name:          "Extreme Load",
			consultations: 2000,
			concurrency:   50,
			expectSuccess: false, // This might fail, and that's okay
		},
	}

	for _, loadTest := range loadTests {
		t.Run(loadTest.name, func(t *testing.T) {
			success := suite.runScalabilityTest(t, loadTest.consultations, loadTest.concurrency)

			if loadTest.expectSuccess {
				assert.True(t, success, "Load test %s should succeed", loadTest.name)
			} else {
				t.Logf("Load test %s completed with success=%v (failure expected at extreme loads)", loadTest.name, success)
			}
		})
	}
}

// runScalabilityTest runs a scalability test and returns whether it was successful
func (suite *PerformanceTestSuite) runScalabilityTest(t *testing.T, consultations, concurrency int) bool {
	var wg sync.WaitGroup
	var mu sync.Mutex
	successCount := 0
	errorCount := 0

	operationsPerWorker := consultations / concurrency
	businessTypes := suite.fixtures.GetBusinessTypes()

	start := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			userID := suite.userIDs[workerID%len(suite.userIDs)]
			suite.helpers.SetUserID(userID)

			for j := 0; j < operationsPerWorker; j++ {
				businessType := businessTypes[j%len(businessTypes)]
				fixture := suite.fixtures.GenerateRealisticConsultation(userID, businessType, consultation.StatusDraft)

				createData := map[string]interface{}{
					"contact_info": fixture.ContactInfo,
				}

				resp, err := suite.helpers.MakeRequestWithoutStatusCheck("POST", "/consultations", createData)

				mu.Lock()
				if err == nil && resp != nil && resp.StatusCode == 201 {
					successCount++
				} else {
					errorCount++
				}
				if resp != nil {
					resp.Body.Close()
				}
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()
	duration := time.Since(start)

	totalOperations := successCount + errorCount
	successRate := float64(successCount) / float64(totalOperations)
	actualTPS := float64(successCount) / duration.Seconds()

	t.Logf("Scalability Test Results:")
	t.Logf("  Target operations: %d", consultations)
	t.Logf("  Concurrency: %d", concurrency)
	t.Logf("  Successful operations: %d", successCount)
	t.Logf("  Failed operations: %d", errorCount)
	t.Logf("  Success rate: %.2f%%", successRate*100)
	t.Logf("  Duration: %v", duration)
	t.Logf("  TPS: %.2f", actualTPS)

	// Consider the test successful if we have at least 80% success rate
	return successRate >= 0.80
}

// calculatePercentiles calculates P95 and P99 latency percentiles
func (suite *PerformanceTestSuite) calculatePercentiles(latencies []time.Duration) (p95, p99 time.Duration) {
	if len(latencies) == 0 {
		return 0, 0
	}

	// Simple percentile calculation (for production, use a proper library)
	// Sort latencies first (this is inefficient but good enough for testing)
	sorted := make([]time.Duration, len(latencies))
	copy(sorted, latencies)

	// Simple insertion sort
	for i := 1; i < len(sorted); i++ {
		key := sorted[i]
		j := i - 1
		for j >= 0 && sorted[j] > key {
			sorted[j+1] = sorted[j]
			j--
		}
		sorted[j+1] = key
	}

	p95Index := int(float64(len(sorted)) * 0.95)
	p99Index := int(float64(len(sorted)) * 0.99)

	if p95Index >= len(sorted) {
		p95Index = len(sorted) - 1
	}
	if p99Index >= len(sorted) {
		p99Index = len(sorted) - 1
	}

	return sorted[p95Index], sorted[p99Index]
}

// TestPerformanceSuite runs the performance test suite
func TestPerformanceSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance tests in short mode")
	}

	// Performance tests should only run when explicitly requested
	suite.Run(t, new(PerformanceTestSuite))
}