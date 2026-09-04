# Backend deployment

Canonical VPS ops: [../operations/FLOWLARY_DEPLOY.md](../operations/FLOWLARY_DEPLOY.md). Optional Docker/PM2 samples: [../../deploy/README.md](../../deploy/README.md) and [../operations/PRODUCTION.md](../operations/PRODUCTION.md).

- **Docker:** `deploy/Dockerfile` (Node 22, `tsx backend/src/index.ts`, volume for JSON store).
- **Compose:** `deploy/docker-compose.yml` — api + nginx `:8080`.
- **nginx:** `deploy/nginx/flowlary-api.conf` — `/health` `/ready` short timeout; AI 90s.
- **PM2:** `deploy/ecosystem.config.cjs`.

Health: `GET /health` liveness; `GET /ready` config/store/secrets — **does not** live-call Groq.
