# PHASE 24 — Pricing Proposal

**Status:** Recommendation only — **NOT IMPLEMENTED**  
**Date:** 2026-08-26  
**Evidence base:** Code audit in companion PHASE24 docs  

---

# Executive Recommendation

Ship a three-state model: **Free (useful, daily AI limits) → 30-day full Trial → Pro ($9/mo, ~$90/yr)**.

Keep **Keyboard Layout + Speed Box + privacy/pause permanently free**.

Make **Pro feel different** via (1) high everyday AI limits, (2) full learning + practice, (3) learning export/import, (4) advanced progress — not merely “same app + bigger number.”

**Do not implement until P0 blockers are fixed:** install-auth unmetered AI, trial abuse, pricing copy vs code, checkout dead-end, and replacement of the opaque latency “2h” meter with understandable credits.

---

## Product Positioning

Flowlary is a Chrome writing companion: local keyboard utility + Flowlary AI writing help + learning from real mistakes.

| Stage | Feeling |
| --- | --- |
| Free | “Flowlary is useful.” |
| Trial | “Oh, this is powerful.” |
| Pro | “I don’t want to go back.” |

Avoid: useless Free / identical Pro / fake Unlimited.

**Evidence:** Local layout already free (`layout_auto`); learning pipeline already captures spelling/grammar/wording accept/reject; AI is Groq-metered only loosely via latency balance today.

---

## Free Plan

**Philosophy:** Genuinely useful; economically bounded.

| Include | Exclude / Limit |
| --- | --- |
| Keyboard layout repair (local) forever | Uncapped AI |
| Speed Box forever | Full learning history depth |
| Pause, privacy, reset, field safety | Learning export/import |
| Basic activity history (current local cap OK) | Unlimited live translation |
| Basic learning awareness (summary / recent) | |
| Limited daily Flowlary AI (shared weighted credits) | |

**Why:** Code proves local utilities cost ~$0; Free AI must refill daily or Free becomes a dead leftover after one 2h latency burn (current behavior — KNOWN FROM CODE).

**Suggested Free AI (pending token telemetry):** ~**40 correction-equivalent credits/day**, shared pool, live weighted ×2 — ASSUMED from cost model ≤~$0.50–$1/user/mo target.

---

## Pro Plan

| Include | Why |
| --- | --- |
| High shared AI ceiling (≈10–20× Free) | Everyday writing without worry — primary willingness-to-pay |
| Full learning history + recurring patterns | Strategic differentiator already in code, ungated today |
| Full Practice | Habit + AI cost — belongs in Pro |
| Learning export/import | Portability; secret-safe today |
| Advanced progress / analytics | Natural continuation of learning |
| Higher RPM (already 120 vs 30) | Keep as safety, not sole differentiator |

**Not:** “Unlimited.” Soft monthly ceiling + RPM — honest copy.

---

## First-Month Trial

**Target product rule:** First month = full Pro experience, then Free unless subscribed.

| Item | Current (KNOWN FROM CODE) | Target (DESIGN) |
| --- | --- | --- |
| Duration | **7 days** | **30 days** |
| Starts | Registration | Registration (after consent for AI features) |
| AI | Full, no debit | Full Pro limits |
| Learning / practice / export | Already full | Keep full |
| After end | Free + leftover 2h balance (no refill) | Free with **daily** Free limits |
| Authority | Server account | Server account only |

**Architecture:** Can support 30-day trial by changing `ACCOUNT_TRIAL_DURATION_MS` **after** abuse controls — not safe to market today.

---

## AI Limits

| Plan | Model |
| --- | --- |
| Free | Daily shared weighted credits (server) |
| Trial | Pro-level credits for trial window |
| Pro | High daily/monthly credits + RPM 120 |

**One shared pool** for correction, translation, live, layout classify, practice Check.  
Weights: correction/layout/practice = 1; translation ≈ 1.5–2; live = 2.

**Evidence:** All ops already share free `usageBalanceMs`; live uses expensive `gpt-oss-120b` at 750ms debounce — shared pool + weights is the simplest economic control.

Exact credit counts: **REQUIRES** production token telemetry before lock.

---

## Cooldown / Reset

**Reject** user-facing “2h AI then 5h cooldown” as the primary story — current “2h” is latency budget and confuses users.

**Prefer:** daily (or rolling 24h) **reset** with clear countdown.

Optional soft message when exhausted; keyboard remains available.

---

## Learning Paywall

| Free | Pro / Trial |
| --- | --- |
| “Flowlary noticed issues” summary | Full event history (to store cap) |
| Limited recent mistakes | Recurring mistake analysis |
| Basic progress after min words | Advanced trends / analytics |
| | Practice targeting |
| | Export/import |

**Why:** LearningEvents already encode type/original/corrected/accepted/rejected from real writing — KNOWN FROM CODE. This is the “become better” wedge. Leaving it fully free forever weakens Pro.

---

## Practice Paywall

| Free | Pro / Trial |
| --- | --- |
| Teaser: 0–1 short session/day **or** locked when AI exhausted | Full sessions (5 items), recommendations from writing events |

**Why:** Practice Check burns correction AI — KNOWN FROM CODE. Gate depth with Pro; don’t invent fake practice.

---

## Export / Import

| Free | Pro / Trial |
| --- | --- |
| Settings-only optional later | LearningProfile + LearningEvents + PracticeSessions + progress sources |
| | Activity optional |

**Always exclude:** auth tokens, API keys, license keys, secrets (already stripped — KNOWN FROM CODE).

**Format:** Keep versioned JSON (`schemaVersion: 1` today); bump version when gating.

---

## Keyboard Layout

**FREE FOREVER** on all plans.

No request quota, Pro requirement, or trial requirement for **local** repair.

Optional AI classify remains inside AI credit pool so it cannot be an abuse side-channel.

**Evidence:** Local path zero cost; UI already keeps layout ready when AI locked.

---

## Speed Box

**FREE FOREVER.**

Local overlay; not AI; reinforces keyboard value — KNOWN FROM CODE.

---

## Activity

**Keep basic Activity free** (local, max 50 today).

Do not paywall local history. Optional Pro: higher retention only if demanded.

---

## Progress

| Free | Pro / Trial |
| --- | --- |
| Basic error rate when enough words | Full trends, patterns, advanced views |

Separate Progress from Activity in all copy (website currently conflates — P1).

---

## Monthly Price

**Recommend: $9 / month.**

| Price | Decision |
| --- | --- |
| $7 | Too thin if live-heavy Pro users |
| **$9** | Aligns with sandbox catalog placeholder; healthy AI margin at expected usage |
| $12–15 | Reserve for later if positioning upgrades |

Label: sandbox $9 is **KNOWN FROM DOCS**; live Paddle amount **UNKNOWN** until catalog confirmed.

---

## Annual Price

**Recommend: Monthly + Annual.**

**$90 / year** (2 months free vs monthly) — ASSUMED clear discount messaging.

---

## Trial Conversion Strategy

| Day | Experience goal |
| --- | --- |
| 1 | Everything unlocked; keyboard wow + first AI correction |
| 7 | Learning summary visible |
| 14 | Progress meaningful (≥50 words threshold exists) |
| 21 | Recurring mistakes / practice prompted |
| 30 | Trial ends → Free with clear comparison CTA |

Post-trial message: not punishment — “continue everyday AI + full learning with Pro.”

Require account for trial; require server metering; block multi-trial abuse before promising 30 days.

---

## Expected Gross Margin

At $9 Pro and average Pro AI COGS ~$0.50–$2 (ASSUMED/CALCULATED):

- AI gross margin ~**78–94%** before fees/infra  
- Payment fees ~3–5% ASSUMED  
- See BASE scenario in cost model for scale contribution  

Conservative mix with uncapped trial loses money — **fix metering first**.

---

## Risks

1. Marketing promises (1 month / Lemon / unlimited vibes) destroy trust  
2. Live translation cost spikes  
3. Groq price changes / `llama` ContactSales / `allam` catalog uncertainty  
4. Learning paywall backlash if Free feels gutted — mitigate with basic awareness Free  
5. JSON store / in-memory RPM not production-scale  

---

## Abuse Risks

| Vector | Mitigation (design) |
| --- | --- |
| Multi-email trials | Rate-limit registrations; device/payment signals later |
| Install-auth free AI | Remove managed AI without account **or** hard meter |
| Reinstall | Server account is source of truth |
| Incognito | Same as install; require sign-in for AI |
| past_due keeps Pro | Accept short dunning window (already by design) |

---

## What We Should NOT Paywall

- Keyboard Layout Repair (local)  
- Speed Box  
- Privacy controls / data reset  
- Pause / disable extension  
- Basic field safety  
- Basic extension operation for local features  

---

## What We SHOULD Paywall

- High / everyday AI volume  
- Live translation at scale (via credits)  
- Full learning history & recurring analysis  
- Practice depth  
- Learning export/import  
- Advanced progress analytics  

Each justified by **user value + cost + willingness** (see matrix doc).

---

## Why Users Will Pay

1. They write daily and hit Free AI limits.  
2. They see personal mistake patterns and practice — uniquely Flowlary.  
3. They need bilingual live help without rationing.  
4. They want to keep/export their learning record.

Not because Free is broken — because Pro is the natural continuation.

---

## Implementation Requirements

**Next phase only — listed here as requirements, not work done:**

1. Replace latency `usageBalanceMs` UX with server **daily/monthly credits** (or keep ms internally but never show “2h” as product language).  
2. Extend entitlement features: `learning.full`, `practice.full`, `learning.export`, `learning.import`.  
3. Set trial to 30 days **after** abuse controls.  
4. Disable or meter install-auth managed AI in production.  
5. Align website/extension copy: Paddle, trial length, concrete limits, no Unlimited.  
6. Wire Account checkout (helpers exist; page dead-end).  
7. Instrument Groq token usage → validate Free/Pro credit sizes.  
8. Limit UX: what failed, what still works (keyboard), when reset, Pro CTA.  
9. Weight live translation in credit accounting.  
10. Soft Pro monthly cap + honest marketing.  
11. Gate export/import of learning data behind Pro/Trial.  
12. Confirm live Paddle price id + annual price.  

**Out of scope for Phase 24:** all of the above implementation.

---

## Consistency checklist (copy)

| Surface | Must say |
| --- | --- |
| Website pricing | Free limits + Pro limits with numbers; Paddle; trial = first month only if true |
| Popup | Plan · remaining **credits/time-to-reset** |
| Dashboard Account | Same entitlements as server |
| Onboarding | Trial value without false Unlimited |

---

## Final readiness (from full audit)

| Gate | Verdict |
| --- | --- |
| PRODUCT READINESS | PARTIAL |
| MONETIZATION READINESS | **BLOCKED** |
| USAGE METERING | PARTIAL |
| ENTITLEMENT SYSTEM | PARTIAL |
| TRIAL | PARTIAL |
| LEARNING | PASS (capability) / paywall pending |
| AI COST CONTROL | **BLOCKED** |

Use this proposal + the other PHASE24 docs as the single source of truth for the next implementation phase.
