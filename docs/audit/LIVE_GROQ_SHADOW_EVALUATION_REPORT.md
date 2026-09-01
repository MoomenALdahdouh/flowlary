# Live Groq Shadow Evaluation Report

**DATE:** 2026-08-31  
**SCOPE:** Measure whether the real Groq hypothesis advisor improves ranking. Shadow only. No LLM writes.  
**NOT IN SCOPE:** Enabling apply mode, UI, prompt/model retuning against holdout, Hypothesis Generation V2 changes.

---

## 1. Evaluation objective

Answer only:

> Does the real LLM improve decisions when given locally generated hypotheses?

The previous **86.24%** figure is **not** Groq accuracy. It was the local Decision Engine on an earlier generated suite.

---

## 2. Production request path

Verified in code and exercised in this phase:

1. `startWritingRuntime` → `registerProductionHypothesisAdvisor()`  
2. `productionHypothesisAdvisor` → `chrome.runtime.sendMessage({ type: 'RANK_HYPOTHESES' })`  
3. Background `handleRankHypotheses` → `POST /api/ai/hypothesis-advisor`  
4. Gateway `hypothesisAdvisor` → entitlement + `layout-classification` rate limit + usage  
5. `runHypothesisAdvisorProvider` → `callGroqChat` (`AI_MODELS.HYPOTHESIS_ADVISOR`)  
6. Structured parse (IDs only) → `validateAdvisorVote`  
7. Pipeline computes baseline vs advised; **apply mode is `shadow`**, so Write Gate uses **baseline only**  
8. Analytics: `writing.shadow_compare` and `writing.advisor_shadow` (no raw text)

Bulk holdout ranking called `runHypothesisAdvisorProvider` / `callGroqChat` (same provider as the HTTP route). A local HTTP smoke to `POST /api/ai/hypothesis-advisor` did not return success in this environment (happy-dom CORS on `fetch`; node listen + request still `httpOk: false`, likely gateway failure under the same Groq 429/invalid conditions).

---

## 3. Provider / model configuration

**Unchanged.**

| Setting | Value |
| --- | --- |
| Provider | Groq (`GROQ_CHAT_COMPLETIONS_URL`) |
| Model | `allam-2-7b` (`AI_MODELS.HYPOTHESIS_ADVISOR`) |
| Temperature | `0` |
| maxTokens | `180` |
| Response format | `json_object` |
| Connect timeout | 10s |
| Request timeout | `FLOWLARY_AI_TIMEOUT_MS` default 30s |
| Entitlement | same as layout-classification |
| App rate limit | layout-classification bucket (anon 10 / free 45 / pro 120 per minute) |

---

## 4. Dataset generation

New generator: `tests/unit/writing-engine/live-groq-shadow/generate.ts`  
Seed **20260901**. Different unseen vocab from Phase 2/3 (notebook/lantern/harvest…, مظلة/حديقة…). Not the conversation examples as the main set.

---

## 5. Dataset size

**5500** generated cases.

| Family | N |
| --- | --- |
| layout | 2000 |
| mixed | 1000 |
| spelling | 1000 |
| technical | 500 |
| punctuation | 500 |
| short | 500 |

---

## 6. Development / validation / holdout

Per-case 50% / 25% / 25% (`splitOf`).  
**Holdout N = 1355.** Thresholds were not tuned on this holdout. Hypothesis Generation V2 stayed frozen.

Live Groq was a **stratified holdout subsample** (72 attempted after missing-hyp skip → **65** provider calls) because Groq **429** made a 1355-call live pass impractical.

---

## 7. Gold labeling methodology

Evaluator-owned, from generation:

- remapped sentences / remapped tokens → `layout_fix`  
- Arabic + technical/URL frames → `preserve`  
- English neighbor + letter-noise → `fix_english`  
- short ambiguous tokens → `unknown`  
- punctuation-only → `preserve`

The model never labeled gold.

---

## 8. Hypothesis existence rate

Holdout: **88.12%** (gold-class hypothesis present).  
**MISSING_LOCAL_HYPOTHESIS** on the live subsample: **7**.

---

## 9. Baseline metrics (local engine, holdout N=1355)

| Metric | Value |
| --- | --- |
| Action accuracy | **83.03%** |
| Layout recall | **76.73%** |
| Layout precision | **89.33%** |
| Layout FP | 65 |
| Layout FN | 165 |
| Mixed-family layout FP | 47 |
| Protected-pattern layout FP | 12 |
| Correct abstention | **88.54%** |
| Production advisor invocation (`shouldConsultAdvisor`) | **0.96%** |

This 83.03% is **not** comparable 1:1 to the earlier 86.24% (different corpus).

---

## 10. Real Groq metrics

Provider configured: **yes** (`GROQ_API_KEY` loaded; key not logged).

| Metric | Value |
| --- | --- |
| Live calls | 65 |
| Structured ranks accepted | **1** |
| Top-1 (of accepted) | 1/1 = 100% |
| Top-2 (of accepted) | 1/1 = 100% |
| Advised action accuracy (of accepted) | 1/1 = 100% |
| `invalid_response` | 62 |
| `rate_limited` | 2 (after retries) |
| Failure rate | **98.46%** |
| Mix advised auto-write | **0** |

**N=1 accepted rank is not a ranking evaluation.** It only proves a valid Groq JSON vote can flow through parse → decide. It does **not** prove improvement.

---

## 11. Delta

| Metric | Baseline (holdout 1355) | Groq advisor (usable ranks) | Delta |
| --- | --- | --- | --- |
| Action accuracy | 83.03% | n/a (n=1) | **unknown** |
| Layout FN | 165 | n/a | unknown |
| Layout FP | 65 | n/a | unknown |
| Mixed FP (advised write) | 47 baseline actions | **0** advised writes in live sample | no Groq-driven mix write |
| Abstention | 88.54% | n/a | unknown |

---

## 12. Ranking accuracy

Usable structured ranking: **1 / 65**.  
Top-1 / top-2 on that single vote: 100%. **Not statistically meaningful.**

---

## 13. Layout results

Local holdout: recall 76.7%, precision 89.3%, FP 65, FN 165.  
Groq did not produce enough ranks to change layout metrics.

---

## 14. Mixed-language results

Live advised `layout_fix` on mixed family: **0**.  
Foundation-safety mix tests still **25/25**.  
New-corpus baseline still emitted **47** mixed-family layout *actions* (Arabic frame + technical token). That is a **local** generator/decision issue on this new set, not an LLM write. Not patched (holdout frozen).

---

## 15. Technical-token results

Included in corpus and live subsample. No Groq-attributed technical write. Baseline can still layout-write some frames (see mix FP).

---

## 16. Protected-content results

Synthetic JWT / `sk-` / password field: consult blocked (safety tests).  
Holdout baseline counted **12** layout FPs on strings matching URL/`@`/`sk-`/`eyJ` patterns — local, not Groq. Live advisor did not override protection.

---

## 17. Abstention results

Baseline correct abstention **88.54%** on preserve/unknown gold.

---

## 18. Invocation rate

Production trigger: **0.96%** of holdout cycles.  
Rare, as intended.

---

## 19–21. Latency

**First burst** (mostly 429, no retry wait): p50 **389 ms**, p95 **640 ms**, max **782 ms**, avg **405 ms**.

**Second run** (retries + backoff): p50 **8517 ms**, p95 **9297 ms**, max **18202 ms**, avg **6152 ms**.

Successful-path latency is closer to the first-burst hundreds of milliseconds when Groq accepts the request. Retry-inflated p50 is **not** a typing budget.

Local analysis remains ~0.4 ms.

---

## 22–24. Failure / timeout / invalid

| Class | Count (run 2, n=65) |
| --- | --- |
| invalid_response | 62 |
| rate_limited | 2 |
| timeout | 0 |
| ranked | 1 |

`allam-2-7b` frequently failed JSON-object validation (`invalid_response` / HTTP 400 `json_validate_failed` then retry). That is a **model/schema reliability** problem, not a missing-hypothesis problem.

---

## 25. Ranking stability

Not measured — too few successful ranks (`stability: null`).

---

## 26. Missing-hypothesis analysis

Live subsample: **7 MISSING_LOCAL_HYPOTHESIS** (excluded from Groq blame).  
Holdout existence **88.1%**. Remaining live failures were **almost all invalid Groq output / 429**, not missing IDs.

---

## 27. LLM failure taxonomy

On the one accepted rank: no taxonomy entry (correct).  
62 invalid responses: **malformed output**.  
Rate limit: provider/quota, not intent.

---

## 28. Privacy verification

- Password field: `safetyAllowed=false`, no consult  
- JWT / api-key kinds: `shouldConsultAdvisor` false  
- Packet has `hasReplacement` only, never replacement text  
- Snippet ≤ 160  
- Analytics: cycle id, hyp count, ranked ids, actions — no field text  

No real credentials used.

---

## 29. Stale verification

`consultAdvisor` with mismatched generation → `stale`, vote null.  
Pipeline still drops vote if FieldSession generation moved.  
Write Gate generation checks unchanged.  
**Stale apply violations: 0.**

---

## 30. Manual Chrome results

**Not run** in this session. Required later with new examples. Production boot now forces **shadow apply mode**, so even a loaded extension must not LLM-write.

---

## 31. Safety results

- Default apply mode: **shadow** (`advisor.ts` + `registerProductionHypothesisAdvisor`)  
- Write Gate still baseline-only while shadow  
- Advisor modules still have no DOM writes  
- Foundation safety **25/25**  
- Shadow safety tests **11/11**  
- Live mix advised write **0**

---

## 32. Known limitations

1. Groq **rate limit** blocked a full holdout live pass.  
2. `allam-2-7b` **JSON contract failure** (~95%+ of accepted-HTTP attempts in run 2).  
3. Ranking accuracy **unknown** (n=1).  
4. HTTP route smoke `httpOk: false` in this harness.  
5. Context-size A/B **not completed**.  
6. Stability **not completed**.  
7. Chrome manual **not run**.  
8. New corpus baseline mix/protected FPs exist locally — frozen, not patched.

---

## 33. Recommended architecture decision

**Keep shadow. Do not enable advisor `apply`.**

Reasons: Groq does not yet produce reliable structured ranks at usable volume; latency under retry is seconds; ranking improvement vs baseline is **unproven**.

Next work (pick one):

1. **Model/prompt reliability** for JSON ranking (`allam-2-7b` vs a model that honors `json_object`), still shadow.  
2. Then re-run this harness when quota allows **≥200 successful ranks** on holdout.

Do not return to Hypothesis Generation as the primary next step — existence is 88% and live failures were Groq parse/429.

---

## 34. Files changed

- `extension/src/core/engine/advisor.ts` — default apply mode `shadow`  
- `extension/src/core/engine/hypothesisAdvisorClient.ts` — register sets shadow  
- `extension/src/core/observability/writingAnalytics.ts` — `writing.advisor_shadow`  
- `extension/src/core/writeGate/pipeline.ts` — shadow event (no text)  
- `tests/unit/writing-engine/live-groq-shadow/generate.ts`  
- `tests/unit/writing-engine/live-groq-shadow.eval.test.ts`  
- `tests/unit/writing-engine/live-groq-shadow-safety.test.ts`  
- `tests/unit/writing-engine/advisor-layer.test.ts` — register expects shadow  
- `docs/audit/LIVE_GROQ_SHADOW_EVALUATION_REPORT.md`

---

## 35. Files intentionally unchanged

Hypothesis Generation V2 (`layoutSequence`, `chunks`, `hypotheses` scoring), mixedLayoutSafety, Write Gate mutation path, translation, English correction provider, UI, advisor system prompt, model id, temperature.

---

LIVE GROQ:  
**PASS** (real `callGroqChat` / Groq HTTP; quota and JSON failures dominated)

REAL MODEL:  
**allam-2-7b**

REAL LLM REQUEST:  
**PASS**

DIRECT WRITE:  
**NO**

SHADOW INTEGRITY:  
**PASS**

LOCAL HYPOTHESIS EXISTENCE:  
**88.12%**

LOCAL HYPOTHESIS RECALL:  
**88.12%**

BASELINE ACTION ACCURACY:  
**83.03%** (new holdout; not 86.24%)

REAL GROQ TOP-1:  
**100% (n=1) — NOT MEANINGFUL**

REAL GROQ TOP-2:  
**100% (n=1) — NOT MEANINGFUL**

FINAL ADVISED ACCURACY:  
**100% (n=1) — NOT MEANINGFUL**

ACCURACY DELTA:  
**UNKNOWN**

LAYOUT FALSE POSITIVE:  
**65** (baseline holdout)

LAYOUT FALSE NEGATIVE:  
**165** (baseline holdout)

MIXED-LANGUAGE AUTO-WRITE:  
**0** (Groq-advised live sample)

PROTECTED CONTENT VIOLATIONS:  
**0** (Groq); **12** local baseline pattern hits on this corpus

STALE RESPONSE VIOLATIONS:  
**0**

LLM INVOCATION RATE:  
**0.96%** (production trigger)

LATENCY P50:  
**389 ms** (first burst) / **8517 ms** (retry run)

LATENCY P95:  
**640 ms** (first burst) / **9297 ms** (retry run)

LLM FAILURE RATE:  
**98.46%** (65 calls; 62 invalid + 2 rate-limit)

GENERALIZATION:  
**UNKNOWN** (Groq ranking)

REAL-WORLD READINESS:  
**NOT READY**

RECOMMENDATION:  
Keep the advisor in **shadow**. Do not enable automatic influence. Fix `allam-2-7b` JSON reliability or quota, then re-run until ≥200 valid holdout ranks exist.
