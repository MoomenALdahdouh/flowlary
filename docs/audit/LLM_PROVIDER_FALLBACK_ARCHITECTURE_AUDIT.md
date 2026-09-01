# LLM Provider Health + Flexible Fallback Architecture Audit

**AUDIT DATE:** 2026-08-31  
**REPOSITORY:** `/Users/moomen/Projects/flowlary`  
**SCOPE:** Research and recommendation only. No production engine, advisor prompt, model ID, fallback, Gemini, OpenRouter, UI, Translation, Write Gate, Hypothesis Generation, or apply-mode change was made in this audit.  
**METHOD:** Re-read prior reports; verify against current source; live Groq header/JSON probes against the configured key; fetch official Groq and Gemini catalog/pricing pages.

`docs/audit/GROQ_HEALTH_QUOTA_AUDIT.md` **does not exist** in this tree.

**Labels used throughout**

| Label | Meaning |
|---|---|
| **MEASURED** | Produced in this session or a prior live Groq run on this tree |
| **VERIFIED IN CODE** | Read from current source, not from a report |
| **ESTIMATED** | Calculated from stated assumptions |
| **REQUIRES EXTERNAL** | Vendor docs / pricing pages fetched this session |
| **UNKNOWN** | Not measured and not safely inferable |

Prior reports were **not** trusted blindly. Several conclusions in `LLM_PROVIDER_ARCHITECTURE_AUDIT.md` and `LLM_HYPOTHESIS_ADVISOR_IMPLEMENTATION_REPORT.md` are **stale** relative to current code (advisor model ID, correction JSON mode). This document supersedes those points for provider health and fallback design.

---

## 1. Current provider architecture

**VERIFIED IN CODE.**

Intended product path (matches `docs/architecture/unified-writing-decision-engine-spec.md` and Hypothesis Generation V2):

```
Local Analysis
  → Hypothesis Generation
  → LLM only when ambiguity requires it  (rank IDs only)
  → Policy (`decideWriting`)
  → Write Gate
```

### 1.1 What actually runs today

```
USER keyup/input (Space/Enter/Tab or settled input)
  → Enforce coordinator (`void runFieldCycle`)
  → analyzeFieldText + collectHypotheses          // local, ~0.4 ms
  → if shouldConsultAdvisor:
        AWAIT consultAdvisor                      // blocks this cycle, not the OS keyboard
        RANK_HYPOTHESES → background fetch
        POST /api/ai/hypothesis-advisor
        AiGateway.hypothesisAdvisor
          entitlement + layout-classification RPM bucket + usage reservation
          withTimeout(FLOWLARY_AI_TIMEOUT_MS = 30_000)
          runHypothesisAdvisorProvider
            callGroqChat(AI_MODELS.HYPOTHESIS_ADVISOR)
            parseVote (IDs only; reject replacement/text/write)
        validateAdvisorVote
        stale generation → discard vote
  → baseline = decideWriting(..., advisorResult unused)
  → advised = decideWriting(..., vote)
  → apply mode is shadow → Write Gate uses baseline only
```

**LLM is not the writer.** `registerProductionHypothesisAdvisor` sets apply mode **`shadow`**. Write Gate never applies ranked IDs in production boot.

**Translation remains a separate producer path:** Google Cloud Translation (v2 key / v3 ADC) with optional Groq polish (`google_then_groq` for Pro non-live). Advisor packets do not carry replacement text and must not emit translated strings. **Do not merge Translation into the intent-ranker provider tree.**

### 1.2 Providers present vs absent

| Provider | Role today | Config | Abstraction |
|---|---|---|---|
| **Groq** Chat Completions | All LLM ops (advisor, correction, layout classifier, coach, report, explanation localize, translation LLM) | `GROQ_API_KEY` | `callGroqChat` only |
| **Google Cloud Translation** | Arabic→English NMT | `GOOGLE_TRANSLATE_ENABLED` + key/ADC | `googleTranslateProvider` / `translationRouter` |
| **Gemini / Google Generative** | **Not present** | none | none |
| **OpenRouter** | **Not present** | none | none |

There is **no** `LLMProvider` interface. `runHypothesisAdvisorProvider` is Groq-hardwired to `AI_MODELS.HYPOTHESIS_ADVISOR`.

### 1.3 Current models (`packages/shared/src/ai/models.ts`)

**VERIFIED IN CODE (this is the live config, not the older Allam advisor reports).**

| Operation | Provider | Model ID |
|---|---|---|
| Hypothesis advisor | Groq | **`openai/gpt-oss-20b`** |
| English correction / coach / report / explanation localize | Groq | `openai/gpt-oss-20b` |
| Translation LLM / Pro refine | Groq | `openai/gpt-oss-120b` |
| Layout classifier (legacy) | Groq | `allam-2-7b` |
| Translation NMT | Google | `google-translate` |

`LLM_HYPOTHESIS_ADVISOR_IMPLEMENTATION_REPORT.md` still says advisor = `allam-2-7b`. That was true at advisor implementation time. **`GPT_OSS_20B_LIVE_SHADOW_EVALUATION_REPORT.md` changed only `HYPOTHESIS_ADVISOR` to `openai/gpt-oss-20b`.** Layout classifier remains Allam.

Advisor call settings (**VERIFIED IN CODE**): temperature `0`, `maxTokens` `180`, `response_format: json_object`, `include_reasoning: false` (because model id contains `gpt-oss`), snippet ≤160, ≤24 hypotheses.

Correction **does not** send `response_format: json_object`. It `JSON.parse`s `content`. The prior architecture audit’s claim that “correction already uses json_object on gpt-oss-20b” is **false in current code**.

### 1.4 Local vs LLM split (still correct)

**Local keeps:** keyboard mapping, tokenization, protected content, obvious layout, mixed-structure preserve, safety, paste/composition/override, hypothesis **generation**, Policy, Write Gate.

**LLM may:** rank existing hypothesis IDs when `shouldConsultAdvisor` is true.

**LLM must not:** write, invent replacements, bypass Policy, bypass Write Gate, translate, map keys, or run per keystroke as the decision engine.

Consult rate on generated holdouts: **0.72–1.21% of field cycles** (MEASURED in prior evals). Not per keystroke by design; see §13 for the remaining cycle-await issue.

---

## 2. Current Groq health

**MEASURED this session** (single-key diagnostic; key values are not recorded here).

| Check | Result |
|---|---|
| `GROQ_API_KEY` present | yes |
| `GET /openai/v1/models` | **HTTP 200**, 14 models |
| `openai/gpt-oss-20b` listed | **yes** |
| `allam-2-7b` listed on Models API | **yes** |
| Auth failure (401/403) | **not observed** |
| 404 | **not observed** |
| 5xx | **not observed** |
| Connect/request timeout | **not observed** (probes 222–822 ms) |
| gpt-oss-20b rate-limit headers | `limit-requests=1000`, `limit-tokens=8000` |
| allam-2-7b rate-limit headers | `limit-requests=7000`, `limit-tokens=6000` |

**Interpretation of headers (REQUIRES EXTERNAL Groq docs):** `x-ratelimit-limit-requests` is **RPD**; `x-ratelimit-limit-tokens` is **TPM**. **8000 TPM + 1000 RPD on gpt-oss-20b matches Groq Free plan**, not Developer (listed **250K TPM / 1K RPM** on the production models table).

**CURRENT GROQ HEALTH:** API is up, key is accepted, production SKU `openai/gpt-oss-20b` is hosted. This is **not** an outage. It is **Free-tier constrained** plus a **structured-output / max_tokens interaction** (see §3 and §5).

Official Groq **production** table (fetched `console.groq.com/docs/models` this session) lists `openai/gpt-oss-20b` and `openai/gpt-oss-120b`. It **does not list** `allam-2-7b`. Allam remains reachable via the Models API and returned valid JSON on a tiny probe (**MEASURED**, 222 ms, HTTP 200).

---

## 3. Current quota / rate-limit diagnosis

### 3.1 Do not conflate failure classes

| Class | HTTP | Typical Flowlary mapping | Meaning |
|---|---|---|---|
| Provider rate limit | 429 | `rate_limited` → `AI_RATE_LIMITED` | RPM / TPM / RPD / TPD |
| Quota / billing exhaustion | often 429 with a quota message, or 403 | currently **same** `rate_limited` or `groq_http_*` | **not distinguished in `groqClient.ts`** |
| Auth | 401/403 | `invalid_api_key` | key / permission |
| Structured JSON fail | **400** `json_validate_failed` | retry once as `text`, then parse | **HTTP success is not required for this class** |
| Empty / unparseable body | 200 with empty `content` | `invalid_response` | application parse |
| Timeout | abort | `AI_TIMEOUT` | 10s connect or 30s gateway |
| 5xx | 503 retried once (600 ms); other 5xx thrown | `AI_UNAVAILABLE` | provider down |

**VERIFIED IN CODE:** `callGroqChat` does **not** retry 429. It retries **one** `json_validate_failed` as text and **one** 503 after 600 ms.

### 3.2 Live Allam shadow (`LIVE_GROQ_SHADOW_EVALUATION_REPORT.md`)

Model at that time: **`allam-2-7b`**. N=65 provider calls.

| Outcome | Count | Class |
|---|---|---|
| accepted structured rank | **1** | success |
| `invalid_response` | **62** | **HTTP-success or post-retry parse/validation** — **not quota** |
| `rate_limited` | **2** | 429 after eval-layer retries (that harness retried 429 up to 3× with 2.5s backoff — **eval only**, not production client) |

**Primary Allam failure: malformed / unusable structured output (98.46%), not quota exhaustion.**

Eval-layer retries inflated latency to p50 **8.5 s** (MEASURED in that report). Production `groqClient` does not do that 429 loop.

### 3.3 Live gpt-oss-20b shadow (`GPT_OSS_20B_LIVE_SHADOW_EVALUATION_REPORT.md`)

Model: **`openai/gpt-oss-20b`**. N=270 provider calls. Valid ranks: **0**.

| Outcome | Count | Class |
|---|---|---|
| `invalid_response` | **6** | JSON/parse/validation |
| `rate_limited` | **264 (97.78%)** | **429** |
| timeout / 5xx / 401 / 404 | **0** | not observed |

Harness spacing: 80 ms between calls, 1.5 s after 429. **No 429 retry-to-pad-N.**

**Primary gpt-oss eval failure: Groq 429 under burst traffic, after a handful of JSON failures.** That is **rate limit**, not “monthly credits hit zero,” and not 401.

Free-plan gpt-oss-20b (REQUIRES EXTERNAL rate-limit table + MEASURED 8K TPM header): **30 RPM / 1K RPD / 8K TPM / 200K TPD**. 270 calls at ~12.5 RPS is **far above 30 RPM**. TPM 8K is also easy to blow with ~200-token completions including reasoning tokens.

### 3.4 This session’s quota snapshot (MEASURED)

After probes:

- gpt-oss-20b: **not 429**; remaining request header near **1000**; TPM remaining in the **6k–7.7k of 8000** band and recovering.
- Daily request budget is **not exhausted**.
- Token-per-minute budget is **tight** (Free 8K). A 200-call holdout at production packet size **will 429 again** unless spaced to respect **30 RPM and 8K TPM**.

**CURRENT GROQ QUOTA:** **LIMITED** (Free-plan RPM/TPM/RPD), **not EXHAUSTED**.

`groqClient` **cannot tell RPM vs TPM vs TPD vs billing quota** from a bare `rate_limited` string. Headers exist on the HTTP response and are **discarded**.

---

## 4. Current model status

**CURRENT PRIMARY:** Groq **`openai/gpt-oss-20b`** (hypothesis advisor). Apply remains **shadow**.

| Attribute | Value | Label |
|---|---|---|
| Provider | Groq | VERIFIED IN CODE |
| Model | `openai/gpt-oss-20b` | VERIFIED IN CODE |
| Official production catalog | **Listed** (~1000 t/s, 131k context) | REQUIRES EXTERNAL |
| Availability this session | Models API **yes**; chat **yes** | MEASURED |
| Pricing | **$0.075 / 1M input**, **$0.30 / 1M output** | REQUIRES EXTERNAL (Groq production table) |
| Developer RPM/TPM (paid) | 1K RPM / 250K TPM | REQUIRES EXTERNAL |
| This org’s observed limits | 1000 RPD header, **8000 TPM** | MEASURED → Free plan |
| JSON `json_object` | Supported by API; **fails at max_tokens=180** on advisor-like prompts; **succeeds at max_tokens=512** on a tiny packet | MEASURED |
| Reasoning | `completion_tokens_details.reasoning_tokens` **39–116** on tiny probes | MEASURED |
| Latency (tiny success) | **333–533 ms** end-to-end probe | MEASURED |
| Ranking quality on Flowlary packet | **UNKNOWN** (0 valid holdout ranks) | MEASURED prior |
| Valid production intent-ranker today? | **Listed SKU, but production advisor settings do not reliably return JSON** | MEASURED + VERIFIED |

**Still a valid Groq production model:** **yes** (catalog). **Still a valid Flowlary advisor under current `maxTokens: 180`:** **no evidence of reliable JSON**; see §5.

`allam-2-7b` is **not** on the official production table. Tiny JSON probe **succeeded** (MEASURED). It is **not** the current advisor.

---

## 5. gpt-oss-20b assessment (hypothesis-ranking contract)

**Can it be tested on `AdvisorPacket` → `rankedHypothesisIds`?** In principle **yes**: same `runHypothesisAdvisorProvider` / `callGroqChat` / `parseVote` path already used in the frozen harness.

**Can a meaningful ≥200 valid-rank experiment run now without faking?**

| Blocker | Status now |
|---|---|
| Missing credentials | **no** — key works |
| Daily quota exhausted | **no** — RPD remaining ~full |
| Free RPM/TPM | **yes** — 200 ranks need **throttled** calls (~2s+ and TPM-aware) |
| Frozen `maxTokens: 180` + `json_object` | **yes** — this session: HTTP **400 `json_validate_failed`** on advisor-like prompt; text fallback with 180 tokens returned **empty `content`**, `finish_reason: length` |
| Same prompt + `max_tokens: 512` | HTTP **200**, valid `rankedHypothesisIds` JSON in **~500 ms** | MEASURED |

**Cause of JSON failure (this session):** reasoning tokens consume the 180 completion budget. Groq JSON mode then reports `json_validate_failed`. The client retries as text; content can still be empty → `invalid_response`. This is **not** 429 and **not** quota.

The 6 `invalid_response` rows at the start of the 270-call eval are consistent with this, **then** 429 dominated.

**Ranking accuracy:** still **UNKNOWN**. HTTP smoke in the prior report (`httpOk: true`, `httpModel: openai/gpt-oss-20b`) is **not** 200 holdout ranks. This session’s 512-token toy JSON is **not** a ranking eval.

**GROQ GPT-OSS-20B:** **NOT TESTABLE** for the frozen production contract (`maxTokens: 180` + `json_object`) as a 200-rank quality study **until JSON succeeds at those settings or a separately scoped max-token experiment is authorized**. Quota is **LIMITED**, not dead. Do **not** treat this session’s 512-token toy success as production-ready ranking.

Do **not** raise `maxTokens` in this audit (forbidden). Record it as the **highest-leverage hypothesis** for the next **implementation** experiment.

---

## 6. Gemini assessment

**VERIFIED IN CODE:** no Gemini client, env var, or route.

**NOT TESTED** on Flowlary `AdvisorPacket`. Arabic / English / mixed / technical ranking quality: **UNKNOWN**.

### 6.1 Model IDs (REQUIRES EXTERNAL, Gemini API pricing + changelog + model cards, 2026-08-31)

| ID | Status | Paid in/out per 1M (standard) | Notes |
|---|---|---|---|
| `gemini-2.0-flash` / `flash-lite` | **Shut down** | — | Do not use |
| **`gemini-2.5-flash-lite`** | **Still listed** on pricing | **$0.10 / $0.40** | Cheapest remaining Flash-Lite; structured output claimed |
| `gemini-3.1-flash-lite` | **GA** (May 2026) | **$0.25 / $1.50** | Current small/fast 3.x; structured JSON documented |
| `gemini-3.5-flash-lite` | **GA** on pricing | **$0.30 / $2.50** | Marketed “most cost-efficient GA” but **more expensive** than 2.5-lite |

**Previous candidate `gemini-2.5-flash-lite` is not obsolete on the pricing page.** It remains the **cheapest** Google structured-JSON candidate. The **current-generation** small/fast ID is **`gemini-3.1-flash-lite`**. Re-check the live models list on the day of any implementation.

**If a Google fallback is added later:** prefer **paid** Gemini (pricing page: free tier **“Used to improve our products: Yes”**; paid **No**). Free Gemini is **not** an acceptable production processor for writing snippets.

| Dimension | Finding | Label |
|---|---|---|
| Structured JSON | API supports `response_mime_type` / schema | REQUIRES EXTERNAL; **not measured** on this packet |
| Latency | ESTIMATED 200–800 ms TTFT for tiny JSON; usually **slower than Groq 20B listed 1000 t/s** | ESTIMATED |
| Arabic / mixed | Generally strong in Google’s public claims | **UNKNOWN** for ranking |
| Free-tier | Exists; training-on-prompts; RPD shared | REQUIRES EXTERNAL |
| Privacy | Extra processor (Google Generative), distinct from Cloud Translation | VERIFIED as a new party |
| Implementation complexity | New client, auth, error taxonomy, schema, timeouts | ESTIMATED medium |
| Ranking quality | **NOT TESTED** | |

**GEMINI:** **NOT TESTED**. Architecturally **eligible as failure-only fallback after a working Groq primary**, not as primary now. Candidate IDs: keep **`gemini-2.5-flash-lite`** for cost if still served; otherwise **`gemini-3.1-flash-lite`**. Do not claim ranking quality.

---

## 7. OpenRouter assessment

**VERIFIED IN CODE:** unused.

OpenRouter is a **gateway**, not a model.

| Dimension | Finding | Label |
|---|---|---|
| Extra hop | Edge proxy before Groq/Gemini | REQUIRES EXTERNAL; ESTIMATED +20–80 ms |
| Extra dependency / SPOF | Yes (OpenRouter status + upstream) | qualitative |
| Extra privacy processor | Yes (OpenRouter + chosen upstream) | REQUIRES EXTERNAL FAQ |
| Billing | Pass-through tokens + **credit purchase fee** (FAQ templates; third-party cites **5.5%** Stripe, **$0.80** min) | REQUIRES EXTERNAL |
| BYOK | Not free at scale (allowance then % fee; FAQ text is templated) | REQUIRES EXTERNAL |
| Free models | Tight daily caps; unsuitable for production | REQUIRES EXTERNAL |
| Value vs Direct Groq + Direct Gemini | Useful for **lab shopping**. For **one ranker + one fallback**, it adds hop, fee, routing, and a third contract **without** solving JSON or ranking | evidence-based |

**Direct Groq vs Direct Gemini vs OpenRouter**

- **Direct Groq:** already in production; fastest listed SKU; known error mapping.
- **Direct Gemini:** independent quota; new client; justified **only** as failure-only fallback after primary JSON works.
- **OpenRouter:** Groq→OpenRouter→Gemini is **strictly worse** than Groq→Gemini for this product (extra hop + fee + privacy + routing). Auto-fallback *inside* OpenRouter can hide which model ranked and can **call a second model on disagreement**, which this architecture forbids.

**OPENROUTER:** **REJECTED** as primary and as production fallback. **EXPERIMENTAL ONLY** for optional offline model shopping, not in the typing path.

---

## 8. Single-model architecture

```
Local engine → (ambiguous?) → one Groq ranker → Policy → Write Gate
unavailable/invalid → local decide / noop
```

**Strengths:** minimum complexity; matches current code; typing continues on LLM failure (Policy already maps `invalid` → noop; `unavailable` + conflicts → noop — **VERIFIED IN CODE** in `decide.ts`). Shadow mode ignores advised action.

**Weakness today:** the single model’s JSON+quota path **does not survive** Free-tier 429 or `maxTokens: 180` reasoning overflow. Local engine **does** survive.

**This remains the right shape until JSON is reliable.** Adding Gemini before that makes Gemini the de-facto primary (Allam/gpt-oss fail → always fallback).

---

## 9. Primary / fallback architecture (failure-only)

Proposed:

```
Local → ambiguous?
  NO → local
  YES → Primary Groq
          SUCCESS → rank IDs
          FAIL (timeout / 429 / 5xx / auth / malformed / empty / unknown IDs)
            → Fallback Gemini (same packet)
                SUCCESS → rank IDs
                FAIL → local fallback
→ Policy → Write Gate
```

**Activate fallback only on operational/contract failure. Not on disagreement. Not in parallel. Not via voting.**

**Do not ship fallback until primary JSON works.** Otherwise fallback volume ≈ 100% of consults.

If primary JSON success were ~99% and consults ~1% of cycles, fallback ≈ **0.01% of cycles** and cost ≈ **+1%** vs single model (**ESTIMATED**).

Independent Gemini quota **does** address Groq 429/outage. It does **not** address a bad prompt/contract (both models can return invalid JSON). Local fallback must remain the last step.

**FAILURE-ONLY FALLBACK:** **RECOMMENDED later**, **not now**.

---

## 10. Parallel voting architecture

Groq + Gemini on every consult → vote.

| Axis | Effect |
|---|---|
| Latency | `max(T_primary, T_fallback) + merge` — p95 **worse** |
| Cost | **2×** consult cost always |
| Complexity | merge rules, disagreement, double privacy parties |
| Reliability | more moving parts; correlated JSON bugs possible |
| Accuracy | **UNKNOWN** — no evidence voting beats the best single ranker on this 3-way intent task |
| Failure | if you require both, availability **drops**; if you take either, it is fallback with extra always-on cost |

Consults are rare (~1% of cycles). Voting cannot fix missing local hypotheses (existence ~89%). Mixed/technical families already decide locally.

**PARALLEL VOTING: MUST BE NO.**

Three-model voting is worse on every operational axis.

---

## 11. Dynamic routing architecture

A second AI that chooses layout vs spelling vs mixed vs technical models **duplicates the Decision Engine**.

Holdout evidence (prior MEASURED local baselines): mixed/technical/short often **0 consults** and high local accuracy. Residual errors are **layout FN** and **spelling_layout** — candidate generation and consult **gates**, not a model router.

**MODEL ROUTING: NOT RECOMMENDED.**

Keep the existing deterministic split only: obvious → local; ambiguous → one ranker; translation → Google NMT.

---

## 12. Latency comparison

### 12.1 Product rule

Typing **must not** wait on the LLM at the keyboard. The local engine must remain immediate. LLM **must** be asynchronous relative to keystroke handling. If the result is late, **discard** (already: generation check → `stale`).

**VERIFIED IN CODE — gap:** `runFieldCycle` **awaits** `consultAdvisor` **before** `decideWriting` and Write Gate. The coordinator uses `void runIfEditable` so the **OS keyboard is not frozen**. **Local auto-layout on that cycle is delayed** until Groq returns or 30s timeout, whenever `shouldConsultAdvisor` is true — including in **shadow** mode.

That is the main latency defect. It is not fixed by adding Gemini.

### 12.2 Numbers

| Stage | Typical | Label |
|---|---|---|
| Local analyze + hyps + decide | **0.41–0.44 ms** | MEASURED (architecture-audit corpus) |
| Content → background → API | 5–50 ms | ESTIMATED |
| Groq Allam success-path (prior) | p50 **389** / p95 **640** ms | MEASURED |
| Groq gpt-oss tiny JSON success (max_tokens 512) | **333–533** ms | MEASURED this session |
| Groq 429 / mixed eval sample | p50 **698** / p95 **1768** / max **3750** ms | MEASURED (includes 429) |
| Eval 429 retry storm (Allam harness) | p50 **8.5 s** | MEASURED — **must not ship** |
| Gateway abort | up to **30_000** ms | VERIFIED IN CODE |
| Gemini Flash-Lite tiny JSON | 200–800 ms | ESTIMATED |
| OpenRouter extra hop | 20–80 ms | ESTIMATED |
| Failure + sequential fallback | **sum** of both attempts | ESTIMATED 0.8–2.0 s, often **stale** |

**PRIMARY LATENCY TARGET:** p50 **≤ 400 ms**, p95 **≤ 800 ms**, p99 **≤ 1500 ms** then **discard**.  
**FALLBACK LATENCY TARGET:** p50 **≤ 800 ms**, hard cap **≤ 1500 ms** then local; never extend the 30s gateway budget on the typing path.

**Recommended advisor timeout (do not implement here):** **800–1200 ms** exclusive of the 30s generic AI timeout used by correction/report.

---

## 13. Cost comparison

Advisor tokens **ESTIMATED** ~400 in + ~80 out (prompt + snippet + ≤24 hyps). Reasoning tokens on gpt-oss **add** tens–hundreds of completion tokens (**MEASURED** 39–116 on toys).

`gpt-oss-20b` at $0.075 / $0.30 per 1M:

`cost/call ≈ 400×0.075e-6 + 80×0.30e-6 = $0.000054` (**ESTIMATED**; reasoning can raise output).

Consult frequency **MEASURED** ~0.8–1.2% of cycles. **ESTIMATED** 200 cycles/user/day → **~1.6–2.4 advisor calls/user/day**. Use **1.6** for tables (same as prior audit).

| Users | Calls / month @ 1.6/day | Single Groq 20B | Groq + ~1% Gemini fallback | Parallel 2-vote | 3-vote | OpenRouter layer |
|---|---|---|---|---|---|---|
| 1,000 | 48,000 | **~$2.6** | ~$2.6 | **~$5.2** | **~$7.8** | Groq + **~5.5% credit fee** if billed via OR |
| 10,000 | 480,000 | **~$26** | ~$26 | **~$52** | **~$78** | same tax |
| 100,000 | 4.8M | **~$259** | ~$262 | **~$518** | **~$778** | same tax |

Gemini 2.5 Flash-Lite $0.10 / $0.40 → ~**1.3×** Groq 20B per call (**ESTIMATED**). Gemini 3.1 Flash-Lite $0.25 / $1.50 → **several times** Groq 20B (**ESTIMATED**).

**Translation NMT** (separate): 500k chars/month free then **$20 / 1M chars** (REQUIRES EXTERNAL). Live AR→EN **dominates** advisor cost at scale. Do not put translation on the ranker.

**Correction LLM** already uses gpt-oss-20b — existing product spend, not created by fallback design.

Allam “free” does **not** win: JSON failure + unofficial production listing.

**COST:** Advisor is cheap if JSON is one-shot. **429 storms, retries, and voting** dominate cost and latency. Free-tier 429s are an **ops** problem, not a reason to add OpenRouter.

---

## 14. Reliability comparison

| Architecture | Survive Groq 429? | Survive JSON fail? | Survive outage? | Typing blocked? | Notes |
|---|---|---|---|---|---|
| Local only | yes | n/a | yes | no | ~85–87% holdout action, no ranker |
| Single Groq (today) | **no** (local noop) | **weak** at maxTokens 180 | local noop | keyboard no; cycle wait **yes** | MEASURED |
| Single Groq after JSON+timeout fix | local noop on fail | better | local noop | if cycle still awaits, **partial** | |
| Primary + Gemini failure-only | **yes** if Gemini up | **maybe** (second JSON chance) | **yes** if independent | still need async | after primary works |
| Parallel vote | mixed | mixed | mixed | worse wait | not recommended |
| OpenRouter | depends on router | adds fail point | adds fail point | worse | rejected |

**RELIABILITY:** Local path **PASS**. Current advisor path **FAIL** (JSON at 180 tokens + Free 429 + 30s await). Fallback **helps 429/outage**, **not** a substitute for a working primary contract.

---

## 15. Privacy comparison

**Advisor packet (VERIFIED IN CODE):** bounded snippet (window ±24, cap 160), hypothesis metadata, evidence **kinds**, `hasReplacement` boolean — **no replacement text**. Sensitive `protectedKind` (password, jwt, api-key, tokens, credit-card, …) → **no consult**. Vote with `replacement` / `text` / `write` rejected.

**Provider fallback must send the same packet. No provider may receive more.**

| Path | Extra parties | Training risk |
|---|---|---|
| Groq paid | Groq | Follow Groq DPA (REQUIRES EXTERNAL legal) |
| Gemini **free** | Google Generative | Pricing: **used to improve products** → **FAIL** for production snippets |
| Gemini **paid** | Google Generative | Typically not used for training (REQUIRES EXTERNAL) |
| OpenRouter | OpenRouter + upstream | Extra processor; free hosts worse |
| Google Translate | Cloud Translation | Separate MT path; already in product |

**PRIVACY: PASS** for the current Groq advisor design. **FAIL** if free Gemini or OpenRouter `:free` hosts see snippets.

Google Translate is a **different** payload (full sentence for MT) and must stay off the ranker interface.

---

## 16. Security invariants

These **MUST** remain true for every provider:

| Invariant | Current | Fallback rule |
|---|---|---|
| LLM direct write | **NO** (shadow; Write Gate uses baseline) | **NO** |
| LLM replacement generation | **NO** (parse reject) | **NO** |
| LLM policy bypass | **NO** (`decideWriting` still runs) | **NO** |
| LLM Write Gate bypass | **NO** | **NO** |
| Protected content sent | **NO** (consult skip + mask) | same packet |
| Stale response applied | **NO** (generation check) | same |
| Mixed-language destructive auto-write | **ZERO** in live shadows | `mixedLayoutSafety` still binds |
| Provider failure blocks typing | Keyboard **NO**; cycle **can wait 30s** | must not await fallback serially on the write path |

At no point: LLM failure → automatic unsafe write.  
At no point: LLM failure → block the user’s keystrokes.

---

## 17. Provider abstraction recommendation

**PROVIDER ABSTRACTION: RECOMMENDED** before a second vendor — **design now, implement later**.

Bounded operation:

```
rankHypotheses(packet) →
  success { rankedHypothesisIds }
  | unavailable
  | invalid
  | timeout
  | rate_limited
```

Hide: vendor name, model id, HTTP, auth, timeouts, JSON parse, 429 handling.

**Never return:** replacement text, write command, DOM mutation, arbitrary action.

The rest of Flowlary already consumes `AdvisorVote` + `LlmAdvisorResult`. Map provider outcomes onto existing `'ranked' | 'invalid' | 'unavailable' | 'stale' | 'unused'`.

Do **not** put Translation behind this interface.

A thin `LLMProvider` is justified **if and only if** Gemini (or another independent quota) is actually added. Until then, keep `callGroqChat`. Do not add OpenRouter as the abstraction.

---

## 18. Fallback recommendation

| Event | Primary Groq | Then | Never |
|---|---|---|---|
| 429 | fallback Gemini (paid) | local if Gemini 429 | retry storm |
| timeout (advisor budget) | fallback **only if** remaining budget allows (e.g. 400 ms left); else local | local | wait 30s |
| 5xx / connect failure | Gemini | local | |
| 401/403 | **ops alert**; optional Gemini if independent creds | local | retry with same dead key |
| `json_validate_failed` / invalid JSON / empty rank / unknown IDs | Gemini once | local | second Groq retry |
| Disagreement with local scores | **do not fallback** | Policy | voting |
| Both down | local decide / noop | | freeze field |

**Do not call two models in parallel.**

**Do not implement Gemini until gpt-oss JSON ranking is measured.**

Also required with fallback: **stop awaiting the LLM on the write cycle** (fire-and-forget rank; apply only if generation matches and apply mode is on). Fallback latency is otherwise unusable.

---

## 19. Required experiments

Minimum experiment **before** choosing a production primary (frozen packet, frozen prompt, frozen gold):

| Item | Rule |
|---|---|
| Same hypotheses | production `collectHypotheses` |
| Same `AdvisorPacket` | `buildAdvisorPacket` |
| Same unseen holdout | frozen gpt-oss generator seed **20261107** (or a new frozen seed if that file is retired — do not mix gold) |
| Same gold labels | generator-owned, not model-owned |
| Models | **A:** current production settings `openai/gpt-oss-20b` (`maxTokens` 180, `json_object`) **B:** only if A JSON-fails, a **declared** one-parameter experiment (e.g. higher `maxTokens`) — not prompt shopping |
| Spacing | respect **30 RPM / 8K TPM** or use a paid Groq plan; **no 429 retry storms** |
| Stop | ≥ **200 valid** ranks **or** prove JSON success rate too low with quota available |
| Metrics | Top-1, Top-2, final advised accuracy, abstention, FP, latency **on valid ranks**, JSON success, failure taxonomy (429 vs invalid vs timeout) |
| Safety | shadow only; mix auto-write 0; protected 0; stale 0 |

**Winner rule:** operational JSON + latency + safety first; then accuracy vs local baseline. Reputation / MMLU **does not** pick the model.

Gemini ranking eval is **out of scope** until Groq JSON works. OpenRouter is out of scope.

---

## 20. Unknowns

- Ranking accuracy of **any** JSON-reliable model on this packet (**HIGH**)
- Whether `maxTokens: 180` can ever work with gpt-oss reasoning on real packets (**HIGH** — toys fail at 180, succeed at 512)
- This org’s Groq **plan** beyond inferred Free headers (console limits page not fetched as HTML login)
- Exact RPM (header set is RPD + TPM, not RPM)
- Gemini JSON validity and ranking on the same packet
- Real DAU / cycles / tokens in production
- Chrome typing feel with cycle-await vs true async
- Allam long-term catalog status (API-listed, not production-table-listed)
- OpenRouter exact live fee percentages (FAQ is templated)

---

## 21. Final architecture recommendation

Keep:

```
USER
  → Local Analysis
  → Hypothesis Generation
  → Strong deterministic case? YES → Local Decision
  → NO → Async LLM ranker (IDs only)
        PRIMARY: Groq openai/gpt-oss-20b   // after JSON+timeout proven
        FALLBACK: none now
                  later paid Gemini flash-lite on failure only
        both fail → Local fallback
  → Policy
  → Write Gate

Translation:
  Arabic → Google Cloud Translation → optional Groq polish
```

**Intent ranker ≠ translator.** One assistant UX. No vendor picker. No voting. No model router. No per-keystroke LLM. No LLM write.

**Now:** do not add providers. Do not enable apply. Do not change the model in this audit. Fix **understanding** of Groq health: **limited Free RPM/TPM + JSON/max_tokens**, not a dead key.

---

## 22. Exact next implementation step

**One concrete action:** Re-run the **frozen gpt-oss-20b shadow harness** only after Groq JSON is shown to succeed under the **production** advisor request (`json_object`, `maxTokens: 180`, same prompt) **or** after a separately approved one-line `maxTokens` experiment — with **RPM/TPM-safe spacing** (or a paid Groq plan). Target **≥200 valid holdout ranks**. Keep apply **off**. Do **not** add Gemini, OpenRouter, voting, or routing in that step.

Until then, treat the advisor as **shadow telemetry that currently fails closed**.

---

## Scoring matrix (objective; unmeasured quality not marked measured)

Workload = short bilingual **hypothesis ranking**. Scores 1–5.

| Criterion | A Allam Groq | B gpt-oss-20b Groq | C Gemini small/fast | D OpenRouter |
|---|---|---|---|---|
| Ranking quality | UNKNOWN (n=1) | UNKNOWN (n=0) | NOT TESTED | n/a |
| Arabic | prior family; ranking unproven | NOT TESTED | NOT TESTED | n/a |
| English | NOT TESTED | NOT TESTED | NOT TESTED | n/a |
| Mixed-language | NOT TESTED | NOT TESTED | NOT TESTED | n/a |
| Technical | NOT TESTED | NOT TESTED | NOT TESTED | n/a |
| JSON reliability | MEASURED poor on real packets; toy OK | MEASURED fail at 180; toy OK at 512 | UNKNOWN | extra parse hop |
| Latency | MEASURED OK when 200 | MEASURED ~0.3–0.5 s toys; 429 samples slow | ESTIMATED slower | extra hop |
| Cost | unknown official | listed cheap | 2.5-lite cheap; 3.1+ dearer | fee |
| Rate limits | Free Allam headers 7k RPD / 6k TPM | **LIMITED** 8k TPM / 1k RPD | unknown for this project | free-model caps |
| Availability | not on prod table; API live | **listed production** | GA IDs exist | third SPOF |
| Privacy | Groq | Groq | fail if free; ok if paid | worse |
| Ops complexity | already wired | already wired | new | highest |

**Next experiment winner on paper:** **B** (already current primary, listed SKU, same stack). **Not** a claim it ranks better than Gemini.

---

## Final verdict

CURRENT PRIMARY:  
Groq openai/gpt-oss-20b (shadow)

CURRENT PRIMARY HEALTH:  
FAIL

CURRENT GROQ QUOTA:  
LIMITED

GROQ GPT-OSS-20B:  
NOT TESTABLE

GEMINI:  
NOT TESTED

OPENROUTER:  
REJECTED

PROVIDER ABSTRACTION:  
RECOMMENDED

FAILURE-ONLY FALLBACK:  
RECOMMENDED

PARALLEL VOTING:  
MUST BE NO unless evidence strongly supports it

MODEL ROUTING:  
NOT RECOMMENDED

LLM PER-KEYSTROKE:  
MUST BE NO

LLM DIRECT WRITE:  
MUST BE NO

GOOGLE TRANSLATE:  
KEEP SEPARATE

PRIMARY LATENCY TARGET:  
p50 ≤ 400 ms / p95 ≤ 800 ms (MEASURED toys ~0.3–0.5 s; production cycle still may await up to 30 s)

FALLBACK LATENCY TARGET:  
p50 ≤ 800 ms / discard by 1500 ms (ESTIMATED; do not implement yet)

COST:  
Advisor ESTIMATED ~$3 / 1k users / month single Groq; voting 2–3×; Translation NMT dominates if live AR→EN is on

PRIVACY:  
PASS

RELIABILITY:  
Local PASS; advisor FAIL (JSON at maxTokens 180 + Free 429 + 30s cycle wait); fallback valuable only after primary JSON works

FINAL ARCHITECTURE:  
Local-first hypothesis engine; one async Groq ranker; failure-only paid Gemini later; Google Translate stays the MT path; never vote or route models

NEXT STEP:  
Prove gpt-oss-20b JSON on the frozen AdvisorPacket with RPM/TPM-safe spacing (or paid Groq) until ≥200 valid ranks; keep apply off; do not add Gemini yet

CONFIDENCE:  
HIGH
