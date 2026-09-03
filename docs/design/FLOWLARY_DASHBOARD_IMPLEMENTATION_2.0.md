# Flowlary Dashboard Implementation 2.0

**Phase:** 4  
**Date:** 2026-09-03  
**Status:** Complete (authenticated web dashboard UX/UI)

---

## Summary

Phase 4 implements the authenticated web dashboard per Phases 0–2 IA, terminology, and design system. The dashboard is a product workspace — not marketing — and displays only data and capabilities that exist today (learning sync, practice, progress, AI report narration where entitled, billing, extension bridge probe).

**Not in scope (unchanged):** backend APIs/schema, extension popup/content script/Write Gate, auth architecture, billing logic, admin.

---

## 1. Dashboard architecture

| Layer | Implementation |
|-------|----------------|
| Auth entry | `/account` — sign-in, register, verification gates |
| Workspace | `/dashboard` — `DashboardPage` → `DashboardApp` |
| Support workspace | `/dashboard/support` — `DashboardSupportPage` |
| Shell | `DashboardShell` — topbar, sidebar, mobile nav, sign-out |
| Sections | Hash navigation on `/dashboard`: `#overview`, `#practice`, `#progress`, `#report`, `#settings`, `#account` |
| Session | Existing JWT web account client; signed-out users redirect to `/account` |
| Learning data | `useWebLearningBundle` + `learningData.ts` services (unchanged API contracts) |
| Extension link | `probeExtensionBridge()` — honest connected/disconnected/not-installed states |
| Billing | `workspaceBilling.ts` shared props builder |

---

## 2. Routes / sections implemented

| Route / section | Status | Notes |
|-----------------|--------|-------|
| `/dashboard` | Implemented | Signed-in workspace home |
| `/dashboard#overview` | Rebuilt | Learning loop, lab CTA, brief, coach, plan usage, extension, history note |
| `/dashboard#practice` | Kept + aligned | Real pattern-based practice from learning bundle |
| `/dashboard#progress` | Kept + aligned | Charts/metrics from real events; building state when insufficient |
| `/dashboard#report` | Rebuilt labels | Observed data vs AI interpretation; Pro/Trial narration disclaimer |
| `/dashboard#settings` | Kept | Learning profile, export/import (extension JSON format) |
| `/dashboard#account` | Kept | Plan, usage, billing portal/checkout via existing clients |
| `/dashboard/support` | Implemented | `SupportTicketsPanel` in dashboard shell |
| `/account` (signed in) | Redirect | → `/dashboard` preserving hash/search |
| `/account/support` | Redirect | → `/dashboard/support` |

**Removed from dashboard IA:** web History (extension-only). **Not added:** Activity tab, fake metrics, marketing hero blocks.

---

## 3. Components created / reused

### Created (Phase 4)
- `DashboardShell.tsx` — PE2 compact workspace shell
- `ConnectionStatus.tsx` — extension bridge states
- `LearningLoopStrip.tsx` — Real writing → patterns → practice → progress
- `WritingLabLink.tsx` — `/lab` + Live `FidelityBadge`
- `Dashboard.tsx`, `DashboardSupport.tsx` — route pages
- `AccountRedirects.tsx` — legacy support redirect
- `workspaceBilling.ts` — shared billing/usage props

### Reused
- `DashboardApp`, all panel components, `DailyBriefCard`, `LearningCoachCard`, `ProgressCharts`, `SupportTicketsPanel`, `PersonalStatsCard`, `FidelityBadge`, `Button`, design tokens

### Extension dashboard alignment opportunity
The extension dashboard (`extension/src/dashboard/`) shares learning panel concepts. Visual alignment can reuse PE2 CSS tokens and `LearningLoopStrip` copy patterns in a future extension-only pass without changing extension behavior.

---

## 4. Data sources and real capabilities

| Surface | Source | Empty / locked behavior |
|---------|--------|-------------------------|
| Overview brief | `DailyBriefCard` / learning events | Empty + insufficient states |
| Coach | `resolveWebLearningCoach` (AI) | Error state; AI interpretation label |
| Practice | `WebLearningBundle` patterns | None/emerging when no patterns |
| Progress | Event aggregates + charts | Building / insufficient trend copy |
| Report | `resolveWebFullLearningReport` | no_data, failed, cached limit |
| Account usage | `resolveUsageUx` + entitlement API | Real credits/limits only |
| Extension state | `probeExtensionBridge` | checking → connected/disconnected |
| Support tickets | Existing support API via `SupportTicketsPanel` | Existing empty/error states |

No fabricated longitudinal stats, fluency scores, or personality models.

---

## 5. Learning loop implementation

`LearningLoopStrip` on Overview expresses:

1. **Real writing** — Writing Lab or Chrome extension corrections  
2. **Observed patterns** — recurring issues in account learning store  
3. **Practice** — sessions on seen patterns  
4. **Progress** — trends from activity (explicitly not a fluency score)

Copy states dashboard learning does **not** claim automatic engine adaptation (`decideWriting`).

---

## 6. Overview

Answers: recent activity (daily brief), what to practice (brief + coach CTAs), what to do next (Writing Lab, practice/progress links).

Includes: plan/usage from real entitlement, extension connection, extension-only history note, `InstallFlowlaryButton` when extension not detected.

---

## 7. Practice

Unchanged core logic; links updated to `/lab`. Categories come from backend-supported learning patterns (spelling, grammar, wording, layout-related). Credits exhausted state preserved.

---

## 8. Progress

Real event-derived metrics. Advanced charts gated to Pro/Trial where existing logic requires. `WritingLabLink` for next action. Clear building copy when insufficient data.

---

## 9. Report

- **Observed data** sections use standard cards  
- **AI narrative** (Pro/Trial) uses `wd-card-ai` + `wd-data-label` (“AI interpretation”)  
- States: loading, empty (`no_data`), failed, limit reached (cached report)  
- Does not present AI text as verified fact

---

## 10. Account

`AccountDashboardPanel` — email, plan label, trial, usage, upgrade/portal when billing available. No invented billing controls. External portal messaging preserved.

---

## 11. Settings

Learning profile, focus areas, export/import (same JSON as extension). Copy notes web/extension sync via account. Does not imply instant extension policy changes beyond existing sync architecture.

---

## 12. Support

Authenticated ticket workspace at `/dashboard/support`. Separated from Feedback (`/feedback`). Uses existing `SupportTicketsPanel` and backend ticket API.

---

## 13. History decision

**Extension-only.** Overview shows honest message: detailed field activity is in the Chrome extension dashboard History. No web History UI fabricated.

---

## 14. Connection state

`ConnectionStatus` via `probeExtensionBridge()`:

- checking  
- connected  
- disconnected / not installed  

No WebSocket or fake real-time presence.

---

## 15. Responsive / accessibility

- Desktop: sidebar + content (`wd-shell`)  
- Tablet/mobile: horizontal scroll nav (`wd-nav-mobile`), compressed topbar  
- WCAG: semantic landmarks (`aside`, `main`), `aria-current` on nav, `role="status"` / `role="alert"` for loading/errors, focus-visible on nav controls, reduced-motion respected in CSS  
- Charts: existing progress panel textual summaries retained

---

## 16. Light / dark / system theme

All surfaces use semantic `--fl-*` tokens via existing `ThemeToggle`. No page-specific theme logic. PE2 dashboard CSS added to `dashboard.css`.

---

## 17. RTL behavior

Arabic dashboard catalog updated (`ar.ts`) with full shape parity to English. Sidebar/nav use logical properties where applicable. Keyboard shortcut labels remain LTR per Phase 2 rules.

---

## 18. Product-truth corrections

Removed/overwritten vs prior dashboard copy:

- “Your Flowlary workspace” marketing framing → “Overview”  
- Support card on overview → dedicated `/dashboard/support`  
- `/#writing-lab` links → `/lab` with Live badge  
- History implied on web → extension-only note  
- AI coach/report output labeled as interpretation  

Grep audit on `website/src/dashboard/` found no: works everywhere, offline AI, ONNX, personality adaptation, formal/casual classifier claims.

---

## 19. Tests

```
npm run test:web — 170 passed (24 files)
npm run build:web — success, 20 prerender routes
```

Updated: `DashboardApp.test.tsx`, `routes.test.tsx`, `seo.test.tsx`, `safeNext.test.ts`, `Account.test.tsx` (unchanged behavior for signed-out auth).

---

## 20. Browser QA

SSR/render QA via Vitest covers signed-out redirects, overview copy, dashboard section rendering, nav labels, fidelity badges, and theme toggle presence on public shell.

**Manual browser QA recommended before release:** signed-in flows on `/dashboard` and `/dashboard/support` with real API; mobile nav scroll; dark mode spot-check; Arabic locale on Overview and Report.

---

## 21. Known deviations

- `AccountDashboardRedirect` component exists but redirect is handled in `AccountPage` directly (hash preserved).  
- Dashboard routes are auth-gated and excluded from prerender (noindex).  
- Post-auth default destination is `/dashboard` (was `/account`).

---

## 22. Backend / extension blockers (none introduced)

Phase 4 required no backend, extension, or API contract changes. All features map to existing endpoints and clients.

---

## 23. Remaining Phase 5 work

- Extension dashboard visual alignment (optional shared components)  
- Playwright E2E for authenticated dashboard flows  
- Manual signed-in browser QA checklist  
- Marketing home “Learn” surface link still points to `/account` in one PE2 card — could update to `/dashboard` when signed in (enhancement)  
- CWS publish → `InstallFlowlaryButton` store URL swap (Phase 3 carryover)

---

## Final gate checklist

- [x] Phase 0–2 documents unchanged  
- [x] Phase 3 website preserved  
- [x] No backend / DB / extension logic changes  
- [x] Dashboard IA matches Phase 1 (Write / Learn / Account)  
- [x] Terminology and design system aligned  
- [x] Real data only; honest empty/locked/error states  
- [x] Support tickets under `/dashboard/support`  
- [x] History not fabricated on web  
- [x] Try (`/try`) vs Lab (`/lab`) distinction intact  
- [x] Product-truth audit passes  
- [x] Tests and build pass  

**Phase 4 Dashboard implementation complete. Phase 5 NOT started.**
