# Flowlary — Commercial + Unit Economics + Revenue Feasibility Audit

**Date:** 2026-09-02  
**Mode:** Analysis only — no code, billing, or production changes.  
**Evidence basis:** Repository inspection, deployment/ops docs, external pricing research (labeled below).

---

## Labeling key

| Label | Meaning |
| --- | --- |
| **FACT** | Directly from repository, deployment docs, or verified external source |
| **EXTERNAL BENCHMARK** | Third-party pricing/market data |
| **ASSUMPTION** | Modeling input — not measured in Flowlary |
| **CALCULATED** | Derived from facts + assumptions |
| **UNKNOWN** | Insufficient evidence — measurement required |

---

# 1. Product Understanding

## What Flowlary is

**FACT:** Flowlary is a Chrome (MV3) writing companion for **mixed Arabic/English** users. It provides keyboard layout repair, bounded English writing correction, optional Arabic→English translation, and a learning loop — all in the field the user is already typing in. LLMs rank hypotheses or propose span edits; only the **Write Gate** mutates the DOM (`README.md`, `docs/architecture/ARCHITECTURE_FREEZE.md`).

## Who it is for

**FACT + INFERENCE:** Primary positioning is **Arabic/English bilingual writers** — people who switch keyboard layouts, write mixed-language text in Gmail/Notion/forms, and need layout repair plus English help. Secondary: general non-native English writers who want in-field correction (`website/src/i18n/en.ts`, feature copy).

## Core user problem

**FACT:** Typing in the wrong keyboard layout (Arabic intended, English keys active or reverse), writing English with recurring mistakes while context-switching languages, and needing translation without leaving the current field.

## Core value proposition

**FACT:** “Write where you already are” — local layout repair stays free forever; AI correction/translation/learning are server-gated but usable on Free with generous daily checks; Pro adds capacity + full learning stack.

## Main features

| Feature | Type | Source |
| --- | --- | --- |
| Keyboard layout repair | Local (unlimited) | `packages/shared/src/capabilities.ts` |
| Speed Box | Local overlay | `README.md` |
| English writing correction | AI (Groq `gpt-oss-20b`) | `packages/shared/src/ai/models.ts` |
| Manual + live translation | Google Translate and/or Groq `gpt-oss-120b` | `backend/src/providers/translationRouter.ts` |
| Hypothesis advisor + writing review | AI async (Groq → Gemini → OpenRouter fallback) | `backend/.env.example` |
| Learning profile, coach, reports, export | Pro-gated capabilities | `packages/shared/src/capabilities.ts` |
| Practice sessions | AI-backed checks | `docs/product/FREE_PLAN_LIMITS.md` |
| Account, 30-day trial, Paddle billing | Server-authoritative | `packages/shared/src/account/types.ts` |
| Student Pro (12 months) | Academic email verification | `packages/shared/src/pricing.ts`, student routes |

## Differentiating features

**FACT:**

1. **Keyboard layout repair as core identity** — competitors (Grammarly, LanguageTool) do not focus here.
2. **Arabic↔English mixed-field workflow** — translation session + layout protection of translated ranges.
3. **Local-first utilities never paywalled** — layout, Speed Box, privacy/pause/reset.
4. **Write Gate architecture** — AI never writes DOM directly; deterministic local engine + cloud assist.
5. **Google Translation path at 0 AI credits** when configured — lowers user friction on Free.

## Current product maturity

| Dimension | Status | Evidence |
| --- | --- | --- |
| Extension core | **Public beta** — textarea/input strong; contenteditable unreliable | `docs/audit/FINAL_PRODUCT_RELEASE_REPORT.md` |
| Website | Marketing + account + Writing Lab live | `docs/audit/WEBSITE_REVAMP_AUDIT.md` |
| Backend API | Deployed to VPS v1.1.0; health OK; billing **not configured** | `docs/operations/FLOWLARY_DEPLOYMENT_STATE.md` |
| Billing | Code-complete; production env missing Paddle secrets | `backend/.env.example`, deployment state |
| Store distribution | **UNKNOWN** — `CHROME_WEB_STORE_URL` optional in env | `backend/.env.example` |
| Measured user base | **UNKNOWN** — no analytics in repo | — |

## Current monetization model

**FACT:** Freemium SaaS with registration trial + Paddle subscription Pro + student verification grant.

| Plan | Price | AI allowance | Learning |
| --- | --- | --- | --- |
| **Free** | $0 | 500 AI writing checks/day | Basic |
| **Trial** | $0, 30 days, no card | 1,000 checks/day | Full Pro capabilities |
| **Pro** | $4.99/mo or $39/yr | 1,000 checks/day, 30,000/mo soft cap | Full |
| **Student Pro** | $0 for 12 months | Same as Pro | Full |

Sources: `packages/shared/src/pricing.ts`, `packages/shared/src/credits.ts`, `packages/shared/src/account/types.ts` (`ACCOUNT_TRIAL_DURATION_MS = 30 days`).

## Free / trial / paid behavior

**FACT:**

- **Free:** Local tools unlimited; AI correction/classify consume credits; Google translation does not consume credits when Google routing is active (`docs/product/FREE_PLAN_LIMITS.md`, `translationRouter.ts`).
- **Trial:** 30-day server clock; no payment card; full Pro capabilities during window.
- **Pro:** Granted via verified Paddle webhook → subscription → entitlement; soft monthly cap 30,000 credits; no overage billing.

## AI-dependent vs local features

| Local (near-zero marginal cost) | AI-dependent (Groq/Google) |
| --- | --- |
| Layout repair, Speed Box, instant spell, pause, privacy | Correction, layout AI classify, translation (Groq path), live translation, practice check, learning coach/report narration, hypothesis advisor, writing review |

## Browser / extension dependency

**FACT:** Product requires Chrome/Edge extension for core value (in-field writing). Website provides marketing, account, Writing Lab demo, web dashboard — **not** the extension writing engine (`README.md`).

## Competitor categories

**EXTERNAL BENCHMARK / INFERENCE:** Grammar checkers (Grammarly, LanguageTool, Microsoft Editor), paraphrasers (QuillBot), general AI assistants (ChatGPT), translation tools (Google Translate, DeepL). Flowlary overlaps partially with all; fully replaces none except niche “wrong keyboard layout” workflow.

---

# 2. Target Customer Analysis

Segments ranked by fit with **current** product (not TAM fantasy).

## Segment rankings

| Rank | Segment | Pain | Frequency | WTP | Acquisition | Retention | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Arabic speakers writing English daily** (professionals, diaspora) | High | Daily | Medium | Hard (niche) | Medium–High if habit forms | Core product fit |
| 2 | **International students (ESL)** | High | Daily during term | Low–Medium | Medium (edu channels) | Low (seasonal) | Student program = 12mo free Pro — **revenue-negative for best segment** |
| 3 | **Bilingual customer support / ops** | Medium | Daily | Medium | Medium | Medium | Needs reliability in CE editors — **product gap** |
| 4 | **Remote workers in MENA typing English** | Medium | Daily | Medium | Hard | Medium | Overlaps with ChatGPT/Grammarly |
| 5 | **Developers / technical writers** | Low–Medium | Variable | Low | Easy reach, low WTP | Low | Code editors blocked by design |
| 6 | **General non-native English writers** | Medium | Variable | Low–Medium | Very hard | Low | No differentiation vs Grammarly at $4.99 |
| 7 | **Researchers / academics** | Medium | Bursty | Low | Medium | Low | Translation quality not certified |

### Segment detail (top 3)

**1. Arabic↔English daily writers**

- **Pain severity:** High — layout mistakes are embarrassing and frequent.
- **Why Flowlary:** Only tool combining layout repair + in-field English + Arabic translation.
- **Why NOT:** Grammarly/LanguageTool stronger brand for pure English; ChatGPT free tier for ad-hoc help.
- **WTP:** **ASSUMPTION** $5–12/mo if habit proven; current $4.99 is accessible but leaves thin margins after Paddle fees.

**2. International students**

- **Pain severity:** High during coursework.
- **Why Flowlary:** Student program (12 months free Pro) is attractive.
- **Why NOT:** Free tier already generous (500 checks/day); student program removes revenue.
- **WTP:** **ASSUMPTION** near zero while student benefit active.

**3. Bilingual support agents**

- **Pain severity:** Medium — speed matters.
- **Why NOT:** Rich text editors (Zendesk, etc.) often contenteditable — **FACT:** CE auto-write unreliable in Chrome.

---

# 3. Competitive Positioning

## A) External facts (pricing / positioning)

| Product | Free | Paid (monthly) | Paid (annual equiv.) | Notes | Source |
| --- | --- | --- | --- | --- | --- |
| **Grammarly Pro** | Basic checks + 100 AI prompts/mo | $30/mo | ~$12/mo ($144/yr) | Market leader, English-first | Grammarly support / grammarly.com |
| **LanguageTool Premium** | 10K chars/check | ~$19.90–24.90/mo | ~$4.99/mo | Multilingual, cheaper annual | LanguageTool pricing pages |
| **QuillBot Premium** | 125 words paraphrase | $19.95/mo | ~$8.33/mo | Paraphrase-first | quillbot.com FAQ |
| **Microsoft Editor** | Basic | Included in M365 | ~$6.99/mo (Personal) | Bundled | Microsoft 365 pricing |
| **ChatGPT** | Limited free | ~$20/mo Plus | — | General assistant, not in-field | OpenAI pricing |
| **Google Translate** | Free web | API $20/M chars | — | No writing companion UX | Google Cloud pricing |

## B) Flowlary repository facts

- **List price:** $4.99/mo, $39/yr (**FACT** — `PRO_MONTHLY_PRICE_CENTS = 499`, `PRO_YEARLY_PRICE_CENTS = 3900`).
- **Position:** Niche bilingual writing companion, not full Grammarly replacement.
- **Price position:** **Below** all major grammar competitors on monthly list price; **near** LanguageTool annual on yearly plan ($3.25/mo effective).

## C) Estimates / inferences

- Flowlary **cannot win** a head-to-head English-only grammar comparison vs Grammarly brand/trust.
- Flowlary **can win** “wrong keyboard layout + mixed Arabic/English in any field” — if users discover it and the extension works in their surfaces.
- At $4.99, Flowlary signals “budget tool” — may **hurt** trust vs $12 Grammarly for professionals (**ASSUMPTION**).

---

# 4. Current Pricing Analysis

## Implemented pricing (FACT)

| Item | Value |
| --- | --- |
| Free | $0 |
| Trial | 30 days, no card, Pro capabilities |
| Pro monthly | **$4.99** |
| Pro yearly | **$39.00** (~$3.25/mo, ~35% discount vs monthly) |
| Free daily credits | 500 |
| Trial/Pro daily credits | 1,000 |
| Pro monthly soft cap | 30,000 credits |
| Credit weights | Correction/classify/practice = 1; translation/live = 2 |
| Billing provider | Paddle (sandbox default) |
| Catalog validation | Server validates amounts match approved cents |

## Entitlement rules (FACT)

- Pro from Paddle webhook only (plus student verification, trial clock).
- Install tokens **denied** for managed AI (`docs/production/PHASE20_PADDLE_BILLING.md`).
- Capabilities gate learning.full, export, advanced progress on Free.

## Revenue infrastructure readiness vs product readiness

| Layer | Status |
| --- | --- |
| **Product readiness** | Partial — core extension works on input/textarea; billing UX exists; credits enforced server-side |
| **Revenue infrastructure** | **NOT READY in production** — **FACT:** deployment state documents missing `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN`; API started with `billingConfigured: false` |
| **Can users pay today?** | **UNKNOWN in live production** — code supports checkout when env configured; production secrets absent in documented deploy |

## Economic sensibility of $4.99

**CALCULATED / ASSUMPTION:**

- Paddle MoR fee ~5% + $0.50 (**EXTERNAL BENCHMARK**) → **~$0.75 fee on $4.99 = 15% of revenue** before AI/infra.
- At low price, **fixed $0.50 dominates** — economically painful.
- $4.99 is sensible for **acquisition** and student-adjacent segments; **weak for unit economics** unless usage stays low and churn is low.

## Alternative price points (modeling only — not recommending code changes)

| Price | Paddle fee (5%+$0.50) | Fee as % of revenue | Notes |
| --- | ---: | ---: | --- |
| $5 | $0.75 | 15.0% | Current rounded |
| $8 | $0.90 | 11.3% | Better fee ratio |
| $10 | $1.00 | 10.0% | Aligns with old sandbox docs ($9) |
| $12 | $1.10 | 9.2% | Grammarly annual anchor |
| $15 | $1.25 | 8.3% | Premium niche |
| $20 | $1.50 | 7.5% | ChatGPT-adjacent |

---

# 5. AI Cost Model

## Operations that call an LLM (FACT)

| Operation | Provider | Model | Credit weight | maxTokens (typical) |
| --- | --- | --- | ---: | ---: |
| Writing correction | Groq | `openai/gpt-oss-20b` | 1 | 4000 |
| Practice check | Groq | same | 1 | 4000 |
| Layout classify | Groq | `allam-2-7b` | 1 | 120 |
| Manual/live translation (Groq path) | Groq | `openai/gpt-oss-120b` | 2 | 1200 |
| Translation (Google path) | Google | NMT v3 | 0 credits | chars |
| Hypothesis advisor | Groq/Gemini/OpenRouter | `gpt-oss-20b` default | 1 | 512 |
| Writing review | Groq → fallback chain | `gpt-oss-20b` | 1 | configurable |
| Learning coach / report | Groq | `gpt-oss-20b` | separate client quotas | — |
| Explanation localize | Groq | correction model | 1 | — |

## Local / deterministic (no LLM cost)

Layout remap, Speed Box, instant spelling, decideWriting, Write Gate, learning event capture (local), caching/dedup logic.

## Cost controls (FACT)

- Daily + monthly credit caps; rate limits (Free 45 RPM, Pro 120 RPM per operation class).
- Reserve → call → finalize/refund on failure.
- Translation cache 60 min; correction cache 15 min.
- Segmentation caps input at 2,000 chars.
- Google Translate when configured: **no credit debit** but **Google bill**.

## External token prices used in model (EXTERNAL BENCHMARK)

| Model | Input / 1M | Output / 1M |
| --- | ---: | ---: |
| `gpt-oss-20b` | $0.075 | $0.30 |
| `gpt-oss-120b` | $0.15 | $0.60 |
| Google NMT | $20 / 1M **characters** | — |
| `allam-2-7b` | **UNKNOWN** — not on public Groq price table | — |

## Token assumptions (ASSUMPTION — not production-measured)

| Operation | Input tokens | Output tokens |
| --- | ---: | ---: |
| Correction (typical) | 550 | 180 |
| Correction (heavy) | 1,200 | 400 |
| Translation Groq (typical) | 450 | 220 |
| Layout classify | 90 | 45 |
| Advisor/review (async, per typing session) | 400 | 120 |

**FACT:** `recordAiUsage` stores tokens in memory (10K ring buffer) but **no aggregate cost dashboard** exists — production averages are **UNKNOWN**.

## Cost per operation (CALCULATED)

| Operation | Typical $/call | Label |
| --- | ---: | --- |
| Correction | $0.000095 | CALCULATED |
| Translation (Groq) | $0.000200 | CALCULATED |
| Translation (Google, 180 chars) | $0.000004 | CALCULATED |
| Layout classify | **~$0.00001** | ASSUMPTION (model price unknown) |
| Advisor + review (combined, per active day) | $0.00015 | CALCULATED |

## Usage scenarios — AI cost per user per month

### Definitions

- **Active user:** Uses AI ≥1 day/week.
- **Paying user:** Pro subscriber (may use less than free tier max).

| Scenario | Daily behavior | Monthly AI checks | Est. AI $/user/mo | Primary cost drivers |
| --- | --- | ---: | ---: | --- |
| **LOW** | 10 corrections, 1 translation (Google), no live | ~330 | **$0.04** | Correction only |
| **MEDIUM** | 25 corrections, 3 translations, occasional live | ~900 | **$0.12** | Correction + some Groq translation |
| **HEAVY (Free max)** | 500 credits/day fully used (mixed) | ~15,000 | **$1.50–2.50** | Theoretical ceiling — rare |
| **HEAVY (Pro max)** | 1,000/day avg, 30K/mo cap | 30,000 | **$2.50–4.00** | Translation-heavy approaches upper bound |

### Per paying Pro user (typical — ASSUMPTION)

Many subscribers under-utilize. **CALCULATED:**

| Pro usage | AI $/mo |
| --- | ---: |
| Light payer (10 checks/day) | $0.05 |
| Medium payer (40 checks/day) | $0.25 |
| Heavy payer (200+ checks/day) | $1.20 |
| Power payer (near 30K/mo cap) | $3.50 |

**CRITICAL UNKNOWN:** Actual token mix from production logs. **Required measurement:** export 30 days of `recordAiUsage` aggregated by plan × operation × tokens.

---

# 6. Infrastructure Cost

## Architecture (FACT)

- Single Node API on shared Contabo VPS (`169.58.11.99`) beside ZAIXOS.
- Static website via nginx; JSON file store (single process); no Redis/Postgres for Flowlary.
- External: Groq, optional Google Translate, Paddle, SMTP.

## Fixed monthly costs (Flowlary incremental)

| Item | Est. $/mo | Label |
| --- | ---: | --- |
| VPS incremental share (4 vCPU / 8GB shared) | $3–8 | ASSUMPTION — allocate 15–25% of ~$6.60 VPS |
| Domain (flowlary.com + api) | $1–2 | ASSUMPTION |
| SMTP (transactional email) | $0–10 | UNKNOWN — not configured in deploy doc |
| Monitoring/logging SaaS | $0 | FACT — none in repo |
| Paddle platform fee | $0 | EXTERNAL BENCHMARK — pay-as-you-go cited as no monthly minimum |
| **Total fixed (minimal)** | **$5–20** | CALCULATED |

Do **not** attribute full VPS (~$6.60) to Flowlary — **FACT:** ZAIXOS shares host.

## Variable cost per user (ASSUMPTION)

| Scale | Incremental infra $/user/mo |
| --- | ---: |
| 10–100 users | ~$0.05 |
| 500–1,000 | ~$0.02 |
| 5,000+ | ~$0.01–0.03 (may require DB migration — one-time eng cost) |

## Infrastructure cost by user count (CALCULATED)

Fixed base **$10/mo** assumed; variable **$0.03/user** at low scale.

| Paying + free active users | Est. infra $/mo |
| --- | ---: |
| 10 | $11 |
| 50 | $12 |
| 100 | $13 |
| 500 | $25 |
| 1,000 | $40 |
| 5,000 | $160 |
| 10,000 | $310 |

At 10K users, JSON store and single-process API likely **require redesign** — **FACT** from billing docs (BLOCKED_FOR_PRODUCTION for horizontal scale).

---

# 7. Payment Fees

**Provider:** Paddle (**FACT** in code).

**Fee model used in calculations:** 5% + $0.50 per successful subscription charge (**EXTERNAL BENCHMARK** — confirm in Paddle dashboard; rates may be negotiated).

| Price | Fee | Net before AI/infra |
| --- | ---: | ---: |
| $4.99 | $0.75 | $4.24 |
| $8.00 | $0.90 | $7.10 |
| $10.00 | $1.00 | $9.00 |
| $12.00 | $1.10 | $10.90 |
| $15.00 | $1.25 | $13.75 |
| $20.00 | $1.50 | $18.50 |

**ASSUMPTION:** 2% monthly failed payment / refund drag → add ~2% effective revenue loss at scale.

**Note:** Yearly $39 charge → fee ~$2.45 per year per sub ($0.20/mo amortized) — better than monthly.

---

# 8. Unit Economics

## Base case parameters

- **Price modeled:** $4.99/mo (FACT current price)
- **Paddle fee:** $0.75
- **Infra variable:** $0.03/user

### Gross profit per customer (CALCULATED)

Formula: `Revenue − AI − infra − payment fees`

| Price | Usage | AI $ | Gross profit | Gross margin |
| ---: | --- | ---: | ---: | ---: |
| $4.99 | LOW | $0.05 | **$4.16** | 83% |
| $4.99 | MEDIUM | $0.25 | **$3.96** | 79% |
| $4.99 | HEAVY | $3.50 | **$0.71** | 14% |
| $8.00 | MEDIUM | $0.25 | **$6.82** | 85% |
| $10.00 | MEDIUM | $0.25 | **$8.72** | 87% |
| $12.00 | MEDIUM | $0.25 | **$10.52** | 88% |
| $15.00 | MEDIUM | $0.25 | **$13.37** | 89% |
| $20.00 | MEDIUM | $0.25 | **$18.22** | 91% |
| $10.00 | HEAVY | $3.50 | **$5.47** | 55% |

**Insight:** Unit economics work **if** Pro users stay medium/low AI usage. Heavy Pro users at $4.99 are **margin-dangerous**.

---

# 9. Customer Acquisition Cost

**FACT:** No CAC data in repository.

| Channel | LOW CAC | BASE CAC | HIGH CAC | Label |
| --- | ---: | ---: | ---: | --- |
| Word of mouth / community (Arabic dev/writer) | $0 | $5 | $15 | ASSUMPTION |
| Chrome Web Store organic | $5 | $20 | $60 | ASSUMPTION |
| SEO / content (long cycle) | $10 | $40 | $100 | ASSUMPTION |
| Reddit / communities | $5 | $25 | $80 | ASSUMPTION |
| YouTube / creator | $15 | $50 | $150 | ASSUMPTION |
| Google Search (writing assistant) | $40 | $80 | $200+ | ASSUMPTION — competitive |
| Meta/TikTok | $30 | $70 | $180 | ASSUMPTION |

### CAC payback (CALCULATED)

Using **$4.99 price, MEDIUM usage, gross profit $3.96/mo:**

| CAC | Payback months |
| ---: | ---: |
| $15 | 3.8 |
| $30 | 7.6 |
| $50 | 12.6 |
| $80 | 20.2 |

Paid search at BASE CAC $80 → **~20 month payback** — likely **unprofitable** after churn.

---

# 10. Conversion Funnel

**FACT:** No measured funnel data exists.

## PESSIMISTIC (ASSUMPTION)

| Stage | Rate | Rationale |
| --- | ---: | --- |
| Impression → click | 1.5% | Niche product, weak brand |
| Click → site visitor | 90% | Normal |
| Visitor → signup | 8% | Extension-friction product |
| Signup → activated (install + 1 AI action) | 35% | Install drop-off |
| Activated → trial start | 80% | Auto on register |
| Trial → paid (within 90 days) | 2% | Weak differentiation vs free tier |
| Free → paid (no trial conversion) | 1% | 500 checks/day reduces urgency |

**Example:** 100,000 impressions → 1,350 activations → **~27 paying** over time.

## BASE (ASSUMPTION)

| Stage | Rate |
| --- | ---: |
| Impression → click | 3% |
| Visitor → signup | 15% |
| Signup → activated | 50% |
| Trial → paid | 5% |

100,000 impressions → 2,250 activations → **~112 paying**.

## OPTIMISTIC (ASSUMPTION)

| Stage | Rate |
| --- | ---: |
| Impression → click | 5% |
| Visitor → signup | 22% |
| Signup → activated | 65% |
| Trial → paid | 10% |

100,000 impressions → 7,150 activations → **~715 paying** — requires strong PMF not evidenced today.

---

# 11. Retention + Churn

**UNKNOWN:** Flowlary churn — no subscribers yet at scale.

| Scenario | Monthly churn | Avg lifetime (mo) | Label |
| --- | ---: | ---: | --- |
| HIGH churn | 12% | 8.3 | ASSUMPTION — weak PMF writing tools |
| BASE churn | 7% | 14.3 | ASSUMPTION |
| LOW churn | 4% | 25.0 | ASSUMPTION — habit + niche lock-in |

### LTV (CALCULATED)

`LTV ≈ Monthly gross profit / monthly churn` (simplified SaaS — ignores expansion, annual prepay, discounting).

Using gross profit **$3.96** ( $4.99, medium usage):

| Churn | LTV |
| ---: | ---: |
| 12% | $33 |
| 7% | $57 |
| 4% | $99 |

**Limitation:** Pre-revenue product — LTV is scenario-only.

---

# 12. LTV / CAC

| Scenario | CAC | LTV (7% churn) | LTV/CAC | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Organic LOW | $5 | $57 | **11.4x** | Healthy if real |
| Chrome store BASE | $20 | $57 | **2.9x** | Borderline |
| Content SEO BASE | $40 | $57 | **1.4x** | Weak |
| Paid search BASE | $80 | $57 | **0.7x** | Losing money |

Guideline: <1x lose; 1–2x weak; 2–3x questionable; 3x+ healthier.

---

# 13. Break-Even Analysis

**Fixed costs assumed:** $10/mo minimal → **$50/mo** realistic (email, ops time amortized, domain, VPS share).

**Gross profit per customer:** $3.96 ( $4.99, medium usage).

| Fixed $/mo | Break-even paying customers |
| ---: | ---: |
| $10 | 3 |
| $50 | 13 |
| $100 | 26 |
| $250 | 64 |

### Break-even by price (MEDIUM usage, $50 fixed)

| Price | Gross profit | Break-even customers |
| ---: | ---: | ---: |
| $4.99 | $3.96 | **13** |
| $8.00 | $6.82 | **8** |
| $10.00 | $8.72 | **6** |
| $12.00 | $10.52 | **5** |
| $15.00 | $13.37 | **4** |
| $20.00 | $18.22 | **3** |

### MRR targets (CALCULATED, $4.99 price)

| MRR target | Paying customers needed |
| ---: | ---: |
| $100 | 21 |
| $500 | 101 |
| $1,000 | 201 |
| $2,500 | 502 |
| $5,000 | 1,003 |
| $10,000 | 2,005 |
| $25,000 | 5,013 |
| $50,000 | 10,020 |

---

# 14. Revenue Scenarios

Using **$4.99/mo** unless noted. AI = medium payer $0.25 unless scaled. Infra = $10 + $0.03×users.

| Paying users | MRR | ARR | AI cost | Infra | Paddle fees | Gross profit | Net op profit* |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | $50 | $600 | $3 | $11 | $8 | $28 | $18 |
| 25 | $125 | $1,500 | $6 | $11 | $19 | $89 | $79 |
| 50 | $250 | $3,000 | $13 | $12 | $38 | $187 | $177 |
| 100 | $499 | $5,988 | $25 | $13 | $75 | $386 | $376 |
| 250 | $1,248 | $14,970 | $63 | $18 | $188 | $979 | $969 |
| 500 | $2,495 | $29,940 | $125 | $25 | $375 | $1,970 | $1,960 |
| 1,000 | $4,990 | $59,880 | $250 | $40 | $750 | $3,950 | $3,940 |
| 2,500 | $12,475 | $149,700 | $625 | $85 | $1,875 | $9,890 | $9,880 |
| 5,000 | $24,950 | $299,400 | $1,250 | $160 | $3,750 | $19,790 | $19,780 |
| 10,000 | $49,900 | $598,800 | $2,500 | $310 | $7,500 | $39,590 | $39,580 |

\*Net op profit before founder salary/taxes — assumes no paid marketing spend.

### Same paying users at $10/mo (MEDIUM usage)

| Paying | MRR | Gross profit (est.) |
| ---: | ---: | ---: |
| 100 | $1,000 | ~$850 |
| 500 | $5,000 | ~$4,250 |
| 1,000 | $10,000 | ~$8,500 |

---

# 15. Minimum Realistic Revenue

## THEORETICAL MINIMUM

**$0/mo** — if billing stays unconfigured, store never ships, or PMF absent.

## PRACTICAL LOW-END OUTCOME (weak PMF, reasonable effort)

**ASSUMPTION:** Founder ships extension, fixes billing, modest organic marketing 6–12 months, no paid ads.

| Outcome | Paying users | MRR | Likelihood basis |
| --- | ---: | ---: | --- |
| **Floor practical** | 5–15 | **$25–$75** | Friends, early adopters, 1–2 community posts |
| **Weak but alive** | 20–50 | **$100–$250** | Chrome store + word of mouth in Arabic/English niches |
| **Modest traction** | 50–100 | **$250–$500** | Requires retention proof + repeatable install funnel |

**Minimum plausible revenue (12 months, weak PMF):** **~$50–150 MRR** (**ASSUMPTION** — not a forecast).

Free tier generosity (500 checks/day) + 30-day trial + student program **suppress** conversion — **FACT** from product design.

---

# 16. Probability / Outcome Tree

**Probability cannot be reliably estimated before market validation.** Ranges below are **judgment scenarios**, not statistics.

| Scenario | Condition | Paying users (12–18 mo) | MRR @ $4.99 | Probability |
| --- | --- | ---: | ---: | --- |
| **A — Fail PMF** | Extension store rejection, retention <20% D30, no organic growth | 0–10 | $0–$50 | Cannot estimate |
| **B — Weak PMF** | Niche community adoption, high churn | 20–80 | $100–$400 | Cannot estimate |
| **C — Moderate PMF** | Chrome store discovery + Arabic/English word of mouth | 100–400 | $500–$2,000 | Cannot estimate |
| **D — Strong PMF** | Becomes default tool for bilingual writers in target regions | 1,000–3,000 | $5k–$15k | Cannot estimate |

### Experiments to reduce uncertainty

1. Enable production billing → measure trial→paid over 60 days.
2. Instrument funnel (see §20) → 500 activated users minimum.
3. Chrome Web Store publish → measure organic installs/week.
4. Cohort D7/D30 retention on “first successful correction.”
5. Token cost telemetry → validate AI model.

---

# 17. Advertising Economics

Monthly ad spend vs outcomes at **$4.99**, **BASE CAC $50**, **gross profit $3.96/customer**, **7% monthly churn**.

| Ad spend/mo | Customers acquired | MRR added | Gross profit/mo | Net contribution | Payback |
| ---: | ---: | ---: | ---: | ---: | ---: |
| $100 | 2 | $10 | $8 | **−$92** | 12.6 mo |
| $250 | 5 | $25 | $20 | **−$230** | 12.6 mo |
| $500 | 10 | $50 | $40 | **−$460** | 12.6 mo |
| $1,000 | 20 | $100 | $79 | **−$921** | 12.6 mo |
| $2,000 | 40 | $200 | $158 | **−$1,842** | 12.6 mo |
| $5,000 | 100 | $499 | $396 | **−$4,604** | 12.6 mo |

**When advertising becomes destructive:** At BASE CAC $50 and gross profit $3.96, **any month where CAC > $3.96** loses money on first-month contribution. Payback ~13 months — **unsafe** unless churn <4% and LTV > $100.

Advertising only makes sense if CAC < **$15–25** (organic-like) or price rises toward **$10+**.

---

# 18. Organic vs Paid Growth

| Channel | Fit for Flowlary | Cost | Recommendation |
| --- | --- | --- | --- |
| **Chrome Web Store** | High — product is extension | Low | **Test first** |
| **Arabic/English communities** (Reddit, X, Discord, dev forums) | High | Low | **Test first** |
| **SEO / content** | Medium — long cycle | Medium | Test after funnel instrumented |
| **YouTube demos** | Medium — visual product | Medium | Optional |
| **Product Hunt** | Medium — one-time spike | Low | Single launch experiment |
| **Google/Meta paid** | Low until PMF | High | **Do not scale now** |

### First 2–3 channels to test

1. **Chrome Web Store** listing + screenshots focused on layout repair niche.
2. **Community seeding** in Arabic/English bilingual writer spaces (authentic demos, not ads).
3. **Writing Lab + trial funnel** on website with full analytics.

**Do not spend >$100/mo on ads** until trial→paid and D30 retention are measured.

---

# 19. First $100 / $500 / $1,000 / … MRR

**SCENARIO, NOT FORECAST** — at **$4.99/mo**.

| MRR | Paying customers | Activated users (5% trial→paid, BASE) | Site visitors (15% signup × 50% activate) | Effort sketch | Time range |
| ---: | ---: | ---: | ---: | --- | --- |
| $100 | 21 | ~420 | ~5,600 | Store launch + 2–3 community posts | 3–9 mo |
| $500 | 101 | ~2,020 | ~27,000 | Consistent content + store ASO | 6–18 mo |
| $1,000 | 201 | ~4,020 | ~54,000 | Niche influencer + retention fixes | 9–24 mo |
| $2,500 | 502 | ~10,040 | ~134,000 | Strong PMF + word of mouth | 12–36 mo |
| $5,000 | 1,003 | ~20,060 | ~268,000 | Category leader in niche | 18–48 mo |
| $10,000 | 2,005 | ~40,100 | ~535,000 | Multiple channels working | 24–60 mo |

---

# 20. Product-Market-Fit Metrics

Must instrument **before serious advertising**:

| Metric | Good signal (industry) | Bad signal | Flowlary evidence |
| --- | --- | --- | --- |
| Extension installs/week | Rising WoW | Flat after launch spike | **UNKNOWN** |
| Visitor → signup | 15–25% | <8% | **UNKNOWN** |
| Signup → activation (1st AI check) | >50% | <30% | **UNKNOWN** |
| D1 retention | >40% | <20% | **UNKNOWN** |
| D7 retention | >25% | <10% | **UNKNOWN** |
| D30 retention | >15% | <5% | **UNKNOWN** |
| Trial → paid (30d) | 5–15% | <2% | **UNKNOWN** |
| Free → paid | 2–5% | <1% | **UNKNOWN** |
| Monthly churn (paid) | <5% | >10% | **UNKNOWN** |
| AI cost / active user | Stable or falling | Rising unbounded | **UNKNOWN** |
| Gross margin | >70% | <50% | Model says OK if usage capped |
| NPS / support tickets | Low complaint rate | Quality backlash | **UNKNOWN** |

**Flowlary-specific leading indicator:** **Weekly users completing ≥1 layout fix OR correction** in real sites (not lab).

---

# 21. What Must Be Fixed Before Advertising

## P0 — before charging users

| Item | Commercial impact | Evidence |
| --- | --- | --- |
| **Configure production Paddle** (API key, webhook, client token, live prices) | Cannot collect revenue | `FLOWLARY_DEPLOYMENT_STATE.md` |
| **SMTP for verification email** | Signup drop-off | Deploy doc: SMTP missing |
| **Prove checkout → Pro entitlement end-to-end in production** | Trust + legal | Phase 20 billing docs |
| **Token/cost telemetry export** | Cannot validate margins | `usage.ts` in-memory only |

## P1 — before paid acquisition

| Item | Commercial impact |
| --- | --- |
| Chrome Web Store public listing | Distribution |
| Funnel analytics (Plausible/PostHog/etc.) | CAC/LTV measurement |
| D7/D30 retention baseline | Kill bad ad spend early |
| Contenteditable reliability OR clear “supported surfaces” messaging | Reduces churn/refunds |
| Student program economics review (12mo free Pro) | Erodes best segment WTP |

## P2 — after initial traction

| Item | Commercial impact |
| --- | --- |
| JSON store → database | Scale + billing reliability |
| Pricing test ($8–12) | Margin improvement |
| Annual plan promotion | Lower Paddle fee ratio |
| Learning differentiation in marketing | Conversion lift |
| Referral program | CAC reduction |

---

# 22. Commercial Risks

Ranked by **Impact × Probability** (qualitative).

| Rank | Risk | Impact | Probability | Notes |
| ---: | --- | --- | --- | --- |
| 1 | **No PMF / weak retention** | Very high | High | Writing tools churny; free tier very generous |
| 2 | **Grammarly + ChatGPT “good enough”** | High | High | English correction commoditized |
| 3 | **Billing not live / store not shipped** | High | Medium (now) | Blocks all revenue |
| 4 | **Low price + Paddle $0.50 fee** | Medium | High | 15% payment tax at $4.99 |
| 5 | **Chrome extension distribution dependency** | High | Medium | Store policies, reviews |
| 6 | **Student program removes revenue** | Medium | Medium | 12mo free Pro |
| 7 | **Heavy Pro users near 30K cap** | Medium | Low–Medium | Credits cap mitigates |
| 8 | **Contenteditable gap** | Medium | Medium | Limits professional use |
| 9 | **Trust/privacy concerns (AI writing)** | Medium | Medium | Enterprise blockers |
| 10 | **Single-process JSON store at scale** | High | Low (early) | Becomes likely >1K paid |

---

# 23. What Would Make Flowlary a Good Business?

Using **$4.99** and **medium gross profit $3.96/customer/mo**.

| Target | MRR | Paying customers | What must be true |
| --- | ---: | ---: | --- |
| **A — $500** | $500 | **101** | Billing live; ~2–3 installs/day; 5% trial→paid; churn ≤10% |
| **B — $1,000** | $1,000 | **201** | Chrome store discovery; D30 retention ≥10%; clear niche word-of-mouth |
| **C — $5,000** | $5,000 | **1,003** | Moderate PMF; CAC <$25 organic; possibly raise price or push annual |
| **D — $10,000** | $10,000 | **2,005** | Strong PMF in Arabic/English segment; retention ≤5% churn; optional $8–10 price |
| **E — $25,000** | $25,000 | **5,013** | Category ownership OR price increase + team/edu channel WITHOUT giving Pro free |

---

# 24. Final Honest Assessment

1. **Commercially viable in principle?** **Yes, marginally** — AI costs are low with credit caps; niche differentiation exists. Economics tighten at $4.99 + Paddle fees.
2. **Currently proven commercially?** **No.** Billing not configured in documented production; no user/revenue metrics in repo.
3. **Biggest unknown?** Trial→paid conversion and D30 retention with generous Free tier.
4. **Biggest technical risk?** Contenteditable/unreliable rich-text surfaces + single-process JSON store at scale.
5. **Biggest business risk?** Commoditized English writing assistance vs Grammarly/ChatGPT; weak reason to pay beyond niche layout/Arabic workflow.
6. **Minimum plausible revenue?** **$25–$75 MRR** (5–15 paying users) after launch with weak PMF (**ASSUMPTION**).
7. **Reasonable weak outcome?** **$100–$300 MRR**, 20–60 paying users, high churn.
8. **Reasonable base scenario?** **$500–$1,500 MRR**, 100–300 paying, organic-led, 12–24 months.
9. **Strong scenario?** **$5,000–$15,000 MRR**, 1,000–3,000 paying, niche category leader.
10. **Reach $1,000 MRR?** Live billing + Chrome store + ~200 paying @ $4.99 OR ~100 @ $10; prove 5%+ trial→paid; D30 retention >10%.
11. **Reach $10,000 MRR?** ~2,000 paying @ $4.99 with ≤5% churn OR price increase; repeatable acquisition; product works in top user surfaces.
12. **Spend heavily on advertising now?** **No.**
13. **Validate first?** Checkout works; store installs; activation; D7/D30 retention; trial→paid.
14. **Single most important metric?** **Weekly activated writers** (≥1 successful correction or layout fix in production sites).
15. **Biggest reason users might NOT pay?** Free tier (500 checks/day) + ChatGPT/Grammarly already solve English; student program for target demographic.

---

# 25. Executive Numbers

Base modeling: **$4.99/mo** current price; gross profit uses medium AI unless noted.

| Metric | Low | Base | High |
| --- | ---: | ---: | ---: |
| Monthly price | $4.99 | $4.99 | $10.00 (scenario) |
| AI cost/user/mo (paying) | $0.05 | $0.25 | $3.50 |
| Gross profit/user/mo | $0.71 | $3.96 | $8.72 @ $10 |
| CAC | $5 | $30 | $80 |
| Monthly churn | 12% | 7% | 4% |
| LTV | $33 | $57 | $99 |
| LTV/CAC | 0.7x–6.6x | 1.9x | 11.4x |
| Break-even customers ($50 fixed) | 3 @ min cost | **13** | 64 @ heavy+fixed |
| $1k MRR customers | — | **201** | 100 @ $10 |
| $5k MRR customers | — | **1,003** | 500 @ $10 |
| $10k MRR customers | — | **2,005** | 1,000 @ $10 |

---

# FINAL VERDICT

## **PROMISING BUT UNPROVEN**

Flowlary occupies a **defensible niche** (Arabic/English layout + in-field writing) with **technically bounded AI costs** and a **functional freemium model**. Unit economics can work at current Groq pricing **if** users do not saturate Pro caps and payment fees are managed (annual plans, higher price tests).

The business is **not commercially proven**: production billing is documented as unconfigured, no real conversion/retention data exists, the price point is low relative to Paddle fees, and the free/student/trial stack aggressively delays monetization.

**Do not scale paid acquisition** until billing is live and **≥100 activated users** provide retention and conversion measurements.

---

# Appendix A — Files Inspected

- `README.md`, `docs/README.md`
- `packages/shared/src/pricing.ts`, `credits.ts`, `capabilities.ts`, `account/types.ts`, `ai/models.ts`
- `backend/.env.example`, `backend/src/billing/`, `backend/src/providers/translationRouter.ts`, `correctionProvider.ts`, `groqClient.ts`
- `backend/src/services/usage.ts`, `accountService.ts`, `middleware/rateLimit.ts`
- `docs/product/FREE_PLAN_LIMITS.md`, `CAPABILITIES.md`
- `docs/production/PHASE20_PADDLE_BILLING.md`, `docs/backend/BILLING.md`
- `docs/operations/FLOWLARY_DEPLOYMENT_STATE.md`, `FLOWLARY_DEPLOYMENT_ARCHITECTURE.md`, `FLOWLARY_LOCAL_LLM_ARCHITECTURE_AUDIT.md`
- `docs/monetization/PHASE24_COST_MODEL.md`, `PHASE25_PRICING_MATRIX.md`, `PHASE30_PRICING_FORENSIC_AUDIT.md`
- `docs/audit/FINAL_PRODUCT_RELEASE_REPORT.md`, `FINAL_REAL_PRODUCT_REPORT.md`, `WEBSITE_REVAMP_AUDIT.md`
- `website/src/i18n/en.ts`, `extension/` structure (via docs)

# Appendix B — External Sources

- Groq model pricing: console.groq.com/docs, third-party summaries (CloudZero, Layer3Labs, GroqDocs prompt caching)
- Grammarly Pro pricing: support.grammarly.com, grammarly.com/plans
- LanguageTool / QuillBot pricing: vendor sites and comparison articles (2026)
- Google Cloud Translation pricing: cloud.google.com/products/translate/pricing
- Paddle fees: StackScored, CostBench, UniBee (5% + $0.50 cited — verify with Paddle)
- Contabo VPS 10 pricing: ~$6.60/mo (CyberNews, Contabo, 2026)
- SaaS churn benchmarks: general industry assumptions (not Flowlary-specific)

# Appendix C — Remains UNKNOWN (measurement required)

| Unknown | Data needed |
| --- | --- |
| Live production billing status today | Hit `/ready` + `/api/billing/config` on production |
| Real user counts (free/trial/paid) | Database/store export |
| Actual tokens per operation | Aggregate `recordAiUsage` / Groq invoices |
| Trial→paid conversion | 60-day cohort after billing live |
| D1/D7/D30 retention | Product analytics |
| Chrome Web Store installs/reviews | Developer dashboard |
| Effective Paddle fee rate | Paddle seller agreement |
| Google Translate enabled in production? | Production env |
| `allam-2-7b` unit cost | Groq console |
| CAC by channel | Tagged acquisition + spend tracking |

---

*End of audit.*
