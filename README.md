# Running the app

Generate new JWT keys for the project:
```bash
sh scripts/keys.sh
```

Compile the SQL queries using sqlc:
```bash
sh scripts/sqlc.sh
```

Spin up the project:
```bash
GITHUB_CLIENT_ID=Iv23litoS0DJltaklISr \
GITHUB_CLIENT_SECRET=c6ed4d8bc5bcb687162da0ea0d9bc614e31004a8 \
GOOGLE_CLIENT_ID=646089287190-m252eqv203c3fsv1gt1m29nkq2t6lrp6.apps.googleusercontent.com \
GOOGLE_CLIENT_SECRET=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 \
DATABASE_PROVIDER=postgres \
POSTGRES_HOST=postgres \
POSTGRES_PORT=5432 \
POSTGRES_DB=postgres \
POSTGRES_USER=postgres \
POSTGRES_PASSWORD=postgres \
PAYMENT_PROVIDER=local \
EMAIL_PROVIDER=local \
EMAIL_FROM=admin@gofast.live \
FILE_PROVIDER=local \
LOCAL_FILE_DIR=/file \
docker compose up --build
```

Run the Atlas migrations:
```bash
sh scripts/atlas.sh
```

Access the project at:
```bash
# Client
http://localhost:3000
# Admin
http://localhost:3001
```

For Grafana Monitoring, check the README.md in `/grafana` folder.  
For Kubernetes Deployment + Monitoring, check the README.md in `/kube` folder.