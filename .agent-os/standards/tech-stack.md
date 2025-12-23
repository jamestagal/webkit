# Tech Stack

## Context

Global tech stack defaults for Agent OS projects, overridable in project-specific `.agent-os/product/tech-stack.md`.

## Application Framework

- **Architecture:** Microservices with Go backend services
- **Service-Core:** Go with gRPC and REST APIs for business logic
- **Service-Admin:** Go with web interface and Server-Sent Events (SSE)
- **Service-Client:** SvelteKit 5 frontend application

## Database

- **Primary Database:** PostgreSQL
- **Alternative Support:** SQLite/Turso for lightweight deployments
- **Query Builder:** SQLC for type-safe SQL queries
- **Migrations:** Atlas for database schema management

## JavaScript

- **Framework:** SvelteKit 5 with Svelte 5 runes
- **Language:** TypeScript for type safety
- **State Management:** Svelte 5 native reactivity system
- **Client-Server Communication:** Remote Functions (SvelteKit 2.27+) with type-safe query/form/command patterns
- **Validation:** Zod for schema validation (zod/mini for smaller bundles)
- **HTTP Client:** Native fetch with typed API clients

## CSS Framework

- **Framework:** Tailwind CSS for utility-first styling
- **Component Library:** DaisyUI for pre-built components
- **Icons:** Lucide Svelte icon library

## Authentication & Security

- **Authentication:** JWT tokens with jose library
- **Authorization:** Role-based access control (RBAC)
- **Security:** CORS, rate limiting, input validation

## External Integrations

- **Website Analysis:** PageSpeed Insights API for performance audits
- **File Storage:** Provider pattern supporting R2, S3, GCS, Azure Blob
- **Email:** Provider pattern for various email services
- **Payment Processing:** Configurable payment provider integration

## Message Queue & Communication

- **Message Queue:** NATS for inter-service communication
- **Inter-Service:** gRPC for internal service communication
- **External APIs:** REST for client-facing endpoints
- **Real-time:** Server-Sent Events (SSE) for live updates

## Development & Deployment

- **Containerization:** Docker with Docker Compose for local development
- **Hot Reload:** Air for Go services development
- **Orchestration:** Kubernetes configurations available
- **Environment Management:** Multi-environment configuration support

## Testing

- **Unit Testing:** Vitest for JavaScript/TypeScript
- **Integration Testing:** Go testing package for backend
- **End-to-End Testing:** Playwright for full application testing
- **API Testing:** Built-in testing for gRPC and REST endpoints

## Monitoring & Observability

- **Metrics:** Prometheus integration
- **Visualization:** Grafana dashboards
- **Logging:** Structured logging across all services
- **Health Checks:** Service health monitoring endpoints

## Development Tools

- **Code Generation:** Protobuf for gRPC service definitions
- **Linting:** ESLint for JavaScript/TypeScript, golangci-lint for Go
- **Formatting:** Prettier for frontend, gofmt for Go
- **Package Management:** npm for frontend, Go modules for backend

## SvelteKit-Specific Patterns

- **Remote Functions:** Enabled via `kit.experimental.remoteFunctions: true`
- **Async Components:** Enabled via `compilerOptions.experimental.async: true`
- **Data Fetching:** query/query.batch for reads, form/command for mutations
- **Progressive Enhancement:** Forms work without JavaScript via form actions
- **Type Safety:** End-to-end type safety with Zod schemas and inferred types