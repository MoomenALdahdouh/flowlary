# Environment variable reference

**Never put secret values in git, docs, or the extension bundle.** This file lists **names and purpose only**.

Authoritative readers: `backend/src/config/env.ts`, `backend/.env.example`, `extension/src/config/endpoints.ts`, `extension/vite.config.ts`, `website/src/config.ts`.

Flags: `1` / `true` = on unless noted.

## Backend (gateway)

| NAME | PURPOSE | DEFAULT | REQ | USED BY | PRODUCTION | SENSITIVITY |
| --- | --- | --- | --- | --- | --- | --- |
| `FLOWLARY_ENV` | `development` \| `staging` \| `production` | `development` | rec | config, auth, CORS, readiness | Must be `production` | low |
| `PORT` | Listen port | `8787` | opt | `index.ts` | nginx upstream | low |
| `HOST` | Bind address | `0.0.0.0` | opt | `index.ts` | Docker | low |
| `GROQ_API_KEY` | Groq credential | empty | prod | advisors, review, correction, translation fallback | Required for `/ready` secrets | **secret** |
| `GEMINI_API_KEY` | Gemini credential | empty | opt | advisor if ranking enabled; review if key present | Optional | **secret** |
| `OPENROUTER_API_KEY` | OpenRouter credential | empty | opt | same pattern | Optional | **secret** |
| `WRITING_REVIEW_ENABLED` | Gateway review route | on | opt | writing review manager | Leave on | med |
| `WRITING_REVIEW_FALLBACK_ENABLED` | Failure-only Groq→Gemini→OpenRouter | on | opt | review manager | Independent of advisor fallback | med |
| `WRITING_REVIEW_TIMEOUT_MS` | Total review deadline | `4500` | opt | review manager | Keep ≤ client SW timeout | low |
| `ADVISOR_ENABLED` | Hypothesis ranking route | on | opt | advisor manager | Ranking is not a writer | med |
| `AI_ADVISOR_PROVIDER_ORDER` | Provider chain | `groq,gemini,openrouter` | opt | both managers | Alias: `ADVISOR_PROVIDER_ORDER` | low |
| `GROQ_ADVISOR_ENABLED` | Groq ranking adapter | on | opt | advisor | | low |
| `GROQ_ADVISOR_MODEL` | Groq model id | `openai/gpt-oss-20b` | opt | advisor | | low |
| `GROQ_ADVISOR_MAX_TOKENS` | Groq max tokens | `512` | opt | advisor | Alias: `FLOWLARY_ADVISOR_MAX_TOKENS` | low |
| `GEMINI_ADVISOR_ENABLED` | Gemini **ranking** | **off** | opt | advisor | Review can still use Gemini via **key** | med |
| `GEMINI_ADVISOR_MODEL` | Gemini model | `gemini-3.5-flash-lite` | opt | | | low |
| `GEMINI_ADVISOR_MAX_TOKENS` | | `512` | opt | | | low |
| `OPENROUTER_ADVISOR_ENABLED` | OpenRouter **ranking** | **off** | opt | | Review uses key+model if set | med |
| `OPENROUTER_ADVISOR_MODEL` | Required if OpenRouter used | empty | if OR on | | | low |
| `OPENROUTER_ADVISOR_MAX_TOKENS` | | `512` | opt | | | low |
| `ADVISOR_TOTAL_DEADLINE_MS` | Ranking total budget | `1500` if unset uses alias | opt | | Alias: `ADVISOR_TIMEOUT_MS` / `FLOWLARY_ADVISOR_TIMEOUT_MS` | low |
| `ADVISOR_FALLBACK_ENABLED` | Ranking fallback | **off** | opt | advisor | Alias: `FLOWLARY_ADVISOR_FALLBACK_ENABLED` | med |
| `ADVISOR_FALLBACK_MIN_REMAINING_MS` | Skip fallback if too late | `100` | opt | | | low |
| `ADVISOR_MAX_PROVIDER_ATTEMPTS` | Cap 3 | `3` | opt | | | low |
| `ADVISOR_MAX_FALLBACKS` | Cap 2 | `2` | opt | | | low |
| `ADVISOR_USER_RPM` | Per-user advisor RPM | `30` | opt | rate limit | | low |
| `ADVISOR_GLOBAL_RPM` | Global advisor RPM | `60` | opt | Alias: `FLOWLARY_ADVISOR_GLOBAL_RPM` | | low |
| `GROQ_ADVISOR_RPM` / `GEMINI_ADVISOR_RPM` / `OPENROUTER_ADVISOR_RPM` | Per-provider RPM | `60` | opt | | | low |
| `FLOWLARY_AUTH_DISABLED` | Disable auth | `1` in example | **never prod** | auth | Auto-true when env=development | **high** |
| `FLOWLARY_EXTENSION_AUTH_SECRET` | Install HMAC | `dev-only-change-me` | prod | install tokens | Must not be default | **secret** |
| `FLOWLARY_JWT_SECRET` | Account JWT | falls back to auth secret | prod | sessions | Must not be default | **secret** |
| `FLOWLARY_DATA_PATH` | JSON store path | `data/flowlary-store.json` | rec | db | Persistent volume | med (PII) |
| `FLOWLARY_AI_TIMEOUT_MS` | Upstream AI timeout | `30000` | opt | gateway | | low |
| `FLOWLARY_MAX_BODY_BYTES` | Body cap | `64000` | opt | http | | low |
| `FLOWLARY_CORS_ORIGINS` | Allowed website origins | env defaults | prod | CORS | Required non-empty in prod `/ready` | med |
| `FLOWLARY_WEB_ORIGIN` | Email/verification links | test vs `https://flowlary.com` | prod | email | No trailing slash | low |
| `PADDLE_ENVIRONMENT` | `sandbox` \| `production` | `sandbox` | rec | billing | Live money = `production` | high |
| `PADDLE_API_KEY` | Server SDK | empty | billing | | **secret** |
| `PADDLE_WEBHOOK_SECRET` | Verify webhooks | empty | billing | Alias: `PADDLE_NOTIFICATION_WEBHOOK_SECRET` | **secret** |
| `PADDLE_CLIENT_TOKEN` | Browser overlay | empty | website+API config | public-ish | med |
| `PADDLE_PRICE_ID_PRO` | Monthly price | empty | billing | | med |
| `PADDLE_PRICE_ID_PRO_YEARLY` | Annual price | empty | opt | | med |
| `GOOGLE_TRANSLATE_ENABLED` | Use Google Translate | off | opt | translation router | | med |
| `GOOGLE_PROJECT_ID` | GCP project | empty | if Google | | med |
| `GOOGLE_LOCATION` | | `global` | opt | | low |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC JSON path | empty | if Google v3 | | **secret path** |
| `GOOGLE_TRANSLATE_API_KEY` | Translate v2 key | empty | opt | | **secret** |
| `TRANSLATION_FORCE_PROVIDER` | `auto` \| `google` \| `groq` \| `google_then_groq` | `auto` | opt | | med |
| `TRANSLATION_ALLOW_GROQ_FALLBACK` | Free Google → Groq | off | opt | | med (credits) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Mail | port `1025` | rec for mail | | **secret** pass |
| `EMAIL_FROM` | From header | Flowlary noreply | opt | | low |
| `FLOWLARY_FEEDBACK_ADMIN_EMAILS` | Admin APIs | empty | opt | | PII |
| `CHROME_WEB_STORE_URL` / `EDGE_ADDONS_URL` | Public stats | empty | opt | | low |
| `FLOWLARY_PUBLIC_STATS_ENABLED` and `FLOWLARY_PUBLIC_SHOW_*` | Marketing stats toggles | mostly on | opt | | low |
| `CHROME_STORE_RATING` (+ review count / verified at) | Manual store ratings | empty | opt | never scrape | low |
| `EDGE_STORE_*` | same | | | | low |
| `FLOWLARY_UNLIMITED_TEST_EMAILS` | Bypass credits | empty | **dev only** | accountService | **never prod** |
| `FLOWLARY_AGENT_DEBUG_LOG` | NDJSON debug file | unset = off | opt | `agentLog.ts` | **never prod**; `/__debug/ingest` only writes if set | med |

## Aliases / legacy (still read)

| NAME | NOTES |
| --- | --- |
| `ADVISOR_PROVIDER_ORDER` | Same as `AI_ADVISOR_PROVIDER_ORDER` |
| `FLOWLARY_ADVISOR_MAX_TOKENS` | Same as `GROQ_ADVISOR_MAX_TOKENS` for Groq budget |
| `ADVISOR_TIMEOUT_MS` / `FLOWLARY_ADVISOR_TIMEOUT_MS` | Used if `ADVISOR_TOTAL_DEADLINE_MS` unset |
| `FLOWLARY_ADVISOR_FALLBACK_ENABLED` | Same as `ADVISOR_FALLBACK_ENABLED` |
| `FLOWLARY_ADVISOR_GLOBAL_RPM` | Same as `ADVISOR_GLOBAL_RPM` |
| `PADDLE_NOTIFICATION_WEBHOOK_SECRET` | Same as `PADDLE_WEBHOOK_SECRET` |
| `advisorMaxTokens` in AppConfig | Deprecated field; still filled from Groq max tokens |

Do **not** delete aliases until grep shows zero readers.

## Extension / Vite

| NAME | PURPOSE | DEFAULT | REQ | USED BY | PRODUCTION |
| --- | --- | --- | --- | --- | --- |
| `FLOWLARY_RELEASE` | Release vite define | unset | `build:release` | `extension/vite.config.ts` | Sets `VITE_FLOWLARY_RELEASE=1` and production API |
| `VITE_FLOWLARY_API_URL` | Dev API origin | `https://writing-api.test` | opt | `endpoints.ts` | Ignored in release (hard `https://api.flowlary.com`) |
| `VITE_FLOWLARY_SITE_URL` | Site origin | `https://flowlary.test` | opt | | Release: `https://flowlary.com` |
| `VITE_TRANSLATION_API_URL` | Deprecated override | falls back to API | opt | keep until tests drop | |
| `VITE_LAYOUT_API_URL` | Deprecated override | same | opt | | |

## Website

| NAME | PURPOSE |
| --- | --- |
| `VITE_FLOWLARY_API_URL` | Production builds only honor `https://api.flowlary.com…`; local uses `/__flowlary-api` proxy |

## Test / probe only (not production config)

| NAME | PURPOSE |
| --- | --- |
| `FLOWLARY_LIVE_WRITING_REVIEW` | Live writing-review eval |
| `FLOWLARY_GEMINI_LIVE` / `FLOWLARY_GEMINI_FULL_LIVE` | Gemini live tests |
| `FLOWLARY_GROQ_LIVE` / `FLOWLARY_OPENROUTER_LIVE` | Provider live tests |
| `FLOWLARY_GPT_OSS_FULL_LIVE` | Long holdout |
| `WL13B_LIVE_API` / `WL13B_API` / `WL13B_MAILPIT` / `WL13B_WEB_ORIGIN` | Staging E2E |
| `FLOWLARY_API_BASE` / `FLOWLARY_VERIFY_PORT` | `scripts/verify-live-api.mjs` |
| `FLOWLARY_EXTENSION_TEST_API` | Vitest global API | 

## Misleading names

- **`GEMINI_ADVISOR_ENABLED` does not gate Writing Review.** Review uses API keys + `WRITING_REVIEW_*`.
- **`ADVISOR_FALLBACK_ENABLED` does not control Writing Review fallback.**
- **`VITE_TRANSLATION_API_URL` is not a second translation product** — leftover alias.

## Not documented in `.env.example` but used

- `HOST` (now in example)
- `FLOWLARY_AGENT_DEBUG_LOG` (now in example)
- `FLOWLARY_UNLIMITED_TEST_EMAILS` (commented in example)
- Live eval flags (test-only; keep out of production `.env`)
