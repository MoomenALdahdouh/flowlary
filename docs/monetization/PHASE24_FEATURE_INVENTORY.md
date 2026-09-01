# PHASE 24 — Feature Inventory

**Status:** Audit only — no implementation  
**Date:** 2026-08-26  
**Source of truth:** Repository code (not prior phase reports)

Label legend for numeric / plan fields:

| Label | Meaning |
| --- | --- |
| KNOWN FROM CODE | Exact constant or behavior in source |
| CALCULATED | Derived from known constants |
| ASSUMED | Hypothesis for planning only |
| REQUIRES EXTERNAL PRICING | Depends on Groq/Paddle catalog |

---

## Inventory table

| Feature name | Where it appears | Popup | Dashboard | Website | Content script | Backend | Local or server | Uses AI? | Flowlary API? | Model cost? | Stores data? | Learning-related? | Current entitlement | Current usage limit | Current plan availability | Current trial behavior | Current failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Keyboard layout auto-repair | Extension in-field | Toggle | Settings | Marketing demos | Yes | Optional classify only | Mostly local | Only for ambiguous tokens via `layout_ai` | Optional `POST /api/ai/layout-classification` | Only if remote classify | History `FIX_LAYOUT` | No | `layout_auto` always allowed | None for local path | Free / Trial / Pro | Available during trial | Local remap continues; AI classify locked when free balance exhausted |
| Layout manual shortcut | Extension + chrome command | Quick action | Settings | Guide | Yes | Optional classify | Local + optional AI | Optional | Same as above | Optional | History | No | Same as layout | Same | All plans | Same | Same |
| Layout AI classifier | SW background | Indirect | Indirect | No | Via SW | Yes | Server | Yes — `allam-2-7b` | Yes | Yes | Cache 24h | No | `layout_ai` | Shared free `usageBalanceMs` debit (latency) when account free | Free if balance > 0; Trial; Pro | Trial: allowed, no debit | 403 / entitlement_denied / rate_limited |
| Speed Box | Overlay in page | Toggle path via layout settings | Settings | Marketing | Yes | No | Local | No | No | No | No | No | None (settings flag) | None | All | Always | N/A |
| Instant spelling (direct correction) | Content script | Via correction | Settings | No | Yes | No | Local typo map | No | No | No | No | No | None | None | All | Always | N/A |
| Writing Correction (AI) | In-field box/direct | Toggle + status | Overview / Settings | Demos / Features | Yes | Yes | Server | Yes — `llama-3.1-8b-instant` | `POST /api/ai/correction` | Yes | History `CORRECT` + LearningEvents | Yes | `correction` | Free: latency budget; Trial/Pro: no budget debit; RPM by tier | Free w/ balance; Trial; Pro | Full AI during 7d trial | Locked UI; SW deny; server 403 |
| Manual Translation | Shortcut / popup | Toggle + quick translate | Settings | Translation pages | Yes | Yes | Server | Yes — `openai/gpt-oss-120b` | `POST /api/ai/translation` | Yes | History `TRANSLATE` | No | `translation` | Same shared budget / RPM | Same | Same | Same |
| Live Translation | Optional live mode | Toggle | Settings | Honest limits copy | Yes | Yes | Server | Yes — same translation model | Same endpoint `mode: live` | Yes (can be high) | History `TRANSLATE` live | No | `live_translation` | Same shared budget; client debounce 750ms | Same (not Pro-only today) | Same | Same + cancel on new input |
| Practice sessions | Dashboard Practice | No | Yes | Mentions | No (uses SW) | Via correction API | Server for Check | Yes (correction model) | Correction API | Yes | Practice sessions + LearningEvents `source: practice` | Yes | Same as correction (no separate gate) | Same AI budget | Same | Same | Check fails when locked |
| Learning profile / onboarding | Dashboard | Indirect | Yes | Guide | No | No | Local | No | No | No | `flowlary.learning.profile` | Yes | None | None | All | Local always | N/A |
| Learning events | Dashboard Progress | No | Progress | No | Via correction UX | No | Local | No | No | No | Max 2000 events | Yes | None today | Cap 2000 | All (no Pro gate) | Full today | Trim oldest |
| Progress metrics | Dashboard Progress | No | Yes | Mentions | No | No | Local derive | No | No | No | Derived from events | Yes | None | Min 50 words for rate | All | Full today | Empty states |
| Activity / History | Dashboard Activity | Helpers | Yes | Privacy notes | Via ops | No | Local | No | No | No | Max 50 entries × 2000 chars | No (ops log) | None | Cap 50 | All | Full | Drop oldest / privacy skip |
| Export / Import | Dashboard Data Control | No | Yes | Privacy | No | No | Local | No | No | No | JSON v1 export | Learning + activity + settings | None today (target Pro) | Schema v1 | All today | Available | Blocks secret leak |
| Data reset / privacy controls | Dashboard Privacy / Data | Pause | Yes | Privacy | Yes (pause) | No | Local | No | No | No | Clears stores | Related | None | None | All | Always | Confirm UX |
| Pause / disable extension | Popup | Yes | Via active flag | Support | Yes | No | Local | No | No | No | Settings | No | None | None | All | Always | Features paused |
| Account register / login | Website Account + extension | Sign-in CTA | Account | Account | No | Auth APIs | Server | No | Auth endpoints | No | Account store | No | Account required for server trial | N/A | Free after; Trial on register | Starts 7d trial + seeds 2h balance | Validation errors |
| Server entitlement | Account / popup status | Plan · usage | Account / Overview | Account | Headers | Entitlement resolve | Server authoritative for JWT | N/A | Yes | N/A | Account JSON store | No | `free` / `trial` / `pro` | Free balance 2h; trial 7d | As resolved | Trial → free on expiry | `usage_exhausted` / suspended |
| Paddle checkout / portal | Website Account (helpers) | Upgrade CTA | Account | Pricing / Account | No | Billing APIs | Server | No | Billing | No | Subscription rows | No | Pro via webhook only | Catalog price external | Pro when sub grants | Paddle `trialing` ≠ registration trial | Checkout unconfigured / Account dead-end |
| Rate limiting | Invisible | Via errors | Via errors | Docs | Via SW | Middleware | Server in-memory | N/A | All AI ops | N/A | Bucket Map | No | Tier-based RPM | anon 10 / free 30 / trial 60 / pro 120 per min per op | All authenticated tiers | Trial higher RPM | 429 / rate_limited |
| Install-auth AI path | Extension without account | Same toggles | Same | No | Yes | Auth install | Server + client claim | Yes if claim ≠ anonymous | AI APIs | Yes **without usage debit** | Usage log without accountId | No | Client claim → free RPM | RPM only | Weak | Claim trial/free/pro unlocks AI | Major abuse vector |
| Consent for Flowlary AI | Popup / correction readiness | Yes | Settings | Privacy | Gate | No | Local | Gate for correction | Indirect | No | Correction settings | No | Consent required for correction AI ready | N/A | All | Required | Setup state |

---

## Classification key (primary category)

Applied in `PHASE24_FEATURE_MATRIX.md`:

| Code | Category |
| --- | --- |
| A | FREE CORE UTILITY |
| B | AI-COST FEATURE |
| C | LEARNING FEATURE |
| D | PRACTICE FEATURE |
| E | DATA / EXPORT FEATURE |
| F | ACCOUNT / BILLING |
| G | FUTURE / UNCERTAIN |

---

## Notes

1. **No pro-only product features exist in shared entitlement policy today.** Learning, practice, export, progress, and activity are ungated. Only AI features share free/trial/pro + free balance.
2. **Website pricing claims** (“1 month free”, Lemon Squeezy, “higher managed-AI limits”) do not match enforcement. See `PHASE24_FULL_AUDIT.md`.
3. **“Trial · 2h”** is not a literal product constant. UI can show `Trial · 2h` when plan label is Trial and `remainingMs` formats as 2h — but during server trial, `remainingMs` is **trial clock remaining**, not AI balance. See usage model doc.
