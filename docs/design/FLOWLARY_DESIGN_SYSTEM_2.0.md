# Flowlary Design System 2.0

**Phase:** 2 — Design System Architecture  
**Date:** 2026-09-03  
**Status:** Specification only. No implementation.  
**Visual direction:** Precision + Human (Phase 0)  
**Inputs:** Phase 0–1 design docs, `packages/shared/src/tokens.css`, website/extension CSS

---

## Document map

| File | Scope |
|------|-------|
| `FLOWLARY_COMPONENT_SPEC_2.0.md` | Component inventory, variants, a11y |
| `FLOWLARY_RESPONSIVE_ACCESSIBILITY_2.0.md` | Breakpoints, RTL, WCAG |
| `FLOWLARY_DESIGN_MIGRATION_2.0.md` | Current audit, debt, migration priorities |

---

## Part 1 — Current Design System Audit (summary)

Full audit in `FLOWLARY_DESIGN_MIGRATION_2.0.md`.

| Area | Current state | Verdict |
|------|---------------|---------|
| **Token source** | `packages/shared/src/tokens.css` — dark default + `html[data-theme='light']` | **KEEP** structure, **REPLACE** glass-heavy usage |
| **Website CSS** | 13 stylesheets; `global.css` ~2500 lines mixing layout + components | **MERGE** into semantic layers in Phase 3 |
| **Extension CSS** | `popup/tokens.css` ~2000 lines; imports shared tokens | **KEEP** shared tokens; **MERGE** popup-specific |
| **Tailwind** | Not used | N/A |
| **Typography** | System stacks (Segoe/SF); fluid clamp headings | **REPLACE** with intentional pairing (Phase 3) |
| **Colors** | Blue accent `#5b8cff`; feature states (translate/layout/live); AI states | **KEEP** semantic roles; tune for Precision + Human |
| **Glass** | `glass.css`, backdrop-filter widespread | **DEPRECATE** for marketing; **REPLACE** with surface elevation |
| **Buttons** | `.btn` + 6 variants in `Ui.tsx` / `global.css` | **KEEP** variant model |
| **Components** | Partial in `Ui.tsx` (Button, Alert, Field, Card, PageHero…) | **KEEP**; **CREATE** missing shared kit |
| **Page CSS** | `home.css`, `features-page.css`, `product-pages.css`, etc. | **DEPRECATE** page-specific patterns → tokens |
| **Motion** | Scroll reveal, demo animations in `motion.css` | **REPLACE** marketing motion; **KEEP** functional only |
| **Theme** | Dark default; theme toggle exists | **Recommend dual-theme** (see §3A) |
| **RTL** | `html[dir='rtl']` font swap; logical properties partial | **KEEP** direction; **CREATE** full RTL rules doc |
| **Duplication** | `.card` vs `.fl-surface-*` vs `.glass-*` vs `.wd-card` | **MERGE** to semantic surfaces |
| **Final CTAs** | `.mh-final-panel`, `.feat-final-panel`, `.pr-final-card`, `.cta-panel` | **MERGE** → one ConversionPanel pattern |
| **Feedback UI** | Ad-hoc `.fb-*` in global.css | **REPLACE** with component spec |
| **AI indicators** | `--fl-ai-*`, `.fl-ai-strip`, `.wd-ai-status` | **KEEP** semantics; unify component |

---

## Part 2 — Design Principles

### 1. Precision before decoration

**Rationale:** Flowlary helps people finish writing correctly — visual language must feel instrument-grade, not promotional wallpaper.  
**Implication:** Prefer borders, spacing, and typography hierarchy over blur, glow, and gradient atmospheres. Decorative radial backgrounds on `body` become optional/subtle or removed on product surfaces.

### 2. Human warmth through copy and spacing, not gimmicks

**Rationale:** Phase 0 personality is warm + precise — warmth comes from readable prose, generous marketing whitespace, and calm status messaging.  
**Implication:** No chat-bubble mascots, no "AI sparkle" icons. Use plain language in labels; round corners stay moderate (8–12px product, not pill-everything).

### 3. One product, one token chain

**Rationale:** Website, dashboard, popup, Speed Box must feel related.  
**Implication:** All surfaces consume `@flowlary/shared/tokens.css`. Surface-specific CSS only for density/layout — never fork colors per page.

### 4. Status is always visible

**Rationale:** Product gap G2 — invisible corrections erode trust.  
**Implication:** AI, connection, pause, and processing states use shared StatusIndicator + text label; never color alone (Part 6).

### 5. Marketing is airy; product is compact

**Rationale:** Phase 1 content layers differ in density.  
**Implication:** Two density modes: `--fl-density-marketing` (section padding `--fl-space-8`–`10`) and `--fl-density-product` (compact controls, tighter stacks).

### 6. Motion explains state, not decor

**Rationale:** Scroll-reveal on every section reads as template SaaS.  
**Implication:** Animate: panel open, loading, success flash, demo playback. Do not animate: section entrance on marketing pages (or make opt-in per hero only).

### 7. Honest fidelity labeling

**Rationale:** Playground vs Lab vs Extension fidelity ladder (Phase 1).  
**Implication:** Badges `Simulated` and `Live` use dedicated tokens `--fl-state-simulated`, `--fl-state-live-product` — not generic accent.

### 8. Control surfaces scan in under 3 seconds

**Rationale:** Popup = control center; Speed Box = quick repair.  
**Implication:** Popup max visual depth 2 levels; primary toggle and status above fold; feature toggles collapsible secondary.

### 9. Bilingual parity is layout parity

**Rationale:** Primary persona is Arabic/English.  
**Implication:** RTL mirrors navigation and layout; shortcuts stay LTR; Arabic typography gets line-height bump (existing `--fl-line-body-ar`).

### 10. Accessible by default

**Rationale:** WCAG 2.1 AA target.  
**Implication:** Focus rings, 44px touch targets, reduced motion — enforced at component level (see RESPONSIVE_ACCESSIBILITY doc).

---

## Part 3 — Design Tokens

Tokens defined as **semantic names** with roles. Implementation values evolve in `packages/shared/src/tokens.css` during Phase 3 — this doc locks **architecture**, not final hex values.

### 3A. Color tokens — semantic roles

#### Core surfaces

| Token | Role |
|-------|------|
| `--fl-color-bg` | Page background |
| `--fl-color-surface` | Default panel/card |
| `--fl-color-surface-elevated` | Raised card, modal panel |
| `--fl-color-surface-muted` | Secondary panels, inset areas |
| `--fl-color-surface-overlay` | Modal backdrop |

**Map from current:** `--fl-bg`, `--fl-surface`, `--fl-surface-2/3`, `--fl-overlay`

#### Text

| Token | Role |
|-------|------|
| `--fl-color-text-primary` | Headings, body |
| `--fl-color-text-secondary` | Supporting copy |
| `--fl-color-text-muted` | Meta, hints |
| `--fl-color-text-disabled` | Disabled controls |
| `--fl-color-text-on-accent` | Text on accent fills |

**Map from current:** `--fl-text`, `--fl-muted`, `--fl-faint`, `--fl-text-disabled`, `--fl-on-accent`

#### Borders

| Token | Role |
|-------|------|
| `--fl-color-border` | Default dividers |
| `--fl-color-border-strong` | Emphasized edges |
| `--fl-color-border-accent` | Focus/selected accent edge |

#### Brand accent

| Token | Role |
|-------|------|
| `--fl-color-accent` | Primary actions, links |
| `--fl-color-accent-hover` | Hover |
| `--fl-color-accent-pressed` | Active |
| `--fl-color-accent-soft` | Soft fills, active nav |

#### Feedback

| Token | Role |
|-------|------|
| `--fl-color-success` / `-soft` | Success, AI ready |
| `--fl-color-warning` / `-soft` | Caution, exhausted |
| `--fl-color-error` / `-soft` | Errors, destructive |
| `--fl-color-info` / `-soft` | Informational |

#### Feature semantics (capability, not marketing)

| Token | Role |
|-------|------|
| `--fl-color-feature-translate` | Translation contexts |
| `--fl-color-feature-layout` | Layout / Speed Box |
| `--fl-color-feature-live` | Live translation session |

#### Product state semantics (Phase 2 additions)

| Token | Role |
|-------|------|
| `--fl-color-state-ai` | AI processing / assisted |
| `--fl-color-state-simulated` | Playground / mock |
| `--fl-color-state-live` | Live product (Lab, field) |
| `--fl-color-state-local` | Local-only tools (no AI check) |
| `--fl-color-state-connected` | Extension bridge connected |
| `--fl-color-state-disconnected` | Extension not detected |
| `--fl-color-state-paused` | Flowlary paused / site exception |

**Map from current:** Extend `--fl-ai-*`; add explicit simulated/local/connection tokens.

#### Teaching colors (learning UI)

Keep `--fl-teach-spelling`, `--fl-teach-grammar`, `--fl-teach-wording`, `--fl-teach-layout` for progress/practice — dashboard-only.

### Theme recommendation: **Dual-theme, system-respecting default**

| Aspect | Recommendation |
|--------|----------------|
| **Modes** | Light + Dark |
| **Default** | Respect `prefers-color-scheme` on first visit; persist user choice |
| **Why not dark-only** | Marketing trust + readability for long Support/Guide pages; enterprise users expect light option |
| **Why not light-only** | Existing dark polish; extension users often prefer dark; bilingual users on OLED |
| **Implementation** | Keep `html[data-theme='dark'|'light']`; add `auto` initialization |

**Phase 0 Precision + Human:** Light mode primary for marketing screenshots; dark mode fully supported for product surfaces.

### 3B. Typography tokens

**Phase 2 recommendation:** Move from pure system-ui to **defined pairing** while staying native-feeling:

| Role | Family (proposed) | Size | Weight | Line height | Letter spacing | Usage |
|------|-------------------|------|--------|-------------|----------------|-------|
| **display** | `--fl-font-display` | clamp(2.25–3.25rem) | 700 | 0.98–1.08 | -0.05em (LTR) | Marketing hero only |
| **h1** | display | clamp(1.85–2.5rem) | 700 | 1.08 | -0.046em | Page titles |
| **h2** | display | clamp(1.4–1.85rem) | 700 | 1.15 | -0.04em | Section titles |
| **h3** | `--fl-font` | 1.125rem | 650 | 1.35 | -0.02em | Card titles |
| **h4** | `--fl-font` | 1rem | 650 | 1.4 | 0 | Panel subtitles |
| **body** | `--fl-font` | 1.0625rem | 400 | 1.65 (1.75 AR) | 0 | Default text |
| **body-small** | `--fl-font` | 0.92rem | 400 | 1.5 | 0 | Secondary prose |
| **label** | `--fl-font` | 0.75rem | 700 | 1.3 | 0.14em uppercase (LTR only) | Kickers, section labels |
| **caption** | `--fl-font` | 0.8rem | 400 | 1.45 | 0.01em | Meta, disclaimers |
| **code** | `--fl-mono` | 0.85em | 400 | 1.4 | 0 | Shortcuts, IDs |

**Arabic:** `--fl-font-arabic` for `html[dir='rtl']`; reset letter-spacing and uppercase on labels/kickers/badges (already partial in codebase).

**Popup/dashboard:** Scale body to **13px/14px** equivalent — use `--fl-text-body-compact: 0.8125rem` for product density.

### 3C. Spacing scale

Keep existing scale; assign semantic aliases:

| Token | Value | Usage |
|-------|-------|-------|
| `--fl-space-1` | 0.25rem | Inline icon gaps |
| `--fl-space-2` | 0.5rem | Tight stacks |
| `--fl-space-3` | 0.75rem | Form field internal |
| `--fl-space-4` | 1rem | Card padding compact |
| `--fl-space-5` | 1.25rem | Card padding default |
| `--fl-space-6` | 1.75rem | Section sub-gaps |
| `--fl-space-7` | 2.5rem | Section internal |
| `--fl-space-8` | 3.75rem | Marketing section padding |
| `--fl-space-9` | 6rem | Marketing section padding large |
| `--fl-space-10` | 8rem | Hero vertical |

**Dashboard stack gap:** `--fl-space-4` between cards. **Popup stack gap:** `--fl-space-2`–`3`.

### 3D. Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--fl-radius-xs` | 6px | kbd, chips |
| `--fl-radius-sm` | 8px | Buttons, inputs |
| `--fl-radius-md` | 12px | Cards, panels (default) |
| `--fl-radius-lg` | 18px | Marketing header shell, modals |
| `--fl-radius-xl` | 26px | Hero media frames (sparingly) |
| `--fl-radius-pill` | 999px | Status pills only — not default buttons |

**Deprecate:** Universal pill nav links and pill buttons except status chips.

### 3E. Shadows / elevation

Replace glass-shadow dependency with semantic elevation:

| Level | Token | Usage |
|-------|-------|-------|
| 0 | none | Product cards default |
| 1 | `--fl-elev-1` | Subtle hover, header |
| 2 | `--fl-elev-2` | Mobile nav panel, dropdown |
| 3 | `--fl-elev-3` | Modal |

**Map from current:** `--fl-shadow-sm`, `--fl-glass-shadow*` → simplified `--fl-elev-*` without requiring blur.

### 3F. Borders

| Level | Usage |
|-------|-------|
| Default `1px solid var(--fl-color-border)` | Cards, inputs |
| Strong | Elevated panels, table headers |
| Accent | Selected nav, featured pricing |
| Status inset | AI strip inline-start 3px (keep existing pattern) |

### 3G. Motion

| Category | Duration | Easing | May animate |
|----------|----------|--------|-------------|
| **Micro** | 120–180ms | `--fl-ease` | Hover, focus, toggle |
| **Panel** | 240–280ms | `--fl-ease` | Mobile nav, dropdown |
| **Demo** | 280–520ms | `--fl-ease` | Playground playback only |
| **Status** | 180ms | ease | AI working pulse (subtle border) |

**Must NOT animate:** Page scroll reveals (default off Phase 3); parallax; floating hero glows.

**Reduced motion:** Existing global.css rules — enforce at component level too.

### 3H. Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--fl-max` | 76rem | Marketing container |
| `--fl-max-narrow` | 42rem | Prose, legal |
| `--fl-max-dashboard` | 72rem | Dashboard shell |
| `--fl-gutter` | 1rem mobile; 2rem desktop | Container inline |
| `--fl-header-height` | ~4.35rem | Sticky offset |
| `--fl-popup-width` | 360px | Popup fixed |
| Breakpoints | 640, 768, 1024, 1200 | See responsive doc |

---

## Part 5 — CTA System

Aligned with `FLOWLARY_CONTENT_ARCHITECTURE_2.0.md` §17.

| CTA class | Visual variant | Label examples | Destination |
|-----------|----------------|----------------|-------------|
| **Primary conversion** | `btn-primary` | Install Flowlary | Guide / CWS |
| **Secondary** | `btn-secondary` | Try, View pricing | `/try`, `/pricing` |
| **Try** | `btn-secondary` + Simulated badge context | Try | `/try` only |
| **Live try** | `btn-secondary` | Try with live AI, Start writing | `/lab` only |
| **Action** | `btn-primary` in product | Analyze, Sign in, Save | In-context |
| **Utility** | `btn-ghost` / `btn-link` | Dashboard, Continue in Chrome | Nav targets |
| **Destructive** | `btn-danger` | Clear history, Sign out | Confirm first |

### Placement rules

- **One primary** per page viewport / popup view
- **Max two** actions in hero/button rows
- **Try ≠ Start writing ≠ Install** — never interchangeable labels
- Header primary always Install (signed out) or absent (signed in)

### Wording migration

| Old | New |
|-----|-----|
| Get Flowlary | Install Flowlary (until CWS: still routes to Guide) |
| Open full demo | Try |
| Explore features | Features (nav) / View capability (inline) |

---

## Part 6 — Product State Language

| State | Label | Icon | Color token | Where |
|-------|-------|------|-------------|-------|
| **Simulated** | Simulated | Beaker/outline | `--fl-color-state-simulated` | Playground, mocks |
| **Live** | Live | Dot solid | `--fl-color-state-live` | Writing Lab |
| **AI-assisted** | Analyzing… / AI ready | Spark minimal or pulse dot | `--fl-color-state-ai` | Lab bar, popup strip |
| **Local** | Local | None or device | `--fl-color-state-local` | Layout repair hints |
| **Connected** | Extension connected | Link | `--fl-color-state-connected` | Dashboard overview |
| **Disconnected** | Extension not detected | Link break | `--fl-color-state-disconnected` | Dashboard overview |
| **Active** | Flowlary on | Green dot | `--fl-color-success` | Popup status |
| **Paused** | Paused on this site | Pause | `--fl-color-state-paused` | Popup |
| **Processing** | Working… | `aria-busy` + strip | `--fl-ai-working` | Lab, coach |
| **Success** | Done / Synced | Check | `--fl-color-success` | Toasts, inline |
| **Warning** | Checks low | Warning | `--fl-color-warning` | Usage strip |
| **Error** | Unavailable | X | `--fl-color-error` | Alerts |

**Accessibility:** Every state includes visible text; icon is decorative (`aria-hidden`); live regions for async status changes.

---

## Part 7 — Navigation Design Language

Structural spec from `FLOWLARY_NAVIGATION_SPEC_2.0.md` — visual rules only.

### Public header

- Sticky; elevation 1 when scrolled
- Background: solid `--fl-color-surface-elevated` with optional subtle blur **max 8px** (reduce from 12px)
- Nav link: muted default; active = accent soft fill + accent text (keep)
- CTA: primary button, `--fl-radius-sm` (not pill)
- Mobile: dialog panel elevation 2; focus trap (existing)

### Footer

- Muted links; uppercase column headers → label style in LTR; normal case AR
- No CTAs in footer

### Dashboard sidebar

- Surface muted background; sticky below header
- Group kicker: label typography
- Active item: accent soft fill; **not** pill shape — rounded rect
- Mobile: horizontal scroll strip; same active semantics

### Extension popup

- No marketing kickers
- Header card: elevation 1
- Sections separated by `--fl-space-3` gaps; section labels use caption typography

---

## Part 8 — Dashboard Design Language

| Aspect | Marketing | Dashboard |
|--------|-----------|-----------|
| Section padding | `--fl-space-8`–`9` | `--fl-space-4`–`6` |
| Card padding | `--fl-space-5` | `--fl-space-4` |
| Title size | display/h1 | h2/h3 |
| Background | gradient atmosphere | flat `--fl-color-bg` |
| Cards | Optional border only | Border + surface-2 |
| Charts | N/A | Muted grid; accent for data series only |
| AI narrative | N/A | Prose body-small in bordered panel |
| Empty states | Illustration optional | Text + single action |
| Metrics | N/A | Strong number + muted label (existing `.wd-stat-card`) |

**Learning states:** Use teach colors for category chips only — not full card backgrounds.

---

## Part 9 — Extension Design Language

### Popup

- Width 360px; max-height 540px; scroll main
- Density: compact
- Hierarchy: Status → Global toggle → Quick actions → Feature toggles (collapsible) → Dashboard link
- No pricing/marketing

### Speed Box

- Overlay panel; minimal chrome
- Action-first: options list + shortcut hint in caption
- Esc to close — visible in header
- Uses layout feature color token

### Extension dashboard

- Align with web dashboard tokens and nav labels (Phase 5)
- History panel: same card patterns as Progress

### In-field UI (future Phase 5)

- Minimal chip/toast near field
- No modal chains
- Status-first: "Flowlary suggested a change" (addresses G2)
- No marketing language

---

## Part 14 — Design System Governance

1. No arbitrary hex — use semantic tokens only  
2. No page-specific button classes — use `btn-*` variants  
3. No new spacing outside scale without PE exception doc  
4. Terminology from `FLOWLARY_TERMINOLOGY_2.0.md` only  
5. One ConversionPanel pattern for final CTAs  
6. No marketing glass on dashboard/popup inner cards  
7. State colors only via Part 6 tokens  
8. New nav labels require Navigation + Terminology update  
9. New components: proposal → COMPONENT_SPEC addendum → implement  
10. Shared components live in `@flowlary/shared` or `website/src/components/ui/` (Phase 3 decision) — extension imports shared tokens minimum  

### Component proposal template

- Name, purpose, surfaces, variants, states, a11y, tokens used, Figma/spec link

---

## Part 15 — Phase 3 Input Contract

### Phase 3 MAY implement (using this system)

- Marketing pages: Home, Product, Features, Pricing, Try, Lab, About, Guide, Support, Contact, Feedback, Account shell
- Unified ConversionPanel, StatusBadge, FidelityBadge (Simulated/Live)
- Token migration in shared package (non-breaking aliases first)
- Navigation restructure per NAVIGATION_SPEC
- Copy deck from CONTENT_ARCHITECTURE (EN i18n in Phase 3 or 7 per plan)

### Phase 3 must NOT redefine

- Terminology (TERMINOLOGY_2.0)
- CTA semantics (this doc §5, CONTENT_ARCHITECTURE §17)
- Navigation labels (NAVIGATION_SPEC)
- Color/state semantics (this doc §3, §6)
- Typography roles (this doc §3B)
- Page jobs (PAGE_BRIEFS)
- IA routes (IA_2.0)

### Remains locked for later phases

| Topic | Phase |
|-------|-------|
| Dashboard visual rebuild | Phase 4 |
| Popup simplification | Phase 5 |
| Speed Box visual refresh | Phase 5 |
| In-field status UI | Phase 5 |
| Full i18n/AR | Phase 7 |
| Font files self-hosting | Phase 3 optional |

### Phase 3 acceptance (design)

- All marketing pages use token roles only — no hardcoded page CSS colors
- One primary CTA pattern
- Simulated/Live badges on Try and Lab
- No Write/Communicate/Learn homepage sections
- Header nav matches NAVIGATION_SPEC
- Focus visible on all interactive elements

---

## Contradictions reviewed

| Item | Phase 1 | Phase 2 resolution |
|------|---------|-------------------|
| CTA "Get Flowlary" | CONTENT_ARCHITECTURE uses Install Flowlary | Design system adopts **Install Flowlary** as primary label |
| Glass aesthetic | Phase 0 said reduce glass | Tokens deprecate glass for product; header may retain light blur |
| Dark default | Code defaults dark | Dual-theme with system preference recommended |
| Feedback tabs | Phase 1 removes ticket tab | Component spec: Feedback without support tab styling |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 2 design system architecture |
