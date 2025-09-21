# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-22-consultation-domain/spec.md

> Created: 2025-09-22
> Version: 1.0.0

## Technical Requirements

### Architecture
- **Service Location:** Extend existing `service-core` with consultation domain
- **Language:** Go with existing GoFast patterns and conventions
- **Database:** PostgreSQL (primary) with SQLite/Turso compatibility
- **API Style:** RESTful HTTP APIs following existing service-core patterns
- **Authentication:** Integrate with existing JWT-based auth system
- **Validation:** JSON schema validation with custom business rules

### Domain Structure
```
app/service-core/
├── domain/consultation/
│   ├── models.go           # Data models and structs
│   ├── repository.go       # Database operations interface
│   ├── service.go          # Business logic implementation
│   ├── handlers.go         # HTTP handlers
│   └── validation.go       # Input validation logic
├── storage/sql/consultation/
│   ├── create.sql         # Insert operations
│   ├── read.sql           # Query operations
│   ├── update.sql         # Update operations
│   └── delete.sql         # Delete operations
```

### Data Models
- **Consultation:** Primary entity with structured JSONB fields
- **ConsultationDraft:** Auto-save functionality for work-in-progress
- **ConsultationVersion:** Change tracking and audit trail
- Use existing GoFast timestamp and UUID patterns

### API Design Patterns
- Follow existing service-core HTTP handler patterns
- Use middleware for authentication, validation, and error handling
- Implement proper HTTP status codes (200, 201, 400, 401, 404, 500)
- JSON request/response with camelCase field naming
- Pagination support for list operations
- Filtering and sorting capabilities

### Error Handling
- Consistent error response format matching existing services
- Input validation with detailed field-level error messages
- Database constraint violation handling
- Proper logging with structured log entries
- Graceful handling of concurrent modification conflicts

### Testing Requirements
- Unit tests for all business logic functions (>90% coverage)
- Integration tests for database operations
- HTTP handler tests with mocked dependencies
- End-to-end API tests with test database
- Performance tests for large consultation datasets

## Approach

### Phase 1: Core Domain Implementation
1. Define data models and database schema
2. Implement repository layer with SQLC-generated queries
3. Create business logic service layer
4. Build HTTP handlers and routing

### Phase 2: Draft and Versioning
1. Implement draft management system
2. Add version tracking capabilities
3. Create auto-save functionality
4. Add conflict resolution logic

### Phase 3: Advanced Features
1. Add filtering and search capabilities
2. Implement bulk operations
3. Add data export functionality
4. Performance optimization

### Database Integration
- Use existing SQLC workflow for type-safe queries
- Follow existing Atlas migration patterns
- Maintain PostgreSQL and SQLite compatibility
- Use existing connection pooling and transaction management

## External Dependencies

### No New Dependencies Required
- Use existing Go standard library packages
- Leverage current database libraries (pgx, sqlite3)
- Utilize existing validation libraries (validator/v10)
- Use current HTTP routing (chi/mux)
- Employ existing testing frameworks (testify)
- Use current logging infrastructure (slog)

### Integration Points
- JWT authentication middleware (existing)
- Database connection management (existing)
- Error handling middleware (existing)
- Request logging and metrics (existing)
- CORS configuration (existing)