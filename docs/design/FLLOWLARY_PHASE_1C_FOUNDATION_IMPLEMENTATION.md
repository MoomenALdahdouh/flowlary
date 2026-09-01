# Flowlary — Phase 1C  
## Design System Foundation Implementation

**Date:** 2026-08-30  
**Status:** PARTIAL (foundation implemented; page migration deferred; one pre-existing extension test still failing)

**Label:** IMPLEMENTED / NOT IMPLEMENTED / DEFERRED

---

## 1. What changed

Phase 1C established the **visual foundation** without redesigning pages, APIs, or product logic.

- Shared `--fl-*` tokens evolved (values + additive tokens; **names of brand tokens kept**).
- Light surfaces are **solid** (`#ffffff` / `#f8fafc`), not 55% glass.
- Display/H1/H2/H3 type scale reduced.
- Website `.btn` anatomy: solid primary, solid secondary, no pill on the primitive, no decorative gradient/glow.
- Website `.card` / `.badge` defaults: solid Level 1, 8px badges, RTL kicker/badge policy.
- New primitives: `Alert`, `Input`, `Field`, extra button variants.
- Surface utility classes `.fl-surface-0/1/2` and overlay.
- Popup **primary** button: solid accent, min-height 40px (no 28px primary).
- Ambient `hero-stage-glow` infinite animation disabled.
- `glass.css` **kept**; glass still used by header/nav and unmigrated page CSS.

---

## 2. Files changed

| File | Role |
|------|------|
| `packages/shared/src/tokens.css` | Token foundation |
| `website/src/styles/tokens.css` | RTL / Arabic font token mapping |
| `website/src/styles/global.css` | Buttons, cards, badges, fields, alerts, surfaces |
| `website/src/styles/glass.css` | Additive Level 1/2 surface classes |
| `website/src/styles/motion.css` | Disable infinite hero glow |
| `website/src/components/Ui.tsx` | Button variants + Alert/Input/Field/Badge pill |
| `extension/src/popup/tokens.css` | Primary action fill + 40px min-height |
| `website/src/__tests__/design-foundation.test.tsx` | Foundation + commercial constant guards |

---

## 3. Tokens added

`--fl-text-disabled`, `--fl-info`, `--fl-info-soft`  
`--fl-ai-ready|working|success|unavailable|exhausted`  
`--fl-learn-discovered|practicing|improving|completed`  
`--fl-font-arabic`, `--fl-text-h4`, `--fl-line-body`, `--fl-line-body-ar`  
`--fl-radius-pill`, `--fl-control-height`, `--fl-control-height-compact`  
`--fl-bp-sm|md|lg|xl`

---

## 4. Tokens modified

| Token | Change |
|-------|--------|
| `--fl-text-display/h1/h2/h3/label` | Smaller, spec-aligned clamps |
| Light `--fl-surface`, `--fl-surface-2/3` | Solid whites/grays |
| Light `--fl-input-bg`, `--fl-control-bg`, `--fl-pane` | Solid |
| `--fl-accent-glow`, `--fl-hero-glow`, `--fl-atmosphere-*` | Weaker |
| `--fl-glass-blur*` | 12px / 10px (chrome still uses glass classes) |
| `--fl-shadow*` | Less glow; border-first `--fl-shadow-glow` |
| Light `--fl-faint` | `#5b6b82` (caption contrast) |
| Light `--fl-warn` | `#9a7209` (AA for small warning text) |
| Light `--fl-snow-glass` | More opaque header chrome |

**Unchanged brand hex:** `#5b8cff` / `#315fd6`, `#05070b` / `#f4f8fd`, `#f3f6fb` / `#0a1628`, `--fl-on-accent` pair.

**`--fl-state-translate` purple:** KEEP as **feature-only** tint; not used in new brand chrome.

---

## 5. Components modified

- `Button`: variants `primary | secondary | tertiary | ghost | danger | link` (existing `to`/`href`/busy API kept).
- `Badge`: default 8px; optional `pill`.
- `Card`: still `class="card"`; CSS now solid.

## 6. Components added

- `Alert` (info/success/warning/error) — **not wired into existing pages**.
- `Input` / `Field` — **not replacing Account forms**.

---

## 7. Intentionally NOT changed

Homepage, pricing, account, dashboard, Writing Lab layouts  
Auth/billing/Paddle/student/credits/pricing constants  
AI gateway, APIs, extension engines, DOM/safety, bridge  
`glass.css` deleted? **No**  
All `999px` page/nav usage  
Popup secondary glass action grid (except primary fill)  
Account `.ac-auth-card` glass  
External fonts / Tailwind / new libraries  

---

## 8. Compatibility

- Existing `btn btn-primary` / `btn-secondary` / `btn-ghost` class names preserved.
- `GetFlowlaryButton` destinations unchanged.
- Pages that override `.btn` (e.g. `.pr-card-btn`) still local — **DEFERRED** migration.
- CSS variables `--fl-bp-*` cannot drive `@media` in all browsers; old media queries **KEEP**.

---

## 9. Tests

| Suite | Result |
|-------|--------|
| `@flowlary/shared` | **PASS** 126 |
| `@flowlary/website` | **PASS** 127 (includes 5 new foundation tests) |
| `@flowlary/backend` | **PASS** 127 |
| `@flowlary/extension` | **FAIL** 1 pre-existing: `wl1-learning-path-reconnection.test.ts` (layout event length 0) — **not caused by CSS tokens** |
| `typecheck` shared + website | **PASS** (website also via `build:web`) |
| Root `npm run typecheck` | **FAIL** on extension (`include: ["src", "../tests"]` pulls backend `.ts` imports) — **pre-existing**, not introduced here |

---

## 10. Builds

| Build | Result |
|-------|--------|
| `npm run build:web` | **PASS** (14 routes prerendered) |
| `npm run build:release` | **PASS** |

---

## 11. Visual QA

**NOT VERIFIED in a live browser** (no browser automation in this session).

Reviewed from CSS:

| Check | Assessment |
|-------|------------|
| Light / dark | Tokens still dual-theme; light surfaces more opaque |
| English / Arabic | RTL token + kicker/badge/heading tracking |
| Desktop / mobile | No layout CSS rewritten; type scale smaller (hero H1 will shrink globally via tokens) |
| Focus | `--fl-focus` preserved |
| Risk | Header still glass; many local pills remain; hero type change is the most visible global effect |

Treat live matrix (1440/1024/768/390, EN/AR, light/dark) as **Phase 1D / 1C follow-up QA**.

---

## 12. Remaining design debt

- Page-local `999px`, glass cards, gradient leftovers  
- Dual dashboards  
- Popup `.fl-action-btn` still glass for non-primary  
- Auth cards still glass  
- `--fl-bp-*` unused in `@media`  
- Arabic webfont not loaded  
- WL-1 learning persistence test still red  

---

## 13. Recommended Phase 1D

Safest next step: **Marketing shell only** (header/footer/nav chrome + apply `.btn` without IA copy rewrite), **or** a **live visual QA pass** of Home/Account/Pricing in light/dark/EN/AR after this token change — then migrate one surface (header + `.card` consumers) without touching billing/auth logic.

Do **not** start homepage narrative rewrite until visual QA confirms the type-scale change is acceptable.

---

## Distinction

| Item | State |
|------|--------|
| Shared token foundation | **IMPLEMENTED** |
| Button/card/badge global primitives | **IMPLEMENTED** |
| Alert/Input primitives | **IMPLEMENTED** (unused by pages) |
| Surface utility classes | **IMPLEMENTED** |
| Page redesigns | **NOT IMPLEMENTED** |
| Remove glass.css / all 999px | **DEFERRED** |
| Migrate account/dashboard/popup fully | **DEFERRED** |
| Live visual QA | **DEFERRED** |
| WL-1 test fix | **DEFERRED** (unrelated) |
