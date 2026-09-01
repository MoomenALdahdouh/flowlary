# Flowlary AI Architecture

**Product:** Flowlary · **Company:** [ZAIXOS](https://zaixos.com) · **API:** `https://api.flowlary.com`

## End-to-end flow

```
Chrome Extension
       ↓
https://api.flowlary.com
       ↓
   AI Gateway (@flowlary/backend)
       ↓
      Groq
 ┌──────┼──────┐
 ▼      ▼      ▼
Correct Translate Layout
```

## Three AI contracts

| Contract | Route | Model | Managed |
|----------|-------|-------|---------|
| Correction | `POST /api/ai/correction` | `llama-3.1-8b-instant` | Yes (default) |
| Translation | `POST /api/ai/translation` | `openai/gpt-oss-120b` | Yes |
| Layout classification | `POST /api/ai/layout-classification` | `allam-2-7b` | Yes |

Legacy aliases preserved: `/api/translate`, `/api/analyze-word`.

## Credential model

| Credential | Location | Purpose |
|------------|----------|---------|
| `GROQ_API_KEY` | Server env only | All managed AI (one key per environment) |
| User Groq key | Extension local storage | BYOK correction only (opt-in) |
| Install token | Extension local storage | Extension → API authentication |

**Zero managed server secrets in the extension bundle.**

## BYOK (correction only)

- Default: managed correction via Flowlary API
- Opt-in: user enables BYOK → calls `https://api.groq.com` directly from service worker
- BYOK bypasses managed entitlement gating and never sends user key to Flowlary servers

## Client entitlement (UX gate)

Central `EntitlementService` in the extension gates managed AI:

| Client plan | Managed AI |
|-------------|------------|
| Unknown | **Deny** |
| Free (usage exhausted) | **Deny** |
| Free / trial / pro (valid) | Allow (client UX) |
| BYOK correction | Bypass managed gate |

Features gated: correction (managed), translation, live translation, layout AI.  
Local layout mapping (`layout_auto`) is not gated.

Client entitlement is **not** cryptographically verified — treat as UX only.

## Server entitlement (authoritative boundary)

Install-token authentication is interim (not a full account system).

**Server never trusts `X-Flowlary-Entitlement` as billing truth.**

| Client header | Authenticated | Server tier | Managed AI |
|---------------|---------------|-------------|------------|
| missing / anonymous | yes | anonymous | Deny |
| free / trial / pro / byok | yes | **free** | Allow (free rate limits) |
| any | no | anonymous | Deny |

Client `pro`/`trial` claims do **not** unlock pro/trial server rate limits until Phase 17 account verification.

Implementation: `backend/src/middleware/entitlement.ts`

## Authentication

1. Extension registers install ID → `POST /api/auth/register`
2. Subsequent requests: `Authorization: Bearer <token>`, `X-Flowlary-Install-Id`, `X-Flowlary-Entitlement` (advisory)

## Canonical API configuration

```typescript
// extension/src/config/endpoints.ts
FLOWLARY_API_BASE
// Production: https://api.flowlary.com
// Development: http://127.0.0.1:8787
```

## Related docs

- [FLOWLARY_PRODUCTION_DOMAIN.md](./FLOWLARY_PRODUCTION_DOMAIN.md) — domains & DNS
- [AI_PRODUCTION_ARCHITECTURE.md](./AI_PRODUCTION_ARCHITECTURE.md) — gateway details
- [AI_OPERATIONS.md](./AI_OPERATIONS.md) — runbook & errors
- [LIVE_API_VERIFICATION.md](./LIVE_API_VERIFICATION.md) — local/production verify steps
