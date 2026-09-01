# WL-9 — Production Billing, Subscription & Monetization Completion

**Phase:** Implementation  
**Status:** Complete (code) / Live Paddle verification REQUIRED  
**Date:** 2026-08-27

---

## 1. Existing billing architecture

Flowlary already shipped a **Paddle Billing** boundary in Phase 20:

```
Website Pricing / Account
  → POST /api/billing/checkout (JWT)
  → Paddle.js overlay (transactionId)
  → Paddle payment
  → POST /api/billing/webhook (signed)
  → SubscriptionRecord + account.plan
  → GET /api/account/entitlement
  → Website + Extension UI
```

WL-9 **completed and hardened** this path — no second billing system was introduced.

---

## 2. Paddle configuration

| Variable | Purpose |
|----------|---------|
| `PADDLE_ENVIRONMENT` | `sandbox` or `production` |
| `PADDLE_API_KEY` | Server API key |
| `PADDLE_WEBHOOK_SECRET` | Webhook HMAC verification |
| `PADDLE_CLIENT_TOKEN` | Paddle.js public token |
| `PADDLE_PRICE_ID_PRO` | Monthly Pro price |
| `PADDLE_PRICE_ID_PRO_YEARLY` | Yearly Pro price (optional) |

When credentials are absent: `billingConfigured=false`, checkout returns 503, UI shows honest **View plans** / **billing prepared** copy — never fake checkout.

---

## 3. Checkout flow

1. Authenticated account with **verified email** (WL-9 addendum)
2. `startCheckout()` selects server-side price ID (`month` / `year`)
3. Returns `transactionId` + `clientToken`
4. Website opens Paddle overlay via `@paddle/paddle-js`
5. Success redirect: `/account?checkout=complete`
6. UI polls entitlement every 2.5s (max 60s) — **never activates Pro from query params alone**
7. Webhook confirms subscription → server sets `isPro: true`

---

## 4. Webhook flow

- Signature verified via `Paddle-Signature` HMAC (`paddleSignature.ts`)
- Idempotent on `event_id`
- Account resolved via `custom_data.flowlary_account_id` → `customer_id`
- Unknown accounts → ignored, no Pro grant
- **WL-9:** Price ID validated when catalog price IDs are configured

---

## 5. Signature verification

Invalid/missing signatures → **400**. Duplicate events → **200** with `duplicate: true`.

---

## 6. Subscription state mapping

`subscriptionMap.ts` maps Paddle status → internal record. `subscriptionGrantsPro()` is authoritative for Pro access including cancel-until-period-end and past_due retention.

---

## 7. Entitlement flow

`resolveServerEntitlementForAccount()` derives plan, credits, capabilities. Frontend caches display only; authorization uses server entitlement.

---

## 8. Credit flow

Unchanged Phase 26 rules: Trial/Pro 200 daily credits, Free 40, translation independence preserved.

---

## 9. Account mapping

Paddle customer/subscription IDs stored on `AccountRecord`. Webhooks never trust client-supplied account IDs without resolution chain.

---

## 10. Account isolation

Account A subscription/webhooks cannot affect Account B. Verified in Phase 20 + Phase 17 tests.

---

## 11. Cancellation

`cancel_at_period_end` preserved until `currentPeriodEnd`. UI shows scheduled cancellation date from server subscription view.

---

## 12. Resume

Handled via Paddle customer portal (existing `openBillingPortal()` → `/api/billing/portal`).

---

## 13. Portal

Requires linked `paddleCustomerId`. Pre-purchase users receive honest unavailable messaging.

---

## 14. UI polish (WL-8 + WL-9)

- Commercial plan states via `resolveCommercialPlanState()`
- Payment pending: "Payment received. Activating Pro…"
- Past due / payment failed / expired distinct copy
- Upgrade blocked with verification CTA when email unverified
- Account dashboard shows plan, trial days, usage, subscription status

---

## 15. Tests

| Suite | Result |
|-------|--------|
| `phase20-billing.test.ts` | 13/13 pass |
| `phase17-account.test.ts` | 18/18 pass |
| `billing-state.test.ts` | pass |
| `emailVerification.test.ts` (checkout gate) | pass |

---

## 16. Regression

Learning (WL-7), auth (WL-8), feature availability unchanged except checkout email gate.

---

## 17. Live sandbox verification

**REQUIRED before production billing sign-off:**

- Configure sandbox credentials + webhook destination
- Complete checkout → webhook → Pro entitlement
- Portal open → cancel → resume flows

---

## 18. Environment requirements

See `backend/.env.example` for Paddle + SMTP (verification addendum).

---

## 19. Remaining limitations

- JSON file store (single-process)
- No billing history API in-app (portal only)
- Live Paddle E2E not verified in CI without credentials
- Extension redirects to website for checkout (by design)

---

## Final verdict

| Criterion | Verdict |
|-----------|---------|
| WL-9 STATUS | **COMPLETE** (code) |
| PADDLE INTEGRATION | **PASS** (code-complete, env-gated) |
| CHECKOUT | **PASS** (when configured) / **NOT CONFIGURED** locally |
| PAYMENT VERIFICATION | **REQUIRED** (live sandbox) |
| WEBHOOKS | **PASS** |
| WEBHOOK SIGNATURE | **PASS** |
| IDEMPOTENCY | **PASS** |
| ACCOUNT MAPPING | **PASS** |
| ENTITLEMENT | **PASS** |
| CREDITS | **PASS** |
| ACCOUNT ISOLATION | **PASS** |
| WEBSITE ↔ EXTENSION | **PASS** |
| AUTH REGRESSION | **PASS** |
| WL-7 LEARNING REGRESSION | **PASS** |
| PRODUCTION BLOCKER | **NO** (code) — live Paddle verification **REQUIRED** |
| LIVE PADDLE VERIFICATION | **REQUIRED** |

**NEXT PHASE:** Configure production Paddle sandbox/live credentials and run manual checkout verification matrix.
