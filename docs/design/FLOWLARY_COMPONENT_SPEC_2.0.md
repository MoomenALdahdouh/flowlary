# Flowlary Component Specification 2.0

**Phase:** 2  
**Date:** 2026-09-03  
**Status:** Specification only — no implementation  
**Parent:** `FLOWLARY_DESIGN_SYSTEM_2.0.md`

---

## Shared vs context-specific

| Shared (all surfaces) | Marketing-only | Product-only |
|----------------------|----------------|--------------|
| Button, Link, Badge, Alert, Input, Textarea, Select, Toggle, StatusIndicator, Skeleton, Tooltip | PageHero, BrowserStage, ConversionPanel, SectionLabel, Reveal (deprecated motion) | UsageStrip, FeatureControl, SpeedBoxOverlay, SystemStatusBlock |

**Source today:** `website/src/components/Ui.tsx` — Button, Alert, Field, Card, PageHero, FactGrid, CtaBanner, GetFlowlaryButton.

---

## Button

| Attribute | Spec |
|-----------|------|
| **Purpose** | Primary user actions and navigation CTAs |
| **Variants** | primary, secondary, tertiary, ghost, danger, link |
| **Sizes** | default (44px min-height), sm (40px) |
| **States** | default, hover, active, focus-visible, disabled, busy (`aria-busy`) |
| **Hierarchy** | One primary per context; secondary adjacent |
| **Use when** | Committing actions, CTAs, form submit |
| **Do NOT** | Multiple primaries; pill shape on marketing CTAs; "Try" label on non-/try targets |
| **A11y** | `aria-label` if icon-only; `aria-disabled` on disabled links; focus ring `--fl-focus` |

**Button group:** Max 2 visible in hero; wrap on mobile with `--fl-space-3` gap.

---

## Link

| Attribute | Spec |
|-----------|------|
| **Purpose** | Inline and standalone navigation |
| **Variants** | default (accent underline), subtle (footer), nav-link |
| **Use when** | In prose, footer, tertiary navigation |
| **Do NOT** | Style as button except `btn-link` variant |
| **A11y** | Visible focus; meaningful text (no "click here") |

---

## Input / Textarea / Select

| Attribute | Spec |
|-----------|------|
| **Purpose** | Form entry — account, feedback, support search, lab |
| **Variants** | default; error (`aria-invalid`) |
| **States** | default, hover, focus, disabled, error |
| **Classes** | `.fl-input`, `.fl-textarea`, `.fl-select` (existing) |
| **Use when** | User text entry |
| **Do NOT** | Custom borders per page; native appearance without min-height |
| **A11y** | Associated `<label>` or `aria-label`; error in `.fl-field-error` with `aria-describedby` |

---

## Checkbox / Toggle

| Attribute | Spec |
|-----------|------|
| **Purpose** | Boolean settings — popup features, consent, preferences |
| **Toggle** | Switch pattern for on/off features (popup) |
| **Checkbox** | Forms — student intent, consent, diagnostics |
| **States** | on/off, disabled, busy |
| **A11y** | Role switch for toggles with `aria-checked`; label always visible |

---

## Card

| Attribute | Spec |
|-----------|------|
| **Purpose** | Grouped content — features, pricing, dashboard panels |
| **Variants** | default (border only); elevated (shadow 1); highlight (accent border) |
| **Marketing** | padding `--fl-space-5`; airy |
| **Dashboard** | padding `--fl-space-4`; `.wd-card` pattern |
| **Use when** | Scannable grouped content |
| **Do NOT** | Glass blur on dashboard cards; nested cards >2 deep |
| **A11y** | Heading inside card for screen reader landmarks |

---

## Badge

| Attribute | Spec |
|-----------|------|
| **Purpose** | Status, fidelity, plan labels |
| **Variants** | default, accent, ok, warn, pill |
| **Special** | **FidelityBadge:** simulated (warn/neutral), live (success/info) |
| **Use when** | Simulated/Live, Pro, Student, plan tags |
| **Do NOT** | Uppercase badges in RTL (existing rule) |
| **A11y** | Text must convey meaning; not color-only |

---

## Status indicator

| Attribute | Spec |
|-----------|------|
| **Purpose** | Extension on/off, bridge, AI usage — Part 6 states |
| **Variants** | dot + label; strip (popup usage); pill (header) |
| **States** | ready, working, unavailable, exhausted, paused, connected, disconnected |
| **Source today** | `SystemStatusBlock`, `HeaderStatusPill`, `.fl-ai-strip` |
| **Use when** | Any system state communication |
| **Do NOT** | Tooltip-only status |
| **A11y** | Text label always; `role="status"` for live updates |

---

## AI indicator

| Attribute | Spec |
|-----------|------|
| **Purpose** | Subset of StatusIndicator for AI operations |
| **Visual** | Inline-start 3px border + label (keep existing strip pattern) |
| **States** | ready, working, success, unavailable, exhausted |
| **Use when** | Lab analyze bar, Learning Coach busy, popup usage |
| **A11y** | `aria-busy` during working; announce completion |

---

## Alert

| Attribute | Spec |
|-----------|------|
| **Purpose** | Inline notices — errors, consent, billing |
| **Variants** | info, success, warning, error |
| **Structure** | icon + title + text (existing `.fl-alert`) |
| **Use when** | Page-level or section-level messages |
| **Do NOT** | Stack >2 alerts without dismiss |
| **A11y** | `role="alert"` for errors; info may use `role="status"` |

---

## Tooltip

| Attribute | Spec |
|-----------|------|
| **Purpose** | Supplementary hints on controls |
| **Use when** | Icon buttons, truncated labels |
| **Do NOT** | Essential information only in tooltip |
| **A11y** | Keyboard accessible; `aria-describedby`; dismiss on Esc |

**Note:** Not widely implemented today — CREATE in Phase 3/4 if needed.

---

## Tabs

| Attribute | Spec |
|-----------|------|
| **Purpose** | Playground modes, feedback hub (before ticket tab removal) |
| **Pattern** | `role="tablist"` + `aria-selected` |
| **Visual** | Underline or segmented control — not mixed styles |
| **Use when** | Same-context mode switching |
| **Do NOT** | Tabs for cross-page navigation |
| **A11y** | Arrow key nav between tabs; panel `role="tabpanel"` |

---

## Navigation

| Attribute | Spec |
|-----------|------|
| **Purpose** | Header, footer, dashboard sidebar, mobile drawer |
| **Active** | accent soft background + accent text |
| **Hover** | hover fill |
| **Focus** | `--fl-focus` outline |
| **Disabled** | muted + no pointer |
| **See** | NAVIGATION_SPEC + DESIGN_SYSTEM §7 |

---

## Breadcrumb

| Attribute | Spec |
|-----------|------|
| **Purpose** | Feature depth, dashboard (optional) |
| **Use when** | Features index → detail |
| **Do NOT** | Home marketing (flat IA) |

**CREATE** Phase 3 if feature pages need hierarchy.

---

## Modal / Dialog

| Attribute | Spec |
|-----------|------|
| **Purpose** | Mobile nav, confirm destructive actions |
| **Pattern** | focus trap, Esc close, backdrop |
| **Visual** | elevation 2 panel; overlay token |
| **Source today** | `#mobile-nav` in Layout |
| **A11y** | `role="dialog"`, `aria-modal`, labelled-by, return focus |

---

## Dropdown

| Attribute | Spec |
|-----------|------|
| **Purpose** | Locale switcher, account menu (future) |
| **Pattern** | button + listbox/popover |
| **Source today** | LocaleSwitcher |
| **A11y** | `aria-expanded`, `aria-haspopup`, keyboard nav |

---

## Toast

| Attribute | Spec |
|-----------|------|
| **Purpose** | Transient success — "Learning synced" |
| **Duration** | 4s auto-dismiss; pause on hover |
| **A11y** | `role="status"` live region |

**CREATE** Phase 4/5 — not in website today.

---

## Progress

| Attribute | Spec |
|-----------|------|
| **Purpose** | Usage bar, practice session progress |
| **Variants** | linear bar; stepped (practice) |
| **Colors** | accent default; warn near limit |
| **A11y** | `role="progressbar"` with values |

---

## Skeleton

| Attribute | Spec |
|-----------|------|
| **Purpose** | Dashboard loading — avoid layout jump |
| **Source today** | Dashboard skeleton pattern (Phase 1G) |
| **Visual** | muted surface blocks; no shimmer gradient (too SaaS) |
| **A11y** | `aria-busy` on container; label "Loading" |

---

## Empty state

| Attribute | Spec |
|-----------|------|
| **Purpose** | No data — practice, progress, tickets |
| **Structure** | title + one sentence + single action |
| **Use when** | Zero items in panel |
| **Do NOT** | Marketing copy; multiple CTAs |
| **Source today** | `.empty-state` in global.css |

---

## Error state

| Attribute | Spec |
|-----------|------|
| **Purpose** | Failed fetch, AI unavailable |
| **Structure** | Alert error + retry action |
| **Copy layer** | Error language per CONTENT_ARCHITECTURE |
| **Do NOT** | Raw API messages; dev instructions (`npm run dev:api`) |

---

## Loading state

| Attribute | Spec |
|-----------|------|
| **Purpose** | Button busy, panel loading |
| **Patterns** | skeleton (panels); `aria-busy` + disabled button (actions) |
| **Do NOT** | Full-page spinners on dashboard panel switch |

---

## Marketing-specific components

### PageHero

- kicker (label typography) + h1 + lead + optional btn-row
- Used on inner pages — not home hero (custom)

### BrowserStage / PopupPreview

- Always include mock disclaimer caption (TERMINOLOGY: "Representative interface")
- PopupPreview matches extension structure — parity test exists

### ConversionPanel

- **MERGE** `.mh-final-panel`, `.feat-final-panel`, `.pr-final-card`, `.cta-panel`
- One h2 + lead + btn-row (primary Install + secondary)
- Phase 3 CREATE

### SectionLabel

- Same as kicker — alias to label typography token

### Reveal

- **DEPRECATE** scroll animation default
- Keep component for reduced-motion-safe no-op

---

## Playground / Lab components

| Component | Fidelity badge | Notes |
|-----------|----------------|-------|
| DemoShell | Simulated | Mode tabs |
| ProcessingOverlay | AI working | Playground only |
| WritingLab textarea | Live | Consent gate before AI |

---

## Extension-specific (Phase 5 spec reference)

| Component | Notes |
|-----------|-------|
| FeatureControl | Toggle + mode select |
| UsageStatusCard | Compact usage |
| ShortcutKey | kbd cluster LTR |
| Speed Box panel | layout feature color |

---

## Component–token matrix

| Component | Primary tokens |
|-----------|----------------|
| Button primary | accent, on-accent, radius-sm |
| Card | surface, border, radius-md |
| Alert error | error, error-soft |
| Status strip | ai-* or state-* + border-inline-start |
| Nav active | accent-soft, accent-hover |
| FidelityBadge simulated | state-simulated |
| FidelityBadge live | state-live |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 2 component spec |
