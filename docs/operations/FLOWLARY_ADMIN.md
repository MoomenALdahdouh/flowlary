# Flowlary Admin Panel (1.4)

Internal operator UI at `/admin` on the website. Authorization is **server-side**.

## Who can enter

Emails in `FLOWLARY_FEEDBACK_ADMIN_EMAILS` (same allowlist as the existing feedback/support admin APIs). There is no separate admin password. Frontend hiding is not authorization.

Unauthenticated requests to `/api/admin/*` return **401**. Signed-in non-admin accounts return **403**.

## Routes

| Path | Purpose |
| --- | --- |
| `/admin` | Operational overview (range: 1 / 7 / 30 / 90 days) |
| `/admin/users` | Search, filter, paginate accounts |
| `/admin/users/:id` | Account, entitlement, usage, learning counts, support |
| `/admin/subscriptions` | Paddle subscription mirror |
| `/admin/usage` | AI request aggregates (no keys, no prompt text) |
| `/admin/support` | Existing support inbox |
| `/admin/activity` | Admin audit + signups + webhooks |
| `/admin/settings` | Configured/not-configured status only |

## Data

JSON store (`FLOWLARY_DATA_PATH`). Metrics are real counts; missing billing/provider config is shown as unavailable or not configured. Catalog MRR is an estimate from catalog prices, never implied live Paddle revenue.

## Mutations

Suspend, restore, and session revoke require `{ "confirm": true }` and write `adminAuditEvents`. Support replies and feedback/testimonial patches also append audit rows.

Admins cannot suspend their own account.
