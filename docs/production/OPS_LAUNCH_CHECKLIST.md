# Flowlary — Ops Launch Checklist

Parallel track for consumer launch. Engineering is **CLOSED** (`ENGINEERING READY`). Remaining work is owner-controlled ops + manual QA.

**Last verified:** 2026-08-28  
**Release artifact:** `release/flowlary-v1.1.0.zip` (SHA-256: `432e9912189a38478d181d7c86934597de7d19bf6e9b7231bd4ded334a1362cc`)

See also: [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) · [FINAL_LAUNCH_CERTIFICATION.md](./FINAL_LAUNCH_CERTIFICATION.md)

---

## Engineering (complete — do not reopen)

- [x] Shared tests 126/126
- [x] Backend tests 101/101
- [x] Extension tests 1093 pass (2 skipped wl13b live)
- [x] Website tests 120/120
- [x] Release build + package validated
- [x] Security scan (`phase23-security.test.ts`) PASS
- [x] Local staging AI verify (`node scripts/verify-live-api.mjs`) — all 8 checks VERIFIED
- [x] Layout classification + entitlement denial fixes + regression tests

## B1 — Chrome Web Store

- [x] Build release: `npm run build:release -w @flowlary/extension && npm run package:release`
- [ ] Upload zip from `release/` → **OWNER**
- [ ] Listing copy: [CHROME_WEB_STORE_DESCRIPTION.md](../release/CHROME_WEB_STORE_DESCRIPTION.md)
- [ ] Privacy: [CHROME_WEB_STORE_PRIVACY.md](../release/CHROME_WEB_STORE_PRIVACY.md)
- [ ] Google review approval → **OWNER**
- [ ] After approval: set `CHROME_WEB_STORE_URL` in [website/src/config.ts](../../website/src/config.ts)
- [ ] Verify Get Flowlary button opens the store (not `/support#get-flowlary`)
- [ ] Install from CWS (not unpacked) for final certification

## B2 — Paddle sandbox

- [x] Copy `backend/.env.example` → `backend/.env` (local)
- [ ] Set `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET` → **OWNER** (missing locally)
- [x] Set `PADDLE_PRICE_ID_PRO` (+ yearly) — price IDs configured locally
- [ ] Webhook URL: `https://api.flowlary.com/api/billing/webhook` (requires live API + DNS)
- [ ] Run `npm run test:wl13b` — **BLOCKED** until API + Paddle secrets + Mailpit
- [ ] Sandbox checkout from `/pricing` and `/account`

## B3 — Paddle production

- [ ] Create production products/prices
- [ ] Production webhook + secrets on API host
- [ ] Switch `PADDLE_ENVIRONMENT=production`
- [ ] One real (refundable) checkout test

## B4 — Production DNS / TLS

- [ ] `flowlary.com` → website — **BLOCKED_EXTERNAL** (DNS unresolved 2026-08-28)
- [ ] `api.flowlary.com` → API (`GET /health` returns `ok: true`, `groqConfigured: true`)
- [ ] `FLOWLARY_WEB_ORIGIN=https://flowlary.com` on production API
- [ ] Verify: `curl -sSI https://flowlary.com` and `curl -sS https://api.flowlary.com/health`

## B5 — Live sign-off

- [ ] Full [JOURNEY_QA_MATRIX.md](./JOURNEY_QA_MATRIX.md) in browser — **MANUAL_QA_REQUIRED**
- [ ] Extension install from CWS (not unpacked)
- [ ] Checkout → Pro visible in extension within one popup open (force sync)
- [ ] First-win ≤60s on Gmail or Notion — **MANUAL_QA_REQUIRED**

## B6 — Production AI (after B4)

- [ ] `FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs` — all 8 VERIFIED
- [ ] Manual AI failure / retry / exhaustion browser tests (Phase 10)

---

**Owner:** DNS, hosting, store account, Paddle keys, manual QA.  
**Agent:** deployment docs, verify scripts, `CHROME_WEB_STORE_URL` wiring when listing URL is provided.
