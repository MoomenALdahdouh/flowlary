# LLM Provider Architecture Audit

**AUDIT DATE:** 2026-08-31  
**REPOSITORY:** `/Users/moomen/Projects/flowlary`  
**SCOPE:** Research only. No production engine, advisor, provider routing, UI, translation runtime, Write Gate, or user-settings behavior was changed.  
**METHOD:** Trace of current source; verification of prior audits against the tree; a new isolated 4500-case local holdout under `tests/audit/evaluation`; current public pricing/catalog pages fetched where available.

**Labels used throughout**

| Label | Meaning |
|---|---|
| **MEASURED** | Produced by code in this session or a prior live Groq run on this tree |
| **VERIFIED IN CODE** | Read from the current source, not from a report |
| **ESTIMATED** | Calculated from assumptions |
| **REQUIRES EXTERNAL** | Public vendor pages / aggregators; not Flowlary telemetry |

---

## 1. Executive summary

Flowlary is already **local-first**. The typing path is:

observe → analyze → hypotheses → (rarely) bounded LLM rank → policy → Write Gate.

The LLM is **not** the writer. Translation is a **separate** producer path (Google NMT, optional Groq polish). English grammar LLM is **suggestion-first** in the unified pipeline.

The current hypothesis advisor is **wired**, **shadow-only**, and **not production-ready**:

- Provider: **Groq**
- Model: **`allam-2-7b`**
- Live structured-rank success: **1 / 65** (**98.46% failure**, MEASURED in `LIVE_GROQ_SHADOW_EVALUATION_REPORT.md`)
- Official Groq **production** catalog (2026-08-31) **does not list** `allam-2-7b`

A new unseen 4500-case local baseline (this audit):

| Metric | All N=4500 | Holdout N=1105 |
|---|---|---|
| Action accuracy | **85.58%** | **84.80%** |
| Hypothesis existence | 89.87% | 90.41% |
| Production consult rate | **0.80%** | **0.72%** |
| Mean local analysis | **0.44 ms** | **0.41 ms** |
| Protected layout hyps | **0** | **0** |

**Core verdict:** keep Hypothesis Generation V2 + a **single small fast LLM ranker** + **Google Translate for Arabic→English**. Do **not** add parallel voting, three-model calls, OpenRouter as primary, or a learned model router.

The smallest model that can *meet the contract* is **not** the current Allam advisor. The next implementation should remain on **Groq** and shadow-evaluate **`openai/gpt-oss-20b`** (already the correction model, JSON-object proven in this codebase). Add a second provider only after that model’s **JSON + ranking** quality is measured.

---

## 2. Current architecture

**VERIFIED IN CODE.**

```
USER INPUT (DOM / keyup Space, Enter, Tab)
  → InputEngine (USER vs SYSTEM, paste, composition, generation bump)
  → Enforce coordinator (ignore SYSTEM, composing, cooldown)
  → runFieldCycle / runWritingPipeline
       buildFieldContext (safety, editor tier, policy, mutex)
       read field + caret
       prune tags / detectUserOverride
       analyzeFieldText (chunks + inferLayoutSpans)     // local
       collectHypotheses                                 // local
       candidatesFromHypotheses                          // local
       if shouldConsultAdvisor:
            consultAdvisor → RANK_HYPOTHESES → POST /api/ai/hypothesis-advisor
            validateAdvisorVote (IDs only)
            stale generation check
       decideWriting (policy; optional AdvisorVote)
       writing.decision analytics (no raw text)
       action:
         noop
         suggestion  → card and/or scheduleRemoteEnglishAssist (debounced Groq, no auto-write)
         translation → fulfillTranslationDecision (Google/Groq, Write Gate CAN write)
         layout_fix / english_correction with local replacement → Write Gate
       cooldown WRITE_COOLDOWN_MS = 450
```

Apply mode for the production advisor is **`shadow`** (`hypothesisAdvisorClient.registerProductionHypothesisAdvisor`). Write Gate uses the **baseline** decision while shadow. The LLM still must not emit replacement text.

**Boot (content):** `startWritingRuntime` hydrates account/settings, starts InputEngine, shadow + enforce coordinators, feature `.start()`, CommandOrchestrator. Legacy layout/correction/translation schedulers still start but return early when enforce is on.

**Speed Box** still assigns `input.value` directly — not Write Gate. Out of scope for this advisor architecture.

---

## 3. Current providers

| Provider | Role today | Config | Abstraction |
|---|---|---|---|
| **Groq** Chat Completions | All LLM ops | `GROQ_API_KEY` | `callGroqChat` only |
| **Google Cloud Translation** | Arabic→English NMT | `GOOGLE_TRANSLATE_ENABLED` + API key and/or ADC | `googleTranslateProvider` |
| **OpenRouter** | **Not present** | none | none |
| **Gemini / Google generative** | **Not present** | none | none |

**AI gateway** (`backend/src/gateway/index.ts`): entitlement, per-user RPM (`layout-classification` bucket reused by the advisor), managed usage reservation, `withTimeout` (`FLOWLARY_AI_TIMEOUT_MS` default **30s**), usage tracking.

**Retries (Groq client):** connect timeout 10s; HTTP 400 `json_validate_failed` retries once as `text`; HTTP 503 retries once after 600ms; **no 429 retry** in `groqClient.ts`.

**Caching:** translation in-memory (account + strategy + hash of text, TTL 1h, max 500). Advisor: **no cache**. Correction: extension L1/L2 (privacy-gated), not advisor.

**Advisor network boundary:** content script → `chrome.runtime.sendMessage(RANK_HYPOTHESES)` → background `prepareManagedAiRequest` → `POST /api/ai/hypothesis-advisor` → Groq.

---

## 4. Current models

**VERIFIED IN CODE** (`packages/shared/src/ai/models.ts`):

| Operation | Provider | Model ID |
|---|---|---|
| Hypothesis advisor | Groq | `allam-2-7b` |
| Layout classifier (legacy) | Groq | `allam-2-7b` |
| English correction / coach / report / explanation localize | Groq | `openai/gpt-oss-20b` |
| Translation LLM / Pro refine | Groq | `openai/gpt-oss-120b` |
| Translation NMT | Google | `google-translate` (v2 key or v3 ADC) |

**Groq ≠ a model.** Groq is the inference host. Flowlary currently uses **three Groq model IDs** plus Google NMT.

Advisor call: temperature `0`, `maxTokens` `180`, `response_format: json_object`, snippet ≤160, ≤24 hypotheses.

---

## 5. Current AI tasks

| # | Task | Today | Needs LLM? |
|---|---|---|---|
| 1 | Keyboard-layout intent | Local sequence + hypotheses; advisor only if ambiguous | LLM **only if** `needsLLM` / conflicts |
| 2 | Spelling vs layout | Independent local hyps; decide/advisor choose | LLM useful when both exist |
| 3 | Grammar correction | Remote Groq **suggestion** (unified); shortcut may write | LLM yes, **not** keystroke auto-write |
| 4 | English quality | Tiny local spell + remote suggestion | LLM for real grammar |
| 5 | Mixed-language | Chunks + `mixedLayoutSafety` veto | LLM for ranking, **not** rewrite |
| 6 | Technical tokens | Regex / structural preserve | Deterministic; LLM abstain |
| 7 | Arabizi | Local digit marks `2/5/7/9` | Keep local; do not LLM-write |
| 8 | Translation | Google NMT; Groq if Google off; Pro refine | **Specialized MT**, not intent LLM |
| 9 | Translation polish | Groq refine on Pro non-live | Optional LLM **after** MT |
| 10 | Short-token ambiguity | High risk / abstain | LLM optional; auto-write no |
| 11 | Context interpretation | Weak locally; advisor packet has ±24 char window | LLM ranking, IDs only |

Non-typing LLMs (learning coach, report narration, explanation localize) share `gpt-oss-20b`. They are **not** in the writing hot path.

---

## 6. Local vs LLM responsibilities

**This separation is still correct.**

**Local should keep:**

- Keyboard mapping (`mapLayout` / `mapLayoutText` — the only replacement operator for layout)
- Tokenization, segmentation, protected content
- Obvious layout (unique strong sequence, `risk === 'low'`, not mix-unsafe)
- Obvious mixed structure (preserve Arabic + Latin/tech)
- Deterministic safety, paste/composition/override, Write Gate
- Hypothesis **generation**

**LLM should:**

- Rank existing hypothesis IDs when ambiguous
- Interpret layout vs spelling vs preserve given a short snippet
- Never invent IDs, replacements, HTML, or writes

**Write Gate remains the only auto mutation path** for enforce (except Speed Box, unchanged).

New 4500-case evidence: mixed / technical / short families are **already 100% local-correct** on gold action. Consult rate **0.8%**. Most quality left is **local candidate/decision** (layout FN, spelling_layout 47% family accuracy), not “call more models.”

---

## 7. Google evaluation (Gemini)

**Gemini is not in the product today.**

**REQUIRES EXTERNAL** (Gemini API pricing/models pages and changelog, 2026-08-31):

| Candidate | Status | Why it matters |
|---|---|---|
| `gemini-2.0-flash` / `flash-lite` | **Shut down** (changelog: 2026-06-01) | Do not design on these IDs |
| **`gemini-2.5-flash-lite`** | GA small/fast 2.5 | Best Google fit for **short JSON ranking** |
| `gemini-2.5-flash` | GA | Stronger, slower/costlier (`$0.30` / `$2.50` per 1M) |
| Changelog also names `gemini-3.5-flash` / `gemini-3.1-flash-lite` as 2.0 replacements | **Not independently confirmed** this session (models page fetch timed out) | Re-check ID at implementation time |

**`gemini-2.5-flash-lite` (REQUIRES EXTERNAL)**

- Role: fastest / cheapest 2.5 multimodal; 1M context (overkill here)
- Paid: **$0.10 / 1M input**, **$0.40 / 1M output** (Google Developers Blog + Cloud pricing tables)
- Structured JSON: Gemini API supports JSON / schema (not MEASURED on this workload)
- Free tier: exists; **prompts may be used to improve Google products** on free; paid typically **not** used for training (pricing page)
- Arabic / mixed / technical: **ESTIMATED** generally strong; **not measured** on Flowlary packets
- Latency: **ESTIMATED** p50 200–700 ms TTFT for tiny JSON — usually **slower than Groq gpt-oss-20b** (~1000 t/s listed)

**Production suitability as primary writing advisor:** possible later, **not justified now**. New credentials, new JSON parser, new failure taxonomy, extra privacy party. No ranking numbers on this packet.

**Appropriate Google model if a second provider is added:** **`gemini-2.5-flash-lite`** (confirm live model ID on `ai.google.dev/gemini-api/docs/models` the day of implementation).

---

## 8. Groq evaluation

**Provider:** Groq (`https://api.groq.com/openai/v1/chat/completions`).

### 8.1 Current advisor model: `allam-2-7b`

| Attribute | Value | Label |
|---|---|---|
| Origin | SDAIA Allam, hosted by Groq | REQUIRES EXTERNAL / code |
| Context | Aggregators list **4096** | REQUIRES EXTERNAL |
| Official Groq production table | **Not listed** 2026-08-31 | REQUIRES EXTERNAL (`console.groq.com/docs/models`) |
| Pricing | Aggregator “Free”; official **unknown** | REQUIRES EXTERNAL |
| JSON `json_object` | **Unreliable** | **MEASURED** 62/65 `invalid_response` |
| Live rank n | **1** | MEASURED — not a quality study |
| Latency success-path | p50 **389 ms**, p95 **640 ms** (first burst) | MEASURED |
| Latency with test retries | p50 **8.5 s** | MEASURED — **not a typing budget** |
| Arabic | Model family is Arabic-centric | REQUIRES EXTERNAL; ranking **unproven** |
| Suitability for short hypothesis ranking | **Poor today** because of JSON contract failure | MEASURED |

### 8.2 Production Groq models that *are* listed (official docs, 2026-08-31)

| Model ID | Speed | Price / 1M | Context | Developer RPM/TPM |
|---|---|---|---|---|
| `openai/gpt-oss-20b` | ~1000 t/s | **$0.075 in / $0.30 out** | 131,072 | 1K RPM / 250K TPM |
| `openai/gpt-oss-120b` | ~500 t/s | **$0.15 in / $0.60 out** | 131,072 | 1K RPM / 250K TPM |
| `llama-3.1-8b-instant` | 560 | ContactSales / deprecation pressure | 131,072 | Enterprise |
| `llama-3.3-70b-versatile` | 280 | ContactSales | 131,072 | Enterprise |

`gpt-oss` models require `include_reasoning: false` in this client (already implemented). Correction already uses **`json_object`** on `gpt-oss-20b`.

**Best Groq candidate for the advisor job:** **`openai/gpt-oss-20b`** — smallest listed production chat model that already speaks this stack’s JSON mode. **Ranking accuracy on hypotheses is NOT MEASURED.** Suitability is inferred from: JSON reliability in correction, latency, cost, operational reuse.

**Do not** move the advisor to `gpt-oss-120b` without evidence. Translation-size model is the wrong default for 180-token ID lists.

---

## 9. OpenRouter evaluation

OpenRouter is a **gateway**, not a model.

| Dimension | Finding |
|---|---|
| Latency | Docs claim edge/Cloudflare “minimal” hop. **ESTIMATED** +20–80 ms vs direct; **not measured**. Failed primary + auto-fallback can add **full extra generation**. |
| Reliability | Provider pooling can help **if** the same model has multiple hosts. Adds OpenRouter as a **new SPOF** and new status page. |
| Pricing | Pass-through inference + **credit purchase fee** (FAQ; third-party cites **5.5%** Stripe). BYOK has a list-price allowance then a % fee. |
| Free models | **50 req/day** free-model cap on the public pricing table; higher if credits purchased (FAQ templates / blogs cite 1000/day after ~$10). **Unsuitable for production.** |
| Privacy | Extra processor. Prompts go OpenRouter → **some** upstream. Account data-policy routing exists; still a second contract. Free/community hosts may train. |
| Operational complexity | New key, credits, routing object, model slugs, `:free` traps, disagreement with Groq tokenizer/JSON. |

**Recommendation:** **EXPERIMENTATION ONLY** (optional later). **Not PRIMARY. Not production FALLBACK.** Direct Groq + optional later direct Gemini is simpler and cheaper than Groq→OpenRouter→Gemini.

---

## 10. Google Translate evaluation

**VERIFIED IN CODE** (`translationRouter.ts`, `googleTranslateProvider.ts`).

| Question | Answer |
|---|---|
| What runs | Cloud Translation **v2** (API key) or **v3** (ADC). Model string `google-translate`. |
| Independent of LLM? | **Yes** for Free and for Pro **live**. Pro **non-live** may **refine** with Groq `gpt-oss-120b` after a successful Google draft. |
| Fallback | Groq translate only if `TRANSLATION_ALLOW_GROQ_FALLBACK=1` and entitlement allows. |
| Cache | Account + strategy + SHA-256 of text; 1h; 500 entries. Hashes text — server-side, not device. |
| Latency | **Not measured this session.** NMT is typically **tens–low hundreds of ms** (ESTIMATED). |
| Cost | First **500k chars/month free**; then **$20 / 1M chars** NMT (REQUIRES EXTERNAL, Cloud Translation pricing). |
| Quality | Specialized AR↔EN MT. **Do not replace with a general LLM** without a translation-specific eval (none in this audit). |
| Errors | Mapped: auth, 429, quota, invalid, 503/504. Refine failure **keeps Google draft**. |

**Intent understanding ≠ translation.** The advisor must not emit translated text. Translation Mode is an explicit product state. Keep Google as the translator.

---

## 11. Single-model architecture

**Local → one Groq ranker.**

- Matches current design.
- Lowest complexity.
- Accuracy ceiling is **local hypothesis recall** (~90% existence this corpus) plus **ranker quality** (unknown for a JSON-reliable model).
- Failure mode: Groq 429/outage → `advisorResult: unavailable` → local decide / noop. **Typing continues.**

**This is the right production shape once the model JSON-ranks.** Current Allam does not.

---

## 12. Primary / fallback architecture

Activate fallback on: **timeout, 5xx, 429 after budget, malformed JSON, empty/unknown IDs, auth failure** — not because two models disagree.

If primary success is **~99%**, fallback sees **~1%** of consults. Consults are ~0.8% of cycles ⇒ fallback is **~0.008% of cycles**. Cost ≈ **+1%** vs single model, not +100%.

**Superior to voting** for reliability. **Do not ship fallback until primary JSON works.** Otherwise fallback becomes the de-facto primary (Allam fail → always Gemini).

Recommended order **after** gpt-oss-20b shadow passes:

1. Primary: Groq `openai/gpt-oss-20b`
2. Fallback (optional): Gemini `gemini-2.5-flash-lite` on **failure only**

---

## 13. Multi-model architecture (parallel vote)

Calling Groq + Gemini + OpenRouter **on every ambiguous event**:

| Effect | Estimate |
|---|---|
| Cost | **2–3×** per consult |
| Latency | `max(T_i) + merge` — p95 **worse** than the slowest |
| Failure probability | `1 - Π(1-p_i)` if you **require** all; or messy partial votes |
| Disagreement | Need a deterministic tie-break (already have local scores). If local scores win ties, the third model is unused. |
| Accuracy | **Not measured.** No evidence voting beats the best single ranker on this 3-way intent task. |

On this corpus, consult is **36 / 4500** (0.8%). Voting 3 models would be **108 LLM calls** to maybe change a handful of decisions. Mixed family already **0 consults** and **100% local**.

**Not recommended.**

---

## 14. Model-routing architecture

A difficulty router (layout vs mixed vs technical → different models) would:

- Duplicate the Decision Engine’s job
- Need its own eval
- Help only if **measured** error clusters need a bigger model

This corpus: mixed/technical/short **do not consult**. Remaining errors are layout FN and spelling_layout — a **single** ranker on `needsLLM` is the right experiment.

**Keep the existing deterministic split only:**

- obvious layout → local  
- ambiguous → one fast LLM  
- translation → Google  

**No AI that chooses which AI.**

---

## 15. Latency analysis

### Acceptable advisor budgets (product)

Typing **must not** wait on the LLM. Local analysis already runs immediately (~0.4 ms). Advisor is async; stale generation drops the vote.

| Percentile | Target | Why |
|---|---|---|
| p50 | **≤ 400 ms** | Suggestion can appear after a pause/word boundary |
| p95 | **≤ 800 ms** | Still a “just paused” feel |
| p99 | **≤ 1500 ms** | Beyond this, user has usually continued → **stale discard** |
| Retry storms (multi-second) | **Forbidden** on the typing path | MEASURED 8.5s p50 under retries is unusable |

Debounce (English assist, not advisor): default 120 ms / word 45 / sentence 30. Advisor uses field-cycle settle + `WRITE_COOLDOWN_MS` 450 after writes.

### End-to-end advisor path

| Stage | Typical | Label |
|---|---|---|
| Local analyze + hyps + decide | **0.4 ms** | MEASURED (this corpus) |
| Content → background message | **ESTIMATED 5–20 ms** | |
| Backend + entitlement | **ESTIMATED 5–30 ms** | |
| Groq connect + generate (tiny JSON) | **p50 389 / p95 640 ms** Allam first burst | MEASURED |
| Gemini Flash-Lite | **ESTIMATED 200–700 ms** | |
| OpenRouter extra hop | **ESTIMATED 20–80 ms** | |
| Validate + decide + Write Gate | **< 1 ms** local | ESTIMATED |
| Failure + fallback second model | **sum of both** | ESTIMATED p95 **1–2 s** |
| 429 / retry loop | **seconds** | MEASURED in live Groq harness |

**Best case (MEASURED components + ESTIMATED hops):** ~400 ms.  
**Typical:** 400–700 ms.  
**p95:** 640 ms Groq success-path; **do not** include retry-inflated 9 s as product p95.  
**Fallback case:** ESTIMATED 0.8–2.0 s, then often **stale**.

---

## 16. Cost analysis

### Invocation frequency

**MEASURED consult rates**

| Source | Consult / cycle |
|---|---|
| This 4500-case corpus | **0.80%** (holdout **0.72%**) |
| Live Groq shadow holdout | **0.96%** |
| Hypothesis V2 advisor-holdout (prior) | 1.12% |

**ESTIMATED usage (assumptions, not telemetry)**

| Assumption | Value |
|---|---|
| Field cycles / active user / day | **200** (pauses, space/enter, field switches) |
| Advisor calls / user / day (mean) | 200 × 0.008 = **1.6** |
| p95 power user | **8** calls/day (more mixed/ambiguous) |
| Active users | scenario: 1k / 10k / 100k |

Advisor tokens **ESTIMATED:** ~400 input + ~80 output (prompt + 160-char snippet + ≤24 hyps).

**gpt-oss-20b** at $0.075 / $0.30 per 1M:

`cost/call ≈ 400×0.075e-6 + 80×0.30e-6 = $0.000054`

| Users | Calls / month (mean 1.6/day) | Single model | Primary+1% fallback | 3-model vote |
|---|---|---|---|---|
| 1,000 | 48,000 | **~$2.6** | ~$2.6 | **~$7.8** |
| 10,000 | 480,000 | **~$26** | ~$26 | **~$78** |
| 100,000 | 4.8M | **~$259** | ~$262 | **~$778** |

**Gemini 2.5 Flash-Lite** at $0.10 / $0.40: ~$0.000072/call → ~**1.3×** Groq 20B.

**Translation** is separate and **dominates** if live AR→EN is on (NMT $20/M chars after 500k free). Example ESTIMATED: 2k Arabic chars/user/day × 30 × 10k users = 600M chars → **~$12k/month** NMT. Do **not** put that on an LLM.

**Correction LLM** (suggestions/shortcuts) is additional Groq 20B usage — existing product cost, not created by the advisor.

Allam “free” does **not** make it the production choice: JSON failure rate makes it expensive in retries and product quality.

---

## 17. Reliability analysis

| Failure | Current behavior | Multi-provider fallback? |
|---|---|---|
| Groq outage | `unavailable` → local | Yes, **material** if Gemini exists |
| 429 | throw `rate_limited`; no client retry | Yes **if** independent quota |
| Timeout | 30s abort — **too long for typing**; stale anyway | Yes, with a **short** advisor timeout (recommend 800–1200 ms later) |
| Malformed JSON | `invalid` → noop | Yes **if** second model is JSON-reliable |
| Model missing from catalog | Allam risk | N/A if on gpt-oss-20b listed SKU |
| Quota / auth | mapped gateway errors | Different Google key helps only if fallback is Gemini |

**Current Allam advisor: RELIABILITY FAIL** (MEASURED).  
**Local engine: PASS** (always available).  
**Multi-provider fallback: valuable after a working primary**, not instead of one.

---

## 18. Privacy analysis

**PASS** for the advisor design. **Do not weaken it for model quality.**

| Control | Verified |
|---|---|
| Password / sensitive fields | `safetyAllowed` false; no consult |
| JWT / api-key / tokens / CC | `shouldConsultAdvisor` false |
| Snippet | window ±24, cap 160, secrets → `[protected]` |
| Packet | IDs, scores, evidence **kinds**, `hasReplacement` — **no replacement text** |
| Vote reject | `replacement` / `text` / `write` |
| Analytics | cycle id, hyp count, actions — no field text |
| Translation cache | hashes full sentence server-side (existing; separate from advisor) |

**Provider comparison**

| Path | Extra parties | Training risk |
|---|---|---|
| Groq paid API | Groq | Follow Groq DPA (REQUIRES EXTERNAL contract review) |
| Gemini **free** | Google | Pricing page: **used to improve products** |
| Gemini **paid** | Google | Typically not used for training (REQUIRES EXTERNAL) |
| OpenRouter | OpenRouter + upstream | Depends on data-policy routing; free hosts worse |
| Google Translate | Google Cloud Translation | Standard GCP; commercial NMT |

**PRIVACY: PASS** if paid APIs + existing filters. **FAIL** if free Gemini / OpenRouter `:free` hosts see user snippets.

Personalization (future only): keep vocabulary **on-device**; hashed if needed; **do not** dump user lexicon into LLM context in this phase.

---

## 19. Free-tier analysis

**Do not design production on free tiers.**

| Vendor | Free | Commercial |
|---|---|---|
| Groq | Free developer keys exist; RPM/TPM on developer plan (1K RPM gpt-oss). Llama enterprise ContactSales. | Pay listed gpt-oss rates |
| Gemini | Free RPD shared Flash/Flash-Lite (pricing table; numbers change). **Training on free.** | Paid key, no “improve products” |
| OpenRouter | ~50 free-model req/day | Credits + purchase fee |
| Google Translate | 500k chars/month | $20 / 1M NMT |

Free tiers are for **dev experiments only**.

---

## 20. Benchmark methodology

- **Generator:** `tests/audit/evaluation/generate.ts`, seed **`20261015`** (disjoint from 20260831 / 20260901).
- **Not** conversation examples as the mass of the set.
- Systematic families via `mapLayout` / frames / noise — gold from generation, **not** from a model.
- Split 50% / 25% / 25% per case (`splitOf`).
- Local inspect uses **production** `analyzeFieldText` / `collectHypotheses` / `decideWriting` / `shouldConsultAdvisor`.
- **Same packet schema** as production (`buildAdvisorPacket`) for any future model call.
- **No live Groq/Gemini/OpenRouter in this audit** (quota + no Gemini/OpenRouter keys in repo). Ranking comparison across vendors is therefore **not claimed as measured**.
- Prior live Groq Allam run remains the **only** real-model advisor measurement.

---

## 21. Dataset

**N = 4500** (MEASURED counts).

| Family | N | Gold |
|---|---|---|
| layout | 1000 | remapped unseen/lex EN↔AR → `layout_fix` |
| spelling_layout | 750 | English neighbor + letter noise → `fix_english`; remapped lex word → `layout_fix` |
| mixed | 750 | Arabic frame + technical token → `preserve` |
| technical | 500 | URLs, versions, identifiers → `preserve` |
| short | 500 | 1–2 char tokens → `unknown` |
| punctuation | 500 | marks-only `preserve`; remapped sentences+punct `layout_fix` |
| contextual | 500 | real Arabic prose preserve; EN-on-AR sentences layout; Arabic+tech preserve |

Holdout **N = 1105**.

---

## 22. Results

**Local Decision Engine (MEASURED, this audit)**

| Metric | All | Holdout |
|---|---|---|
| Action accuracy | **85.58%** | **84.80%** |
| Hyp existence | 89.87% | 90.41% |
| Consult rate | **0.80%** | **0.72%** |
| Layout recall (gold layout_fix) | 72.60% | 71.28% |
| Layout FP | 119 | 31 |
| Layout FN | 530 | 137 |
| Mix/tech/contextual layout FP | 119 (all from contextual-class gold preserve) | 31 |
| Protected layout hyps | 0 | 0 |
| Mean local ms | 0.44 | 0.41 |

**Per-family action accuracy (all)**

| Family | Accuracy | Consults |
|---|---|---|
| layout | 89.7% | 24 |
| spelling_layout | **47.2%** | 12 |
| mixed | **100%** | 0 |
| technical | **100%** | 0 |
| short | **100%** | 0 |
| punctuation | 93.8% | 0 |
| contextual | 76.2% | 0 |

**Implication:** the advisor almost never runs. Spelling/layout is the weak family **and still barely consults**. Fixing consult gates / local hyps will move accuracy more than adding Gemini.

**Groq Allam ranking (prior MEASURED):** n=1 usable; **accuracy unknown**.

**Gemini / OpenRouter ranking:** **NOT MEASURED.**

---

## 23. Model comparison

Weighted scores **1–5**. Workload = short bilingual hypothesis **ranking**, not MMLU. Ranking accuracy for non-Allam models is **prior**, not live.

| Criterion | Weight | allam-2-7b (Groq) | gpt-oss-20b (Groq) | gemini-2.5-flash-lite | OpenRouter (layer) |
|---|---|---|---|---|---|
| Intent ranking accuracy | 5 | 1 (unknown, n=1) | 3 prior | 3 prior | n/a |
| Arabic | 4 | 4 prior | 3 prior | 4 prior | n/a |
| English | 3 | 3 | 4 prior | 4 prior | n/a |
| Mixed-language | 5 | unknown | 3 prior | 4 prior | n/a |
| Technical tokens | 3 | unknown | 3 | 3 | n/a |
| Spelling vs layout | 5 | unknown | 3 prior | 3 prior | n/a |
| Short tokens | 2 | unknown | 3 | 3 | n/a |
| Structured JSON | 5 | **1 MEASURED** | **4** (correction JSON in-repo) | 4 prior | 3 |
| Latency | 5 | 4 success / 1 retries | **5** listed 1000 t/s | 3 EST | 2 extra hop |
| Cost | 3 | 5 if free / unknown | **5** | 4 | 3 + fee |
| Availability | 4 | **2** not on prod table | **5** listed | 4 | 3 |
| Rate limits | 3 | 2 (429 in live run) | 4 1K RPM | 3 | 2 free |
| Privacy | 4 | 3 paid Groq | 3 | 2 free / 4 paid | **2** |
| Ops complexity | 4 | 3 | **5** already wired | 2 new | **1** |

**Weighted qualitative winner for next experiment:** Groq **`openai/gpt-oss-20b`**.  
**Not a claim that it is more accurate than Gemini on this task.**

---

## 24. Architecture comparison

| Architecture | Accuracy | Latency | Cost | Reliability | Complexity | Recommendation |
|---|---|---|---|---|---|---|
| Single LLM (Allam now) | unknown / JSON fail | OK if 200; fail retries | low | **FAIL** | low | Reject as-is |
| Single LLM (gpt-oss-20b) | **unmeasured rank**; local 85% | best Groq | lowest LLM | good listed SKU | lowest | **Next experiment** |
| Primary + fallback | same as primary if 99% OK | p95 worse on fail path | ~+1% | **best** | medium | **After** primary works |
| Parallel 2-vote | unmeasured | worse p95 | 2× | more moving parts | high | No |
| Three-model vote | unmeasured | worst | 3× | disagreement tax | very high | No |
| Dynamic routing | unmeasured | mixed | mixed | extra bugs | high | No |
| Local + single LLM | **MEASURED 85% local** + rare rank | local 0.4 ms; LLM async | low | local always | low | **Yes** |
| Local + primary/fallback | same | fail path slower | ~same | highest | medium | **Later** |
| Local + LLM + Google Translate | intent vs MT separated | MT parallel product path | MT dominates if live | MT SLA 99.9% typical | already built | **Yes — keep** |

Options A–H from the brief map to: **F + H now**, **D/E later**, reject C/G voting/router, reject OpenRouter-primary (C).

---

## 25. Translation architecture

**Recommend:** Arabic → English via **Google Cloud Translation NMT**.

Optional **light Groq polish** only after a Google draft (already Pro non-live `google_then_groq`). Never let polish discard a good Google result (already implemented).

Do **not** use Gemini/Groq as the primary translator unless a **translation** holdout (BLEU/human AR→EN, technical tokens, placeholders) beats NMT. That study was **not** run here.

Advisor LLM stays **intent-only**.

---

## 26. Recommended production architecture

```
USER
  ↓
Local analysis + Hypothesis Generation V2
  ↓
Ambiguous?  ──NO──→ local decide → Policy → Write Gate
  YES
  ↓
Async fast LLM ranker (IDs only)
  PRIMARY: Groq openai/gpt-oss-20b   // next implementation; not shipped this audit
  FALLBACK: none until primary JSON+rank measured
  (later) Gemini 2.5 Flash-Lite on timeout/invalid/5xx only
  ↓
Policy + mixedLayoutSafety
  ↓
Write Gate

Translation Mode:
  Arabic → Google Translate → optional light polish
```

**UX:** one assistant. No Groq/Gemini/OpenRouter modes.

**Until gpt-oss-20b shadow ranks ≥200 valid holdout votes:** keep **`allam-2-7b` in shadow** (current), **do not enable apply**.

---

## 27. Why alternatives were rejected

| Alternative | Why rejected |
|---|---|
| Keep Allam as long-term primary | MEASURED JSON failure; missing from Groq production table |
| Gemini as primary now | No ranking data; new vendor; free-tier training; Groq 20B already in stack |
| OpenRouter primary/fallback | Extra hop, fee, privacy, `:free` traps; not a model |
| 3-way vote every event | 3× cost, worse latency, no accuracy proof; consults are rare |
| Difficulty model-router | Second decision engine; unjustified by family consult rates |
| LLM writes the field | Violates Write Gate / packet contract / user safety |
| LLM replaces Google Translate | Different job; existing router works; no MT eval win |
| Per-keystroke LLM | Latency + cost + stale; consult already 0.8% of **cycles**, not keys |

---

## 28. Risks

1. **`gpt-oss-20b` may also fail JSON** on the advisor prompt (reasoning models historically needed `include_reasoning: false` — already set). **Unknown until shadow eval.**
2. Groq **429** on shared layout-classification RPM (anon 10 / free 45 / pro 120 **per minute**, VERIFIED). Advisor **shares** that bucket with legacy classify.
3. 30s gateway timeout is **not** a typing timeout.
4. Contextual family **layout FP** (119) is **local**, not LLM — do not “fix” with more models.
5. Gemini 3.x ID churn if 2.5 is later deprecated.
6. Translation cost at live-AR scale dwarfs advisor cost.
7. Enabling `apply` before JSON reliability repeats Allam’s failure as **wrong suggestions**.

---

## 29. Remaining unknowns

- Ranking accuracy of **any** JSON-reliable model on this packet (**HIGH**)
- Whether widening `shouldConsultAdvisor` on spelling_layout helps or hurts FP
- Real DAU, cycles/user/day, tokens/request (**no production traces in this audit**)
- Gemini Flash-Lite JSON validity rate on the exact prompt
- Chrome E2E / manual typing feel with async advisor
- Allam catalog/pricing official status
- Exact OpenRouter purchase fee % (FAQ is templated)

---

## 30. Files changed

Evaluation / docs only (plus test discovery):

- `docs/audit/LLM_PROVIDER_ARCHITECTURE_AUDIT.md` (this file)
- `tests/audit/evaluation/generate.ts`
- `tests/audit/evaluation/local-baseline.eval.test.ts`
- `tests/audit/evaluation/local-baseline-results.json`
- `tests/audit/evaluation/README.md`
- `extension/vitest.config.ts` — include glob for `../tests/audit/evaluation/**/*.eval.test.ts` so the isolated eval can run

---

## 31. Files intentionally unchanged

Production engine (`decide.ts`, `hypotheses.ts`, `layoutSequence.ts`, `chunks.ts`, `mixedLayoutSafety.ts`), `advisor.ts` behavior, `hypothesisAdvisorProvider.ts`, `AI_MODELS`, Groq client, translation router, Write Gate mutation path, UI, settings, entitlements.

---

## Final decision table

| Architecture | Accuracy | Latency | Cost | Reliability | Complexity | Recommendation |
|---|---|---|---|---|---|---|
| Single LLM | unknown (Allam fail) | medium | low | fail now | low | Replace model, don’t multiply |
| Primary + fallback | unmeasured | fail-path slower | ~+1% | high | medium | After primary works |
| Parallel voting | unmeasured | worse | 2× | messy | high | **NOT RECOMMENDED** |
| Three-model voting | unmeasured | worst | 3× | messy | very high | **NOT RECOMMENDED** |
| Dynamic routing | unmeasured | mixed | mixed | extra | high | **NOT RECOMMENDED** |
| Local + single LLM | **84.8% holdout local** | local 0.4 ms; LLM async | low | local PASS | low | **RECOMMENDED (now)** |
| Local + primary/fallback | same | p95 fail slower | low | highest | medium | **RECOMMENDED (later)** |
| Local + LLM + Google Translate | intent vs MT split | MT separate | MT if live | good | already built | **RECOMMENDED** |

---

CURRENT LLM:  
allam-2-7b / Groq (shadow; JSON-unreliable)

BEST SINGLE MODEL:  
openai/gpt-oss-20b / Groq (JSON+ops evidence; ranking NOT MEASURED)

BEST FALLBACK:  
gemini-2.5-flash-lite / Google (failure-only; after primary works) / none until then

BEST TRANSLATION PROVIDER:  
Google Cloud Translation (NMT)

BEST ARCHITECTURE:  
Local-first + single fast LLM ranker + Google Translate for AR→EN

MODEL COUNT NEEDED FOR PRODUCTION:  
1 (intent ranker) + 0 extra voters; Google Translate is not an LLM

PRIMARY PROVIDER:  
Groq

FALLBACK PROVIDER:  
none (now) / Google Gemini later on failure only

PARALLEL VOTING:  
NOT RECOMMENDED

MODEL ROUTING:  
NOT RECOMMENDED

LOCAL-FIRST:  
YES

LLM PER-KEYSTROKE:  
MUST BE NO

LLM DIRECT WRITE:  
MUST BE NO

GOOGLE TRANSLATE SEPARATE:  
YES

ESTIMATED LATENCY:  
MEASURED local 0.44 ms; MEASURED Groq Allam success-path p50 389 ms / p95 640 ms; ESTIMATED gpt-oss-20b similar or faster; retry p50 8.5 s MUST NOT ship

ESTIMATED MONTHLY COST:  
Advisor gpt-oss-20b ESTIMATED ~$3 / 1k users, ~$26 / 10k, ~$260 / 100k (1.6 calls/user/day). Voting ~3×. Translation NMT can dominate if live mode is on.

ACCURACY:  
MEASURED local holdout 84.80% action; Groq ranking unknown (n=1); Gemini/OpenRouter not measured

RELIABILITY:  
FAIL (current Allam advisor) / PASS (local path)

PRIVACY:  
PASS (advisor filters; keep paid APIs)

RECOMMENDED NEXT IMPLEMENTATION:  
Keep shadow. Do not add providers. Shadow-evaluate Groq openai/gpt-oss-20b on the same advisor packet until ≥200 valid holdout ranks exist; keep apply off.

CONFIDENCE:  
MEDIUM
