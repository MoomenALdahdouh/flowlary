# Flowlary — Phase 1B  
## Design System + Visual Foundation Specification

**Document status:** SPECIFICATION ONLY — not implemented  
**Date:** 2026-08-30  
**Prerequisites:** `FLLOWLARY_PHASE_0_BASELINE.md`, `FLLOWLARY_PHASE_1A_PRODUCT_DESIGN_DIRECTION.md`  
**Production code changes in this phase:** NONE

**Label legend**

| Label | Meaning |
|-------|---------|
| **VERIFIED FACT** | Confirmed in repository files |
| **INFERENCE** | Reasonable conclusion from CSS/structure |
| **RECOMMENDATION** | Proposed for later implementation |
| **NEEDS CHANGE** | Existing value likely fails quality/contrast/consistency bar |
| **UNKNOWN / NOT VERIFIED** | Needs measurement or human decision |
| **CONFLICT** | Phase 1A / this brief vs actual repo |

---

## 0. Audit of the current design system

This section is the source of truth for *what ships today*. Later sections propose evolution. If Phase 1A disagrees with the repo, the difference is called out.

### A. Existing design tokens — VERIFIED FACT

**Canonical file:** `packages/shared/src/tokens.css`  
**Imported by:** `website/src/styles/tokens.css`, `extension/src/popup/tokens.css`  
**Theme helper:** `packages/shared/src/theme.ts`  
**Mark colors:** `packages/shared/src/brand.ts` (`#5b8cff` dark / `#315fd6` light)

There is **no Tailwind** and **no second token file** besides page CSS that hardcodes values.

### B. Existing CSS variables — VERIFIED FACT

Dark (`:root`) and light (`html[data-theme='light']`) override the same `--fl-*` names. Categories:

- Snow / glass materials (`--fl-snow*`, `--fl-glass-*`)
- Backgrounds / surfaces (`--fl-bg`, `--fl-surface`, `--fl-surface-2/3`, `--fl-product-bg`)
- Text (`--fl-text`, `--fl-muted`, `--fl-faint`, `--fl-ink`)
- Brand (`--fl-accent*`, `--fl-on-accent`, `--fl-border-accent`)
- Status (`--fl-success`, `--fl-warn`, `--fl-danger` + soft variants)
- Feature tints (`--fl-state-translate|layout|live`)
- Teaching (`--fl-teach-spelling|grammar|wording|layout`)
- Chrome (`--fl-header-bg`, `--fl-overlay`, `--fl-input-bg`, `--fl-atmosphere-*`)
- Radius, shadow, type scale, spacing, focus, motion

**No tokens today for:** disabled text, info, AI working/unavailable/exhausted, learning discovered/practicing/improving/completed, z-index, breakpoints.

### C. Typography — VERIFIED FACT

| Token | Value |
|-------|--------|
| `--fl-font-display` | Segoe UI Variable Display, SF Pro Display, Segoe UI, Helvetica Neue, system |
| `--fl-font` | Segoe UI Variable Text, SF Pro Text, … |
| `--fl-mono` | ui-monospace stack |
| RTL override | `website/src/styles/tokens.css`: SF Arabic, Geeza Pro, Tahoma, Arial |
| `--fl-text-display` | `clamp(3.1rem, 8.2vw, 5.5rem)` |
| `--fl-text-h1` | `clamp(2.15rem, 4.6vw, 3.35rem)` |
| `--fl-text-h2` | `clamp(1.7rem, 3.1vw, 2.45rem)` |
| `--fl-text-h3` | `1.08rem` |
| `--fl-text-body` | `1.0625rem` |
| `--fl-text-small` | `0.92rem` |
| `--fl-text-label` | `0.7rem` |
| `--fl-text-meta` | `0.8rem` |

Body `line-height: 1.65` on website; popup `13px` / `1.45`. Font-weight `650` / `750` used widely (variable-font friendly).

**Arabic:** no dedicated webfont in website UI. Noto Sans Arabic exists for **PDF export only**.

### D. Spacing — VERIFIED FACT

`--fl-space-1` … `--fl-space-10`: `0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.75 / 2.5 / 3.75 / 6 / 8rem`  
`--fl-max: 76rem`, `--fl-max-narrow: 42rem`  
Container: `width: min(100% - 2rem, var(--fl-max))`

**INFERENCE:** Many components ignore the scale and use ad-hoc `0.38rem`, `0.62rem`, `1.15rem`, `8px`, `12px`.

### E. Radius — VERIFIED FACT

Tokens: `xs 6px`, `sm 8px`, `md/default 12px`, `lg 18px`, `xl 26px`. **No `--fl-radius-pill` token**, but **`border-radius: 999px` is used extensively** (header nav rail, primary/secondary buttons, badges, kickers, chips).

**CONFLICT with Phase 1A:** Phase 1A said reduce pills. Repo: `.btn` uses `--fl-radius-sm` then `.btn-primary` / `.btn-secondary` override to `999px`.

### F. Shadows — VERIFIED FACT

`--fl-shadow-xs/sm`, `--fl-shadow`, `--fl-shadow-glow`, plus glass shadows. Light theme **aliases** `--fl-shadow-*` to glass shadows. Primary buttons add hardcoded `rgba(49, 95, 214, …)` glow (light-theme blue even on dark).

### G. Glass / blur — VERIFIED FACT

`--fl-glass-blur: blur(22–24px) saturate(160–165%)`  
`--fl-glass-blur-sm: blur(14–16px)`  
Classes `.glass-1/2/3` in `website/src/styles/glass.css`.  
**Used on:** sticky header, nav rail, cards, account forms, secondary buttons, popup header/actions, auth cards.

**CONFLICT with Phase 1A:** Glass is currently a **default material**, not reserved chrome.

### H. Colors — VERIFIED FACT (selected)

| Role | Dark | Light |
|------|------|-------|
| Accent | `#5b8cff` | `#315fd6` |
| On accent | `#061018` | `#ffffff` |
| BG | `#05070b` | `#f4f8fd` |
| Text | `#f3f6fb` | `#0a1628` |
| Muted | `#9aa6bb` | `#4a5a72` |
| Faint | `#8b97ac` | `#64748b` |
| Success | `#3dba86` | `#1d8f62` |
| Warn | `#e6b04a` | `#b8860b` |
| Danger | `#e06b73` | `#c13d4a` |
| Translate state | `#8b7cf6` | `#6366f1` |

**CONFLICT with brand direction:** `--fl-state-translate` is indigo/purple — the closest thing in the system to “generic AI purple.” Feature tint, not marketing gradient, but it should not leak into brand chrome.

Light `--fl-surface` is `rgba(255,255,255,0.55)` — translucent, not solid.

### I. Button variants — VERIFIED FACT

**Website `Ui.tsx`:** `primary | secondary | ghost` only. Sizes: default + `.btn-sm`.  
**CSS:** primary = gradient fill + pill; secondary = glass + pill; ghost = transparent.  
**No** tertiary, danger, or link variants in the primitive.  
**Extension:** `.fl-action-btn`, `-primary`, `-muted`, `-compact` (min-height **28–40px**), plus `.fl-link-btn`.

**CONFLICT:** Web min-height `2.75rem` (44px) vs popup compact 28px. Anatomy is related (gradient primary) but not unified.

### J. Form controls — VERIFIED FACT

No shared `Input` component. Account inputs in `account.css`: min-height `2.75rem`, radius `--fl-radius`, `--fl-input-bg`. Extension dashboard forms: min-height 40–44px, local classes. Toggle uses `--fl-toggle-off` / `--fl-thumb`.

### K. Cards — VERIFIED FACT

`.card` is glass (`glass-2` + blur + shadow). Dashboard `.wd-card`, pricing `.pr-*`, popup sections, extension `.fl-*` cards — **duplicated**.

### L. Alerts — VERIFIED FACT

**No Alert primitive.** Errors/success are page-local (account, Writing Lab, usage card, `AiErrorRecovery`).

### M. Badges — VERIFIED FACT

`.badge` + `badge-accent|warn|ok` — all pills, uppercase, letter-spacing `0.06em`. RTL account kickers disable letter-spacing / uppercase (**good**).

### N. Navigation — VERIFIED FACT

Sticky glass header; desktop nav hidden until `1024px`; pill nav-rail; mobile dialog with focus trap. Items: Writing Lab, Features, How it works, Pricing, About, Support. **Student not in nav.**

### O. Responsive breakpoints — VERIFIED FACT (ad hoc)

Documented occurrences include: `639, 640, 699, 700, 720, 767, 768, 800, 860, 900, 920, 960, 1024, 1100` plus `40rem` / `56rem` in dashboard CSS. **No `--fl-bp-*` tokens.**

### P. Accessibility — VERIFIED FACT

`:focus-visible { outline: var(--fl-focus); outline-offset: 3px }`  
`--fl-focus: 2px solid var(--fl-accent)`  
Global `prefers-reduced-motion` in `global.css` + `motion.css`  
Skip link, `.visually-hidden`, mobile nav keyboard trap. `a11y.css` is **11 lines** (visually-hidden only).

### Q. Web primitives — VERIFIED FACT

`Button`, `GetFlowlaryButton`, `Badge`, `Card`, `PageHero`, `FactGrid`, `Logo`, `ThemeToggle`. Thin set; most UI is page CSS.

### R. Extension primitives — VERIFIED FACT

`ShortcutKey`, feature controls, `UsageStatusCard`, `AiErrorRecovery`, `SystemStatusBlock`, First Win / Home views. Separate class namespace `fl-*`.

### S. Duplicate / local CSS — VERIFIED FACT

~8k website CSS lines; ~1.9k popup; ~2.6k extension dashboard. Repeated pills, glass cards, gradient primaries, kickers.

### T. Inconsistent visual patterns — VERIFIED FACT / INFERENCE

| Pattern | Inconsistency |
|---------|----------------|
| Button radius | Token `8px` vs pill `999px` vs popup `8px` |
| Button height | 44px web vs 28–40px popup |
| Cards | Glass marketing vs mixed dashboard |
| Theme boot | `index.html` default `data-theme="light"`; `themeFromSystem()` falls back to **dark** if no `matchMedia` |
| Hero copy | Learning-first (`en.ts`) vs Phase 1A flow-first |
| Primary glow | Hardcoded light-blue shadow in dark theme |
| Display type | Up to `5.5rem` — Phase 1A: avoid giant headlines |

### Differences vs Phase 1A (do not silently change)

1. Phase 1A suggested optional `--fl-color-*` names. **Repo uses `--fl-accent`, `--fl-bg`, `--fl-text`.** This spec **evolves existing names** and treats `--fl-color-*` as optional aliases only if approved.  
2. Phase 1A reserved glass for chrome. **Repo uses glass on forms, cards, secondary buttons, popup actions.**  
3. Phase 1A: one dominant CTA. **Repo often shows equal pill primary + secondary.**  
4. Translate tint is purple/indigo in tokens — Phase 1A “avoid generic AI purple.”  
5. Writing Lab remains in primary nav; Student does not.

---

## 1. Executive summary (spec)

**RECOMMENDATION:** Evolve Snow into a **calm solid-surface system** with the same blue mark, light/dark themes, and `--fl-*` names. Do not replace the brand. Do not introduce Tailwind or a second component library.

**North star:** Clarity, trust, one action per surface, WRITE → COMMUNICATE → LEARN hierarchy, web + extension same language / different density.

**Migration posture:** KEEP names → MODIFY values (glass, radius usage, type scale, solid surfaces) → ADD missing semantic tokens → DEPRECATE unused atmosphere/glow gradually.

---

## 2. Design system architecture

```
FOUNDATION (tokens)
  → PRIMITIVES (Button, Input, …)
  → COMPONENTS (Card, Alert, …)
  → PATTERNS (SectionHeader, PlanCard, …)
  → PAGE SECTIONS (Hero, LearnLoop, …)
  → SURFACES (Marketing, Account, Dashboard, Popup, In-page)
```

### FOUNDATION

**Purpose:** Single source of visual truth.  
**Rules:** No raw hex in new CSS except inside `tokens.css`.  
**Use:** All surfaces.  
**Do not:** Encode business rules (prices, credits) as design tokens.

### PRIMITIVES

**Purpose:** Smallest interactive building blocks.  
**Rules:** Shared anatomy; density variants (`comfortable` web / `compact` popup).  
**Use:** Any clickable/editable control.  
**Do not:** Invent page-only buttons when a variant exists.

### COMPONENTS

**Purpose:** Composed UI with states.  
**Use:** Repeated structures (alert, empty, tabs).  
**Do not:** Card-wrap every paragraph.

### PATTERNS

**Purpose:** Product-specific assemblies (PlanCard, UsageCallout) still using primitives.  
**Use:** Pricing, usage, learning lists.  
**Do not:** Duplicate pattern CSS per page.

### PAGE SECTIONS

**Purpose:** Marketing/product narrative blocks.  
**Use:** Home, Features, Pricing.  
**Do not:** Put section layout in the extension popup.

### SURFACES

**Purpose:** Context rules (density, chrome, glass allowance).  
**Use:** Decide elevation and type scale.  
**Do not:** Copy marketing atmosphere into popup.

---

## 3. Color system

**Decision:** Keep brand blues. **Do not rename** `--fl-accent` as the implementation name unless a later alias layer is approved.

### 3.1 Semantic roles mapped to existing tokens

Proposed **roles** (conceptual) → **existing token** (implementation):

| Role | Token (KEEP name) | Purpose |
|------|-------------------|---------|
| Brand | `--fl-accent` | CTA, logo field, links, focus |
| Brand hover / active | `--fl-accent-hover` / `--fl-accent-pressed` | Interactive brand |
| Brand soft | `--fl-accent-soft` | Selected nav, chips |
| On brand | `--fl-on-accent` | Text/icons on brand fill |
| Canvas | `--fl-bg` | Page background |
| Canvas soft | `--fl-bg-soft` / `--fl-bg-raised` | Bands, raised canvas |
| Surface | `--fl-product-bg` / `--fl-surface` | **MODIFY light surface to solid** |
| Surface elevated | `--fl-surface-2` | Cards, panels |
| Overlay | `--fl-overlay` | Modals, mobile nav backdrop |
| Text | `--fl-text` | Primary copy |
| Text secondary | `--fl-muted` | Supporting |
| Text muted | `--fl-faint` | Meta, captions |
| Text disabled | **ADD** `--fl-text-disabled` | Do not rely on opacity alone |
| Border | `--fl-border` | Default structure |
| Border strong | `--fl-border-strong` | Inputs, selected |
| Border accent | `--fl-border-accent` | Focus-adjacent, selected card |
| Success | `--fl-success` (+ soft) | Applied, verified, healthy |
| Warning | `--fl-warn` (+ soft) | Low credits, trial ending |
| Error | `--fl-danger` (+ soft) | Failures, destructive |
| Info | **ADD** `--fl-info` | Neutral guidance (not brand) |

Optional aliases (`--fl-color-brand` → `var(--fl-accent)`) are **NICE TO HAVE**, not required. Prefer one name in CSS.

### 3.2 Recommended value evolution (still the same hues)

| Token | Dark (proposed) | Light (proposed) | Treatment |
|-------|-----------------|------------------|-----------|
| `--fl-accent` | **KEEP** `#5b8cff` | **KEEP** `#315fd6` | Brand |
| `--fl-on-accent` | **KEEP** `#061018` | **KEEP** `#ffffff` | |
| `--fl-bg` | **KEEP** `#05070b` | **KEEP** `#f4f8fd` | Canvas |
| `--fl-text` | **KEEP** `#f3f6fb` | **KEEP** `#0a1628` | |
| `--fl-surface` (light) | n/a | **MODIFY** to solid `#ffffff` (or 96%+ opaque) | Stop glass-as-surface |
| `--fl-surface` (dark) | **KEEP/EVOLVE** `#10151f` solid | | |
| `--fl-accent-glow` | **MODIFY** lower alpha (~0.08) | **MODIFY** lower | Reduce glow |
| `--fl-atmosphere-1/2` | **MODIFY** weaker or unused on product | | Reduce atmosphere |
| `--fl-state-translate` | **MODIFY** away from purple **or KEEP as feature-only** | See approval | Must not color brand chrome |

Exact new hex for translate/info/disabled: **human approval** (see § unresolved). Until then, KEEP translate tokens for feature chips only.

### 3.3 AI states — RECOMMENDATION (ADD tokens)

| State | Token | Map | Usage | Not for |
|-------|-------|-----|-------|---------|
| Ready | `--fl-ai-ready` | success or muted + “Ready” | In-page / popup | Marketing hero |
| Working | `--fl-ai-working` | accent, no animation required | Status text | Particle effects |
| Success | `--fl-ai-success` | `--fl-success` | Applied correction | Fake scores |
| Unavailable | `--fl-ai-unavailable` | `--fl-warn` | Retryable AI down | “Product dead” |
| Exhausted | `--fl-ai-exhausted` | `--fl-warn` or muted | Credits 0; local tools remain | Fear copy |

### 3.4 Learning states — RECOMMENDATION

Keep `--fl-teach-*` for **error category** (spelling/grammar/wording/layout).

Add **progress** language (color + label, not color alone):

| State | Treatment |
|-------|-----------|
| Discovered | Neutral / info |
| Practicing | Accent soft |
| Improving | Success soft |
| Completed | Success + check |

Do not invent fake percentages.

### 3.5 Per-token usage table (core)

| Token | Light | Dark | Use | Do not use |
|-------|-------|------|-----|------------|
| `--fl-accent` | `#315fd6` | `#5b8cff` | Primary CTA, logo, links, focus | Large background fills, body text on light at small size without checking |
| `--fl-text` | `#0a1628` | `#f3f6fb` | Headings, body | On accent fill |
| `--fl-muted` | `#4a5a72` | `#9aa6bb` | Secondary sentences | Disabled-only (too similar) |
| `--fl-faint` | `#64748b` | `#8b97ac` | Captions, timestamps | Body paragraphs (**check contrast**) |
| `--fl-success` | `#1d8f62` | `#3dba86` | Positive status | Large decorative blocks |
| `--fl-warn` | `#b8860b` | `#e6b04a` | Caution; pair with text | Small body text on light without contrast fix |
| `--fl-danger` | `#c13d4a` | `#e06b73` | Errors, destructive | Primary marketing CTA |

---

## 4. Contrast

Evaluations below are **approximate WCAG 2.x** (normal text 4.5:1, large 3:1, UI 3:1). **UNKNOWN / NOT VERIFIED** with a contrast meter in this session — treat as design review flags.

| Pair | Role | Verdict |
|------|------|---------|
| Dark text `#f3f6fb` on `#05070b` | Normal text | **PASS** (high) |
| Light text `#0a1628` on `#f4f8fd` | Normal text | **PASS** |
| Dark muted `#9aa6bb` on `#05070b` | Secondary | **Likely PASS** |
| Light muted `#4a5a72` on `#f4f8fd` | Secondary | **Likely PASS** |
| Light faint `#64748b` on `#f4f8fd` | Caption | **Borderline AA** — **NEEDS CHANGE** if used as body |
| Light warn `#b8860b` as small text on `#f4f8fd` | Warning copy | **NEEDS CHANGE** (gold/brown often fails 4.5:1) |
| Dark warn `#e6b04a` as small text | Warning copy | **UNKNOWN** — verify; prefer warn + dark text in chip |
| `--fl-on-accent` on accent (both themes) | Button label | **Likely PASS** |
| Accent as small link on canvas | Links | **Likely PASS**; never accent-on-accent-soft without check |
| Disabled via `opacity: 0.55` | Controls | **NEEDS CHANGE** — opacity-only often fails; use `--fl-text-disabled` + no pointer |
| Text on light `--fl-surface` 55% over gradients | Forms/cards | **NEEDS CHANGE** — glass stacking is the main contrast risk |
| Focus `2px solid accent` | Focus | **PASS direction**; keep 3px offset; do not remove for aesthetics |
| Badge uppercase muted on glass | Labels | **UNKNOWN** — verify after solid surfaces |

**Controls:** 3:1 against adjacent background for boundaries. Prefer `--fl-border-strong` on inputs.

**Disabled:** Visible but not primary-contrast; still identifiable; never the only way to hide an action that must remain understandable.

---

## 5. Typography

### 5.1 Strategy — RECOMMENDATION

- **English UI:** Keep system stack **or** add one licensed/self-hosted UI sans (approval). Display font only for marketing H1 — not dashboard/popup.
- **Arabic UI:** First-class family (recommend **Noto Sans Arabic** — already in extension PDF assets — or equivalent). Match weight steps to Latin as far as practical.
- **Fallbacks:** Current system stacks remain.
- **Do not load fonts in this phase.**

**CONFLICT:** Current `--fl-text-display` max `5.5rem` fights “restrained hierarchy.” **MODIFY** display cap.

### 5.2 Roles (implementation = CSS variables)

Keep token names; **modify clamp values**.

| Role | Token / rule | Size (proposed) | Weight | Line-height | Tracking | Usage |
|------|----------------|-----------------|--------|-------------|----------|--------|
| Display | `--fl-text-display` | `clamp(2.25rem, 5vw, 3.25rem)` | 700–750 | 1.12 | -0.03em | Marketing H1 only |
| H1 | `--fl-text-h1` | `clamp(1.85rem, 3.2vw, 2.5rem)` | 700 | 1.18 | -0.025em | Page titles |
| H2 | `--fl-text-h2` | `clamp(1.4rem, 2.2vw, 1.85rem)` | 650–700 | 1.25 | -0.02em | Sections |
| H3 | `--fl-text-h3` | `1.125rem` | 650 | 1.35 | 0 | Cards, subsections |
| H4 | **ADD** `--fl-text-h4` | `1rem` | 650 | 1.4 | 0 | Dashboard blocks |
| Body large | **ADD** or reuse | `1.125rem` | 400–500 | 1.6 | 0 | Marketing lead |
| Body | `--fl-text-body` | **KEEP** `1.0625rem` web; popup `13px` | 400–500 | 1.6 web / 1.45 popup | 0 | Default |
| Body small | `--fl-text-small` | **KEEP** `0.92rem` | 400 | 1.5 | 0 | Help, lists |
| Label | `--fl-text-label` | `0.75rem` (**MODIFY** from `0.7rem` if Arabic clipping) | 650 | 1.3 | 0.04em EN only | Kickers; **RTL: tracking 0, no forced uppercase** |
| Caption | `--fl-text-meta` | **KEEP** `0.8rem` | 400 | 1.4 | 0 | Timestamps |
| Button | inherit | `0.92rem` web / `12px` popup | 650 | 1 | 0 | Buttons |
| Numeric | `--fl-mono` or `font-variant-numeric: tabular-nums` | Body or H3 | 650 | 1 | 0 | Credits, prices |

**Family:** `--fl-font` for all product UI; `--fl-font-display` marketing display/H1 only.

### 5.3 RTL / Arabic

- `dir="rtl"` already set via i18n — **KEEP**.  
- Logical properties (`inset-inline`, `padding-inline`) — prefer in new CSS.  
- Do not mirror checkmarks, logos, media transport icons.  
- Mirror directional chevrons/arrows.  
- Arabic line-height **+0.05 to +0.1** vs Latin if clipping — verify in QA.  
- Kickers: disable `uppercase` + letter-spacing in RTL (already on `.ac-kicker`).

---

## 6. Spacing system

**KEEP `--fl-space-1` … `--fl-space-10`.** Do not rename to xs–5xl in code. Optional human names for docs:

| Doc name | Token | Rem |
|----------|-------|-----|
| xs | `--fl-space-1` | 0.25 |
| sm | `--fl-space-2` | 0.5 |
| md | `--fl-space-3` | 0.75 |
| lg | `--fl-space-4` | 1 |
| xl | `--fl-space-5` | 1.25 |
| 2xl | `--fl-space-6` | 1.75 |
| 3xl | `--fl-space-7` | 2.5 |
| 4xl | `--fl-space-8` | 3.75 |
| 5xl | `--fl-space-9` | 6 |
| 6xl | `--fl-space-10` | 8 |

| Context | Rule |
|---------|------|
| Page padding | Container `100% - 2rem`; popup `14px` horizontal (current) |
| Section spacing | Marketing `--fl-space-8`–`9`; product `--fl-space-6`–`7` |
| Card padding | `--fl-space-5`–`6` (not 26px radius + tiny padding) |
| Control spacing | Field gap `--fl-space-2`–`3` |
| Text spacing | Heading → body `--fl-space-3` |
| Dashboard | Stack gap `--fl-space-4`–`5` |
| Popup | Gap `10px` (~space-3) — compact |

**New CSS should not invent `0.38rem` / `0.62rem`.** Snap to scale.

---

## 7. Radius system

**KEEP token values.** Add **usage policy**. Optional **ADD** `--fl-radius-pill: 999px` so pills are explicit and rare.

| Token | px | Use |
|-------|-----|-----|
| `--fl-radius-xs` | 6 | Checkboxes, tiny chips |
| `--fl-radius-sm` | 8 | **Buttons (all variants)**, inputs, popup controls, badges (not pills) |
| `--fl-radius` | 12 | Cards, Writing Lab, demos |
| `--fl-radius-lg` | 18 | Large marketing frames, dialogs |
| `--fl-radius-xl` | 26 | **Reduce usage** — header bar may stay slightly rounded, not every card |
| Pill | 999 | **Exception:** selected nav pill, status pill, **optional** Get Flowlary only if approved |

**MODIFY:** Remove `999px` from `.btn-primary` / `.btn-secondary` / default badges unless a specific exception is approved.

**Mark SVG** radius `8.5` stays (**VERIFIED FACT** `FLOWLARY_MARK.radius`).

---

## 8. Elevation / surface system

| Level | Name | Background | Border | Shadow | Blur | Typical use |
|-------|------|------------|--------|--------|------|-------------|
| **0** | Canvas | `--fl-bg` | none | none | none | Page, popup body |
| **1** | Surface | solid `--fl-product-bg` / raised | `--fl-border` | none | **none** | Lab, dashboard panels, forms, demos |
| **2** | Elevated | `--fl-surface-2` solid | `--fl-border-strong` | `--fl-shadow-sm` **reduced** | none | Pricing highlight, sticky header **if not glass** |
| **3** | Overlay | `--fl-overlay` + solid panel | `--fl-border` | `--fl-shadow` | **optional** `glass-blur-sm` on **sheet only** | Modal, mobile nav, Speed Box |

### Glass policy (Phase 1A aligned)

**Allowed:** marketing header (reduced blur), mobile nav sheet, rare floating chrome, overlay sheets.  
**Forbidden as default:** forms, dashboards, long content, data panels, Writing Lab content, dense product UI, secondary buttons, popup action grids.

**MODIFY:** `.card`, `.ac-auth-card`, `.btn-secondary`, `.fl-action-btn` off glass → Level 1 solid.

Atmosphere: **one** subtle canvas wash max on marketing; **none** on account/dashboard/popup.

---

## 9. Button system

### 9.1 Unified anatomy

| Property | Comfortable (web) | Compact (popup) |
|----------|-------------------|-----------------|
| Height | `min-height: 2.75rem` (44px) **KEEP** | Primary actions **40px**; secondary **36px**; **never 28px** for primary |
| Padding | `0.5rem 1.15rem` | `8px 12px` |
| Radius | `--fl-radius-sm` (8px) | same |
| Font | 0.92rem / 650 | 12px / 650 |
| Icon gap | `0.45rem` | `8px` |
| Hover | darken/border; **optional** 1px lift on marketing only | border/background; **no** heavy shadow |
| Active | scale `0.98` | same |
| Focus | `--fl-focus` + 3px offset | `--fl-focus` + 2px |
| Disabled | `--fl-text-disabled` + muted fill; no hover | same |
| Loading | `aria-busy`, spinner, keep width | same |

**Remove:** default gradient + pill + glow on primary (or keep **flat** accent fill). Gradient is decorative.

### 9.2 Variants

| Variant | Use | Look |
|---------|-----|------|
| **Primary** | One dominant action | Solid `--fl-accent`, `--fl-on-accent` |
| **Secondary** | Alternative (See how it works) | Solid surface + `--fl-border-strong` |
| **Tertiary** | Low emphasis | Quiet fill `--fl-hover-fill` |
| **Ghost** | Toolbar, cancel | Transparent |
| **Danger** | Destructive (ADD) | `--fl-danger` outline or fill |
| **Link** | Inline navigation | Text + underline offset |

### 9.3 Action hierarchy examples (behavior unchanged)

| Action | Variant |
|--------|---------|
| Get Flowlary | **Primary** (header + hero only one cluster) |
| See how it works | Secondary |
| Create account | Primary on register; Secondary on login screen |
| Sign in | Primary on login |
| Try Pro / Upgrade | Primary **only** on pricing/account when upgrade is the goal |
| Student verification | Primary in student block; not competing with Get Flowlary in header |
| Correct / Translate / Fix Layout | Popup: three secondaries **or** one primary if First Win; do not three equal brand fills |
| Practice | Primary on overview when that is “today’s action” |

**Rule:** If two buttons sit together, only one is Primary.

---

## 10. Form controls

Shared anatomy for Input, Textarea, Select (native or custom chrome later — **do not change validation logic**).

| State | Treatment |
|-------|-----------|
| Default | `--fl-input-bg` **solid**, border `--fl-border`, radius `--fl-radius`, min-height **44px** web / **40px** popup |
| Hover | `--fl-border-strong` |
| Focus | `--fl-focus` + `--fl-border-accent`; no extra glow |
| Filled | same as default |
| Disabled | `--fl-text-disabled`, no pointer |
| Error | border `--fl-danger`, message `--fl-danger`, `aria-describedby` |
| Success | optional `--fl-success` border only after explicit success |

**Label:** 0.84rem / 600, gap `--fl-space-2`.  
**Textarea:** min-height ~7rem in Lab; same border/radius.  
**Checkbox/Radio:** 20px control, 44px hit target padding.  
**Toggle:** keep `--fl-thumb` / `--fl-toggle-off`; focus ring on control; label adjacent.

RTL: icons in input (show password) use `inset-inline-end`.

---

## 11. Cards

**Appropriate:** pricing plans, grouped settings, dashboard interactive unit, popup section, grouped FAQ item (optional).  
**Not appropriate:** every paragraph, every feature blurb, decorative marketing boxes, wrapping SectionHeader.

| Property | Spec |
|----------|------|
| Border | `--fl-border` |
| Surface | Level 1 solid |
| Radius | `--fl-radius` (12px) |
| Padding | `--fl-space-5`–`6` |
| Hover | Only if clickable: border-accent, no lift on dashboards |
| Selected | border-accent + `--fl-accent-soft` fill |

---

## 12. Status system

Every state: **color + text (+ icon)**. Never color alone.

| State | Color | Icon | Text | A11y |
|-------|-------|------|------|------|
| SUCCESS | success | check | “Saved” / “Corrected” | polite live if transient |
| WARNING | warn | alert | “Low AI checks” | polite |
| ERROR | danger | error | Cause + next step | assertive |
| INFO | info/muted | info | Guidance | polite |
| AI WORKING | accent | spinner (CSS) | “Checking your writing…” | `aria-busy` |
| AI UNAVAILABLE | warn | offline | Retry | assertive + retry |
| AI EXHAUSTED | warn | gauge | Local tools still work; reset timing honest | polite |
| PAUSED | muted | pause | “Flowlary is paused” | |
| CONNECTED | success | link | Extension connected | |
| DISCONNECTED | muted | plug | Not detected + install | |
| VERIFIED | success | badge | Email verified | |
| TRIAL | accent | clock | Days remaining | |
| PRO | accent | — | Plan label | |
| STUDENT | accent/success | — | Student Pro + expiry | Honest “academic email” |

Reuse `UsageStatusCard` / `AiErrorRecovery` **presentation** evolution only.

---

## 13. Iconography

- Stroke geometric, 1.5–1.75px, 24px default, 16px inline, 20px popup.  
- CurrentColor.  
- No emoji as UI.  
- One set (inline SVG as today) — **do not add an icon library** without approval.  
- RTL: flip only directional arrows; lock logo, check, plus, pause.

---

## 14. Motion

| Token | Value | Use |
|-------|-------|-----|
| Instant | 0 | Reduced motion; route change |
| Fast | **KEEP** `--fl-duration: 180ms` | Hover, focus, toggles |
| Normal | 280–360ms | Overlays, demos |
| Slow | **DEPRECATE** `fl-glow` 16s | Do not keep ambient glow |

`--fl-ease: cubic-bezier(0.22, 1, 0.36, 1)` **KEEP**.

**Use:** state, feedback, loading, demo caret (already reduced-motion safe).  
**Do not:** particle AI, floating empty space, infinite hero glow (`fl-glow` → **REMOVE/REDUCE**).

Reveal on marketing: optional, ≤400ms, disabled when reduced motion (**already**).

---

## 15. Responsive system

**ADD tokens (recommended):**

| Token | Value | Meaning |
|-------|-------|---------|
| `--fl-bp-sm` | `640px` | Small |
| `--fl-bp-md` | `768px` | Tablet |
| `--fl-bp-lg` | `1024px` | Desktop nav |
| `--fl-bp-xl` | `1200px` | Wide |

**Migration:** new media queries use these four. Do not add `860/900/920` in new CSS. Existing queries **KEEP until cleanup phase**.

| Viewport | Hierarchy |
|----------|-----------|
| Desktop ≥1024 | Two-column hero; side-by-side plans; Lab/demo as stage |
| Tablet 768–1023 | Stack demo under copy; hamburger until 1024 (**current**) |
| Mobile &lt;768 | CTA first; single column; pricing stacked; Student full-width; Lab compact |
| Popup 360px | Action-first; no marketing; usage only if not healthy |

Header: keep `nav-desktop` at 1024 — **VERIFIED FACT**. Do not squeeze six nav items.

---

## 16. Web + extension unity

**Must share:** color roles, type roles, button anatomy (density variants), radius policy, status language, icon stroke, spacing scale, focus, light/dark tokens.

**May differ:** density, width (360 vs 76rem), nav model, information depth, glass on popup header only, type size (13px vs 17px).

**Do not merge** dashboard implementations or storage.

---

## 17. Accessibility requirements

- WCAG **AA** for text and essential UI.  
- `:focus-visible` never removed.  
- Keyboard: all primary flows (existing mobile trap **KEEP**).  
- Touch: **44×44px** web; popup primary **≥40px**. Compact 28px **anti-pattern**.  
- Semantic headings; skip link **KEEP**.  
- ARIA only when native HTML insufficient.  
- Errors: `aria-invalid` + `aria-describedby`.  
- Reduced motion: global kill **KEEP**.  
- RTL + Arabic type first-class.  
- i18n: no new hardcoded English in components.

---

## 18. Marketing vs product vs extension vs dashboard

| Surface | Density | Atmosphere | Proof |
|---------|---------|------------|-------|
| Marketing | Spacious | One canvas wash; reduced header glass | Real product frames, labeled simulated demos |
| Account | Focused | **No** hero glow | Clear form, honest errors |
| Dashboard | Medium | Solid | Brief → practice, not chart wall |
| Popup | Compact | Minimal | Actions + status |
| In-page | Ephemeral | No marketing | Correction card chrome only |

---

## 19. Component anatomy (minimum set)

Shared rules: focus ring, RTL logical properties, i18n strings, 44px web targets.

### Button

- Anatomy: optional icon + label + optional shortcut.  
- Variants/states: §9.  
- **Example:** Hero “Get Flowlary” primary + “See how it works” secondary.  
- **Anti-example:** Two gradient pills; 28px primary in popup.

### Input / Textarea

- Anatomy: label + control + hint/error.  
- **Example:** Account email.  
- **Anti-example:** Placeholder-only unlabeled field; glass input.

### Toggle

- Anatomy: label + switch.  
- States: on/off/disabled/focus.  
- **Example:** Popup correction toggle.  
- **Anti-example:** Color-only on/off.

### Card

- Anatomy: optional kicker, title, body, actions.  
- **Example:** Free vs Pro plan.  
- **Anti-example:** Glass card around a single sentence.

### Badge

- Anatomy: text; optional dot.  
- Radius `--fl-radius-sm` (not 999 unless status pill).  
- **Anti-example:** Uppercase tracking on Arabic.

### Alert

- Anatomy: icon + title + body + optional action.  
- Variants: info/success/warning/error.  
- **New primitive** — migrate account/Lab errors.  
- **Anti-example:** Raw API error strings.

### Modal

- Anatomy: title, body, primary/secondary.  
- Level 3 overlay; focus trap like mobile nav.  
- Use sparingly (confirmations). Speed Box is overlay, not marketing modal.

### Tabs

- Anatomy: tablist + panels; arrow keys (**playground already**).  
- Solid underline or muted selected fill — not glass pills if avoidable.

### EmptyState / LoadingState / ErrorState

- Empty: honest (“Not enough writing yet”).  
- Loading: text + spinner, `aria-busy`.  
- Error: message + retry.  
- Reuse Lab/dashboard patterns visually.

### PageHeader / SectionHeader

- PageHeader: kicker optional + H1 + lead. Evolve `PageHero`.  
- SectionHeader: kicker + H2 + lead. Evolve `SectionLabel`.

### PlanCard

- Anatomy: name, price from `FLOWLARY_PRICING` (do not hardcode new prices), features, **one** primary CTA.  
- Highlight Pro with border-accent, not glow festival.

### UsageCallout

- Anatomy: state + remaining + reset + next action.  
- Evolve `UsageStatusCard` visually only.

---

## 20. Design tokens migration plan

| Current token | Current purpose | Treatment | KEEP / MODIFY / DEPRECATE / ADD | Reason | Risk |
|---------------|-----------------|-----------|----------------------------------|--------|------|
| `--fl-accent*` | Brand | Keep hex | **KEEP** | Identity | Low |
| `--fl-on-accent` | On brand | Keep | **KEEP** | Contrast | Low |
| `--fl-bg*` | Canvas | Keep | **KEEP** | | Low |
| `--fl-text/muted/faint` | Type | Verify faint/warn | **KEEP / MODIFY faint if fail** | AA | Med |
| `--fl-surface` light | Translucent | Solidify | **MODIFY** | Contrast, anti-glass | Med visual |
| `--fl-glass-*` | Material | Limit to chrome | **KEEP vars / MODIFY usage** | Policy | Med |
| `--fl-glass-blur` | 22–24px | Reduce to ~12px chrome | **MODIFY** | Performance + noise | Low |
| `--fl-atmosphere-*` | Hero wash | Weaken / unused on product | **MODIFY** | Calm | Low |
| `--fl-accent-glow` / `--fl-hero-glow` | Glow | Lower alpha | **MODIFY** | Anti-AI-SaaS | Low |
| `--fl-shadow*` | Elevation | Lighter; borders first | **MODIFY** | | Low |
| `--fl-radius-*` | Shape | Keep px; change usage | **KEEP** | | Low |
| `--fl-space-*` | Spacing | Keep | **KEEP** | | Low |
| `--fl-text-display` | Giant H1 | Reduce clamp | **MODIFY** | Hierarchy | Med (layout) |
| `--fl-font*` | System | Optional webfont later | **KEEP** until approval | Arabic | Med if fonts |
| `--fl-focus` / `--fl-duration` / `--fl-ease` | A11y/motion | Keep | **KEEP** | | Low |
| `--fl-success/warn/danger` | Status | Keep; fix warn-on-light text | **KEEP / MODIFY usage** | | Low |
| `--fl-teach-*` | Categories | Keep | **KEEP** | Learning | Low |
| `--fl-state-translate` | Purple tint | Recolor or isolate | **MODIFY or KEEP isolated** | Anti-purple | Low if isolated |
| `--fl-state-layout/live` | Feature tints | Keep | **KEEP** | | Low |
| `--fl-header-bg` | Glass header | More opaque | **MODIFY** | | Low |
| `--fl-product-bg` | Solid product | Prefer as Level 1 | **KEEP** | Already solid | Low |
| `--fl-snow*` | Frost vocabulary | Keep for chrome | **KEEP** | | Low |
| `--fl-text-disabled` | — | Disabled text | **ADD** | A11y | Low |
| `--fl-info` | — | Neutral info | **ADD** | Status | Low |
| `--fl-ai-*` | — | AI states | **ADD** | Consistency | Low |
| `--fl-radius-pill` | — | Explicit rare pill | **ADD** | Honesty | Low |
| `--fl-bp-*` | — | Breakpoints | **ADD** | Responsive | Low |
| `--fl-color-*` aliases | — | Optional | **ADD only if approved** | Dual names = debt | Med confusion |
| Hardcoded `999px` / `rgba(49,95,214)` | Local CSS | Replace with tokens | **DEPRECATE usage** | Consistency | Med regression |

**Do not rename `--fl-accent` → `--fl-color-brand` in a breaking sweep.**

---

## 21. CSS strategy

- Stay on **CSS variables + existing files**. No Tailwind, no CSS-in-JS framework.  
- Order: tokens → primitive classes in `global.css` / popup tokens → page CSS uses primitives.  
- New buttons: `.btn` only; deprecate `.pr-card-btn` by composing `.btn`.  
- New cards: `.card` solid or `.fl-card` mapped to same tokens.  
- Do not rewrite 8k lines at once; **stop adding** glass/pills/hex.  
- Extension: keep `fl-*` class names; align properties to tokens.

---

## 22. Brand rules

| Axis | Rule |
|------|------|
| Personality | Calm intelligence that helps you stay in flow |
| Color | Blue mark; neutrals do the work; accent is scarce |
| Type | Readable, restrained; Arabic equal |
| Shape | Soft 8–12px; pills exceptional |
| Surface | Solid product; glass rare chrome |
| Icon | Simple stroke, meaningful |
| Motion | Fast, purposeful, reduced-motion friendly |
| Illustration | **Product UI frames**, not abstract AI |
| Screenshots | Labeled simulated vs live; no fake metrics |

---

## 23. Design red flags (permanent)

- Excessive glass, blur, glow, stacked gradients  
- Purple AI aesthetics / nebula / robot mascots  
- Giant meaningless headlines (`5.5rem` display)  
- Pills on every control  
- Cards on every paragraph  
- Two equal primary CTAs  
- Fake metrics, fake social proof, awards  
- Decorative chart walls  
- Noisy dashboards  
- Unnecessary animation / `fl-glow` ambient  
- Low contrast / missing focus  
- Desktop squeezed to mobile  
- Inconsistent Arabic RTL / hardcoded English  
- Changing credits, prices, APIs, auth for visuals  
- Merging dashboard data layers  
- New CSS framework  
- 28px primary hit targets  

---

## 24. Protected product logic

Visual work **must not alter:** authentication, sessions, `postMessage` bridge protocol, AI gateway, credits, pricing constants, entitlement, Paddle, student verification semantics, learning event contracts, DOM/safety engines, storage schemas, API contracts, Groq/key handling.

Presentation-only: CSS, token **values**, copy that stays commercially accurate, classnames that tests do not depend on (update tests if they assert class/copy).

---

## 25. Implementation order (after approval)

| Step | Scope | Dependencies | Risk | Tests | Visual QA |
|------|-------|--------------|------|-------|-----------|
| 1 Foundation tokens | `tokens.css` values + optional ADD | Approval of glass/radius/type | Global look | shared brand test; visual | light/dark |
| 2 Typography | Clamps, RTL font **decision** | Font approval | Layout reflow | i18n/seo | EN/AR |
| 3 Primitives | `.btn` anatomy, inputs | Tokens | CTA tests | `test:web` buttons | header/hero |
| 4 Components | Card, Badge, Alert | Primitives | Low | web | account errors |
| 5 Marketing shell | Layout header/footer | Tokens | Nav tests | routes | 1024/mobile |
| 6 Homepage | Copy+layout per 1A | Shell | Demo hashes | demos/buttons | desktop/mobile/AR |
| 7 Pricing | Visual PlanCard | Pricing constants **untouched** | High commercial | PricingShowcase tests | plans/student |
| 8 Account shell | Solid forms | Auth logic **untouched** | Critical | Account tests | login/register |
| 9 Dashboard | Overview hierarchy | Learning logic **untouched** | Med | web learning tests | overview |
| 10 Extension popup | Compact primitives | Engines **untouched** | High | extension unit/popup | 360px |
| 11 Extension dashboard | Token-aligned CSS | No merge | Med | extension dashboard tests | |
| 12 In-page UI | Card chrome only | DOM **untouched** | Critical if mixed files | correction UI tests | |
| 13 Cleanup | Dead CSS, unused CapabilitySections | After visual parity | Low | full suites + builds | |

**Pre-step:** Triage Phase 0 **WL-1 extension test failure** before learning UI edits.

---

## 26. Verification plan

**Commands**

```bash
npm run test -w @flowlary/shared
npm run test:web
npm run test -w @flowlary/backend
npm run test -w @flowlary/extension
npm run typecheck
npm run build:web
npm run build:release
```

**Manual matrix:** light, dark, English, Arabic+RTL, mobile, desktop, popup, keyboard, reduced motion.

**Must remain unchanged:** `$4.99` / `$39`, 500/1000 checks, trial 30 days, student 12 months academic email, auth/billing/entitlement behavior.

---

## 27. Design-system scores

**Current maturity: 4.5 / 10**  
**Target: 9 / 10** (professional consumer product — not a new framework)

| Dimension | Now | Why | Target |
|-----------|-----|-----|--------|
| Brand consistency | 5 | Strong mark/blue; glass/pills dilute | 9 |
| Typography | 4 | System OK; giant display; Arabic afterthought | 9 |
| Color | 6 | Solid semantic set; glow/purple/glass risk | 8 |
| Components | 3 | Thin primitives; local duplication | 8 |
| Accessibility | 6 | Focus/skip/reduced-motion exist; contrast on glass unknown | 9 |
| Responsive | 5 | Works but breakpoint chaos | 8 |
| Web/extension consistency | 4 | Shared tokens, different anatomy/heights | 8 |
| Marketing hierarchy | 4 | Learning-first hero; long home | 9 |
| Product UI | 5 | Lab/account capable but glassy | 9 |
| Dashboard UX | 4 | Dual surfaces, density/charts risk | 8 |

---

## 28. Final recommendations

### A. MUST DO (required for professional quality)

- Keep blue + light/dark + `--fl-*` names  
- Solid Level 1 surfaces for forms, Lab, dashboard, cards  
- Restrict glass to chrome/overlays  
- One primary button per cluster; stop default pills on buttons  
- Reduce display type scale  
- 44px web / ≥40px popup primary targets  
- Status = color + text  
- Shared button/input/card/alert anatomy  
- RTL/Arabic treated in type and kickers  
- No logic/API/pricing/credit changes  
- Run Phase 0 test commands after each implementation step  

### B. SHOULD DO

- Explicit `--fl-radius-pill` and `--fl-bp-*`  
- `--fl-text-disabled`, `--fl-info`, `--fl-ai-*`  
- Recolor or isolate translate purple  
- Weaker atmosphere; remove `fl-glow`  
- Align `.fl-action-btn` with `.btn`  
- Nav IA from Phase 1A (Student in; Writing Lab demoted) — **copy/IA, not this token file alone**  
- Contrast meter pass on warn/faint/glass  

### C. NICE TO HAVE (optional polish)

- `--fl-color-*` aliases  
- Custom Latin webfont  
- Noto Sans Arabic for UI (not only PDF)  
- Tabular nums everywhere  
- Consolidating all historical breakpoints in one cleanup PR  

### D. DO NOT DO

- Tailwind / new UI kit / merge dashboards  
- Replace brand blue  
- Rename all tokens in one breaking PR  
- Glass on auth cards “for premium”  
- Fake metrics, purple nebula, giant H1  
- 28px primary buttons  
- Touching backend, Paddle, engines, schemas  

---

## 29. Unresolved decisions (require human approval)

1. **Latin webfont vs keep system fonts**  
2. **Arabic UI font:** Noto Sans Arabic (reuse PDF file) vs another licensed face  
3. **Optional `--fl-color-*` aliases** vs single `--fl-accent` vocabulary  
4. **Default theme:** `index.html` light vs `themeFromSystem` dark fallback — which is intended?  
5. **`--fl-state-translate` purple:** recolor (teal/cyan) vs keep for translation chips only  
6. **Primary button:** slightly rounded 8px vs exception pill **only** for Get Flowlary  
7. **Display size:** proposed max `3.25rem` vs keep closer to current  
8. **WL-1 test failure:** fix before any learning-surface CSS?  
9. **Warn color on light:** darken `#b8860b` vs always use warn chips with dark text  

---

## 30. What this spec is not

Not an implementation. Not a homepage mock. Not a license to edit `tokens.css` until this document is approved.

---

*End of Phase 1B specification. Await approval before any visual implementation.*
