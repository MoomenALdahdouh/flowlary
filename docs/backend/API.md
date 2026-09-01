# HTTP API

Entry: `backend/src/index.ts` → `routes/http.ts`. All `/api/ai/*` use `authenticateRequest` then `createGateway`.

## Request pattern (AI)

```
CORS → body limit → auth (JWT account | install HMAC | dev) → entitlement (server) → rate limit
→ reserve usage → provider + contract validate → usage finalize → JSON
```

Install tokens **cannot** spend managed AI (`account_required`).

## Routes (summary)

**Health:** `GET /health`, `GET /ready`

**Auth / account:** `/api/auth/register|login|refresh|logout|forgot-password|reset-password|verify-email|resend-verification|device-session`, `/api/account`, `/api/account/entitlement|statistics`

**Student:** `/api/student/status`, verify, enrollment review

**Learning:** `/api/learning/events`, `profile`, `practice-sessions`

**Feedback / support / admin:** `/api/feedback/*`, `/api/support/*`, `/api/admin/*`

**Billing:** `/api/billing/config|status|checkout|portal`, webhooks `/api/billing/webhook` and `/api/billing/paddle/webhook`

**AI:**  
`/api/ai/correction` · `/api/ai/translation` (`/api/translate`) · `/api/ai/hypothesis-advisor` · `/api/ai/writing-review` · `/api/ai/layout-classification` (`/api/analyze-word`) · `/api/ai/explanation-localize` · `/api/ai/learning-coach` · `/api/ai/learning-report-narrate`

## Failures

Gateway maps provider categories to HTTP (`429`, `401`, `503`, `400` contract). Raw model JSON is never forwarded unvalidated for advisor/review.

See [AUTH.md](./AUTH.md) · [PROVIDERS.md](./PROVIDERS.md) · [BILLING.md](./BILLING.md)
