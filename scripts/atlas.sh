#!/bin/bash

cd "$(dirname "$0")"
cd ../app/service-core/storage

DB_TYPE=${1:-postgres}

echo "Applying schema for $DB_TYPE..."

case $DB_TYPE in
  postgres)
    atlas schema apply -u "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable" -f ./schema_postgres.sql --dev-url "docker://postgres/15/dev"
    ;;
  sqlite)
    # we need sudo to run atlas with sqlite, permissions issue
    sudo atlas schema apply -u "sqlite://data.db" -f schema_sqlite.sql --dev-url "sqlite://dev?mode=memory"
    ;;
  turso)
    atlas schema apply -u "${TURSO_URL}?authToken=${TURSO_TOKEN}" -f ./schema_sqlite.sql --dev-url "sqlite://dev?mode=memory"
    ;;
  *)
    echo "Invalid database type: $DB_TYPE. Please use postgres, sqlite, or, turso."
    exit 1
    ;;
esac
