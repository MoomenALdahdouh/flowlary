# Flowlary production environment

**Location (proposed):** `/var/www/flowlary/shared/.env`  
**Permissions:** `deploy:deploy` `0600`  
**Git:** never commit. Not a copy of any ZAIXOS `.env`.

The backend loads the first existing file among: `./.env`, `backend/.env`, or a path relative to `env.ts` (`loadBackendEnvFile`). Production should symlink `current/backend/.env` → `shared/.env` so releases do not carry secrets.

---

## Required for `FLOWLARY_ENV=production`

`GET /ready` fails without these (see `backend/src/health/readiness.ts`).

| Variable | Purpose |
|---|---|
| `FLOWLARY_ENV` | Must be `production` (never `development` — that disables auth) |
| `GROQ_API_KEY` | Managed Groq key (server only) |
| `FLOWLARY_JWT_SECRET` | JWT signing; strong random; not `dev-only-change-me` |
| `FLOWLARY_EXTENSION_AUTH_SECRET` | Extension auth secret |
| `FLOWLARY_WEB_ORIGIN` | `https://flowlary.com` (no trailing slash) |
| `FLOWLARY_CORS_ORIGINS` | `https://flowlary.com,https://www.flowlary.com` |

---

## Process bind (required on this VPS)

| Variable | Production value | Why |
|---|---|---|
| `HOST` | `127.0.0.1` | Code defaults to `0.0.0.0`. Must not expose Node on the public IP. |
| `PORT` | `9087` | Unused; not 8787 |
| `NODE_ENV` | `production` | |
| `FLOWLARY_DATA_PATH` | `/var/www/flowlary/shared/data/flowlary-store.json` | Survives release switches |

---

## AI — Writing Review (independent of Advisor)

Do not change the architecture. Do not add models or a local SLM.

| Variable | Production intent |
|---|---|
| `WRITING_REVIEW_ENABLED` | `1` |
| `WRITING_REVIEW_FALLBACK_ENABLED` | `1` (failure-only Groq → Gemini → OpenRouter) |
| `WRITING_REVIEW_TIMEOUT_MS` | `4500` (default) |
| `GROQ_API_KEY` | Primary review provider |
| `GEMINI_API_KEY` | Fallback when Groq fails (key present ⇒ provider usable for review) |
| `OPENROUTER_API_KEY` | Last fallback |
| `OPENROUTER_ADVISOR_MODEL` | Required if OpenRouter is used (shared key; review uses gateway adapters) |

Writing Review does **not** require `GEMINI_ADVISOR_ENABLED` / `OPENROUTER_ADVISOR_ENABLED` to include those providers in the review chain (see `docs/audit/WRITING_REVIEW_PRODUCTION_PATH.md`).

---

## AI — Advisor ranking (separate)

| Variable | Production intent |
|---|---|
| `ADVISOR_ENABLED` | `1` |
| `AI_ADVISOR_PROVIDER_ORDER` | `groq,gemini,openrouter` |
| `GROQ_ADVISOR_ENABLED` | `1` |
| `GROQ_ADVISOR_MODEL` | `openai/gpt-oss-20b` |
| `GROQ_ADVISOR_MAX_TOKENS` | `512` |
| `ADVISOR_TOTAL_DEADLINE_MS` | `1500` (tight; fallbacks need remaining time) |
| `ADVISOR_FALLBACK_ENABLED` | `0` unless Gemini/OpenRouter ranking is intentionally live |
| `GEMINI_ADVISOR_ENABLED` | `0` until ranking fallback is approved |
| `GEMINI_ADVISOR_MODEL` | `gemini-3.5-flash-lite` |
| `OPENROUTER_ADVISOR_ENABLED` | `0` until ranking fallback is approved |
| `OPENROUTER_ADVISOR_MODEL` | `openai/gpt-4o-mini` when enabled |
| RPM / attempt caps | Keep `.env.example` defaults unless load requires change |

---

## Translation (optional)

| Variable | Notes |
|---|---|
| `GOOGLE_TRANSLATE_ENABLED` | `0` until ADC is configured |
| `GOOGLE_PROJECT_ID` / `GOOGLE_LOCATION` / `GOOGLE_APPLICATION_CREDENTIALS` | ADC JSON **outside git**, e.g. `/var/www/flowlary/shared/google-adc.json` mode 600 |
| `GOOGLE_TRANSLATE_API_KEY` | v2 alternative; still server-only |
| `TRANSLATION_FORCE_PROVIDER` | `auto` |
| `TRANSLATION_ALLOW_GROQ_FALLBACK` | `0` unless product accepts credit-gated fallback |

---

## Auth / accounts

| Variable | Notes |
|---|---|
| `FLOWLARY_AUTH_DISABLED` | Must **not** be `1` in production |
| `FLOWLARY_UNLIMITED_TEST_EMAILS` | Must be unset in production |

---

## Billing (Paddle)

Webhook URL once DNS/TLS exist: `https://api.flowlary.com/api/billing/webhook`

| Variable | Launch |
|---|---|
| `PADDLE_ENVIRONMENT` | `sandbox` until live billing is approved; `production` only with live keys |
| `PADDLE_API_KEY` | Server only |
| `PADDLE_WEBHOOK_SECRET` | Or `PADDLE_NOTIFICATION_WEBHOOK_SECRET` |
| `PADDLE_CLIENT_TOKEN` | Client token is still injected by **website build / account UI** from server config where applicable — never put secret API keys in the website bundle |
| `PADDLE_PRICE_ID_PRO` | Required for checkout |
| `PADDLE_PRICE_ID_PRO_YEARLY` | Optional |

---

## Email

| Variable | Notes |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Production SMTP (not Mailpit) |
| `SMTP_SECURE` | `1` for TLS |
| `EMAIL_FROM` | e.g. `Flowlary <noreply@flowlary.com>` |

Verification links use `FLOWLARY_WEB_ORIGIN`.

---

## Public stats / stores (optional)

`CHROME_WEB_STORE_URL`, `EDGE_ADDONS_URL`, `FLOWLARY_FEEDBACK_ADMIN_EMAILS`, `FLOWLARY_PUBLIC_*`, verified store ratings — see `backend/.env.example`. Leave unset until listings exist.

---

## Limits

| Variable | Default |
|---|---|
| `FLOWLARY_AI_TIMEOUT_MS` | `30000` |
| `FLOWLARY_MAX_BODY_BYTES` | `64000` |

---

## What must never appear in logs or git

API keys, SMTP passwords, JWT/auth secrets, Paddle secrets, Google ADC JSON, raw user field text, session tokens.

Generate secrets with `openssl rand -hex 32` (or equivalent) on the operator machine; paste onto the server over SSH. Do not paste secrets into chat transcripts.
