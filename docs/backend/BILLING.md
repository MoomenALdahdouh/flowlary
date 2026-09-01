# Billing (Paddle)

Code: `backend/src/billing/`. Website checkout: `website/src/account/paddleCheckout.ts`.

**Truth:** webhook signature verified → subscription upsert → entitlement. Not the overlay UI alone.

| Piece | Role |
| --- | --- |
| `PADDLE_API_KEY` | Server SDK |
| `PADDLE_WEBHOOK_SECRET` | Verify notifications |
| `PADDLE_CLIENT_TOKEN` | Browser overlay |
| `PADDLE_PRICE_ID_PRO` / `_YEARLY` | Catalog |
| `PADDLE_ENVIRONMENT` | `sandbox` \| `production` |

Routes: `GET /api/billing/config|status`, `POST /api/billing/checkout|portal`, `POST /api/billing/webhook`.

Free plan uses **credits** (see `docs/product/FREE_PLAN_LIMITS.md`). Student verification can grant Pro-like access without Paddle.

Do not document live secrets. Skills under `~/.agents/skills/paddle-*` describe Paddle patterns; Flowlary’s webhook lives in the **Node gateway**, not Next.js.
