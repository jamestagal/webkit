# GoFast's Kubernetes deployment, CI/CD, and infrastructure tooling

GoFast is a **CLI-powered framework** that scaffolds production-ready Go + SvelteKit applications with a complete Kubernetes deployment pipeline, monitoring stack, and database migration system — all triggered from a handful of CLI commands. The framework uses **K3s** (lightweight Kubernetes) with **Traefik** as its ingress controller, deploys via **GitHub Actions** to separate staging and production clusters, and manages database schema changes through **Atlas**. Below is a detailed breakdown of every system the user asked about, based on a comprehensive crawl of gofast.live, docs.gofast.live, and the gofast-live GitHub organization.

## What `gof infra` generates and how the Kubernetes stack works

The `gof infra` command adds two layers to a GoFast project: a **local monitoring stack** for development and **Terraform deployment/monitoring configuration** for production infrastructure. Locally, it provisions **Grafana, Grafana Alloy** (OpenTelemetry collector), **Loki** (logs), **Tempo** (traces), and **Prometheus** (metrics) — all managed through Docker Compose and activated via `make startm` or `make startcm`.

For production Kubernetes, GoFast generates a `kube/` directory containing a comprehensive `setup.sh` script and supporting configuration files. The setup script performs the following on a target server:

- Installs **K3s** (which bundles Traefik as the default ingress controller)
- Installs **Helm** and deploys necessary charts
- Creates Kubernetes secrets from environment variables
- Deploys **PostgreSQL** via the **CloudNativePG** operator with automated backups
- Installs the full monitoring stack: **OpenTelemetry Auto Instrumentation for Go**, **OpenTelemetry Collector**, **VictoriaMetrics** (metrics), **VictoriaLogs** (logs), **Tempo** (distributed tracing), and **Grafana** with pre-configured datasources and dashboards
- Deploys **PubSub** and **CronJob** services
- Deploys **User, Admin, and Client services** with their respective Ingress resources

Key generated files include `kube/setup.sh`, `kube/config/service-user.yaml`, `kube/.env`, `.github/workflows/release.yml`, `.github/workflows/migration.yml`, and `scripts/keys.sh`. The specific Terraform `.tf` files are part of the paid CLI output and not publicly documented, but they handle cloud infrastructure provisioning alongside the Kubernetes configs.

**Important note on `gof mon`:** There is no standalone `gof mon` command in any version of the CLI. Monitoring is entirely handled through `gof infra`, which generates the monitoring stack, and `make startm` / `make startcm`, which activate it locally.

## GitHub Actions CI/CD supports staging via release candidates

GoFast's CI/CD pipeline is built on **two GitHub Actions workflows**: `release.yml` for application deployment and `migration.yml` for database migrations. The deployment model is **release-tag-based**, not branch-based.

**The trigger mechanism works as follows:** creating a GitHub **Release** (e.g., `v1.0.0`) deploys to the `release` environment (production), while creating a **Pre-release** (e.g., `v1.0.0-rc.1`) deploys to the `release-candidate` environment (staging). The pipeline builds Docker images for each service (User, Admin, Client), pushes them to **GitHub Container Registry (GHCR)**, and deploys to the target Kubernetes cluster using the `KUBE_CONFIG` secret stored in the corresponding GitHub environment.

Each GitHub environment (`release` and `release-candidate`) stores its own set of secrets: `KUBE_CONFIG` (pointing to its respective K3s cluster), `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PRIVATE_KEY_PEM`, and `PUBLIC_KEY_PEM`. The staging environment is explicitly described in the docs as a place to "safely test changes in dedicated staging environments before deploying to production."

**GoFast does not use Kubernetes namespace-based isolation** for separating environments within a single cluster. Instead, the documentation instructs users to run the entire `setup.sh` setup guide **twice** — once for production and once for staging — on **separate servers or K3s clusters**. Each environment gets its own complete Kubernetes installation, its own domain set, and its own monitoring stack. This is a separate-cluster-per-environment model, not a shared-cluster-with-namespaces model. There is no documented support for branch-based deployments, canary deployments, or preview environments beyond the release-candidate pattern.

## The `gof add r2` to `gof add s3` rename is confirmed

A direct comparison between Google's cached version of the GoFast CLI README and the live version on the `main` branch confirms that **`gof add r2` was recently renamed to `gof add s3`**. The cached version shows `gof add r2` described as "Add Cloudflare R2 storage," while the current live README shows `gof add s3` described as "Add S3 file storage." This aligns with the user's understanding that v2.17.0 introduced a unified S3-compatible storage interface.

The V1 documentation at `docs.gofast.live/configuration/files` lists five separate storage providers: **Cloudflare R2** (provider code `r2`), **AWS S3** (`s3`), **Google Cloud Storage** (`gcs`), **Azure Blob Storage** (`azblob`), and **Local** (`local`). Each has distinct environment variables and configuration. The V2 CLI's consolidation to a single `gof add s3` command suggests the framework now uses a unified S3-compatible interface, since Cloudflare R2 is natively S3-compatible.

**However, two specific claims could not be verified** from any public source: no evidence was found that **Cloudflare Workers were ever part of GoFast's architecture** (both V1 and V2 have always used Docker containers deployed to Kubernetes), and no documentation mentions **MinIO or Backblaze B2** support. The publicly documented providers remain AWS S3, Cloudflare R2, Google Cloud Storage, Azure Blob Storage, and Local. The v2.17.0 release notes themselves are not publicly accessible — the GitHub releases page exists with 65 total releases but individual release note content could not be fetched.

## Atlas handles migrations with a declarative schema approach

GoFast uses **AtlasGo** (atlasgo.io) for database migrations and **sqlc** (sqlc.dev) for type-safe SQL code generation. Atlas works declaratively, similar to Terraform: you define the desired schema state in `service-core/storage/schema.sql`, and Atlas computes the diff between the current database and the desired state, then generates and applies the necessary migration SQL.

The V2 workflow is streamlined through Make targets. After defining a model with `gof model note title:string content:string`, the developer runs `make sql` (regenerates SQLC queries), `make gen` (regenerates proto code), and `make migrate` (applies database migrations via Atlas). The V1 workflow uses shell scripts directly: `sh scripts/atlas.sh` for migrations and `sh scripts/sqlc.sh` for code generation.

For Kubernetes deployments, database migrations are handled by a **separate GitHub Actions workflow** (`.github/workflows/migration.yml`). This workflow supports both **CloudNativePG** (the default in-cluster PostgreSQL operator) and **Google Cloud SQL** as the target database, with toggle sections that can be commented/uncommented. Atlas maintains migration integrity through `atlas.sum` checksums.

## Hostinger VPS setup and Traefik routing

GoFast's Kubernetes deployment is **VPS-agnostic** — there is no Hostinger-specific documentation, but the `setup.sh` script works on any Linux server with root SSH access. The script installs K3s, which is a lightweight, single-binary Kubernetes distribution ideal for VPS environments. K3s bundles **Traefik v2** as its default ingress controller, so no separate Traefik installation is needed.

**Traefik routing uses host-based subdomain rules.** The documentation requires four subdomains per environment, all pointing to the same server IP:

| Subdomain | Service |
|-----------|---------|
| `user.yourdomain.com` | User Service (Go backend) |
| `admin.yourdomain.com` | Admin Service |
| `client.yourdomain.com` | Client Service (SvelteKit frontend) |
| `grafana.yourdomain.com` | Grafana monitoring dashboard |

For staging vs. production, users configure **different domain sets** pointing to different server IPs (e.g., `user-staging.yourdomain.com` → staging server, `user.yourdomain.com` → production server). IPv6 via AAAA records is also supported. Since GoFast uses K3s's bundled Traefik, the Ingress resources created by `setup.sh` leverage Traefik's IngressRoute CRDs for routing, though the exact IngressRoute YAML templates are part of the paid generated output and not publicly visible.

For a **Hostinger VPS** specifically, the setup would involve: provisioning a VPS with a supported Linux distro (Ubuntu recommended for K3s), ensuring root SSH access, pointing DNS records through Cloudflare to the VPS IP, and running `sh setup.sh` from the `kube/` directory. The process would be repeated on a second VPS for the staging environment.

## Conclusion

GoFast provides a **complete but opinionated** infrastructure pipeline: K3s clusters with Traefik ingress, VictoriaMetrics-based monitoring in production, Atlas-powered declarative migrations, and a release-tag-triggered GitHub Actions CI/CD system. The staging story is functional but follows a **separate-clusters model** rather than namespace-based multi-tenancy — the `release-candidate` Pre-release mechanism gives you a proper staging gate, but there's no built-in support for per-branch preview environments, canary rollouts, or namespace-based dev/staging/prod isolation within a single cluster. The recent `gof add r2` → `gof add s3` rename signals a move toward S3-compatible storage abstraction, though the full scope of v2.17.0 changes remains undocumented publicly. Users wanting more granular environment management (Kubernetes namespaces, branch-based previews, canary deployments) would need to extend GoFast's generated infrastructure templates themselves.