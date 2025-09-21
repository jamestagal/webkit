# GoFast Project Tech Stack

## Context
Tech stack configuration for GoFast microservices architecture projects with Go backend and SvelteKit frontend.

## Backend Services

### Core Service (Go)
- Language: Go 1.21+
- Architecture: Microservices with Domain-Driven Design
- API: gRPC (internal) + REST (external)
- Database: PostgreSQL 15+ (primary)
- Database Alt: SQLite/Turso for edge deployments
- ORM: sqlc for type-safe queries
- Migrations: golang-migrate
- Validation: go-playground/validator
- Testing: testify + mock interfaces

### Admin Service (Go + HTMX)
- Framework: Go standard library + HTMX
- Templates: Go html/template
- Real-time: Server-Sent Events (SSE)
- Communication: gRPC client to Core Service
- UI Library: HTMX for interactivity
- CSS Framework: TailwindCSS (via CDN)

## Frontend (Client Service)

### SvelteKit Application
- Framework: SvelteKit 2.x (latest stable)
- Language: TypeScript 5.x
- Svelte Version: Svelte 5 with runes
- Package Manager: npm
- Build Tool: Vite 5.x
- Node Version: 20 LTS

### Styling & UI
- CSS Framework: TailwindCSS 3.4+
- Component Library: DaisyUI
- Icons: Lucide Svelte
- Fonts: Self-hosted variable fonts
- Design System: Custom design tokens

## Infrastructure

### Database
- Primary: PostgreSQL 15+
- Hosting: DigitalOcean Managed PostgreSQL / Supabase
- Connection Pooling: PgBouncer
- Backup Strategy: Daily automated backups
- Migration Tool: golang-migrate

### Inter-Service Communication
- Protocol: gRPC for service-to-service
- Message Broker: NATS for event streaming
- API Gateway: Kong or Traefik
- Service Discovery: Consul (optional)

### Authentication & Security
- JWT: RSA public/private key pairs
- Session Storage: Redis
- Rate Limiting: Per-service implementation
- CORS: Configured per service
- API Keys: For external integrations

### File Storage
- Provider Pattern Supporting:
  - Cloudflare R2 (primary)
  - AWS S3
  - Google Cloud Storage
  - Azure Blob Storage
- CDN: Cloudflare CDN for assets

### Email Services
- Provider Pattern Supporting:
  - SendGrid
  - AWS SES
  - Postmark
  - Resend

## Development & Testing

### Development Tools
- Go Tools: golangci-lint, gofmt, go vet
- API Testing: Postman/Insomnia
- Database GUI: TablePlus/DBeaver
- Git Hooks: pre-commit hooks
- Documentation: Swagger/OpenAPI

### Testing Strategy
- Unit Tests: Go testing package + testify
- Integration Tests: dockertest for database
- E2E Tests: Playwright for frontend
- Load Testing: k6 or vegeta
- Coverage Target: 80% minimum

## Deployment

### Containerization
- Docker: Multi-stage builds
- Docker Compose: Local development
- Orchestration: Kubernetes (optional)
- Registry: Docker Hub / GitHub Container Registry

### Hosting Options
- Backend Services: DigitalOcean App Platform / Droplets
- Frontend: Vercel / Netlify / Cloudflare Pages
- Database: DigitalOcean Managed DB / Supabase
- Redis: DigitalOcean Managed Redis

### CI/CD Pipeline
- Platform: GitHub Actions
- Build: Docker multi-stage builds
- Testing: Run full test suite
- Security: Vulnerability scanning
- Deployment: Blue-green deployment

## Monitoring & Observability

### Application Monitoring
- APM: New Relic / DataDog
- Error Tracking: Sentry
- Logging: Structured logging with zerolog
- Log Aggregation: ELK Stack / CloudWatch

### Infrastructure Monitoring
- Metrics: Prometheus + Grafana
- Uptime: Better Uptime / Pingdom
- Alerts: PagerDuty integration

## API Design Standards

### REST API Conventions
- Versioning: URL path (/api/v1)
- Response Format: JSON with envelope
- Status Codes: Proper HTTP status codes
- Pagination: Cursor-based pagination
- Filtering: Query parameters

### gRPC Standards
- Proto Version: proto3
- Service Naming: PascalCase
- Method Naming: PascalCase
- Error Handling: Status codes with details

## Code Organization

### Go Service Structure
```
service-name/
├── cmd/              # Entry points
├── config/           # Configuration
├── domain/           # Business logic
│   └── entity/      # Domain entities
├── grpc/            # gRPC handlers
├── rest/            # REST handlers
├── storage/         # Database repositories
├── pkg/             # Shared packages
└── migrations/      # Database migrations
```

### SvelteKit Structure
```
src/
├── routes/          # File-based routing
├── lib/
│   ├── components/  # UI components
│   ├── stores/      # State management
│   ├── api/        # API client
│   └── utils/      # Utilities
└── app.html        # App template
```

## Performance Targets

### Backend Services
- Response Time: < 100ms p95
- Throughput: 10,000 req/s per service
- Database Query: < 50ms average
- gRPC Latency: < 20ms internal

### Frontend Application
- Lighthouse Score: 95+
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Bundle Size: < 200KB initial

## Security Requirements

### API Security
- TLS 1.3 for all communications
- API rate limiting per endpoint
- Input validation on all endpoints
- SQL injection prevention via sqlc
- XSS protection headers

### Authentication
- JWT expiration: 15 minutes (access)
- Refresh tokens: 7 days
- Password policy: 12+ chars, complexity
- MFA: TOTP support
- Session management: Redis-based
