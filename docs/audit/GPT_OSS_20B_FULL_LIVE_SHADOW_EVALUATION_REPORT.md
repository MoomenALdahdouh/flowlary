# GPT-OSS-20B Full Live Shadow Evaluation Report

**DATE:** 2026-08-31  
**SCOPE:** Measure whether real Groq `openai/gpt-oss-20b` improves ranking of locally generated hypotheses on the frozen holdout, with **≥200 valid ranks**.  
**SHADOW:** The LLM does not write. This phase did not enable apply.  
**NOT IN SCOPE:** Gemini, OpenRouter, fallback, voting, routing, UI, Write Gate changes, Hypothesis Generation V2, translation redesign, production `maxTokens`, prompt/packet/trigger changes.

This evaluation answers one question:

> Does the real Groq `openai/gpt-oss-20b` improve ranking of locally generated hypotheses?

**Answer from this phase:** **UNKNOWN.** The provider did not yield ≥200 valid ranks. Ranking quality is **not claimed**. Verdict is **INCONCLUSIVE** (Case E).

---

## 1. Objective

Collect **≥200 valid GPT-OSS ranks** on the frozen holdout, compare them to the local baseline, and keep production shadow-only.

Prior evidence (not re-litigated here):

| Fact | Source |
|---|---|
| Groq API and key work | contract + earlier live shadow |
| `openai/gpt-oss-20b` is reachable | contract HTTP 200, returned model |
| JSON works when the reasoning budget is sufficient | contract: 180 fails 8/8; 512 6/8; 1024 8/8 |
| Preliminary ranking 17/19 | contract; **n=19 is insufficient** |
| Rapid batches produce 429 storms | prior 264/270 and 264/270 re-run |

This phase used **eval-only `max_tokens=1024`** and **conservative sequential pacing**. Production remains `maxTokens: 180`.

---

## 2. Production invariants

**Verified in source. Not modified.**

| Invariant | Production value |
|---|---|
| Model | `openai/gpt-oss-20b` (`AI_MODELS.HYPOTHESIS_ADVISOR`) |
| Temperature | `0` |
| **maxTokens** | **`180`** (`hypothesisAdvisorProvider.ts`) |
| Prompt | existing `HYPOTHESIS_ADVISOR_SYSTEM_PROMPT` |
| Packet | existing `AdvisorPacket` (snippet ≤160, IDs only, no replacement) |
| Triggers | existing `shouldConsultAdvisor` |
| Hypothesis Generation | V2 unchanged |
| Decision Engine / Policy / Write Gate | unchanged |
| `mixedLayoutSafety` | unchanged |
| Translation / UI / apply | unchanged |
| Apply mode | **shadow** |
| LLM write | **forbidden** (IDs only) |

Eval test `production maxTokens remains 180` asserts the provider source still contains `maxTokens: 180` and does **not** contain `maxTokens: 1024`.

---

## 3. Evaluation-only configuration

Used **only** by `tests/audit/evaluation/gpt-oss-full-live.eval.test.ts` via `callGroqChat`:

| Setting | Eval harness | Production |
|---|---|---|
| model | `openai/gpt-oss-20b` | same |
| temperature | `0` | same |
| response_format | `json_object` | same |
| include_reasoning | `false` | same (gpt-oss) |
| **max_tokens** | **`1024`** | **`180`** |
| prompt / packet | exact existing | same |

`1024` is **not** a silent production change.

Expected vote:

```json
{
  "rankedHypothesisIds": ["h2", "h1"],
  "ambiguityClass": "...",
  "reasonCode": "..."
}
```

Rejected: unknown IDs, empty ranking, malformed JSON, `replacement` / `text` / `write`, invented hypotheses.

---

## 4. Dataset

Frozen generator: `tests/unit/writing-engine/gpt-oss-20b-shadow/generate.ts`.

**Not regenerated. Labels not modified. No holdout tuning.**

---

## 5. Frozen seed

**20261107** (`GPT_OSS_SHADOW_SEED`).

---

## 6. Holdout size

| | N |
|---|---|
| Corpus | **5500** |
| Holdout | **1326** |

Same split as the contract / prior live-shadow evaluations.

---

## 7. Pacing strategy

Sequential calls only. No parallel Groq requests. No aggressive 429 retry (client still does not retry 429).

| Attempt | Spacing |
|---|---|
| Run 1 | 3.0 s after non-429; 6.0 s after 429 |
| Run 2 | 20 s initial cooldown; 3.5 s after success / non-429; 20–60 s exponential after 429; stop after 20 consecutive 429s |
| Connectivity | one isolated contract packet after both runs |

Run 1 still produced a **429-heavy** stream (same class as earlier 270-call storms). Run 2 slowed the flood but **did not recover quota**. A later single probe returned **HTTP 429 `rate_limit_exceeded`** in 174 ms.

429 is **not** counted as a model ranking failure.

---

## 8. Valid ranks

| | Count |
|---|---|
| Target | **200** |
| **Persisted valid LLM ranks** | **0** |
| Progress file (`ranked % 10 === 0`) | **not written** (implies run 2 never reached 10 persisted successes) |

Run 1 was stopped after ~11 minutes because 429/400 dominated. Run 2 was stopped after ~36 minutes when it was clear ≥200 ranks could not be reached on this account/quota window.

**Ranking evaluation: INCONCLUSIVE** (valid n &lt; 200).

---

## 9. Provider failures

Logged Groq HTTP errors during the two sequential harness runs (stderr `POST .../chat/completions`):

| Status | Run 1 | Run 2 | Isolated probe | Total logged |
|---|---|---|---|---|
| **429** | 53 | 39 | 1 | **93** |
| **400** | 23 | 2 | 0 | **25** |
| 500 / 503 | 0 | 0 | 0 | **0** |
| Auth 401/403 | 0 | 0 | 0 | **0** |
| Timeout | 0 | 0 | 0 | **0** |

400s on the production client path are typically `json_validate_failed` then one **text** retry without raising `max_tokens` (documented in the contract audit; **not fixed** this phase). They are **provider/contract** outcomes, not ranking-quality labels.

**Do not treat 429 or 400-as-budget as “GPT-OSS ranks poorly.”**

---

## 10. JSON reliability

| Metric | This phase |
|---|---|
| HTTP 200 + valid schema (persisted) | **0** |
| JSON success rate (valid ranks / provider attempts) | **not measurable at target n** |
| Contract-audit JSON at eval 1024 | **8/8** (prior phase, n=8 packets) |

This phase **cannot** update the contract-audit JSON rates. Quota blocked the holdout sample.

---

## 11. Gold hypothesis existence

Local-only holdout scan (no Groq), same inspect path as production analysis + Hypothesis Generation V2:

**1185 / 1326 = 89.37%**

Missing local gold (**141 / 1326**) is **`MISSING_LOCAL_HYPOTHESIS` / local generation**, not an LLM ranking error.

---

## 12. Baseline accuracy

Local `decideWriting` on the full holdout (advisor unused):

**1154 / 1326 = 87.03%**

| Family | n | Baseline OK | Gold hyp exists |
|---|---|---|---|
| layout | 495 | 446 | 495 |
| mixed | 252 | 252 | 252 |
| spelling | 238 | 120 | 123 |
| technical | 105 | 105 | 105 |
| punctuation | 124 | 119 | 98 |
| short | 112 | 112 | 112 |

Advisor invocation (production `shouldConsultAdvisor`): **16 / 1326 = 1.21%**.

---

## 13. GPT-OSS top-1

**n/a** — **0 / 0** persisted valid ranks.

Do not use contract 17/19 here. That sample is not this holdout and is &lt; 200.

---

## 14. GPT-OSS top-2

**n/a** — insufficient valid n.

---

## 15. Final advised accuracy

**n/a** — no persisted `advisorResult: ranked` holdout decisions.

On provider failure the harness leaves the **deterministic local decision** authoritative (`advisorResult` unused / invalid). That path was not statistically scored against GPT-OSS because GPT-OSS did not rank.

---

## 16. Accuracy delta

| Metric | Baseline | GPT-OSS Advisor | Delta |
|---|---|---|---|
| Action accuracy | **87.03%** (1154/1326) | **n/a** (0 valid ranks) | **unknown** |
| Top-1 | — | n/a | unknown |
| Top-2 | — | n/a | unknown |
| Layout FN | 172 | n/a | unknown |
| Layout FP | 0 | n/a | — |
| Mixed FP | 0 | n/a | — |
| Abstention | 100% (495/495) | n/a | unknown |

---

## 17. Layout results

Local baseline (holdout):

| Metric | Value |
|---|---|
| Layout gold | 711 |
| Layout TP | 539 |
| Layout recall | **75.81%** (539/711) |
| Layout FP | **0** |
| Layout FN | **172** |

GPT-OSS layout ranking: **not measured**.

---

## 18. Mixed-language results

| Metric | Value |
|---|---|
| Mixed-family baseline OK | 252/252 |
| Mixed-family layout FP (local) | **0** |
| Mixed-language auto-write (advised `layout_fix`) | **0** (no advised writes; shadow) |

---

## 19. Technical results

Technical family local baseline: **105/105** action OK; gold hyp exists **105/105**.  
GPT-OSS technical ranking: **not measured**.

---

## 20. Abstention

Gold `preserve` / `unknown`: **495 / 495 = 100%** local noop-or-suggestion.

GPT-OSS abstention ranking: **not measured**.

---

## 21. Missing hypothesis analysis

Holdout (local):

| Bucket | Count | Class |
|---|---|---|
| Gold hypothesis exists | **1185** | ranking *could* be measured |
| Gold hypothesis does not exist | **141** | **LOCAL GENERATION** — not LLM failure |
| Correct exist + LLM selected correctly | **0 persisted** | — |
| Correct exist + LLM selected incorrectly | **0 persisted** | — |
| LLM unavailable (429 / 400 / killed run) | **dominant** | **PROVIDER** — not ranking error |

These classes are **not mixed**.

---

## 22. LLM failure taxonomy

No persisted **valid-but-incorrect** rankings. Taxonomy counts for layout-vs-spelling, preserve-vs-layout, technical, mixed, short-token, punctuation, capitalization, Arabizi, insufficient context: **all 0 (unmeasured).**

Observed **provider** taxonomy (logged HTTP only):

| Class | Count (approx., two runs + probe) |
|---|---|
| 429 rate limit | **93** |
| 400 (incl. likely `json_validate_failed`) | **25** |
| invalid JSON on HTTP 200 | **0 persisted** |
| empty response | **0 persisted** |
| timeout / 500 / 503 / auth | **0** |
| unknown ID | **0 persisted** |

---

## 23. Latency

Successful-rank p50 / p95 / max: **n/a** (0 persisted successes).

| Class | Notes |
|---|---|
| Isolated 429 probe | **174 ms** (reject, not generation) |
| Prior contract VALID ranks (n=19, not this holdout) | p50 957 / p95 1846 / max 1846 ms |

429 latency must **not** be reported as model generation time.

Product rule unchanged: **typing must never wait for the LLM.** Advisor remains asynchronous / shadow.

---

## 24. Stability

Required: ≥10 cases × 3 identical packets at temperature 0.

**Not run to completion.** After persistent 429s, repeating the same packet would only measure rate limits.

**RANKING STABILITY: n/a**

---

## 25. Privacy

Unchanged. Packets send snippet + hypothesis IDs / scores / evidence. **No replacement text.** Eval harness uses the same packet fields as production. Secrets were not logged.

---

## 26. Stale protection

Production stale-cycle discard is unchanged. This harness did not apply votes to the field. **STALE RESPONSE VIOLATIONS: 0.**

---

## 27. Safety

| Check | Result |
|---|---|
| MIXED-LANGUAGE AUTO-WRITE | **0** |
| PROTECTED CONTENT VIOLATIONS | **0** (local layout FP on URL/@/sk-/JWT patterns: **0**) |
| STALE RESPONSE VIOLATIONS | **0** |
| DIRECT WRITE | **NO** |
| LLM mutate DOM / `input.value` / `setRangeText` / `execCommand` | **NO** |
| LLM create replacement text | **NO** (vote parser rejects `replacement` / `text` / `write`) |

Local baseline layout FP **0** on this holdout. No advised auto-write path was exercised with a valid Groq vote in this phase.

---

## 28. Limitations

1. **Groq 429** prevented ≥200 valid ranks on this account/window after earlier contract + live-shadow traffic.  
2. Run 1’s 6 s 429 backoff was still too short; it contributed to quota burn. Run 2 used 20–60 s backoff and still could not collect 200 successes.  
3. **0 persisted valid ranks** ⇒ no top-1 / top-2 / advised-accuracy / delta / stability claims.  
4. 400s remain consistent with the **reasoning-budget / `json_validate_failed`** client path; this phase **did not** change production 180 or the text retry.  
5. Occasional HTTP 200s without a progress file cannot be reconstructed; they are **not** counted as valid ranks.  
6. Harness was stopped once it was clear the target was unreachable (do not flood Groq further).  
7. Chrome E2E typing was not required; safety is from code + local holdout + no apply.

---

## 29. Architecture recommendation

**Case E:** 429 / provider reliability prevented evaluation. **Do not claim model failure.**

Keep:

- local-first analyze → Hypothesis Generation V2 → Decision Engine → Write Gate  
- one Groq ranker in **shadow**  
- Google Translate as NMT, not an intent voter  
- **no** Gemini / OpenRouter / voting / routing

When Groq capacity allows **≥200 sequential successful** `openai/gpt-oss-20b` completions:

1. Re-run **this same** frozen harness (`seed 20261107`, eval-only 1024, existing prompt/packet).  
2. Only then interpret top-1 / advised delta.  
3. A **later** implementation phase may raise production `maxTokens` off the contract evidence (180 fails). **Not this phase.**

---

## 30. Files changed

- `tests/audit/evaluation/gpt-oss-full-live.eval.test.ts` (eval-only harness; production 180 assertion; local baseline test; live Groq loop gated by `FLOWLARY_GPT_OSS_FULL_LIVE`)
- `tests/audit/evaluation/gpt-oss-full-live-baseline.json`
- `tests/audit/evaluation/gpt-oss-full-live-results.json`
- `tests/audit/evaluation/gpt-oss-full-live-connectivity.json`
- `docs/audit/GPT_OSS_20B_FULL_LIVE_SHADOW_EVALUATION_REPORT.md`

---

## 31. Files intentionally unchanged

Production advisor prompt, production `maxTokens` **180**, model id, Hypothesis Generation V2, Decision Engine, Policy, `mixedLayoutSafety`, Write Gate, translation, UI, apply mode (shadow), frozen 5500 dataset, seed **20261107**, holdout labels, no Gemini/OpenRouter/voting.

---

# FINAL VERDICT

GPT-OSS-20B FULL LIVE SHADOW:  
INCONCLUSIVE

REAL MODEL:  
openai/gpt-oss-20b

REAL GROQ REQUEST:  
PASS

VALID LLM RANKS:  
0

TARGET VALID RANKS:  
200

JSON SUCCESS RATE:  
n/a (0 persisted valid ranks)

429 RATE:  
93 logged 429 / (93 429 + 25 400 + 0 persisted 200) among observed full-eval HTTP outcomes — provider-bound; isolated probe 429 `rate_limit_exceeded`

LOCAL HYPOTHESIS EXISTENCE:  
1185/1326 = 89.37%

BASELINE ACTION ACCURACY:  
1154/1326 = 87.03%

GPT-OSS TOP-1:  
n/a (0/0) — VALID N: 0

GPT-OSS TOP-2:  
n/a (0/0) — VALID N: 0

FINAL ADVISED ACCURACY:  
n/a — VALID N: 0

ACCURACY DELTA:  
unknown

LAYOUT FALSE POSITIVE:  
0 (local baseline; GPT-OSS unmeasured)

LAYOUT FALSE NEGATIVE:  
172 (local baseline; GPT-OSS unmeasured)

MIXED-LANGUAGE AUTO-WRITE:  
0

PROTECTED CONTENT VIOLATIONS:  
0

STALE RESPONSE VIOLATIONS:  
0

LATENCY P50:  
n/a (0 successful ranks)

LATENCY P95:  
n/a (0 successful ranks)

LATENCY MAX:  
n/a (0 successful ranks)

RANKING STABILITY:  
n/a

LLM FAILURE RATE:  
n/a as model-quality (provider 429/400 dominated; 0 persisted ranking errors)

GENERALIZATION:  
UNKNOWN

REAL-WORLD READINESS:  
NOT READY

RECOMMENDATION:  
Keep shadow; do not enable apply or change production maxTokens. Re-run this frozen eval-only 1024 harness only after Groq quota can sustain ≥200 sequential successful ranks.
