# Account, Auth, Subscription & Billing — Implementation Report

**Date:** 2026-08-27  
**Status:** Implemented and verified locally  
**Scope:** Website account/auth/billing UX, local API connectivity, session isolation, Writing Lab return path

---

## 1. What was broken

- Registration on `https://flowlary.test` failed and showed **“Flowlary is temporarily unavailable.”**
- The signed-out account page used oversized split cards, weak hierarchy, and a companion panel that competed with the form.
- The form was disabled while session/billing probes ran, so a visitor could not even submit.
- Retry dismissed the alert instead of retrying the request.
- Network/API failures were collapsed into one “unavailable” string, including invalid credentials in some paths.
- Website AI consent was a single global flag, so Account A’s consent could transfer to Account B.
- Website logout invalidated **every** server session for the account, which would also sign the extension out.
- In development, `authDisabled` ignored a valid account JWT for AI requests, so Writing Lab could not attach to the signed-in account.

## 2. Root causes

1. **Mixed content.** The site is served over HTTPS (`https://flowlary.test` via Herd). The website called `http://127.0.0.1:8787`. Browsers block that. `fetch` threw, and the UI mapped it to “temporarily unavailable.”
2. **Local API not running.** Port 8787 was down when this work started. Even after mixed content is fixed, registration needs `npm run dev:api`.
3. **Health/session coupling.** The form waited on account + billing fetches and treated generic request failure as a broken product.
4. **Logout-all-sessions.** `/api/auth/logout` called `logoutAccount()`, which deletes every session for that user.
5. **Dev auth short-circuit.** `authenticateRequest` returned anonymous `dev` auth whenever `FLOWLARY_ENV=development`, even when a valid account JWT was present.

This was **not** hidden with fake success. Registration now hits the real `/api/auth/register` endpoint.

## 3. What was implemented

- Same-origin Vite proxy `/__flowlary-api` → local API (avoids mixed content).
- Focused SaaS auth layout (register / login) and a calmer account center.
- Precise auth error mapping, retry that retries, no pre-request unavailable alert.
- Session generation guards, consent isolation, logout of the **current** session only.
- Dev JWT honored for AI so website login → Writing Lab uses the account.
- Post-register welcome and `next=lab` return to the Writing Lab.
- Tests for the new client, UI, consent isolation, logout scope, and JWT-in-dev.

## 4. Authentication changes

- `resolvePublicApiUrl()` uses `/__flowlary-api` in development and on `*.test` hosts.
- Access tokens that are still valid are kept if refresh fails due to network (not 401).
- Session stores `accountId` when the server returns it.
- Development AI auth: valid account JWT wins over open `dev` auth.

## 5. Registration changes

- End-to-end: `POST /api/auth/register` → session written → trial plan loaded → welcome or Writing Lab.
- Client validation: email format, password ≥ 8, `aria-invalid` on the failing field.
- Duplicate email (409) switches the form to sign-in with a precise message.
- Install bootstrap is best-effort (2.5s timeout). Missing install id does **not** block account creation.
- Live verification (local API): new account created as **trial**, `creditsRemaining: 200`, tokens issued.

## 6. Login changes

- `POST /api/auth/login` with the same session + install linking model.
- Invalid credentials → “Incorrect email or password.” (not unavailable).
- Live verification: login returns the same trial account; `/api/account` and `/api/account/entitlement` agree (`trial` / `inTrial: true` / `isPro: false` / `200` credits).

## 7. Logout changes

- Local session cleared immediately (no flash of the previous account).
- Server invalidates **only** the current `session_id`.
- Other sessions (e.g. extension) remain valid.
- Learning namespaces and other accounts’ local data are not deleted.

## 8. Account switching

- `generation` counter drops in-flight loads after logout/login.
- UI clears account/entitlement before the next login resolves.
- Website learning events remain keyed by `flowlary.web.account.<id>.…`.
- Website AI consent is now per-account (`flowlary.web.account.<id>.ai.consent`), with one-time claim of the legacy global key.

## 9. Subscription changes

- Plan states unchanged and still server-authoritative: `free` | `trial` | `pro` | `cancel_at_period_end` | `past_due` | `payment_failed` | `expired` | `loading` | `signed_out`.
- New accounts still receive the existing **30-day Trial** (not invented).
- Account center shows trial days remaining and what happens when Trial ends.

## 10. Billing changes

- Checkout and portal still use the existing Paddle client (`beginProCheckout`, `openBillingPortal`).
- No fake checkout buttons. Locally `billingConfigured: false`, so the UI offers **View plans** instead of a dead Upgrade action.
- Manage subscription still opens the real portal when `portalAvailable` is true.

## 11. Entitlement behavior

- Website continues to read `/api/account` + `/api/account/entitlement`.
- Credits, plan, trial, and Pro are never taken from client-only state for authorization.
- Writing Lab still uses JWT + install id; in development a presented account JWT is now respected.

## 12. Credit behavior

- Dashboard does not render `0` credits while the account is still loading.
- Exhausted credits stay distinct from signed-out, consent, and service-down (Writing Lab gate order unchanged: auth → consent → API → credits → ready).
- Copy: “AI credits · N remaining · Resets {when}”.

## 13. UI redesign

Signed-out (conversion-focused, single column):

- Flowlary kicker, title, lead
- Compact form card (email, password, show/hide, primary submit)
- Text switcher (sign in / create account)
- Trust line: Free to start · 30-day trial · No credit card
- Secondary links: install extension, view plans

Signed-in account center:

- Profile, Plan, Usage, Product (website / extension / learning), Security
- Welcome after registration with **Start writing** → `/#writing-lab`
- Pro activation banner when `checkout=complete`

Giant split companion card removed.

## 14. Responsive behavior

- Auth shell max-width ~26.5rem, centered, mobile-first single column.
- Dashboard product grid becomes 3 columns from 720px.
- No shrinking of the old two-card desktop layout.

## 15. Accessibility

- Labeled inputs, `aria-invalid`, `aria-describedby` for errors/hints.
- Password toggle: `aria-pressed`, `aria-controls`, accessible name.
- Visible focus on toggle and text buttons.
- Alerts use `role="alert"` only after a real failure.
- Submit `aria-busy` while in flight.

## 16. Localization

- English catalog updated (source of truth).
- Arabic catalog mirrored (RTL).
- Turkish account strings added via `buildLocaleCatalog` overrides; other locales keep English fallbacks.
- No hardcoded auth strings in components.

## 17. Security

- Backend remains authority for plan, credits, subscription.
- Passwords are not logged or stored in `sessionStorage`.
- Session lives in `sessionStorage` (existing model).
- JWT still required for `/api/account` and entitlements.
- Logout no longer globally revokes other devices.
- `ensureLoaded` / `touch` exported from the store only because the learning-events slice already imported them (needed for test resets; not a new auth path).

## 18. Account isolation

- Website consent isolated per account id.
- Learning store already account-scoped; unchanged schema.
- Stale `loadWebAccount` results ignored after generation bump.
- Server logout no longer wipes the extension session for the same account.

## 19. Website ↔ extension connection

- Same email/password account. Website and extension keep their own install IDs and sessions.
- Copy now says: sign in on both surfaces with the same email.
- Linking still happens when `install_id` is sent on register/login.
- After website logout, the extension session remains valid (intentional).

## 20. Tests

Added/updated:

- Website: `client.test.ts` (register/login/logout/error mapping/proxy URL)
- Website: `consent.test.ts` (A ≠ B)
- Website: `Account.test.tsx` (no pre-request unavailable; focused login/register)
- Website: writing lab gate (signed-out ≠ exhausted)
- Website: routes/buttons hashes (`writing-lab`), account copy
- Backend: logout invalidates only current session
- Backend: `authDisabled` honors account JWT
- Billing: `expired` commercial state

**Website suite:** 15 files, 107 tests, pass.  
**Backend suite:** 12 files, 78 tests, pass.

## 21. Regression

- Writing Lab gate order preserved.
- LearningEvent schema, practice, brief, report, coach, translation, layout engines not modified.
- Pricing still uses `FLOWLARY_PRICING` ($9 / $90, 30-day trial, 40 / 200 daily credits).
- Feature-availability hardening tests in the extension currently fail on a missing `requiresAuth` export in `popup/status.ts`. That is **pre-existing** on this branch (this phase did not edit those files).

## 22. Remaining limitations

- **Paddle checkout** is env-gated. Locally billing is not configured, so Upgrade does not invent a payment. Production/sandbox credentials are required for a live card charge.
- **Forgot password** is not offered (no backend reset flow).
- **Browser click-through** of the redesigned page was verified via SSR tests + live API/proxy; the Vite shell is client-rendered, so curl cannot see the React form HTML.
- Local registration requires **both** `npm run dev:web` (this proxy) and `npm run dev:api`.
- Vite must be restarted after `vite.config.ts` proxy changes (done in this session).

---

## Live verification (this environment)

| Check | Result |
|---|---|
| `GET http://127.0.0.1:8787/health` | 200 |
| `POST /api/auth/register` | 200, plan `trial`, 200 credits |
| Duplicate email | 409 `Email already registered` |
| Bad password | 401 `Invalid credentials` |
| Login + account + entitlement | Same trial/credits |
| `https://flowlary.test/__flowlary-api/health` | 200 (same-origin, no mixed content) |
| Proxy register | 200 trial |

**Production blocker: no** for account creation/login once the local API is running. Paid Pro still depends on Paddle env, as before.
