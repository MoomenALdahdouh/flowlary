# Phase 18 Report — Product Experience + Full Marketing Website

**Date:** 2026-08-25  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Scope:** Marketing website redesign, Flowlary design system, Chrome popup redesign, account/entitlement UX. Paddle/billing was not implemented.

---

## 1. What was audited

Code was treated as source of truth, not prior phase reports.

- Website: Vite + React 19 + React Router 7, prerendered static routes, English production locale, Arabic catalog structured but disabled.
- Popup: React popup with Home / History / Settings, Phase 17 account login/register/logout/sync, server entitlement labels, BYOK, safety/privacy copy.
- Canonical domains already in active config: `https://flowlary.com`, `https://api.flowlary.com`.
- Chrome Web Store URL is still `null`.
- Billing/Paddle is not connected; `billingAvailable` is always false.

---

## 2. What was redesigned

The marketing site is no longer a static card grid. Home is a product story: hero + correction demo, problem, how it works, correction/translation/live/layout/Speed Box sections with demos, privacy, popup-in-context, environments, final CTA.

Features is storytelling with demos and honest mode badges (AI-powered, local-first, optional, automatic, manual).

Pricing is a Free ($0) / Pro architecture with a disabled Upgrade control and explicit “Billing isn't available yet.”

About, Support, Privacy, and Terms share the same visual system. Support uses an FAQ for common issues instead of a documentation dump. Legal pages sit in a product shell; legal facts were not invented.

The popup header now uses the Flowlary mark, connection state, and account avatar. Home keeps every previous control and surfaces sign-in / create-account, server plan, real usage text, and “Billing isn't available yet.”

---

## 3. Website routes

Unchanged route set, all prerendered:

- `/`
- `/features`
- `/features/writing-correction`
- `/features/translation`
- `/features/live-translation`
- `/features/keyboard-layout`
- `/features/speed-box`
- `/pricing`
- `/about`
- `/support`
- `/privacy`
- `/terms`
- `/blog` (honest empty editorial slot)
- 404

Changelog and Security pages were not added. They would have been empty or duplicative of Privacy.

---

## 4. Popup changes

- New visual system aligned with the website (ink base, refined blue, denser rows).
- Header: logo, connection pill, account avatar → Settings.
- Writing Intelligence: correction, translation, live translation, keyboard layout with real readiness.
- Quick actions: Translate and Fix Layout (wired). Speed Box remains shortcut-only because `RUN_COMMAND` does not dispatch `SPEED_BOX`.
- Account strip uses Phase 17 `status.account` and `status.entitlement` only.
- Settings and History behavior preserved (BYOK, managed consent, languages, layout shortcut, local history).

---

## 5. Design system

Shared tokens for website and popup:

- Surfaces, borders, accent `#5b8cff`, semantic green/yellow/red
- Display/body type scale, radius, shadow, focus rings
- Buttons, badges, cards, toggles, compose-demo chrome, pricing cards
- Motion: page reveal (never opacity-0 hide), demo caret/highlight, reduced-motion kill switch

No new UI library. System font stack (Segoe UI / SF Pro / Helvetica Neue).

---

## 6. Animation system

- Correction demo types, detects, suggests, applies (`recieve` → `receive`, `mesage` → `message`), then holds.
- Translation demo: “Can you send this tomorrow?” → Arabic.
- Layout demo: `lvpfh` → `مرحبا` with Detect / Classify / Remap.
- Scroll reveal animates only when a section enters view; content stays readable if observation fails.
- `prefers-reduced-motion` disables nonessential motion and shows completed demo states.

---

## 7. Account / entitlement integration

Popup continues to call existing `accountLogin`, `accountRegister`, `accountLogout`, `accountSync`. Plan labels prefer `status.account.serverPlan` when signed in. Usage uses `entitlement.remainingMs` / locked / Pro / unavailable — no fabricated meters. Upgrade is not offered in the popup; billing copy is honest.

The marketing site does not host account auth (Phase 17 flow remains in the extension).

---

## 8. Files changed (primary)

Website: design tokens, motion, global CSS, demos, Home/Features/Pricing/About/Support/legal presentation, feature pages, i18n, tests.

Popup: `tokens.css`, `components.tsx` (logo, avatar, account CTAs), `App.tsx` header, `HomeView.tsx` actions, account copy.

Tests: website route/SEO/demo/coming-soon policy; popup render expectations.

---

## 9. Tests

| Suite | Result |
| --- | --- |
| `npm run test:web` | 32 passed |
| `npm test` (shared + backend + extension) | 502 passed |

New coverage: product demo copy on Home, Features storytelling markers, no “coming soon” on primary marketing surfaces, pricing honesty ($0 allowed, no fake `$[1-9]` checkout), popup signed-out Sign in / Create account / billing copy.

---

## 10. Build results

| Command | Result |
| --- | --- |
| `npm run build` | pass |
| `npm run build:release` | pass |
| `npm run build:web` | pass (13 routes + 404 prerendered) |

Website CSS ~20.5 kB / ~5.2 kB gzip. Website JS ~306 kB / ~93 kB gzip (React + Router; no extra UI kit).

`npm run typecheck` at the repo root still fails on pre-existing shared/extension `.ts` import-extension errors. `@flowlary/website` typecheck passes.

---

## 11. Release audit

| Check | Result |
| --- | --- |
| `GROQ_API_KEY` in `extension/dist` | absent |
| `localhost` / `127.0.0.1` in `extension/dist` | absent |
| `flowlary-api.zaixos.com` / `lingo-api.zaixos.com` in dist | absent |
| Release manifest hosts | `https://api.groq.com/*`, `https://api.flowlary.com/*` |
| “Coming soon” on Home/Features/Pricing/About/Support | removed |
| Remaining “coming soon” | Terms §3 legal disclaimer that labels are not an offer to sell |

Visual QA: desktop Home, Features, Pricing, About, Support inspected via headless Chrome. Narrow layout verified at a 500px CSS viewport (Chrome headless will not emulate below ~500px; 390px screenshots were a crop, not a wrap failure). Grid `min-width: 0` and overflow wrapping were added for real phone widths.

---

## 12. Remaining external blockers ONLY

- Chrome Web Store listing URL is still unpublished (`CHROME_WEB_STORE_URL = null`). Get Flowlary → `/support#get-flowlary`.
- Public support/privacy email is not published.
- Paddle/checkout is not connected. Pro Upgrade is disabled by design.
- Arabic locale catalog is incomplete and not enabled.
- `api.flowlary.com` DNS/server deployment and live Groq operation are outside this phase (unchanged from Phase 16/17).
- Legal entity, jurisdiction, and governing law remain marked **For legal review**.

---

## 13. Exact production deployment requirements

This phase does **not** deploy production.

To ship the website:

1. Build with `npm run build:web`.
2. Host `website/dist` at `https://flowlary.com` (HTTPS, `flowlary.com` canonical).
3. Do not point the site at `flowlary-api.zaixos.com` or `lingo-api.zaixos.com`.

To ship the extension:

1. `npm run build:release` (and package via existing release script when publishing).
2. Store listing still required before Get Flowlary can leave Support.

Do not claim Chrome Web Store publication or live API deployment from this work.
