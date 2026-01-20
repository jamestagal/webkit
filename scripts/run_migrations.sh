#!/bin/bash

# Database Migration Runner
# Runs all SQL migrations in order from the migrations/ folder
# All migrations are idempotent (safe to run multiple times)

set -e

# Configuration
MIGRATIONS_DIR="$(dirname "$0")/../migrations"

# Determine environment and set connection details
if [ "$1" = "production" ] || [ "$1" = "prod" ]; then
    echo "Running migrations on PRODUCTION..."
    echo ""
    echo "This will connect via SSH to your VPS and run migrations."
    echo "Make sure you have SSH access configured."
    echo ""
    read -p "Continue? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Aborted."
        exit 1
    fi

    # Production: Run via Docker on VPS
    # Expects VPS_HOST, VPS_USER env vars or defaults
    VPS_HOST="${VPS_HOST:-your-vps-host}"
    VPS_USER="${VPS_USER:-root}"

    echo ""
    echo "Copying migrations to VPS..."
    scp -r "$MIGRATIONS_DIR"/*.sql "$VPS_USER@$VPS_HOST:/tmp/webkit_migrations/"

    echo "Running migrations..."
    ssh "$VPS_USER@$VPS_HOST" 'for f in /tmp/webkit_migrations/*.sql; do echo "Running: $f"; docker exec -i webkit-postgres psql -U webkit -d webkit < "$f"; done'

    echo ""
    echo "Cleaning up..."
    ssh "$VPS_USER@$VPS_HOST" 'rm -rf /tmp/webkit_migrations'

else
    echo "Running migrations on LOCAL development..."
    echo ""

    # Local: Run via Docker Compose
    CONTAINER="webkit-postgres"
    DB_USER="postgres"
    DB_NAME="postgres"

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        echo "Error: Container '$CONTAINER' is not running."
        echo "Start it with: docker compose up -d"
        exit 1
    fi

    # Run each migration in order
    for migration in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            echo "Running: $filename"
            docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$migration"
            echo "  Done."
        fi
    done
fi

echo ""
echo "All migrations completed successfully!"
