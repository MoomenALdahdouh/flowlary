# GPT-OSS-20B Live Shadow Evaluation Report

**DATE:** 2026-08-31  
**SCOPE:** Measure whether Groq `openai/gpt-oss-20b` can rank locally generated hypotheses. Shadow only. No LLM writes.  
**NOT IN SCOPE:** Gemini, OpenRouter, fallback, voting, routing, UI, Write Gate, Hypothesis Generation V2, translation, enabling apply, prompt/threshold/dataset changes.

---

## Re-run note (new Groq credentials)

A prior run on the same frozen harness produced **0 valid ranks / 270** (264×429, 6×invalid). That run was **provider/quota-bound**, not a model-quality result.

This report documents a **reproduction** with a **new Groq account / API key** loaded via `backend/.env` (existing `loadBackendEnvFile` / eval key loader). 

**No code, prompt, packet, trigger, dataset, seed, holdout, or architecture changes** were made for this re-run.

| Item | Value |
|---|---|
| NEW GROQ CREDENTIALS DETECTED | **YES** (key present in `backend/.env`; length OK; eval `configured: true`) |
| Model | `openai/gpt-oss-20b` (unchanged) |
| Dataset | frozen seed **20261107**, 5500 cases, holdout **1326** |
| Valid ranks | **1 / 270** |
| Still insufficient? | **YES** (&lt; 200) |

---

## 1. Objective

Answer only:

> Does Groq `openai/gpt-oss-20b` correctly rank the locally generated hypotheses?

## 2. Model

`openai/gpt-oss-20b` (`AI_MODELS.HYPOTHESIS_ADVISOR`)

## 3. Provider

Groq Chat Completions via existing `callGroqChat`. No second client.

## 4. Configuration

Frozen (unchanged for re-run):

| Setting | Value |
|---|---|
| Provider | Groq |
| Model | `openai/gpt-oss-20b` |
| Temperature | `0` |
| maxTokens | `180` |
| Response format | `json_object` |
| `include_reasoning` | `false` |
| Connect timeout | 10s |
| Request timeout | `FLOWLARY_AI_TIMEOUT_MS` default 30s |
| Apply mode | **shadow** |
| Prompt / packet / triggers | **frozen** |

## 5. Production request path

Unchanged:

1. `registerProductionHypothesisAdvisor()` (shadow)
2. `RANK_HYPOTHESES` → `POST /api/ai/hypothesis-advisor`
3. `runHypothesisAdvisorProvider` → `callGroqChat` (`openai/gpt-oss-20b`)
4. ID-only parse → shadow compare; Write Gate uses **baseline**

Bulk ranking used the same provider path. One successful provider call returned `model: openai/gpt-oss-20b`.

HTTP smoke in this re-run: `httpOk: false` (gateway probe did not return success in-harness). Provider path still reached Groq (400/429/1 ranked).

## 6–8. Dataset / split (frozen)

- Generator: `tests/unit/writing-engine/gpt-oss-20b-shadow/generate.ts`
- Seed **20261107** — **not regenerated**
- **5500** cases; holdout **N = 1326**
- Live pool: same stratified caps (layout 120, mixed 50, spelling 50, technical 30, punctuation 30, short 20)
- Stop at 200 valid ranks — **not reached**
- 429: recorded; **1.5s pause**; **no aggressive retries**

## 9. Gold-label methodology

Unchanged. Evaluator-owned gold. Missing local gold hyp → `MISSING_LOCAL_HYPOTHESIS` (not Groq ranking failure).

## 10. Hypothesis existence

Holdout: **89.37%**. Live pool missing local gold: **30**.

## 11. Local baseline (holdout N=1326)

Unchanged (local-only; no Groq):

| Metric | Value |
|---|---|
| Action accuracy | **87.03%** |
| Layout recall | **75.81%** |
| Layout FP | **0** |
| Layout FN | **172** |
| Mixed-family layout FP | **0** |
| Protected-pattern layout FP | **0** |
| Correct abstention | **100%** |
| Production consult rate | **1.21%** |

## 12. Groq valid ranking count

**1** of **270** provider attempts.

**INSUFFICIENT VALID LLM SAMPLES** (target ≥ 200).

## 13–16. Ranking accuracy / delta

| Metric | On the 1 valid rank | Statistically useful? |
|---|---|---|
| Top-1 (intent match) | **1 / 1 = 100%** | **NO** — n=1 |
| Top-2 | **1 / 1 = 100%** | **NO** |
| Selected gold ID | **1 / 1** | **NO** |
| Final advised accuracy | **1 / 1** (noop / preserve) | **NO** |
| Accuracy delta vs baseline | **UNKNOWN** | insufficient n |

**Do not claim gpt-oss-20b improves ranking.** One mixed-family preserve vote that matched gold is not a quality conclusion.

### Primary comparison table

| Metric | Local Baseline | GPT-OSS-20B Advisor | Delta |
|---|---|---|---|
| Action accuracy | **87.03%** (holdout) | **n/a** (n=1 only) | **unknown** |
| Top-1 ranking | — | 1/1 (not meaningful) | unknown |
| Top-2 ranking | — | 1/1 (not meaningful) | unknown |
| Layout FN | 172 | n/a | unknown |
| Layout FP | 0 | 0 advised | — |
| Mixed-language FP | 0 | **0** advised writes | — |
| Correct abstention | 100% | n/a | unknown |
| JSON success | — | **0.37%** (1/270) | — |

## 17–21. Layout / mixed / technical / short / abstention

Same local baseline as above. Groq did not produce enough ranks to change layout metrics.  
Live advised mix `layout_fix`: **0**.  
Correct abstention (local): **100%**.

## 22–26. Reliability (this re-run)

| Metric | Value |
|---|---|
| JSON / valid-rank success | **1 / 270 = 0.37%** |
| Invalid response | **5 / 270 = 1.85%** |
| Timeout | **0** |
| 429 | **264 / 270 = 97.78%** |
| Other | **0** |
| LLM failure rate | **269 / 270 = 99.63%** |

### Failure classification (mandatory separation)

| Class | Count | Notes |
|---|---|---|
| **A. PROVIDER FAILURE** | 269 | 264×`rate_limited` + 5×`invalid_response` |
| **B. MODEL RANKING FAILURE** | 0 | no wrong valid ranks observed |
| **C. LOCAL GENERATION FAILURE** | 30 | `MISSING_LOCAL_HYPOTHESIS` in live pool (excluded from Groq n) |

Provider failure still dominates. **Model ranking quality remains unmeasured.**

## 27–30. Latency

### All attempts (includes 429 — not model generation)

| Stat | ms |
|---|---|
| Average | 644 |
| P50 | 372 |
| P95 | 1446 |
| Max | 2576 |

### By status (MEASURED)

| Status | n | p50 | p95 | max | avg |
|---|---|---|---|---|---|
| **ranked (success)** | **1** | **1637** | **1637** | **1637** | **1637** |
| invalid_response | 5 | 1511 | 1825 | 1825 | 1529 |
| rate_limited | 264 | 362 | 1334 | 2576 | 623 |

Successful-rank latency sample size is **1** — reported honestly; not a product p50/p95 claim.

No eval-layer retry storm. Existing Groq client JSON-400→text and 503 once remain as in production.

## 31. Ranking stability

**null** — fewer than three successful repeats.

## 32. Missing-hypothesis analysis

30 missing local gold hyps. Of remaining calls with local gold, almost all failed as **429** or **invalid_response**, not wrong ranks.

## 33. LLM failure taxonomy

| Category | Count |
|---|---|
| rate limit | 264 |
| malformed JSON | 5 |
| timeout | 0 |
| wrong intent (valid JSON) | 0 |

## 34–39. Privacy / protected / stale / failure sim / Chrome / safety

Unchanged from prior phase verification:

- Shadow apply mode
- No replacement text in packets
- Password / JWT+api-key / card consult blocks
- Stale generation → discarded vote
- Simulated provider throws → unavailable, no write
- Mix advised auto-write: **0**
- Protected violations: **0**
- Stale violations: **0**
- Direct write: **NO**
- Chrome manual: **not run**

## 40. Limitations

1. New credentials still hit **Groq 429** at ~98% of attempts — quota/RPM remains the blocker.  
2. **1** valid rank ⇒ **INSUFFICIENT** for model-quality claims.  
3. Five `invalid_response` before/alongside 429 — JSON reliability still not established at volume.  
4. Successful-rank latency n=1 (1637 ms) — cannot claim p50/p95 product readiness.  
5. HTTP smoke `httpOk: false` this re-run; provider still reached Groq.  
6. Stability not measured.  
7. No architecture/prompt/dataset changes were made (by design).

## 41. Recommendation

**Keep shadow. Do not enable apply. Do not add providers/fallback/voting.**

This re-run confirms the previous inconclusive result was **not** uniquely an old-key artifact: with a **new** key, the frozen harness still cannot collect ≥200 valid ranks because of **provider rate limits**.

**Next (ops, not product redesign):** obtain Groq capacity that sustains ≥200 successful `/chat/completions` calls for this account (paid tier / higher RPM), then re-run **this same frozen file** without changing prompts or generation. Only then can TOP-1 / advised accuracy be interpreted.

## 42. Files changed (this re-run)

- `docs/audit/GPT_OSS_20B_LIVE_SHADOW_EVALUATION_REPORT.md` (updated with re-run metrics)
- `tests/unit/writing-engine/gpt-oss-20b-shadow/live-results.json` (overwritten by frozen eval output)

## 43. Files intentionally unchanged

Hypothesis Generation V2, advisor prompt, packet, triggers, Decision Engine, Policy, `mixedLayoutSafety`, Write Gate, translation, UI, model id (`openai/gpt-oss-20b`), temperature, maxTokens, dataset generator, seed **20261107**, holdout labels, apply mode (shadow).

---

GPT-OSS-20B LIVE SHADOW:  
INCONCLUSIVE

NEW GROQ CREDENTIALS:  
DETECTED

REAL MODEL:  
openai/gpt-oss-20b

REAL GROQ REQUEST:  
PASS

DIRECT WRITE:  
MUST BE NO

SHADOW INTEGRITY:  
PASS

VALID LLM RANKS:  
1

TOTAL ATTEMPTS:  
270

JSON SUCCESS RATE:  
0.37% (1/270)

429 RATE:  
97.78% (264/270)

LLM FAILURE RATE:  
99.63% (269/270)

LOCAL HYPOTHESIS EXISTENCE:  
89.37%

BASELINE ACTION ACCURACY:  
87.03%

GPT-OSS TOP-1:  
1/1 (NOT MEANINGFUL — n&lt;200)

GPT-OSS TOP-2:  
1/1 (NOT MEANINGFUL — n&lt;200)

FINAL ADVISED ACCURACY:  
1/1 (NOT MEANINGFUL — n&lt;200)

ACCURACY DELTA:  
UNKNOWN

LAYOUT FALSE POSITIVE:  
0

LAYOUT FALSE NEGATIVE:  
172

MIXED-LANGUAGE AUTO-WRITE:  
0

PROTECTED CONTENT VIOLATIONS:  
0

STALE RESPONSE VIOLATIONS:  
0

SUCCESSFUL-RANK LATENCY P50:  
1637 ms (n=1)

SUCCESSFUL-RANK LATENCY P95:  
1637 ms (n=1)

SUCCESSFUL-RANK MAX:  
1637 ms (n=1)

GENERALIZATION:  
UNKNOWN

REAL-WORLD READINESS:  
NOT READY

RECOMMENDATION:  
Keep shadow. Do not enable apply. Raise Groq quota/RPM, then re-run this frozen harness until ≥200 valid ranks exist before judging model quality.
