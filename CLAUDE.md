# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a microservices application built with:
- **Core Service**: Go backend providing gRPC and REST APIs, database interactions
- **Admin Service**: Go backend with web interface for administration, Server-Sent Events (SSE)
- **Client Service**: SvelteKit frontend application with TypeScript
- **Database**: PostgreSQL (primary), with SQLite/Turso support
- **Message Queue**: NATS for inter-service communication
- **Monitoring**: Grafana and Prometheus integration available

The services communicate via gRPC (internal) and REST APIs (external), with protobuf definitions in `/proto`.

## Development Commands

### Initial Setup
```bash
# Generate JWT keys for authentication
sh scripts/keys.sh

# Compile SQL queries using sqlc (postgres or sqlite)
sh scripts/sqlc.sh [postgres|sqlite]

# Generate protobuf code for gRPC
sh scripts/proto.sh
```

### Running the Application
```bash
# Start all services with Docker Compose
docker compose up --build

# Run database migrations
sh scripts/atlas.sh [postgres|sqlite|turso]
```

### Development Tools
```bash
# Format all frontend code
sh scripts/format.sh

# Client-specific commands (in service-client/)
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run all tests (e2e + unit)
npm run test:unit    # Unit tests only
npm run test:e2e     # End-to-end tests
npm run lint         # Lint and format check
npm run format       # Auto-format code
```

### Service Ports
- Client: http://localhost:3000
- Admin: http://localhost:3001 (HTTP), http://localhost:3002 (SSE)
- Core: http://localhost:4001 (HTTP), localhost:4002 (gRPC)
- PostgreSQL: localhost:5432
- NATS: localhost:8222
- Mailpit: http://localhost:8025 (Web UI), localhost:1025 (SMTP)

## Code Organization

### Backend Services (`/app`)
- **service-core/**: Core business logic, database layer, gRPC/REST APIs
- **service-admin/**: Admin interface, SSE server, gRPC client
- **pkg/**: Shared Go packages and utilities
- Go workspace with shared dependencies via `go.work`

### Frontend (`/service-client`)
- SvelteKit application with TypeScript
- TailwindCSS + DaisyUI for styling
- Vitest for unit testing, Playwright for e2e testing

### Infrastructure
- **proto/**: Protobuf definitions for gRPC services
- **scripts/**: Development automation scripts
- **grafana/**: Monitoring and observability setup
- **kube/**: Kubernetes deployment configurations

## Database Management

The application uses SQLC for type-safe SQL queries and Atlas for schema migrations:
- Schema files: `app/service-core/storage/schema_*.sql`
- Query files: `app/service-core/storage/sql/*.sql`
- Generated code: `app/service-core/storage/query/`

## Key Environment Variables

Authentication, payment providers, email providers, and file storage providers are configurable via environment variables. See `docker-compose.yml` for the complete list of supported providers and configuration options.

## Hot Reload

Both Go services use Air for hot reloading during development (configured via `.air.toml` files).