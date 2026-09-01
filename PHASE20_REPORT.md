# Phase 20 Report — Flowlary real Paddle billing

**Date:** 2026-08-25  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Method:** AUDIT → DESIGN → IMPLEMENT → TEST → BUILD → SECURITY AUDIT → SANDBOX VERIFY  

Code is the source of truth. This phase does **not** claim production billing is live.

Statuses used below: **VERIFIED** · **IMPLEMENTED** · **NOT VERIFIED** · **BLOCKED_EXTERNAL** · **NOT IMPLEMENTED** · **FAILED** · **BLOCKED_FOR_PRODUCTION**

---

## 1. Initial audit

**Status:** VERIFIED

Before this phase the repository already had:

- Account JWT (register / login / refresh / logout)
- Server entitlement from `account.plan`, 7-day registration trial, and free usage balance
- Managed AI gateway: auth → entitlement → usage → Groq
- `X-Flowlary-Entitlement` advisory only
- JSON file store (single-process)
- Billing **interfaces only** (`UnconfiguredBillingProvider`)
- Website `/account` and `/pricing` with no checkout
- Popup showing “billing unavailable”

Missing: Paddle checkout, signed webhooks, subscription persistence, portal sessions, Pro from verified Paddle state.

ZAIXOS sandbox catalog contained Clinic OS and ZAIXOS Voice products. Those IDs were **not** reused. A Flowlary-only sandbox product was created instead.

Design: `docs/production/PHASE20_PADDLE_BILLING.md`

---

## 2. Paddle architecture

**Status:** IMPLEMENTED (code) · NOT VERIFIED (live payments)

```
User
 → Website / Extension
 → Flowlary account JWT
 → POST /api/billing/checkout   (server creates Paddle transaction; client price/plan/amount ignored)
 → Paddle.js overlay (public client token from GET /api/billing/config)
 → Paddle
 → POST /api/billing/webhook    (raw body + Paddle-Signature HMAC)
 → Subscription record
 → EntitlementService
 → GET /api/account/entitlement
 → Extension / website / AI gateway
```

Checkout uses a **server-created transaction** (`transactionId`) so the client cannot change `price_id` or `flowlary_account_id`.

`checkout.completed` / success URL is informational. Pro is granted only after a verified webhook updates subscription state.

---

## 3. Files changed

**Status:** IMPLEMENTED

Principal additions/changes:

| Area | Files |
| --- | --- |
| Design | `docs/production/PHASE20_PADDLE_BILLING.md` |
| Shared | `packages/shared/src/account/types.ts`, `packages/shared/src/types.ts` |
| Backend | `backend/src/config/env.ts`, `backend/src/db/store.ts`, `backend/src/billing/*`, `backend/src/services/accountService.ts`, `backend/src/routes/http.ts`, `backend/src/index.ts`, `backend/.env.example` |
| Website | Account, Pricing, Terms, Privacy, billing client, Paddle.js overlay, i18n |
| Extension | Server entitlement cache, popup/account billing CTAs, no Paddle secrets |
| Tests | `tests/unit/backend/paddle-webhook.test.ts`, `tests/integration/phase20-billing.test.ts` |

---

## 4. Data model

**Status:** IMPLEMENTED

Account additions: `paddleCustomerId`, `paddleSubscriptionId`, `billingEnvironment`.

Subscription record: Paddle customer/subscription ids, status, price id, period start/end, `cancelAtPeriodEnd`, `paymentFailed`, `lastWebhookAt`, `lastEventOccurredAt`, `billingEnvironment`.

Webhook ledger: `event_id` (capped).

**BLOCKED_FOR_PRODUCTION:** JSON file store remains single-process. Do not run multiple API instances against one file for live billing.

---

## 5. Checkout flow

**Status:** IMPLEMENTED (code) · BLOCKED_EXTERNAL (live overlay)

`POST /api/billing/checkout` (account JWT):

- Requires `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_ID_PRO`
- Creates Paddle transaction with server Pro price + `custom_data.flowlary_account_id`
- Returns `transactionId` + public client token
- Ignores client `priceId` / `plan` / `amount`

Website Account “Upgrade to Pro” opens Paddle.js with that `transactionId`. Success URL is `/account?checkout=complete`. The page then polls entitlement and shows “Your subscription is being activated.” until `isPro`.

Sandbox overlay cannot be completed here: the sandbox API key lacks `client_token.write` / `client_token.read`, and `backend/.env` is absent.

---

## 6. Webhook flow

**Status:** IMPLEMENTED (code + mocked tests) · BLOCKED_EXTERNAL (live delivery)

`POST /api/billing/webhook`:

1. Read raw body
2. Verify `Paddle-Signature` (`ts` + HMAC-SHA256 of `` `${ts}:${rawBody}` ``)
3. Reject invalid signatures with **non-2xx**
4. Parse JSON only after verify
5. Dedupe on `event_id`
6. UPSERT subscription; map entitlement
7. Unknown account → 200, no Pro
8. Unsupported event → 200 no-op

Current events handled: `subscription.created|updated|canceled|paused|resumed|past_due|activated|trialing`, `transaction.completed|payment_failed|past_due`, `customer.created|updated`.

No sandbox notification destination exists on the Paddle account (list returned empty). Live webhook delivery is **BLOCKED_EXTERNAL**.

---

## 7. Entitlement flow

**Status:** IMPLEMENTED · VERIFIED (mocked)

If a subscription record exists, it wins:

| Paddle / stored status | Entitlement |
| --- | --- |
| `active` / `trialing` | Pro |
| `past_due` | Pro (dunning grace) + payment-failed UI |
| `canceled` with future `current_period_end` | Pro until period end |
| `canceled` after period end | Free |
| `paused` | Free |

Registration trial (`plan: trial`, 7 days) is **not** a Paddle trial. After paid Pro ends, the account is Free (trial is not restored).

Without a subscription record, `setAccountPlan('pro')` still works for server-side ops/tests. The client cannot elevate via `X-Flowlary-Entitlement`.

AI gateway contracts were not rewritten. Pro uses the existing Pro rate-limit tier. Free still debits `usageBalanceMs`. Pro does not. BYOK is unchanged and not billed through Paddle.

---

## 8. Account integration

**Status:** IMPLEMENTED

Website `/account` shows server plan, subscription status, remaining usage, period end, cancel-at-period-end, payment issue copy, Upgrade (checkout) or Manage (portal). Completing checkout does not display “You are Pro” until the API says `isPro`.

---

## 9. Popup integration

**Status:** IMPLEMENTED

Signed-in popup uses the last **server** entitlement cache. Local license/trial cannot display Pro. Refresh on sign-in, register, ACCOUNT_SYNC, startup, and GET_STATUS with a 5-minute TTL. Upgrade / Manage open `https://flowlary.com/account` (production build) without embedding Paddle.js or secrets.

---

## 10. Pricing integration

**Status:** IMPLEMENTED

Free is `$0`. Pro list amount is shown only if `GET /api/billing/config` returns a Paddle catalog price; otherwise “Shown at checkout”. No fabricated `$9.99` on the static page. Upgrade links to `/account`. Payments copy names Paddle.

---

## 11. Cancellation

**Status:** IMPLEMENTED (mapping + portal) · NOT VERIFIED (live cancel)

Manage subscription mints a Paddle customer portal session from the **stored** customer id. Cancel-at-period-end keeps Pro until `current_period_end`. Immediate terminal cancel with elapsed period → Free.

---

## 12. Payment failure

**Status:** IMPLEMENTED (mapping) · NOT VERIFIED (live dunning)

`subscription.past_due` / `transaction.payment_failed` keep Pro and set `paymentFailed` for UI. Account data is not deleted. Unlimited access is not granted.

---

## 13. Security

**Status:** VERIFIED (repo + release artifacts)

- API key and webhook secret: backend env only (`.env.example` empty placeholders)
- Public client token served from `GET /api/billing/config` only when checkout is configured
- Website source tests forbid `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` / `GROQ_API_KEY`
- `extension/dist` and `website/dist`: no `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `GROQ_API_KEY`, `FLOWLARY_JWT_SECRET`, `pdl_sdbx`, `pdl_ntfset`
- Release extension endpoints: `https://api.flowlary.com` and `https://flowlary.com` (no localhost)
- Client price/plan cannot create a cheaper/forged checkout
- Unverified webhooks rejected
- Duplicate `event_id` is a successful no-op

---

## 14. Tests

**Status:** VERIFIED

| Suite | Result |
| --- | --- |
| `npm test` | **534 passed** |
| `npm run test:web` | **36 passed** |
| Webhook signature / tamper / duplicate / unknown account / Pro grant / cancel-until-period-end / past_due / unsupported event / malformed JSON / checkout ignores client price | **VERIFIED** (mocked Paddle) |

These tests are **not** live Paddle verification.

---

## 15. Sandbox verification

**Status:** BLOCKED_EXTERNAL

| Check | Result |
| --- | --- |
| Sandbox MCP API | Ready; used to list catalog and create Flowlary Pro product/price |
| Flowlary sandbox product | `pro_01m0vzs70wg36vzjfsv1zf6p2g` |
| Flowlary sandbox monthly price | `pri_01m0vzs74d5d2gk5czmk2jh0bq` (900 USD cents — **sandbox placeholder, not a published live price**) |
| Client token create/list | **BLOCKED_EXTERNAL** — API key lacks `client_token.write` / `client_token.read` |
| Notification destination | None configured |
| `backend/.env` | Absent |
| Live sandbox payment → webhook → Pro | **NOT VERIFIED** |

Do not treat the sandbox catalog amount as a customer-facing offer until business confirms it.

---

## 16. Production verification

**Status:** BLOCKED_EXTERNAL

Required and not present in this session:

- Paddle Live account + live product/price
- `PADDLE_ENVIRONMENT=production`
- Live API key, live client token, live webhook destination + secret
- `https://api.flowlary.com/api/billing/webhook` reachable with TLS
- Approved checkout domain `flowlary.com`
- Confirmed legal entity / refund policy

Historical hosts `flowlary-api.zaixos.com` / `lingo-api.zaixos.com` are not used in active billing routes.

---

## 17. Remaining blockers

| Item | Classification |
| --- | --- |
| Paddle client token (dashboard permission) | BLOCKED_EXTERNAL |
| Webhook destination + `PADDLE_WEBHOOK_SECRET` | BLOCKED_EXTERNAL |
| `backend/.env` (API key, webhook secret, client token, price id) | BLOCKED_EXTERNAL |
| Live sandbox payment E2E | BLOCKED_EXTERNAL |
| Public webhook URL / tunnel for local Paddle delivery | BLOCKED_EXTERNAL |
| Production DNS/TLS for `api.flowlary.com` / `flowlary.com` | BLOCKED_EXTERNAL (from Phase 19; still true unless independently fixed) |
| Live Groq (`GROQ_API_KEY`) | BLOCKED_EXTERNAL |
| JSON store multi-instance | BLOCKED_FOR_PRODUCTION |
| Refund / tax / registered-entity legal language | NOT VERIFIED (flagged for legal review) |
| Chrome extension store listing E2E | NOT VERIFIED |

---

## 18. Exact production activation steps

1. Create **Paddle Live** product “Flowlary Pro” and a recurring price. Do not reuse sandbox IDs or other ZAIXOS catalog IDs.
2. Create a live **client-side token** for `flowlary.com`.
3. Approve checkout domain `flowlary.com` and set the default payment link.
4. Create a notification destination: `https://api.flowlary.com/api/billing/webhook` subscribed to the subscription, transaction, and customer events listed in the design doc. Store that destination’s secret as `PADDLE_WEBHOOK_SECRET`.
5. Deploy backend with:
   - `FLOWLARY_ENV=production`
   - `PADDLE_ENVIRONMENT=production`
   - `PADDLE_API_KEY` (live)
   - `PADDLE_WEBHOOK_SECRET` (live destination)
   - `PADDLE_CLIENT_TOKEN` (live public token)
   - `PADDLE_PRICE_ID_PRO` (live `pri_…`)
   - Existing JWT / Groq / CORS production secrets
6. Confirm `/health` shows `billingConfigured: true` and `paddleEnvironment: "production"`.
7. Complete one live or sandbox (as intended) payment, confirm webhook 2xx in the Paddle dashboard, then confirm `GET /api/account/entitlement` shows `isPro: true` **before** any UI says Pro.
8. Legal review of Terms/Privacy billing paragraphs before treating them as a complete commercial contract.
9. Move off the JSON file store before running more than one API process.

---

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| Paddle architecture implemented | IMPLEMENTED |
| Billing isolated from core AI contracts | IMPLEMENTED |
| Backend controls billing truth | VERIFIED (tests) |
| Checkout implemented | IMPLEMENTED |
| Webhook implemented + signature verified | VERIFIED (mocked) |
| Webhook idempotency | VERIFIED (mocked) |
| Subscription persisted | IMPLEMENTED |
| Entitlement derives from subscription | VERIFIED (mocked) |
| Account / popup / pricing use server state | IMPLEMENTED |
| Upgrade / cancel / payment-failure mapping | IMPLEMENTED |
| Customer portal session | IMPLEMENTED |
| BYOK independent | IMPLEMENTED |
| No client billing bypass | VERIFIED (tests) |
| No secrets in client/dist | VERIFIED |
| Sandbox live payment | BLOCKED_EXTERNAL |
| Production live payment | BLOCKED_EXTERNAL |
| `npm test` / `build` / `build:release` / `build:web` | VERIFIED |
| Legal billing language reviewed | IMPLEMENTED (honest + for-legal-review; not claimed compliant) |

---

**Phase 20 local work is complete.** Flowlary is **not** production-billing-ready until a real Paddle webhook has been verified end-to-end against this backend and the API reports Pro.
