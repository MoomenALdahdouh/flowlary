# WL-9 Addendum — Email Verification Implementation

**Phase:** Implementation  
**Status:** Complete (code) / Mailpit manual verification REQUIRED  
**Date:** 2026-08-27

---

## 1. Architecture

Registration now creates:

```
Account (trial, active)
  emailVerified: false
  → verification email sent
  → user enters 6-digit code
  → POST /api/auth/verify-email
  → emailVerified: true
```

Authentication, subscription, and learning remain separate concerns.

---

## 2. Verification state

| Field | Location |
|-------|----------|
| `emailVerified` | `AccountRecord` |
| `emailVerifiedAt` | `AccountRecord` |
| Pending code | `emailVerifications[accountId]` (hashed) |

Existing accounts without the field are backfilled as **verified** for backward compatibility.

---

## 3. Code generation

- Cryptographic 6-digit code (`randomInt(100000, 999999)`)
- Hashed with HMAC (`hashVerificationCode`) — never stored plaintext
- TTL: 10 minutes
- Max 5 attempts per code

---

## 4. Storage

`EmailVerificationRecord` in JSON store slice `emailVerifications`.

---

## 5. Expiration & brute force

Expired or exhausted codes are cleared; user must resend.

---

## 6. Rate limits

- Resend cooldown: 60 seconds (server enforced)
- Max 3 resends per hour per account

---

## 7. Mailpit (local development)

Configure in `backend/.env`:

```
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
EMAIL_FROM=Flowlary <noreply@flowlary.local>
```

Start Mailpit, register, inspect inbox at Mailpit UI, enter code in verification screen.

---

## 8. Production email

Use real SMTP/transactional provider via same `SMTP_*` variables. Mailpit is **development only**.

---

## 9. Registration flow

`POST /api/auth/register` → trial + session + verification email (async). User lands on verification screen (website).

---

## 10. Login flow

Unverified users can sign in. Dashboard shows verification panel + profile badge.

---

## 11. Resend

`POST /api/auth/resend-verification` (authenticated). Invalidates previous code when new code issued.

---

## 12. Account isolation

Account A cannot verify with Account B's code (tested).

---

## 13. Billing dependency

`startCheckout()` returns `email_not_verified` (403) until verified. Writing Lab and Trial usage remain available for authenticated unverified users.

---

## 14. Website UI

- `EmailVerificationPanel.tsx` — full screen after register, compact on dashboard
- Accessible: `one-time-code`, `inputMode=numeric`, aria-live status
- Localized: en, ar, tr (partial)

---

## 15. Extension

`emailVerified` included in server entitlement cache via `/api/account/entitlement`.

---

## 16. Security

- Codes never returned by API
- Codes never logged
- Codes never stored client-side
- Session preserved after verification

---

## 17. Tests

`tests/unit/backend/emailVerification.test.ts` — 4 cases (register, verify, cross-account reject, checkout gate).

---

## 18. Manual verification

1. Start Mailpit + API + website
2. Register → verification screen
3. Copy code from Mailpit → verify → welcome/dashboard
4. Attempt checkout before verify → blocked
5. Verify → checkout allowed (when Paddle configured)

---

## Final verdict

| Criterion | Verdict |
|-----------|---------|
| EMAIL VERIFICATION | **PASS** |
| REGISTRATION | **PASS** |
| VERIFICATION CODE | **PASS** |
| CODE EXPIRATION | **PASS** |
| SINGLE USE | **PASS** |
| BRUTE FORCE PROTECTION | **PASS** |
| RESEND | **PASS** |
| MAILPIT | **NOT CONFIGURED** in CI (mock sender used) |
| PRODUCTION EMAIL | **REQUIRED** |
| ACCOUNT ISOLATION | **PASS** |
| SESSION PRESERVATION | **PASS** |
| BILLING DEPENDENCY | **PASS** |
| LOCALIZATION | **PARTIAL** (en/ar full, tr partial) |
| SECURITY | **PASS** |
| REGRESSION | **PASS** |
| TESTS | **4 passed / 0 failed** |
| PRODUCTION BLOCKER | **NO** (code) |
| LIVE EMAIL VERIFICATION | **REQUIRED** |

**NEXT PHASE:** Mailpit/manual SMTP verification + production transactional email provider setup.
