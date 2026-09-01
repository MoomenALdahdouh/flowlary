# Flowlary Data Processing Audit

**Audit date:** 30 August 2026  
**Method:** Repository forensic inspection (website, extension, backend, shared packages)  
**Purpose:** Ground truth for Privacy Policy, Terms, store disclosures, and legal review

This document describes **actual implemented behavior**. It does not claim legal compliance.

---

## 1. Data collected

| Category | Collected | Where | Evidence |
|----------|-----------|-------|----------|
| Email | Yes (account) | Server `AccountRecord` | `backend/src/db/store.ts`, `accountService.ts` |
| Password | Hashed only | Server | scrypt in `crypto.ts` |
| Session tokens | Yes | Server + extension local | JWT 15m; refresh 30d |
| Install ID | Yes | Server + extension | `installs` map, `flowlary.auth.installId` |
| Writing text | Transient + partial persist | API providers + learning store | correction/translation routes; learning events |
| Learning snippets | Yes (signed in) | Extension local + server | max 512 chars/pair server-side |
| Usage metadata | Yes | Server | tokens, latency, credits — no text |
| Paddle IDs | Yes | Server account/subscription | `paddleCustomerId`, `SubscriptionRecord` |
| Student academic email | Yes (verification) | Server pending request | `studentVerificationService.ts` |
| IP address | Rate-limit key only | Server memory | `http.ts` auth routes use `req.socket.remoteAddress` |
| Browser/device analytics | No SDK | — | No analytics in website/extension |

## 2. Data generated

- Correction/translation AI responses (returned to client; may cache locally)
- Learning events from accepted corrections/layout fixes
- Practice session aggregates
- Email verification / password reset tokens (hashed)
- Webhook idempotency records (event ID, type, timestamp — not full Paddle payload)

## 3. Data processed locally

- Keyboard layout remapping (`mapLayout`, Speed Box layout mode)
- Field safety evaluation
- Speed Box UI debounce
- Entitlement display cache (server is billing truth)
- Theme/locale preferences
- Trusted rule explanations (static)

## 4. Data transmitted

| From | To | When | Payload |
|------|-----|------|---------|
| Extension / website | `api.flowlary.com` | Auth, AI, learning sync, billing | See extension/backend routes |
| Backend | Groq API | Managed AI | User text segments, coach/report JSON |
| Backend | Google Translate | Translation when configured | Full translation text |
| Backend | Paddle API | Checkout, portal, webhooks | Customer/subscription ops |
| Backend | SMTP | Transactional email | Verification/reset links |
| Website bridge | Extension SW | Flowlary origins only | Session import via postMessage |

## 5. Data stored

**Server (JSON file store):** accounts, sessions, installs, usage, subscriptions, webhooks, learning events/profile/practice, student records, token hashes.

**Extension (`chrome.storage.local`):** settings, auth tokens, learning data, cache, history (max 50), entitlement cache.

**Website (`localStorage`):** theme, locale, Writing Lab AI consent per account.

## 6. Data retained

| Data | Retention behavior | Verified |
|------|-------------------|----------|
| Local extension data | Until user clears / uninstall | Yes |
| Account record | While account exists | Yes |
| Learning events (server) | Max 2,000/account | Yes |
| Usage records | Max 50,000 FIFO | Yes |
| Webhook events | Max 5,000 FIFO | Yes |
| Translation cache | ~1h in-memory, hash-keyed | Yes |
| Verify/reset tokens | Expire + cleared on use | Yes |
| Statutory billing retention | **LEGAL INPUT REQUIRED** | Not in repo |

## 7. Data deleted

| Action | Mechanism | Scope |
|--------|-----------|-------|
| Clear learning data | `DELETE /api/learning/events` | Server learning + profile + practice |
| Logout | `POST /api/auth/logout` | Single session |
| Password reset | Clears all sessions | Account sessions |
| Local reset | Extension Settings → Data | Active account local data |
| Full account deletion | **NOT IMPLEMENTED** | LEGAL/PRODUCT INPUT REQUIRED |

## 8. Third parties

See `FLOWLARY_STORE_DISCLOSURE_MATRIX.md` and Phase 3 table below.

## 9. Authentication data

- Email/password registration and login
- JWT access + refresh rotation
- Install token (does **not** unlock managed AI in production rules)
- Device session exchange from website to extension
- Email verification required for checkout

## 10. Billing data

- Paddle customer/subscription IDs on account
- Subscription mirror records from webhooks
- No card numbers stored locally
- Approved price IDs only ($4.99/mo, $39/yr)

## 11. Student verification data

- Academic email in pending verification
- Hashed verification token
- HMAC academic email reference index (dedupe)
- Student benefit record (12 months)
- Does **not** verify enrollment or government ID

## 12. Writing content

**Sent to Flowlary API:** correction (≤2000 chars tail), translation text, layout classifier word+context.

**Sent to Groq (via backend):** correction, translation/refinement, layout AI, coach/report payloads (aggregated for coach).

**Sent to Google (via backend):** translation text when Google path active.

**Stored server-side:** learning event original/corrected pairs (≤512 chars each). Usage records exclude text.

**Logged:** Application logs exclude user text (`logger.ts`, gateway metadata only).

## 13. Learning data

- Local: full events, samples, profile, practice
- Remote sync when signed in (POST/GET/DELETE `/api/learning/events`)
- Remote events exclude full `sampleText` — hash + word count only

## 14. Browser/page data

- Content script on `<all_urls>` reads editable fields when features run
- No browsing history collection
- No full page scrape — focused field text only
- Website bridge on flowlary.com for session sync

## 15. Diagnostics/logging

- JSON stdout logs: requestId, model, latency, accountId, operation — no text
- Non-production debug ingest endpoint exists (`/__debug/ingest`) — disabled in production lifecycle

## 16. Security controls

- HTTPS production API
- Password hashing (scrypt)
- JWT + refresh rotation
- Paddle webhook signature verification
- Rate limits by tier
- CORS configuration
- Release build excludes localhost hosts
- No GROQ_API_KEY in client bundles (verified by phase23-security tests)

## 17. User controls

- Pause extension, per-domain exclusions
- Disable live translation (default off)
- Clear local activity/learning/export/import/reset
- Delete server learning data (signed in)
- Sign out / password reset
- AI consent (extension + Writing Lab)
- No self-service account deletion

## 18. Unknown / LEGAL INPUT REQUIRED

| Item | Status |
|------|--------|
| Legal entity name & registered address | Not in repository |
| Privacy/support contact email | Not published (SMTP FROM is outbound only) |
| DPO requirement | Not assessed in repo |
| Governing law & jurisdiction | Not specified |
| Refund policy details | Not specified |
| GDPR/CCPA compliance claims | Must not be claimed without legal review |
| Hosting provider identity for privacy policy | Deployment-dependent |
| Groq/Google data retention at processor | Contract-dependent |
| Minimum age | Not specified |
| Account deletion SLA | Feature not implemented |

---

## Data inventory (summary table)

| Data | Collected? | Local? | Server? | Third party? | Purpose | Retention | User control |
|------|------------|--------|---------|--------------|---------|-----------|--------------|
| Email | Yes | Ext cache | Yes | SMTP | Account | Account lifetime | N/A |
| Password hash | Yes | No | Yes | No | Auth | Account lifetime | Reset |
| Session tokens | Yes | Yes | Yes | No | Auth | TTL / logout | Logout |
| Install ID | Yes | Yes | Yes | No | Device link | Account link | N/A |
| Writing text | On use | History/cache | Learning pairs only | Groq/Google | Features | Bounded/local | Clear data |
| Correction requests | Yes | Cache | Usage meta | Groq | Correction | Cache TTL | Pause |
| Translation requests | Yes | Cache | Usage meta | Google/Groq | Translation | Cache ~1h server | Pause |
| Learning events | Yes | Yes | Yes (signed in) | No | Learning | 2000 cap | Delete |
| Learning progress | Yes | Yes | Yes | No | Learning | Until delete | Delete |
| Practice results | Yes | Yes | Yes | No | Practice | Until delete | Delete |
| Reports | Generated | Export | No full store | Groq narrate | Pro feature | Local | Export |
| Usage/credits | Yes | Cache | Yes | No | Billing | Bounded | View account |
| IP address | Transient | No | Rate limit | No | Abuse prevention | Window only | N/A |
| Error logs | Metadata | No | Stdout | No | Ops | Operator policy | N/A |
| Analytics | No | No | No | No | — | — | — |
| Payment state | Yes | No | Yes | Paddle | Billing | Legal/account | Portal |
| Paddle IDs | Yes | No | Yes | Paddle | Billing | Account | Portal |
| Student email | Yes | No | Yes | SMTP | Verification | Until confirm/revoke | N/A |
| Student token | Hashed | No | Yes | No | Verification | Expiry | N/A |
| Student benefit | Yes | Entitlement cache | Yes | No | Pro access | 12 months | Revoke (server) |

---

## Contradictions resolved

| Prior claim | Actual behavior | Resolution |
|-------------|-----------------|------------|
| Old Privacy §8: learning not uploaded | Learning sync to server when signed in | Privacy rewritten |
| CHROME_WEB_STORE_PRIVACY: text not collected by servers | Text sent to api.flowlary.com | Store draft updated |
| DATA_FLOW: learning "future" | Implemented with sync | Docs aligned |
| "Sent securely" marketing | HTTPS accurate; not a certification | Copy softened |
