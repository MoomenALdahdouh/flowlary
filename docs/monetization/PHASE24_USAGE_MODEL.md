# PHASE 24 — Usage Model Audit & Recommendation

**Status:** Audit + design recommendation — **not implemented**  
**Date:** 2026-08-26

---

## 1. What “a request” is today (KNOWN FROM CODE)

| Feature | Request unit | Counted where? |
| --- | --- | --- |
| Correction | One `POST /api/ai/correction` after debounce/segment | Server usage log + optional free debit |
| Translation | One `POST /api/ai/translation` on shortcut | Same |
| Live translation | One translation POST per qualifying pause/segment | Same |
| Layout classify | One `POST /api/ai/layout-classification` per ambiguous token miss | Same |
| Practice Check | Same as correction | Same |

Not counted as AI usage: local layout remap, Speed Box, instant spell, learning/progress local compute, activity writes.

---

## 2. How free usage is measured today

### Identifier

| Auth mode | Identifier | Authority |
| --- | --- | --- |
| Account JWT | `accountId` | Server store `usageBalanceMs` |
| Install token | install / userId for RPM only | **No usageBalance debit** if `accountId` null |
| Dev auth disabled | bypass | All allowed |

### Free balance (KNOWN FROM CODE)

- Constant: `ACCOUNT_FREE_BALANCE_MS = 2 * 60 * 60 * 1000` (**2 hours of milliseconds**)  
- On successful AI for `plan === 'free'`:  
  `usageBalanceMs -= max(latencyMs, 1)`  
- Failures do not debit  
- Trial and Pro do **not** debit  
- **No daily reset, no monthly refill, no cooldown** — balance only goes down until Pro  

### What “2 hours” is NOT

| Interpretation | True? |
| --- | --- |
| 2 hours after installation | **No** |
| 2 hours of wall-clock calendar access | **No** |
| 2 hours of active typing time | **No** (only server request latency) |
| Session timer | **No** |
| Token budget | **No** |

**It is:** a depleting **latency-based AI allowance** for free accounts.

### UI confusion (P0/P1)

Popup shows `{Plan} · {formatRemainingUsage(remainingMs)}`.

- Fresh free → often **`Free · 2h`** — means 2h latency budget remaining  
- During server trial → `remainingMs` is **time until trialEndsAt**, so **`Trial · 6d 12h`** style — **not** AI budget  
- Marketing / demos also invent **45m / 50m** denominators elsewhere  

If a user sees **Trial · 2h**, they may think “I get 2 hours of AI in trial,” which is **wrong** relative to 7-day uncapped trial AI.

**Product issue severity:** **P0** for messaging clarity; **P1** for Account UI labeling trial clock as AI usage.

---

## 3. Per-feature usage answers

For every AI feature:

| Question | Answer (KNOWN FROM CODE unless noted) |
| --- | --- |
| What is a request? | One successful gateway AI HTTP call |
| Where counted? | `recordAiUsage`; free debit in `accountService` |
| Identifier | Account id when signed in |
| Per account? | Yes for debit |
| Per device? | No hard bind |
| Per extension? | Install-auth is separate weak path |
| Server-side? | Debit yes (account); RPM yes (in-memory) |
| User-manipulable? | Multi-account / install-auth yes |
| Cooldown? | **None** |
| Daily limit? | **None** (beyond RPM) |
| Monthly limit? | **None** |
| Rolling window? | RPM 60s only |
| Reset? | **Never** for free balance |

---

## 4. Rate limits (KNOWN FROM CODE)

Per `userId:operation:tier`, window 60s:

| Tier | Max req/min/op |
| --- | --- |
| anonymous | 10 |
| free | 30 |
| trial | 60 |
| pro | 120 |

Not a product-facing “quota”; burst control only. Resets on process restart; not multi-instance safe.

---

## 5. Live translation frequency (CALCULATED)

- Debounce 750ms → max **80 requests/minute** theoretical if every pause changes text  
- 30 minutes → max **2400** theoretical API calls  
- Practical sentence typing ≪ that — ASSUMED  

This feature can dominate free-balance burn **and** Groq cost because it uses the **expensive** translation model.

---

## 6. Cooldown model hypothesis (NOT CURRENT)

Example only from brief: “2h AI → 5h cooldown → refill”.

### Evaluation

| Criterion | Latency 2h one-shot (current) | Cooldown windows | Daily request credits | Monthly credits |
| --- | --- | --- | --- | --- |
| User clarity | Poor (“2h” misread) | Medium | **Good** | Good |
| Cost binding | Weak (latency ≠ $) | Medium | Strong if credits map to ops | Strong |
| Abuse resistance | Weak without account | Needs server clock | Needs server day key | Needs server month |
| Conversion | Harsh (never refill) | Can feel punitive | Feels fair | Feels fair |
| Engineering fit | Already built | New state machine | New counters | New counters |

**Financial sustainability of “2h latency then 5h cooldown forever”:**

- If latency≈300ms/request → ~24k free requests per cycle — CALCULATED  
- At correction third-party ~$0.05–0.08 / MTok, cost per request is often fractions of a cent — ASSUMED/REQUIRES EXTERNAL  
- Translation/live at gpt-oss-120b is **much** more expensive per call — REQUIRES EXTERNAL  
- Latency debit treats a 200ms cheap correction and a 800ms expensive translation as different balances but **not proportional to $**  

**Verdict:** Do **not** keep latency-ms as the user-facing Free model. Prefer **credits or request counts** with a **daily or rolling reset**.

---

## 7. Recommended usage model (DESIGN ONLY)

### Shared AI pool

One pool covers: correction, translation, live translation, layout classify, practice Check.

### Free

| Parameter | Recommendation | Why |
| --- | --- | --- |
| Unit | **AI assists / day** (or credits) | Understandable |
| Magnitude | See cost model — start from **~30–50 correction-equivalent credits/day** ASSUMED pending live token telemetry | Enough to answer “does it work?” |
| Live weight | **2 credits** per live request | Cost + abuse |
| Translation weight | **1.5–2 credits** | Costlier model |
| Correction / practice / layout classify | **1 credit** | Cheaper model / small |
| Reset | **Daily UTC or rolling 24h** server-side | Sustainable Free |
| Exhaustion | AI pauses; keyboard/Speed Box/privacy remain; show return time | Matches principle |
| Cooldown alternative | Optional soft pause message; prefer daily reset over multi-hour lockout theater | Less confusing than 2h/5h |

### Trial (target)

- Full Pro AI limits for **30 days** (product target) — requires constant + abuse fixes  
- Today: 7 days uncapped — KNOWN FROM CODE  

### Pro

- High daily/monthly ceiling (e.g. **10–20× Free**) — ASSUMED pending margin  
- Honest copy: “Designed for everyday writing” — **not Unlimited**  
- Keep RPM safety net  

### Learning / practice (non-AI meters)

| Capability | Free | Pro |
| --- | --- | --- |
| Learning event retention visible | Last N (e.g. 50–100) | Full (up to store cap) |
| Practice | 0–1 session/day or locked when AI out | Full |
| Export/import | No | Yes |

---

## 8. Global vs separate quotas

**Recommend: one shared weighted AI pool.**

| Approach | Pros | Cons |
| --- | --- | --- |
| Global shared | Simple UX; one exhaustion story | Live can starve correction |
| Per-feature Free caps | Isolates live burn | Three meters; support burden |
| Shared + live weight | Simple + protects margin | Slight education cost |

Choose **shared + weights**.

---

## 9. Server authority requirements

Must be server-enforced for next implementation phase:

1. Daily/monthly credit counters per `accountId`  
2. Trial window  
3. Pro subscription grant  
4. Denial when exhausted  

Client may cache for UX only (15 min license cache exists today) — never trust alone.

**Retire or meter install-auth managed AI** before marketing any Free/Trial/Pro numbers.

---

## 10. Limit UX copy (design — not implemented)

When Free AI exhausted:

> You've reached today's Free AI limit.  
> Keyboard layout repair remains available.  
> AI access resets in 6h 12m.  
> Upgrade to Pro for higher everyday limits.

During trial end → Free:

> Your full trial has ended.  
> You still have Keyboard Layout and Free AI limits.  
> Keep Pro for everyday AI and full learning.

---

## 11. Evidence index

| Topic | Path |
| --- | --- |
| Free/trial constants | `packages/shared/src/account/types.ts` |
| Debit logic | `backend/src/services/accountService.ts` |
| Feature gates | `packages/shared/src/entitlement/index.ts` |
| RPM | `backend/src/middleware/rateLimit.ts` |
| Usage format UI | `extension/src/popup/status.ts` |
| Live debounce | extension live translation scheduler (`LIVE_PAUSE_MS = 750`) |
| Local entitlement mirror | `extension/src/storage/entitlement.ts` |
