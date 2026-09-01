# PHASE 26 — Final Monetization, Entitlement, Usage & UX Blueprint

**Status:** Audit + design only. No application code changed.  
**Date:** 2026-08-26  
**Repository truth priority:** code and tests first, docs second.

## Executive Summary

This document is the final decision layer for Flowlary monetization and monetization UX.

Final direction:

- **Free** remains useful forever.
- **Keyboard Layout Repair** is **free forever**.
- **Speed Box** is **free forever**.
- **Privacy, safety, pause, reset, and local functionality** are **free forever**.
- **Trial** should become a real first-month experience, but must not be marketed that way until backend truth matches.
- **Pro** must combine two values:
  - everyday AI assistance
  - long-term language improvement

Current repository truth still has major mismatches:

- backend trial is **7 days**, not 30 days
- backend free AI is a **2-hour latency budget**, not a daily quota
- backend billing is **Paddle**
- website and extension copy still mention **1 month free** and **Lemon Squeezy**
- install-token auth still allows AI access outside proper account-side usage debit

Final recommendation:

- keep local utilities permanently free
- move to **daily weighted AI credits**
- make **30-day full Trial** the product target
- make **Pro** the full learning + practice + high-everyday-AI plan
- use **$9/month** and **$90/year** as the final pricing recommendation

## 1. CURRENT_STATE

| Area | Current behavior | Classification | Evidence |
| --- | --- | --- | --- |
| Plans | `free | trial | pro` | KNOWN FROM CODE | `packages/shared/src/account/types.ts` |
| Registration trial duration | `7 days` | KNOWN FROM CODE | `ACCOUNT_TRIAL_DURATION_MS` |
| Free AI allowance | `2 * 60 * 60 * 1000` latency-ms balance | KNOWN FROM CODE | `ACCOUNT_FREE_BALANCE_MS` |
| Free usage debit | debits successful free AI requests by `latencyMs` | KNOWN FROM CODE | `backend/src/services/accountService.ts` |
| Trial debit | no free-balance debit during trial | KNOWN FROM CODE | same |
| Pro grant | only from verified subscription state | KNOWN FROM CODE | `resolveServerEntitlementForAccount()` |
| Billing backend | Paddle | KNOWN FROM CODE | `backend/src/billing/*` |
| Billing marketing copy | Lemon Squeezy still named | KNOWN FROM CODE | `website/src/i18n/en.ts`, `ar.ts`, pricing test |
| Website trial claim | “1 month free” | KNOWN FROM CODE | website pricing and popup account i18n |
| Account page billing UX | “Billing is being prepared” | KNOWN FROM CODE | `website/src/pages/Account.tsx` |
| Popup limit copy | generic usage limit lock state | KNOWN FROM CODE | `extension/src/popup/status.ts` |
| Keyboard layout local path | always allowed | KNOWN FROM CODE | `packages/shared/src/entitlement/index.ts` |
| Speed Box | local only | KNOWN FROM CODE | extension layout module |
| Live translation debounce | `750ms` | KNOWN FROM CODE | `extension/src/features/translation/scheduler.ts` |
| Live translation max theoretical timer firings in 30m | `2400` | CALCULATED | `30*60*1000/750` |
| Correction model | `llama-3.1-8b-instant` | KNOWN FROM CODE | `packages/shared/src/ai/models.ts` |
| Translation/live model | `openai/gpt-oss-120b` | KNOWN FROM CODE | same |
| Layout classify model | `allam-2-7b` | KNOWN FROM CODE | same |
| Exact live Groq pricing for shipped models | not stored in repo | REQUIRES EXTERNAL VERIFICATION | provider-side |
| Learning signal categories | `spelling | grammar | wording` | KNOWN FROM CODE | `packages/shared/src/learningEvents.ts` |
| Learning sources | `writing | practice` | KNOWN FROM CODE | same |
| Translation counted as learning | no | KNOWN FROM CODE | learning pipeline only records correction/practice |
| Layout counted as learning | no | KNOWN FROM CODE | same |
| Export strips tokens/secrets | yes | KNOWN FROM CODE | `extension/src/storage/data/export.ts` |

## 2. Final Product Feature Map

| Feature | User value | Local or AI | Cost to Flowlary | Learning value | Retention value | Identity feature | Conversion feature | Premium differentiator | Final plan role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Keyboard Layout Repair | fixes wrong-layout typing immediately | Mostly local | negligible | none | high | **yes** | yes | no | **Free forever** |
| Layout manual shortcut | manual rescue action | Mostly local | negligible unless classify | none | medium | yes | yes | no | **Free forever** |
| Speed Box | manual layout conversion | local | negligible | none | medium | **yes** | yes | no | **Free forever** |
| Instant local spelling help | immediate local assist | local | negligible | low | medium | yes | yes | no | **Free forever** |
| Writing Correction | core AI writing help | AI/server | meaningful | high | high | yes | yes | yes | Free limited / Trial full / Pro high |
| Manual Translation | useful bilingual support | AI/server | meaningful | none | medium | no | yes | yes | Free limited / Trial full / Pro high |
| Live Translation | high-value bilingual workflow | AI/server | high | none | medium-high | no | yes | yes | Free limited / Trial full / Pro high |
| Layout AI classify | better ambiguous layout repair | AI/server | low-medium | none | low | supports identity | low | no | bundled into AI credits |
| Learning Profile | learning context | local | negligible | high | high | yes | indirect | yes | basic Free / full Trial+Pro |
| Learning Events | mistake history | local | negligible | high | high | yes | indirect | **yes** | basic Free / full Trial+Pro |
| Progress | “am I improving?” | local | negligible | high | high | yes | indirect | yes | basic Free / advanced Trial+Pro |
| Practice sessions | structured improvement | mixed | meaningful | high | high | yes | yes | **yes** | teaser Free / full Trial+Pro |
| Activity | visibility into operations | local | negligible | low | medium | no | low | low | basic Free forever |
| Export / Import | portability of learning | local | negligible | high | high | no | medium | yes | Pro + Trial |
| Pause / disable | agency and safety | local | negligible | none | trust | **yes** | no | no | **Free forever** |
| Privacy / reset | trust and control | local | negligible | none | trust | **yes** | no | no | **Free forever** |
| Account | sync + plan identity | server | low | indirect | medium | no | yes | no | all plans |
| Billing / subscription | paid continuity | server | ops | none | medium | no | yes | no | Pro |

## 3. Final Free Plan

### Free forever

- Keyboard Layout Repair
- Layout manual shortcut
- Speed Box
- instant local spelling assistance
- pause / disable
- privacy controls
- reset / deletion
- safety protections
- local operation
- basic activity visibility

### Free limited

- Writing Correction
- Manual Translation
- Live Translation
- Layout AI classification
- Practice Check
- deeper learning history
- advanced progress
- learning export/import

### Why Free must change

The current user-facing “2 hours” concept is not acceptable because it is not really user time. It is a latency debit bucket. That is:

- hard to explain
- hard to trust
- not aligned with perceived value
- not aligned with cost by feature
- not a durable forever-Free model

### Final Free usage model

**Use daily weighted AI credits.**

This is the final recommendation.

## 4. AI Credit Economics

### Current AI operations

| Operation | Model | Relative cost | Frequency risk | Final weight |
| --- | --- | --- | --- | --- |
| Writing Correction | `llama-3.1-8b-instant` | lower | medium-high | `1` |
| Layout AI classify | `allam-2-7b` | likely low | low | `1` |
| Practice Check | correction model | lower-medium | medium | `1` |
| Manual Translation | `openai/gpt-oss-120b` | high vs correction | low-medium | `2` |
| Live Translation | `openai/gpt-oss-120b` | high | **very high** | `2` |

### Why these weights

These are a design recommendation from actual architecture:

- correction and practice use the cheaper core writing model path
- translation and live translation use the more expensive translation model
- live is not weighted above `2` initially because daily caps and RPM already provide an additional guardrail
- layout AI is small and should not distort the free experience

### Pricing truth status

- exact live provider prices for all models are **REQUIRES EXTERNAL VERIFICATION**
- relative cost ordering above is still valid from code structure and model selection

## 5. Final Free Quota

### FINAL RECOMMENDATION

**40 credits/day**

### Exact behavior

| Rule | Decision |
| --- | --- |
| Reset time | daily at **00:00 UTC** |
| Timezone behavior | server stores UTC reset; client localizes display |
| Rollover | no rollover |
| Unused credits | expire at daily reset |
| At zero | AI features stop; local tools continue |
| Practice Check | consumes credits |
| Layout AI classify | consumes credits |
| Live Translation | weight `2` |
| Translation | weight `2` |

### Why 40/day

This is the cleanest concrete starting point:

- generous enough for meaningful daily Free correction use
- enough room for some translation
- still bounded enough to protect margins
- easy to communicate
- much clearer than milliseconds

Illustrative equivalents:

- 40 corrections/day
- 20 translations/day
- or a mix, such as 24 corrections + 8 translations

## 6. Final Trial Design

### FINAL RECOMMENDATION

**30 days full Pro experience**

### Start condition

Trial should start on **successful account registration**.

AI consent should not be the legal/accounting source of truth for trial start. Consent affects whether AI is usable, not whether the account exists.

### Trial rules

| Rule | Final decision |
| --- | --- |
| Duration | `30 days` |
| Starts | account registration |
| Plan label | `Trial` |
| Entitlements | full Pro capabilities |
| AI credits | Pro-level daily credits during trial |
| Learning | full |
| Practice | full |
| Export/import | full |
| Downgrade on end | automatic to Free |
| Reinstall reset | no |
| Device switch | same account keeps same trial |
| Browser profile switch | same account keeps same trial |

### Abuse protection

Practical protections:

1. server-authoritative trial by `accountId`
2. install-token path must not bypass account-side metering
3. registration abuse rate limits
4. simple duplicate-signal checks later if needed

### Marketing rule

The UI may say “30-day full experience” only when backend truth is actually around 30 days.

## 7. Final Pro Plan

### Pro value pillars

1. **High everyday AI limits**
2. **Full learning**
3. **Full practice**
4. **Portable learning data**

### What makes Pro materially better

- higher everyday correction volume
- higher translation and live translation access
- full learning history
- recurring mistake analysis
- advanced progress
- targeted practice
- learning export/import

### Honest positioning

Approved direction:

- “High everyday AI limits”
- “Full learning”
- “Advanced progress”
- “Targeted practice”

Do not use:

- “Unlimited AI”
- “Unlimited translation”
- “Unlimited live translation”

## 8. Final Pricing

| Monthly price | Perceived value | Friction | Margin room | Positioning | Verdict |
| --- | --- | --- | --- | --- | --- |
| $7 | attractive but may underprice learning + live risk | low | weakest | entry | not final |
| **$9** | strong value-to-price fit | moderate | good | mainstream premium utility | **FINAL RECOMMENDATION** |
| $12 | stronger premium signal | higher | stronger | premium writer tool | possible later |
| $15 | too early for current product maturity | highest | strongest | premium-plus | not recommended now |

### FINAL RECOMMENDATION

- **Monthly:** `$9`
- **Annual:** `$90`

Why `$9` still holds:

- current product is richer than a single-purpose AI helper
- learning and practice justify paying above commodity utility pricing
- still low enough to reduce conversion friction
- aligns with previous internal direction without relying on it blindly

## 9. Final Plan Matrix Summary

See `PHASE26_FINAL_PLAN_MATRIX.md`.

Headline:

- Free = permanent core + daily AI allowance
- Trial = full product for 30 days
- Pro = full product for everyday use

## 10. Final Entitlement Architecture

### Final capability model

```text
keyboard.unlimited
speedbox.unlimited
local.spellAssist
privacy.controls
extension.pause

ai.correction
ai.translation
ai.liveTranslation
ai.layoutClassify

learning.basic
learning.full
practice.basic
practice.full
learning.export
learning.import
progress.basic
progress.advanced
activity.basic
activity.extended
```

### Final account states

| State | Meaning | Allowed |
| --- | --- | --- |
| FREE | permanent useful plan | local core + limited AI + basic learning |
| TRIAL | temporary full experience | full Pro capability |
| PRO | active paid plan | full product |
| EXPIRED | former Trial or post-cancel state now on Free | Free capability |
| CANCELLED | paid but will end at period end | Pro until end date |
| PAST_DUE | payment retry/dunning | Pro during retry window |
| SUSPENDED | blocked | local-only safe subset if desired, no account AI |

### Authority rule

The server is authoritative for:

- plan
- trial window
- daily credits
- resets
- Pro access
- export/import access
- downgrade timing

Client entitlement is UX only.

## 11. Final Usage System

### Final conceptual schema

```text
accountId
plan
trialEndsAt
subscriptionEndsAt
dailyCredits
dailyCreditsUsed
dailyResetAt
monthlySoftCap
monthlyCreditsUsed
lastUsageAt
entitlementVersion
```

### Behavior rules

| Situation | Final behavior |
| --- | --- |
| Multiple devices | shared credits by account |
| Multiple browser profiles | shared credits by account |
| Reinstall | no quota reset if same account |
| Logout/login | account state restored from server |
| Account switching | active account determines credits |
| Trial expiration | auto-downgrade to Free at expiry |
| Subscription cancelled | Pro until subscription end |
| Payment failure | temporary Pro during retry window, then downgrade if unresolved |

### Final Pro soft cap

**Final recommendation:** keep the same weighted system, but with a high monthly protection cap.

Recommended first cap:

- **1,500 weighted credits/month** for Pro soft protection

Purpose:

- not a user-marketed ceiling
- internal fairness and cost guardrail
- prevents true “unlimited” abuse

## 12. Abuse Prevention

### Main risks

- multi-account trials
- install token AI path
- reinstall churn
- client entitlement tampering
- live translation repeated requests
- burst abuse via RPM resets or multiple identities

### Final protection priorities

1. remove client/bearer ambiguity from billing authority
2. meter all AI against server account state
3. keep RPM as burst protection
4. enforce daily credits centrally
5. lock trial to account record
6. monitor live translation volume

### Practical not over-engineered protections

- require account for managed AI in production
- keep local utilities account-free
- server-side daily reset
- per-account usage ledger
- registration rate limits

## 13. UI/UX Decision Layer

Monetization UX is part of the product, not an afterthought.

### Visual system

Preserve the current `Glass Blur Snow` direction:

- glass surfaces
- restrained blur
- snow/light atmosphere
- strong typography
- subtle depth
- calm motion
- accessible contrast

Do not introduce:

- generic SaaS admin styling
- crypto/gaming/neon visuals
- aggressive red paywall states

## 14. Website Pricing UX

### Final page structure

1. Hero: what Flowlary is
2. Two-card pricing section: Free / Pro
3. Trial explainer strip
4. concise feature comparison
5. learning value section
6. AI usage explanation
7. FAQ
8. privacy/trust footer

### CTA hierarchy

- primary: install / get Flowlary
- secondary: create account
- tertiary: upgrade to Pro

### Final messaging goals

The page must answer quickly:

- what is Flowlary?
- what stays free forever?
- what does Pro add?
- how does the trial work?

## 15. Popup IA

The popup must stay compact.

### Final popup contents

- system status
- current plan
- daily AI usage
- reset time
- core feature toggles
- quick actions
- upgrade CTA only when relevant

### Must not appear in popup

- large pricing tables
- long billing explanations
- deep analytics
- long onboarding copy

## 16. Dashboard IA

### Final structure

- Overview
- Progress
- Practice
- Settings
- Privacy
- Account

Activity stays under:

- `Settings → Data → Activity`

### Section jobs

| Section | Question it answers |
| --- | --- |
| Overview | What is my status and what should I do next? |
| Progress | Am I improving? |
| Practice | What should I practice? |
| Settings | How does Flowlary behave? |
| Privacy | What is stored and how do I control it? |
| Account | What plan am I on and what happens with billing? |

## 17. Learning UX

### Free

- basic recent mistakes
- simple progress
- basic insight

### Pro / Trial

- recurring mistakes
- deeper trends
- targeted practice
- full history
- long-term progress

### Hard rule

Do not count:

- translation
- layout fixes
- Speed Box

as learning mistakes or learning progress.

## 18. Final Limit UX

### Approved status categories

- Healthy
- Low allowance
- Exhausted
- Unavailable
- Error
- Paused
- Upgrade opportunity

Do not use alarming destructive styling for normal quota exhaustion.

## 19. Approved Microcopy

### Approved

- Free AI
- Daily AI allowance
- Resets tomorrow
- High everyday AI limits
- Full learning
- Advanced progress
- Targeted practice
- Trial ends in X days
- Keyboard Layout Repair remains available

### Banned

- Unlimited
- 1 month free
- Billing ready
- Checkout available
- Lemon Squeezy
- Paddle
- Groq
- BYOK
- vague “more AI”

Provider names should not appear in user-facing monetization UX.

## 20. Onboarding Flow

Final flow:

1. Welcome
2. What do you want to improve?
3. Learning language
4. Current level
5. Translation languages
6. Keyboard layouts
7. Writing preferences
8. Ready

Only after backend truth supports it:

- “Your 30-day full experience has started”

Do not expose provider setup or technical AI settings during onboarding.

## 21. Responsive + Accessibility Rules

Apply to website, dashboard, account, and popup proposals:

- 44px minimum target size
- visible focus states
- keyboard navigation
- screen-reader labels
- reduced-motion support
- no color-only meaning
- clear loading states
- no layout shift
- no overflow in popup width constraints

## 22. PHASE 26 FINAL DECISIONS

1. **Final Free plan:** permanent local core + basic learning + 40 weighted AI credits/day  
2. **Final Trial:** 30 days full product, account-based  
3. **Final Pro:** full learning, full practice, export/import, high everyday AI  
4. **Final price:** `$9/month`  
5. **Final annual price:** `$90/year`  
6. **Final daily credits:** `40/day` on Free  
7. **Final operation weights:** correction `1`, layout AI `1`, practice `1`, translation `2`, live `2`  
8. **Final reset behavior:** no rollover, reset at `00:00 UTC`, client localizes time  
9. **Final Pro soft cap:** `1,500 weighted credits/month` soft protection  
10. **Final entitlement capabilities:** see section 10  
11. **Final dashboard IA:** Overview / Progress / Practice / Settings / Privacy / Account  
12. **Final popup IA:** status, plan, AI allowance, quick actions, compact upgrade message  
13. **Final pricing page UX:** hero, Free/Pro cards, trial explainer, comparison, learning value, FAQ  
14. **Final onboarding flow:** product-first, monetization-second, no technical setup  
15. **Final limit UX:** calm informative messages, local tools stay available  
16. **Final approved microcopy:** see section 19  
17. **Final migration requirements:** replace latency budget model, add feature entitlements, align copy  
18. **Final backend requirements:** server-side credits, trial truth, reset truth, install-token fix  
19. **Final frontend requirements:** shared plan copy, usage display, limit states, identical cross-surface truth  
20. **Final tests required:** plan truth, copy truth, reset logic, trial downgrade, usage exhaustion, export gating, learning integrity, billing-state sync

## 23. Final Quality Check

This blueprint satisfies the Phase 26 quality bar:

- Free is useful forever
- Keyboard Layout Repair is free forever
- Speed Box is free forever
- privacy/safety/pause/reset are free forever
- AI has clear limits
- Trial and marketing must match
- Pro has real value beyond Free
- learning is a real differentiator
- practice supports learning
- translation does not pollute learning
- layout does not pollute learning
- export/import has clear entitlement
- no unlimited claims
- server is monetization authority
- popup remains compact
- dashboard remains the deeper product
- Glass Blur Snow remains the visual foundation

## Final Verdict

| Area | Verdict |
| --- | --- |
| Monetization blueprint readiness | **PASS** |
| Current implementation alignment | **PARTIAL** |
| Next implementation phase clarity | **PASS** |

Phase 26 should be treated as the final monetization and UX decision source before implementation.
