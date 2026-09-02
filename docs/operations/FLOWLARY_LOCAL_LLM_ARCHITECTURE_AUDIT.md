# Local LLM Architecture Audit

**Date:** 2026-09-01  
**Scope:** Read-only investigation of the Flowlary repository. No packages, models, Ollama, llama.cpp, Python AI stacks, servers, ZAIXOS, or production configuration were installed or changed.  
**Canonical runtime sources:** `extension/src/content/startWritingRuntime.ts`, `extension/src/core/writeGate/pipeline.ts`, `backend/src/providers/*`, `backend/src/config/env.ts`, `docs/architecture/ARCHITECTURE_FREEZE.md`, `docs/architecture/AI_ARCHITECTURE.md`.

Evidence tags used below:

| Tag | Meaning |
| --- | --- |
| **CONFIRMED FROM CODE** | Current source, as executed in production paths |
| **CONFIRMED FROM DOCUMENTATION** | Current architecture/ops docs that match code, or historical docs quoted as such |
| **INFERRED** | Reasoning from facts; not a runtime check on the VPS |
| **RECOMMENDATION** | Judgment for Phase 4 and later; not a change to the product |

When older documentation conflicts with current production code, both are reported. **Code + `ARCHITECTURE_FREEZE.md` + current architecture docs are the active design.** Historical `docs/audit/*` files are evidence, not instructions (`docs/audit/README.md`).

---

## 1. Executive conclusion

**CONFIRMED FROM CODE:** A local LLM / local SLM is **not** part of the intended or implemented Flowlary runtime. Production AI is **cloud HTTP** (Groq, Gemini, OpenRouter, optional Google Translate). Hypothesis generation and auto-write decisions are **local deterministic** code in the Chrome extension.

**CONFIRMED FROM DOCUMENTATION (superseded vs current):** An earlier same-day study (`docs/audit/LOCAL_AI_ARCHITECTURE_AUDIT.md`) recommended designing a local “understanding layer.” A later measured study (`docs/audit/LOCAL_AI_MODEL_SELECTION_REPORT.md`) **rejected** that layer. The freeze and ops docs now say **no production local SLM**.

**Active architecture (CONFIRMED FROM CODE + current architecture docs):**

```
Input (InputEngine)
  → analyzeFieldText / collectHypotheses   (local deterministic)
  → decideWriting                          (local; may consume advisor vote)
  → UserWritingPolicy
  → Write Gate (commitWriteTransaction)    (only DOM writer)
       ↘ async RANK_HYPOTHESES             (cloud ranker; IDs only)
       ↘ async REVIEW_WRITING              (cloud span edits → ingest → decide again)
```

This is **A: local deterministic engine + cloud AI**, not B (local deterministic + local LLM + cloud).

**LOCAL LLM STATUS: NOT RECOMMENDED**

Not required now. Not recommended on the shared Contabo VPS (4 CPU, 7.8 GiB RAM, no GPU, ZAIXOS already resident). Not recommended as a third brain in the typing path. A future Writing Review sidecar on **separate** hardware remains an experiment only if quality gates pass — it is **not** part of PHASE 4 deployment.

---

## 2. Evidence found in repository

### Keyword hits vs actual dependencies

| Search term | Where it appears | Production dependency? |
| --- | --- | --- |
| Ollama / `11434` | `tests/audit/evaluation/local-ai-model-selection/ollama.ts` and eval harness | **No.** File header: evaluation-only, not imported by production. **CONFIRMED FROM CODE** |
| llama.cpp / GGUF / vLLM | Audit reports and `tests/audit/evaluation/local-ai-architecture-audit.json` | **No** runtime. **CONFIRMED FROM CODE** (no compose service, no package) |
| Qwen / Gemma / Mistral / Phi / DeepSeek | Model-selection docs and eval JSON | **No** production adapter. **CONFIRMED FROM CODE** |
| `llama-3.1-8b-instant` | Comment in `packages/shared/src/ai/models.ts` (retired Groq model); leftover mock strings in `tests/unit/backend/explanation-localize.test.ts` | **Not** the live Groq model. Live correction/coach use `openai/gpt-oss-20b`. **CONFIRMED FROM CODE** |
| `allam-2-7b` | `AI_MODELS.LAYOUT_CLASSIFIER` | **Groq-hosted** cloud model, not a local weights file. **CONFIRMED FROM CODE** |
| Hugging Face / transformers / embedding model | No production imports. “embedding” in website legal copy is generic “AI inference.” Layout test uses “inference” as English wording. | **No** local embedding service. **CONFIRMED FROM CODE** |
| `local model` / SLM | Freeze, ops env, deployment architecture, audits | Policy: **do not add**. **CONFIRMED FROM DOCUMENTATION** |

### Package manifests

**CONFIRMED FROM CODE:**

- Root `package.json`: npm workspaces; no Ollama/llama.cpp/vLLM.
- `backend/package.json`: `@flowlary/shared`, `google-auth-library` only.
- `extension/package.json`: React, Vite, docx/pdfmake — no ONNX/WASM LLM.
- `website/package.json`: React, Paddle — no ML runtime.
- No `.github/` CI directory (`docs/architecture/SYSTEM_ARCHITECTURE.md`).

### Deploy / Docker / env

**CONFIRMED FROM CODE:**

- `deploy/docker-compose.yml`: `api` (Node) + `nginx` only. No model volume, no GPU, no Ollama.
- `deploy/Dockerfile`: `node:22-bookworm-slim`, curl, `tsx` API. No model download.
- `backend/.env.example`: Groq / Gemini / OpenRouter / Google Translate / Paddle. **Zero** `OLLAMA_*`, `LOCAL_MODEL_*`, `LLAMA_*` keys.
- `backend/src/config/env.ts`: advisor order filtered to `groq | gemini | openrouter` only.

### Scripts

**CONFIRMED FROM CODE:** `scripts/` contains live probes (`advisor-live-probe.ts`, `writing-review-live-probe.ts`), packaging, website serve. **No** model download or GGUF fetch script.

### ADRs

None found (`**/*ADR*` glob empty). Architecture freeze is the standing decision record.

---

## 3. Existing local-model code

**CONFIRMED FROM CODE — production:** There is **no** local inference adapter, no Ollama client under `backend/` or `extension/`, and no import of `tests/audit/evaluation/local-ai-model-selection/**`.

**CONFIRMED FROM CODE — evaluation only:**

| Path | Role |
| --- | --- |
| `tests/audit/evaluation/local-ai-model-selection/ollama.ts` | `fetch('http://127.0.0.1:11434/api/chat')` |
| `tests/audit/evaluation/local-ai-model-selection.eval.test.ts` | Optional Ollama vs local Decision Engine |
| `tests/audit/evaluation/local-ai-model-selection-results.json` | Recorded Apple M3 Ollama run (`qwen3:0.6b`, `llama3.2`) |
| `tests/audit/evaluation/local-ai-architecture-audit.json` | Machine-readable notes from the architecture study (preferred runtimes listed as *ideas*, not deploy) |
| `tests/audit/evaluation/README.md` | Isolated vitest; “Ollama optional”; “Not imported by the extension, website, or backend” |

**CONFIRMED FROM CODE:** `AdvisorProviderId` is `'groq' | 'gemini' | 'openrouter'` (`backend/src/providers/advisorTypes.ts`). There is no `'ollama'` or `'llamacpp'` id.

---

## 4. Existing local-model configuration

**CONFIRMED FROM CODE:** None in production configuration.

- No env flags to enable a local SLM.
- Ops template `docs/operations/FLOWLARY_ENVIRONMENT.md`: “Do not change the architecture. Do not add models or a local SLM.”
- `docs/operations/FLOWLARY_DEPLOYMENT_ARCHITECTURE.md`: “No local SLM / Ollama” under what does **not** run in production.
- `docs/architecture/ARCHITECTURE_FREEZE.md` item 10: “No production local SLM (measured: no useful gain). Experiments stay out of `startWritingRuntime`.”

The eval harness **requires** Ollama at `127.0.0.1:11434` only for model rows; local-engine rows do not (`docs/audit/LOCAL_AI_MODEL_SELECTION_REPORT.md`). That is a **developer laptop** optional, not a product config.

---

## 5. Existing cloud AI architecture

**CONFIRMED FROM CODE + `docs/architecture/AI_ARCHITECTURE.md` + `docs/backend/PROVIDERS.md`.**

Gateway: authenticated HTTP → `createGateway` → separate managers/providers.

```
Extension / website
  → Flowlary Node API (single process)
       → AdvisorProviderManager        Groq → Gemini → OpenRouter (ranking flags)
       → WritingReviewProviderManager  Groq → Gemini → OpenRouter (keys; fallback default ON)
       → correctionProvider            Groq
       → layoutClassifierProvider      Groq
       → translationRouter             Google (optional) and/or Groq
       → learningCoachProvider         Groq
       → learningReportNarration       Groq
       → explanationLocalizeProvider   Groq
```

### Groq

**CONFIRMED FROM CODE:** `callGroqChat` posts to `https://api.groq.com/openai/v1/chat/completions` (`packages/shared/src/ai/models.ts`, `backend/src/providers/groqClient.ts`).

| Use | Default model | Role |
| --- | --- | --- |
| Hypothesis Advisor | `openai/gpt-oss-20b` (`GROQ_ADVISOR_MODEL`) | Rank existing hypothesis **IDs** |
| Writing Review | same Groq adapter / token budgets | Bounded island **edits** JSON |
| Correction API | `AI_MODELS.CORRECTION` = `openai/gpt-oss-20b` | Whole-range JSON for Speed Box / practice / website lab — **not** auto typing |
| Translation (Groq path) | `openai/gpt-oss-120b` | Generates translated **text** |
| Layout classify | `allam-2-7b` | Optional CHECK_WORD; layout remap remains `mapLayout` |
| Learning coach / report / explanation localize | `AI_MODELS.CORRECTION` | Dashboard/educational **text**, evidence-bound |

`GROQ_API_KEY` is required for production readiness (`backend/src/health/readiness.ts`). Advisor ranking enabled by default; Gemini/OpenRouter ranking default **off**.

### Gemini

**CONFIRMED FROM CODE:** `GeminiAdvisorProvider` → `https://generativelanguage.googleapis.com/v1beta/models`. Default model `gemini-3.5-flash-lite`. Ranking flag `GEMINI_ADVISOR_ENABLED` default **false**. Writing Review **includes** Gemini when `GEMINI_API_KEY` is set, even if ranking is off (`writingReviewProviderConfigured` in `writingReviewProvider.ts`).

### OpenRouter

**CONFIRMED FROM CODE:** `https://openrouter.ai/api/v1/chat/completions`. No hardcoded production default model in env reader; `OPENROUTER_ADVISOR_MODEL` required when the adapter is used. Ranking default **off**. Review uses the same key+model when present.

**CONFIRMED FROM DOCUMENTATION (historical, do not treat as current):** `docs/production/AI_PRODUCTION_ARCHITECTURE.md` still diagrams Correction as `llama-3.1-8b-instant`. That file is labeled **HISTORICAL**. Live models are in `packages/shared/src/ai/models.ts`.

---

## 6. Actual role of LLMs today

### What generates text vs what only ranks

| Component | Generates user-visible text? | Writes DOM? | Source of authority |
| --- | --- | --- | --- |
| **Hypothesis Generation** (`collectHypotheses`) | No LLM. Local spans + instant spell + layout maps | No | Local analysis |
| **Decision Making** (`decideWriting`) | No LLM. Chooses action from candidates + optional advisor vote | No | Local engine + policy |
| **Hypothesis Advisor** | **No replacement text.** Ranked IDs, `ambiguityClass`, `reasonCode` | No. Late tick may **suggest** only | `consultAdvisor` then `decideWriting` |
| **Writing Review** | Bounded `proposed` strings in `edits[]` | Only if ingest → `decideWriting` → Write Gate | Cloud JSON → local ingest |
| **Translation** | Yes (Google and/or Groq) | Via fulfill + Write Gate when session/policy allow | Not the Decision Engine’s ranker |
| **Learning / Coach** | Yes (coach JSON, report narration, explanation localize) | No (dashboard) | Groq; not typing path |
| **Correction API** | Yes (`correctedText`) | Not via auto pipeline; Speed Box / lab / practice | Groq; `scheduleRemoteEnglishAssist` is a **no-op** |

**CONFIRMED FROM CODE — Advisor never auto-writes on a late tick:** `pipeline.ts` comments and logic: apply mode may `presentPipelineSuggestion` only when `advised.action === 'suggestion'`. Local auto-write uses the **first** `decideWriting` result before the advisor returns.

**CONFIRMED FROM CODE — Writing Review:** `runWritingReviewCycle` → `parseWritingReviewContent` → `ingestReviewEdits` → `decideWriting` → Write Gate. Typing does not await this (`scheduleFieldWritingReview` is fire-and-forget).

**CONFIRMED FROM CODE — boot:** `startWritingRuntime` registers both production advisor and production writing review.

### Answers to the numbered product questions

| # | Question | Answer | Evidence class |
| --- | --- | --- | --- |
| 1 | Intended architecture includes local LLM/SLM? | **No** | Freeze + current AI architecture + code |
| 2 | Specific local model designed or implemented? | **Designed in audits; not implemented.** Eval measured Qwen3 0.6B and Llama 3.2 3B on a Mac | Docs vs code |
| 3 | Code for Ollama/llama.cpp/Qwen/Llama/Gemma/Mistral? | **Eval-only Ollama client.** No production adapters | Code |
| 4 | Local inference service? | **No** | Compose, Dockerfile, backend |
| 5 | Model download/setup script? | **No** | `scripts/` |
| 6 | Local model configuration? | **No** | `.env.example`, `env.ts` |
| 7 | Local model provider adapter? | **No** | `advisorTypes` ids |
| 8 | Used by writing pipeline? | **No** | `pipeline.ts` |
| 9 | Used by Hypothesis Generation? | **No** | `hypotheses.ts` / `HYPOTHESIS_SYSTEM.md` |
| 10 | Used by Decision Making? | **No** (optional **cloud** vote only) | `decideWriting` + advisor |
| 11 | Used by Advisor? | **No** (cloud Groq/Gemini/OpenRouter) | providers |
| 12 | Used by Writing Review? | **No** (same cloud chain) | `writingReviewProvider.ts` |
| 13 | Used by translation? | **No** | `translationRouter.ts` |
| 14 | Used by learning/coach? | **No** | Groq providers |
| 15 | Experimental/planned only? | **Eval harness + historical design docs.** Not started from runtime | Code + freeze |
| 16 | Intentionally removed or rejected? | **Rejected after measurement; freeze forbids production SLM.** Never shipped, so not “removed from prod” | Docs |
| 17 | Docs explaining why? | **Yes:** `LOCAL_AI_MODEL_SELECTION_REPORT.md`, freeze, `WRITING_REVIEW_PRODUCTION_PATH.md`, `docs/audit/README.md` | Docs |

---

## 7. Whether a local model is currently required

**CONFIRMED FROM CODE:** No. Local layout remap, mixed-language preserve, instant spelling, policy, and Write Gate run **offline** without any model. Cloud is optional and fail-open (`localDecisionAuthoritative` on advisor/review manager failure).

**CONFIRMED FROM DOCUMENTATION:** `docs/architecture/AI_ARCHITECTURE.md` — “When AI is unavailable: Local layout and instant English still run.”

**INFERRED:** PHASE 4 on Contabo needs Node API + nginx + cloud keys, not a weights file.

---

## 8. Whether a local model was previously planned

**CONFIRMED FROM DOCUMENTATION — contradiction (do not silently merge):**

1. **`docs/audit/LOCAL_AI_ARCHITECTURE_AUDIT.md` (same calendar day):** Conditional **GO to design and benchmark** a local LM as “primary understanding layer” emitting span hypotheses. Explicit **NO-GO** to ship without holdout and **NO-GO** to run 1B–4B on every keystroke. Lists Qwen3 / Gemma / Phi as **candidates**, not production.

2. **`docs/audit/LOCAL_AI_MODEL_SELECTION_REPORT.md`:** Executed Ollama on Apple M3. **NO-GO.** Measured 0.6B and 3B did **not** improve useful auto-write; detector span-ok ~11%; ranker could worsen. Recommends **not** implementing a local model; optional future role only as Writing Review contract speaker behind `ingestReviewEdits`.

3. **`docs/audit/README.md`:** Historical audits are **not** the current spec. Code + freeze win. Model-selection report is cited as evidence that local SLMs were **measured and rejected**.

4. **`docs/architecture/ARCHITECTURE_FREEZE.md` / `docs/audits/KNOWN_LIMITATIONS.md`:** On-device generative understanding layer is **intentionally not implemented / unsupported**.

5. **Stale claim inside the selection report §18:** It still lists finishing `scheduleFieldWritingReview` / `registerProductionWritingReview` as future work.

   **CONFIRMED FROM CODE (active):** Those calls **exist now** (`startWritingRuntime.ts`, `pipeline.ts`). `docs/audit/WRITING_REVIEW_PRODUCTION_PATH.md` and `docs/architecture/WRITING_REVIEW.md` document the cloud path. Treat the selection report’s “review not wired” bullet as **obsolete**.

**INFERRED:** The product **planned an experiment**, ran it outside production, then **froze against** shipping a local SLM. It did not ship and then rip out a production sidecar.

---

## 9. Candidate roles for a local model

**RECOMMENDATION** (roles that would still obey LLM → hypotheses, engine → decide, Write Gate → write):

| Role | Fit | Why |
| --- | --- | --- |
| Keystroke “understanding layer” before `collectHypotheses` | **Reject** | Duplicates detectors; measured span localization failed; freeze forbids |
| Second ranker in parallel with Groq | **Reject** | First-valid-wins already; Gemini ranking Δ=0 in prior live eval (selection report); voting forbidden |
| Hypothesis Advisor (ID ranking) | Poor | Cloud already does this; 1500 ms budget; small SLMs did not help |
| Writing Review island JSON (`parseWritingReviewContent`) | **Only plausible future** | Existing door; grammar/punctuation is the weak local stratum; must not skip ingest/`mapLayout` |
| Translation | Poor | Google/Groq already generate text; bilingual quality of tiny CPU models is unproven here |
| Learning coach | Poor | Not latency-critical; Groq already used; VPS RAM better spent on ZAIXOS + Node |
| Browser WebGPU WASM 0.6B | Poor | Selection report: quality did not justify; must not block typing |
| DOM writer | **Forbidden** | See §12 / principle |

**CONFIRMED FROM DOCUMENTATION:** Selection report: do not invent a third JSON dialect; speak existing review or advisor contracts only.

---

## 10. Contabo resource analysis

**CONFIRMED FROM DOCUMENTATION** (`docs/operations/FLOWLARY_SERVER_SETUP.md`, `FLOWLARY_MONITORING.md`, `FLOWLARY_DEPLOYMENT_ARCHITECTURE.md`):

| Fact | Value |
| --- | --- |
| CPU | 4 × AMD EPYC |
| RAM | 7.8 GiB total; ~6.5 GiB available at discovery (~1.3 GiB used) |
| GPU | None identified |
| Swap | None |
| Co-tenants | ZAIXOS (PHP-FPM, nginx, PostgreSQL, Redis, Supervisor, etc.) |
| Flowlary planned footprint | **One** Node process, localhost bind, static website; **no** Flowlary Redis/Postgres |
| Host load at discovery | ~1.0 on 4 CPUs (PHP-FPM) |

**INFERRED (not measured on this audit; no install):**

A useful bilingual instruct model for review is on the order of **Qwen3-4B Q4** (selection report: do not load 4B inside the Node process; suggested **≥32 GB RAM** and isolate llama.cpp). On **7.8 GiB with ZAIXOS**:

| Outcome | Assessment |
| --- | --- |
| Safe | **No** for a 3B–4B CPU model. RSS of GGUF Q4 3B is typically multiple GiB plus KV cache; ZAIXOS + Node would compete. No swap → OOM kill risk. |
| Practical | **No.** CPU llama.cpp P95 in the 0.5–4 s range on a laptop GPU/Metal run; EPYC 4-core would be slower. Advisor budget is 1500 ms; review budget 4500 ms but still shares the box. |
| Too resource intensive | **Yes** for anything that beats the already-rejected 0.6B. |
| Affect ZAIXOS | **Likely.** PHP-FPM already owns CPU; extra inference threads increase latency for Laravel and for Flowlary’s event loop if colocated. |
| Increase Flowlary latency | **Yes** if inference is on-box; cloud RTTs already dominate AI (`FLOWLARY_MONITORING.md`). |
| Useful enough to justify | **No** given measured 0 useful Δ on small models and untested 4B. |

**CONFIRMED FROM DOCUMENTATION:** Deployment architecture: do not introduce Docker on this host for convenience; Flowlary must stay single-process so it cannot starve ZAIXOS.

---

## 11. Architecture alternatives

All rows are **RECOMMENDATION** except “current” which is **CONFIRMED FROM CODE**.

| Option | Role | Latency | Memory | CPU | Privacy | Reliability | Cost | Maintenance | Architecture | UX | Accuracy | Decision engine |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **1. No local LLM (current)** | Cloud rank + review; local rules write | Local cycle sub-ms; cloud ~1s async | Node-only | Low | Snippets to cloud | Fail-open local | API usage | Providers + keys | **A** | Typing never waits | Local conservative; cloud grammar | Unchanged |
| **2. Small local SLM (≤1B)** | Duplicate rank/detect | 0.5–1s+ CPU | ~0.5–2 GiB | High on 4 cores | Better if on-VPS | JSON ok, spans fail (measured) | GPU none; ops cost | Weights, Ollama/llama.cpp | Becomes **B** without gain | Delay or conflict | Measured **no useful Δ** | Risk of extra hyps that ingest drops |
| **3. Medium local (3–4B)** | Possible review sidecar | Seconds on this VPS | **Does not fit** 7.8 GiB + ZAIXOS | Saturates host | Higher | Unmeasured quality | Dedicated box | Sidecar health | **B** on extra host | Async only | Unknown; 4B **NOT RUN** | Only via existing ingest |
| **4. Cloud-only** | Same as 1 | Same | Same | Same | Snippets leave device | Provider 429s (Groq documented) | Tokens | Fallback flags | **A** | Same | Review probe showed Groq/Gemini edits | Unchanged |
| **5. Hybrid local + cloud** | Local first review, cloud fallback | Local slow + cloud | Worst of 2/3 + Node | Worst | Mixed | Two failure domains | Double | Two stacks | **B** | Complexity, possible conflicting edits | Only if local span-ok ≥ 0.8 (not met) | Must remain single `decideWriting` |

**Current product is already hybrid in the useful sense:** **local deterministic + cloud**, not **local LLM + cloud**.

---

## 12. Recommendation

**RECOMMENDATION:** Keep architecture **A**. Do not add a local LLM/SLM to PHASE 4, the Contabo VPS, the Docker compose file, or `startWritingRuntime`.

**Most important architectural question — may a local model WRITE the DOM?**

**No.** There is **no** strong reason to violate:

```
LLM → proposes / ranks hypotheses
Local deterministic engine + Policy + decideWriting → decides
Write Gate → writes
```

**CONFIRMED FROM CODE:** Advisor forbids replacement/write fields. Writing Review `proposed` is not a DOM API; `ingestReviewEdits` can drop layout that fails `mapLayout`. Only `commitWriteTransaction` mutates fields (`docs/architecture/WRITE_GATE.md`).

Allowing a local (or cloud) model to call `writeReplacement` would create a **second writer**, which the freeze asks engineers to stop on. Latency, privacy, or offline hopes do not require DOM access: local **rules** already write immediately; models are async reviewers.

If a future sidecar exists, it must implement `WritingReviewProvider` or `HypothesisAdvisorProvider` and stop at JSON.

---

## 13. What should NOT be implemented

**RECOMMENDATION** (aligned with freeze + measured NO-GO):

- Ollama / llama.cpp / vLLM / Transformers on the Contabo VPS
- Model download in deploy scripts
- A fourth provider id in the typing path
- Understanding layer between `analyzeFieldText` and `collectHypotheses`
- Parallel voting (local + Groq + Gemini)
- LLM-invented layouts (`mapLayout` remains sole remap)
- Whole-field LLM auto-write (already absorbed/deprecated)
- Loading GGUF inside the Node 8787/9087 process
- Browser-blocking on-device generation
- Treating `docs/audit/LOCAL_AI_ARCHITECTURE_AUDIT.md` as an implementation ticket

---

## 14. What could be implemented later

**RECOMMENDATION — optional, not scheduled, not PHASE 4:**

Only after **all** of:

1. Dedicated inference host (not ZAIXOS Contabo), RAM in the selection-report class (~32 GB if 4B), or a real GPU.
2. Re-run `tests/audit/evaluation/local-ai-model-selection` with a 4B instruct GGUF; gates in that report §19 (usefulΔ ≥ 0, worsen = 0 on preserve strata, span-ok ≥ 0.8, JSON ≥ 0.95, P95 within review budget on **that** box).
3. Adapter that posts the **existing** `WritingReviewPacket` and reuses `parseWritingReviewContent` / `ingestReviewEdits`.
4. Failure-only fallback to Groq → Gemini → OpenRouter; no voting.
5. Still no DOM writes from the model.

Until then, improve **local rules** and **cloud Writing Review** (already production-wired). That is higher expected value than a 0.6B sidecar.

---

## 15. Impact on current deployment plan

**RECOMMENDATION / CONFIRMED FROM DOCUMENTATION:**

PHASE 4 should proceed as already specified: Node API, localhost port, nginx `api.flowlary.com`, static site, Groq required, Gemini/OpenRouter keys for Writing Review fallback, **no** local SLM (`FLOWLARY_DEPLOYMENT_ARCHITECTURE.md`, `FLOWLARY_ENVIRONMENT.md`).

No extra packages, disk for GGUF, Supervisor program, or GPU driver. No change to ZAIXOS. No architecture change.

Stale Docker compose remains a **non-path** for this VPS; adding an Ollama service there would be a regression against isolation docs.

---

## LOCAL LLM STATUS

**NOT RECOMMENDED**

**Why:**

1. **CONFIRMED FROM CODE:** Production is local deterministic engine + cloud providers. No local inference path exists or is configured.
2. **CONFIRMED FROM DOCUMENTATION:** After measurement, local SLMs were rejected; the architecture freeze and ops env templates forbid adding one.
3. **CONFIRMED FROM DOCUMENTATION + INFERRED:** The shared 4-core / 7.8 GiB Contabo host already runs ZAIXOS; a useful CPU model would be unsafe and would not beat cloud review on quality that was actually measured.
4. **RECOMMENDATION:** Offline and low-latency writing already come from the local engine. Privacy-sensitive snippets are already bounded. Cloud fills grammar/punctuation review. A local LLM would not earn a place as writer, ranker, or VPS neighbor.

Do not install or download anything for this conclusion. Stop after this report.
