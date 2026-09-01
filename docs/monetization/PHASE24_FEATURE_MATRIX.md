# PHASE 24 — Feature Matrix (Current vs Proposed)

**Status:** Design hypothesis after audit — **not implemented**  
**Date:** 2026-08-26

---

## 1. Classification of every feature (primary category)

| Feature | Primary category | Evidence |
| --- | --- | --- |
| Keyboard layout auto-repair | **A FREE CORE UTILITY** | Local remap; `layout_auto` always allowed |
| Layout manual shortcut | **A FREE CORE UTILITY** | Local (+ optional AI classify) |
| Layout AI classifier | **B AI-COST FEATURE** | Groq `allam-2-7b` via `/api/ai/layout-classification` |
| Speed Box | **A FREE CORE UTILITY** | Fully local conversion overlay |
| Instant spelling | **A FREE CORE UTILITY** | Local typo map |
| Writing Correction (AI) | **B AI-COST FEATURE** | Groq correction model |
| Manual Translation | **B AI-COST FEATURE** | Groq translation model |
| Live Translation | **B AI-COST FEATURE** | Same model; high frequency risk |
| Learning profile / events / progress | **C LEARNING FEATURE** | Local LearningEvent pipeline |
| Practice | **D PRACTICE FEATURE** | Uses correction AI + local sessions |
| Activity / History | **E DATA / EXPORT FEATURE** | Local capped history |
| Export / Import | **E DATA / EXPORT FEATURE** | JSON v1; secrets stripped |
| Pause / privacy / reset | **A FREE CORE UTILITY** | Local controls |
| Account / Paddle billing | **F ACCOUNT / BILLING** | Server auth + webhooks |
| Pro-only advanced analytics | **G FUTURE / UNCERTAIN** | Not built as distinct product surface |

---

## 2. Current enforcement matrix (KNOWN FROM CODE)

| Capability | Free (balance > 0) | Free (exhausted) | Trial (7d) | Pro (Paddle) |
| --- | --- | --- | --- | --- |
| Keyboard Layout (local) | Yes | **Yes** | Yes | Yes |
| Layout AI classify | Yes (debits) | No | Yes (no debit) | Yes |
| Speed Box | Yes | Yes | Yes | Yes |
| Writing Correction | Yes (debits) | No | Yes (no debit) | Yes |
| Translation | Yes (debits) | No | Yes | Yes |
| Live Translation | Yes (debits) | No | Yes | Yes |
| Activity | Yes | Yes | Yes | Yes |
| Learning (full local) | Yes | Yes | Yes | Yes |
| Progress | Yes | Yes | Yes | Yes |
| Practice | Yes if AI ok | No (Check needs AI) | Yes | Yes |
| Export / Import | Yes | Yes | Yes | Yes |
| Account | Yes | Yes | Yes | Yes |

**Important:** There is **no** Pro-only capability in shared entitlement policy today. Differentiation is only AI allowance behavior + RPM.

Rate limits (req/min/op): anonymous 10 · free 30 · trial 60 · pro 120 — KNOWN FROM CODE.

---

## 3. Proposed target matrix (DESIGN HYPOTHESIS)

Aligned with product principles after audit. **Not implemented.**

| Capability | Free | Pro | Trial (target: first month) |
| --- | --- | --- | --- |
| Keyboard Layout | **FREE forever** | FREE | FREE |
| Speed Box | **FREE forever** | FREE | FREE |
| Instant spell / field safety / pause / privacy | FREE | FREE | FREE |
| Writing Correction | Limited shared AI | High shared AI | Full Pro AI |
| Translation | Limited shared AI | High shared AI | Full Pro AI |
| Live Translation | Limited shared AI (weighted) | High shared AI | Full Pro AI |
| Layout AI classify | Limited shared AI | High | Full |
| Activity | Basic (current ~50) | Basic or modestly higher | Full basic+ |
| Learning awareness | Basic (recent / summary) | Full history + recurring | Full |
| Progress | Basic metrics | Advanced + trends depth | Full |
| Practice | Limited (e.g. 1 short session / day) or off when AI exhausted | Full | Full |
| Export learning | **No** | **Yes** | **Yes** |
| Import learning | **No** | **Yes** | **Yes** |
| Advanced analytics | No | Yes | Yes |

### Why this differs from today’s website table

Website shows nearly all features Free ✓ and only “Higher managed-AI limits” as Pro. That understates learning/practice/export as Pro value and overstates Free AI permanence.

---

## 4. What we must never paywall

| Capability | Verdict | Why |
| --- | --- | --- |
| Keyboard Layout Repair (local) | Never | Core utility; zero cost; brand promise |
| Speed Box | Never | Local; reinforces layout value |
| Privacy controls / reset | Never | Trust / compliance |
| Pause / disable extension | Never | User agency / safety |
| Basic field safety skips | Never | Safety |
| Basic extension operation | Never | Product must work offline for local paths |

---

## 5. What should drive revenue

| Candidate | User value | Cost | Willingness | Recommendation |
| --- | --- | --- | --- | --- |
| High AI usage | Daily writing without worry | High | High | **Primary** |
| Live translation volume | Real-time bilingual work | Very high | Medium–High | Inside Pro AI + weight |
| Full learning + recurring mistakes | “Become better” | Low infra / high product | High | **Primary differentiator** |
| Practice | Habit loop | AI per check | Medium–High | Pro (+ limited Free tease) |
| Export/import learning | Portability / backup | Low | Medium | Pro |
| Advanced progress | Motivation | Low | Medium | Pro |
| Activity history expansion | Convenience | Low | Low | Optional, not core paywall |

---

## 6. Consistency requirements (next phase)

All surfaces must show the same matrix:

- Website pricing  
- Extension popup / dashboard Account  
- Onboarding  
- Support / FAQ  

Rules:

- Never say **Unlimited** if RPM or soft caps exist  
- Never say **Free** for trial-only full AI  
- Never name Lemon if billing is Paddle  
- Never say **1 month free** unless `ACCOUNT_TRIAL_DURATION_MS` (or Paddle catalog trial) actually is ~30 days  
