# Flowlary Local AI Understanding Layer — Model Selection Study

**Date:** 2026-09-01  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Production code modified:** none  
**Harness:** `tests/audit/evaluation/local-ai-model-selection.eval.test.ts`  
**Machine-readable results:** `tests/audit/evaluation/local-ai-model-selection-results.json`  
**Raw rows:** `tests/audit/evaluation/local-ai-model-selection/raw-evidence.json`

Evidence classes used in this document:

| Tag | Meaning |
| --- | --- |
| REAL MEASURED | Executed in this session against Flowlary code |
| REAL MEASURED PRIOR | Existing Flowlary live/holdout artifacts in this repo |
| EXTERNAL | Official model cards / technical reports |
| ESTIMATE | Extrapolated; not run here |
| NOT RUN | Blocked (disk, quota, or missing weights) |

---

## 1. Current Flowlary problem

Flowlary’s live typing path is already a **local-first unified pipeline**, not a missing LLM writer:

`InputEngine` → `runFieldCycle` → `analyzeFieldText` → `collectHypotheses` → `decideWriting` → `UserWritingPolicy` → `commitWriteTransaction` (Write Gate).

What is actually weak, from **REAL MEASURED** data:

| Source | Finding |
| --- | --- |
| This study, 1269-case stratified set | Local auto-write **recall 28.7%**, **precision 83.8%**, **F1 0.43**. Preserve precision **95.4%**. Mixed bilingual auto-write **0**. Mean local cycle **0.44 ms**. Advisor consult rate **1.8%**. |
| `tests/audit/evaluation/local-baseline-results.json` | On the 4500-case architecture corpus (different success rule: English gold may noop/suggest), action accuracy **85.6%**, layout recall **72.6%**, spelling_layout family **354/750**, mixed/technical **0 consults**. |
| Gemini advisor full-live | On 200 ranked layout cases: **help 0, harm 0, accuracyDelta 0**, P50 **940 ms**. Ranking IDs does not beat a local winner that already exists. |
| Groq `openai/gpt-oss-20b` full-live | **INCONCLUSIVE** (429 rate limit). Not a quality signal. |

The product hole is **not** “no language model.” It is:

1. **Layout false negatives** (local will not auto-write unless sequence evidence is strong).
2. **English grammar/punctuation** the deterministic engine barely attempts (this set: grammar stratum useful **1/5**).
3. **Writing Review is only partially wired** (`scheduleFieldWritingReview` is called from `pipeline.ts` but not defined; `registerProductionWritingReview` is not started from `startWritingRuntime`).
4. **Cloud ranking is rarely consulted** (`shouldConsultAdvisor` is conflict/needsLLM gated) and, when it is, prior live ranking did not improve layout.

A second unconstrained “understanding LLM” would attack the wrong failure mode: Flowlary already **preserves** mixed/technical text well. Extra detectors mainly add **false positives** and **latency**.

---

## 2. Exact local-model task definition

### Allowed (candidate / evidence only)

The model may never be the writer or the final authority. Write Gate and `decideWriting` stay in charge.

| Task | Local model? | Deterministic? | Cloud? |
| --- | --- | --- | --- |
| Tokenize, scripts, protected kinds, incomplete secrets | No | **Must remain deterministic** (`tokenKind.ts`, `chunks.ts`) | No |
| Keyboard physical remap (`mapLayout`) | No | **Must remain the only replacement source for layout** | No |
| Mixed-intent layout safety | No | **Must remain** (`mixedLayoutSafety.ts`) | Cloud may only rank IDs |
| Instant / edit-distance English spelling maps | Keep | Primary | Cloud review may add island edits |
| “Is this span a layout error vs intentional mix?” | Optional ranker | Already primary | Existing hypothesis advisor |
| English grammar / punctuation on a **completed English island** | Optional, Writing Review contract | Weak today | Existing writing-review providers |
| Full-field rewrite | **Forbidden** | Forbidden | Forbidden |
| DOM / write / HTML / commands | **Forbidden** | Write Gate only | Forbidden |
| Invent layout replacements that fail `mapLayout` | **Forbidden** (`ingestReviewEdits` drops them) | Enforced | Enforced |
| User override, paste, composing, open token | No | **Must remain** | Skip network |

### Recommended contract (not the chat schema)

The user-proposed `{ verdict, issues[] }` schema is **weaker** than the repo’s Writing Review contract:

- Review already forbids extra keys, caps snippet 400 / edits 8 / proposed 80, requires `original === snippet.slice(start,end)`, maps `layout_suspect` through `mapLayout`, and becomes a `Hypothesis` via `ingestReviewEdits`.
- Hypothesis advisor already forbids replacements and only ranks **existing IDs**.

**Do not introduce a third JSON dialect.** If a local model is ever added, it must speak **exactly** `parseWritingReviewContent` or `validateAdvisorVote`.

### What the old “second understanding layer” proposal gets wrong

Inserting a model **between analysis and hypotheses** (Design A) creates a parallel detector that can invent spans the engine cannot legally apply.  
Independent candidate generation (Design C) duplicates `collectHypotheses` and fights preserve policy.  
This study **rejects both** for this codebase.

---

## 3. Candidate models (2026)

Serious candidates considered (not a popularity list):

| Model | Params | Why it was a candidate | License (EXTERNAL) |
| --- | --- | --- | --- |
| Qwen3 0.6B | 0.6B | Smallest runnable Qwen3; multilingual claim | Apache 2.0 |
| Qwen3.5 0.8B | 0.8B | Current Qwen small; 201 languages claimed; IFEval 52.1 non-thinking | Apache 2.0 |
| Qwen3 1.7B | 1.7B | Small instruct + JSON history | Apache 2.0 |
| Qwen3-4B-Instruct-2507 | 4.0B | Strong IFEval 83.4; MultiIF 69.0; no `<think>` blocks | Apache 2.0 |
| Qwen3.5 4B | 4B | Hybrid architecture; 262k context; 201 languages | Apache 2.0 |
| Gemma 4 E2B | 2.3B effective (5.1B w/ embeddings) | On-device family; 140+ languages; llama.cpp/Ollama day-one | Apache 2.0 (Google blog 2026) |
| Gemma 4 E4B | 4.5B effective | Same family, higher quality | Apache 2.0 |
| Gemma 3 1B IT | 1B | Tiny Gemma 3 | Gemma license; **English-primary** (HF: 1B is English, 4B+ is 140 langs) |
| Gemma 3 4B IT | 4B | 128k; multilingual | Gemma license |
| Llama 3.2 1B / 3B | 1B / 3B | Already on this Mac (3B); tool-use | Llama Community |
| SmolLM3 3B | 3B | Fully open recipe | Apache 2.0; **Arabic secondary** (Belebele AR 40.22 vs Qwen3-4B 51.78) |
| Phi-4-mini ~3.8B | 3.8B | Strong English math | MIT; **English-centric, weak bilingual case** |
| Qwen3 8B | 8.2B | Quality ceiling in “small” class | Apache 2.0; too heavy for current API box |

**Measured in this session (Ollama 0.32.5, Apple M3 16 GB, Metal):**

- `qwen3:0.6b` (522 MB Q4-class blob)
- `llama3.2:latest` (2.0 GB, 3B-class)

**Not run:** Gemma 4, Qwen3.5, Qwen3-4B, Gemma 3 4B. After pulling 0.6B, APFS Data volume had **~519 MiB free**. Larger GGUFs were not practical.

---

## 4. External evidence (not Flowlary suitability)

| Model | EXTERNAL signal relevant to Flowlary | Weakness for Flowlary |
| --- | --- | --- |
| Qwen3-4B-Instruct-2507 | IFEval 83.4; MultiIF 69.0; WritingBench 83.4; 256k; explicit non-thinking | General writing ≠ span-accurate layout detection |
| Qwen3.5-0.8B | IFEval 52.1; MMMLU 34.1; intended for prototyping/finetune | Too weak for grammar+Arabic mix without finetune |
| Qwen3 0.6B | Smallest Qwen3 dense | Instruction/JSON brittle at this size |
| Gemma 4 E2B/E4B | 140+ langs; 128k; on-device; Apache 2.0 | Arabic often trails Qwen on public Arabic suites (third-party 2026 writeups) |
| Gemma 3 1B | Fast | **Not multilingual enough** |
| SmolLM3 | Strong EU langs | Native 6 langs; Arabic undertrained |
| Llama 3.2 3B | Ubiquitous GGUF; already local | Weaker Arabic/JSON than Qwen3-4B on public tables |
| Phi-4-mini | MIT; strong GSM8K | Poor fit for AR/EN mix |

General MMLU/GSM8K **must not** decide this product.

---

## 5. Flowlary-specific dataset

Generator: `tests/audit/evaluation/local-ai-model-selection/dataset.ts`  
Seeded architecture holdout from `generate.ts` (`ARCH_EVAL_SEED = 20261015`) **plus** `GOLDEN_INTENT_CASES` **plus** hand cases for JWT, incomplete `eyJ`/`https`, slang, Arabizi, paste, names, grammar.

**REAL MEASURED size:** 1269 cases (574 should-intervene, 691 must-preserve).

| Stratum | n | intervene gold | preserve gold |
| --- | --- | --- | --- |
| A English spelling | 87 | 85 | 2 |
| B English grammar | 5 | 4 | 1 |
| C English punctuation | 121 | 90 | 31 |
| D Arabic | 102 | 0 | 102 |
| E AR+EN mixed | 217 | 1 | 216 |
| F Intentional bilingual | 216 | 0 | 216 |
| G Keyboard layout | 485 | 483 | 2 |
| H Spelling after layout | 107 | 107 | 0 |
| I Technical | 153 | 0 | 153 |
| J URLs | 31 | 0 | 31 |
| K Emails | 43 | 0 | 43 |
| L Secrets / JWT / keys | 28 | 0 | 28 |
| M Code | 72 | 0 | 71 |
| N Names | 4 | 0 | 4 |
| O Slang | 3 | 0 | 3 |
| P Arabizi | 8 | 0 | 8 |
| Q Short fragments | 125 | 0 | 125 |
| R Long sentences | 31 | 29 | 2 |
| S Multiple errors | 2 | 2 | 0 |
| T Intentional unusual | 17 | 0 | 17 |
| U User vocabulary | 2 | 1 | 1 |
| V Rapid/incomplete | 3 | 0 | 3 |
| W Open tokens | 3 | 0 | 3 |
| X Pasted | 1 | 0 | 1 |
| Y Protected | 109 | 0 | 109 |
| Z Ambiguous PRESERVE | 102 | 0 | 99 |

Model inference used a **90-case stratified subsample** (all 26 letters represented) because 4B+ weights were unavailable and 3B P95 is ~4 s/request.

Grammar/slang/paste counts are smaller than layout holdout by construction of the existing generators. That is honest: Flowlary’s labeled infrastructure is **layout/mix/technical-heavy**, which is also the product’s real risk surface.

---

## 6. Evaluation methodology

Compared systems:

| ID | System | How |
| --- | --- | --- |
| A | Local engine only | `analyzeFieldText` → `collectHypotheses` → `decideWriting` |
| B | Local + ranker | Ollama JSON → `validateAdvisorVote` → `decideWriting(advisorVote)` |
| C | Local + detector | Ollama detector JSON → span map → `ingestReviewEdits` → re-decide |
| C′ | Writing Review contract | Same ingest path, 18 islands/model |
| D | Local + cloud | **Not re-run live**; uses Gemini/Groq prior artifacts |

Success rules (stricter than architecture-audit `actionOk`):

- **Useful:** gold layout → `layout_fix`; gold English → `english_correction` or `suggestion`.
- **Harmful:** `mustPreserve` or protected **and** auto `layout_fix` / `english_correction` / `translation`.
- **Forbidden keys** scanned on parsed JSON.
- Detector issues must match exact character offsets or they **do not ingest**.

Reproduce:

```bash
cd tests/audit/evaluation
npx vitest run --config local-ai-model-selection.vitest.config.ts
```

Requires Ollama at `127.0.0.1:11434` for model rows. Local-engine rows do not.

---

## 7. Actual results (REAL MEASURED)

### A. Local engine (n=1269)

| Metric | Value |
| --- | --- |
| Detection precision | 0.838 |
| Detection recall | 0.287 |
| F1 | 0.428 |
| FPR | 0.046 |
| FNR | 0.713 |
| Preserve precision | 0.954 |
| Harmful intervention rate | 0.025 (32 cases) |
| Protected-label violation rate | 0.071 (label overlap; mixed bilingual **0** auto-writes) |
| Consult rate | 0.018 |
| Latency P50 / P95 | 0.42 ms / 0.91 ms |
| Confusion | TP 165, FP 32, FN 409, TN 663 |

Stratum highlights:

- Mixed / intentional bilingual / technical / short / slang / Arabizi / names: **0 auto-write** on the large mixed/tech buckets.
- Layout gold: many FNs (engine abstains — this is conservative, not a model-shaped gap).
- Grammar: almost no useful auto-writes.
- Some “D_arabic / Z_ambiguous / Y_protected” harmful counts are **stratum overlap** with architecture contextual/punctuation frames, not JWT rewrites. Mixed preserve stayed clean.

**Expected Product Value (this study’s formula):**  
`useful - 3*harmful - unnecessary - latencyPenalty` = **64** on the full set; **1** on the 90-case sample (sample is preserve-heavy).

### B/C. Local + Ollama (n=90 subsample)

| | qwen3:0.6b ranker | qwen3:0.6b detector | llama3.2:latest ranker | llama3.2:latest detector |
| --- | --- | --- | --- | --- |
| n | 87 | 90 | 87 | 90 |
| JSON validity | **0.966** | **0.989** | 0.885 | 0.500 |
| Span localization OK | n/a | **0.111** | n/a | **0.033** |
| Forbidden-field rate | 0 | 0 | 0 | 0 |
| Improve vs local | **0** | **0** | 1* | **0** |
| Worsen vs local | **2** | **0** | **3** | **0** |
| Useful (absolute) | 8 | 10 | 7 | 10 |
| Harmful (absolute) | 2 | 2 | 1 | 2 |
| P50 latency | 655 ms | 537 ms | 2187 ms | 2062 ms |
| P95 latency | 1023 ms | 742 ms | 4019 ms | 3229 ms |
| Tokens/request (mean, all contracts) | 357 | 357 | 348 | 348 |
| Product value | **-17** | **-10** | **-16** | **-16** |

\*Llama ranker “improve 1” is a **harm reduction** (`harmfulDelta: -1` in raw evidence), not a new useful correction. **No model row has `usefulDelta: +1`.**

Writing Review contract (18 islands):

- Qwen3 0.6B: JSON **94.4%**, improve **0**, P95 **900 ms**
- Llama 3.2: JSON **0%** (schema miss), P95 **7351 ms**

Detector span failure is decisive: models return JSON but **wrong offsets**, so `ingestReviewEdits` cannot legally apply anything. That is exactly why a “second understanding layer” would be decorative or unsafe (if we ignored span checks).

### D. Local + cloud (REAL MEASURED PRIOR)

Gemini 3.5 Flash-Lite hypothesis advisor, 200 layout cases: **accuracyDelta 0, help 0, harm 0**, P50 940 ms, ~528 tokens/review.  
Groq gpt-oss-20b: **no valid ranks** (rate limit).

---

## 8. Model comparison table

| Criterion | Local engine | Qwen3 0.6B | Llama 3.2 3B | Qwen3-4B-Instruct-2507 | Gemma 4 E2B |
| --- | --- | --- | --- | --- | --- |
| Flowlary useful Δ | baseline | 0 | 0 | NOT RUN | NOT RUN |
| Flowlary worsen | baseline | ranker 2 | ranker 3 | — | — |
| JSON on our contract | n/a | strong | weak (detector/review) | EXTERNAL strong IFEval | UNKNOWN on our JSON |
| Arabic/mix preserve | excellent | did not ingest | did not ingest | EXTERNAL better than Gemma on many AR suites | EXTERNAL mixed |
| P95 | 0.9 ms | ~1 s | ~4 s | ESTIMATE 0.3–1.5 s on M3 Q4 | ESTIMATE similar to 2–3B |
| Fits 16 GB Mac | yes | yes | yes | ESTIMATE Q4_K_M ~3 GB | ESTIMATE Q4 ~2–3 GB |
| Fits current Docker API (no GPU, 1 process) | yes | only as sidecar | sidecar | sidecar; fights RAM with Node | sidecar |
| Commercial license | n/a | Apache 2.0 | Llama Community | Apache 2.0 | Apache 2.0 |
| **Flowlary verdict** | **Keep** | Too weak / no gain | Too slow / no gain | Best **unmeasured** follow-up if any | On-device interesting, unmeasured |

### Size ladder (this product)

| Size | Verdict for Flowlary |
| --- | --- |
| 270–500M / 0.6B | **Too weak as a detector.** High JSON rate, **~11% span accuracy**, 0 useful delta. |
| 1B | Gemma 3 1B is English-first — **reject** for AR/EN. Llama 3.2 1B **NOT RUN** (disk). Unlikely to beat 0.6B on span+Arabic. |
| 2–3B | Llama 3.2 3B **measured: worse latency, worse JSON, net worsen on ranker.** Not a sweet spot here. |
| 4B | **Unmeasured.** EXTERNAL best chance for Writing Review JSON + multilingual. Only justified as **paused English-island review**, not a second engine. |
| 7–8B | Quality gain **ESTIMATE** not worth current 16 GB + single Node box + real-time budget. |

**BEST ULTRA-LIGHT (measured):** `qwen3:0.6b` — only because it is fast and schema-obedient, **not** because it helps.  
**BEST BALANCED (measured):** still the **deterministic engine**. Among models, 0.6B beats 3B on this task.  
**BEST QUALITY (external, unmeasured):** `Qwen3-4B-Instruct-2507` (or Qwen3.5-4B after a Flowlary rerun).  
**BEST OVERALL:** **no local generative model in the typing path.**

---

## 9. Hardware requirements

**This machine (REAL MEASURED):** Apple M3, 8 CPU cores, 10 GPU cores, 16 GB unified RAM, Darwin 25.5.0, Ollama 0.32.5, ~1 GB then 519 MiB disk free, no MLX-LM, no llama.cpp CLI.

**Production (CODE TRACE):** `deploy/Dockerfile` is `node:22-bookworm-slim`, PM2 `instances: 1`, compose API+nginx, **no GPU, no RAM reservation, JSON file store**. Advisor RPM global **60**, per-provider in-flight **4**.

| Concurrent users | Local 0.6B Ollama on M3 | 4B Q4 on this Mac | Current production VM |
| --- | --- | --- | --- |
| 1 | Feasible (~1–2 rps) | ESTIMATE feasible | N/A (no weights) |
| 10 | Queueing; P95 will miss 1500 ms budget | Tight on 16 GB with Chrome+Node | **Insufficient** without a sidecar + RAM |
| 50 | No | No | Need dedicated inference (vLLM/GPU or many llama.cpp slots) |
| 100 | No | No | Same |

**Minimum if a 4B review sidecar is ever required:** 8 vCPU, **32 GB RAM**, NVMe, optional 8–12 GB VRAM; isolate Node API from llama.cpp/vLLM. Do not load 4B inside the 8787 Node process.

---

## 10. Runtime comparison

| Runtime | Fit for this workload |
| --- | --- |
| **Ollama** | What we actually ran. Fine for **offline eval**. Weak multi-tenant control vs RPM/health already in `providerHealth.ts`. |
| **llama.cpp** | Best **small sidecar** on Apple Silicon / CPU VMs: GGUF Q4_K_M, short context (512–2048), JSON grammar. Prefer this over Ollama in production if a sidecar exists. |
| **vLLM / SGLang** | Only if GPU and ≥50 RPM of 4B+. Overkill for current 1-instance JSON API. |
| **Transformers + MPS** | `torch` present; MPS reported false in sandbox probe. Not the production path. |
| **On-device in the extension** | WebGPU/WASM 0.6B might be possible later; **not** justified by quality results. Also fights the “model must not block typing” rule. |

**Choice for this workload:** do not deploy an inference runtime. If a future Writing Review experiment happens, **llama.cpp GGUF Q4_K_M** beside the API, OpenAI-compatible, same 1500 ms deadline.

---

## 11. Architecture recommendation

Evaluated designs:

| Design | Verdict |
| --- | --- |
| A. Analyze → **Model** → Decide | **Reject.** Invents spans; bypasses hypothesis evidence. |
| B. Analyze → Hyps → **Model ranks** → Decide | **Already exists** (hypothesis advisor). Measured local models **worsen or no-op**. Gemini ranking **Δ=0**. Do not add a second ranker. |
| C. Model independently generates candidates | **Reject.** Detector span-ok 3–11%; ingest correctly drops them. |
| **D′ (codebase-native)** Writing Review island → model edits → `ingestReviewEdits` → Decide → Write Gate | **The only design that fits.** Incomplete wiring today. A local model is optional **behind this existing door**, not a new layer. |

Do **not** create a parallel understanding engine.

---

## 12. Trigger strategy

| Trigger | Verdict |
| --- | --- |
| Every keystroke | **Forbidden.** Local engine is 0.4 ms; any LLM is 0.5–4 s. |
| Every N words / spaces | Too chatty; races with open tokens. |
| Sentence boundary **and** pause | Matches `writingReview.ts` (**900 ms pause, 2500 ms min interval**). |
| Suspicious local signal only | Matches `shouldConsultAdvisor` (already). Do not expand until a model has positive useful Δ. |
| Paste / drop / composing / secrets | **Never call.** |

**Practical policy (current product):** keep local decide **synchronous every cycle**; keep LLM **async, abortable, generation-checked** (already in `pipeline.ts`).

**ESTIMATE requests/user/hour** (40 WPM knowledge worker, 50% English islands, review enabled):

- Pause+sentence review: **~15–40**
- Advisor conflicts only: **~2–8** (matches 1.8% consult rate on our set if scaled to real fields)
- Keystroke: **thousands — do not**

---

## 13. Cloud escalation strategy

Existing stack: Groq (`openai/gpt-oss-20b`) → Gemini (`gemini-3.5-flash-lite`) → OpenRouter. Fallback **off** by default. Max tokens **512**. Deadline **1500 ms**.

**Do not vote.**

Recommended relationship:

1. **Deterministic engine always decides immediately.**
2. **Hypothesis advisor (cloud)** only when `shouldConsultAdvisor` — ID rank, suggestion-only apply (pipeline already blocks late auto-write).
3. **Writing review (cloud)** only after pause on an English island, when `registerProductionWritingReview` is actually wired.
4. **No local model in front of or in parallel with these.** A local model that is worse than Gemini and slower than local rules would **duplicate cost and conflict**.
5. Escalate to cloud **only for uncertainty the local engine already marks** (`needsLLM`, mix layout risk, translate-vs-layout). Not “local model uncertain.”

Privacy: secrets already skip advisor/review packets. Keep that **deterministic**.

Cost (ESTIMATE from Gemini prior 105 599 tokens / 200 reviews ≈ 528 tokens/review):

| Volume | Cloud tokens (ESTIMATE) | Local 0.6B |
| --- | --- | --- |
| 1 000 reviews | ~0.53M | ~357k tokens compute on-box, $0 API |
| 10 000 reviews | ~5.3M | electricity only |

Local 0.6B does **not** reduce cloud cost unless it **replaces** review/advisor calls. It currently **cannot** (0 useful Δ, cannot ingest spans). **No API savings.**

---

## 14. Safety analysis

| Surface | Must stay deterministic even if a 4B is great |
| --- | --- |
| URLs, emails, JWT, API keys, env secrets, incomplete prefixes | `skipReasonForToken` / `incompleteProtectedReason` |
| Mixed AR/EN layout auto-write | `layoutSpanConflictsWithMixedIntent` |
| Code editors / passwords / OTP | `evaluateFieldSafety` |
| Open token under caret | `openTokenRange` |
| User override after engine write | `FieldSession.detectUserOverride` |
| Paste/drop | `inputSource` → preserve |
| Stale / rapid typing | generation + text equality in `pipeline.ts` |
| Contenteditable nested | editor tier; auto-write off |
| Model output | no write keys; span match; `mapLayout` for layout_suspect |

Measured models produced **0 forbidden write keys**. They failed **span honesty**, which is the dangerous failure if someone skipped ingest checks.

---

## 15. Long-session analysis

Not a 60-minute wall-clock typing session (that would be mostly idle). **Simulation:**

| Probe | Result |
| --- | --- |
| 400 local inspect cycles | P50 0.42 ms, P95 0.95 ms (no degradation vs single-shot) |
| RSS | +623 KB over 400 cycles (noise, not a leak) |
| CPU | 235 ms user / 2.4 ms system |
| 24 sequential Ollama detector calls (both models) | RSS **did not grow** (91 MB → 86 MB in the Node process) |
| Stale/races | Not exercised against DOM; production already aborts on generation mismatch |
| Cache | Ollama `keep_alive 10m`; first request includes load (warmup issued) |

**UNVERIFIED:** 60 minutes of Chrome content-script + service worker + model sidecar. That is an E2E follow-up, not a model-selection blocker given 0 quality gain.

---

## 16. Final selected model

**None for production.**

If a **future** Writing Review experiment is funded after wiring `scheduleFieldWritingReview`:

- **Try first:** `Qwen3-4B-Instruct-2507` GGUF **Q4_K_M**, llama.cpp, `enable_thinking` off (2507 is non-thinking).
- **Do not try first:** Gemma 3 1B, Phi-4-mini, SmolLM3, 7B/8B, or a custom detector schema.

---

## 17. Why alternatives were rejected

| Candidate | Why rejected **for this codebase** |
| --- | --- |
| Local “understanding layer” as proposed | Wrong insertion point; 0 useful Δ; span localization fails |
| Qwen3 0.6B | Best ultra-light JSON; **does not improve Flowlary** |
| Llama 3.2 3B | Slower; worse JSON; ranker net worsen |
| Gemma 3 1B | English-primary; bilingual product |
| SmolLM3 | Arabic undertrained vs Qwen3-4B (EXTERNAL Belebele) |
| Phi-4-mini | English STEM, not AR/EN typing |
| Gemma 4 E2B/E4B | Promising on-device **EXTERNAL**; **NOT RUN** (disk); do not crown untested |
| Qwen3 8B / Gemma 4 12B+ | Latency + RAM vs 1500 ms and 1-process API |
| Replacing `decideWriting` | Violates architecture; Write Gate / policy / mixed safety |
| Voting local+Groq+Gemini | Prior advisor Δ=0; voting amplifies latency and conflicts |

---

## 18. Implementation plan

**Do not implement a local model now.**

If quality later justifies a **Writing Review sidecar** (after a 4B rerun on this harness with span-ok ≥ 0.8 and usefulΔ > harmfulΔ):

1. Finish existing review wiring: define `scheduleFieldWritingReview`, call `registerProductionWritingReview()` from `startWritingRuntime`.
2. Add a backend provider that posts the **existing** `WritingReviewPacket` to llama.cpp; reuse `parseWritingReviewContent`.
3. Keep Groq/Gemini as fallback using `writingReviewProviderManager` (failure-only, not vote).
4. Never auto-write review layout without `mapLayout`. Keep apply path suggestion-first if risk ≠ low.
5. Deploy llama.cpp **next to** Node, not inside it.

**Files that would change then (not now):**

- `extension/src/core/writeGate/pipeline.ts` (review schedule)
- `extension/src/content/startWritingRuntime.ts`
- `extension/src/core/engine/writingReview.ts` / `writingReviewClient.ts`
- `backend/src/providers/writingReviewProviderManager.ts` (+ new local adapter)
- `deploy/docker-compose.yml` (optional sidecar)
- This eval harness as a release gate

---

## 19. Test plan (must pass before enabling any local model)

1. This harness: usefulΔ ≥ 0, worsen = 0 on preserve strata E/F/I/J/K/L/Y, span-ok ≥ 0.8, JSON ≥ 0.95, P95 ≤ 1500 ms on the target box.
2. `tests/unit/writing-engine/scenario-classes.test.ts` and `n4-mixed-language.test.ts`.
3. Playwright `tests/e2e/extension-writing.spec.ts` mixed bilingual + leftover layout.
4. Protected: JWT, `sk-`, incomplete `eyJ`/`https` — zero interventions.
5. Advisor contract tests: no `replacement`/`write` keys.
6. Generation-stale: ignore late review (existing pipeline checks).
7. Live provider probes remain green if cloud fallback stays.

---

## 20. Go / No-Go

### NO-GO

Do **not** add a Local AI Understanding Layer to Flowlary at this time.

Decisions matching the required checklist:

1. **Should we add it?** No.
2. **If yes, what should it do?** N/A. The only *future* role is **Writing Review island edits**, not detection-before-hypotheses.
3. **Which model?** None in production. Unmeasured follow-up: Qwen3-4B-Instruct-2507.
4. **Why?** Measured 0.6B and 3B **do not increase useful corrections**; ranker can worsen; detector cannot localize spans; latency 500–4000 ms vs 0.4 ms local.
5. **Size?** 0.6B too weak; 3B not better; 4B unproven; 7B+ unjustified.
6. **Quantization?** If ever: **Q4_K_M** GGUF.
7. **Runtime?** If ever: **llama.cpp** sidecar, not Ollama-in-prod, not vLLM on this API.
8. **Server?** Current deploy **cannot** host a useful 4B for 50–100 users. Need ≥32 GB + sidecar.
9. **Latency?** Local engine **<1 ms P95**. Measured models **0.5–4 s P95** — over or near the 1500 ms advisor budget, and they are async-only candidates.
10. **Our accuracy?** Local F1 **0.43** (strict auto-write). Models: **no useful Δ**. Qwen JSON **97–99%** with span-ok **11%**.
11. **Improve local engine?** **No** (detector); ranker **slightly worse**.
12. **When to call?** Only existing pause/island/conflict gates — and **not until quality gates pass**.
13. **When not?** Keystroke, paste, secrets, composing, open tokens, mixed layout auto, shortcuts_only.
14. **Groq/Gemini/OpenRouter?** Keep as **hypothesis ranker + (once wired) writing review**. Failure fallback, no voting. Groq quota is an ops issue, not a reason to bolt on 0.6B.
15. **Replace any layer?** **No.**
16. **New layer?** **No.** Finish Writing Review wiring if English grammar matters; that is an existing incomplete layer.
17. **Files to modify?** None for a model. Review wiring listed in §18 if product wants cloud review first (higher expected value than a local 0.6B).
18. **Tests before enable?** §19.
19. **Remaining risks?** 4B untested; disk prevented Gemma 4 / Qwen3.5 measurement; grammar stratum small; 60-minute Chrome session unverified; Groq still 429-prone.

**Product value judgment:** a 95%-JSON 0.6B that cannot point at the right characters is **worse for Flowlary** than the current conservative local engine. Popularity and MMLU do not change that.
