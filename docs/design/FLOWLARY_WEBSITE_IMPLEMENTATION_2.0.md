# Flowlary Website Implementation 2.0

**Phase:** 3  
**Date:** 2026-09-03  
**Status:** Complete (website public experience)

---

## Summary

Phase 3 implements the public website UX/UI defined in Phases 0–2. The marketing site now follows the approved IA, terminology, seven-section homepage, surface-map product page, simulated Try and live Writing Lab routes, and the Precision + Human design direction with reduced header glass.

**Not in scope (unchanged):** backend, extension, dashboard product logic.

---

## Routes implemented

| Route | Page | Notes |
|-------|------|-------|
| `/` | Home (PE2 seven sections) | Hero → Problem → Solution → Surfaces → Proof → Try → Final CTA |
| `/product` | Product surface map | control, actions, repair, learn |
| `/try` | Simulated playground | FidelityBadge: Simulated |
| `/lab` | Writing Lab (live) | FidelityBadge: Live; existing `WritingLab` component |
| `/features` | Problem/outcome index | Rebuilt; detail routes unchanged |
| `/features/*` | Feature detail pages | Existing pages retained |
| `/pricing`, `/about`, `/guide`, `/support`, `/contact`, `/feedback`, `/account` | Updated shell/copy/CTAs where needed | Dashboard not redesigned |
| Legal (`/privacy`, `/terms`, `/cookies`) | Design system styling only | Content preserved |

---

## Routes migrated

| Legacy | Canonical | Mechanism |
|--------|-----------|-----------|
| `/#writing-lab` | `/lab` | `LegacyHashRedirect` |
| `/#try-flowlary` | `/try` | `LegacyHashRedirect` |
| Get Flowlary → `/support#get-flowlary` | Install Flowlary → `/guide` | `InstallFlowlaryButton` (until CWS URL) |
| Home W/C/L sections | Removed from default home | Replaced by PE2 sections |
| Features journey (Write/Communicate/Learn) | Features index cards + `/product` | `FeaturesShowcase` rebuild |
| Support → `/#try-flowlary` | `/try` | `SupportCenter` link |
| Account install CTA | `/guide` | Was `/support#get-flowlary` |

**Retained:** `/support#get-flowlary` install section (Support still documents install; primary CTA is Guide).

---

## Components created / reused

### Created
- `FidelityBadge`, `InstallFlowlaryButton`, `ConversionPanel`, `SectionHeading` — `website/src/components/Ui.tsx`
- `LegacyHashRedirect` — hash → route migration
- `HomePe2Sections.tsx` — seven homepage sections
- `Product.tsx`, `Try.tsx`, `Lab.tsx` pages
- `pe2.css` — fidelity badges, conversion panel, index grids, header shell

### Reused
- `Button`, `Alert`, `Card`, `PageHero`, `PlaygroundSection`, `WritingLab`
- `PopupPreview`, `BuiltWithUsersSection`, `FeaturesShowcase` (rebuilt)
- `Layout`, `ThemeToggle`, `ScrollManager`, auth/account clients

### Removed / deprecated
- `MarketingHomeSections.tsx` — orphan W/C/L home sections (deleted)
- `GetFlowlaryButton` — alias to `InstallFlowlaryButton`
- Feedback **Support ticket tab** UI — removed; escalation links to Contact/Support (backend ticket API unchanged)

---

## Design system implementation

| Area | Status |
|------|--------|
| Semantic tokens (`--fl-state-simulated`, `--fl-state-live`) | Added in `packages/shared/src/tokens.css` |
| Header glass reduced | `header-shell` without backdrop blur |
| Primary CTA | Install Flowlary → `/guide` |
| Fidelity labels | Simulated on `/try`, Live on `/lab` |
| ConversionPanel | Home final, Features final, Product final |
| Footer IA | Product · Account · Help · Legal |
| Dual theme | Existing `ThemeToggle` + tokens (verified in build) |

---

## Responsive / accessibility

- Mobile drawer preserved; primary nav matches desktop (Features, Pricing, Try, Product)
- Skip link, landmarks, heading hierarchy on new pages
- FidelityBadge uses `role="status"` + `aria-label`
- Touch targets: existing button min-heights retained
- Reduced motion: existing global rules apply
- **Manual visual QA:** recommended on real devices for header drawer, Try playground, Lab gates, pricing forms

---

## Theme status

Light/dark/system via existing `ThemeToggle` and semantic tokens. New PE2 surfaces use `--fl-surface-*` and border-first cards (no page-specific theme logic).

---

## Try / Lab fidelity

| Surface | Badge | Behavior |
|---------|-------|----------|
| `/try` | **Simulated** | Scripted `PlaygroundSection`; info alert states no live AI |
| `/lab` | **Live** | Authentic `WritingLab` gates (sign-in, credits, errors) |
| Home Try section | Both badges on cards | Links to `/try` and `/lab` |

---

## Tests run

```
npm run test:web  → 24 files, 166 tests passed
npm run build:web → tsc + vite + SSR prerender (20 routes + 404) passed
```

Updated: `routes.test.tsx`, `buttons.test.tsx`, `seo.test.tsx`, `demos.test.tsx`

---

## Visual QA checklist (code review; spot-check in browser recommended)

| Page | Desktop | Mobile | Notes |
|------|---------|--------|-------|
| Home | ✓ structure | ✓ grid classes | No W/C/L journey |
| Product | ✓ | ✓ | Surface anchors |
| Features | ✓ index | ✓ | No duplicate homepage |
| Pricing | unchanged layout | — | Install → guide |
| Try | ✓ Simulated badge | — | |
| Lab | ✓ Live badge | — | |
| Guide/Support/Contact/Feedback | shell | — | Feedback tab change |
| Account | entry | — | Install → guide |
| Legal | tokens | — | |

---

## Known deviations

1. **Support `#get-flowlary` section** still exists (install docs); primary install CTA is `/guide` per IA.
2. **Legal content** still references `/support#get-flowlary` in some related links — href migration deferred to avoid legal rewrite.
3. **Support copy** in i18n may still say "Get Flowlary" in body text — label migration to "Install Flowlary" partial (CTA keys updated).
4. **Arabic `productPage` / `tryPage` / `labPage`** — English fallback via `en.*` reference in `ar.ts` until Phase 7 localization.
5. **Feedback backend** still accepts ticket API if called programmatically; UI no longer exposes support tab.
6. **Orphan components** (`HeroSection.tsx`, `FinalCta.tsx`) remain on disk but unused — safe cleanup in Phase 4.

---

## Remaining Phase 4 work

- Dashboard UX/UI 2.0 (explicitly not started)
- Extension popup / Speed Box alignment with surface-map copy
- Full locale parity for new PE2 keys (12 languages)
- Legal link updates to `/guide` where appropriate
- Remove orphan marketing components
- Support page install section → link-first to Guide (reduce duplication)
- `account/support` ticket UX → dashboard support phase
- Playwright visual regression pass if added in CI

---

## Phase gate confirmation

- [x] Phase 0–2 design docs unchanged
- [x] No backend changes
- [x] No extension logic changes
- [x] No dashboard implementation changes
- [x] Website build passes
- [x] Website tests pass
- [x] Target routes work
- [x] Navigation matches Phase 1
- [x] Try = Simulated, Lab = Live
- [x] No fake proof added

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 3 website implementation record |
