# Flowlary Page Briefs 2.0

**Phase:** 1  
**Date:** 2026-09-03  
**Status:** Page contracts — no UI design  
**Rule:** No page may own the same major idea as another page.

---

## How to read contracts

Each page has **one primary job**. Supporting messages must link to canonical homes elsewhere. Claims must trace to sources in `KNOWN_LIMITATIONS.md`, `CAPABILITIES.md`, or `FREE_PLAN_LIMITS.md`.

---

## Home

| Field | Value |
|-------|-------|
| **Route** | `/` |
| **Surface** | DISCOVER |
| **Audience** | First-time visitors, Nadia primary |
| **User state** | Public |
| **Primary user question** | What is Flowlary and is it for me? |
| **Primary job** | Acquisition — one coherent product introduction |
| **Secondary job** | Route to Try, Product, Pricing |
| **Primary message** | In-field writing help for bilingual Chrome writers |
| **Supporting messages** | Problem (tool fatigue, layout slips); solution summary; surfaces teaser; trust |
| **Required proof** | Popup mock (labeled); Chrome badge; Free to start |
| **Primary CTA** | Install Flowlary (→ Guide until CWS) |
| **Secondary CTA** | Try → `/try` |
| **Next destination** | `/try`, `/product`, `/pricing`, `/guide` |
| **Content belongs here** | Hero, problem, solution (one demo), surfaces summary, proof strip, try cards, final CTA |
| **Content does NOT belong** | Full W/C/L journey; shortcut docs; learning depth; billing; support KB; feature detail |
| **Canonical claims source** | Phase 0 product definition |
| **Related surfaces** | `/product`, `/try`, `/lab`, extension |

---

## Product (Surfaces)

| Field | Value |
|-------|-------|
| **Route** | `/product` |
| **Surface** | DISCOVER |
| **Audience** | Evaluators who need system understanding |
| **User state** | Public |
| **Primary user question** | How does one product become all these places? |
| **Primary job** | Canonical surfaces map |
| **Secondary job** | Popup / Shortcuts / Speed Box / Dashboard disambiguation |
| **Primary message** | One product. Different places for different jobs. |
| **Supporting messages** | DISCOVER→TRY→USE→CONTROL→ACT→LEARN→MANAGE layer table |
| **Required proof** | Diagram or structured list; labeled mocks per surface |
| **Primary CTA** | Install Flowlary |
| **Secondary CTA** | Try → `/try` |
| **Next destination** | `/guide`, `/try`, `/lab`, `/features` |
| **Content belongs here** | Surface contracts; fidelity ladder; web vs extension dashboard; `#actions` shortcut ref; `#control` popup ref |
| **Content does NOT belong** | Full pricing; full feature demos; brand story (→ About); install steps (→ Guide) |
| **Canonical claims source** | FLOWLARY_IA_2.0 §12, TERMINOLOGY_2.0 |
| **Related surfaces** | All |

**Sections (in order):** Intro → Layer map → Discover (web) → Try (playground, lab) → Use (extension) → Control (popup) → Act (shortcuts) → Manual repair (Speed Box) → Learn (dashboard) → Manage (account) → Cross-links.

---

## Features index

| Field | Value |
|-------|-------|
| **Route** | `/features` |
| **Surface** | DISCOVER |
| **Audience** | Evaluators comparing capabilities |
| **User state** | Public |
| **Primary user question** | What problems does Flowlary solve? |
| **Primary job** | Capability index organized by user problems |
| **Secondary job** | Link to detail pages and dashboard for learning |
| **Primary message** | Problem → outcome cards, not a second homepage |
| **Supporting messages** | One-line per category; honest limits footnote |
| **Required proof** | Icons or minimal demos per card |
| **Primary CTA** | Install Flowlary |
| **Secondary CTA** | Try → `/try` |
| **Next destination** | Feature detail pages, `/dashboard` (learning card) |
| **Content belongs here** | Category grid, learning card (links out), comparison to standalone tools (brief) |
| **Content does NOT belong** | Write/Communicate/Learn journey; popup hero repeat; connected flow steps; final CTA duplicate of home |
| **Canonical claims source** | IA §9 taxonomy |
| **Related surfaces** | Feature pages, `/product` |

---

## Feature detail: Writing correction

| Field | Value |
|-------|-------|
| **Route** | `/features/writing-correction` |
| **Surface** | DISCOVER |
| **Audience** | English help seekers |
| **Primary user question** | How does English help work in my field? |
| **Primary job** | Explain English help capability and limits |
| **Primary message** | Island-based help — not a rewrite |
| **Primary CTA** | Install Flowlary |
| **Secondary CTA** | Try correction → `/try` (correction mode) |
| **Content belongs here** | What/why/when/limits; demo; CE honesty |
| **Content does NOT belong** | Full learning loop; translation; homepage narrative |
| **Canonical source** | CAPABILITIES §2, KNOWN_LIMITATIONS |
| **Related surfaces** | `/try`, `/lab`, popup, shortcuts |

*(Parallel contracts for `/features/translation`, `/features/live-translation`, `/features/keyboard-layout`, `/features/speed-box` — same structure, one capability each.)*

### Feature page template (all five)

| Field | Rule |
|-------|------|
| Primary job | One capability, one problem, one outcome |
| Mechanism level | Medium — enough to set expectations, not engine internals |
| Demo | Browser-stage or mode-specific; labeled mock/sim |
| Limits | Live translation: session/default-off; Speed Box: manual only; Layout: not spellcheck |
| CTA | Install primary; Try secondary (relevant mode) |
| Forbidden | Mini-homepage sections; Write/Communicate/Learn; pricing table |

---

## Pricing

| Field | Value |
|-------|-------|
| **Route** | `/pricing` |
| **Surface** | DISCOVER / MANAGE entry |
| **Audience** | Nadia, Sara, upgraders |
| **Primary user question** | What do I pay and what do I get? |
| **Primary job** | Commercial truth — ONLY canonical pricing explanation |
| **Secondary job** | Student program (`#students`) |
| **Primary message** | Free is usable; Pro adds capacity and learning depth |
| **Supporting messages** | AI writing check definition; local tools unlimited; exhaustion behavior |
| **Required proof** | Plan comparison; FAQ; billing trust |
| **Primary CTA** | Get Pro / Start free |
| **Secondary CTA** | Sign in → `/account` |
| **Content belongs here** | Plans, compare table, check explainer, student block, FAQ, trial |
| **Content does NOT belong** | Feature tutorials; surface map; install steps |
| **Canonical source** | FREE_PLAN_LIMITS.md, packages/shared pricing |
| **Related surfaces** | `/dashboard#account`, popup usage strip |

---

## Try (Playground)

| Field | Value |
|-------|-------|
| **Route** | `/try` |
| **Surface** | TRY |
| **Audience** | Pre-install visitors |
| **Primary user question** | What does using Flowlary feel like? |
| **Primary job** | Simulated try — honest fidelity labeling |
| **Secondary job** | Funnel to Lab or Install |
| **Primary message** | Simulated — not your data, not live AI |
| **Required proof** | SIMULATED badge; mode tabs; disclaimer |
| **Primary CTA** | Install Flowlary |
| **Secondary CTA** | Try with live AI → `/lab` (sign in) |
| **Content belongs here** | Mode tabs (correction, translation, live, layout, **Speed Box when wired**), steps, disclaimer |
| **Content does NOT belong** | Account creation flow; learning sync claims; real AI |
| **Canonical source** | playground code; KNOWN_LIMITATIONS (simulated) |
| **Related surfaces** | `/lab`, `/guide`, extension |

---

## Writing Lab

| Field | Value |
|-------|-------|
| **Route** | `/lab` |
| **Surface** | TRY (live) |
| **Audience** | Signed-in users; prospects post-register |
| **Primary user question** | Can Flowlary correct my real writing on the web? |
| **Primary job** | Live gateway correction + learning ingest |
| **Secondary job** | Extension install bridge |
| **Primary message** | Real AI correction on the web — not the extension engine |
| **Required proof** | Consent gate; auth gate; sync confirmation |
| **Primary CTA** | Analyze my writing (signed in) |
| **Secondary CTA** | Sign in (signed out) / Install extension |
| **Content belongs here** | Textarea, corrections, explanations, learning synced notice |
| **Content does NOT belong** | Marketing narrative; playground modes; pricing |
| **Canonical source** | WL5 docs, KNOWN_LIMITATIONS (Lab ≠ engine) |
| **Related surfaces** | `/dashboard`, extension |

**Public shell:** Page loads signed out with explanation + sign-in CTA; no AI until auth.

---

## About

| Field | Value |
|-------|-------|
| **Route** | `/about` |
| **Surface** | DISCOVER (trust) |
| **Audience** | Trust-seekers, press |
| **Primary user question** | Who is behind this and what do they believe? |
| **Primary job** | Brand story and philosophy |
| **Secondary job** | Trust proof (conditional API content OK with static fallback) |
| **Primary message** | Why Flowlary exists — fragmentation, bilingual daily writing |
| **Primary CTA** | Install Flowlary |
| **Secondary CTA** | Read Product → `/product` |
| **Content belongs here** | Story, principles, team/trust, built-with-users |
| **Content does NOT belong** | Capability catalog (→ Features); surfaces map (→ Product); W/C/L journey |
| **Canonical source** | Phase 0 brand foundation |
| **Related surfaces** | Home, Product |

---

## Guide

| Field | Value |
|-------|-------|
| **Route** | `/guide` |
| **Surface** | GET HELP (onboarding) |
| **Audience** | New installers |
| **Primary user question** | How do I install and get first value? |
| **Primary job** | ONLY canonical install + first-run path |
| **Secondary job** | Point to shortcuts reference and popup |
| **Primary message** | Install → open popup → first action → learn shortcuts |
| **Primary CTA** | Install Flowlary |
| **Secondary CTA** | Open Support (if stuck) |
| **Content belongs here** | Numbered install steps, first-win explanation, link to `/product#actions` |
| **Content does NOT belong** | Full shortcut table (link only); KB articles; feature marketing |
| **Canonical source** | USER_JOURNEY.md, Guide i18n structure |
| **Related surfaces** | Popup First Win, Support (link) |

---

## Support

| Field | Value |
|-------|-------|
| **Route** | `/support` |
| **Surface** | GET HELP |
| **Audience** | All users with questions |
| **Primary user question** | How do I fix or understand X? |
| **Primary job** | Searchable knowledge base |
| **Secondary job** | Escalation routing |
| **Primary message** | Search first; Guide for new users |
| **Primary CTA** | Search / browse topics |
| **Secondary CTA** | Contact (broken) / Guide (new) |
| **Content belongs here** | Topic nav, feature troubleshooting, account/billing help, AI checks, privacy topics |
| **Content does NOT belong** | Install steps (link `#get-flowlary` → Guide); full shortcut reference; ticket creation (→ dashboard) |
| **Canonical source** | support i18n topics |
| **Related surfaces** | Guide, Contact, Feedback, `/dashboard/support` |

---

## Feedback

| Field | Value |
|-------|-------|
| **Route** | `/feedback` |
| **Surface** | GET HELP (product input) |
| **Audience** | Signed-in users (submit) |
| **Primary user question** | How do I share an idea or rate Flowlary? |
| **Primary job** | Product feedback and feature requests |
| **Secondary job** | Satisfaction ratings |
| **Primary message** | Share ideas — not for account emergencies |
| **Primary CTA** | Submit feedback / request feature |
| **Secondary CTA** | Contact support (for broken) → Contact or `/dashboard/support` |
| **Content belongs here** | Feedback form, feature requests, ratings |
| **Content does NOT belong** | Support tickets (**remove support tab** in Phase 3) |
| **Canonical source** | feedback client |
| **Related surfaces** | Contact, dashboard support |

**Phase 0 conflict resolution:** Ticket creation moves to `/dashboard/support` only.

---

## Contact

| Field | Value |
|-------|-------|
| **Route** | `/contact` |
| **Surface** | GET HELP |
| **Audience** | Users needing human response |
| **Primary user question** | How do I reach a person? |
| **Primary job** | Human escalation |
| **Primary CTA** | Email / channel links |
| **Secondary CTA** | Support KB first |
| **Content belongs here** | Channels, safety notice, response expectations |
| **Content does NOT belong** | KB articles, install, feature docs |
| **Related surfaces** | Support, `/dashboard/support` |

---

## Account (auth shell)

| Field | Value |
|-------|-------|
| **Route** | `/account` |
| **Surface** | MANAGE |
| **Audience** | Unsigned users |
| **Primary user question** | How do I sign in or register? |
| **Primary job** | Authentication only (future split) |
| **Primary CTA** | Sign in / Register |
| **Secondary CTA** | Forgot password |
| **Content belongs here** | Auth forms, student intent, verification gates |
| **Content does NOT belong** | Dashboard panels when signed in (→ `/dashboard`) |
| **Related surfaces** | `/dashboard`, `/lab`, extension bridge |

---

## Dashboard

| Field | Value |
|-------|-------|
| **Route** | `/dashboard` (future; `#` sections) |
| **Surface** | LEARN / MANAGE |
| **Audience** | Signed-in users |
| **Primary user question** | How am I doing and what's next? |
| **Primary job** | Learning workspace + account management |
| **Primary message** | Same account — practice, progress, reports |
| **Primary CTA** | Start writing → `/lab` |
| **Secondary CTA** | Continue in Chrome (extension) |
| **Content belongs here** | Overview, Learn panels, Settings, Account/billing, tickets |
| **Content does NOT belong** | Marketing, feature catalog, install guide |
| **Canonical source** | dashboard types, FREE_PLAN_LIMITS Pro differentiation |
| **Related surfaces** | `/lab`, extension dashboard |

### Dashboard section contracts

| Section | Primary question | Job |
|---------|------------------|-----|
| **Overview** | What's my status today? | Entry, Lab CTA, brief, coach, extension status |
| **Practice** | How do I drill this mistake? | Sessions |
| **Progress** | Am I improving? | Charts, recurring errors |
| **Report** | What does AI see in my patterns? | Narrative (Pro) |
| **Settings** | Learning profile & data | Export/import, profile |
| **Account** | Plan, usage, billing | Paddle, usage bar, sign out |
| **Support** | Where are my tickets? | Ticket inbox |

---

## Legal pages

| Field | Value |
|-------|-------|
| **Routes** | `/privacy`, `/terms`, `/cookies` |
| **Surface** | Legal |
| **Primary job** | Legal compliance |
| **Content belongs here** | LegalDocument from content/legal |
| **Content does NOT belong** | Marketing |
| **Canonical source** | content/legal/*.ts |

---

## Page ownership matrix (no overlap)

| Major idea | Owner page |
|------------|------------|
| Product introduction | Home |
| Surfaces / popup vs shortcuts | Product |
| Capability list | Features index |
| Single capability depth | Feature detail |
| Pricing / checks | Pricing |
| Simulated try | Try |
| Live web try | Lab |
| Brand story | About |
| Install | Guide |
| KB / troubleshooting | Support |
| Ideas / ratings | Feedback |
| Human help | Contact |
| Auth | Account |
| Learning / progress | Dashboard |
| Legal | Privacy/Terms/Cookies |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 1 page briefs |
