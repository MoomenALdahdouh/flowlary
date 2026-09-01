# Phase 20 — Flowlary Paddle billing

**Product:** Flowlary (ZAIXOS)  
**Website:** https://flowlary.com  
**API:** https://api.flowlary.com  
**Dev API:** http://127.0.0.1:8787  

This document describes the billing architecture as implemented in this repository. Code is the source of truth.

## Current architecture (pre-Phase 20 audit)

Already present:

- Account JWT (register / login / refresh / logout)
- Server entitlement from `account.plan` + trial window + free usage balance
- Managed AI: auth → entitlement → usage → Groq
- `X-Flowlary-Entitlement` is advisory only and never billing truth
- JSON file store (`backend/src/db/store.ts`), single-process
- Billing **interfaces** only (`UnconfiguredBillingProvider`)
- Website `/account` and `/pricing` with no checkout
- Popup shows server plan cache; `billingAvailable` was a literal `false`

Missing before this phase: Paddle checkout, signed webhooks, subscription persistence, portal sessions, Pro from verified Paddle state.

## Target chain

```
User
 → Flowlary website / extension
 → Flowlary account (JWT)
 → POST /api/billing/checkout  (backend chooses price, creates Paddle transaction)
 → Paddle.js overlay (public client token only)
 → Paddle
 → POST /api/billing/webhook  (raw body + Paddle-Signature)
 → Subscription record
 → EntitlementService
 → GET /api/account/entitlement
 → Extension / website / AI gateway
```

Forbidden: client `setPro(true)`, localStorage Pro, checkout.completed as provisioning, client price/plan/amount, `X-Flowlary-Entitlement` as billing truth.

## Paddle contract (current Billing API)

Not Classic (`subscription_created`). Current event names:

| Event | Flowlary action |
| --- | --- |
| `subscription.created` | UPSERT subscription; map entitlement |
| `subscription.updated` | UPSERT |
| `subscription.activated` | UPSERT |
| `subscription.trialing` | UPSERT (Paddle product trial ≠ registration trial) |
| `subscription.canceled` | UPSERT; Pro until `current_period_end` if still in period |
| `subscription.paused` | UPSERT; Pro revoked |
| `subscription.resumed` | UPSERT |
| `subscription.past_due` | UPSERT; keep Pro (dunning grace); show payment-failed |
| `transaction.completed` | Link customer/subscription if present; do not invent Pro without subscription state |
| `transaction.payment_failed` | Mark payment failed; do not immediately revoke Pro |
| `transaction.past_due` | Same as payment failure policy |
| `customer.created` / `customer.updated` | Link `ctm_` to account when `custom_data.flowlary_account_id` is known |
| Other subscribed types | 200 no-op |

Webhook:

- Header `Paddle-Signature`: `ts=…;h1=…`
- HMAC-SHA256 of `` `${ts}:${rawBody}` `` with **this destination’s** secret
- Verify on the **raw** body (never JSON.parse then re-serialize)
- Invalid signature → **non-2xx** (Paddle retries). Never 2xx on failed verify
- Idempotency key: `event_id`
- Unordered events: skip apply if `occurred_at` is older than last applied event for that subscription
- Ack within 5 seconds; no outbound Paddle list calls inside the webhook handler

Checkout:

- Backend `POST /transactions` with server `PADDLE_PRICE_ID_PRO` and `custom_data.flowlary_account_id`
- Client opens Paddle.js with `transactionId` only (cannot change price or account id)
- `checkout.completed` / success URL is UX only

Portal:

- `POST /customers/{customer_id}/portal-sessions` with server API key
- Customer id from the authenticated account record, never from the client body

## Subscription → entitlement mapping

| Paddle `status` | Flowlary subscription | Entitlement |
| --- | --- | --- |
| `active` | `active` | **Pro** |
| `trialing` | `trialing` | **Pro** (paid catalog trial, not the 7-day registration trial) |
| `past_due` | `past_due` | **Pro** during dunning; UI: payment issue |
| `active`/`trialing` + `scheduled_change.action = cancel` | `active` + `cancelAtPeriodEnd` | **Pro until `current_period_end`** |
| `canceled` and now &lt; `current_period_end` | `canceled` + period still open | **Pro until period end** |
| `canceled` and period ended | `canceled` / expired | **Free** |
| `paused` | `paused` | **Free** (no Pro) |

Registration trial (`plan: trial`, 7 days) remains server-side and is **not** a Paddle trial. Paid access sets `plan: pro`. After Pro ends, the account returns to **free** with remaining `usageBalanceMs` (trial is not restored).

`X-Flowlary-Entitlement` still never elevates plan.

## Plans

`free` | `trial` | `pro`

No client-invented enterprise/pro flags. No `PADDLE_PRICE_ID_FREE` — Free is a Flowlary account default, not a Paddle catalog price.

## Usage vs billing

| Plan | Managed AI | Debit `usageBalanceMs` | Rate limit tier |
| --- | --- | --- | --- |
| trial (registration) | allowed until `trialEndsAt` | no | trial |
| free | allowed while `usageBalanceMs > 0` | yes, on success | free |
| pro | allowed while subscription grants Pro | no | pro |
| BYOK correction | local Groq key | never via Flowlary | n/a (not billed) |

No overage billing. Usage does not reset on login. Free allowance: `ACCOUNT_FREE_BALANCE_MS` (2 hours). Trial: 7 days. Pro: no Free-balance debit.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `PADDLE_ENVIRONMENT` | backend | `sandbox` \| `production` (default `sandbox`) |
| `PADDLE_API_KEY` | backend only | Transactions, portal, optional price read |
| `PADDLE_WEBHOOK_SECRET` | backend only | Signature verify (`PADDLE_NOTIFICATION_WEBHOOK_SECRET` accepted as alias) |
| `PADDLE_CLIENT_TOKEN` | backend; returned by `GET /api/billing/config` | Public Paddle.js token |
| `PADDLE_PRICE_ID_PRO` | backend only | Server-controlled Pro price |

Never place API key or webhook secret in the extension, website bundle, manifest, or git.

Development uses **sandbox**. Production live billing requires explicit `PADDLE_ENVIRONMENT=production` plus live key, live price, live webhook destination, and live secret. Do not mix sandbox `ctm_`/`sub_`/`pri_` IDs with production state.

## API routes

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| GET | `/api/billing/config` | none | Public checkout availability + client token (no secrets) |
| POST | `/api/billing/checkout` | account JWT | Create Paddle transaction; ignore client price/plan/amount |
| POST | `/api/billing/portal` | account JWT | Mint customer portal URL from stored `paddleCustomerId` |
| POST | `/api/billing/webhook` | Paddle signature | Raw body; verify; upsert; map plan |
| GET | `/api/account` | account JWT | Account + usage + billing/subscription view |
| GET | `/api/account/entitlement` | account JWT | Authoritative entitlement |

## Persistence

JSON store fields:

- Account: `paddleCustomerId`, `paddleSubscriptionId`, `billingEnvironment`
- Subscription: status, price id, period start/end, `cancelAtPeriodEnd`, `paymentFailed`, `lastWebhookAt`, `billingEnvironment`
- Webhook ledger: `event_id`

**BLOCKED_FOR_PRODUCTION:** this store is single-process (exclusive lock + atomic rename). Do not run multiple API instances against one JSON file for live billing. Migrate to a multi-writer database before horizontal scale.

## Frontend

- Website Account: real server plan, subscription status, renewal, cancel-at-period-end, Upgrade (checkout) or Manage (portal)
- After checkout return: poll entitlement; show “Your subscription is being activated.” until `isPro`
- Pricing: Free `$0`; Pro amount only if the API returns a configured Paddle price; otherwise “Shown at checkout”. No fabricated list prices
- Popup: server entitlement only for Pro; Upgrade / Manage open https://flowlary.com/account; “Billing unavailable” when config says so
- Extension does not embed Paddle.js or secrets

## Security boundaries

- Webhook signature required
- Checkout transaction created server-side
- Portal customer id from session account
- Client token is public by design; API key and webhook secret are not
- BYOK is independent of Paddle
- AI gateway unchanged except Pro allowance comes from subscription-backed `plan: pro`

## Testing strategy

- Unit: HMAC valid / invalid / tampered / duplicate / unknown account / status mapping
- Integration: register → free/trial → checkout init (mocked Paddle) → webhook → Pro; cancel until period end → Free; `past_due` keeps Pro
- Mocked tests are **not** live Paddle verification
- Live sandbox: only if credentials exist (API key, webhook secret, client token, reachable webhook URL)

## Legal

Terms/Privacy may describe that Paddle processes card payments when checkout is used. Refund, tax, and company-registration language stay **for legal review** — this phase does not invent a refund policy or claim compliance.
