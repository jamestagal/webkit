# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-22-consultation-domain/spec.md

> Created: 2025-09-22
> Status: Ready for Implementation

## Tasks

The following tasks follow a Test-Driven Development (TDD) approach, with each major task beginning with test creation and ending with test verification. Tasks are organized by technical dependencies and implementation order.

## 1. Database Schema and Models

**Objective**: Establish the database foundation with proper schema, migrations, and Go models for the consultation domain.

### 1.1 Write database schema tests
- Create test files for Atlas migration validation
- Write tests to verify table creation with correct columns and constraints
- Add tests for index creation and query performance
- Test PostgreSQL and SQLite compatibility

### 1.2 Create Atlas migration files
- Create `app/service-core/storage/schema_consultation.sql` with consultations table
- Create `app/service-core/storage/schema_consultation_drafts.sql` for draft functionality
- Create `app/service-core/storage/schema_consultation_versions.sql` for version tracking
- Ensure JSONB fields for flexible data structure (PostgreSQL) with TEXT fallback (SQLite)
- Add proper indexes for performance: user_id, status, created_at, updated_at

### 1.3 Define Go data models
- Create `app/service-core/domain/consultation/model.go` with Consultation struct
- Add ConsultationDraft struct with auto-save metadata
- Add ConsultationVersion struct with change tracking fields
- Include proper JSON tags, validation tags, and database tags
- Add completion percentage calculation method

### 1.4 Write SQLC query files
- Create `app/service-core/storage/sql/consultation.sql` with CRUD operations
- Add queries for filtering by status, user, date range
- Include pagination queries with LIMIT/OFFSET
- Add draft management queries (save, retrieve, promote)
- Create version tracking queries (create version, get history)

### 1.5 Generate SQLC code
- Run `sh scripts/sqlc.sh postgres` to generate type-safe query functions
- Verify generated code in `app/service-core/storage/query/`
- Test generated functions with mock data
- Ensure proper error handling in generated code

### 1.6 Verify database tests pass
- Run Atlas migrations against test database
- Execute SQLC-generated queries in integration tests
- Verify table structures match specifications
- Confirm index performance with EXPLAIN queries

## 2. Repository Layer Implementation

**Objective**: Implement the data access layer with comprehensive CRUD operations, draft management, and version tracking.

### 2.1 Write repository interface tests
- Create `app/service-core/domain/consultation/repository_test.go`
- Write unit tests for all CRUD operations using testify/mock
- Add tests for filtering, pagination, and sorting
- Test error handling scenarios (not found, constraint violations)
- Write tests for concurrent access scenarios

### 2.2 Create repository interfaces
- Define `ConsultationRepository` interface in `app/service-core/domain/consultation/repository.go`
- Add `ConsultationDraftRepository` interface for draft operations
- Include `ConsultationVersionRepository` interface for version tracking
- Define method signatures for all CRUD and business operations

### 2.3 Write repository implementation tests
- Create integration tests using test database
- Test transaction handling for complex operations
- Verify proper SQL query execution
- Test database constraint enforcement

### 2.4 Implement repository structs
- Create concrete implementations for all repository interfaces
- Implement transaction management for atomic operations
- Add proper error wrapping and context handling
- Include logging for database operations

### 2.5 Add draft management repository
- Implement auto-save functionality with configurable intervals
- Add draft cleanup for abandoned sessions
- Implement draft-to-consultation promotion logic
- Handle concurrent draft modifications

### 2.6 Add version tracking repository
- Implement automatic version creation on consultation updates
- Add change detection logic to avoid empty versions
- Implement version history retrieval with pagination
- Add rollback functionality for reverting changes

### 2.7 Verify repository tests pass
- Run all unit tests with proper mocking
- Execute integration tests against real database
- Verify transaction rollback on errors
- Confirm performance with large datasets

## 3. Business Logic Service Layer

**Objective**: Implement the core business logic with validation, status management, and consultation lifecycle handling.

### 3.1 Write service layer tests
- Create `app/service-core/domain/consultation/service_test.go`
- Write unit tests for all business logic methods
- Test validation rules for consultation data
- Add tests for status transitions and business rules
- Test concurrent modification handling

### 3.2 Create consultation service interface
- Define `ConsultationService` interface with business methods
- Add methods for consultation lifecycle management
- Include draft management and auto-save methods
- Define version tracking and change management methods

### 3.3 Write validation tests
- Create `app/service-core/domain/consultation/validator_test.go`
- Test all field validation rules
- Add tests for business rule validation
- Test custom validation for industry-specific requirements

### 3.4 Implement validator
- Create `app/service-core/domain/consultation/validator.go`
- Implement field-level validation using validator/v10
- Add custom validation functions for business rules
- Include cross-field validation logic

### 3.5 Write business logic implementation tests
- Test consultation creation with all validation
- Test update operations with version tracking
- Test status management and transitions
- Test completion percentage calculations

### 3.6 Implement consultation service
- Create concrete service implementation
- Add consultation creation with validation
- Implement update operations with automatic versioning
- Add status management and lifecycle methods
- Include completion percentage calculation logic

### 3.7 Add draft management service
- Implement auto-save with configurable intervals
- Add conflict resolution for simultaneous edits
- Implement draft validation and cleanup
- Add draft-to-consultation conversion with validation

### 3.8 Verify service tests pass
- Run all business logic unit tests
- Test service integration with repository layer
- Verify validation error handling
- Confirm proper status transitions

## 4. HTTP API Layer Implementation

**Objective**: Create RESTful API endpoints with proper request/response handling, authentication, and comprehensive error management.

### 4.1 Write HTTP handler tests
- Create test files for all HTTP endpoints
- Test request validation and response serialization
- Add tests for authentication and authorization
- Test error handling and proper HTTP status codes
- Include tests for request/response middleware

### 4.2 Create HTTP handler interfaces
- Define handler interfaces following GoFast patterns
- Plan REST endpoint structure (/consultations, /drafts, /versions)
- Define request/response DTOs for API serialization
- Plan authentication and authorization middleware integration

### 4.3 Write API endpoint tests
- Test all CRUD endpoints with various scenarios
- Test filtering, pagination, and sorting parameters
- Add tests for draft endpoints (save, retrieve, promote)
- Test version history endpoints
- Include authentication and rate limiting tests

### 4.4 Implement consultation handlers
- Create `app/service-core/http/consultation_handler.go`
- Implement all CRUD endpoints with proper validation
- Add filtering and pagination support
- Include comprehensive error handling
- Add request/response logging

### 4.5 Implement draft handlers
- Create endpoints for draft operations
- Add auto-save endpoint with conflict detection
- Implement draft-to-consultation promotion endpoint
- Include draft cleanup and management endpoints

### 4.6 Implement version handlers
- Create endpoints for version history
- Add version comparison functionality
- Implement rollback endpoints
- Include change tracking display

### 4.7 Add middleware and routing
- Integrate authentication middleware
- Add validation middleware for request validation
- Include rate limiting middleware
- Set up routing in main HTTP server
- Add CORS handling if needed

### 4.8 Verify API tests pass
- Run all HTTP endpoint tests
- Test API integration with service layer
- Verify proper error responses and status codes
- Confirm authentication and authorization work correctly

## 5. Testing and Documentation

**Objective**: Ensure comprehensive test coverage, create integration tests, and provide complete API documentation.

### 5.1 Write comprehensive unit tests
- Achieve minimum 90% code coverage across all layers
- Add edge case tests for error scenarios
- Include performance tests for critical operations
- Test concurrent access and race conditions

### 5.2 Create integration tests
- Write full-stack integration tests using test database
- Test complete consultation lifecycle flows
- Add tests for draft functionality with timing
- Test version tracking across multiple operations
- Include authentication integration tests

### 5.3 Add end-to-end API tests
- Create comprehensive API test suite
- Test real request/response cycles
- Include authentication flows
- Test error scenarios and edge cases
- Add performance benchmarks

### 5.4 Write API documentation
- Document all endpoints with request/response examples
- Include authentication requirements
- Add error response documentation
- Create OpenAPI/Swagger specifications
- Include usage examples and common workflows

### 5.5 Add monitoring and observability
- Implement structured logging for all operations
- Add metrics for consultation creation/completion rates
- Include performance monitoring for critical operations
- Add health check endpoints

### 5.6 Create deployment documentation
- Update Docker Compose configuration
- Document environment variables
- Include migration execution instructions
- Add deployment verification steps

### 5.7 Verify all tests pass
- Run complete test suite (unit + integration + e2e)
- Verify test coverage meets requirements
- Confirm performance benchmarks
- Validate deployment in development environment

---

## Technical Dependencies

- **Task 1** must complete before Tasks 2-5 (database foundation required)
- **Task 2** must complete before Tasks 3-4 (data layer required for business logic)
- **Task 3** must complete before Task 4 (business logic required for HTTP layer)
- **Task 5** can run parallel to Tasks 2-4 for unit tests, but integration tests require completed implementation

## Implementation Notes

- Follow existing GoFast patterns in `/app/service-core/domain/` structure
- Use SQLC for type-safe database queries
- Integrate with existing JWT authentication system
- Maintain PostgreSQL/SQLite/Turso compatibility
- Use testify for testing framework
- Follow Go best practices for error handling and logging