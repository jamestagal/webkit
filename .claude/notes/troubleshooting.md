# Troubleshooting — Common Issues

## Authentication redirect loop after login

- Check cookie `secure` flag matches environment (false for localhost)
- Clear browser cookies and retry

## Database connection failures after Docker restart

- Ensure PostgreSQL container is healthy before other services start
- Check `depends_on` with `condition: service_healthy`

## PostgreSQL won't start after Docker update

- Check if Docker pulled a newer PostgreSQL version
- Pin to the version matching your data (check `postgres_data` volume)

## Services can't connect to each other

- Use container names for internal communication (e.g., `webkit-core:4001`)
- Ensure services are on the same Docker network

## Login fails after adding database columns

- Go backend uses `SELECT *` on users table — new columns cause struct mismatch
- Run `sh scripts/run_queries.sh postgres` to regenerate sqlc code
- Restart `webkit-core`: `docker restart webkit-core`
- Commit generated files (`models.go`, `query_postgres.sql.go`) before deploying
