# Flowlary — Production Deployment Guide

**Last updated:** 2026-08-28  
**Audience:** Owner / ops — deploy API + website before soft launch  
**Engineering status:** ENGINEERING READY (do not redeploy extension ZIP unless version changes)

---

## Domains

| Host | Service |
|------|---------|
| `https://flowlary.com` | Marketing site + account (website build) |
| `https://api.flowlary.com` | Flowlary AI gateway (backend) |

---

## API environment (server only)

Set on the **API host** process manager (never in extension, website, or git):

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `FLOWLARY_ENV` | **Yes** | `production` |
| `GROQ_API_KEY` | **Yes** | `gsk_…` (Groq dashboard) |
| `FLOWLARY_JWT_SECRET` | **Yes** | Strong random secret |
| `FLOWLARY_EXTENSION_AUTH_SECRET` | **Yes** | Strong random secret |
| `FLOWLARY_WEB_ORIGIN` | **Yes** | `https://flowlary.com` (no trailing slash) |
| `FLOWLARY_CORS_ORIGINS` | **Yes** | `https://flowlary.com,https://www.flowlary.com` |
| `FLOWLARY_AI_TIMEOUT_MS` | Recommended | `30000` |
| `PORT` | As needed | e.g. `8787` behind reverse proxy |
| `FLOWLARY_DATA_PATH` | Recommended | Persistent path for accounts/billing store |

### Billing (when enabling Paddle)

| Variable | Sandbox | Production |
|----------|---------|------------|
| `PADDLE_ENVIRONMENT` | `sandbox` | `production` |
| `PADDLE_API_KEY` | Sandbox API key | Live API key |
| `PADDLE_CLIENT_TOKEN` | Sandbox client token | Live client token |
| `PADDLE_WEBHOOK_SECRET` | Sandbox webhook secret | Live webhook secret |
| `PADDLE_PRICE_ID_PRO` | Sandbox price ID | Live price ID |
| `PADDLE_PRICE_ID_PRO_YEARLY` | Optional | Optional |

Webhook URL: `https://api.flowlary.com/api/billing/webhook`

### Email (verification + password reset)

| Variable | Production |
|----------|------------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Production SMTP |
| `SMTP_SECURE` | `1` for TLS |
| `EMAIL_FROM` | e.g. `Flowlary <noreply@flowlary.com>` |

### Optional translation

| Variable | When |
|----------|------|
| `GOOGLE_TRANSLATE_ENABLED` | `1` when Google Cloud Translation is configured |
| `GOOGLE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | ADC for v3 API |

Template: `backend/.env.example`

---

## Website build

Production build uses `https://api.flowlary.com` by default (`website/src/config.ts`).

```bash
npm run build -w @flowlary/website
# Deploy website/dist to flowlary.com host
```

After CWS approval, set `CHROME_WEB_STORE_URL` in `website/src/config.ts` and rebuild.

---

## Post-deploy verification

```bash
# DNS + TLS
curl -sSI https://flowlary.com
curl -sS https://api.flowlary.com/health
# Expect: {"ok":true,"groqConfigured":true,...}

# Full AI path (requires GROQ_API_KEY on server, not in shell history)
FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs

# Release security (local artifact)
npm run build:release -w @flowlary/extension
npx vitest run tests/integration/phase23-security.test.ts -c extension/vitest.config.ts
```

---

## Security invariants

- `POST /__test/reset` is registered **only** when `FLOWLARY_ENV=test` — not available in production.
- `GROQ_API_KEY` and Paddle secrets must never appear in client bundles.
- `FLOWLARY_ENV=development` disables auth — **never use in production**.

---

## Soft launch order (recommended)

1. DNS + TLS for both hosts  
2. Deploy API with production env  
3. Run `verify-live-api.mjs` against production  
4. Deploy website  
5. Paddle sandbox E2E (`npm run test:wl13b`)  
6. Submit `release/flowlary-v1.1.0.zip` to CWS  
7. After CWS approval: set store URL, manual 40-step QA + first-win timing  
8. Paddle production (one refundable transaction)  
9. Update `FINAL_LAUNCH_CERTIFICATION.md`
