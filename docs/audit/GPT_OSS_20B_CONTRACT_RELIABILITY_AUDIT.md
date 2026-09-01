# GPT-OSS-20B Contract / JSON Reliability Audit

**DATE:** 2026-08-31  
**SCOPE:** Isolated Groq contract probes. Production architecture, prompt, dataset, Write Gate, and apply mode were **not** changed.  
**SHADOW:** The LLM does not write. These probes never touch the field.

---

## 1. Objective

Determine whether Groq `openai/gpt-oss-20b` can satisfy the existing Hypothesis Advisor contract, and separate:

| Class | Meaning |
|---|---|
| A | Groq quota / rate limit |
| B | JSON response contract |
| C | maxTokens / reasoning budget |
| D | model behavior |
| E | client / provider implementation |
| F | other infrastructure |

Prior live shadow evals (270 attempts, 1 valid, 264×429) **cannot** be read as ranking quality. This audit paces a **small** real-Groq set and varies **evaluation-only** `max_tokens`.

---

## 2. Current configuration

**VERIFIED IN CODE. Not modified.**

| Setting | Production value | Where |
|---|---|---|
| Model | `openai/gpt-oss-20b` | `AI_MODELS.HYPOTHESIS_ADVISOR` |
| Temperature | `0` | `hypothesisAdvisorProvider.ts` |
| maxTokens | **`180`** | same |
| response_format | `{ type: 'json_object' }` | `callGroqChat` when `responseFormat === 'json_object'` |
| include_reasoning | **`false`** (because model id contains `gpt-oss`) | `groqClient.ts` |
| Connect timeout | 10s | `GROQ_CONNECT_TIMEOUT_MS` |
| Request timeout | 30s default | `FLOWLARY_AI_TIMEOUT_MS` |
| JSON 400 retry | one retry as `text` if `json_validate_failed` | `callGroqChat` |
| 429 retry | **none** | `callGroqChat` |
| 503 retry | one, after 600 ms | `callGroqChat` |
| Apply mode | **shadow** | `registerProductionHypothesisAdvisor` |

Correction / translation / layout-classifier models were not changed.

---

## 3. Actual Groq request payload

Production `runHypothesisAdvisorProvider` sends (secrets omitted):

```json
{
  "model": "openai/gpt-oss-20b",
  "temperature": 0,
  "max_tokens": 180,
  "include_reasoning": false,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<HYPOTHESIS_ADVISOR_SYSTEM_PROMPT>" },
    { "role": "user", "content": "{ cycleId, snippet, allowedIntents, hypotheses[] }" }
  ]
}
```

User content is the existing packet: snippet ≤160, ≤24 hyps (`id`, `intent`, `localScore`, `risk`, `needsLLM`, `conflicts`, `evidence`). **No replacement text.**

This audit used the **same** shape and prompt. Only `max_tokens` / optional `json_schema` were varied **off the production path**.

Expected model JSON:

```json
{
  "rankedHypothesisIds": ["h2", "h1"],
  "ambiguityClass": "…",
  "reasonCode": "…"
}
```

Rejected if missing keys, unknown IDs, empty ranks, or `replacement` / `text` / `write`.

---

## 4. Test methodology

Isolated harness: `tests/audit/evaluation/gpt-oss-contract/`

- **8 new packets** (layout, mixed, spelling, technical, short, punctuation) — not the frozen 5500 holdout.
- Same production prompt + packet fields.
- Sequential requests, **2.2s** spacing; **3.5s** after a 429; stop after **6 consecutive 429**.
- **No** eval-layer retry of 429.
- Raw HTTP recorded (status, Groq error code, finish_reason, usage, reasoning tokens). Production `callGroqChat` was **not** used so metadata would not be discarded.
- Configs:
  - **A** `json_object` + max_tokens **180** (production)
  - **B** `json_object` + **512**
  - **C** `json_object` + **1024**
  - **D** `json_schema` + **512** (4 packets; not in production client)
  - **E** determinism: one packet ×3 at 512 / `json_object`

Gold IDs are evaluator-owned. Ranking on this set is **preliminary only**.

---

## 5. Number of requests

**31** real Groq `POST /openai/v1/chat/completions` calls.

Returned model on HTTP 200: **`openai/gpt-oss-20b`**.

---

## 6. Rate-limit results

| | Count |
|---|---|
| 429 `rate_limit_exceeded` | **1 / 31 (3.2%)** |
| Auth 401/403 | **0** |
| 5xx | **0** |
| Timeout | **0** |

Paced sequential traffic **did not** reproduce the 264/270 429 storm. That storm is a **rapid-batch / TPM** effect (prior evals), not “the model cannot speak JSON.”

**Provider availability (this audit):** 30/31 non-429 = **96.8%**.

**Do not count 429 as model failure.** Model contract is judged on the **30** non-429 responses.

---

## 7. JSON results

Among **30** non-429:

| Outcome | Count |
|---|---|
| HTTP 200 + valid JSON + valid schema | **19** |
| HTTP 400 `json_validate_failed` | **11** |
| HTTP 200 empty content | **0** |
| HTTP 200 invalid JSON parse | **0** |

**Contract success among non-429: 63.3% (19/30)** — **driven entirely by max_tokens**, not by random parse noise.

---

## 8. Schema results

| Check on VALID (n=19) | Result |
|---|---|
| Keys present | yes |
| IDs ⊆ supplied set | **19/19** |
| Invented IDs | **0** |
| `replacement` / `text` / `write` | **0** |
| Free-form non-JSON body on HTTP 200 | **0** |

`json_schema` (D, n=4): 2 VALID, 1 `json_validate_failed`, 1 429. **Not** more reliable than `json_object` at 512. Production client **does not** send `json_schema`.

---

## 9. Empty-response results

**0** empty `content` on HTTP 200.

Production `if (!content) throw invalid_response` was **not** the failure mode in this sample.

---

## 10. Token / finish-reason evidence

Successful 200s: `finish_reason = stop`.

**MEASURED completion vs reasoning** (usage present only on HTTP 200):

| Config | Valid | Reasoning tokens (success) | Completion tokens (success) |
|---|---|---|---|
| A 180 | **0/8** | n/a (400 before usage) | n/a |
| B 512 | **6/8** | **185–384** | 235–420 |
| C 1024 | **8/8** | **202–633** | 237–672 |
| E 512 | **3/3** | 185–322 | 221–357 |

Final JSON bodies were **84–109 characters**. Almost all `completion_tokens` are **reasoning**, not the JSON.

**180 &lt; minimum observed reasoning (185)** and far below **633**. Groq rejects the completion as `json_validate_failed` (HTTP 400) when the budget is exhausted before a valid JSON object exists.

This is **class C (reasoning budget)**, not class B (the model cannot emit JSON).

---

## 11. Latency

**VALID ranks only (n=19), MEASURED:**

| | ms |
|---|---|
| p50 | **957** |
| p95 | **1846** |
| max | **1846** |

A-180 failures (400s): 543–3070 ms — **not** success-path generation.

Product targets (p50≤400 / p95≤800) are **not met** on successful ranks in this sample.

---

## 12. Client implementation findings

Inspected: `callGroqChat`, `hypothesisAdvisorProvider`, gateway, background `handleRankHypotheses`, advisor client.

**No production bug was fixed this phase.**

### BUG FOUND (diagnostic — do not treat as a silent prod patch)

1. **Production `max_tokens: 180` is incompatible with `gpt-oss-20b` + `json_object`.**  
   Evidence: **8/8** production-identical A probes → HTTP 400 `json_validate_failed`. Reasoning on successful larger budgets is **185–633** tokens.

2. **`callGroqChat` retries `json_validate_failed` as `text` without raising `max_tokens`.**  
   That retry cannot create room for reasoning. It can only turn a structured 400 into unstructured / still-invalid `content`, which `parseVote` maps to `invalid_response`. This is why the 270-call eval’s 5 “invalid” sit next to 429s: the client **mis-classifies a budget failure**.

3. **`GroqUsage` / parse path drop `finish_reason` and `reasoning_tokens`.**  
   Ops cannot see the budget collision in production logs.

4. **Not a parser bug on success:** when HTTP 200 returns JSON, `parseVote` would accept these 19 bodies (IDs only, no write fields).

Background/gateway do not invent IDs or write the field.

---

## 13. Ranking observations

Among **19 VALID** ranks: gold top-1 **17/19 (89.5%)**.

Misses: 2 layout packets ranked preserve/as-is first.

**RANKING QUALITY: PRELIMINARY.** n=19 &lt; 200. Do **not** claim statistical accuracy. Do **not** enable apply.

---

## 14. Determinism

Same mixed packet, temperature 0, max_tokens 512, three sequential calls: **same top-1 (3/3)**. Small n; quota-safe.

---

## 15. Root cause

**Primary: C — reasoning budget (`max_tokens` 180).**

`include_reasoning: false` hides reasoning from `content` but **does not** stop the model from spending hundreds of tokens before the JSON object. Production 180 cannot fit that.

**Secondary: A — quota on rapid batches.**  
Paced 31 calls: **1** 429. The 264/270 429s were **request-rate / TPM**, not “JSON is impossible.”

**Not primary:** empty content, auth, outage, invented IDs, write-field leakage.

**Decision tree:**

- 429 dominates **only** on rapid full-holdout runs → quota is the **throughput** blocker.
- Non-429 at **180** fail **8/8**; **512** 6/8; **1024** 8/8 → **reasoning budget is the contract blocker**.
- JSON is **not** chronically malformed once the budget fits.

---

## 16. Production-risk assessment

| Risk | Status |
|---|---|
| Advisor apply | still **shadow** — no field writes |
| Production config | still **180 + json_object** — **will fail** most live ranks the same way as A |
| Large eval | still **429-prone** if unpaced |
| Safety / Write Gate | unchanged; mix/protected not in this probe’s write path |
| Adding Gemini / fallback | **not justified** by this evidence |

---

## 17. Recommended next step

**Do not implement in this phase.**

When implemented later: raise **evaluation-then-production** advisor `max_tokens` enough for gpt-oss reasoning (this audit: **1024** was 8/8; **512** was 6/8), keep shadow, keep the same prompt/packet, then re-run the **frozen ≥200 valid-rank** holdout **slowly**. Do not add Gemini. Do not enable apply from n=19.

---

## Files

**Changed (audit only):**

- `tests/audit/evaluation/gpt-oss-contract/packets.ts`
- `tests/audit/evaluation/gpt-oss-contract/probe.ts`
- `tests/audit/evaluation/gpt-oss-contract.eval.test.ts`
- `tests/audit/evaluation/gpt-oss-contract/results.json`
- `docs/audit/GPT_OSS_20B_CONTRACT_RELIABILITY_AUDIT.md`

**Intentionally unchanged:** production advisor prompt, `maxTokens` 180, model id, hypothesis generation, Decision Engine, Policy, Write Gate, translation, UI, apply mode, frozen 5500 dataset.

---

GPT-OSS MODEL:  
openai/gpt-oss-20b

REAL GROQ REQUEST:  
PASS

RATE LIMIT:  
PASS

JSON CONTRACT:  
PASS

SCHEMA CONTRACT:  
PASS

EMPTY RESPONSE:  
0

INVALID JSON:  
0 (HTTP 200); 11 HTTP 400 json_validate_failed (budget)

VALID RANKS:  
19 / 31 (19 / 30 non-429)

RANKING QUALITY:  
PRELIMINARY

MAX TOKENS 180:  
FAILS

MAX TOKENS 512:  
WORKS

MAX TOKENS 1024:  
WORKS

DIRECT WRITE:  
MUST BE NO

PRODUCTION CHANGED:  
MUST BE NO

ROOT CAUSE:  
gpt-oss-20b reasoning uses ~185–633 tokens; production maxTokens 180 causes json_validate_failed. Rapid evals then add 429.

NEXT STEP:  
Keep shadow. Later raise advisor max_tokens off this evidence, then re-run the frozen ≥200-rank holdout at a safe pace. Do not add Gemini or enable apply.

FINAL STATUS:  
READY FOR FULL EVALUATION
