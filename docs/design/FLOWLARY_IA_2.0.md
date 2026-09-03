# Flowlary Information Architecture 2.0

**Phase:** 1 — Information Architecture + Content Architecture  
**Date:** 2026-09-03  
**Status:** Specification only. No implementation.  
**Inputs:** Phase 0 (`FLOWLARY_PRODUCT_EXPERIENCE_2.0.md`), current codebase, product/freeze docs  
**Outputs for:** Phase 2 (Design System), Phase 3 (Website UX/UI)

---

## Document role

This file defines **how Flowlary is organized**: current inventory, IA principles, future sitemaps, feature taxonomy, try/dashboard/extension IA, duplication audit, route migration, open decisions, and anti-patchwork validation.

Companion documents:

| File | Scope |
|------|-------|
| `FLOWLARY_CONTENT_ARCHITECTURE_2.0.md` | Content layers, homepage, product page, support, messaging, CTAs, migration, copy deck |
| `FLOWLARY_NAVIGATION_SPEC_2.0.md` | Navigation structure and label tests |
| `FLOWLARY_PAGE_BRIEFS_2.0.md` | Page contracts |
| `FLOWLARY_TERMINOLOGY_2.0.md` | Canonical EN glossary |

---

## Part 1 — Current IA Inventory

### 1.1 Route inventory (actual code)

**Source:** `website/src/App.tsx`, `website/src/routes.ts`, `website/scripts/prerender.mjs`, `website/src/pages/Home.tsx`

| Route | Auth | Surface layer | Current purpose | Primary CTA | Secondary CTA | Linked surfaces | Overlap / problems | Future status |
|-------|:----:|---------------|-----------------|-------------|---------------|-----------------|-------------------|---------------|
| `/` | Public | DISCOVER | Acquisition; Write/Communicate/Learn narrative | Get Flowlary → `/support#get-flowlary`* | See how it works → `/#how` | Features, Support install | Full product story; 9 sections | **REWORK** |
| `/#write` etc. | Public | DISCOVER | Home anchors | — | — | Same as `/` | Product nav skips hero | **MERGE** into `/` sections |
| `/#writing-lab` | Auth for AI | TRY | Live correction + learning ingest | Analyze / Sign in | Dashboard | Extension bridge | Hidden hash; replaces entire home | **MOVE** → `/lab` |
| `/#try-flowlary` | Public | TRY | Simulated playground | Mode tabs | Get Flowlary | Features demos | Hidden hash; Speed Box unwired | **MOVE** → `/try` |
| `/features` | Public | DISCOVER | Feature journey (Write/Communicate/Learn) | Get Flowlary | Try playground | Feature pages, home | Duplicates home narrative | **REWORK** → index only |
| `/features/writing-correction` | Public | DISCOVER | English correction deep-dive | Get Flowlary | `/#how` | Support topic | Uses stale `home.final*` CTA keys | **KEEP** |
| `/features/translation` | Public | DISCOVER | Manual translation | Get Flowlary | Live translation page | Support | — | **KEEP** |
| `/features/live-translation` | Public | DISCOVER | Live translation | Get Flowlary | Translation page | Support | — | **KEEP** |
| `/features/keyboard-layout` | Public | DISCOVER | Layout repair | Get Flowlary | Speed Box page | Support, Guide | — | **KEEP** |
| `/features/speed-box` | Public | DISCOVER | Speed Box overlay | Get Flowlary | Layout page | Support | — | **KEEP** |
| `/pricing` | Public | DISCOVER | Plans, student, FAQ | Get Pro / checkout | Free tier info | Account | Canonical commercial truth | **KEEP** |
| `/about` | Public | DISCOVER | Brand story, capabilities | Get Flowlary | Features | Home proof sections | Not in header; repeats proof | **KEEP + REWORK** |
| `/guide` | Public | GET HELP | Install + shortcuts + dashboard cards | Get Flowlary | Support | Support install dup | Footer only | **REWORK** → onboarding only |
| `/support` | Public | GET HELP | KB + install + shortcuts + hub links | Get Flowlary | Guide, Feedback, Contact | All help surfaces | Triplicates Guide; hosts install | **REWORK** → KB only |
| `/feedback` | Auth† | GET HELP | Feedback + features + **tickets** | Submit | Sign in | Account support | Ticket tab duplicates support | **REWORK** → ideas only |
| `/contact` | Public | GET HELP | Human channels | Email links | Support | — | OK | **KEEP** |
| `/blog` | Public | DISCOVER | Empty placeholder | — | — | — | Damages trust | **REMOVE** until strategy |
| `/account` | Mixed | MANAGE | Auth **or** full dashboard | Sign in / Register | Forgot password | Dashboard, Lab, extension | URL collision auth↔workspace | **SPLIT** |
| `/account/support` | Auth | GET HELP | Ticket inbox | New ticket | — | Feedback support tab | Third ticket entry | **MERGE** → `/dashboard/support` |
| `/account/verify-email` | Auth | Utility | Email verification | — | — | Account | Missing from routes.ts/seo | **KEEP** utility |
| `/account/forgot-password` | Public | Utility | Reset request | — | — | Account | — | **KEEP** |
| `/account/reset-password` | Public | Utility | Reset form | — | — | Account | — | **KEEP** |
| `/privacy`, `/terms`, `/cookies` | Public | Legal | Legal docs | — | — | — | — | **KEEP** |
| `/admin/*` | Auth (internal) | System | Admin tools | — | — | — | Out of PE 2.0 scope | **KEEP** internal |
| `*` | Public | System | 404 | Home | — | — | — | **KEEP** |

\* `CHROME_WEB_STORE_URL` is `null` in `website/src/config.ts` — primary CTA is honest redirect to install docs, not store.  
† Feedback UI renders for all but ticket/feature actions require sign-in.

**Prerender gap:** `/about`, `/feedback`, `/account/verify-email`, `/account/support`, admin routes not in prerender list.

### 1.2 Hash-only destinations (not React Router paths)

| Hash | Host | Behavior |
|------|------|----------|
| `#writing-lab` | `/` | Replaces entire HomePage with WritingLab |
| `#try-flowlary` | `/` | Replaces entire HomePage with PlaygroundSection |
| `#write`, `#communicate`, `#learn`, `#how` | `/` | Scroll anchors on marketing home |
| `#students`, `#pr-compare` | `/pricing` | Section anchors |
| `#overview`, `#practice`, etc. | `/account` | Dashboard section routing |
| `#get-flowlary` | `/support` | Install section anchor (primary CTA target) |

### 1.3 Current website navigation

**Header primary** (`Layout.tsx` NAV): Product → `/#write`, How it works → `/#how`, Features, Students → `/pricing#students`, Pricing, Account, Get Flowlary.

**Footer:** Product (Features, How it works, Students, Pricing), Account, Legal, Support column (Guide, Support, Contact). No Feedback, About, Blog, Try, Lab.

**Dashboard nav** (`website/src/dashboard/types.ts`): Write (Overview) · Learn (Practice, Progress, Report) · Account (Settings, Account). Hash-based on `/account`.

### 1.4 Extension IA (actual)

**Popup** (`extension/src/popup/App.tsx`): FirstWin (if incomplete) → HomeView (control, quick actions, toggles, usage, dashboard link).

**Extension dashboard** (`extension/src/dashboard/App.tsx`): Groups `navHome` (Overview, Practice, Progress, Report) + `navManage` (Settings, Account). Sections include `activity` (History) — **web dashboard lacks this**.

**Shortcuts** (`website/src/config.ts`, extension settings): ⌘⇧E fix writing, ⌘⇧, translate, ⌘⇧P fix layout, ⌘⇧L Speed Box.

**Speed Box** (`extension/src/features/layout/speedBox.ts`): Manual overlay, `manual_box` trigger, local/unlimited.

### 1.5 Phase 0 conflicts with actual behavior (flagged, not silently fixed)

| Phase 0 claim | Actual behavior | Resolution |
|---------------|-----------------|------------|
| Feedback = ideas only | `FeedbackHub` has support tab creating tickets | Phase 1: merge tickets to dashboard; Feedback rework |
| Dashboard nav identical web/extension | Extension: navHome/navManage; Web: Write/Learn/Account; Extension has Activity | Phase 1: unified group labels; Activity extension-only |
| Writing Lab not in nav | Correct — hash-only | Phase 1: `/lab` in Try nav when signed in |
| Get Flowlary = install | Falls back to Support install section | Phase 1: honest CTA label until CWS live |
| One dashboard route split | Today `/account` only | Phase 1: specify `/dashboard` future split |

---

## Part 2 — IA Principles

Derived from Phase 0 UX Constitution and product evidence.

1. **One surface, one primary job** — Each route/surface owns one job (see page briefs).
2. **One idea, one canonical home** — No two pages tell the full product story.
3. **One product, many places** — `/product` explains surfaces; other pages link, not re-explain.
4. **No duplicate product story** — Home owns acquisition narrative once; Features index catalogs capabilities.
5. **Marketing explains value** — Outcomes and fit; not Write Gate or decideWriting.
6. **Product UI explains control** — Popup/settings use product language only.
7. **Guide teaches onboarding** — Linear install → first action → shortcuts reference link.
8. **Support answers questions** — Searchable KB; no install duplication.
9. **Dashboard owns learning/progress** — Learning depth not on Home or Features index.
10. **Pricing owns commercial truth** — Plans, checks, student program, FAQ billing.
11. **Shortcuts have one canonical reference** — `/product#actions` + Guide step link; Support links only.
12. **Every CTA has predictable meaning** — See `FLOWLARY_CONTENT_ARCHITECTURE_2.0.md` CTA system.
13. **Try fidelity ladder is explicit** — Playground (sim) → Lab (live web) → Extension (full).
14. **Auth and workspace URLs separate** — `/account` ≠ `/dashboard` in future IA.
15. **Hash routes are not primary IA** — Deep links redirect to real paths in Phase 3.
16. **Extension-only capabilities link out** — Web dashboard links to extension for History, not duplicate.
17. **Honest capability claims** — Every feature page links to `KNOWN_LIMITATIONS` boundaries where relevant.
18. **Help escalation is directional** — Guide → Support → Contact; never circular.

---

## Part 3 — Future Site Map

### 3.1 Public sitemap

```
/                          Home — acquisition (one narrative)
/product                   Surfaces map — how one product splits by job
/features                  Capability index (problem-outcome cards)
/features/writing-correction
/features/translation
/features/live-translation
/features/keyboard-layout
/features/speed-box
/pricing                   Commercial truth (+ #students anchor)
/try                       Playground — simulated try (direct, not hub)
/lab                       Writing Lab — live web try (auth gate for AI)
/about                     Brand story + trust
/guide                     Onboarding path (install → first win)
/support                   Knowledge base (searchable)
/contact                   Human escalation
/feedback                  Product ideas + general feedback (signed in)
/privacy | /terms | /cookies
```

**Removed from public IA (until strategy):** `/blog`

**Not in primary nav but valid:** `/about`, `/guide`, `/support`, `/contact`, `/feedback`

### 3.2 Authenticated sitemap

```
/account                   Sign in, register, verify, password reset (signed-out shell)
/dashboard                 Workspace shell (signed-in redirect from /account)
/dashboard#overview
/dashboard#practice
/dashboard#progress
/dashboard#report
/dashboard#settings
/dashboard#account
/dashboard/support         Ticket inbox (merged from /account/support, Feedback support tab)
/lab                       Writing Lab (signed-in AI)
```

**Billing:** Lives in `/dashboard#account` (Paddle checkout/portal) — no separate `/billing` route needed.

### 3.3 Utility / system sitemap

```
/account/verify-email
/account/forgot-password
/account/reset-password
/admin/feedback | /admin/growth | /admin/support
/404
```

### 3.4 Extension information architecture

```
EXTENSION (installed)
├── USE          Content script (invisible engine)
├── CONTROL      Popup (toolbar)
│   ├── First Win (first open only)
│   └── Home (policy, status, quick actions, open dashboard)
├── ACT          Shortcuts (in-field)
│   ├── Fix writing (⌘⇧E)
│   ├── Translate (⌘⇧,)
│   └── Fix layout (⌘⇧P)
├── MANUAL REPAIR Speed Box (⌘⇧L overlay)
└── LEARN/MANAGE Extension dashboard (options tab)
    ├── Write: Overview
    ├── Learn: Practice, Progress, Report
    ├── Write‡: Activity (History) — extension-only
    └── Account: Settings, Account

‡ Activity grouped under Write in extension; web links here instead of duplicating.
```

### 3.5 Route evaluation decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| `/product` exists? | **Yes** | Canonical surfaces explainer; Home links, does not duplicate |
| `/try` hub vs direct playground? | **Direct playground at `/try`** | One less click; Lab is separate fidelity step |
| `/lab` public shell? | **Public shell + auth gate for AI** | SEO/try discovery; analyze requires sign-in (actual behavior) |
| Guide in primary nav? | **No — footer + post-install** | Onboarding, not discovery |
| Support in primary nav? | **No — footer + errors** | KB, not acquisition |
| About in primary nav? | **Secondary nav only** | Trust, not conversion |
| Feedback public? | **Public page, signed-in submit** | Matches today; remove ticket creation |
| Billing routes? | **Dashboard Account panel** | Paddle already website-primary |

### 3.6 Signed-in vs signed-out navigation delta

| Element | Signed out | Signed in |
|---------|------------|-----------|
| Header CTA | Get Flowlary | — (or Continue in Chrome if extension detected) |
| Header utility | Account → `/account` | Dashboard → `/dashboard` |
| Try nav | Try → `/try` | Try → `/try` + Writing Lab → `/lab` |
| Footer Account | Sign in | Dashboard |

---

## Part 9 — Features Information Architecture

### 9.1 Taxonomy (user problem → outcome)

Organized by **user problems**, not component names.

| Category | User problem | Outcome | Canonical page | Mechanism depth |
|----------|--------------|---------|----------------|-----------------|
| **Keyboard & layout** | Typed on wrong keyboard | Readable text in intended script | `/features/keyboard-layout` | Medium — local remap, auto/suggest |
| **Keyboard & layout** | Want to see options before applying | Chosen conversion | `/features/speed-box` | Medium — manual overlay |
| **English writing** | Spelling/grammar in daily English | Corrected island, optional explanation | `/features/writing-correction` | Medium — island-based, not rewrite |
| **Translation** | Need Arabic→English (or pair) in field | Translated text in place | `/features/translation` | Medium — shortcut, user-initiated |
| **Translation** | Stream Arabic segments while typing | Live translated segments (session) | `/features/live-translation` | High — session, default-off |
| **Learning** | Same mistakes repeat | Practice, progress, reports | `/features` index card → `/dashboard` | Low on feature pages — dashboard owns depth |
| **Control & trust** | Fear of surprise AI | Pause, exceptions, modes | `/product#control` | Medium — policy, not legal |
| **Privacy & trust** | Sensitive fields | Skipped fields, no hidden chains | `/privacy` + `/product#control` | Legal on privacy page |

**Features index (`/features`)** shows problem-outcome cards linking to detail pages + learning card linking to dashboard. **No Write/Communicate/Learn journey sections.**

### 9.2 Feature detail page rules

- One capability per page
- Fact grid: what / why / when / limits (not mini-homepage)
- Demo or browser-stage mock (labeled)
- CTA: Get Flowlary or Try (contextual)
- Link to `/product#actions` for shortcut context — not full shortcut docs
- State limitations (CE fields, etc.) where relevant

---

## Part 10 — Try Architecture

### 10.1 Fidelity ladder

```
PLAYGROUND (/try)          WRITING LAB (/lab)           EXTENSION
Simulated demos            Real gateway correction      Real in-field engine
No account                 Sign-in for AI               Install required
No learning sync           Learning events ingest       Full writing + learning
4 modes (Speed Box         Textarea only                All sites + fields
 unwired today)
```

### 10.2 When to show each

| Context | Surface | Auth |
|---------|---------|:----:|
| Visitor exploring | Playground | No |
| Visitor wants real AI | Writing Lab | Yes |
| User writing daily | Extension | Install + optional account |
| Signed-in web user | Lab + Dashboard | Yes |

### 10.3 Transitions

| From | To | User action | Carries forward | Do NOT repeat |
|------|-----|-------------|-----------------|---------------|
| Home Try section | `/try` | Click Try | Interest in correction | Full product story |
| `/try` | `/lab` | "Try with your text" | Feature interest | Playground disclaimer |
| `/try` | Install | Get Flowlary | — | Feature explanations |
| `/lab` | `/dashboard` | View progress | Learning events | Correction mechanics |
| `/lab` | Install | Extension CTA | Account session | Lab disclaimer |
| Install | Guide | Auto or link | — | Marketing narrative |
| Guide | Popup First Win | Open extension | — | Install steps |

### 10.4 `/try` structure (direct playground, not hub)

Single page: labeled SIMULATED badge, mode tabs, honest disclaimer, CTAs to Lab (sign in) and Install. Optional intro strip (2 sentences) — not a separate hub page.

---

## Part 11 — Dashboard Information Architecture

### 11.1 Shared navigation (one product, two contexts)

| Group | Items | Shared label keys |
|-------|-------|-------------------|
| **Write** | Overview | `nav.overview` |
| **Learn** | Practice, Progress, Report | `nav.practice`, etc. |
| **Account** | Settings, Account | `nav.settings`, `nav.account` |

**Phase 0 alignment:** Web uses Write/Learn/Account — **keep**. Extension `navHome`/`navManage` → **rename to match** in Phase 5.

### 11.2 Activity / History placement

**Decision (Phase 1 recommendation):** Activity stays **extension-only** under Write group as **History**.

| Context | Activity/History |
|---------|------------------|
| Extension dashboard | Full History panel (`activity` section) |
| Web dashboard | Link card: "View writing history in Chrome" → extension dashboard `#activity` |

**Rationale:** History is tied to extension field events; web Writing Lab events appear in Progress but not full activity log. Building web History duplicates extension without full data parity.

**Confidence:** Medium — revisit if web field writing expands.

### 11.3 Web dashboard IA

```
/dashboard
├── Write
│   └── Overview (+ Writing Lab CTA, extension status, daily brief, coach)
├── Learn
│   ├── Practice
│   ├── Progress
│   └── Report
├── Account
│   ├── Settings
│   └── Account (+ billing, usage, support tickets link)
└── /dashboard/support (tickets)
```

**Web-only:** Writing Lab entry, billing/Paddle, extension bridge status, ticket inbox.

### 11.4 Extension dashboard IA

```
Extension options tab
├── Write
│   ├── Overview
│   └── History (activity) ← extension-only
├── Learn
│   ├── Practice
│   ├── Progress
│   └── Report
└── Account
    ├── Settings (writing policy, languages, privacy, data, shortcuts ref link)
    └── Account (sign-in state, link to web billing)
```

**Extension-only:** History, deep writing policy, language pair, site exceptions list.

### 11.5 Cross-links

| From | To | Message |
|------|-----|---------|
| Web Overview | Extension `#activity` | View history in Chrome |
| Web Overview | `/lab` | Start writing |
| Web Account | Paddle portal | Manage subscription |
| Extension Account | Web `/dashboard#account` | Manage billing on web |
| Extension Settings | `/product#actions` or Guide | Keyboard shortcuts |
| Practice (either) | Other context same `#practice?target=` | Bridge deep link |

---

## Part 12 — Extension Information Architecture

### 12.1 Mental model (validated against code)

| Surface | User mental model | Implementation | Must never become |
|---------|-------------------|----------------|-------------------|
| **Popup** | "Is Flowlary on? What's allowed here?" | Global toggle, feature toggles, site exception, usage, quick actions | Feature catalog, learning dashboard |
| **Shortcuts** | "Fix this in my field now" | dispatchCommand CORRECT/TRANSLATE/FIX_LAYOUT | Settings shortcut |
| **Speed Box** | "Show me layout options" | Manual overlay, pick, close | Auto layout mode |
| **Dashboard** | "My progress and settings" | Full tab app | Popup replacement |
| **In-field** | "Something changed in my text" | Content script + Write Gate | Visible app chrome |

### 12.2 Hierarchy

```
CONTROL (popup) ──sets policy──► USE (content script)
ACT (shortcuts) ──triggers──────► USE
MANUAL REPAIR (Speed Box) ───────► USE (isolated manual_box path)
LEARN/MANAGE (dashboard) ◄──sync──► Web dashboard
```

### 12.3 Popup information priority (future content order)

1. Status (on/off, this site)
2. Usage (if not healthy)
3. Primary control (global toggle)
4. Quick actions (with shortcut hints)
5. Feature toggles (collapsed or secondary)
6. Open dashboard link

**Not in popup:** Full learning explanation, pricing, install instructions.

---

## Part 19 — Content Duplication Audit

| Idea | Current locations | Canonical location | Secondary refs allowed? | Action |
|------|-------------------|--------------------|-------------------------|--------|
| What is Flowlary? | Home, About, Features, SEO title | **Home** (+ `/product` for surfaces) | About: story angle only | REWRITE Home; slim Features |
| Full product story (W/C/L) | Home, Features, About, Support | **Home once** | None full | MERGE out of Features/About |
| How surfaces connect | Nowhere clear | **`/product`** | Home: summary + link | CREATE |
| Keyboard layout | Home Communicate, Features, Support, Guide, feature page | **`/features/keyboard-layout`** | Support: troubleshooting only | MOVE |
| English correction | Home Write, Features, Support, Lab, feature page | **`/features/writing-correction`** | Support: troubleshooting | MOVE |
| Translation | Home, Features, Support, feature pages | **Respective feature pages** | Support: limits | MOVE |
| Learning loop | Home Learn, Features, About, Support, Dashboard | **`/dashboard`** (+ Features index card) | Home: one sentence + link | MOVE |
| Shortcuts | Guide, Support, popup, settings | **`/product#actions`** | Guide: link; Support: link | CREATE canonical |
| Install | Support `#get-flowlary`, Guide | **`/guide`** | Support: link only | MOVE |
| Popup explained | Home hero mock, About, Features | **`/product#control`** | Home: mock + link | MOVE |
| Dashboard web vs ext | Support, Guide cards | **`/product#learn`** | Dashboard: one-line indicator | CREATE |
| Privacy/control | Home Why, Support, Privacy | **`/privacy`** + `/product#control` | Feature pages: one line | MOVE |
| Pricing | Pricing, popup usage, account | **`/pricing`** | Account: summary + link | KEEP |
| Try/playground | `/#try-flowlary`, Features CTA | **`/try`** | Home Try section | MOVE |
| Writing Lab | `/#writing-lab`, Dashboard | **`/lab`** | Overview CTA | MOVE |
| Student program | Nav, Pricing `#students` | **`/pricing#students`** | None duplicate | KEEP |
| Control philosophy | Orphan components, Home Why | **`/product#control`** | — | MERGE |
| Safety boundaries | Orphan SafetySection, Home Why | **`/product#control`** + Privacy | — | MERGE |

---

## Part 20 — Route Migration Strategy

**Not implemented in Phase 1.** Conceptual plan for Phase 3.

| Current | Future | Reason | Redirect? | SEO | Auth |
|---------|--------|--------|:---------:|:---:|:----:|
| `/` | `/` | Home rework | — | Update meta | Public |
| `/#writing-lab` | `/lab` | Real route | Yes 301/hash→path | New page meta | Gate AI |
| `/#try-flowlary` | `/try` | Real route | Yes | New page meta | Public |
| `/#write`, `#how` | `/` sections | Keep anchors on Home | Optional | — | Public |
| `/account` (signed in) | `/dashboard` | Split auth/workspace | Yes post-login | noindex dashboard? | Yes |
| `/account` (signed out) | `/account` | Auth only | — | — | Public |
| `/account/support` | `/dashboard/support` | Unified tickets | Yes | — | Yes |
| `/feedback` (support tab) | `/dashboard/support` | No tickets in feedback | — | — | Yes |
| `/blog` | — | Remove placeholder | 404 or redirect `/` | Drop | — |
| `/features` | `/features` | Slim index | — | Update meta | Public |
| — | `/product` | New surfaces page | — | New | Public |

**Hash dashboard on `/account` today:** `/dashboard#overview` replaces `/account#overview` with redirect after login.

---

## Part 24 — Open Decisions

| Decision | Options | Evidence | Recommendation | Confidence | Would change if |
|----------|---------|----------|----------------|:----------:|-----------------|
| MENA-first vs global | A) Lead bilingual B) Lead English learning | Code: ar/en; SEO: English learning | **MENA-first bilingual** | High | User research shows EN-only majority |
| Activity on web | A) Link out B) Build web History | Extension has activity; web lacks data | **Link out** | Medium | Web captures field events |
| `/try` hub | A) Hub page B) Direct playground | Phase 0 Try ladder | **Direct `/try`** | High | Need compare UI before sim |
| CWS CTA | A) Get Flowlary B) Install guide C) Join beta | `CHROME_WEB_STORE_URL: null` | **Install Flowlary** → Guide until live | High | CWS URL published |
| Student landing | A) Pricing section B) `/students` page | Nav links `#students` | **Pricing section only** | Medium | Student marketing campaign |
| Blog | A) Remove B) Launch | Empty placeholder | **Remove from IA** | High | Content calendar approved |
| Lab auth | A) Public shell B) Full gate | Lab gates AI on sign-in today | **Public shell, gated AI** | High | — |
| Feedback public submit | A) Sign-in required B) Anonymous | Today: sign-in for submit | **Sign-in required** | Medium | Abuse concerns ease |
| Dashboard URL | A) `/dashboard` B) Keep `/account` | Account page collision | **`/dashboard` split** | High | — |
| Extension nav group names | A) Write/Learn/Account B) Keep navHome | Web already Write/Learn/Account | **Align extension to web** | High | — |
| `/product` vs Home surfaces | A) Separate page B) Home section only | Home already long | **Separate `/product`** | Medium | Home stays short enough |

---

## Anti-Patchwork Test (18 questions)

| # | Question | Canonical answer |
|---|----------|------------------|
| 1 | Where does a visitor learn what Flowlary is? | **`/` Home hero + problem** |
| 2 | Where do they understand why it's different? | **`/` solution + `/product`** |
| 3 | Where do they try it? | **`/try`** (sim) → **`/lab`** (live) |
| 4 | Where do they experience the real product? | **Extension** (in-field) |
| 5 | Where does Flowlary actually work? | **Extension content script** |
| 6 | Where do they control it? | **Extension popup** |
| 7 | Where do they perform instant action? | **Shortcuts** (documented at **`/product#actions`**) |
| 8 | Where do they manually repair layout? | **Speed Box** (documented at **`/product#actions`** + feature page) |
| 9 | Where do they learn from writing? | **`/dashboard`** Learn group |
| 10 | Where do they manage account? | **`/dashboard#account`** |
| 11 | Where do they get help? | **Guide** (new) → **Support** (question) → **Contact** (broken) |
| 12 | Where do they submit feedback? | **`/feedback`** (ideas only) |
| 13 | ONE shortcut reference? | **`/product#actions`** |
| 14 | ONE pricing explanation? | **`/pricing`** |
| 15 | ONE product explanation (surfaces)? | **`/product`** |
| 16 | ONE install explanation? | **`/guide`** |
| 17 | ONE Popup/Shortcuts/Speed Box explainer? | **`/product`** (control/act/repair sections) |
| 18 | ONE Web vs Extension dashboard explainer? | **`/product#learn`** |

**Result:** Pass — each question has exactly one primary canonical location.

---

## Part 25 — Phase 2 Input Contract

Phase 2 (Design System) receives from Phase 1:

| Input | Source doc | Status |
|-------|------------|--------|
| Locked EN terminology | TERMINOLOGY_2.0 | Locked for EN |
| Navigation structure | NAVIGATION_SPEC_2.0 | Locked |
| Page hierarchy + section order | PAGE_BRIEFS, CONTENT_ARCHITECTURE | Locked |
| CTA semantics | CONTENT_ARCHITECTURE | Locked |
| Content layer definitions | CONTENT_ARCHITECTURE | Locked |
| Surface contracts | PAGE_BRIEFS `/product`, IA extension section | Locked |
| Shared vs context-specific components | IA §11 + Phase 0 design system strategy | Locked |
| RTL / localization rules | CONTENT_ARCHITECTURE §22 | Locked |
| Accessibility: skip link, dialog, reduced motion | Existing code baseline | Carry forward |

**Do NOT decide in Phase 2 (belongs to Phase 3+):**

- Page layout/visual composition
- Marketing photography vs screenshot ratio
- Component pixel specs
- Route implementation / redirects
- i18n string commits
- Extension popup layout redesign
- Dashboard chart visual treatment

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 1 IA complete |
