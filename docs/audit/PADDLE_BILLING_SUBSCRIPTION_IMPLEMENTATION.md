# WL-10 — Paddle Billing & Subscription Production Implementation

**Status:** COMPLETE (automated tests + integration hardening)  
**Date:** 2026-08-27  
**Live Paddle Sandbox E2E:** NOT VERIFIED (credentials not exercised in this session)

## Summary

Flowlary billing uses a **single authoritative entitlement path**: Paddle checkout → signed webhook → subscription record → server entitlement → website/extension UI. Pro is **never** granted from frontend checkout completion, query params, or client headers.

## Architecture

```
User (signed in, email verified)
  → POST /api/billing/checkout
  → Paddle.js overlay (transactionId from server)
  → Paddle payment (sandbox or production)
  → POST /api/billing/webhook (HMAC verified)
  → SubscriptionRecord + account.plan
  → GET /api/account/entitlement
  → Account Center + Extension cache
```

### Authoritative sources

| Concern | Source |
|---------|--------|
| Plan (free/trial/pro) | `resolveServerEntitlementForAccount()` in `accountService.ts` |
| Paddle subscription | `SubscriptionRecord` keyed by `paddleSubscriptionId` |
| Webhook idempotency | `WebhookEventRecord` keyed by Paddle `event_id` |
| Checkout price | Server env `PADDLE_PRICE_ID_PRO` / `PADDLE_PRICE_ID_PRO_YEARLY` only |
| Account mapping | `custom_data.flowlary_account_id` + `paddleCustomerId` |

## Environment variables

```env
PADDLE_ENVIRONMENT=sandbox          # or production
PADDLE_API_KEY=                     # server only
PADDLE_CLIENT_TOKEN=                # public token for Paddle.js (via /api/billing/config)
PADDLE_WEBHOOK_SECRET=              # alias: PADDLE_NOTIFICATION_WEBHOOK_SECRET
PADDLE_PRICE_ID_PRO=                # monthly Pro price
PADDLE_PRICE_ID_PRO_YEARLY=         # optional annual price
```

Never expose API key or webhook secret to the website bundle or extension.

## API endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/billing/config` | Public | Client token, prices, checkout availability |
| GET | `/api/billing/status` | JWT | Authenticated billing + entitlement snapshot |
| POST | `/api/billing/checkout` | JWT | Create Paddle transaction (month/year) |
| POST | `/api/billing/portal` | JWT | Customer portal session URL |
| POST | `/api/billing/webhook` | Paddle signature | Process subscription events |
| POST | `/api/billing/paddle/webhook` | Same | Alias for Paddle dashboard URL |

## Checkout flow

1. User clicks **Upgrade to Pro** (Account or Pricing).
2. Frontend calls `POST /api/billing/checkout` with optional `{ interval: 'month' | 'year' }`.
3. Server validates: authenticated, **email verified**, not already Pro, Paddle configured.
4. Server creates transaction with `custom_data.flowlary_account_id` — ignores client `priceId`/`plan`.
5. Paddle.js opens overlay with returned `transactionId`.
6. On success URL (`/account?checkout=complete`), UI shows **“Payment received. Activating Pro…”** and polls entitlement — **does not** activate Pro from URL alone.

## Webhook flow

1. Read **raw body** (required for signature verification).
2. Verify `Paddle-Signature` HMAC (`paddleSignature.ts`, 5-minute skew window).
3. Parse JSON; reject malformed payloads (400).
4. `processVerifiedPaddleEvent()`:
   - Duplicate `event_id` → 200 `{ duplicate: true }` (no state change).
   - Supported events: subscription.*, transaction.completed/payment_failed/past_due, customer.created/updated.
   - Unknown account → ignored (never grants Pro).
   - **Cross-environment guard:** sandbox subscriptions ignore production webhooks (and vice versa).
   - Price allowlist when `PADDLE_PRICE_ID_*` configured.

## Subscription state → entitlement policy

| Status | Grants Pro? | Product behavior |
|--------|-------------|------------------|
| `active` | Yes | Full Pro |
| `trialing` (Paddle) | Yes | Full Pro |
| `past_due` | Yes | Pro retained; `paymentFailed: true` |
| `canceled` | Yes until `currentPeriodEnd` | `cancelAtPeriodEnd: true` |
| `paused` | No | Pro revoked immediately |
| Expired (period ended) | No | Free plan |

**Registration Trial** (30 days, 200 daily credits) is separate from Paddle `trialing` — created at register, unchanged by billing.

## Cancellation & renewal

- Cancel/resume/plan change: **Paddle Customer Portal** (`POST /api/billing/portal`).
- Webhook `subscription.canceled` preserves Pro until period end.
- Renewal: `subscription.updated` / `transaction.completed` refresh period dates.
- Payment failure: `subscription.past_due` / `transaction.payment_failed` — Pro retained per dunning policy; UI prompts billing fix.

## Account mapping & isolation

- Checkout embeds `flowlary_account_id` in transaction `custom_data`.
- Webhook resolves account by custom ID, then `customer_id` fallback.
- Cross-account webhook events cannot activate another account (subscription locked to `accountId`).
- Portal/checkout require JWT for the authenticated account only.

## Extension integration

- Extension reads `/api/account/entitlement` via `syncServerEntitlement` (5-min cache).
- No in-extension checkout; upgrade redirects to website/pricing.
- Pro activation on website reflects on extension after sync/re-login.

## Learning system safety

Billing does **not** modify:

- LearningEvent schema or unified memory
- Daily Brief (3/day), Full Report (1/day), AI Coach (5/day) quotas
- Practice, layout, translation provider isolation
- Correction credit semantics

Checkout, webhooks, and verification consume **0 AI credits**.

## Local Sandbox setup

1. Create Paddle sandbox products/prices; set env vars in `backend/.env`.
2. Register webhook destination → `https://<api-host>/api/billing/webhook` (or `/api/billing/paddle/webhook`).
3. Forward webhooks locally: Paddle CLI `paddle webhooks forward` or ngrok/cloudflared to API port 8787.
4. Start API + website; use sandbox test cards via Paddle checkout.
5. Verify: checkout → webhook in logs → `GET /api/account/entitlement` shows `isPro: true`.

When credentials are missing, UI shows **“Billing is not configured”** / **View plans** — no fake success.

## UI (WL-10 polish)

- **Pricing:** Free / Trial card / Pro grid; honest checkout-pending copy.
- **Account Center:** `AccountBillingPanel` — plan badge, feature lists, renewal/cancel states, precise CTAs.
- **Post-checkout:** Activating state with server polling (60s).
- **i18n:** English, Arabic (RTL), Turkish for billing strings.

## Security checklist

- [x] Webhook HMAC on raw body
- [x] Event ID idempotency
- [x] Email verification gate on checkout
- [x] Server-side price IDs only
- [x] No card data stored
- [x] Environment isolation on webhooks
- [x] Safe `next` redirect (lab/checkout only)
- [x] Account isolation tests

## Tests

| Suite | Passed | Failed |
|-------|--------|--------|
| Backend (all) | 91 | 0 |
| Website (all) | 109 | 0 |

Phase 20 billing integration (19 tests): signature rejection, idempotency, Pro promotion, cancel-until-period-end, past_due, checkout price enforcement, unverified email block, account isolation, cross-env ignore, paused revoke, portal, billing status.

## Manual acceptance (Paddle Sandbox)

| Step | Result |
|------|--------|
| Register → verify email → Trial | Covered by prior WL-9 tests |
| Pricing → Upgrade → Checkout | NOT RUN (no live sandbox in CI) |
| Webhook → Pro entitlement | Covered by signed fixture tests |
| Extension Pro sync | Architecture verified; NOT RUN E2E |
| Cancel at period end | Covered by webhook tests |
| Expiration → Free | Covered by webhook tests |

## Known limitations

- JSON file store (single-process) — not multi-instance Postgres
- No server-side cancel API (portal-only by design)
- Live sandbox checkout not verified in this session
- `billingAvailable` merges “Paddle configured OR has subscription record”

## Next phase

**WL-11 — Website ↔ Extension Product Experience + Cross-Surface UX**
