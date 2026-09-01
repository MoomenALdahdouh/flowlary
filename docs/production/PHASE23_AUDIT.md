# Phase 23 — Pre-Implementation Audit

**Date:** 2026-08-26  
**Baseline:** Phase 22A–22E complete  
**Verification commands:** `npm test` (613→621 after Phase 23), `npm run build`, `npm run build:release` — all pass

---

## 1. Current architecture

| Layer | Role |
|-------|------|
| **Extension popup** | Compact control surface (features, plan, open dashboard) |
| **Extension dashboard** | Overview · Progress · Practice · Settings · Privacy · Account |
| **Content script** | Correction, translation, layout on web pages |
| **Background SW** | Messaging, AI gateway, storage, account sync |
| **Backend** | `api.flowlary.com` — AI, auth, billing (Paddle prepared) |
| **Website** | Marketing, legal, account (en/ar) |
| **Shared packages** | Types, learning events, practice, data export, capabilities |

**Product loop (implemented):** Install → Onboarding → Write → Correction → LearningEvent → Progress → Practice → LearningEvent → Progress

---

## 2. UI surfaces & routes

**Popup:** Home control surface only (no Progress/Practice charts).

**Dashboard hash routes:** `overview`, `progress`, `practice`, `settings`, `activity`, `privacy`, `account`

**Settings sections:** Appearance, Writing, AI, Translation, Keyboard Layout, Shortcuts, Learning, Data

**No dead core routes.** Practice and Progress are fully implemented (Phase 22D). No "Coming Soon" on core features.

---

## 3. Storage domains (independent)

| Domain | Key(s) | Clear semantics |
|--------|--------|-----------------|
| Activity | `flowlary.history` | `CLEAR_HISTORY` only |
| Learning events | `flowlary.learning.events` | `CLEAR_LEARNING_EVENTS` |
| Practice | `flowlary.learning.sessions` | Cleared with learning |
| Learning profile | `flowlary.learning.profile` | `RESET_LEARNING_PROFILE` |
| UI locale | `flowlary.ui.locale` | Preserved on data clears |
| Account auth | `flowlary.auth.*` | Logout / full reset |

Phase 22E Data Control Center implements export/import and isolated clears.

---

## 4. Auth

- Install token + optional account session (JWT access/refresh)
- Sign-out clears account session; local learning data preserved
- No account deletion in extension (honest unavailable state)

---

## 5. AI flow

- User consent required (`correction.consentAccepted`)
- `CORRECT_TEXT` / `TRANSLATE_TEXT` via background → `api.flowlary.com`
- English-only correction (`language.ts`, shared correction prompt)
- Translation: 12 languages
- No client-side Groq; no BYOK in user UI
- Failures mapped to user-facing states (`Flowlary AI unavailable`, rate limit, sign in again)

---

## 6. Onboarding (Phase 22B)

**File:** `extension/src/dashboard/onboarding/OnboardingFlow.tsx`

**Steps:** `welcome` → `learning` → `tools` → `ready` (4 screens covering all config areas)

- Welcome: privacy + AI consent (explicit checkbox)
- Learning: level, focus, native language (learning language = English only)
- Tools: translation pair, keyboard layouts, correction mode, live translation
- Ready: summary + "Start writing"

**Skip:** Non-critical steps skippable; profile marked incomplete via defaults where appropriate  
**Completion:** Never re-shows after `onboardingCompleted`  
**Migration:** Existing users with settings seeded; optional setup prompt for existing installs

**Gap vs Phase 23 spec:** Recommended 8-screen flow consolidated into 4 steps (no IA redesign per scope).

---

## 7. Language handling (pre–Phase 23)

| Concept | Pre-23 state |
|---------|--------------|
| UI language | English only (`messages.ts`) |
| Learning language | English only |
| Translation | 12 languages |
| Keyboard layouts | Registry-driven |
| Website | en/ar with RTL + locale switcher |

**Hardcoded strings:** `status.ts`, `history.ts`, parts of `SettingsPanel.tsx`, speed box placeholder.

---

## 8. Accessibility (pre–Phase 23)

- `:focus-visible` in tokens.css
- Toggle switches with `role="switch"`
- Dialogs: `role="alertdialog"`
- Practice: `aria-live`
- Gaps: onboarding focus trap; some status strings outside i18n/a11y catalog

---

## 9. Responsive behavior

- Popup: fixed 360px shell
- Dashboard: breakpoint 840px (sidebar stack), 720px (progress stats)
- Website: 639–1100px breakpoints
- `prefers-reduced-motion` respected in dashboard CSS

---

## 10. Production blockers (external)

| Blocker | Status |
|---------|--------|
| Chrome Web Store listing URL | Not configured (`CHROME_WEB_STORE_URL = null`) |
| Live API / DNS verification | External ops |
| Paddle billing checkout | Env-gated; honest "billing unavailable" UX |
| Manual Chrome E2E on real sites | Recommended pre-release |
| Full Arabic UI translation | Infrastructure only in Phase 23 |

---

## 11. Security baseline (pre–Phase 23)

- Release manifest: `https://api.flowlary.com/*` only (no localhost)
- Release dist scan: no gsk_/Groq keys in bundle (verified post build:release)
- BYOK retired; `retireByokIfNeeded` on startup
- Export strips auth tokens and legacy keys (Phase 22E)

---

## 12. Test baseline

- **613 tests** passing before Phase 23 implementation
- Integration coverage: learning, practice, data control, security, dashboard, onboarding

---

*Audit complete. Phase 23 implementation proceeded per this document.*
