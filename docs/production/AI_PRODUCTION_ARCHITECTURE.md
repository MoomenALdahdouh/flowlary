# Flowlary AI Production Architecture

## Overview

Flowlary uses **one managed Groq credential on the server** and **three independent AI contracts** on the client. The backend AI Gateway transports and governs requests; feature prompts and semantics remain separate.

```
                     FLOWLARY
                         │
                  Chrome Extension
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    CORRECT(managed)  TRANSLATE    CHECK_WORD
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                  Flowlary API
                         │
                         ▼
                    AI Gateway
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   CorrectionProvider  TranslationProvider  LayoutClassifierProvider
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                       GROQ
```

## Provider contracts

| Provider | Route | Input | Output | Model |
|----------|-------|-------|--------|-------|
| Correction | `POST /api/ai/correction` | `{ text, fieldType?, previousText? }` | `CorrectionResponse` JSON | `llama-3.1-8b-instant` |
| Translation | `POST /api/ai/translation` | `{ text, source_language, target_language, context? }` | `{ translation }` | `openai/gpt-oss-120b` |
| Layout classifier | `POST /api/ai/layout-classification` | `{ word, context?, source_layout, candidate_layouts }` | `{ result: { kind, target_layout? } }` | `allam-2-7b` |

Legacy aliases: `/api/translate`, `/api/analyze-word`.

## API key architecture

| Credential | Location | Used for |
|------------|----------|----------|
| `GROQ_API_KEY` | **Server env only** | All managed AI operations |
| User Groq key | `flowlary.correction.groqKey` (local) | BYOK correction only |
| Install token | `flowlary.auth.installToken` (local) | Extension → API auth |

The extension **never** receives the managed Groq key. `GET_STATUS` exposes `hasGroqKey` and `aiProvider` only.

## BYOK (opt-in)

- Default: `aiProvider: 'managed'`
- BYOK: user enables in popup → `aiProvider: 'byok'` + local Groq key
- BYOK correction calls `api.groq.com` directly from the service worker
- User BYOK keys are **not** sent to Flowlary servers

## Authentication

1. Extension generates install UUID on first API use
2. `POST /api/auth/register` returns HMAC install token
3. Subsequent AI calls send:
   - `Authorization: Bearer <token>`
   - `X-Flowlary-Install-Id: <uuid>`
   - `X-Flowlary-Entitlement: trial|free|pro|byok|anonymous`

Development: `FLOWLARY_AUTH_DISABLED=1` or `FLOWLARY_ENV=development` disables strict auth.

## Gateway responsibilities

- Request validation and size limits
- Entitlement gate (anonymous denied in production auth mode)
- Rate limiting per user/tier/operation
- Timeout (default 30s)
- Safe retry (correction: up to 2 attempts in extension BYOK; gateway single-attempt with provider retry policy)
- Normalized errors (`AI_*` codes)
- Usage metadata logging (no user text)
- Request IDs

## Cache (extension)

Unchanged Phase 12 isolation:

```
CORRECT:{hash}
TRANSLATE:{hash}:{src}:{tgt}
FIX_LAYOUT:{hash}:{layout}:{candidates}
```

## Local development

```bash
# Terminal 1 — API
cp backend/.env.example backend/.env   # add GROQ_API_KEY locally
npm run dev:api                        # http://127.0.0.1:8787

# Terminal 2 — extension
npm run dev
```

Extension default API: `http://127.0.0.1:8787` (`extension/src/config/endpoints.ts`).

Production release build: `https://flowlary-api.zaixos.com`.
