# Flowlary Terminology 2.0

**Phase:** 1  
**Date:** 2026-09-03  
**Status:** Canonical English glossary for Product Experience 2.0  
**Scope:** EN locked in Phase 1; other locales follow in Phase 7

---

## Usage rules

1. **Marketing** uses Preferred terms from this glossary.
2. **Product UI** uses Preferred terms; may use shorter labels where space constrained.
3. **Support** uses Preferred terms; Allowed variants OK in prose.
4. **Code-internal names** (decideWriting, Write Gate, etc.) **must NOT** appear in marketing or user-facing support.
5. If a term can become stale, its **canonical source** is the document listed below — not duplicate copy.

---

## Core brand

| Term | Preferred | Definition | Allowed variants | Avoid | Reason | Canonical source |
|------|-----------|------------|------------------|-------|--------|------------------|
| **Flowlary** | Flowlary | Product name | — | Flowlary AI (as brand) | Brand is Flowlary; AI is a capability | `packages/shared` BRAND |
| **Writing companion** | writing companion | Category — Chrome extension that assists in-field | in-flow writing companion | AI writing assistant (lead), copilot, tool | Warm, accurate, not generic AI | Phase 0 brand |
| **In-field** | in your field / in the field | Help appears in the text area you are typing in | where you write, in-page | in-app, inline AI | Precise delivery mechanism | PRODUCT_OVERVIEW |
| **Write where you are** | Write where you are. | Primary tagline | — | Stay in the flow (supporting) | Phase 0 positioning | Phase 0 |

---

## Capabilities

| Term | Preferred | Definition | Allowed variants | Avoid | Reason | Canonical source |
|------|-----------|------------|------------------|-------|--------|------------------|
| **Keyboard layout repair** | keyboard layout repair | Remapping text typed on wrong keyboard layout | fix keyboard layout, layout repair | spell check, autocorrect | Specific capability | CAPABILITIES.md |
| **English help** | English help | Bounded spelling/grammar/wording assistance on English islands | writing correction, English correction | grammar checker, rewrite, polish | Not style rewriting | CAPABILITIES.md |
| **Translation** | translation | User-initiated conversion via shortcut | translate | auto-translate page | User-initiated | CAPABILITIES.md |
| **Live translation** | live translation | Optional session mode for segment translation while typing | — | real-time translate (hype) | Default-off; session required | CAPABILITIES.md |
| **Speed Box** | Speed Box | Manual layout repair overlay invoked by shortcut | — | speedbox, layout box, converter | Proper noun; established | extension UI |
| **Writing Review** | writing review (lowercase in prose) | Async AI review after pause on English island | — | instant correction (for review) | Distinct from instant local typos | WRITING_ENGINE docs — product UI only |
| **AI writing check** | AI writing check / AI writing checks | One successful AI analysis unit (billing) | daily AI checks | credits, tokens, words/day | FREE_PLAN_LIMITS.md | `packages/shared/src/credits.ts` |
| **Local tools** | local tools | Features that do not consume AI checks (layout, Speed Box, pause) | — | offline AI | Honest Free tier | FREE_PLAN_LIMITS.md |

---

## Surfaces

| Term | Preferred | Definition | Allowed variants | Avoid | Reason | Canonical source |
|------|-----------|------------|------------------|-------|--------|------------------|
| **Writing Lab** | Writing Lab | Web live correction surface (gateway API) | — | Writing lab, Lab (alone in nav) | Proper noun | website/src/lab |
| **Playground** | Playground (internal) / **Try** (nav) | Simulated feature demos on web | Try Flowlary (CTA) | Demo, sandbox | Nav uses Try; page can say simulated playground | playground components |
| **Dashboard** | Dashboard | Learning workspace (web or extension) | your dashboard | workspace, portal, account area | One concept, two contexts | dashboard types |
| **Popup** | popup / Flowlary popup | Extension toolbar control surface | extension popup | menu, panel, addon | User-known Chrome term | extension popup |
| **Shortcut** | keyboard shortcut / shortcut | Key chord triggering in-field action | hotkey | keybind (dev) | User language | config.ts SHORTCUTS |
| **Chrome extension** | Chrome extension | Delivery format | extension (after context) | app, plugin, addon | Precise | manifest |
| **Extension dashboard** | Flowlary dashboard in Chrome | Full tab workspace from extension | dashboard in Chrome | options page, settings page | Align with web Dashboard | extension dashboard |

---

## Control & policy

| Term | Preferred | Definition | Allowed variants | Avoid | Reason | Canonical source |
|------|-----------|------------|------------------|-------|--------|------------------|
| **Pause** | Pause Flowlary / pause | Global off for extension | turn off | disable AI (ambiguous) | Matches popup | popup UI |
| **Site exception** | pause on this site / site exception | Per-host exclusion | exclude this site | blocklist (technical) | User-facing popup | popup UI |
| **Suggest** | suggestions | Mode: show proposals before applying | review changes | ask mode | Product UI term | helpStyle |
| **Managed AI** | Flowlary AI | Cloud AI via api.flowlary.com — no user API keys | — | Groq/Gemini (provider names) | Trust + abstraction | product docs |

---

## Learning

| Term | Preferred | Definition | Allowed variants | Avoid | Reason | Canonical source |
|------|-----------|------------|------------------|-------|--------|------------------|
| **Practice** | practice | Focused exercise session on error patterns | practice session | quiz, lesson | Product nav label | dashboard |
| **Progress** | progress | Charts and recurring error trends | your progress | analytics | Nav label | dashboard |
| **Report** | learning report / report | AI narrative summary (Pro depth) | full report | AI report (lead) | Nav label | dashboard |
| **Activity** | history / writing history | Extension log of writing events | activity (internal) | timeline | User-facing: History; code: activity | extension dashboard |
| **Learning Coach** | Learning Coach | Pro AI coach in Overview | coach | AI tutor | Proper noun feature | dashboard |
| **Pattern** | pattern / recurring pattern | Repeated error type from real writing | — | mistake type (ok secondary) | Learning vocabulary | learning pipeline |

---

## Account & commercial

| Term | Preferred | Definition | Allowed variants | Avoid | Reason | Canonical source |
|------|-----------|------------|------------------|-------|--------|------------------|
| **Account** | account | User identity and auth | — | profile (ok in settings) | Auth shell name | account pages |
| **Pro** | Pro | Paid plan | — | Premium, Plus | Matches Paddle SKUs | pricing.ts |
| **Free** | Free | Free plan | — | Basic | Matches code | pricing.ts |
| **Trial** | trial | 30-day registration trial | free trial | — | Specific entitlement | credits.ts |
| **Student program** | student program | Verified student access | students (nav) | academic plan | Pricing section | pricing page |

---

## Help

| Term | Preferred | Definition | Allowed variants | Avoid | Reason | Canonical source |
|------|-----------|------------|------------------|-------|--------|------------------|
| **Guide** | Guide / Install guide | Linear onboarding | Tutorial (footer i18n) | Documentation | Onboarding-only | /guide |
| **Support** | Support | Searchable knowledge base | Help center | FAQ page (alone) | KB proper noun | /support |
| **Feedback** | Feedback | Product ideas and general opinions | Share feedback | Support, Tickets | Not tickets | /feedback |
| **Contact** | Contact | Human escalation | — | Help | Last resort | /contact |
| **Support ticket** | support ticket / ticket | Account issue tracked by support team | — | feedback (for bugs) | Dashboard/support only | ticket system |

---

## Terms in code that must NOT appear in marketing

| Code term | User-facing substitute |
|-----------|-------------------------|
| Write Gate | "Flowlary applies changes in your field" |
| decideWriting | — (do not mention) |
| runFieldCycle | — |
| manual_box | Speed Box |
| content script | "works on the page you're typing in" |
| enforce mode | — |
| island (technical) | "the sentence or phrase you're working on" |
| Groq / Gemini / OpenRouter | Flowlary AI |
| chrome.storage | — |
| postMessage / bridge | "connects to your account" |
| MV3 | Chrome extension |
| execCommand | — |

---

## Deprecated terms (migrate away)

| Deprecated | Replace with | Where found today |
|------------|--------------|-------------------|
| Your AI Writing Companion | Write where you are / writing companion | `en.ts` brand.tagline |
| Learn English through your writing (lead) | Supporting message for Omar persona only | `en.ts` home.heroTitle (legacy) |
| AI writing assistant (lead) | writing companion | seo.ts title |
| Three tools (correction/translate/layout) | One companion; control + actions | popup gap audit G5 |
| Get Flowlary → surprise support page | Install Flowlary → Guide (until CWS) | GetFlowlaryButton fallback |
| Credits | AI writing checks | older docs |
| Demo (unqualified) | Simulated try / Try Flowlary | playground |
| Dashboard (two products framing) | Dashboard — on web or in Chrome | support copy |

---

## Shortcut reference (canonical labels)

Source: `website/src/config.ts` — **do not duplicate strings elsewhere**.

| Action | macOS | Windows/Linux | Preferred label |
|--------|-------|---------------|-----------------|
| English help | ⌘⇧E | Ctrl+Shift+E | Fix writing / English help |
| Translate | ⌘⇧, | Ctrl+Shift+, | Translate |
| Fix layout | ⌘⇧P | Ctrl+Shift+P | Fix keyboard layout |
| Speed Box | ⌘⇧L | Ctrl+Shift+L | Speed Box |

Display format: `<kbd>` per key; `dir="ltr"` on shortcut clusters in RTL pages.

---

## Bilingual terminology notes

| EN | AR direction (Phase 7 — not translated here) |
|----|---------------------------------------------|
| AI writing check | فحص الكتابة بالذكاء الاصطناعي (per FREE_PLAN_LIMITS.md) |
| Keyboard layout repair | Must use established AR product term from `ar.ts` audit in Phase 7 |
| Speed Box | May remain Speed Box (loanword) or localized overlay name — decision Phase 7 |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-09-03 | Phase 1 EN glossary locked |
