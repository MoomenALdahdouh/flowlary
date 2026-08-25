# Flowlary AI Operations

## Models (centralized)

Configured in `packages/shared/src/ai/models.ts`:

| Operation | Env override | Default model |
|-----------|--------------|---------------|
| Correction | — | `llama-3.1-8b-instant` |
| Translation | — | `openai/gpt-oss-120b` |
| Layout classification | — | `allam-2-7b` |

One `GROQ_API_KEY` per environment serves all three operations.

## Environments

| Environment | API base | Auth | Groq key |
|-------------|----------|------|----------|
| Development | `http://127.0.0.1:8787` | Relaxed | Local `.env` |
| Staging | TBD deploy URL | Required | Staging project key |
| Production | `https://flowlary-api.zaixos.com` | Required | Production project key |

Never commit real keys. Use `backend/.env.example` as template.

## Rate limits (default)

Per user per operation per minute:

| Tier | Limit |
|------|------:|
| anonymous | 10 |
| free | 30 |
| trial | 60 |
| pro | 120 |
| byok | 30 (server-side ops only; BYOK correction bypasses server) |

HTTP 429 with `{ error: { code: 'AI_RATE_LIMITED' } }`.

## Usage accounting

In-memory records (Phase 16):

- `user_id`, `operation`, `model`, token counts (when available)
- `status`, `latency_ms`, `request_id`, `created_at`
- **No full user text stored**

Future: persist to database when account system lands.

## Error codes

| Code | Meaning |
|------|---------|
| `AI_UNAVAILABLE` | Provider unreachable |
| `AI_TIMEOUT` | Request timed out |
| `AI_RATE_LIMITED` | Flowlary API rate limit |
| `AI_AUTH_FAILED` | Missing/invalid install auth |
| `AI_INVALID_RESPONSE` | Provider output failed validation |
| `AI_PROVIDER_ERROR` | Provider error (sanitized) |
| `AI_ENTITLEMENT_DENIED` | Anonymous or insufficient entitlement |
| `AI_INVALID_REQUEST` | Malformed input |

## Troubleshooting

### Correction shows "Setup required"

- Managed: tap **Enable Flowlary AI** (consent)
- BYOK: add Groq key in settings

### Translation unavailable

- Confirm API running: `curl http://127.0.0.1:8787/health`
- Check install auth keys in extension storage
- Verify entitlement header resolves to `free`/`trial`/`pro`

### Layout still works without AI

Local `mapLayout` and heuristics run first. Classifier API is **fallback only**.

### 401 from API in production

Re-register install: clear `flowlary.auth.*` keys and reload extension.

## Health check

```bash
curl -s http://127.0.0.1:8787/health
```

Expected: `{"ok":true,"service":"flowlary-ai-gateway"}`
