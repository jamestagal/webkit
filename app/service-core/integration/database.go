package integration

import (
	"database/sql"
	"fmt"
	"os"
	"service-core/storage/query"
	"testing"

	_ "github.com/lib/pq"
	_ "github.com/tursodatabase/go-libsql"
)

// DatabaseTestHelper provides database setup and teardown for integration tests
type DatabaseTestHelper struct {
	db      *sql.DB
	queries *query.Queries
	dbType  string
	testName string
}

// NewDatabaseTestHelper creates a new database test helper
func NewDatabaseTestHelper(t *testing.T, testName string) *DatabaseTestHelper {
	helper := &DatabaseTestHelper{
		testName: testName,
	}

	// Determine which database to use based on environment
	if os.Getenv("USE_POSTGRES") == "true" {
		helper.setupPostgreSQL(t)
	} else {
		helper.setupSQLite(t)
	}

	helper.setupSchema(t)
	helper.queries = query.New(helper.db)

	return helper
}

// setupPostgreSQL initializes a PostgreSQL test database
func (h *DatabaseTestHelper) setupPostgreSQL(t *testing.T) {
	h.dbType = "postgres"

	// Get database URL from environment or use default test database
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:password@localhost:5432/prop_gen_test?sslmode=disable"
	}

	var err error
	h.db, err = sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to PostgreSQL test database: %v", err)
	}

	// Test connection
	err = h.db.Ping()
	if err != nil {
		t.Fatalf("Failed to ping PostgreSQL test database: %v", err)
	}

	t.Logf("Using PostgreSQL test database: %s", dbURL)
}

// setupSQLite initializes an in-memory SQLite database
func (h *DatabaseTestHelper) setupSQLite(t *testing.T) {
	h.dbType = "sqlite"

	var err error
	// Use in-memory database for tests
	h.db, err = sql.Open("libsql", ":memory:")
	if err != nil {
		t.Fatalf("Failed to create SQLite in-memory database: %v", err)
	}

	// Configure SQLite for better performance and consistency
	pragmas := []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA temp_store = MEMORY",
	}

	for _, pragma := range pragmas {
		_, err = h.db.Exec(pragma)
		if err != nil {
			t.Logf("Warning: Failed to set SQLite pragma %s: %v", pragma, err)
		}
	}

	t.Logf("Using SQLite in-memory database for test: %s", h.testName)
}

// setupSchema creates the required database schema
func (h *DatabaseTestHelper) setupSchema(t *testing.T) {
	if h.dbType == "postgres" {
		h.setupPostgreSQLSchema(t)
	} else {
		h.setupSQLiteSchema(t)
	}
}

// setupPostgreSQLSchema creates PostgreSQL-specific schema
func (h *DatabaseTestHelper) setupPostgreSQLSchema(t *testing.T) {
	schemas := []string{
		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)`,

		// Consultations table with JSONB fields
		`CREATE TABLE IF NOT EXISTS consultations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			contact_info JSONB NOT NULL DEFAULT '{}',
			business_context JSONB NOT NULL DEFAULT '{}',
			pain_points JSONB NOT NULL DEFAULT '{}',
			goals_objectives JSONB NOT NULL DEFAULT '{}',
			status VARCHAR(50) NOT NULL DEFAULT 'draft',
			completion_percentage INTEGER DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMP WITH TIME ZONE,
			CONSTRAINT valid_status CHECK (status IN ('draft', 'completed', 'archived')),
			CONSTRAINT valid_completion CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
		)`,

		// Consultation drafts table
		`CREATE TABLE IF NOT EXISTS consultation_drafts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			contact_info JSONB NOT NULL DEFAULT '{}',
			business_context JSONB NOT NULL DEFAULT '{}',
			pain_points JSONB NOT NULL DEFAULT '{}',
			goals_objectives JSONB NOT NULL DEFAULT '{}',
			last_saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			UNIQUE(consultation_id, user_id)
		)`,

		// Consultation versions table
		`CREATE TABLE IF NOT EXISTS consultation_versions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			version_number INTEGER NOT NULL,
			contact_info JSONB NOT NULL DEFAULT '{}',
			business_context JSONB NOT NULL DEFAULT '{}',
			pain_points JSONB NOT NULL DEFAULT '{}',
			goals_objectives JSONB NOT NULL DEFAULT '{}',
			status VARCHAR(50) NOT NULL,
			completion_percentage INTEGER NOT NULL DEFAULT 0,
			change_summary TEXT,
			changed_fields JSONB,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			UNIQUE(consultation_id, version_number)
		)`,
	}

	for _, schema := range schemas {
		_, err := h.db.Exec(schema)
		if err != nil {
			t.Logf("Warning: Failed to create PostgreSQL schema: %v", err)
		}
	}
}

// setupSQLiteSchema creates SQLite-specific schema
func (h *DatabaseTestHelper) setupSQLiteSchema(t *testing.T) {
	schemas := []string{
		// Users table
		`CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,

		// Consultations table with TEXT fields for JSON storage (SQLite compatible)
		`CREATE TABLE consultations (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			contact_info TEXT NOT NULL DEFAULT '{}',
			business_context TEXT NOT NULL DEFAULT '{}',
			pain_points TEXT NOT NULL DEFAULT '{}',
			goals_objectives TEXT NOT NULL DEFAULT '{}',
			status TEXT NOT NULL DEFAULT 'draft',
			completion_percentage INTEGER DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			completed_at TEXT,
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
			CHECK (status IN ('draft', 'completed', 'archived')),
			CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
		)`,

		// Consultation drafts table
		`CREATE TABLE consultation_drafts (
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
			FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
			UNIQUE(consultation_id, user_id)
		)`,

		// Consultation versions table
		`CREATE TABLE consultation_versions (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			version_number INTEGER NOT NULL,
			contact_info TEXT NOT NULL DEFAULT '{}',
			business_context TEXT NOT NULL DEFAULT '{}',
			pain_points TEXT NOT NULL DEFAULT '{}',
			goals_objectives TEXT NOT NULL DEFAULT '{}',
			status TEXT NOT NULL,
			completion_percentage INTEGER NOT NULL DEFAULT 0,
			change_summary TEXT,
			changed_fields TEXT,
			created_at TEXT NOT NULL,
			FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
			UNIQUE(consultation_id, version_number)
		)`,
	}

	for _, schema := range schemas {
		_, err := h.db.Exec(schema)
		if err != nil {
			t.Logf("Warning: Failed to create SQLite schema: %v", err)
		}
	}
}

// GetDB returns the database connection
func (h *DatabaseTestHelper) GetDB() *sql.DB {
	return h.db
}

// GetQueries returns the SQLC queries instance
func (h *DatabaseTestHelper) GetQueries() *query.Queries {
	return h.queries
}

// GetDatabaseType returns the database type (postgres or sqlite)
func (h *DatabaseTestHelper) GetDatabaseType() string {
	return h.dbType
}

// BeginTransaction starts a new database transaction for test isolation
func (h *DatabaseTestHelper) BeginTransaction(t *testing.T) (*sql.Tx, *query.Queries) {
	tx, err := h.db.Begin()
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}

	txQueries := h.queries.WithTx(tx)
	return tx, txQueries
}

// RollbackTransaction rolls back a test transaction
func (h *DatabaseTestHelper) RollbackTransaction(t *testing.T, tx *sql.Tx) {
	err := tx.Rollback()
	if err != nil {
		t.Logf("Warning: Failed to rollback transaction: %v", err)
	}
}

// CommitTransaction commits a test transaction (rarely needed in tests)
func (h *DatabaseTestHelper) CommitTransaction(t *testing.T, tx *sql.Tx) {
	err := tx.Commit()
	if err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}
}

// CleanupDatabase removes all test data and closes the connection
func (h *DatabaseTestHelper) CleanupDatabase(t *testing.T) {
	if h.db != nil {
		// Clean up all tables in dependency order
		tables := []string{"consultation_versions", "consultation_drafts", "consultations", "users"}

		for _, table := range tables {
			_, err := h.db.Exec(fmt.Sprintf("DELETE FROM %s", table))
			if err != nil {
				t.Logf("Warning: Failed to cleanup table %s: %v", table, err)
			}
		}

		err := h.db.Close()
		if err != nil {
			t.Logf("Warning: Failed to close database: %v", err)
		}
	}
}

// ExecuteInTransaction executes a function within a database transaction
func (h *DatabaseTestHelper) ExecuteInTransaction(t *testing.T, fn func(*query.Queries) error) error {
	tx, txQueries := h.BeginTransaction(t)
	defer h.RollbackTransaction(t, tx)

	err := fn(txQueries)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetTableRowCount returns the number of rows in a table
func (h *DatabaseTestHelper) GetTableRowCount(t *testing.T, tableName string) int {
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)

	err := h.db.QueryRow(query).Scan(&count)
	if err != nil {
		t.Logf("Warning: Failed to get row count for table %s: %v", tableName, err)
		return 0
	}

	return count
}

// VerifyTableExists checks if a table exists in the database
func (h *DatabaseTestHelper) VerifyTableExists(t *testing.T, tableName string) bool {
	var exists bool

	if h.dbType == "postgres" {
		query := `SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = $1
		)`
		err := h.db.QueryRow(query, tableName).Scan(&exists)
		if err != nil {
			t.Logf("Warning: Failed to check table existence in PostgreSQL: %v", err)
			return false
		}
	} else {
		query := `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name = ?`
		err := h.db.QueryRow(query, tableName).Scan(&exists)
		if err != nil {
			t.Logf("Warning: Failed to check table existence in SQLite: %v", err)
			return false
		}
	}

	return exists
}

// VerifyIndexExists checks if an index exists in the database
func (h *DatabaseTestHelper) VerifyIndexExists(t *testing.T, indexName string) bool {
	var exists bool

	if h.dbType == "postgres" {
		query := `SELECT EXISTS (
			SELECT FROM pg_indexes
			WHERE schemaname = 'public'
			AND indexname = $1
		)`
		err := h.db.QueryRow(query, indexName).Scan(&exists)
		if err != nil {
			// Index might not exist, which is okay for testing
			return false
		}
	} else {
		query := `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='index' AND name = ?`
		err := h.db.QueryRow(query, indexName).Scan(&exists)
		if err != nil {
			// Index might not exist, which is okay for testing
			return false
		}
	}

	return exists
}

// GetDatabaseStats returns basic database statistics
func (h *DatabaseTestHelper) GetDatabaseStats(t *testing.T) map[string]int {
	stats := make(map[string]int)

	tables := []string{"users", "consultations", "consultation_drafts", "consultation_versions"}
	for _, table := range tables {
		stats[table] = h.GetTableRowCount(t, table)
	}

	return stats
}

// TestDatabaseConnectivity performs a basic connectivity test
func (h *DatabaseTestHelper) TestDatabaseConnectivity(t *testing.T) {
	// Test basic connectivity
	err := h.db.Ping()
	if err != nil {
		t.Fatalf("Database connectivity test failed: %v", err)
	}

	// Test query execution
	var result int
	err = h.db.QueryRow("SELECT 1").Scan(&result)
	if err != nil {
		t.Fatalf("Database query test failed: %v", err)
	}

	if result != 1 {
		t.Fatalf("Database query returned unexpected result: %d", result)
	}

	t.Logf("Database connectivity test passed for %s", h.dbType)
}