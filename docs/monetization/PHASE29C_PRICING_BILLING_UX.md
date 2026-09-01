# PHASE 29C — Pricing, Account & Billing Experience

Phase 29C is the **commercial UX layer** on top of:

- Phase 29A — entitlement, credits, server authority
- Phase 29B — usage states and soft upgrade prompts

It does **not** redesign monetization amounts, invent plans, or grant Pro from the frontend.

## Pricing model (canonical)

Source: `packages/shared/src/pricing.ts` + Phase 26 matrix.

| Item | Value |
| --- | --- |
| Free | $0 forever |
| Pro monthly | **$9 / month** (900¢) |
| Pro yearly | **$90 / year** (9000¢) |
| Annual savings | **$18 / year** (`9×12 − 90`) |
| Equivalent monthly | **$7.50** |
| Registration trial | **30 days** (`ACCOUNT_TRIAL_DURATION_MS`) |

Copy must never say Unlimited AI, expose Groq/BYOK, or claim a trial duration different from backend.

## Plan presentation

- **Free** and **Pro** are the two permanent cards.
- Trial is messaging inside Pro / Account (“Try Pro free for 30 days”), not a third permanent price tier.
- Free forever section emphasizes local tools that never expire.

## Billing states (Account)

Resolved by `resolveCommercialPlanState()`:

| State | CTA |
| --- | --- |
| signed_out | Create account / Sign in |
| free / expired / trial | Upgrade to Pro (when checkout configured) |
| pro | Manage subscription |
| cancel_at_period_end | Manage subscription (keep access until period end when date known) |
| past_due / payment_failed | Manage billing |
| loading | Checking your plan… |

## Paddle integration

| Step | Authority |
| --- | --- |
| `POST /api/billing/checkout` | Server picks price id (monthly / yearly). Client price ids ignored. |
| Paddle Checkout overlay | UX only |
| `?checkout=complete` | Poll entitlement — **does not grant Pro** |
| `POST /api/billing/webhook` | Signature verified → subscription upsert → entitlement Pro |
| `POST /api/billing/portal` | Server mints portal URL from stored customer id |

Env:

- `PADDLE_PRICE_ID_PRO` — monthly (required for checkout)
- `PADDLE_PRICE_ID_PRO_YEARLY` — yearly (optional; enables annual toggle)

Sandbox catalog (current):

- Monthly: `pri_01m0vzs74d5d2gk5czmk2jh0bq` ($9)
- Yearly: `pri_01m0yswaktpqwzs5hxcp6x8ehf` ($90)

## Checkout flow

1. Signed-in user clicks Upgrade / Start Pro  
2. Website calls `beginProCheckout(interval)` → `POST /api/billing/checkout`  
3. Opens Paddle overlay with server `transactionId`  
4. Success URL `/account?checkout=complete` starts activation polling  
5. Webhook confirms → `isPro` becomes true  

## Cancellation / past due

- Managed in Paddle Customer Portal (no raw Paddle URLs in UI).
- Account shows honest states from server subscription view.
- Do not invent renewal dates when `currentPeriodEnd` is missing.

## Website ↔ extension consistency

| Surface | Destination |
| --- | --- |
| Extension Upgrade | `getUpgradeUrl()` → `/pricing` |
| Extension Manage | `/account` |
| Website Upgrade | same checkout helper |
| Terminology | Free / Trial / Pro + higher everyday AI limits |

## i18n

- English + Arabic catalogs updated (`website/src/i18n/en.ts`, `ar.ts`).
- Pricing numbers and intervals preserved; RTL layout uses existing glass cards.

## Tests

- `tests/unit/shared/pricing.test.ts`
- `tests/unit/website/billing-state.test.ts`
- `tests/integration/phase20-billing.test.ts` (yearly interval)
- Website `seo` / `buttons` honesty checks

## Known external blockers

1. Live production `PADDLE_*` secrets and webhook destination must be configured in deployment.
2. Paddle monthly sandbox price may include a catalog trial period; product registration trial is the 30-day account trial and remains the user-facing trial story.
3. Portal requires a stored `paddleCustomerId` (created after first successful billing event).
4. Full browser E2E of Paddle overlay requires sandbox credentials and approved checkout domain.

## Mismatch notes

| Topic | Status |
| --- | --- |
| Approved $9 / $90 | Matched in shared config + UI fallbacks |
| Live catalog amount | Prefer `/api/billing/config` values; validated in tests against approved cents |
| Trial days | 30 in shared + backend; website derives from that story |
| Yearly checkout | Available only when `PADDLE_PRICE_ID_PRO_YEARLY` is set |
