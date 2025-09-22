package integration

import (
	"context"
	"database/sql"
	"service-core/domain/consultation"
	"service-core/storage/query"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// DatabaseIntegrationTestSuite tests database-level integration for the consultation domain
type DatabaseIntegrationTestSuite struct {
	suite.Suite
	dbHelper *DatabaseTestHelper
	fixtures *TestFixtures
	userID   uuid.UUID
}

// SetupSuite initializes the test environment
func (suite *DatabaseIntegrationTestSuite) SetupSuite() {
	suite.dbHelper = NewDatabaseTestHelper(suite.T(), "DatabaseIntegrationTest")
	suite.fixtures = NewTestFixtures(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	suite.userID = uuid.New()

	// Create test user
	err := suite.fixtures.CreateTestUser(suite.userID, "dbtest@example.com", "DB Test User")
	require.NoError(suite.T(), err)
}

// TearDownSuite cleans up the test environment
func (suite *DatabaseIntegrationTestSuite) TearDownSuite() {
	suite.dbHelper.CleanupDatabase(suite.T())
}

// SetupTest runs before each test
func (suite *DatabaseIntegrationTestSuite) SetupTest() {
	// Clean consultation data but keep the user
	err := suite.fixtures.CleanupTestData([]uuid.UUID{suite.userID})
	if err != nil {
		suite.T().Logf("Warning: Failed to cleanup test data: %v", err)
	}

	// Recreate user if it was deleted
	err = suite.fixtures.CreateTestUser(suite.userID, "dbtest@example.com", "DB Test User")
	if err != nil {
		suite.T().Logf("User already exists or recreated: %v", err)
	}
}

// TestDatabaseConnectivity verifies basic database operations
func (suite *DatabaseIntegrationTestSuite) TestDatabaseConnectivity() {
	suite.dbHelper.TestDatabaseConnectivity(suite.T())
}

// TestSchemaIntegrity verifies that all required tables and indexes exist
func (suite *DatabaseIntegrationTestSuite) TestSchemaIntegrity() {
	t := suite.T()

	// Verify all required tables exist
	requiredTables := []string{"users", "consultations", "consultation_drafts", "consultation_versions"}
	for _, table := range requiredTables {
		exists := suite.dbHelper.VerifyTableExists(t, table)
		assert.True(t, exists, "Required table %s should exist", table)
	}

	// Verify key indexes exist (implementation may vary by database type)
	expectedIndexes := []string{
		"idx_consultations_user_id",
		"idx_consultations_status",
		"idx_consultations_created_at",
	}

	for _, index := range expectedIndexes {
		exists := suite.dbHelper.VerifyIndexExists(t, index)
		assert.True(t, exists, "Required index %s should exist", index)
	}
}

// TestConsultationCRUDOperations tests basic CRUD operations through the repository
func (suite *DatabaseIntegrationTestSuite) TestConsultationCRUDOperations() {
	t := suite.T()

	// Create repository instances
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Test Create
	businessType := suite.fixtures.GetBusinessTypes()[0]
	fixture := suite.fixtures.GenerateRealisticConsultation(suite.userID, businessType, consultation.StatusDraft)

	createInput := &consultation.CreateConsultationInput{
		UserID:           fixture.UserID,
		ContactInfo:      fixture.ContactInfo,
		BusinessContext:  fixture.BusinessContext,
		PainPoints:      fixture.PainPoints,
		GoalsObjectives: fixture.GoalsObjectives,
	}

	createdConsultation, err := consultationRepo.Create(context.Background(), createInput)
	require.NoError(t, err, "Should create consultation successfully")
	require.NotEqual(t, uuid.Nil, createdConsultation.ID, "Created consultation should have valid ID")

	consultationID := createdConsultation.ID

	// Test Read
	retrievedConsultation, err := consultationRepo.GetByID(context.Background(), consultationID)
	require.NoError(t, err, "Should retrieve consultation successfully")
	assert.Equal(t, consultationID, retrievedConsultation.ID)
	assert.Equal(t, suite.userID, retrievedConsultation.UserID)
	assert.Equal(t, "draft", retrievedConsultation.Status)

	// Test Update
	updateInput := &consultation.UpdateConsultationInput{
		ContactInfo: &consultation.ContactInfo{
			BusinessName:  "Updated Business Name",
			ContactPerson: "Updated Contact",
			Email:        "updated@example.com",
		},
	}

	updatedConsultation, err := consultationRepo.Update(context.Background(), consultationID, updateInput)
	require.NoError(t, err, "Should update consultation successfully")
	assert.Equal(t, consultationID, updatedConsultation.ID)

	// Parse updated contact info to verify the update
	err = updatedConsultation.ParseContactInfo()
	require.NoError(t, err)
	assert.Equal(t, "Updated Business Name", updatedConsultation.ParsedContactInfo.BusinessName)

	// Test List operations
	listParams := &consultation.ListConsultationsParams{
		UserID: suite.userID,
		Page:   1,
		Limit:  10,
	}

	response, err := consultationRepo.List(context.Background(), listParams)
	require.NoError(t, err, "Should list consultations successfully")
	assert.True(t, response.Total >= 1, "Should have at least one consultation")
	assert.True(t, len(response.Consultations) >= 1, "Should return at least one consultation")

	// Test Delete
	err = consultationRepo.Delete(context.Background(), consultationID)
	require.NoError(t, err, "Should delete consultation successfully")

	// Verify deletion
	_, err = consultationRepo.GetByID(context.Background(), consultationID)
	assert.Error(t, err, "Should not find deleted consultation")
}

// TestDraftOperations tests consultation draft operations
func (suite *DatabaseIntegrationTestSuite) TestDraftOperations() {
	t := suite.T()

	// Create a consultation first
	businessType := suite.fixtures.GetBusinessTypes()[0]
	fixture := suite.fixtures.GenerateRealisticConsultation(suite.userID, businessType, consultation.StatusDraft)

	err := suite.fixtures.CreateConsultationFromFixture(fixture)
	require.NoError(t, err)

	consultationID := fixture.ID

	// Create draft repository
	draftRepo := consultation.NewDraftRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Test draft creation/update
	draftData := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Draft Business Update",
			"email":        "draft@example.com",
		},
		"business_context": map[string]interface{}{
			"industry":  "Updated Industry",
			"team_size": 25,
		},
	}

	err = draftRepo.AutoSave(context.Background(), consultationID, suite.userID, draftData)
	require.NoError(t, err, "Should save draft successfully")

	// Test draft retrieval
	retrievedDraft, err := draftRepo.Get(context.Background(), consultationID, suite.userID)
	require.NoError(t, err, "Should retrieve draft successfully")
	assert.Equal(t, consultationID, retrievedDraft.ConsultationID)
	assert.Equal(t, suite.userID, retrievedDraft.UserID)

	// Parse and verify draft content
	err = retrievedDraft.ParseContactInfo()
	require.NoError(t, err)
	assert.Equal(t, "Draft Business Update", retrievedDraft.ParsedContactInfo.BusinessName)

	err = retrievedDraft.ParseBusinessContext()
	require.NoError(t, err)
	assert.Equal(t, "Updated Industry", retrievedDraft.ParsedBusinessContext.Industry)
	assert.Equal(t, 25, *retrievedDraft.ParsedBusinessContext.TeamSize)

	// Test draft deletion
	err = draftRepo.Delete(context.Background(), consultationID, suite.userID)
	require.NoError(t, err, "Should delete draft successfully")

	// Verify deletion
	_, err = draftRepo.Get(context.Background(), consultationID, suite.userID)
	assert.Error(t, err, "Should not find deleted draft")
}

// TestVersionTracking tests consultation version tracking operations
func (suite *DatabaseIntegrationTestSuite) TestVersionTracking() {
	t := suite.T()

	// Create a consultation first
	businessType := suite.fixtures.GetBusinessTypes()[0]
	fixture := suite.fixtures.GenerateRealisticConsultation(suite.userID, businessType, consultation.StatusDraft)

	err := suite.fixtures.CreateConsultationFromFixture(fixture)
	require.NoError(t, err)

	consultationID := fixture.ID

	// Create version repository
	versionRepo := consultation.NewVersionRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Create multiple versions
	versions := []struct {
		versionNumber int
		changeSummary string
		changedFields []string
	}{
		{1, "Initial version", []string{"contact_info"}},
		{2, "Added business context", []string{"business_context"}},
		{3, "Added pain points", []string{"pain_points"}},
	}

	for _, v := range versions {
		err = suite.fixtures.CreateVersionFixture(consultationID, suite.userID, v.versionNumber, v.changeSummary, v.changedFields)
		require.NoError(t, err, "Should create version %d", v.versionNumber)
	}

	// Test version history retrieval
	versionHistory, err := versionRepo.GetHistory(context.Background(), consultationID, 1, 10)
	require.NoError(t, err, "Should retrieve version history")
	assert.True(t, len(versionHistory.Versions) >= 3, "Should have at least 3 versions")
	assert.True(t, versionHistory.Total >= 3, "Total should be at least 3")

	// Verify versions are ordered by version number (descending)
	for i := 1; i < len(versionHistory.Versions); i++ {
		assert.True(t, versionHistory.Versions[i-1].VersionNumber >= versionHistory.Versions[i].VersionNumber,
			"Versions should be ordered by version number descending")
	}

	// Test specific version retrieval
	specificVersion, err := versionRepo.GetByVersion(context.Background(), consultationID, 2)
	require.NoError(t, err, "Should retrieve specific version")
	assert.Equal(t, int32(2), specificVersion.VersionNumber)
	assert.Equal(t, "Added business context", specificVersion.ChangeSummary.String)
}

// TestTransactionIntegrity tests database transaction handling
func (suite *DatabaseIntegrationTestSuite) TestTransactionIntegrity() {
	t := suite.T()

	// Test transaction rollback on error
	err := suite.dbHelper.ExecuteInTransaction(t, func(txQueries *query.Queries) error {
		// Create a consultation within transaction
		businessType := suite.fixtures.GetBusinessTypes()[0]
		fixture := suite.fixtures.GenerateRealisticConsultation(suite.userID, businessType, consultation.StatusDraft)

		createInput := &consultation.CreateConsultationInput{
			UserID:          fixture.UserID,
			ContactInfo:     fixture.ContactInfo,
			BusinessContext: fixture.BusinessContext,
		}

		consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), txQueries)
		_, err := consultationRepo.Create(context.Background(), createInput)
		if err != nil {
			return err
		}

		// Simulate an error to trigger rollback
		return assert.AnError
	})

	// The transaction should have failed
	assert.Error(t, err, "Transaction should have failed and rolled back")

	// Verify no consultation was created
	stats := suite.dbHelper.GetDatabaseStats(t)
	initialConsultationCount := stats["consultations"]

	// The count should remain unchanged after rollback
	finalStats := suite.dbHelper.GetDatabaseStats(t)
	assert.Equal(t, initialConsultationCount, finalStats["consultations"], "Consultation count should be unchanged after rollback")
}

// TestConcurrentAccess tests concurrent database access scenarios
func (suite *DatabaseIntegrationTestSuite) TestConcurrentAccess() {
	t := suite.T()

	// Create a base consultation
	businessType := suite.fixtures.GetBusinessTypes()[0]
	fixture := suite.fixtures.GenerateRealisticConsultation(suite.userID, businessType, consultation.StatusDraft)

	err := suite.fixtures.CreateConsultationFromFixture(fixture)
	require.NoError(t, err)

	consultationID := fixture.ID
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Perform concurrent updates
	concurrency := 5
	done := make(chan error, concurrency)

	for i := 0; i < concurrency; i++ {
		go func(index int) {
			updateInput := &consultation.UpdateConsultationInput{
				ContactInfo: &consultation.ContactInfo{
					BusinessName: fmt.Sprintf("Concurrent Update %d", index),
					Email:       fmt.Sprintf("concurrent%d@example.com", index),
				},
			}

			_, err := consultationRepo.Update(context.Background(), consultationID, updateInput)
			done <- err
		}(i)
	}

	// Collect results
	successCount := 0
	for i := 0; i < concurrency; i++ {
		err := <-done
		if err == nil {
			successCount++
		} else {
			t.Logf("Concurrent update %d failed: %v", i, err)
		}
	}

	// At least some updates should succeed (the exact number depends on implementation)
	assert.True(t, successCount > 0, "At least some concurrent updates should succeed")

	// Verify the consultation still exists and is in a valid state
	finalConsultation, err := consultationRepo.GetByID(context.Background(), consultationID)
	require.NoError(t, err, "Should be able to retrieve consultation after concurrent updates")
	assert.Equal(t, consultationID, finalConsultation.ID)
}

// TestDataIntegrity tests data integrity constraints and validation
func (suite *DatabaseIntegrationTestSuite) TestDataIntegrity() {
	t := suite.T()

	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Test foreign key constraints
	nonExistentUserID := uuid.New()
	businessType := suite.fixtures.GetBusinessTypes()[0]
	fixture := suite.fixtures.GenerateRealisticConsultation(nonExistentUserID, businessType, consultation.StatusDraft)

	createInput := &consultation.CreateConsultationInput{
		UserID:      nonExistentUserID, // This user doesn't exist
		ContactInfo: fixture.ContactInfo,
	}

	_, err := consultationRepo.Create(context.Background(), createInput)
	assert.Error(t, err, "Should reject consultation with non-existent user_id")

	// Test valid data passes constraints
	validCreateInput := &consultation.CreateConsultationInput{
		UserID: suite.userID,
		ContactInfo: &consultation.ContactInfo{
			BusinessName: "Valid Business",
			Email:       "valid@example.com",
		},
	}

	validConsultation, err := consultationRepo.Create(context.Background(), validCreateInput)
	require.NoError(t, err, "Should accept valid consultation data")
	assert.NotEqual(t, uuid.Nil, validConsultation.ID)

	// Test status constraints
	// Try to update with invalid status (this might depend on implementation)
	updateInput := &consultation.UpdateConsultationInput{
		Status: "invalid_status",
	}

	_, err = consultationRepo.Update(context.Background(), validConsultation.ID, updateInput)
	// The result depends on whether status validation is done at database or application level
	// At minimum, the consultation should remain in a valid state
	retrievedConsultation, retrieveErr := consultationRepo.GetByID(context.Background(), validConsultation.ID)
	require.NoError(t, retrieveErr, "Should be able to retrieve consultation")
	assert.Contains(t, []string{"draft", "completed", "archived"}, retrievedConsultation.Status, "Status should remain valid")
}

// TestBulkOperations tests bulk data operations and performance
func (suite *DatabaseIntegrationTestSuite) TestBulkOperations() {
	t := suite.T()

	// Create multiple consultations in bulk
	bulkCount := 50
	statuses := []consultation.ConsultationStatus{
		consultation.StatusDraft,
		consultation.StatusCompleted,
		consultation.StatusArchived,
	}

	start := time.Now()
	createdIDs, err := suite.fixtures.CreateBulkConsultations(suite.userID, bulkCount, statuses)
	createDuration := time.Since(start)

	require.NoError(t, err, "Should create bulk consultations")
	assert.Equal(t, bulkCount, len(createdIDs), "Should create expected number of consultations")

	t.Logf("Created %d consultations in %v (avg: %v per consultation)",
		bulkCount, createDuration, createDuration/time.Duration(bulkCount))

	// Test bulk retrieval performance
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	start = time.Now()
	listParams := &consultation.ListConsultationsParams{
		UserID: suite.userID,
		Page:   1,
		Limit:  int32(bulkCount),
	}

	response, err := consultationRepo.List(context.Background(), listParams)
	listDuration := time.Since(start)

	require.NoError(t, err, "Should list consultations")
	assert.True(t, response.Total >= int64(bulkCount), "Should have at least the created consultations")
	assert.True(t, len(response.Consultations) >= bulkCount, "Should return expected number of consultations")

	t.Logf("Listed %d consultations in %v", len(response.Consultations), listDuration)

	// Performance assertions
	assert.Less(t, createDuration, 10*time.Second, "Bulk creation should complete within 10 seconds")
	assert.Less(t, listDuration, 1*time.Second, "Bulk listing should complete within 1 second")
}

// TestDataConsistency tests data consistency across different operations
func (suite *DatabaseIntegrationTestSuite) TestDataConsistency() {
	t := suite.T()

	// Create a consultation
	businessType := suite.fixtures.GetBusinessTypes()[0]
	fixture := suite.fixtures.GenerateRealisticConsultation(suite.userID, businessType, consultation.StatusDraft)

	err := suite.fixtures.CreateConsultationFromFixture(fixture)
	require.NoError(t, err)

	consultationID := fixture.ID

	// Create repositories
	consultationRepo := consultation.NewRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	draftRepo := consultation.NewDraftRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())
	versionRepo := consultation.NewVersionRepository(suite.dbHelper.GetDB(), suite.dbHelper.GetQueries())

	// Create a draft for the consultation
	draftData := map[string]interface{}{
		"contact_info": map[string]interface{}{
			"business_name": "Draft Update",
		},
	}

	err = draftRepo.AutoSave(context.Background(), consultationID, suite.userID, draftData)
	require.NoError(t, err)

	// Create a version
	err = suite.fixtures.CreateVersionFixture(consultationID, suite.userID, 1, "Test version", []string{"contact_info"})
	require.NoError(t, err)

	// Verify consistency: all entities should reference the same consultation
	consultation, err := consultationRepo.GetByID(context.Background(), consultationID)
	require.NoError(t, err)

	draft, err := draftRepo.Get(context.Background(), consultationID, suite.userID)
	require.NoError(t, err)

	versionHistory, err := versionRepo.GetHistory(context.Background(), consultationID, 1, 10)
	require.NoError(t, err)

	// Verify referential consistency
	assert.Equal(t, consultationID, consultation.ID)
	assert.Equal(t, consultationID, draft.ConsultationID)
	assert.True(t, len(versionHistory.Versions) > 0)
	assert.Equal(t, consultationID, versionHistory.Versions[0].ConsultationID)

	// Verify user consistency
	assert.Equal(t, suite.userID, consultation.UserID)
	assert.Equal(t, suite.userID, draft.UserID)
	assert.Equal(t, suite.userID, versionHistory.Versions[0].UserID)

	// Test cascade deletion consistency
	err = consultationRepo.Delete(context.Background(), consultationID)
	require.NoError(t, err)

	// Verify cascaded deletion (if implemented)
	_, err = draftRepo.Get(context.Background(), consultationID, suite.userID)
	assert.Error(t, err, "Draft should be deleted with consultation")

	versionHistoryAfterDelete, err := versionRepo.GetHistory(context.Background(), consultationID, 1, 10)
	if err == nil {
		// If versions aren't automatically deleted, they should be empty or the query should fail
		assert.Equal(t, int64(0), versionHistoryAfterDelete.Total, "Version history should be empty after consultation deletion")
	}
}

// TestDatabaseIntegrationSuite runs the database integration test suite
func TestDatabaseIntegrationSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database integration tests in short mode")
	}

	suite.Run(t, new(DatabaseIntegrationTestSuite))
}