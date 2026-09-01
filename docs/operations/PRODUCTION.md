# Production operations

Canonical deploy: [../../deploy/README.md](../../deploy/README.md).

## Hosts (intended)

| Surface | Host |
| --- | --- |
| Website | `https://flowlary.com` |
| API | `https://api.flowlary.com` |
| Extension release | `npm run build:release` → `package:release` |

## Must configure before launch

1. `FLOWLARY_ENV=production`
2. Unique `FLOWLARY_JWT_SECRET` and `FLOWLARY_EXTENSION_AUTH_SECRET` (not example defaults)
3. `GROQ_API_KEY`
4. `FLOWLARY_CORS_ORIGINS` including `https://flowlary.com` and `https://www.flowlary.com`
5. `FLOWLARY_WEB_ORIGIN=https://flowlary.com`
6. Persistent `FLOWLARY_DATA_PATH` (volume; JSON store is **single-process**)
7. Paddle live keys/prices/webhook destination if charging money (`PADDLE_ENVIRONMENT=production`)
8. SMTP for verification/reset
9. Optional: `GEMINI_API_KEY`, `OPENROUTER_API_KEY` + `OPENROUTER_ADVISOR_MODEL` for Writing Review fallback
10. Nginx timeouts: AI ~90s; `/health` `/ready` short (see `deploy/nginx/flowlary-api.conf`)

`GET /ready` does **not** ping Groq. It fails if production secrets or the store are missing.

## Rollback

- Extension: Chrome Web Store previous version; users keep last unpacked zip.
- API: previous Docker image + previous store file snapshot (JSON file is the database).
- Do not “roll forward” by adding a second writer in the extension.

## What not to ship

- `FLOWLARY_AUTH_DISABLED=1`
- `FLOWLARY_UNLIMITED_TEST_EMAILS`
- `FLOWLARY_AGENT_DEBUG_LOG`
- Default `dev-only-change-me` secrets
- Extension sourcemaps with API keys (keys must never be in the extension)
