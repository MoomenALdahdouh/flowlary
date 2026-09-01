# Phase 17 — Account & Server Entitlement

**Date:** 2026-08-25  
**Status:** Implemented locally; production deploy **BLOCKED_EXTERNAL**

## Architecture

```
Chrome Extension
      ↓ Bearer JWT (account) or install HMAC token
api.flowlary.com
      ↓
Flowlary API / AI Gateway
      ↓ authenticateRequest()
      ↓ server entitlement (account store)
      ↓ rate limits
      ↓ safety (extension-side, pre-request)
      ↓
Groq (managed GROQ_API_KEY — server only)
```

**Billing truth:** server-side account record. Client `X-Flowlary-Entitlement` is advisory only and never elevates plan.

## Account model

| Field | Purpose |
|-------|---------|
| `email` + password | Account identity (scrypt hash) |
| `plan` | `trial` → `free` → `pro` (pro server-only until billing) |
| `status` | `active` / `suspended` |
| `trialEndsAt` | 7-day trial on registration |
| `usageBalanceMs` | Free-tier managed AI budget |

New registrations start on **trial** (7 days). After trial expiry, account moves to **free** with a usage balance. **Pro** can only be set server-side via `setAccountPlan()` — no client or payment self-service yet.

## Auth endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Email/password account **or** legacy `install_id` only |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/refresh` | Rotate access + refresh tokens |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/account` | Account + usage summary |
| GET | `/api/account/entitlement` | Server entitlement view |

### Token model

- **Access token:** JWT (15 min), Bearer header
- **Refresh token:** opaque, stored hashed server-side
- **Install token:** legacy 64-hex HMAC for anonymous/device identity

Extension stores minimum credentials in `chrome.storage.local` (`authAccessToken`, `authRefreshToken`, etc.).

## Persistence

JSON file store at `backend/data/flowlary-store.json` (configurable via `FLOWLARY_DATA_PATH`). In-memory mode (`:memory:`) for tests.

Records: accounts, sessions, install links, usage events (no user text).

## Rate limits (per minute, server-side)

| Tier | Max requests |
|------|--------------|
| anonymous | 10 |
| free | 30 |
| trial | 60 |
| pro | 120 |
| byok | 30 |

## Extension UX (minimal)

Settings → **Account**: sign in, register, sign out, plan display. Shows **“Billing unavailable”** — no fake checkout.

Install-only mode preserved for legacy/anonymous use.

## Local development

| Service | URL |
|---------|-----|
| Website (Herd) | `http://flowlary.test/` |
| Node API | `http://127.0.0.1:8787` (`npm run dev:api`) |
| Production API | `https://api.flowlary.com` (when DNS/deploy ready) |

## Verification

```bash
npm test                    # 499 tests
node scripts/verify-live-api.mjs   # requires backend/.env GROQ_API_KEY
```

Production live verification requires DNS + deploy + server `GROQ_API_KEY`.

## Blockers

- `api.flowlary.com` DNS does not resolve
- `backend/.env` / `GROQ_API_KEY` not present in this environment
- Payment/billing not implemented (by design)
