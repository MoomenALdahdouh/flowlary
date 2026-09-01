# PHASE 25 — Pricing, Entitlement & Monetization Blueprint

**Status:** Audit + design only. No application code changed.  
**Date:** 2026-08-26  
**Source of truth:** Repository code and tests. Documentation is secondary when it conflicts with implementation.

## 1. Executive Summary

Flowlary already has the pieces of a strong monetized product, but they are not yet aligned into a single coherent pricing system.

What the code actually shows today:

- `Keyboard Layout Repair` and `Speed Box` are core local utilities and should remain permanently free.
- AI-backed features are `Writing Correction`, `Translation`, `Live Translation`, `Layout AI classification`, and `Practice Check`.
- Learning value is real: the product records `spelling`, `grammar`, and `wording` events with `detected`, `accepted`, and `rejected` actions.
- Current monetization enforcement is inconsistent: backend uses `Paddle`, a `7-day` registration trial, and a `2-hour` free latency budget, while website and extension copy still mention `1 month free` and `Lemon Squeezy`.
- Current Free is not a durable product plan. It is a one-time depleting AI allowance, not a refillable ongoing Free experience.
- Current Pro is mostly “same features + no debit + higher RPM,” which is not strong enough as a product story.

Recommended blueprint:

- **Free:** useful forever, with permanent local utilities and a refillable daily AI allowance.
- **Trial:** first 30 days should be full Pro experience, but only after server-side abuse holes are fixed.
- **Pro:** high everyday AI access plus the full learning system, practice, export/import, and advanced progress.

## 2. Actual Feature Inventory

| Category | Feature | Exact implementation location | User-facing location | Backend dependency | AI dependency | Model | API route | Local/server | Data stored | Learning impact | Current behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Core local utility | Keyboard layout auto-repair | `extension/src/features/layout/*`, `packages/shared/src/entitlement/index.ts` | Popup toggle, extension in-field, dashboard settings | Optional | Optional | `allam-2-7b` only for ambiguous classify | `/api/ai/layout-classification` when needed | Mostly local | Activity history as `FIX_LAYOUT` | None | Local remap always available |
| Core local utility | Layout manual shortcut | `extension/src/features/layout/*` | Popup quick action, shortcut | Optional | Optional | same | same | Mostly local | Activity history | None | Mostly local, AI only for ambiguous words |
| Core local utility | Speed Box | `extension/src/features/layout/speedBox.ts` | Extension overlay, settings | No | No | None | None | Local | None | None | Pure local conversion |
| Core local utility | Instant spelling | `extension/src/features/correction/*` | In-field direct correction path | No | No | None | None | Local | None | None | Local typo map |
| AI-cost | Writing Correction | `extension/src/features/correction/*`, `backend/src/providers/correctionProvider.ts` | Popup, dashboard, in-field card/direct mode | Yes | Yes | `llama-3.1-8b-instant` | `/api/ai/correction` | Server | Activity + learning events | Yes | Debounced AI correction |
| AI-cost | Manual Translation | `extension/src/features/translation/*`, `backend/src/providers/translationProvider.ts` | Popup quick action, shortcut | Yes | Yes | `openai/gpt-oss-120b` | `/api/ai/translation` | Server | Activity history | No | On-demand AI translation |
| AI-cost | Live Translation | `extension/src/features/translation/scheduler.ts`, `liveTranslate.ts` | Toggle in popup/settings | Yes | Yes | `openai/gpt-oss-120b` | `/api/ai/translation` | Server | Activity history | No | Debounced repeated AI translation |
| AI-cost | Layout AI classification | `extension/src/background/classify.ts`, `backend/src/providers/layoutClassifierProvider.ts` | Indirect | Yes | Yes | `allam-2-7b` | `/api/ai/layout-classification` | Server | Cache + usage log | No | Optional ambiguous-word assist |
| Learning | Learning profile | `extension/src/storage/learning/*` | Dashboard onboarding/settings/progress | No | No | None | None | Local | `flowlary.learning.profile` | Yes | Local learning profile |
| Learning | Learning events | `extension/src/features/learning/recordCorrectionLearning.ts`, `packages/shared/src/learningEvents.ts` | Dashboard progress | No | No | None | None | Local | `flowlary.learning.events` | Yes | Stores writing/practice mistake signals |
| Learning | Progress | `extension/src/storage/learning/progress.ts`, shared learning types | Dashboard progress | No | No | None | None | Local | Derived | Yes | Errors/100 words, trends, patterns |
| Practice | Practice sessions | `extension/src/dashboard/panels/PracticePanel.tsx` | Dashboard Practice | Yes for checking | Yes for checking | correction model | `/api/ai/correction` | Mixed | Sessions + learning events | Yes | AI-backed practice loop |
| Data/export | Activity history | `extension/src/storage/*history*` | Dashboard Activity | No | No | None | None | Local | capped entries | No | Stores `CORRECT`, `TRANSLATE`, `FIX_LAYOUT` |
| Data/export | Export | `extension/src/storage/data/export.ts` | Dashboard Data Control | No | No | None | None | Local | JSON export | Yes if learning included | Excludes tokens and secrets |
| Data/export | Import | `extension/src/storage/data/import.ts` | Dashboard Data Control | No | No | None | None | Local | Merges imported data | Yes if learning included | Learning/activity/settings import |
| Privacy/security | Pause / disable | popup and state manager paths | Popup, dashboard | No | No | None | None | Local | settings | No | Always available |
| Privacy/security | Reset / privacy controls | dashboard data/privacy panels | Dashboard | No | No | None | None | Local | destructive local actions | No | Always available |
| Account/billing | Register / login / refresh | `backend/src/services/accountService.ts`, `website/src/account/client.ts` | Website account, extension sign-in | Yes | No | None | `/api/auth/*` | Server | accounts, sessions | No | Registration starts trial |
| Account/billing | Entitlement resolve | `backend/src/services/accountService.ts`, `backend/src/middleware/auth.ts` | Account page, popup footer, dashboard | Yes | No | None | `/api/account/entitlement` | Server | account + subscription state | No | Server-authoritative for account JWT |
| Account/billing | Billing config / checkout / portal | `backend/src/billing/*`, `website/src/account/client.ts` | Website pricing/account | Yes | No | None | `/api/billing/*` | Server | subscription records | No | Backend ready; account UI still “prepared” |

## 3. Current Entitlement Audit

### KNOWN FROM CODE

- Plans: `free | trial | pro` in `packages/shared/src/account/types.ts`.
- `Keyboard Layout` local path is always allowed by `isLocalOnlyFeature()` in `packages/shared/src/entitlement/index.ts`.
- AI-gated features today are only:
  - `correction`
  - `translation`
  - `live_translation`
  - `layout_ai`
- There are **no feature-level plan gates yet** for:
  - learning
  - practice
  - export/import
  - progress
  - analytics

### Current account-JWT entitlement behavior

`backend/src/services/accountService.ts`:

- `trial` is allowed while `trialEndsAt > now`
- `free` is allowed while `usageBalanceMs > 0`
- `pro` is granted only by verified subscription state
- `suspended` is denied

### Current install-token behavior

`backend/src/middleware/auth.ts` allows install-token traffic with any non-anonymous client claim to enter as `free` tier:

- `allowed = Boolean(clientClaim && clientClaim !== 'anonymous')`
- `rateLimitTier = allowed ? 'free' : 'anonymous'`
- `accountId = null`

This means install-token AI access is not tied to server-side account usage balance.

### Blueprint conclusion

Future implementation must support a fuller feature-level entitlement model:

- `keyboard.unlimited`
- `speedbox.unlimited`
- `ai.correction`
- `ai.translation`
- `ai.liveTranslation`
- `ai.layoutClassify`
- `learning.basic`
- `learning.full`
- `practice.full`
- `learning.export`
- `learning.import`
- `progress.advanced`

## 4. Current Usage Audit

### KNOWN FROM CODE

Shared account constants:

- `ACCOUNT_FREE_BALANCE_MS = 2 * 60 * 60 * 1000`
- `ACCOUNT_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000`

Rate limits in `backend/src/middleware/rateLimit.ts`:

- anonymous: `10/min/op`
- free: `30/min/op`
- trial: `60/min/op`
- pro: `120/min/op`

Usage debit in `backend/src/services/accountService.ts`:

- On successful AI call for `free` account:
  - `usageBalanceMs -= max(latencyMs, 1)`
- Trial and Pro do not debit this balance.
- Failed AI calls do not debit.

### Documentation claim vs actual behavior

| Current claim | Actual code behavior | Required blueprint rule |
| --- | --- | --- |
| “2 hours” reads like user time | It is a latency-ms budget | Do not expose latency ms to users |
| Free sounds ongoing | Free AI does not reset | Free must reset on a clear schedule |
| Trial sounds like first month | Trial is 7 days | Trial copy must match real duration |

### Blueprint verdict

The current latency budget is acceptable as an internal transitional mechanism, but it is not acceptable as the final user-facing usage model.

## 5. Current Trial Audit

### KNOWN FROM CODE

From `backend/src/services/accountService.ts`:

- Trial starts on account registration
- Trial plan is `trial`
- Trial duration is `7 days`
- Trial also seeds `usageBalanceMs = 2h` for post-trial Free
- During trial, AI is allowed and not debited

### Current trial problems

1. It does not match the desired “first 30 days” product.
2. It is server-authoritative only for account users, not install-token users.
3. It is vulnerable to multi-account abuse.
4. Marketing says `1 month free` even though code says `7 days`.

### DESIGN TARGET

Trial should become:

- `30 days`
- full Pro experience
- server-authoritative
- account-based
- protected against obvious abuse vectors

## 6. Cost Model

### KNOWN FROM CODE

Models:

- Correction / Practice: `llama-3.1-8b-instant`
- Translation / Live: `openai/gpt-oss-120b`
- Layout classify: `allam-2-7b`

### REQUIRES EXTERNAL PRICING

Exact launch pricing for these models is not stored in repo and must be confirmed from the live provider at implementation time.

### Relative cost ranking from architecture

Even without inventing prices, the code supports this cost ordering:

1. `Layout AI classify` is probably cheapest per request due to small scope
2. `Correction` / `Practice Check` are lower-cost than translation
3. `Translation` is materially more expensive than correction
4. `Live Translation` is highest risk because it uses translation economics at repeated frequency

### Live Translation risk

`extension/src/features/translation/scheduler.ts`:

- `LIVE_PAUSE_MS = 750`

So the theoretical ceiling in 30 minutes is:

- `30 * 60 * 1000 / 750 = 2400` timer firings

Not every timer firing becomes a billable request because of cancellation, dedupe, and cache, but the feature is still the main cost-abuse risk.

## 7. Free Plan Recommendation

### Principle

Free must be:

- useful forever
- clear
- sustainable
- a real product

### FREE FOREVER

- Keyboard Layout Repair
- Speed Box
- instant local functionality
- pause/disable
- privacy controls
- reset/delete
- basic field safety
- basic local operation

### FREE LIMITED

- Writing Correction
- Translation
- Live Translation
- Layout AI classify
- Practice Check

### Recommended Free AI model

Use **shared weighted daily credits**.

Recommended design:

- Correction = `1 credit`
- Layout AI classify = `1 credit`
- Practice Check = `1 credit`
- Translation = `2 credits`
- Live Translation = `2 credits`

These weights are a **DESIGN TARGET**, not current code.

### Why this is better than the current 2-hour model

- clearer to users
- easier to message
- easier to reset
- more proportional to real product value
- easier to constrain live translation risk

### Recommended reset

Daily reset is the cleanest first implementation target.

Why not monthly first:

- harder for users to reason about
- easier to make Free feel dead mid-month
- weaker conversion rhythm for an everyday writing tool

## 8. Pro Plan Recommendation

Pro must not be “Free with a slightly bigger number.”

### Pro should include

- high everyday AI allowance
- full learning history
- recurring mistake analysis
- advanced progress
- full practice
- learning export/import
- better long-term analytics

### Why users would pay

- they use correction and translation every day
- they want Live Translation without rationing
- they want to learn from their own mistakes over time
- they want practice that is tailored to their real writing
- they want to keep and move their learning record

### Do not claim

- unlimited AI
- unlimited translation
- unlimited live translation

RPM and cost controls still exist.

## 9. Trial Recommendation

### Current

- 7 days
- full AI
- no debit
- account registration starts it

### DESIGN TARGET

Make Trial:

- 30 days
- full Pro experience
- same core benefits as Pro
- no confusing downgrade shock

### Trial end behavior

When Trial ends:

- user drops to Free
- local utilities remain available
- Free daily AI limits begin
- learning does not disappear, but advanced features can be restricted

## 10. AI Credit Model

### Compared options

| Model | User clarity | Cost control | Fairness | Live risk control | Blueprint verdict |
| --- | --- | --- | --- | --- | --- |
| Latency ms | Poor | Weak | Weak | Weak | Reject as user-facing model |
| Request counts | Good | Medium | Medium | Weak unless weighted | Not preferred |
| Flat credits | Good | Medium | Medium | Weak unless weighted | Better |
| Weighted credits | Good | Strong | Stronger | Strong | **Recommend** |
| Monthly quota | Medium | Strong | Medium | Strong | Secondary cap only |
| Rolling 24h | Medium | Strong | Strong | Strong | OK but more complex than daily reset |

### Final recommendation

Use:

- daily weighted credits for Free
- larger daily allowance for Trial
- high daily allowance plus soft monthly cap for Pro

## 11. Learning Monetization Model

### KNOWN FROM CODE

`packages/shared/src/learningEvents.ts` stores:

- `category`: `spelling | grammar | wording`
- `action`: `detected | accepted | rejected`
- `source`: `writing | practice`
- `original`
- `corrected`
- timestamp and sample metadata

### Audit conclusion

Learning is based on real correction events and practice. It is not polluted by:

- translation
- layout repair
- Speed Box

That makes learning a legitimate Pro differentiator.

### Recommended split

Free:

- basic awareness
- recent mistakes
- simple progress summary

Pro / Trial:

- full history
- recurring patterns
- advanced progress
- targeted practice
- long-term learning value

## 12. Practice Monetization Model

### KNOWN FROM CODE

`extension/src/dashboard/panels/PracticePanel.tsx` uses the correction pipeline to check user writing and records practice learning events.

### Blueprint

Free:

- optional teaser access
- limited short practice

Pro / Trial:

- full practice
- full targeted sessions
- recurring-pattern review

Practice is a real AI-cost + learning-value feature, so it belongs inside the Pro story.

## 13. Export/Import Model

### KNOWN FROM CODE

`extension/src/storage/data/export.ts` exports:

- settings
- correction settings with secrets stripped
- translation settings
- layout settings
- learning profile
- learning events
- practice sessions
- activity

It excludes:

- auth tokens
- install token
- refresh token
- access token
- session id
- license key
- `gsk_` secrets
- legacy BYOK keys

### Blueprint

Never paywall:

- deletion
- reset
- privacy controls

Strong Pro candidate:

- learning export/import

Optional, not primary:

- broader activity export

## 14. Pricing Recommendation

### Candidate monthly prices

| Price | Positioning | Margin tolerance | Conversion friction | Blueprint view |
| --- | --- | --- | --- | --- |
| $7 | aggressive | weakest | lowest | viable only with strict caps |
| $9 | balanced | strong | moderate | **primary recommendation** |
| $12 | premium | stronger | higher | possible later |
| $15 | premium-plus | strongest | highest | too early today |

### Candidate annual prices

| Price | Equivalent monthly | View |
| --- | --- | --- |
| $84 | $7.00 | aggressive |
| $90 | $7.50 | **recommended annual** |
| $108 | $9.00 | weak annual incentive |
| $120 | $10.00 | too small discount |

### Final recommendation

- **PRIMARY PRICE:** `$9 / month`
- **SECONDARY PRICE:** `$12 / month` only if Pro later becomes substantially richer
- **ANNUAL PRICE:** `$90 / year`

These remain design recommendations. Live provider and payment-fee economics still need confirmation.

## 15. Final Free vs Pro Matrix

See `PHASE25_PRICING_MATRIX.md` for the definitive matrix.

Headline:

- Free keeps local utility forever
- Trial unlocks full experience
- Pro unlocks everyday AI and the full learning system

## 16. Exhaustion UX

### Free AI exhausted

> You’ve reached today’s Free AI limit.  
> Keyboard Layout Repair and other local tools still work.  
> AI access resets tomorrow.  
> Upgrade to Pro for higher everyday limits.

### Trial expired

> Your full Trial has ended.  
> Flowlary still includes Keyboard Layout Repair, Speed Box, and Free AI limits.  
> Upgrade to Pro to keep the full learning and everyday AI experience.

### Pro quota reached

> You’ve reached your current Pro AI limit.  
> Local tools remain available.  
> Access will reset on the next billing usage window.

### API unavailable

> Flowlary AI is temporarily unavailable.  
> Keyboard Layout Repair and local tools still work.

### Account unavailable

> We couldn’t confirm your account right now.  
> Local tools still work. Sign in again to restore account-based AI access.

### Payment failed

> There’s a billing issue on your Pro plan.  
> Your subscription is being retried. Check billing to avoid interruption.

### Subscription cancelled

> Your subscription will end at the current billing period.  
> Pro remains active until then.

## 17. Account/Billing State Model

### States from code and required blueprint

| State | Meaning | Source |
| --- | --- | --- |
| Free | limited account AI + local features | code today |
| Trial | time-limited full experience | code today, but duration wrong for target |
| Pro | verified subscription grants access | code today |
| Expired | former subscriber after end date | billing view supports this |
| Cancelled | Pro until period end | code today |
| Payment failed / past_due | temporary billing issue, still Pro during dunning | code today |
| Suspended | denied | code today |

### Inconsistency risks

- website pricing says `Lemon Squeezy`, backend is `Paddle`
- website and extension say `1 month free`, backend says `7 days`
- account UI says billing is still being prepared while backend billing helpers already exist
- install-token path can diverge from account-based entitlement enforcement

## 18. Abuse Prevention

### Current abuse risks

1. multi-account trial abuse
2. install-token AI access without account-side usage debit
3. in-memory RPM only
4. reinstall / fresh install id churn
5. client-side claim drift
6. live translation repeated triggering

### Blueprint enforcement rule

All monetization-critical logic must be server-side:

- AI credits
- trial status
- Pro entitlement
- reset windows
- downgrade timing
- export/import entitlement

Client checks are UX only.

## 19. Cross-Surface Consistency Audit

| Current claim | Actual behavior | Required change |
| --- | --- | --- |
| “1 month free” on pricing | trial constant is 7 days | align copy or change implementation later |
| `Lemon Squeezy` on website pricing | backend billing is Paddle | replace all payment-provider copy with Paddle or generic wording |
| Free includes correction/translation/live without clear numbers | Free uses depleting latency budget + RPM | publish clear Free AI limits |
| Account page says billing is being prepared | backend checkout/portal helpers exist | align account surface with real readiness state |
| “Higher managed-AI limits” | no concrete published limits | define one source-of-truth plan table |
| popup/account usage time | `remainingMs` means different things by plan | move to credits/reset language |

## 20. Implementation Requirements

This is a blueprint section, not implementation.

Future implementation must:

1. replace latency-ms user-facing usage with credits
2. add feature-level entitlements for learning/practice/export/progress
3. retire or meter install-token managed AI access
4. align all pricing copy with backend truth
5. make trial duration and marketing match exactly
6. define a single plan matrix shared by website, extension, dashboard, and support
7. add server-side reset logic
8. add explicit exhaustion states and copy
9. add soft Pro monthly caps without claiming unlimited
10. confirm live provider prices before hard-coding quota numbers

## 21. Risks

- Trial abuse can destroy unit economics
- Live Translation can dominate AI cost
- mismatched copy harms trust
- Pro may feel weak if learning and practice remain mostly free
- current in-memory rate limiting is not durable enough for serious billing enforcement

## 22. Open Questions

1. What are the exact live Groq prices for the shipped model IDs at launch time?
2. Is `allam-2-7b` still the final layout classifier model in production?
3. Should Free Practice be teaser-only or 1 short session/day?
4. Should Activity remain capped equally for all plans or expand modestly for Pro?
5. Should Trial require explicit AI consent before starting the full-Pro clock?
6. Should Pro have only daily limits, or daily plus soft monthly protection?

## Final Blueprint Verdict

| Area | Verdict |
| --- | --- |
| Product readiness | **PARTIAL** |
| Monetization readiness | **BLOCKED** |
| Usage metering | **PARTIAL** |
| Entitlement architecture | **PARTIAL** |
| Trial architecture | **PARTIAL** |
| Learning differentiation | **PASS** |
| Cost-control readiness | **BLOCKED** |

The monetization blueprint is clear: keep the local writing utility permanently free, make Free refillable and useful, make Trial a true full-product experience, and make Pro the full everyday AI + learning system. Future implementation should follow this document exactly.
