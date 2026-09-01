# Flowlary Production Domain Architecture

## Company vs product

| Entity | Role | Domain |
|--------|------|--------|
| **ZAIXOS** | Parent company | [zaixos.com](https://zaixos.com) |
| **Flowlary** | Product | [flowlary.com](https://flowlary.com) |

Flowlary is the product. ZAIXOS references in legal/company context remain intentional.

## Canonical domains

| Surface | Production URL | Development URL |
|---------|----------------|-----------------|
| Website | `https://flowlary.com` | — |
| API | `https://api.flowlary.com` | `http://127.0.0.1:8787` |

## API configuration (single source)

Production URL is defined once in:

```typescript
// extension/src/config/endpoints.ts
export const FLOWLARY_API_BASE
```

Override for local testing only:

```bash
# extension/.env.local
VITE_FLOWLARY_API_URL=http://127.0.0.1:8787
```

Release manifest host permission:

```
https://api.flowlary.com/*
```

## AI architecture

```
Chrome Extension
       ↓
https://api.flowlary.com
       ↓
   AI Gateway
       ↓
      Groq
 ┌──────┼──────┐
 ▼      ▼      ▼
Correct Translate Layout
```

- **One** managed `GROQ_API_KEY` per environment (server only)
- **Three** independent AI contracts (prompts not merged)
- **Zero** managed server keys in the extension bundle

## BYOK (correction only)

- Optional user-owned Groq key stored locally
- Calls `https://api.groq.com` directly from the service worker
- Never sent to Flowlary API or Flowlary servers

## CORS (web clients)

Backend allows configured web origins (default):

- `https://flowlary.com`
- `https://www.flowlary.com`

Environment override:

```
FLOWLARY_CORS_ORIGINS=https://flowlary.com,https://www.flowlary.com
```

Chrome extension requests use **manifest host_permissions**, not browser CORS.

## Legacy domains (deprecated for Flowlary API)

These were interim ZAIXOS-hosted API hosts and must **not** appear in active production config:

- `flowlary-api.zaixos.com` — replaced by `api.flowlary.com`
- `lingo-api.zaixos.com` — unified under `api.flowlary.com` (Phase 16)

Historical phase reports may still mention legacy hosts.

## DNS & deployment

Code referencing `api.flowlary.com` does **not** imply deployment. Verify separately:

1. DNS A/AAAA records for `api.flowlary.com`
2. TLS certificate
3. `GET /health` returns `{ ok: true }`

## API routes (unchanged paths)

| Method | Path |
|--------|------|
| GET | `/health` |
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/refresh` |
| POST | `/api/auth/logout` |
| GET | `/api/account` |
| GET | `/api/account/entitlement` |
| POST | `/api/ai/correction` |
| POST | `/api/ai/translation` |
| POST | `/api/ai/layout-classification` |

Legacy aliases: `/api/translate`, `/api/analyze-word`
