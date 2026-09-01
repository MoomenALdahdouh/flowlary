# WL-9 — Production Email Verification Implementation

**Status:** COMPLETE (automated tests) · Manual Mailpit acceptance documented below  
**Date:** 2026-08-27

## Summary

Flowlary accounts now use **link-based email verification** with cryptographically random tokens, hashed storage, and a dedicated website verification page. Registration still creates a **30-day Trial** with **200 daily AI credits** immediately; verification is orthogonal to entitlement.

## Architecture

| Concern | Source of truth |
|--------|------------------|
| Account identity | `AccountRecord.id` in JSON store |
| Email | `AccountRecord.email` |
| Verification state | `AccountRecord.emailVerified` + `emailVerifiedAt` |
| Active token | `EmailVerificationRecord` keyed by `accountId` (one active token per account) |
| Trial | `AccountRecord.plan === 'trial'` + `trialEndsAt` |
| AI credits | Server usage fields on account + entitlement API |

### Token lifecycle

1. **Registration** → `issueVerificationToken()` generates `randomBytes(32)` base64url token.
2. **Storage** → HMAC-SHA256 hash (`hashVerificationToken`) stored in `EmailVerificationRecord.tokenHash`; raw token never persisted.
3. **Email** → SMTP sends HTML with **Verify email** button + fallback URL:  
   `{FLOWLARY_WEB_ORIGIN}/account/verify-email?token=...`
4. **Verification** → `GET` or `POST /api/auth/verify-email` validates hash lookup, expiry (24h), single-use; marks account verified and clears token record.
5. **Resend** → `POST /api/auth/resend-verification` (authenticated) invalidates prior token, issues new token, 60s cooldown between resends, max 3/hour.

### API endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | No | Creates account + sends verification email |
| GET | `/api/auth/verify-email?token=` | No | Verify via email link |
| POST | `/api/auth/verify-email` `{ token }` | No | Verify via JSON body |
| POST | `/api/auth/resend-verification` | Bearer JWT | Resend verification email |

**Outcomes:** `verified`, `already_verified`, `invalid_token`, `expired_token`, `server_error`

### Frontend routes

| Route | Purpose |
|-------|---------|
| `/account?mode=register&next=lab` | Registration with Writing Lab destination preserved |
| `/account/verify-email?token=` | Token verification, welcome, error states |
| `/account` | Account center, verification panel for unverified users |

**Safe redirect:** `?next=` accepts only `lab` and `checkout` (`website/src/account/safeNext.ts`). Stored in `sessionStorage` through registration → verification → welcome.

## Environment variables

```env
# SMTP (Mailpit local: 127.0.0.1:1025)
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=0
EMAIL_FROM=Flowlary <noreply@flowlary.local>

# Verification link origin (no trailing slash)
FLOWLARY_WEB_ORIGIN=https://flowlary.test   # local Herd
# FLOWLARY_WEB_ORIGIN=https://flowlary.com  # production
```

Production SMTP uses the same variables with a real relay; Mailpit is **not** hardcoded.

## Mailpit local setup

1. Start Mailpit (e.g. `mailpit` or Docker on port 1025).
2. Configure `backend/.env` with `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `FLOWLARY_WEB_ORIGIN=https://flowlary.test`.
3. Start API: `npm run dev:api`
4. Start website: `npm run dev:web`
5. Open Mailpit UI (default `http://127.0.0.1:8025`).

## Security model

- 256-bit random tokens; stored as HMAC hashes only
- 24-hour expiration; single-use; account-scoped lookup
- Resend rate limit: 60s cooldown, 3/hour per account
- No account enumeration on verify (generic `invalid_token`)
- Open redirect prevented for `next` parameter
- Billing checkout gated on `emailVerified` (403 `email_not_verified`)

## Trial & credit preservation

- Registration sets `plan: trial`, `trialEndsAt: now + 30 days`
- Trial daily limit: `PRO_DAILY_CREDITS` (200)
- Verification endpoints do **not** call AI gateway, Paddle, or debit credits
- Covered by `emailVerification.test.ts` — trial duration and credits unchanged after verify

## Account isolation

- Token hash maps to exactly one `accountId`
- Cross-account token use returns `invalid_token` after first account consumes or invalidates token
- Resend replaces token hash; old link stops working

## Extension

- `emailVerified` exposed on entitlement sync (`extension/src/config/accountAuth.ts`)
- Website verification does not sign out extension sessions
- Extension auth unchanged

## Files changed (primary)

**Backend:** `emailVerificationService.ts`, `emailService.ts`, `crypto.ts`, `store.ts`, `routes/http.ts`, `config/env.ts`  
**Website:** `pages/VerifyEmail.tsx`, `pages/Account.tsx`, `account/EmailVerificationPanel.tsx`, `account/client.ts`, `account/safeNext.ts`, `App.tsx`, i18n `en/ar/tr`  
**Tests:** `tests/unit/backend/emailVerification.test.ts`, `website/src/account/safeNext.test.ts`

## Test results

| Suite | Passed | Failed |
|-------|--------|--------|
| Backend (all) | 85 | 0 |
| Website (all) | 109 | 0 |

Email verification tests (7): registration + trial + link email, GET verify, reuse/cross-account, expiry, resend invalidation + cooldown, billing gate, zero credit consumption.

## Manual acceptance checklist

| Step | Result |
|------|--------|
| Register at `/account?mode=register&next=lab` | NOT RUN (requires local Herd + Mailpit) |
| Trial + 200 credits | Covered by automated tests |
| Mailpit email + click verify | NOT RUN |
| Welcome + Start writing → Writing Lab | Implemented; NOT RUN E2E |
| Extension not signed out | Architecture preserved; NOT RUN E2E |

**To run locally:** follow Mailpit setup above, complete steps 1–23 from WL-9 spec, confirm learning event after Writing Lab analyze.

## Known limitations

- Turkish locale inherits partial account strings from English catalog for non-verification fields (pre-existing)
- SMTP client is minimal (adequate for Mailpit; production should use TLS relay with `SMTP_SECURE=1` when required)
- Verification email does not embed `?next=` (destination preserved via `sessionStorage` when user registered on website)

## Next phase

**WL-10 — Paddle Billing & Subscription Production Implementation**
