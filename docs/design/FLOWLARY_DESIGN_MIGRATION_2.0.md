# Flowlary Design Migration 2.0

**Phase:** 2  
**Date:** 2026-09-03  
**Status:** Migration plan only — no code changes  
**Related:** `FLOWLARY_DESIGN_SYSTEM_2.0.md` Part 1 audit

---

## Part 1 — Detailed Current Audit

### CSS architecture

```
packages/shared/src/tokens.css     ← canonical tokens (dark + light)
website/src/styles/tokens.css      ← RTL font overrides
website/src/styles/global.css      ← ~2500 lines: reset, header, buttons, footer, forms, misc page styles
website/src/styles/glass.css       ← glass-1/2/3, product-surface
website/src/styles/a11y.css        ← visually-hidden, etc.
website/src/styles/motion.css      ← scroll reveal, demo animations
website/src/styles/product.css     ← popup mock, browser stage
website/src/styles/home.css        ← homepage-specific
website/src/styles/playground.css
website/src/styles/account.css
website/src/styles/dashboard.css
website/src/styles/features-page.css
website/src/styles/writing-lab.css
website/src/styles/product-pages.css
extension/src/popup/tokens.css     ← popup + extension UI (~2000 lines)
extension/src/dashboard/dashboard.css
extension/src/features/layout/speedBox.css
```

**No Tailwind.** No CSS-in-JS. Vite bundles plain CSS imports.

### React components (website)

| Component | File | Styled via |
|-----------|------|------------|
| Button, Alert, Field, Card, PageHero, FactGrid, CtaBanner | `Ui.tsx` | global.css classes |
| Layout, SiteFooter, mobile nav | `Layout.tsx` | global.css |
| ThemeToggle | `ThemeToggle.tsx` | global.css |
| Logo | `Logo.tsx` | SVG |
| Reveal | `Reveal.tsx` | motion.css |
| DashboardShell | `AccountDashboardPanel.tsx` | dashboard.css |
| FeedbackHub | `FeedbackHub.tsx` | global.css `.fb-*` ad-hoc |
| SupportCenter | `SupportCenter.tsx` | global.css + product-pages |
| Playground | `PlaygroundSection.tsx` | playground.css |

### Extension components

| Component | Styled via |
|-----------|------------|
| Popup App, HomeView, FirstWinView | popup/tokens.css |
| SystemStatusBlock, FeatureControl | popup/tokens.css + shared |
| Dashboard panels | dashboard.css |
| Speed Box | speedBox.css (injected) |

### Typography (current)

- Display/body: system UI stacks — no self-hosted fonts
- Fluid clamp on h1/display
- Popup: 13px body
- Arabic: font swap + line-height bump

### Colors (current)

- Dark default (`:root`); light via `html[data-theme='light']`
- Accent blue `#5b8cff` / `#315fd6`
- Feature: translate purple, layout amber, live cyan
- AI: ready/working/unavailable/exhausted mapped to success/accent/warn
- Teaching: spelling rose, grammar amber, wording indigo

### Spacing (current)

- Scale `--fl-space-1` through `--fl-space-10`
- Marketing sections use 8–9; dashboard tighter

### Radius (current)

- xs 6 → pill 999; buttons use sm 8; nav links use pill 999 (**inconsistent**)

### Shadows (current)

- Mix of `--fl-shadow-*` and `--fl-glass-shadow-*`
- Cards often `box-shadow: none` (good) but pricing uses glass shadow

### Buttons (current)

- Variants: primary, secondary, tertiary, ghost, danger, link — **KEEP**
- GetFlowlaryButton wraps primary → Install migration (content)

### Duplicated patterns

| Pattern | Locations | Issue |
|---------|-----------|-------|
| Card surface | `.card`, `.fl-surface-1/2`, `.glass-2`, `.wd-card`, `.pp-glass` | 5 card systems |
| Final CTA | `.mh-final-panel`, `.feat-final-panel`, `.pr-final-card`, `.cta-panel` | 4 patterns |
| Form fields | `.fl-field` vs `.account-form` vs `.fb-field` | 3 form styles |
| Tabs | `.fb-tab`, playground tabs, support topic nav | 3 tab visuals |
| Shortcut display | Guide + Support duplicate KeyCombo | 2 implementations |
| Hero | `.hero`, `.pp-hero`, `.page-hero` | 3 hero wrappers |
| Empty/loading | `.empty-state`, `.loading`, skeleton partial | inconsistent |

---

## Classification: KEEP / MERGE / REPLACE / DEPRECATE / CREATE

### KEEP

- `@flowlary/shared/tokens.css` as single source
- Button variant model (primary…link)
- AI semantic colors `--fl-ai-*`, `--fl-state-*`
- Teaching colors for learning UI
- Focus visible pattern
- Skip link
- Mobile nav dialog behavior (focus trap, Esc)
- Dashboard sidebar IA styling structure
- SystemStatus / ai-strip semantic pattern
- Logical properties usage (partial — extend)
- Reduced motion global guard
- kbd styling for shortcuts
- Locale switcher dropdown pattern

### MERGE

- All card patterns → **Card** component + `--fl-color-surface*` tokens
- Final CTA panels → **ConversionPanel**
- Form field styles → **Field** component (fl-field)
- Hero wrappers → **PageHero** + **MarketingHero** (home only)
- Tab styles → **Tabs** component
- KeyCombo → single **ShortcutKey** component (Phase 3)
- `.muted`/`.faint` → text secondary/muted tokens
- glass-1/2/3 + fl-surface → elevation levels 0–2

### REPLACE

- Body radial gradient atmosphere → subtle flat bg or single hero-only gradient
- Scroll reveal (Reveal) → static sections default
- Pill nav links → rounded rect `--fl-radius-sm`
- Pricing card glass blur → solid surface + accent border featured
- Ad-hoc `.fb-*` feedback styles → component spec
- Header heavy blur → lighter blur or solid
- `GetFlowlaryButton` label → Install Flowlary (i18n Phase 3)

### DEPRECATE

- `snow-grain`, excessive atmosphere tokens for product surfaces
- `.glass-interactive` hover lift on marketing cards
- Page-specific CSS files' color/spacing overrides (migrate to tokens)
- `.band-*` gradient sections — replace with simple surface alternation
- Legacy `home.*` marketing styles when home restructured
- Orphan marketing component styles (unused components)
- Feedback support tab UI (IA change)

### CREATE

- `--fl-color-state-simulated`, `--fl-color-state-local`, connection states
- **FidelityBadge** (Simulated / Live)
- **ConversionPanel**
- **ShortcutKey** shared
- **StatusIndicator** unified (wrap SystemStatusBlock)
- `--fl-text-body-compact` for product density
- `--fl-elev-*` elevation tokens
- Optional self-hosted font files (decision open)

---

## Part 13 — Design Debt Migration Map

| Current pattern | Desired pattern | Priority | Phase |
|-----------------|-----------------|----------|-------|
| 5 card systems | Card + surface tokens | P0 | 3 |
| 4 final CTA CSS classes | ConversionPanel | P0 | 3 |
| Write/Comm/Learn home sections | 7-section home (CONTENT_ARCHITECTURE) | P0 | 3 |
| Header nav (Product→#write) | Features/Pricing/Try/Product | P0 | 3 |
| Get Flowlary CTA label | Install Flowlary | P0 | 3 |
| No Simulated/Live badges | FidelityBadge on /try, /lab | P0 | 3 |
| Hash routes #writing-lab, #try-flowlary | /lab, /try | P0 | 3 |
| glass-heavy marketing | Surface elevation | P1 | 3 |
| Scroll reveal everywhere | Static default | P1 | 3 |
| Pill nav/button radius | sm radius buttons | P1 | 3 |
| Duplicate KeyCombo | ShortcutKey component | P1 | 3 |
| Feedback `.fb-*` ad-hoc | Component spec | P1 | 3 |
| Account+dashboard same URL | /dashboard split | P1 | 4 |
| Extension navHome/navManage labels | Write/Learn/Account | P1 | 5 |
| Popup three-tool framing | Control-center hierarchy | P1 | 5 |
| Invisible field corrections (G2) | In-field status chip | P0 | 5 |
| Theme toggle 2.35rem target | 44px min | P2 | 3 |
| `wd-nav button` uses `--fl-fg` (undefined?) | `--fl-text` | P2 | 4 |
| prerender missing routes | SEO parity | P2 | 3 |
| Extension popup 13px vs web 17px body | compact token explicit | P2 | 5 |
| Speed Box isolated CSS | shared layout tokens | P2 | 5 |
| Blog placeholder page | remove | P2 | 3 |

**P0** = blocks coherent Phase 3 implementation  
**P1** = major visual/IA inconsistency  
**P2** = cleanup

---

## Surface-by-surface migration notes

### Marketing website (Phase 3)

- New pages: `/product`, `/try`, `/lab` routes
- Refactor Home sections per PAGE_BRIEFS
- Slim Features index
- Adopt ConversionPanel, FidelityBadge, ShortcutKey link pattern
- Reduce global.css by moving page rules to components or deleting obsolete

### Web dashboard (Phase 4)

- Route `/dashboard`
- Fix token typo `--fl-fg`
- Align cards to Card spec
- Extension history link card

### Extension (Phase 5)

- Popup hierarchy refactor (content + visual)
- Nav label alignment
- In-field status
- Speed Box token alignment

### Shared package (Phase 3–5)

- Add semantic token aliases (non-breaking)
- Document breaking removals in Phase 3 changelog

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Token rename breaks extension + website | Alias old → new; deprecate over 2 phases |
| Removing glass looks "flat" | Use elevation borders + spacing hierarchy |
| RTL regression | AR pass in Phase 3/7 |
| Popup parity test fails | Update PopupPreview after Phase 5 popup change |
| Contrast failure light mode | Automated contrast check in CI (Phase 3) |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 2 migration map |
