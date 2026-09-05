# Authentication and entitlement

## Auth kinds (`backend/src/middleware/auth.ts`)

| Kind | How | Managed AI |
| --- | --- | --- |
| Account JWT | `Authorization: Bearer` | Yes if entitlement allows |
| Install HMAC | `X-Flowlary-Install-Id` + secret | **No** (`account_required`) |
| Dev | `FLOWLARY_ENV=development` or `FLOWLARY_AUTH_DISABLED=1` | Permissive local |

`X-Flowlary-Entitlement` is **telemetry only**. Server computes Pro from Paddle / student / trial / free credits (`resolveServerEntitlementForAccount`).

## Admin

Operator access is the email allowlist `FLOWLARY_FEEDBACK_ADMIN_EMAILS` (`isPlatformAdmin` / `isFeedbackAdmin`). Website `/admin` and `/api/admin/*` use the same JWT as the product. See [FLOWLARY_ADMIN.md](../operations/FLOWLARY_ADMIN.md).

## Secrets

`FLOWLARY_JWT_SECRET`, `FLOWLARY_EXTENSION_AUTH_SECRET` — required in production (`evaluateReadiness`). Never ship in the extension.

## Website

Session cookies / tokens via `website/src/account/client.ts`. Extension sync: `ACCOUNT_IMPORT_SESSION` / website bridge.

## Rate limits

Per-tier AI RPM plus advisor user RPM. Auth forgot/reset use anonymous buckets.
