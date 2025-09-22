package storage_test

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"app/pkg/testing/testdb"
)

// TestConsultationTableSchema tests that the consultations table is created with correct structure
func TestConsultationTableSchema(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test table exists
	rows, err := db.Query(`
		SELECT name FROM sqlite_master
		WHERE type='table' AND name='consultations'
	`)
	require.NoError(t, err)
	defer rows.Close()

	assert.True(t, rows.Next(), "consultations table should exist")

	// Test table structure
	columns, err := db.Query("PRAGMA table_info(consultations)")
	require.NoError(t, err)
	defer columns.Close()

	expectedColumns := map[string]struct {
		dataType string
		notNull  bool
	}{
		"id":                {"TEXT", true},
		"user_id":           {"TEXT", true},
		"business_name":     {"TEXT", true},
		"contact_name":      {"TEXT", true},
		"contact_title":     {"TEXT", false},
		"email":             {"TEXT", true},
		"phone":             {"TEXT", false},
		"website":           {"TEXT", false},
		"preferred_contact": {"TEXT", false},
		"industry":          {"TEXT", true},
		"location":          {"TEXT", true},
		"years_in_business": {"INTEGER", false},
		"team_size":         {"INTEGER", false},
		"monthly_traffic":   {"INTEGER", false},
		"current_platform":  {"TEXT", false},
		"business_data":     {"TEXT", true},
		"challenges":        {"TEXT", true},
		"goals":             {"TEXT", true},
		"budget":            {"TEXT", true},
		"consultation_date": {"DATETIME", false},
		"duration_minutes":  {"INTEGER", false},
		"sales_rep":         {"TEXT", false},
		"notes":             {"TEXT", false},
		"next_steps":        {"TEXT", false},
		"commitment_level":  {"TEXT", false},
		"status":            {"TEXT", true},
		"created":           {"DATETIME", false},
		"updated":           {"DATETIME", false},
	}

	actualColumns := make(map[string]struct {
		dataType string
		notNull  bool
	})

	for columns.Next() {
		var cid int
		var name, dataType string
		var notNull, pk int
		var defaultValue sql.NullString

		err := columns.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk)
		require.NoError(t, err)

		actualColumns[name] = struct {
			dataType string
			notNull  bool
		}{
			dataType: dataType,
			notNull:  notNull == 1,
		}
	}

	// Verify all expected columns exist with correct types
	for colName, expected := range expectedColumns {
		actual, exists := actualColumns[colName]
		assert.True(t, exists, "Column %s should exist", colName)
		if exists {
			assert.Equal(t, expected.dataType, actual.dataType, "Column %s should have type %s", colName, expected.dataType)
			assert.Equal(t, expected.notNull, actual.notNull, "Column %s notNull constraint should be %v", colName, expected.notNull)
		}
	}
}

// TestConsultationDraftsTableSchema tests the consultation_drafts table structure
func TestConsultationDraftsTableSchema(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test table exists
	rows, err := db.Query(`
		SELECT name FROM sqlite_master
		WHERE type='table' AND name='consultation_drafts'
	`)
	require.NoError(t, err)
	defer rows.Close()

	assert.True(t, rows.Next(), "consultation_drafts table should exist")

	// Test unique constraint on consultation_id, user_id
	_, err = db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO consultation_drafts (id, consultation_id, user_id, draft_data)
		VALUES ('draft1', 'consultation1', 'user1', '{}')
	`)
	require.NoError(t, err)

	// This should fail due to unique constraint
	_, err = db.Exec(`
		INSERT INTO consultation_drafts (id, consultation_id, user_id, draft_data)
		VALUES ('draft2', 'consultation1', 'user1', '{}')
	`)
	assert.Error(t, err, "Should fail due to unique constraint on consultation_id, user_id")
}

// TestConsultationVersionsTableSchema tests the consultation_versions table structure
func TestConsultationVersionsTableSchema(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test table exists
	rows, err := db.Query(`
		SELECT name FROM sqlite_master
		WHERE type='table' AND name='consultation_versions'
	`)
	require.NoError(t, err)
	defer rows.Close()

	assert.True(t, rows.Next(), "consultation_versions table should exist")

	// Test unique constraint on consultation_id, version_number
	_, err = db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO consultation_versions (id, consultation_id, user_id, version_number, version_data)
		VALUES ('version1', 'consultation1', 'user1', 1, '{}')
	`)
	require.NoError(t, err)

	// This should fail due to unique constraint
	_, err = db.Exec(`
		INSERT INTO consultation_versions (id, consultation_id, user_id, version_number, version_data)
		VALUES ('version2', 'consultation1', 'user1', 1, '{}')
	`)
	assert.Error(t, err, "Should fail due to unique constraint on consultation_id, version_number")
}

// TestDatabaseIndexes tests that required indexes are created
func TestDatabaseIndexes(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	expectedIndexes := []string{
		"idx_consultations_user_id",
		"idx_consultations_status",
		"idx_consultations_created",
		"idx_consultation_drafts_consultation_id",
		"idx_consultation_drafts_user_id",
		"idx_consultation_versions_consultation_id",
		"idx_consultation_versions_user_id",
	}

	for _, indexName := range expectedIndexes {
		rows, err := db.Query(`
			SELECT name FROM sqlite_master
			WHERE type='index' AND name=?
		`, indexName)
		require.NoError(t, err)
		defer rows.Close()

		assert.True(t, rows.Next(), "Index %s should exist", indexName)
	}
}

// TestForeignKeyConstraints tests that foreign key relationships work correctly
func TestForeignKeyConstraints(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test consultation foreign key to users
	_, err := db.Exec(`
		INSERT INTO consultations (
			id, user_id, business_name, contact_name, email, industry, location,
			business_data, challenges, goals, budget
		) VALUES (
			'consultation1', 'nonexistent_user', 'Test Co', 'John Doe', 'john@test.com',
			'tech', 'SF', '{}', '{}', '{}', '{}'
		)
	`)
	assert.Error(t, err, "Should fail due to foreign key constraint on user_id")

	// Create valid user first
	_, err = db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Now consultation should work
	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, business_name, contact_name, email, industry, location,
			business_data, challenges, goals, budget
		) VALUES (
			'consultation1', 'user1', 'Test Co', 'John Doe', 'john@test.com',
			'tech', 'SF', '{}', '{}', '{}', '{}'
		)
	`)
	assert.NoError(t, err)
}

// TestDefaultValues tests that default values are set correctly
func TestDefaultValues(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Create user
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Insert consultation with minimal required fields
	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, business_name, contact_name, email, industry, location
		) VALUES (
			'consultation1', 'user1', 'Test Co', 'John Doe', 'john@test.com', 'tech', 'SF'
		)
	`)
	require.NoError(t, err)

	// Check default values
	var status, businessData, challenges, goals, budget string
	var created, updated sql.NullString

	err = db.QueryRow(`
		SELECT status, business_data, challenges, goals, budget, created, updated
		FROM consultations WHERE id = 'consultation1'
	`).Scan(&status, &businessData, &challenges, &goals, &budget, &created, &updated)
	require.NoError(t, err)

	assert.Equal(t, "scheduled", status, "Default status should be 'scheduled'")
	assert.Equal(t, "{}", businessData, "Default business_data should be '{}'")
	assert.Equal(t, "{}", challenges, "Default challenges should be '{}'")
	assert.Equal(t, "{}", goals, "Default goals should be '{}'")
	assert.Equal(t, "{}", budget, "Default budget should be '{}'")
	assert.True(t, created.Valid, "Created timestamp should be set")
	assert.True(t, updated.Valid, "Updated timestamp should be set")
}

// TestJSONFieldsValidation tests that JSON fields can store and retrieve valid JSON
func TestJSONFieldsValidation(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Create user
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Test complex JSON data
	businessData := `{"teamSize": 10, "currentPlatform": "wordpress", "revenue": 500000}`
	challenges := `{"primary": ["slow website", "low conversions"], "secondary": ["mobile issues"]}`
	goals := `{"primaryGoal": "increase conversions", "timeline": "6 months", "metrics": {"conversion_rate": 5.5}}`
	budget := `{"range": {"min": 5000, "max": 15000}, "flexibility": "moderate"}`

	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, business_name, contact_name, email, industry, location,
			business_data, challenges, goals, budget
		) VALUES (
			'consultation1', 'user1', 'Test Co', 'John Doe', 'john@test.com', 'tech', 'SF',
			?, ?, ?, ?
		)
	`, businessData, challenges, goals, budget)
	require.NoError(t, err)

	// Retrieve and verify JSON data
	var retrievedBusinessData, retrievedChallenges, retrievedGoals, retrievedBudget string
	err = db.QueryRow(`
		SELECT business_data, challenges, goals, budget
		FROM consultations WHERE id = 'consultation1'
	`).Scan(&retrievedBusinessData, &retrievedChallenges, &retrievedGoals, &retrievedBudget)
	require.NoError(t, err)

	assert.Equal(t, businessData, retrievedBusinessData, "Business data should be preserved")
	assert.Equal(t, challenges, retrievedChallenges, "Challenges should be preserved")
	assert.Equal(t, goals, retrievedGoals, "Goals should be preserved")
	assert.Equal(t, budget, retrievedBudget, "Budget should be preserved")
}

// TestQueryPerformance tests basic query performance with indexes
func TestQueryPerformance(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Create user
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Insert multiple consultations for performance testing
	for i := 0; i < 100; i++ {
		status := "scheduled"
		if i%3 == 0 {
			status = "completed"
		} else if i%3 == 1 {
			status = "in_progress"
		}

		_, err = db.Exec(`
			INSERT INTO consultations (
				id, user_id, business_name, contact_name, email, industry, location,
				business_data, challenges, goals, budget, status
			) VALUES (
				?, 'user1', ?, 'Contact', ?, 'tech', 'SF',
				'{}', '{}', '{}', '{}', ?
			)
		`, fmt.Sprintf("consultation_%d", i), fmt.Sprintf("Company %d", i),
		   fmt.Sprintf("contact%d@test.com", i), status)
		require.NoError(t, err)
	}

	// Test query by user_id (should use index)
	rows, err := db.Query(`
		SELECT id, business_name FROM consultations
		WHERE user_id = 'user1'
		ORDER BY created DESC LIMIT 10
	`)
	require.NoError(t, err)
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
	}
	assert.Equal(t, 10, count, "Should return 10 consultations")

	// Test query by status (should use index)
	rows, err = db.Query(`
		SELECT id, business_name FROM consultations
		WHERE status = 'completed'
	`)
	require.NoError(t, err)
	defer rows.Close()

	completedCount := 0
	for rows.Next() {
		completedCount++
	}
	assert.Greater(t, completedCount, 0, "Should return some completed consultations")

	// Test combined query (user_id + status)
	rows, err = db.Query(`
		SELECT id, business_name FROM consultations
		WHERE user_id = 'user1' AND status = 'scheduled'
		ORDER BY created DESC
	`)
	require.NoError(t, err)
	defer rows.Close()

	scheduledCount := 0
	for rows.Next() {
		scheduledCount++
	}
	assert.Greater(t, scheduledCount, 0, "Should return some scheduled consultations")
}