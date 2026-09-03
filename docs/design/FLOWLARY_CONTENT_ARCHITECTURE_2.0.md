# Flowlary Content Architecture 2.0

**Phase:** 1  
**Date:** 2026-09-03  
**Status:** Content and messaging specification only  
**Companion docs:** IA, Navigation, Page Briefs, Terminology

---

## Part 7 — Homepage Content Architecture

### 7.1 Challenge to Phase 0 structure

Phase 0 proposed: Hero → Problem → Solution → Surfaces → Proof → Try → Final CTA.

**Validated with adjustments:**

| Section | Keep? | Adjustment |
|---------|-------|------------|
| Hero | Yes | Lead with bilingual in-field promise, not W/C/L |
| Problem | Yes | Reduce to 3 problems (layout, language switch, tool fatigue) — drop redundant "grammar" as separate if covered by English help |
| Solution | Yes | **One** browser-stage demo (correction OR layout — pick layout for differentiation) |
| Surfaces | Yes | Summary + link to `/product` — not full eight-layer table on home |
| Proof | Yes | Static fallback always; API-enhanced reviews optional |
| Try | Yes | Two cards: Try (sim) + Writing Lab (live) |
| Final CTA | Yes | Install primary |

**Remove from homepage entirely:** Write / Communicate / Learn as section structure (currently `MarketingHomeSections.tsx`).

### 7.2 Section specifications

#### 1. Hero

| Attribute | Definition |
|-----------|------------|
| User question | What is Flowlary? |
| Purpose | 10-second comprehension |
| Core idea | In-field writing companion for bilingual Chrome users |
| Evidence | Labeled popup mock in browser frame |
| CTA | Install Flowlary (primary); Try (secondary) |
| Destination | `/guide`, `/try` |
| Excluded | Learning pipeline; feature list; shortcut table |

#### 2. Problem

| Attribute | Definition |
|-----------|------------|
| User question | Is this my daily frustration? |
| Purpose | Recognition — Nadia persona |
| Core idea | Small interruptions compound (layout, languages, tool switching) |
| Evidence | 3 problem statements — bilingual examples |
| CTA | None (flows to Solution) |
| Excluded | English learning framing as lead |

#### 3. Solution

| Attribute | Definition |
|-----------|------------|
| User question | How does Flowlary help? |
| Purpose | Differentiation — in-field, one layer |
| Core idea | Layout + English + translation where you type |
| Evidence | Single demo (keyboard layout OR correction — **recommend layout** for rarity) |
| CTA | See how it works → `/product` |
| Excluded | Three separate feature sections |

#### 4. Surfaces

| Attribute | Definition |
|-----------|------------|
| User question | Where does this live? I'm confused by popup/dashboard/website |
| Purpose | Prevent ecosystem fragmentation anxiety |
| Core idea | One product; popup = control, shortcuts = act, dashboard = learn |
| Evidence | 4-icon summary (not 8 layers) |
| CTA | Explore Product → `/product` |
| Excluded | Full shortcut docs; dashboard tour |

#### 5. Proof

| Attribute | Definition |
|-----------|------------|
| User question | Can I trust it? |
| Purpose | Trust before install |
| Core idea | Control, honest Free tier, Chrome |
| Evidence | Stats/reviews (static fallback); platforms strip |
| CTA | View pricing → `/pricing` (tertiary) |
| Excluded | Pro learning depth |

#### 6. Try

| Attribute | Definition |
|-----------|------------|
| User question | Can I try before install? |
| Purpose | Lower commitment evaluation |
| Core idea | Fidelity ladder entry points |
| Evidence | Two cards with SIMULATED vs LIVE labels |
| CTA | Try → `/try`; Writing Lab → `/lab` |
| Excluded | Embedded playground (moved to `/try`) |

#### 7. Final CTA

| Attribute | Definition |
|-----------|------------|
| User question | What do I do now? |
| Purpose | Conversion |
| Core idea | Install in Chrome |
| CTA | Install Flowlary |
| Secondary | Pricing |
| Excluded | Repeated feature bullets |

### 7.3 What must NEVER appear on the homepage

- Full shortcut reference table
- Write / Communicate / Learn journey sections
- Learning coach, practice, progress explanations
- Billing details, plan comparison, AI check math
- Support troubleshooting, install numbered steps
- Implementation jargon (Write Gate, island, content script)
- Duplicated feature page content
- Embedded Writing Lab or full Playground
- "Learn English through your writing" as primary headline
- Unsupported claims (works everywhere, perfect English, style rewrite)
- Student program details (→ Pricing)
- Web vs extension dashboard essay (→ Product)

---

## Part 8 — Product / Surfaces Page Content Architecture

### 8.1 Job (not homepage repeat)

**Primary:** Explain how one Flowlary product becomes different experiences by user intent.  
**Not:** Second homepage, feature catalog, or pricing.

### 8.2 Information sequence

| # | Section | Layer | Core idea |
|---|---------|-------|-----------|
| 1 | Intro | — | One product, many places |
| 2 | Map | — | Visual: web + extension surfaces |
| 3 | Discover | DISCOVER | Website role — understand, not write everywhere |
| 4 | Try | TRY | Playground vs Lab vs Extension fidelity |
| 5 | Write | USE | Extension in-field — where product actually works |
| 6 | Control | CONTROL | Popup — on/off, policy, this site |
| 7 | Act | ACT | Shortcuts — `#actions` **canonical shortcut reference** |
| 8 | Manual repair | ACT | Speed Box — when you want visible options |
| 9 | Learn | LEARN | Dashboard — one concept; web vs Chrome `#learn` |
| 10 | Manage | MANAGE | Account, billing on web |
| 11 | Help | GET HELP | Guide / Support / Contact / Feedback routing |

**Excluded layers from full expansion:** MERGE Discover+Try into shorter blocks; do not teach install (link Guide).

### 8.3 Surface explanations (content bullets)

| Surface | User thinks | One sentence |
|---------|-------------|--------------|
| Website | Marketing site | Understand Flowlary and manage your account |
| Playground (/try) | Safe demo | See simulated behavior — no account needed |
| Writing Lab (/lab) | Real try on web | Analyze real text with Flowlary AI when signed in |
| Extension | The product | Works in fields across Chrome |
| Popup | Remote control | Turn on, set policy, check usage |
| Shortcuts | Fast actions | Fix, translate, repair layout in place |
| Speed Box | Repair panel | Choose a layout conversion manually |
| Dashboard | Progress home | Practice, progress, reports — same account on web or Chrome |

---

## Part 10 — Try Architecture (content layer)

See `FLOWLARY_IA_2.0.md` §10 for structural IA. Content rules:

| Surface | Required label | Required disclaimer |
|---------|------------------|---------------------|
| Playground | Simulated | Representative behavior; not live AI |
| Writing Lab | Live | Text sent to Flowlary AI; not extension engine |
| Extension | Full product | Install required |

**CTA consistency on try surfaces:**

| Page | Primary | Secondary |
|------|---------|-----------|
| `/try` | Install Flowlary | Sign in for live AI → `/lab` |
| `/lab` (out) | Install extension | View progress → dashboard |
| `/lab` (in) | Analyze | Practice this → dashboard |

---

## Part 13 — Support Architecture

### 13.1 Mental model

| Path | Label | Auth | Content type |
|------|-------|:----:|--------------|
| NEW? | Guide | Public | Linear onboarding |
| QUESTION? | Support | Public | Searchable KB |
| BROKEN? | Contact | Public | Human channels |
| IDEA? | Feedback | Submit: auth | Feature requests, ratings |

### 13.2 Ownership

| System | Owns | Does not own |
|--------|------|--------------|
| **Guide** | Install, first popup open, first action intro, link to shortcuts | KB articles, tickets, feature specs |
| **Support** | Troubleshooting, limits, account help, AI checks, privacy how-to | Install steps (link Guide), tickets |
| **Contact** | Email/channels, safety | KB content |
| **Feedback** | Ideas, votes, ratings | Tickets (**remove tab**) |
| **Dashboard/support** | Ticket inbox, create ticket | Feature voting |

### 13.3 Support KB content types

1. Getting started (links to Guide — no duplicate body)
2. Feature troubleshooting (per capability)
3. Account & billing (links Pricing for plan truth)
4. AI writing checks & exhaustion
5. Privacy & data
6. Known limitations (plain language from KNOWN_LIMITATIONS)

### 13.4 Escalation

```
Support search fails → Contact
Account/billing emergency → Dashboard support ticket OR Contact
Product idea → Feedback
Install stuck → Guide → Contact
```

### 13.5 Duplicate-content rules

- Install body: **Guide only** — Support `#get-flowlary` becomes redirect/link to Guide
- Shortcuts table: **Product `#actions` only** — Support/Guide link
- Popup explanation: **Product `#control` only**
- Dashboard web vs ext: **Product `#learn` only**

---

## Part 14 — Content Architecture Layers

| Layer | Audience | Purpose | Style | Detail level | Terminology | Canonical source |
|-------|----------|---------|-------|--------------|-------------|------------------|
| **Marketing** | Visitors | Acquire, differentiate | Confident, calm, specific | Low-mechanism | TERMINOLOGY preferred | Page briefs + Phase 0 |
| **Product UI** | Users in app | Control, status, action | Minimal, instructive | High for settings | TERMINOLOGY strict | i18n product keys |
| **Instructional** | New installers | Onboard | Step-by-step, numbered | Medium | Shortcuts linked not copied | Guide |
| **Educational** | Learners | Explain mistakes | Supportive, precise | High | Pattern, practice | dashboard + explanations |
| **Errors** | Users blocked | Recover | Plain, actionable | Exact next step | No blame | i18n errors + usageUx |
| **Billing** | Account holders | Transparent commerce | Factual | Exact checks/plans | AI writing check | FREE_PLAN_LIMITS + pricing |
| **Support** | Help seekers | Answer questions | Neutral, searchable | High | Link to canonical | support i18n |

### Examples by layer

| Layer | Example |
|-------|---------|
| Marketing | "Write where you are — keyboard, language, and English help in your field." |
| Product UI | "AI writing checks remaining: 42" |
| Instructional | "Step 2: Pin Flowlary and open the popup to choose what to help with." |
| Educational | "This pattern is about articles before nouns." |
| Errors | "You've used today's AI writing checks. Local tools still work." |
| Billing | "Pro includes 1,000 AI writing checks per day." |
| Support | "Live translation requires a session. Turn it on in the popup when you need it." |

---

## Part 16 — Messaging Hierarchy

| Level | Communicates | Appears | Does NOT appear |
|-------|--------------|---------|-----------------|
| **L1 Brand promise** | Write where you are | Home hero, footer, OG | Feature detail body |
| **L2 Core product** | In-field bilingual writing companion in Chrome | Home, Product intro, About lead | Popup, errors |
| **L3 Differentiation** | Layout + language + English in one layer; not another tab | Home solution, Product | Support KB |
| **L4 Capabilities** | Correction, translation, layout, Speed Box | Features index, detail pages | Home (summary only) |
| **L5 Proof** | Free tier, control, Chrome | Home proof, About | Dashboard |
| **L6 Trust/control** | Pause, exceptions, sensitive fields skipped | Product `#control`, Privacy | Hero |
| **L7 Learning/Pro** | Patterns, practice, coach, reports | Dashboard, Pricing Pro column | Home hero |
| **L8 Commercial** | Plans, checks, student | Pricing, Account | Home (link only) |

**Rule:** Lower levels never outrank higher levels on a given page. Home maxes at L5 in body; L7 one sentence max with link.

---

## Part 17 — CTA Architecture

### 17.1 CTA tiers

| Tier | Meaning | Visual weight (Phase 3) |
|------|---------|-------------------------|
| **Primary** | Main conversion of this page | One per page max |
| **Secondary** | Alternative path | One per section max |
| **Tertiary** | Text link | Unlimited with discipline |

### 17.2 Canonical CTA definitions

| CTA label | Meaning | Destination | When |
|-----------|---------|-------------|------|
| **Install Flowlary** | Begin Chrome extension install | `/guide` (until CWS) or CWS URL | Default primary conversion |
| **Get Flowlary** | **Deprecated → Install Flowlary** | Same | Legacy key migration |
| **Try** | Open simulated playground | `/try` | Pre-install evaluation |
| **Try with live AI** | Writing Lab | `/lab` | Post-interest, needs auth for action |
| **Sign in** | Auth | `/account` | Gated features |
| **Start writing** | Writing Lab | `/lab` | Dashboard, post-auth |
| **Open Dashboard** / **Dashboard** | Workspace | `/dashboard` | Signed-in |
| **Continue in Chrome** | Extension dashboard or field | Extension URL | Signed-in + extension |
| **View pricing** | Commercial page | `/pricing` | Secondary on marketing |
| **Explore features** | Capability index | `/features` | Secondary |
| **See Product** | Surfaces map | `/product` | After home surfaces teaser |
| **Explore [capability]** | Feature detail | `/features/*` | From home/features |
| **Get Pro** | Checkout | Paddle via account | Pricing, usage exhausted |
| **Manage subscription** | Billing portal | Paddle portal | Account panel |
| **Get help** | Support KB | `/support` | Errors, footer |
| **Contact support** | Human | `/contact` or ticket | Broken state |
| **Read the Guide** | Onboarding | `/guide` | Support banner |
| **Share feedback** | Ideas | `/feedback` | Product input |

### 17.3 Rules

1. **Try** always means `/try` simulated — never Lab, never extension.
2. **Start writing** always means `/lab` — never playground.
3. **Install** always means Guide or CWS — never Support page as surprise (label honestly).
4. One primary CTA per page/view.
5. Popup uses **Open Dashboard** not "Learn more."

### 17.4 Page CTA matrix

| Page | Primary | Secondary |
|------|---------|-----------|
| Home | Install Flowlary | Try |
| Product | Install Flowlary | Try |
| Features index | Install Flowlary | Try |
| Feature detail | Install Flowlary | Try (relevant mode) |
| Pricing | Get Pro / Start free | Sign in |
| Try | Install Flowlary | Try with live AI |
| Lab | Analyze / Sign in | Install extension |
| About | Install Flowlary | See Product |
| Guide | Install Flowlary | Support |
| Support | — (search) | Guide, Contact |
| Feedback | Submit | Contact (broken) |
| Dashboard Overview | Start writing | Continue in Chrome |

---

## Part 18 — Content Migration Map

| Current location | Content block | Future canonical | Action |
|------------------|---------------|------------------|--------|
| Home `MarketingHomeSections` Write | Write section | Home §3 Solution (merged) | REWRITE |
| Home Communicate | Translate/layout/live | Features index + Product | MOVE |
| Home Learn | Learning loop | Dashboard + Features card | MOVE |
| Home `ProblemSection` | Tool fatigue | Home §2 Problem | KEEP/trim |
| Home `WhySection` | Control philosophy | Product `#control` | MOVE |
| Home `HowSection` | 4 steps | Guide + Home trim (1 line) | MERGE |
| Home `ProductProofSections` | Reviews/stats | Home §5 Proof | KEEP |
| Home `HeroSection` | Popup mock | Home §1 Hero | KEEP |
| `home.*` legacy keys | English learning hero | Omar secondary only / archive | ARCHIVE |
| Features `FeaturesShowcase` journey | W/C/L sections | **Delete from features** | REWRITE |
| Features connected flow | Integration story | Product page | MOVE |
| About capabilities grid | 5 capabilities | Features index | MOVE |
| About popup split | Popup explain | Product `#control` | MOVE |
| Orphan `ControlPhilosophy` | Control | Product `#control` | MERGE |
| Orphan `SafetySection` | Safety | Product + Privacy | MERGE |
| Orphan `ProblemStory` | Problem | Home problem | MERGE |
| Orphan `PopupShowcase` | Popup | Product `#control` | MERGE |
| Guide install steps | Install | Guide (keep) | KEEP |
| Guide shortcuts card | Shortcuts | Product `#actions` (Guide links) | MOVE |
| Support install section | Install | Guide (Support links) | MOVE |
| Support shortcuts | Shortcuts | Product `#actions` | MOVE |
| Support feature help | Troubleshooting | Support (keep) | KEEP |
| Feedback support tab | Tickets | Dashboard/support | MOVE |
| `account/support` | Tickets | Dashboard/support | MOVE |
| Pricing showcase | Plans/FAQ | Pricing | KEEP |
| Feature pages FactGrid | Capability | Same pages | KEEP |
| Dashboard overview | Lab CTA, coach | Dashboard | KEEP |
| Popup HomeView | Three tools framing | Product `#control` copy informs Phase 5 | REWRITE (Phase 5) |
| seo.ts descriptions | English learning lead | L1/L2 hierarchy | REWRITE (Phase 3) |

---

## Part 21 — Copy Deck (first draft, structural EN)

**Not final polish.** Follows Phase 0 voice. Uses TERMINOLOGY_2.0.

### Home

| Element | Copy |
|---------|------|
| Hero kicker | Chrome writing companion |
| Hero headline | Write where you are. |
| Hero lead | Flowlary helps bilingual writers fix keyboard mistakes, get English help, and translate — in the field you already type in. |
| Hero note | Free to start · Works in Chrome · You stay in control |
| Problem title | Small interruptions break your writing flow. |
| Problem lead | Wrong keyboard. Another language. Another app. Flowlary brings help into the field. |
| Solution title | One layer for layout, language, and English. |
| Solution lead | Stay on the page. Fix the layout, check the English, or translate — without opening another tool. |
| Surfaces title | One product. Different places for different jobs. |
| Surfaces lead | The popup controls what runs. Shortcuts act in your field. Your dashboard tracks progress. |
| Proof title | Built for daily writing |
| Try title | Try Flowlary before you install |
| Try playground card | **Try** — Simulated demos, no account |
| Try lab card | **Writing Lab** — Live AI correction when signed in |
| Final title | Ready to write in Chrome? |
| Final lead | Install Flowlary and keep help where you type. |

### Product page

| Element | Copy |
|---------|------|
| Title | How Flowlary works as one product |
| Lead | Flowlary is a Chrome writing companion. Depending on what you need, you use a different surface — each with one job. |
| Control heading | Control — the popup |
| Control lead | Turn Flowlary on or off, choose what runs on this site, and check your usage. |
| Act heading | Act — keyboard shortcuts |
| Act lead | Fix writing, translate, or repair layout in the field — without opening the popup. |
| Repair heading | Manual repair — Speed Box |
| Repair lead | Open a repair panel when you want to see layout options before applying. |
| Learn heading | Learn — your dashboard |
| Learn lead | Same account on the web or in Chrome. Practice, progress, and reports follow your writing. |

### Features index

| Element | Copy |
|---------|------|
| Title | What Flowlary helps with |
| Lead | Choose a topic to see how it works — and where it runs. |
| Layout card | Keyboard layout repair — Recover text typed on the wrong keyboard. |
| English card | English help — Spelling, grammar, and wording in your field — not a rewrite. |
| Translation card | Translation — Translate text with a shortcut when you need it. |
| Learning card | Learning from your writing — Patterns, practice, and progress in your dashboard. |

### Feature page headlines (template)

| Page | Headline | Lead |
|------|----------|------|
| Writing correction | English help in your field | Flowlary suggests spelling, grammar, and wording improvements on the text you are working on. You review before applying. |
| Translation | Translate without leaving the field | Use a keyboard shortcut to translate the text you selected or the field you are in. |
| Live translation | Live translation when you turn it on | Optional session mode for Arabic segments while you type. Off by default. |
| Keyboard layout | Repair the wrong keyboard | Flowlary remaps text typed with the wrong layout — it is not ordinary spell check. |
| Speed Box | Speed Box for manual layout repair | Open a panel, choose a conversion, and keep writing. |

### Try page

| Element | Copy |
|---------|------|
| Title | Try Flowlary |
| Badge | Simulated |
| Lead | Explore how correction, translation, and layout repair feel — no install, no account. Behavior is representative, not live AI. |
| Lab upsell | Want live correction on your text? Sign in to Writing Lab. |

### Writing Lab entry

| Element | Copy |
|---------|------|
| Title | Writing Lab |
| Lead | Write in English. Flowlary analyzes your text with live AI correction. Progress counts toward your account. |
| Disclaimer | Uses Flowlary AI on the web — not the Chrome extension engine. |
| Sign-in gate | Sign in to analyze your writing and save learning progress. |

### Pricing positioning

| Element | Copy |
|---------|------|
| Title | Free to write. Pro for depth. |
| Lead | Local tools and generous daily AI checks on Free. Pro adds capacity and the full learning experience. |
| Check explainer | One AI writing check = one successful analysis. Multiple corrections in one analysis still count as one check. |

### About positioning

| Element | Copy |
|---------|------|
| Title | Writing should not require a stack of tools |
| Lead | Flowlary exists for people who write in Arabic and English throughout the day — and want help to stay in the field. |

### Guide entry

| Element | Copy |
|---------|------|
| Title | Install Flowlary and get your first win |
| Lead | A short path from install to your first useful action in Chrome. |

### Support entry

| Element | Copy |
|---------|------|
| Title | Support |
| Lead | Search for answers. New to Flowlary? Start with the Install guide. |
| Banner | Looking to install? → Guide |

### Dashboard labels (align web + extension)

| Key | Copy |
|-----|------|
| groupWrite | Write |
| groupLearn | Learn |
| groupAccount | Account |
| overview | Overview |
| practice | Practice |
| progress | Progress |
| report | Report |
| settings | Settings |
| account | Account |
| history (extension) | History |

### Key CTAs (locked labels)

| Key | Copy |
|-----|------|
| cta.install | Install Flowlary |
| cta.try | Try |
| cta.tryLive | Try with live AI |
| cta.startWriting | Start writing |
| cta.dashboard | Dashboard |
| cta.continueChrome | Continue in Chrome |
| cta.viewPricing | View pricing |
| cta.exploreProduct | How it works |

---

## Part 22 — Arabic / Localization Strategy

### 22.1 Rules (no full translation in Phase 1)

| Rule | Definition |
|------|------------|
| **EN source** | All Phase 1 copy deck locks in EN first |
| **AR relationship** | AR is parity language — structure mirrors EN; wording adapted not literal |
| **Terminology** | AI writing check AR term from FREE_PLAN_LIMITS.md is mandatory |
| **RTL** | Layout mirrors; shortcut kbd clusters stay `dir="ltr"` |
| **Bilingual examples** | Marketing examples show Arabic + English where relevant — both EN and AR pages |
| **Cultural adaptation** | Layout/keyboard examples prioritize ar-101; MENA professional contexts |
| **Speed Box** | Decision Phase 7: loanword vs localized — document either way consistently |
| **Persona** | Nadia-first examples in AR — not English-learning-only framing |
| **Structure vs wording** | AR mirrors page structure and IA; headlines may adapt for natural Arabic |
| **Locale completeness** | 12 locales exist — Phase 7 after EN lock; incomplete locales stay flagged |

### 22.2 RTL content implications (for Phase 2)

- Navigation order mirrors
- Diagrams flow RTL
- Numbers in usage/billing: locale formatting
- Legal: locale-specific documents already in content/legal

---

## Part 23 — Content Governance

| Content category | Owner (conceptual) | Canonical source | Update trigger |
|------------------|-------------------|------------------|----------------|
| Brand promise | Product Experience docs | Phase 0 + this doc | Positioning change |
| Capability claims | Product engineering docs | CAPABILITIES.md, KNOWN_LIMITATIONS | Ship/limit change |
| Pricing & checks | Commercial | FREE_PLAN_LIMITS.md, credits.ts | Plan change |
| Shortcuts | Engineering config | website/src/config.ts | Shortcut change |
| Support KB | Support content | support i18n | New issues |
| Dashboard labels | Product i18n | dashboard i18n keys | Panel change |
| Legal | Legal | content/legal | Legal review |
| Marketing copy | Product Experience | copy deck → en.ts (Phase 3) | IA change |
| Error/usage messages | Product + backend | usageUx.ts, i18n errors | UX/state change |
| SEO meta | Marketing + PE | seo.ts | Page change |

**Stale-prevention rule:** If a statement appears in more than one place, one must be canonical and others must link or use shared import — enforced in Phase 3+ implementation.

---

## Part 25 — Phase 2 Input Contract (content slice)

Phase 2 Design System needs from this document:

| Deliverable | Section |
|-------------|---------|
| CTA tier meanings | §17 |
| Content layer tones | §14 |
| Typography density by layer | §14 (marketing airy, dashboard compact) |
| Status/error language patterns | §14, TERMINOLOGY |
| RTL shortcut display | §22 |
| Component text slots per page | Page briefs + copy deck |
| Badge labels (Simulated, Live) | §10, Try page |
| Nav label strings | NAVIGATION_SPEC + copy deck |

**Not for Phase 2:** Page layout, final marketing prose, i18n commits.

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 1 content architecture complete |
