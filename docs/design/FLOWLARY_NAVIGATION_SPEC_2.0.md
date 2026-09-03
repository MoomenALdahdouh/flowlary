# Flowlary Navigation Specification 2.0

**Phase:** 1  
**Date:** 2026-09-03  
**Status:** Structural specification only. No UI implementation.

---

## Purpose

Defines **where navigation lives**, **what each item means**, and **what it must not do** — for public site, authenticated workspace, extension, and cross-surface links.

Companion: `FLOWLARY_IA_2.0.md` (sitemap), `FLOWLARY_TERMINOLOGY_2.0.md` (labels).

---

## Part 4 — Navigation Specification

### A. Public primary navigation

Visible on marketing pages at desktop; mobile drawer equivalent.

| Label (EN) | Destination | User intent | Why here | Must NOT link to |
|------------|-------------|-------------|----------|------------------|
| **Features** | `/features` | "What can it do?" | Capability discovery post-hero | Full install guide, dashboard |
| **Pricing** | `/pricing` | "What does it cost?" | Commercial evaluation | Feature deep-dives |
| **Try** | `/try` | "Can I experience it?" | Pre-install evaluation | Writing Lab (use secondary in Try section) |
| **Product** | `/product` | "How does this product work as a system?" | Surfaces map — unique to Flowlary | Repeat home narrative |

**Removed from primary nav (vs today):**

| Old label | Old target | Reason |
|-----------|------------|--------|
| Product → `/#write` | Home section | Ambiguous — sounded like app, jumped past hero |
| How it works → `/#how` | Home section | Becomes part of Home + Guide; not primary nav |
| Students → `/pricing#students` | Pricing anchor | Move to Pricing page prominence; optional footer |

**Header utilities (always visible):**

| Label | Destination | Intent |
|-------|-------------|--------|
| Theme toggle | — | Preference |
| Language | Locale switcher | i18n |
| Account / Dashboard | `/account` or `/dashboard` | Auth or workspace |
| **Get Flowlary** | Guide install (until CWS) or CWS URL | Primary conversion |

### B. Public secondary / utility navigation

Not in primary bar; header dropdown or secondary row optional in Phase 3.

| Label | Destination | Intent |
|-------|-------------|--------|
| About | `/about` | Trust, story, team |
| Writing Lab | `/lab` | Live try (shows "Sign in" when logged out) |

**Not secondary nav:** Guide, Support, Contact, Feedback — footer/help only.

### C. Public footer

| Column | Items | Intent |
|--------|-------|--------|
| **Product** | Features, Pricing, Try, Product | Discovery + try |
| **Account** | Account (signed out) or Dashboard (signed in) | Workspace entry |
| **Help** | Guide, Support, Contact, Feedback | Escalation paths |
| **Legal** | Privacy, Terms, Cookies | Compliance |

Footer tagline: use Phase 0 supporting line — "Keyboard, language, English — handled in your field." (not generic AI companion).

### D. Authenticated dashboard navigation

**Shell:** `/dashboard` (future; today `/account` when signed in)

**Sidebar / mobile strip** — groups:

| Group | Item | Hash | Intent |
|-------|------|------|--------|
| **Write** | Overview | `#overview` | Workspace home, Lab CTA, coach |
| **Learn** | Practice | `#practice` | Focused sessions |
| **Learn** | Progress | `#progress` | Charts, recurring errors |
| **Learn** | Report | `#report` | AI narrative (Pro) |
| **Account** | Settings | `#settings` | Profile, export/import |
| **Account** | Account | `#account` | Email, plan, billing, usage |
| **Account** | Support | `/dashboard/support` | Tickets (not in sidebar group label — under Account menu or sub-item) |

**Dashboard header utilities:**

| Item | Action |
|------|--------|
| Writing Lab | → `/lab` |
| Extension status | Indicator + "Continue in Chrome" if disconnected |
| Sign out | Account panel action |

**Must NOT appear in dashboard nav:** Marketing pages, feature marketing, pricing FAQ (link only from Account).

### E. Account navigation (auth shell)

When signed out at `/account`:

| Element | Purpose |
|---------|---------|
| Sign in form | Return users |
| Register form | New users |
| Forgot password | → `/account/forgot-password` |
| Student intent | Checkbox/flow to verification |
| Link to Pricing | Plan context |

No dashboard sidebar visible until authenticated.

**Utility routes (no nav chrome):**

- `/account/verify-email`
- `/account/forgot-password`
- `/account/reset-password`

### F. Help navigation

Directional — not a parallel site tree.

```
NEW?     → /guide
QUESTION → /support
BROKEN?  → /contact
IDEA?    → /feedback
```

**Cross-links from Support:** "New to Flowlary? Start with the Guide" (top banner).  
**Cross-links from Guide:** "Questions? Search Support" (end).  
**No circular loops:** Guide does not contain full KB; Support does not contain install steps.

### G. Extension popup navigation

**Not route-based.** Single-view stack:

| State | View | Exit |
|-------|------|------|
| First visit | First Win | Save → Home |
| Default | Home | Close popup |
| Any | Open Dashboard | Extension dashboard tab |

**Popup links out:**

| Link | Target |
|------|--------|
| Open Dashboard | Extension dashboard `#overview` |
| Sign in | Web `/account` |
| Help / Feedback | Web `/feedback` or contextual prompt |
| Manage billing | Web `/dashboard#account` |

**Must NOT link from popup:** Features marketing, Playground, full Support KB.

### H. Extension dashboard navigation

Align labels with web dashboard (Phase 5 implementation).

| Group | Items | Extension-only |
|-------|-------|----------------|
| **Write** | Overview, **History** | History |
| **Learn** | Practice, Progress, Report | — |
| **Account** | Settings, Account | Deep writing policy in Settings |

**Settings sub-areas (in-page, not top nav):** Writing, Languages, Privacy, Data, Shortcuts (link to web `/product#actions`).

### I. Cross-surface links

| From | To | Label pattern |
|------|-----|---------------|
| Web marketing | `/try`, `/lab`, `/guide` | Try Flowlary / Writing Lab / Install guide |
| Web dashboard | Extension dashboard | Continue in Chrome / View history in Chrome |
| Web dashboard | `/lab` | Start writing |
| Extension popup | Web account | Sign in on flowlary.com |
| Extension dashboard | Web billing | Manage subscription on web |
| Extension settings | `/product#actions` | Keyboard shortcuts |
| Writing Lab | `/dashboard#practice` | Practice this |
| Guide | Popup | Open Flowlary in Chrome |
| Support | `/guide#get-flowlary` | Install instructions (link, not duplicate) |
| Feedback | `/dashboard/support` | My support tickets (signed in) |

**Bridge messages (once per session, not every page):**

- After web sign-in with extension detected: "Signed in — extension connected."
- After web sign-in without extension: "Signed in — install the extension to write everywhere."

---

## Part 5 — Navigation Label Test

For each label: *What does a first-time user think this means?*

| Label | User assumption | Actual intent | Verdict | Alternative if ambiguous |
|-------|-----------------|---------------|---------|--------------------------|
| **Product** | "The product page" or "the app" | Surfaces map — how Flowlary splits by job | **Keep with new `/product` page** | "How it works" rejected — too vague |
| **Features** | "List of things it does" | Capability index | **Keep** | — |
| **Try** | "I can test it" | Simulated playground at `/try` | **Keep** | Avoid "Demo" (sounds fake) |
| **Writing Lab** | "A lab to write in" | Live web correction (auth) | **Keep** — add "Live" hint in nav subtitle optional | — |
| **Playground** | "Kids / not serious" | Simulated try | **Avoid in nav** — use "Try" externally | Internal component name OK |
| **Dashboard** | "My stats and settings" | Learning workspace | **Keep** | Not "Account" (billing confusion) |
| **Learn** | "Courses" | Practice/Progress/Report | **Nav group only** — not top-level nav | Group label OK in dashboard |
| **Write** | "Start writing" | Overview + Lab entry | **Nav group only** | — |
| **Account** | "Login / billing" | Auth shell or account panel | **Keep** — context disambiguates URL | Signed-in header → "Dashboard" |
| **Guide** | "Tutorial" | Onboarding install path | **Keep** | "Tutorial" in footer OK (current i18n) |
| **Support** | "Help center" | Searchable KB | **Keep** | Not "Help" alone (too generic) |
| **Feedback** | "Something broke" | Product ideas | **Risk: confusion with support** | Subtitle: "Share an idea" on page |
| **Contact** | "Talk to a person" | Human escalation | **Keep** | — |
| **Speed Box** | "???" | Manual layout repair | **Never top nav** | Feature page + `/product#actions` |
| **Shortcuts** | "Keyboard shortcuts" | Action layer | **Never top nav** | `/product#actions` |
| **How it works** | "Explanation" | Split: Home summary + Guide + Product | **Remove from primary nav** | — |
| **Students** | "Student pricing" | Pricing section | **Remove from primary nav** | Footer + Pricing banner |
| **Get Flowlary** | "Install" | Install/CWS | **Keep until CWS** then still valid | If no CWS: consider "Install Flowlary" |

### Label decisions locked for Phase 2–3

| Context | Use | Avoid |
|---------|-----|-------|
| Top nav try | **Try** | Playground, Demo |
| Live web try | **Writing Lab** | Lab alone |
| Workspace | **Dashboard** | Workspace, Portal |
| Auth page | **Account** | Login |
| Surfaces explainer | **Product** | Platform, Ecosystem |
| Popup | **Flowlary** (brand) | Extension settings |

---

## CTA placement in navigation

| Location | Allowed CTAs |
|----------|--------------|
| Header | Get Flowlary (primary) |
| Header signed-in | Dashboard link; optional Continue in Chrome |
| Dashboard | Start writing (→ Lab); Upgrade (Account, usage states) |
| Popup | Open Dashboard; Sign in |
| Footer | None primary — text links only |

Full CTA semantics: `FLOWLARY_CONTENT_ARCHITECTURE_2.0.md` §17.

---

## Signed-in navigation state machine

```
Visitor
  header: Features | Pricing | Try | Product | Account | Get Flowlary

Signed in (no extension)
  header: Features | Pricing | Try | Product | Dashboard | [Lab]
  footer Account: Dashboard

Signed in (extension connected)
  header: ... | Dashboard | Continue in Chrome (optional tertiary)
```

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 1 navigation spec |
