# PHASE 24 — Cost Model

**Status:** Audit + estimates — **not implemented**  
**Date:** 2026-08-26  

Every number is labeled. Do not treat ASSUMED or third-party prices as billing facts.

---

## 1. Provider & models (KNOWN FROM CODE)

| Operation | Model ID | maxTokens | Temp |
| --- | --- | --- | --- |
| Correction / Practice Check | `llama-3.1-8b-instant` | 400 | 0.1 |
| Translation / Live | `openai/gpt-oss-120b` | 1200 | 0.2 |
| Layout classification | `allam-2-7b` | 120 | 0 |

Provider: Groq Chat Completions only (`GROQ_API_KEY`).  
Flowlary does **not** store $/token in repo.

---

## 2. External list prices

### Translation model — `openai/gpt-oss-120b`

| Field | Value | Label |
| --- | --- | --- |
| Input | $0.15 / 1M tokens | REQUIRES EXTERNAL PRICING — from Groq docs (console.groq.com/docs/models) at audit time |
| Output | $0.60 / 1M tokens | Same |

### Correction model — `llama-3.1-8b-instant`

| Field | Value | Label |
| --- | --- | --- |
| Official Groq docs (audit) | **ContactSales** (Enterprise row) | REQUIRES EXTERNAL PRICING — uncertain |
| Third-party aggregators (2026) | ~$0.05 in / $0.08 out per 1M | REQUIRES EXTERNAL PRICING — **unofficial**; verify on Groq console before launch |

### Layout model — `allam-2-7b`

| Field | Value | Label |
| --- | --- | --- |
| Listed on Groq production models page (audit) | **Not found** | UNKNOWN |
| Cost per classify | Unknown | REQUIRES EXTERNAL PRICING |

**Action before monetization launch:** Pull live prices from Groq console for the exact model IDs in `packages/shared/src/ai/models.ts`. Prefer instrumenting `usage.prompt_tokens` / `completion_tokens` already returned by providers into an ops dashboard.

---

## 3. Token size assumptions (for scenario math)

These are **ASSUMED** until measured from production logs.

| Request type | Assumed input tokens | Assumed output tokens | Notes |
| --- | --- | --- | --- |
| Correction (typical segment) | 350 | 120 | System prompt + JSON segment ≤2000 chars |
| Correction (max-ish) | 900 | 300 | Near maxTokens 400 |
| Translation (short) | 200 | 150 | |
| Translation (long ≤2000 chars) | 800 | 600 | |
| Live translation | similar to translation | similar | Higher frequency |
| Layout classify | 80 | 40 | Small prompt |

Rough $/request using **third-party** llama rates + **official** gpt-oss rates:

| Request | Formula | Est. $ | Label |
| --- | --- | --- | --- |
| Correction typical | 350×0.05 + 120×0.08 per 1M | **~$0.000027** | CALCULATED from ASSUMED tokens × REQUIRES EXTERNAL |
| Translation short | 200×0.15 + 150×0.60 per 1M | **~$0.00012** | CALCULATED |
| Translation long | 800×0.15 + 600×0.60 per 1M | **~$0.00048** | CALCULATED |
| Live (same as translation) | same | **~$0.00012–0.00048** | CALCULATED |

**Missing variable for precision:** real average tokens per op from `recordAiUsage` / Groq usage fields — **UNKNOWN in aggregate**.

---

## 4. How current Free “2h” maps to requests (CALCULATED)

Free balance = 7,200,000 ms.

| Assumed avg latency | Approx requests until exhaust | Label |
| --- | --- | --- |
| 200 ms | 36,000 | CALCULATED |
| 500 ms | 14,400 | CALCULATED |
| 1000 ms | 7,200 | CALCULATED |

Cost if all correction @ ~$0.000027: **~$0.19–$0.97** one-shot lifetime Free — CALCULATED from ASSUMED.  
Cost if all long translation @ ~$0.00048: **~$3.5–$17** one-shot — CALCULATED from ASSUMED.

**Trial is the expensive period:** 7 days, **no debit**, up to 60 req/min/op — KNOWN FROM CODE.  
Worst-case theoretical: 60 × 60 × 24 × 7 = **604,800** calls/op/week — CALCULATED (RPM ceiling, not realistic).  
Realistic heavy trial week: thousands of live+correction calls — ASSUMED — could be **dollars to tens of dollars** per abusive account if translation-heavy.

---

## 5. User scenarios (monthly AI cost)

Mix ASSUMED behavior × CALCULATED unit costs. **Not** measured telemetry.

### Light user

- 20 corrections/day × 30 = 600  
- 5 translations/day = 150  
- No live  

Est. monthly: `600×0.000027 + 150×0.00012 ≈ $0.034` — CALCULATED/ASSUMED  

### Average user

- 80 corrections/day = 2400  
- 15 translations/day = 450  
- Occasional live 50/day = 1500  

Est.: `2400×0.000027 + (450+1500)×0.0002 ≈ $0.45` — CALCULATED/ASSUMED (live mid unit $0.0002)  

### Heavy user

- 300 corrections/day = 9000  
- 40 translations/day = 1200  
- Live aggressive 400/day = 12,000  

Est.: `9000×0.000027 + 13200×0.0003 ≈ $4.20` — CALCULATED/ASSUMED  

### Abusive user (trial or unmetered install-auth)

- Near RPM for hours on translation model  
- Monthly could reach **$50–$500+** — ASSUMED range; **UNKNOWN** without caps  

---

## 6. Free cost ceiling recommendation

**Target:** Free should stay useful but bounded.

| Metric | Recommendation | Label |
| --- | --- | --- |
| Max expected AI $ / Free user / month | **≤ $0.50–$1.00** | ASSUMED business target |
| Mechanism | Daily credits (not one-shot 2h latency) | Design |
| Expected Free users × cost | See scenarios below | |

Example exposure (ASSUMED conversion):

| Free users | $/user/mo | Gross AI exposure |
| --- | --- | --- |
| 1,000 | $0.50 | $500 |
| 10,000 | $0.50 | $5,000 |

If conversion Free→Pro is 3–5% ASSUMED at $9 Pro, revenue from 10k Free cohort ≈ 300–500 × $9 = **$2.7k–$4.5k/mo** before Pro AI cost — ASSUMED. Free AI must stay well below that.

---

## 7. Pro economics at candidate prices

Sandbox placeholder Pro list: **900 USD cents = $9.00/mo** — KNOWN FROM DOCS (PHASE20 report; not live published).  
Live price: runtime Paddle catalog — UNKNOWN.

| Price | Positioning | AI cost tolerance (target ≥70% gross on AI alone) | Conversion friction | Notes |
| --- | --- | --- | --- | --- |
| $7 | Aggressive / entry | ~$2.10 AI budget/user | Lower | Thin if heavy live users |
| **$9** | Matches sandbox placeholder; common AI tool band | ~$2.70 | Medium | **Strongest default** |
| $12 | Premium writing aid | ~$3.60 | Higher | OK if learning story is clear |
| $15 | Premium | ~$4.50 | Highest | Needs clear Pro exclusives |

**Recommendation:** **$9 / month** as primary list price (align with existing sandbox catalog intent; verify live Paddle).  
Raise to $12 only if Pro bundle (learning+practice+export+high AI) is visibly premium in UI.

Gross margin potential at $9 with average Pro AI ~$0.50–$2: **~78–94%** on AI COGS alone — CALCULATED/ASSUMED (excludes infra, support, payment fees ~3–5% ASSUMED).

---

## 8. Annual plan

| Option | Verdict |
| --- | --- |
| Monthly only | Simpler launch |
| Monthly + Annual | Recommended once checkout works |

**Suggested annual:** **$90 / year** (= 2 months free vs $9×12) or **$84** (= 30% off) — ASSUMED.  
Common pattern: ~17–30% annual discount. Prefer **~$90 (2 months free)** for clarity.

---

## 9. Scale scenarios

Assumptions (ASSUMED unless noted):

- Mix Free / Trial / Pro varies by scenario  
- AI $ uses section 5 averages  
- Revenue = Pro users × $9  
- Trial treated as temporary Free-cost+ (higher)  

### Labels

- Pro price $9 — ASSUMED / sandbox-aligned  
- AI costs — CALCULATED from ASSUMED usage × REQUIRES EXTERNAL unit prices  
- Conversion rates — ASSUMED  

### CONSERVATIVE

Mix: 85% Free, 10% Trial, 5% Pro · Free AI $0.30 · Trial $2.00 · Pro $1.00  

| Users | Free | Trial | Pro | AI cost | Revenue | Gross contribution |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 85 | 10 | 5 | ~$51 | $45 | **−$6** |
| 500 | 425 | 50 | 25 | ~$253 | $225 | **−$28** |
| 1,000 | 850 | 100 | 50 | ~$505 | $450 | **−$55** |
| 5,000 | 4250 | 500 | 250 | ~$2.5k | $2.25k | **−$0.3k** |
| 10,000 | 8500 | 1000 | 500 | ~$5.1k | $4.5k | **−$0.6k** |

Conservative fails if trial uncapped / Free too generous — **evidence that trial metering and Free daily caps are mandatory**.

### BASE

Mix: 80% Free, 8% Trial, 12% Pro · Free $0.40 · Trial $1.50 · Pro $1.20  

| Users | Free | Trial | Pro | AI cost | Revenue | Gross contribution |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 80 | 8 | 12 | ~$54 | $108 | **+$54** |
| 500 | 400 | 40 | 60 | ~$272 | $540 | **+$268** |
| 1,000 | 800 | 80 | 120 | ~$544 | $1,080 | **+$536** |
| 5,000 | 4000 | 400 | 600 | ~$2.7k | $5.4k | **+$2.7k** |
| 10,000 | 8000 | 800 | 1200 | ~$5.4k | $10.8k | **+$5.4k** |

### AGGRESSIVE

Mix: 70% Free, 5% Trial, 25% Pro · Free $0.35 · Trial $1.00 · Pro $1.50  

| Users | Free | Trial | Pro | AI cost | Revenue | Gross contribution |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 70 | 5 | 25 | ~$67 | $225 | **+$158** |
| 500 | 350 | 25 | 125 | ~$335 | $1,125 | **+$790** |
| 1,000 | 700 | 50 | 250 | ~$670 | $2,250 | **+$1.6k** |
| 5,000 | 3500 | 250 | 1250 | ~$3.4k | $11.3k | **+$7.9k** |
| 10,000 | 7000 | 500 | 2500 | ~$6.7k | $22.5k | **+$15.8k** |

**UNKNOWN:** payment fees, support, infra, refunds, actual Groq invoice, live conversion.

---

## 10. Cost-control implications for pricing design

1. **Meter trial** or accept high burn — current 7d uncapped is financially dangerous at scale.  
2. **Kill install-auth free AI** or debit it — otherwise Free ceiling is fiction.  
3. **Weight live translation** — dominant cost driver.  
4. **Instrument tokens** before locking Free credit numbers.  
5. **Pro needs soft caps** — “unlimited” at 120 RPM × gpt-oss is not free for Flowlary.  

---

## 11. Competitive sanity (brief)

Common AI consumer patterns: free tier with daily caps, 7–30 day trials, paid plans with higher caps (rarely true unlimited). Free utilities that work offline are rare differentiators — Flowlary’s keyboard-free-forever fits that pattern without copying competitors.

Economics first: caps from Groq COGS + conversion, not from competitor marketing numbers.
