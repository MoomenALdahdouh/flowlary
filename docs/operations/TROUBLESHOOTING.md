# Troubleshooting

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| Layout never writes | Policy off, excluded host, paste, composing, structured CE, open token | Popup: Flowlary on, helpStyle auto, site not excepted; editor tier |
| English never reviews | `aiWritingReviewEnabled` off, mixed non-island, API down, no credits, review cache | Network to API; entitlement; island of 3+ Latin tokens |
| CORRECT/TRANSLATE E2E fail | No gateway on expected origin | `VITE_FLOWLARY_API_URL` vs `writing-api.test` vs `:8787` |
| `/ready` 503 | Missing prod secrets or unwritable store | `evaluateReadiness` |
| Advisor 400 `json_validate_failed` | Groq token budget too small | `GROQ_ADVISOR_MAX_TOKENS` ≥ 512 for gpt-oss-20b |
| Review never reaches Gemini | No `GEMINI_API_KEY` or timeout after Groq | Independent of `GEMINI_ADVISOR_ENABLED` |
| Website mixed content | Browser calling `http://127.0.0.1:8787` | Dev must use `/__flowlary-api` |
| Billing not Pro after checkout | Webhook not verified / wrong secret / sandbox vs live | Paddle notifications → `/api/billing/webhook` |
| Dual writes | **Forbidden** — file a bug; do not add another writer | Only Write Gate |

Do not disable safety (`evaluateFieldSafety`, open-token, protected kinds) to “make tests pass.”
