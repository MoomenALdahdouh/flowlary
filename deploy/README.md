# Flowlary production deployment stack

**VPS (flowlary.com):** use [`production/deploy.sh`](./production/deploy.sh) and [`docs/operations/FLOWLARY_DEPLOY.md`](../docs/operations/FLOWLARY_DEPLOY.md). Releases + `current` symlink + Supervisor `flowlary-api`. Do not use Docker or PM2 on that host.

The Docker / Compose / PM2 files below are **optional** stacks for other environments. They bind ports that collide with the Contabo VPS isolation plan.

---

Self-healing API deployment with health/readiness probes and nginx reverse proxy.

## Architecture

```
Browser Extension / Website
        ↓ HTTPS
   nginx (deploy/nginx/flowlary-api.conf)
        ↓ proxy_pass
   Flowlary API (Node, port 8787)
        ↓
   Groq / Google Translate (external)
        ↓
   JSON file store (FLOWLARY_DATA_PATH)
```

## Docker Compose (recommended)

```bash
# From repo root — configure backend/.env for production first
docker compose -f deploy/docker-compose.yml up -d --build

# Verify
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
FLOWLARY_API_BASE=http://127.0.0.1:8080 node scripts/verify-live-api.mjs
```

Services restart automatically (`restart: unless-stopped`). The API container healthcheck uses `GET /health`. Nginx starts only after the API is healthy (`depends_on: condition: service_healthy`).

## PM2 (bare metal / VM)

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Place nginx config from `deploy/nginx/flowlary-api.conf` on the host, pointing upstream to `127.0.0.1:8787`.

## Health endpoints

| Endpoint | Purpose | Use |
|----------|---------|-----|
| `GET /health` | Process liveness | Load balancer ping, Docker healthcheck |
| `GET /ready` | Dependency readiness | nginx upstream gate, k8s readiness |

`/ready` returns **503** when required production secrets or the data store are unavailable. It does **not** probe Groq — AI provider failures return controlled application errors without taking down the API process.

## Local development (Herd)

502 from `https://flowlary.test` means Vite is not running on port 5173:

```bash
npm run dev:web   # website
npm run dev:api   # API on :8787
```

See `scripts/dev-website.mjs`.
