# PHASE 24 — Full Product + Usage + Entitlement + Monetization Audit

**Status:** AUDIT ONLY — no implementation  
**Date:** 2026-08-26  
**Rule:** Code is source of truth. Assumptions are labeled. Prior phase reports used only for cross-check.

Companion docs:

- [PHASE24_FEATURE_INVENTORY.md](./PHASE24_FEATURE_INVENTORY.md)
- [PHASE24_FEATURE_MATRIX.md](./PHASE24_FEATURE_MATRIX.md)
- [PHASE24_USAGE_MODEL.md](./PHASE24_USAGE_MODEL.md)
- [PHASE24_COST_MODEL.md](./PHASE24_COST_MODEL.md)
- [PHASE24_PRICING_PROPOSAL.md](./PHASE24_PRICING_PROPOSAL.md)

---

## Executive verdict

| Gate | Verdict |
| --- | --- |
| PRODUCT READINESS | **PARTIAL** — Core product works; learning/practice exist; monetization surfaces disagree |
| MONETIZATION READINESS | **BLOCKED** — Pricing copy ≠ enforcement; checkout dead-end; install-auth bypass |
| USAGE METERING | **PARTIAL** — Server latency-budget works for account free; not token-based; trial uncapped; install-auth not metered |
| ENTITLEMENT SYSTEM | **PARTIAL** — Account JWT path solid for free/trial/pro; no feature-level Pro differentiators; dual client/server worlds |
| TRIAL | **PARTIAL** — Real = **7 days** registration trial; marketing says **1 month**; not “first month full Pro experience” |
| LEARNING | **PASS** (product) / **PARTIAL** (monetization) — Real writing-mistake signals exist; not paywalled; not polluted by translation/layout |
| AI COST CONTROL | **BLOCKED** for launch — Trial uncapped cost; install-auth uncapped; Pro uncapped; live translation high risk |

---

## 0. Product principle (confirmed against code)

Flowlary is a Chrome writing companion with mixed cost classes:

| Class | Examples in code | Cost to Flowlary |
| --- | --- | --- |
| Local utility | Layout auto remap, Speed Box, instant spell, pause, privacy | Near zero |
| AI-cost | Correction, translation, live translation, layout classify, practice Check | Groq tokens + latency |
| Learning | LearningEvents, Progress, profile | Local storage only |
| Practice | Practice sessions using correction API | AI cost when checking |
| Activity | History of CORRECT / TRANSLATE / FIX_LAYOUT | Local storage |
| Account / billing | Register, JWT, Paddle webhook | Ops cost |

**Keyboard layout repair must remain free forever** — code already treats `layout_auto` as local-only and always allowed (`packages/shared/src/entitlement/index.ts`).

**Learning from real writing** is implemented and is the strongest unpaid differentiator sitting ungated today.

---

## 1. Absolute rule compliance

This phase:

- Did **not** modify source code, plans, prices, entitlements, quotas, UI, storage, API, billing, or Lemon integration.
- Output is documentation under `docs/monetization/` only.

---

## 2. Repository audit method

Inspected:

- `extension/` — features, entitlement client, popup, dashboard, storage, learning, practice
- `website/` — pricing i18n, account, paddle helpers, tests locking Lemon copy
- `backend/` — auth, entitlement, usage debit, gateway, providers, rate limits, Paddle billing, store
- `packages/shared/` — account constants, entitlement policy, models, learning, export schema
- `tests/` — phase17 account, phase20 billing, entitlement policy
- `docs/production/` — PHASE17 / PHASE20 cross-check only
- Config: `backend/.env.example`, model IDs, rate limit constants

Searched concepts: plan, free, pro, trial, entitlement, usage, quota, limit, cooldown, rate limit, correction, translation, live translation, keyboard, speed box, history, learning, practice, export, import, subscription, billing, checkout, Paddle, Lemon, webhook.

---

## 3–4. Product inventory & classification

See **PHASE24_FEATURE_INVENTORY.md** and **PHASE24_FEATURE_MATRIX.md**.

Summary classification:

| Category | Features |
| --- | --- |
| A FREE CORE UTILITY | Layout auto, Speed Box, instant spell, pause, privacy/reset, field safety |
| B AI-COST FEATURE | Correction, manual translation, live translation, layout AI classify |
| C LEARNING FEATURE | LearningEvents, profile, Progress |
| D PRACTICE FEATURE | Practice panel / sessions |
| E DATA / EXPORT FEATURE | Activity history, export/import |
| F ACCOUNT / BILLING | Auth, server entitlement, Paddle |
| G FUTURE / UNCERTAIN | Pro-only learning analytics (not built), annual plans (not built), Lemon (stale copy only) |

---

## 5. Keyboard layout — permanent free (verified)

### Trace (KNOWN FROM CODE)

```
input → InputEngine / EventBus
  → LayoutScheduler (Space/Enter/Tab / focus-out)
  → field safety (MAX_FIELD_CHARS 2000, MAX_FIELD_TOKENS 48)
  → planFieldFixes / localClassificationHint / mapLayout
  → applyLayoutFix  (LOCAL — no network)
```

Ambiguous tokens only:

```
LayoutClassifier.classify → CHECK_WORD → SW handleCheckWord
  → POST /api/ai/layout-classification (model allam-2-7b)
  → mapLayout locally with AI verdict
```

### Cost to Flowlary

| Path | Cost |
| --- | --- |
| Local remap / Speed Box / manual convert | **Zero model cost** — KNOWN FROM CODE |
| Remote classify | Groq `allam-2-7b`, maxTokens 120 — **REQUIRES EXTERNAL PRICING** (model not listed on current Groq production catalog page at audit time) |

### Entitlement

- `layout_auto`: always allowed — KNOWN FROM CODE  
- UI does **not** lock Keyboard Layout when AI usage exhausted — KNOWN FROM CODE (`computeFeatureStatus`)  
- `layout_ai`: gated like other AI — KNOWN FROM CODE  

### Product rule

**KEYBOARD LAYOUT REPAIR = FREE FOREVER** — already aligned for the local path. Keep it. Do not paywall. Optional: keep `layout_ai` inside shared AI budget (already is) so ambiguous-word AI does not become an uncapped side channel — or move ambiguous words to a smaller free allowance / local-only fallback when exhausted (recommendation only).

---

## 6. Writing correction audit

### Trace (KNOWN FROM CODE)

```
content CorrectionScheduler.onInput
  → [direct] applyInstantSpelling (local)
  → English gates + IntelligentDebouncer
  → extractWritingContext(segment)   ← one HTTP request unit
  → CORRECT_TEXT → SW
  → consent + entitlement('correction')
  → L1/L2 cache + coalesce
  → POST /api/ai/correction
  → Groq llama-3.1-8b-instant (maxTokens 400, temp 0.1)
  → CorrectionCard / direct apply
  → recordCorrectionLearning (detected / accepted / rejected)
```

### What is one request?

- **One HTTP call per debounced writing segment**, not per keystroke — KNOWN FROM CODE  
- Debounce defaults: box 120ms / direct 90ms (faster on word/sentence boundaries) — KNOWN FROM CODE (`CORRECTION_DEFAULTS`)  
- Segment: last paragraph / last 2 sentences / soft ~480 / hard 2000 chars — KNOWN FROM CODE  
- Max input: `MAX_CORRECTION_CHARS = 2000`; assist gate `MAX_ASSIST_CHARS = 250` — KNOWN FROM CODE  
- Cache TTL 15 min; coalesce identical keys; cancel via `CANCEL_CORRECT` — KNOWN FROM CODE  
- Provider: Groq; model `llama-3.1-8b-instant` — KNOWN FROM CODE  

### Tokens / cost

- Exact average tokens: **UNKNOWN** (not logged into a cost report; provider returns usage optionally)  
- `maxTokens` output cap 400 — KNOWN FROM CODE  
- Per-request $ cost: **REQUIRES EXTERNAL PRICING** (see cost model)  

### Limit reached

- Client: features `locked`; summary “You've reached your current usage limit.” — KNOWN FROM CODE  
- Server account free: `allowed: false`, reason `usage_exhausted` — KNOWN FROM CODE  
- Layout remains available — KNOWN FROM CODE  

---

## 7. Translation audit (manual)

| Item | Evidence |
| --- | --- |
| Trigger | Command / `Ctrl/⌘+Shift+,` / popup — KNOWN FROM CODE |
| Endpoint | `POST /api/ai/translation` — KNOWN FROM CODE |
| Model | `openai/gpt-oss-120b`, maxTokens 1200 — KNOWN FROM CODE |
| Frequency | On-demand only — KNOWN FROM CODE |
| Caps | Feature 4000 chars; security message cap **2000** — KNOWN FROM CODE |
| Cache | 60 min — KNOWN FROM CODE |
| Quota | Shares free `usageBalanceMs` + RPM — KNOWN FROM CODE |
| Learning | Does **not** create LearningEvents — KNOWN FROM CODE |

**Quota recommendation:** Keep translation inside a **single shared AI allowance** (see usage model). Separate quotas add UX complexity without fixing live-translation burn. Optionally apply a **stricter live** multiplier later.

---

## 8. Live translation audit

| Control | Value | Label |
| --- | --- | --- |
| Debounce | `LIVE_PAUSE_MS = 750` | KNOWN FROM CODE |
| Default | `liveEnabled: false` | KNOWN FROM CODE |
| Segment | Completed sentence **or** current paragraph | KNOWN FROM CODE |
| Dedup | lastRequestedKey / lastTranslatedKey | KNOWN FROM CODE |
| Cancel | abort on new schedule / disable | KNOWN FROM CODE |
| Cache | Same translation cache 60m | KNOWN FROM CODE |
| Entitlement | Same as manual (`live_translation`) | KNOWN FROM CODE |

### Worst-case 30 minutes (CALCULATED)

- Theoretical timer firings: `30 * 60 * 1000 / 750 = 2400` — CALCULATED  
- Each firing becomes an API call only if text/key changed and not cached — KNOWN FROM CODE  
- Continuous paragraph rewriting without sentence boundaries ≈ near worst case  
- Sentence-bounded writing ≈ ~1 request per sentence (+ cache hits) — ASSUMED behaviorally  

### Recommendation (design only)

| Plan | Live translation |
| --- | --- |
| Free | Shared AI allowance; optionally higher burn weight or daily live request soft-cap |
| Trial | Full (target first-month philosophy) |
| Pro | High shared allowance; still not “unlimited” in copy |

Do **not** leave Pro truly unlimited at scale without RPM + soft monthly caps.

---

## 9. Speed Box audit

| Question | Answer |
| --- | --- |
| Local? | Yes — KNOWN FROM CODE |
| Server / AI? | No — KNOWN FROM CODE |
| What? | Overlay physical-key layout conversion between layouts — not a translator |
| Learning / history? | Neither — KNOWN FROM CODE |

**Recommendation:** Remain **permanently free** (utility, zero AI cost, reinforces keyboard value).

---

## 10–11. Learning system + real-world value

### Trace (KNOWN FROM CODE)

```
CorrectionResponse.changes (type: spelling|grammar|wording, original, corrected)
  → recordCorrectionDetected / Accepted / Rejected
  → LearningEvent { category, original, corrected, action, source writing|practice, sampleWordCount, ... }
  → store flowlary.learning.events (MAX 2000)
  → ProgressMetrics (errors/100 words after MIN_WORDS 50; 7-day trends)
  → Practice recommendations (writing source only)
```

### Example: “I goed to university.” → “I went to university.”

| Signal | Supported today? |
| --- | --- |
| Error occurred | Yes — if model returns a change |
| Type = grammar | Yes — `category` from `change.type` |
| original / corrected | Yes |
| User accepted / rejected | Yes — action enum |
| Recurring same error | Partial — normalized text + progress patterns; not a full spaced-repetition graph |
| From translation / layout / speed box | **No pollution** — KNOWN FROM CODE |

### Missing for “become better” Pro story

- Long-term analytics beyond 2000 events / local-only — PARTIAL  
- Server sync of learning — not present  
- Advanced recurring-mistake coach UX — basic exists via progress/practice  
- Export gated as Pro — **not gated today**  

---

## 12. Practice audit

| Item | Evidence |
| --- | --- |
| Exists / functional | Yes — dashboard Practice — KNOWN FROM CODE |
| Session size | `PRACTICE_ITEMS_PER_SESSION = 5` — KNOWN FROM CODE |
| Cost | Each Check → correction AI — KNOWN FROM CODE |
| LearningEvents | Yes, `source: practice` — KNOWN FROM CODE |
| Drives recommendations | No — recommendations filter `writing` only — KNOWN FROM CODE |
| Plan gate | None separate — same AI entitlement — KNOWN FROM CODE |

---

## 13. Learning vs Activity

| Concept | Storage | Contents |
| --- | --- | --- |
| Activity | `flowlary.history` max 50 | CORRECT / TRANSLATE / FIX_LAYOUT ops with text |
| Learning | `flowlary.learning.events` | Mistake-level changes from correction/practice |

### Mixing risks found

| Surface | Issue |
| --- | --- |
| Website guide tip | “Progress shows your local activity summary…” — conflates activity with learning — KNOWN FROM COPY |
| History ops named CORRECT | Activity includes correction ops, which also spawn learning — conceptually adjacent but separate stores |
| Account `remainingMs` during trial | Labeled like AI usage but is trial clock — semantic mix — KNOWN FROM CODE |

Data Control UI correctly lists activity vs learning separately — good.

---

## 14. History / Activity

| Item | Value | Label |
| --- | --- | --- |
| Max entries | 50 | KNOWN FROM CODE |
| Max text | 2000 each side | KNOWN FROM CODE |
| Retention | Cap only (no TTL) | KNOWN FROM CODE |
| Privacy filters | Passwords, JWT-like, API keys, etc. | KNOWN FROM CODE |
| Export | Included | KNOWN FROM CODE |
| Cost | Local only | KNOWN FROM CODE |

**Recommendation:** Keep **basic Activity free**. Optional Pro: higher retention / longer history — only if users ask; not a primary paywall.

---

## 15. Export / Import

| Included | Excluded |
| --- | --- |
| Settings, correction (secrets stripped), translation, layout | Auth tokens, install token, license key |
| Learning profile, events, samples | `gsk_` keys, legacy BYOK fields |
| Practice sessions, activity | AI response cache |

Schema: `FLOWLARY_EXPORT_SCHEMA_VERSION = 1` — KNOWN FROM CODE  
Secret guard: `exportContainsSecrets` throws — KNOWN FROM CODE  

**Target:** Learning export/import = Pro — **safe technically** if secrets remain excluded. Gate in a later phase; do not export credentials.

---

## 16. Current trial audit (real implementation)

| Question | Answer | Label |
| --- | --- | --- |
| Duration | **7 days** (`ACCOUNT_TRIAL_DURATION_MS`) | KNOWN FROM CODE |
| Starts | Email/password **registration** | KNOWN FROM CODE |
| Account required? | Yes for server trial | KNOWN FROM CODE |
| AI consent? | Separate client gate for correction readiness | KNOWN FROM CODE |
| Plan granted | `plan: 'trial'` + seeds `usageBalanceMs = 2h` for post-trial | KNOWN FROM CODE |
| Entitlements | All AI features allowed; no balance debit during trial | KNOWN FROM CODE |
| Expiration | Lazy on resolve: trial → free | KNOWN FROM CODE |
| After expiry | Free with remaining `usageBalanceMs` (initially full 2h if unused) | KNOWN FROM CODE |
| Authority | Server store for account JWT | KNOWN FROM CODE |
| Marketing claim | “1 month free” Pro | **FALSE vs code** |
| Reinstall | New install can use install-auth AI without trial account | Abuse — KNOWN FROM CODE |
| Clear storage | Local entitlement resets; server trial does not if same account | Split worlds |
| Multi-account | New email = new 7-day trial | Abuse — KNOWN FROM CODE |

**P0 product issue:** “Trial · 2h” / “1 month free” messaging is confusing or wrong relative to 7-day trial + 2h free latency budget.

---

## 17. Target trial principle vs architecture

Intended: **first month = full experience**, then Free unless Pro.

| Needed | Current support |
| --- | --- |
| Longer trial duration | Constant change only — easy |
| Full learning/practice/export during trial | Already ungated — easy |
| Post-trial Free with limits | Partially (2h balance, no refill) — needs redesign |
| Safe server authority | Account JWT yes; install-auth no — **blocker** |
| Abuse resistance | Weak — **blocker** |

Architecture **can** support first-month trial safely **after** install-auth metering and trial abuse controls. Not safe to market “full month” on current abuse surface.

---

## 18–19. Free / Pro philosophy (audit framing)

Today Free after trial is: local utilities + **one-shot 2h latency AI budget that never refills** — closer to a **demo leftover** than a sustainable Free plan. That fails the “genuinely useful Free” principle.

Today Pro is: same features + no debit + higher RPM — **“same product + higher number”** — weak differentiation because learning/practice/export are already free.

---

## 20–23. Usage model, “2 hours”, cooldown

See **PHASE24_USAGE_MODEL.md**.

Headline:

- **2 hours = free-tier `usageBalanceMs` latency budget**, debited by successful AI request latency — **not** “2 hours after install” and **not** calendar access time.  
- No cooldown/refill exists today.  
- Recommended model: **daily or rolling AI request (or credit) allowance + clear reset**, not a confusing latency-ms “2h” UX — with economics in cost model.

---

## 24–27. Cost / Free ceiling / Pro price / Annual

See **PHASE24_COST_MODEL.md** and **PHASE24_PRICING_PROPOSAL.md**.

---

## 28–30. Matrix, learning paywall, month-1 experience

See feature matrix + pricing proposal.

---

## 31. Trial abuse audit

| Vector | Current | Severity |
| --- | --- | --- |
| Reinstall / new install_id | New HMAC; claim unlocks AI **without debit** | **P0** |
| Clear extension storage | Resets local entitlement UX | P1 |
| Incognito | Separate profile / install | P1 |
| Multi email accounts | New 7d trial each | **P0** |
| Device switching | Same account OK if signed in | OK |
| Client entitlement header | Ignored for account JWT Pro | Mitigated |
| Dev auth disabled | All AI allowed if mis-deployed | P0 ops |

**Recommendation (design):** Server-only AI for production; bind trial to account + optional device fingerprint / payment method later; retire install-auth managed AI or meter it.

---

## 32–33. Entitlement architecture & server authority

### Current plans

`AccountPlan = 'free' | 'trial' | 'pro'` — KNOWN FROM CODE  

### Current feature gates

Only AI features in `EntitlementFeature`. No `learning.*` / `practice.*` / `export.*`.

### Recommended conceptual model (not implemented)

```
plan = free | trial | pro

entitlements:
  keyboard.unlimited          # always
  speedbox.unlimited          # always
  ai.correction               # quota by plan
  ai.translation              # shared quota
  ai.liveTranslation          # shared + optional weight
  ai.layoutClassify           # shared or free small bucket
  learning.basic | learning.full
  practice.full
  learning.export | learning.import
  progress.advanced
```

### Authority

| Concern | Must be server |
| --- | --- |
| AI quota | Yes |
| Trial | Yes |
| Pro | Yes (already via Paddle webhook) |
| Learning export gate | Prefer server flag + client UX |

**Weaknesses:** install-auth claim path; in-memory rate limits; single-process JSON store; client can show stale remainingMs.

---

## 34–36. Pricing copy & limit UX

### Pricing page issues (KNOWN FROM COPY)

- Lemon Squeezy named; backend is Paddle  
- “1 month free” ≠ 7-day trial  
- “Higher managed-AI limits” with no numbers  
- Free AI quantity never stated as 2h  
- Tests **freeze** Lemon + 1 month free and forbid Paddle on pricing  

### Limit UX today

- “You've reached your current usage limit.”  
- Features locked; layout remains  
- **Missing:** when access returns (never, today — balance does not refill), what Pro changes numerically, countdown  

---

## 37. Global vs per-feature quotas

**Recommendation:** One **shared AI credit/request pool** for correction + translation + live + layout classify + practice checks.  
Optional: live translation costs **2 credits** per request (design).  
Avoid three separate Free meters in UI.

---

## 38–39. Export value & cross-surface consistency

Export of LearningProfile + Events + Practice + Progress source is valuable and secret-safe with current strip logic.  
Consistency: Website / Extension / Account / Onboarding must share one matrix — currently **fail**.

---

## 40–48. Final recommendation summary

See **PHASE24_PRICING_PROPOSAL.md** for full structure.

Headline recommendation:

1. **Free:** Keyboard + Speed Box + privacy + limited refillable AI + basic learning awareness + basic activity  
2. **Pro ($9/mo recommended):** High AI + full learning + practice + export/import + advanced progress  
3. **Trial:** Align product to **30-day full experience** (change constant later) — only after abuse fixes  
4. **Replace latency-ms “2h” UX** with understandable daily/monthly AI help units  
5. **Never paywall** keyboard, privacy, pause, basic safety  
6. **Do paywall** high AI, full learning history, practice depth, export/import, advanced analytics  

---

## 49. Final audit verdict

| Gate | Verdict |
| --- | --- |
| PRODUCT READINESS | **PARTIAL** |
| MONETIZATION READINESS | **BLOCKED** |
| USAGE METERING | **PARTIAL** |
| ENTITLEMENT SYSTEM | **PARTIAL** |
| TRIAL | **PARTIAL** |
| LEARNING | **PASS** (capability) / needs paywall design |
| AI COST CONTROL | **BLOCKED** |

### P0 blockers

1. Install-auth managed AI without usage debit  
2. Registration trial uncapped AI cost for 7 days (multiplied by multi-account abuse)  
3. Marketing “1 month free” / Lemon vs code 7-day / Paddle  
4. Free balance never refills → Free plan not sustainable product; Pro differentiation weak (learning ungated)  
5. Live translation can burn budget / cost rapidly  
6. Account checkout dead-end while pricing may imply readiness  

### P1 issues

1. `remainingMs` means trial clock vs usage budget depending on plan — confusing UX  
2. Website/demo numbers (45m / 50m) disagree with 2h constant  
3. No token-based cost accounting in product metrics  
4. In-memory rate limits / JSON store not multi-instance safe  
5. `allam-2-7b` pricing/catalog status unclear  
6. Activity vs learning copy conflation on website  

### P2 improvements

1. Feature-level entitlement flags for learning/practice/export  
2. Soft monthly Pro caps (honest “not unlimited”)  
3. Annual plan  
4. Better limit UX with countdown / what still works  
5. Credit weighting for live translation  

---

## 50. Stop condition

**STOP.** No implementation performed. These documents are the intended source of truth for the next implementation phase.
