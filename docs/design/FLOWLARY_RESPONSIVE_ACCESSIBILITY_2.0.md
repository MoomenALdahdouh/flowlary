# Flowlary Responsive & Accessibility 2.0

**Phase:** 2  
**Date:** 2026-09-03  
**Status:** Specification only  
**Target:** WCAG 2.1 Level AA

---

## Part 10 — Bilingual / RTL Rules

### Mirroring

| Element | RTL behavior |
|---------|--------------|
| Page layout | `dir="rtl"` on `html`; use logical properties (`margin-inline`, `padding-inline`, `inset-inline`) |
| Navigation order | DOM order preserved; visual flow mirrors |
| Sidebar | Moves to inline-end |
| Icons (directional) | Flip: arrows, chevrons, external-link if pointing |
| Icons (symmetric) | No flip: check, warning, logo |
| Dialog close | inline-end corner |
| Border accents | AI strip `border-inline-start` (already correct) |

### Typography

| Rule | Detail |
|------|--------|
| Font | `--fl-font-arabic` when `html[dir='rtl']` |
| Line height | `--fl-line-body-ar` (1.75) |
| Kickers/labels | No uppercase; no letter-spacing inflation |
| Badges | No uppercase (existing) |
| Footer headings | No uppercase in AR |
| Display headings | Reset negative letter-spacing |

### Shortcuts (critical)

| Rule | Detail |
|------|--------|
| kbd clusters | Always `dir="ltr"` |
| Container | `aria-label` includes both mac and windows combos (existing KeyCombo pattern) |
| Visual order | Keys left-to-right even on RTL page |
| Copy | Action name localized; keys not translated |

### Numbers and data

| Content | Rule |
|---------|------|
| Usage counts | Locale-formatted digits |
| Charts | LTR axis for numbers; RTL titles |
| Dates | Locale-aware formatting |
| Phone/email | LTR |

### Mixed Arabic/English content

| Context | Rule |
|---------|--------|
| Marketing examples | Show realistic mixed strings; `unicode-bidi: plaintext` on user-content samples |
| User input | `dir="auto"` on textareas (Writing Lab) |
| Product UI labels | Fully localized — no embedded English in AR UI |

### Bilingual examples in marketing

- Side-by-side or stacked: Arabic sentence + English sentence
- Equal visual weight — not English-primary with AR footnote
- Phase 7 translates; Phase 3 EN layouts reserve space for AR line-length expansion (~15–20%)

---

## Part 12 — Responsive Rules

### Breakpoint philosophy

Mobile-first CSS; enhancements at breakpoints. Content never requires horizontal scroll except dashboard tables (scroll container).

| Token | Min width | Role |
|-------|-----------|------|
| `--fl-bp-sm` | 640px | Large phones |
| `--fl-bp-md` | 768px | Tablets, support grids |
| `--fl-bp-lg` | 1024px | Desktop nav visible |
| `--fl-bp-xl` | 1200px | Wide marketing splits |

### Gutters

| Viewport | Container padding |
|----------|-------------------|
| < 768px | 1rem |
| ≥ 768px | 2rem |
| Dashboard | Same; sidebar collapses below 896px (56rem existing) |

### Typography scaling

- Marketing headings: fluid clamp (keep)
- Dashboard headings: clamp with lower max
- Popup: fixed px/rem — no clamp

### Navigation transformation

| Viewport | Public nav | Dashboard nav |
|----------|------------|---------------|
| < 1024px | Hamburger → dialog | Horizontal scroll pills |
| ≥ 1024px | Inline nav + CTA | Sidebar sticky |

### Component behavior

| Component | Mobile | Desktop |
|-----------|--------|---------|
| Button | Full width in mobile nav CTA only | Inline |
| btn-row | Wrap | Horizontal |
| Cards | Single column | Grid per page spec |
| Pricing grid | Stack | 2-column |
| Footer | 1–2 columns | 4 columns |
| Tables (pricing compare) | Scroll `overflow-x: auto` | Full width |
| PageHero | Reduced padding | Standard |
| Playground tabs | Scroll horizontal if needed | Inline |

### Dashboard behavior

- Sidebar → top pill strip < 56rem (existing)
- Charts: min-height fixed; responsive width 100%
- Coach card: stack buttons vertically on narrow

### Popup / extension

- Fixed width — not responsive
- Extension dashboard: follows web dashboard breakpoints when in tab

---

## Part 11 — Accessibility

### WCAG 2.1 AA requirements

| Criterion | Design system enforcement |
|-----------|---------------------------|
| **1.4.3 Contrast** | Text primary on bg ≥ 4.5:1; large text ≥ 3:1; verify accent on-accent pair |
| **1.4.11 Non-text contrast** | UI borders, focus rings, icons ≥ 3:1 |
| **2.1.1 Keyboard** | All actions keyboard reachable |
| **2.4.3 Focus order** | Logical DOM order; mobile nav trap |
| **2.4.7 Focus visible** | `:focus-visible` outline `--fl-focus` 2px offset 2–3px |
| **2.5.5 Target size** | Min 44×44px touch targets (buttons, nav links, tabs) |
| **3.3.1 Error identification** | Fields + alerts describe error |
| **3.3.2 Labels** | All inputs labelled |
| **4.1.2 Name, role, value** | Toggles, tabs, dialogs correct ARIA |

### Keyboard navigation

| Surface | Keys |
|---------|------|
| Mobile nav | Tab cycle; Esc close; focus return to menu button |
| Locale menu | Esc close; click outside |
| Tabs | Arrow keys optional enhancement |
| Dialog | Esc dismiss |
| Skip link | First focusable — visible on focus |

### Focus visibility

- Never `outline: none` without replacement
- Focus ring color: accent — must pass contrast on surface
- `:focus:not(:focus-visible)` — no ring for mouse users OK

### Contrast notes (audit)

- Dark mode muted text `#9aa6bb` on `#05070b` — verify in Phase 3 tooling
- Light mode warn/danger text — already darkened in tokens
- Accent soft backgrounds with accent text — verify

### Touch targets

- `.btn` min-height 2.75rem ✓
- `.nav-link` mobile 2.75rem ✓
- Icon buttons (theme, locale): expand hit area to 44px — verify theme-toggle 2.35rem → **increase in Phase 3**

### Reduced motion

| Rule | Implementation |
|------|----------------|
| `prefers-reduced-motion: reduce` | Disable scroll reveal, demo loops, nav panel animation |
| Essential motion | Instant state change OK |
| Playground demos | Static final frame option |

Existing: `global.css` + `motion.css` — extend to all new components.

### Screen readers

| Pattern | Requirement |
|---------|-------------|
| Status changes | `role="status"` or `aria-live="polite"` |
| Errors | `role="alert"` |
| Loading | `aria-busy="true"` |
| Mock previews | `aria-hidden="true"` on decorative mocks + visible caption |
| Decorative SVG | `aria-hidden` |
| Icon buttons | `aria-label` |

### Form errors

- Inline `.fl-field-error` linked via `aria-describedby`
- Summary alert optional for form-level failure
- Error copy: instructional layer — actionable next step

### Disabled controls

- `disabled` attribute on buttons
- `aria-disabled="true"` on link-styled disabled CTAs
- Visual: `--fl-text-disabled`; not opacity-only

### Status communication

- Never color-only (Part 6 DESIGN_SYSTEM)
- Usage exhausted: text + optional icon
- Connection state: "Extension connected" text in dashboard

### Component-level enforcement checklist

Every new component PR (Phase 3+):

- [ ] Focus visible
- [ ] Touch target ≥44px or documented exception
- [ ] Contrast checked
- [ ] ARIA roles for composite widgets
- [ ] Reduced motion path
- [ ] RTL logical properties
- [ ] kbd LTR if applicable

---

## Testing recommendations (Phase 3+)

- axe-core on marketing pages
- Manual keyboard pass on nav, auth, try/lab
- RTL screenshot pass AR locale
- VoiceOver/NVDA spot check on status updates

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 2 responsive + a11y spec |
