# Local AI Architecture Audit

**Date:** 2026-09-01  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Scope:** Read-only architecture and code audit. Production code, configuration, tests, prompts, and provider settings were not changed. No Local AI model was implemented.

Evidence classes used below:

| Class | Meaning |
|---|---|
| **FACTS FROM CODE** | Current source, as executed |
| **MEASURED RESULTS** | Numbers from repository JSON / a live inspect run in this audit |
| **EXTERNAL RESEARCH** | Public model cards / small-model surveys, not Flowlary measurements |
| **ENGINEERING INFERENCE** | Reasoning from facts + measurements |
| **RECOMMENDATIONS** | What to do next |

---

## 1. Executive verdict

**If the Local Deterministic Engine is making Flowlary feel stupid, the correct solution is not more bilingual rules.**

Keep deterministic **safety, keyboard mapping, token boundaries, session/DOM, and Write Gate**. Stop treating `analyzeFieldText` / `collectHypotheses` / `decideWriting` as a language-understanding brain. Add a **lightweight local language model as the primary understanding layer** that emits structured span hypotheses. Centralize decision + Write Gate stay.

This is a **conditional GO** to *design and benchmark* that architecture. It is **NO-GO** to delete the Local Engine, **NO-GO** to ship a model without a holdout, and **NO-GO** to put a 1B–4B model on every keystroke.

The smoking gun is not “the Write Gate is slow.” It is that **the hypothesis layer never generates the corrections the user needs**, so ranking (Groq / Gemini / OpenRouter) cannot help.

---

## 2. Current architecture as actually implemented

**FACTS FROM CODE**

Production boot (`extension/src/content/startWritingRuntime.ts`):

```
InputEngine.start()
→ establishEngineMode()          // memory default: enforce
→ registerProductionHypothesisAdvisor()
→ startShadowEngine()            // observe-only
→ startEnforceCoordinator()      // auto path
```

Keystroke path (`enforceCoordinator.ts` → `pipeline.ts`):

```
document input / keyup Space|Enter|Tab / focus-out
→ InputEngine (generation, composition, paste source, field safety)
→ EventBus
→ runFieldCycle
     buildFieldContext (UserWritingPolicy + editor tier + mutex + cooldown)
     read field + caret
     prune session tags / detectUserOverride
     analyzeFieldText
     collectHypotheses
     candidatesFromHypotheses
     decideWriting                    ← local, synchronous, authoritative for auto-write
     fulfillWritingDecision
        suggestion → UI card
        translation → remote translate, then Write Gate
        layout_fix / english_correction + replacement → commitWriteTransaction → DOM
     fire-and-forget consultAdvisor (rank IDs only; apply mode may later suggest, never auto-write)
     scheduleFieldWritingReview (pause / sentence; LLM edits → ingestReviewEdits → decide again)
```

`decideWriting` never calls a model. The advisor contract forbids `replacement` / `text` / `write`. Writing review may propose span edits; wording is dropped; `layout_suspect` must match `mapLayout`.

Local cycle latency in the architecture holdout is sub-millisecond (`meanMs` ≈ 0.41 on holdout). Advisor HTTP timeout on the extension client is **1800 ms**. Backend advisor deadline default is **1500 ms**. Write cooldown is **450 ms**. Review pause is **900 ms**, min interval **2500 ms**.

---

## 3. Current Local Engine responsibilities

**FACTS FROM CODE**

| Layer | File | What it actually does |
|---|---|---|
| Input | `InputEngine.ts` | Capture listeners; `shouldAssist`; generation bump; paste/drop; shortcuts. No NLP. |
| Session | `FieldSession.ts` | Generation, write mutex, 450 ms cooldown, override ranges, pending layout run, translated/corrected tags, review hash cache (48). Field-lifetime only. |
| Policy | `writingPolicy.ts` | Booleans/enums: auto vs suggestions vs shortcuts; layout/English/translate/advisor/review. |
| Tokenize | `safety/tokenize.ts` | Deterministic spans. |
| Protected | `safety/tokenKind.ts` | Regex: email, URL, JWT (`eyJ`), API key (`sk-`/`gsk-`), bearer, private key, card, hash, uuid, digits, env-secret, code-ish. |
| Analyze | `chunks.ts` `analyzeFieldText` | Role assignment: protected → exceptions/vocab → technical shapes → lexicon/script → layout span overlay → unknown Latin + Arabic neighbor = `intentional_foreign_token`. |
| Layout | `layoutSequence.ts` + `registry.ts` | Physical key map `en-US-qwerty` ↔ `ar-101`. Heuristic span score: coverage, n-gram plausibility, sequence, neighbor, lexicon bonus. Comment: scores are **not calibrated probabilities**. |
| Mixed safety | `mixedLayoutSafety.ts` | Block auto layout if a span covers genuine Arabic **and** keep-Latin roles. |
| Spelling | `instantSpell.ts` + `contextualSpell.ts` | Closed English typo map (~38 entries) + edit-distance 1 vs English lexicon, first-letter lock, previous-token English gate. **Latin only.** |
| Hypotheses | `hypotheses.ts` | Layout from `mapLayout`; English spelling; preserve/write_as_is; optional translate. Replacements **only** from map/typo/lexicon. |
| Decide | `decide.ts` | Hard gates; unique strong layout; mixed-intent blocks layout auto; translate; English spelling with mixed-field english-only-span rule; else preserve/noop. |
| Write Gate | `writeGate.ts` + `dom/editor.ts` | Shadow reject, cooldown, stale generation, composing, mutex, neighborGuard, open-token, snapshot, DOM commit. |
| Advisor | `advisor.ts` + `AdvisorProviderManager` | Rank existing hypothesis IDs. Groq → Gemini → OpenRouter when flags allow. Production defaults: Groq on, Gemini/OpenRouter/fallback **off** in `.env.example`. |
| Review | `writingReview.ts` + `reviewIsland.ts` | English (or Latin-run in mixed fields) island; kinds spelling/grammar/punctuation/layout_suspect. **No Arabic island.** |

### Capability checklist (what the code actually does)

| Question | Answer |
|---|---|
| Deterministic? | Tokenize, physical `mapLayout`, skip regexes, Write Gate, generation/mutex, policy booleans. |
| Heuristics? | Layout vote/span score, n-grams, Arabizi digits, title-case, “intentional Latin”, mixed-intent, decide thresholds (0.7 / 0.8 / 0.55). |
| Scores? | `heuristicScore`, `localScore`, confidence class. **Uncalibrated.** |
| Dictionaries? | High-frequency EN lexicon (`en-words.ts`), small AR lexicon (`ar-words.ts`), `COMMON_TYPOS`. Finite lists, not dictionaries. **`قادم` is not in the Arabic lexicon.** `coming` **is** in the English lexicon. |
| Language detect? | Script counts + lexicon hits + n-grams. No classifier. |
| Keyboard-layout corruption? | Sequence inference + physical map. Writing engine hardcodes qwerty/ar-101. |
| Spelling? | English only, tiny. Arabic: none. |
| Grammar? | Local: none. LLM writing review only. |
| Punctuation? | Role tagging; Shift glyphs `÷×—–`. Correction: LLM review only. |
| Mixed AR/EN? | `hasAmbiguousMixed`; mixed-intent layout block; unknown Latin near Arabic → preserve. |
| Intentional foreign words? | Exceptions, vocab hashes, title case, technical shapes, **unknown Latin + Arabic neighbor**. |
| Technical content? | Structural regex (camel, snake, ALL_CAPS, version, file ext, slash stack). |
| Protected content? | `skipReasonForToken`. Advisor/review skip sensitive kinds. Incremental typing of secrets is a known hole (completed-token classifiers). |
| User intent? | Enum `WritingIntent` from rules, not NLU. |
| Context / previous text? | ± neighbor tokens for layout and English spelling; pending layout run; review island contextBefore/After. |
| Session history? | Per-field tags and override. No durable writing memory in decide. |
| User history? | `personalExceptions` / `vocabularyHashes` if populated. `writingFeedback` is metadata hashes; **not wired into decide**. Learning product is a separate stack. |
| Uses LLM? | Advisor rank (async, non-authoritative for first write). Writing review (async). Translation (separate). |
| Does NOT use LLM? | Analyze, layout remap, local spelling, decide, Write Gate, DOM. |

---

## 4. Current Local Engine weaknesses

**FACTS FROM CODE + MEASURED RESULTS**

1. **Understanding is role assignment, not meaning.** A misspelled English word next to Arabic is classified as intentional foreign language.
2. **Hypothesis generation cannot invent missing actions.** If `fix_english` is never emitted, the advisor has nothing useful to rank.
3. **Arabic spelling does not exist** in the local engine.
4. **Grammar/punctuation do not exist** locally.
5. **Lexicons are tiny.** Unknown correct words look like errors; unknown errors look like “write as is.”
6. **Uncalibrated scores** are compared to hard thresholds as if they were probabilities.
7. **Mixed-field policy is conservative for layout (good) and blind for spelling (bad).**
8. **Cloud advisor apply cannot auto-write** on a late tick (`pipeline.ts`). Even a correct rank is a suggestion.
9. **Writing review islands are English/Latin.** Mixed Arabic typos are out of scope.
10. **Digit-less Arabizi is explicitly not detected** (`arabizi.ts`).
11. **Open/unfinished tokens and paste** correctly abstain — but then nothing later fixes them unless review fires.
12. **Personalization is unwired** to `decideWriting`.

Holdout quality of the *current* local decision (architecture corpus, seed `20261015`, `local-baseline-results.json`):

| Split | n | actionAccuracy | layoutRecall | layout FP | layout FN | mixLayoutFp | protectedLayout |
|---|---:|---:|---:|---:|---:|---:|---:|
| All | 4500 | 0.856 | 0.726 | 119 | 530 | 119 | 0 |
| Holdout | 1105 | 0.848 | 0.713 | 31 | 137 | 31 | 0 |

Worst family on that holdout: **`spelling_layout` 78/184 (42%)**. Mixed/technical/short families are high accuracy because gold is mostly **preserve** — the engine is rewarded for doing nothing.

GPT-OSS / Gemini 5500 corpus holdout (seed `20261107`): local hyp existence **1185/1326 (89.4%)**, action accuracy **1154/1326 (87.0%)**, layout FN **172**, layout FP **0**, protected FP **0**. Gemini ranking on **200 layout-only** cases: advised accuracy 0.92, local 0.92, **accuracyDelta 0, help 0, harm 0**. GPT-OSS full live: **INCONCLUSIVE**, 0 valid ranks (429/400).

**ENGINEERING INFERENCE:** Existing evals overstate “the engine works” because they are dominated by layout-or-preserve gold. They barely measure mixed-field spelling, Arabic spelling, grammar, or names.

---

## 5. Root causes of current failures

### Worked example (not a patch target)

Input:

`مرحبا hello are you comming or not نعم انا فادم الان`

Intended:

`مرحبا hello are you coming or not نعم انا قادم الان`

**MEASURED RESULTS** (2026-09-01, `analyzeFieldText` → `collectHypotheses` → `decideWriting`, helpStyle auto, layout+correction on):

| Token | Role | Layout | Hypothesis |
|---|---|---|---|
| مرحبا / نعم / انا / فادم / الان | `arabic_prose` | none | `write_as_is` 0.7 |
| hello / are / you / or / not | `english_prose` | none | `write_as_is` 0.7 |
| **comming** | **`intentional_foreign_token`** | none | **`preserve` 0.9** |

- `layoutSpans`: **[]**
- `hasAmbiguousMixed`: **true**
- Decision: **`noop`**, reasons `hypothesis_preserve` + `no_unambiguous_winner`
- `shouldConsultAdvisor`: **false**
- `suggestSpelling('comming', 'you')`: **`coming`** (contextual_spell, distance 1) — **never used**, because `spellingHypothesis` returns null for `intentional_foreign_token` and `arabic_prose`
- `suggestSpelling('فادم', 'انا')`: **null** (non-Latin)
- Review island: Latin run `"hello are you comming or not "` only. **`فادم` is not in the island.**

**General class:** *Unknown in-script errors inside bilingual text are classified as intentional and therefore uncorrectable by the local brain; the advisor is not even asked; Arabic never enters review.*

That class is the same family as: slang vs typo, names vs misspellings, technical tokens vs typos, partial words vs finished errors, keyboard leftover vs intentional English.

### Failure-class table

| Class | Root cause | Module | Current signal | Missing signal | Why rules struggle | Could a small LM help? | Must stay deterministic? |
|---|---|---|---|---|---|---|---|
| Mixed AR/EN spelling (`comming`) | Unknown Latin + Arabic neighbor → intentional foreign; spelling skipped | `chunks.ts`, `hypotheses.ts` | Script + neighbor | Semantic “this is English misspelling of coming” | Same surface as product names / slang | **Yes** (span + proposed) | Preserve/protection still yes |
| Arabic typo (`فادم`→`قادم`) | All Arabic → `arabic_prose`; no AR spell path | `chunks.ts`, `contextualSpell.ts` | Script | Morphological / lexical AR error | Finite AR list cannot cover productive morphology | **Yes** | Layout map still yes; do not remap real Arabic |
| Keyboard corruption | Sequence + lexicon + n-grams | `layoutSequence.ts` | Physical map + plausibility | True “did the user mean the other layout?” | Isolated unseen words, leftovers, mixed neighbors | **Partial** (detect span); **replacement must be mapLayout** | **Yes — mapping, coverage, DOM** |
| Intentional bilingual | Conservative preserve | `mixedLayoutSafety.ts` | Coexistence of scripts | Communicative intent | Rules cannot tell “hello” vs leftover `hsjo]lj` except via layout score | **Yes** | Safety + do not blob-translate |
| Names | No NER | chunks | Unknown / title case | Name vs typo | Closed lists fail | **Yes, with high preserve bias** | User override |
| Slang / Arabizi | Digit Arabizi only | `arabizi.ts` | 2/5/7/9 | Dialect / digit-less Arabizi | Word lists forbidden and insufficient | **Yes** | Preserve unless user asked to convert |
| Technical / protected | Shape regex on **completed** tokens | `tokenKind.ts`, `technicalTokens.ts` | Pattern | Incremental `sk-…`, JWT prefixes | Prefixes look like Latin layout | LM must **not** rewrite; regex + incomplete guards stay | **Yes** |
| Grammar / punctuation | Not in local engine | `writingReview.ts` | None locally | Syntax | You cannot enumerate English/Arabic syntax in decide.ts | **Yes** | Write Gate, no full-field rewrite |
| Partial / rapid typing | Open token + cooldown | `layoutSequence.openToken`, Write Gate | Caret, trailing word | “user paused vs still typing” | Debounce is not understanding | LM on pause only | **Yes — never mutate open token** |
| Context-dependent correction | No discourse model | decide.ts | Previous token, pending layout run | Sentence meaning | Thresholds cannot encode meaning | **Yes** | Stale/generation still yes |
| Advisor cannot rescue | Rank-only + consult false when no rival write hyps | `advisor.ts` | Existing hyp IDs | Missing hyps | Ranking a preserve list cannot create `coming` | Need **generation**, not ranking | Ranker can remain for cloud uncertainty |

---

## 6. Deterministic vs AI responsibility matrix

| Responsibility | Deterministic | Local AI | Notes |
|---|---|---|---|
| Sensitive-field / password / code-editor skip | **Keep** | No | `evaluateFieldSafety` |
| URLs, emails, JWT, API keys, code, identifiers | **Keep** (regex + incomplete prefix) | May *label* but must not rewrite | Incremental typing hole stays a deterministic problem |
| Token boundaries / caret / selection | **Keep** | Consume offsets only | Model never owns DOM indices without island clipping |
| Keyboard physical mapping | **Keep** `mapLayout` | May flag `layout` spans | Proposed layout text invalid unless map matches |
| Layout *detection* in mixed text | Signals only | **Move** | Heuristic sequence stays as a candidate generator |
| Spelling EN/AR | Signals (typo map optional) | **Move** | Instant map can remain a fast path, not the brain |
| Grammar / punctuation | No | **Move** | Already LLM review; local model can own first pass |
| Mixed-language interpretation | Signals | **Move** | This is the core failure |
| Preserve vs correct | Policy + safety veto | **Primary** | AI proposes; policy/Write Gate veto |
| Intent / hypothesis generation | Layout/protect candidates | **Primary** | Ranker-only is insufficient |
| Semantic coherence | No | **Move** | |
| DOM / Write Gate / undo / neighborGuard / stale / cooldown | **Keep, untouched in spirit** | Never | |
| User overrides | **Keep** | Must honor | |
| Generation checks / cancellation | **Keep** | Request abort on new keystroke | |
| Cloud advisor ranking | Optional second opinion | Local AI first | Do not vote by default |

**DETERMINISTIC RESPONSIBILITIES:** safety, mapping, spans/caret, session/mutex/generation, Write Gate, override, protected skip, layout *candidate* remap.

**LOCAL AI RESPONSIBILITIES:** understand the island; emit 0–N span issues (`preserve` / `layout` / `spelling` / `grammar` / `punctuation` / `uncertain`); propose smallest corrections; never mutate DOM.

---

## 7. Candidate architectures

Evaluated against **this** codebase, not a greenfield assistant.

| ID | Pattern | Fit to Flowlary |
|---|---|---|
| **A** | Safety → Deterministic Engine → Decision | **What we have.** Fast, safe on protected/layout FP (holdout layout FP 0 on 5500 corpus). Feels stupid on mixed spelling/Arabic/grammar. Adding rules recreates the `comming` class. |
| **B** | Safety → Deterministic signals + Local AI → Decision | **Insufficient if AI only ranks existing hyps.** Measured: example consult=false. Same failure as current Groq/Gemini advisor. |
| **C** | Safety → Context → Local AI understanding → Hypotheses → Decision → Write Gate | **Strong fit.** Matches `collectHypotheses` + `decideWriting` + Write Gate. AI becomes hyp generator. |
| **D** | Safety → Deterministic candidates → Local AI evaluation → Decision → Write Gate | **Necessary for layout.** `mapLayout` candidates must be evaluated, not free-generated. Incomplete for spelling/grammar (no local candidates for `فادم`). |
| **E** | Safety → Local AI generates understanding + candidates → deterministic validation → Decision → Write Gate | **Right for spelling/grammar.** Dangerous for layout if AI invents remaps. Validation already exists in `ingestReviewEdits` (`layoutRemapMatches`). |
| **F (recommended)** | **C + D + E hybrid** | Safety → deterministic **signals + layout remap candidates + protected masks** → Local AI **understanding + extra span hyps** → merge/validate → `decideWriting` → Write Gate. Cloud review only on residual uncertainty / English polish. |

A is the status quo. B is the current advisor with a smaller model — it will **not** fix the measured example. C without D lets the model hallucinate Arabic↔Latin remaps. E without D same. F is the only pattern that matches both the layout success and the mixed-spelling failure.

---

## 8. Recommended architecture

**ENGINEERING INFERENCE + RECOMMENDATIONS**

```
InputEngine + FieldSession + safety          (unchanged)
        │
        ▼
Deterministic analysis pack
  tokens, scripts, protected, openToken,
  mapLayout candidate spans, pending layout run,
  override/translated/corrected ranges
        │
        ▼
Local Understanding Model  (debounced, cancellable, never on raw keystroke)
  output: structured issues[]  (see §8/§10 of this audit’s contract)
        │
        ▼
Hypothesis merge
  layout replacement := mapLayout only
  spelling/grammar/punct := model proposed, clipped to token/island
  preserve if protected / override / open token / paste
        │
        ▼
decideWriting (thinner: policy + uniqueness + mixed/layout vetoes)
        │
        ▼
Write Gate → DOM
        │
        └ optional cloud writing-review / advisor
             only if local verdict=uncertain OR English island after pause
```

Do **not** add sentence dictionaries, website lists, or a `comming`/`فادم` mapping.

---

## 9. Whether Local AI can replace most heuristic intelligence

**Answer: Yes for understanding/decision *content*; no for the control plane.**

**Which parts a 1B–4B model can realistically replace**

- Mixed-language interpretation (intentional vs error)
- English spelling beyond the 38-typo map (the inspect proved `coming` is knowable even locally — the *role* blocked it)
- Arabic in-script typos (`فادم`)
- Grammar/punctuation first pass
- Preserve vs correct for names/slang/technical-looking prose
- Whether a leftover Latin/Arabic run is layout vs bilingual

**Which parts must remain deterministic**

- Field safety, secrets, incomplete URL/JWT/API-key prefixes
- `mapLayout` and coverage
- Tokenize, caret, open token, neighborGuard, generation, mutex, cooldown
- Write Gate / undo
- User override
- “Model must not write the DOM”

**Interface changes**

- New provider: local understanding (similar to writing-review JSON, **not** the ID-only advisor).
- `collectHypotheses` gains a merge step; it must stop being the only source of `fix_english`.
- `shouldConsultAdvisor` becomes “cloud only if local uncertain,” not “if two local hyps conflict.”
- `extractReviewIsland` should be allowed to produce Arabic or mixed islands **for the local model**; cloud review can stay English-only for privacy/cost.

**Latency (expectations, not measurements of a Flowlary local model)**

| Path | Evidence | Expectation |
|---|---|---|
| Current local decide | **MEASURED** holdout mean ≈ 0.4 ms | Keep on every input event |
| Cloud Gemini rank | **MEASURED** P50 940 ms / P95 1173 ms | Too slow for typing; OK async |
| Groq when healthy | **MEASURED** ~680–870 ms in product report | Same |
| 1B–4B Q4 on CPU | **EXTERNAL RESEARCH** | Often 100 ms–2 s for short JSON; **too slow for keystroke**; OK on word/pause if queue depth = 1 |
| 4B Q4 on GPU/unified | **EXTERNAL RESEARCH** | Tens of ms–few hundred ms; still debounce |

**Accuracy improvement realistically possible**

- Not claimed as a number: **no local 1B–4B Flowlary eval has been run** (`local-ai-model-selection-results.json` is absent; Ollama harness exists but was not executed in this audit).
- **Inferred ceiling:** the example is trivial for any competent bilingual LM; the holdout `spelling_layout` 42% is the class to beat; mixed-family 100% preserve accuracy will **drop** if the model starts correcting — that is desirable if gold is relabeled.
- Cloud ranking **already measured accuracyDelta 0** on 200 layout cases: ranking will not magically fix missing hyps.

**If “replace most heuristic intelligence” means “delete layoutSequence and decide.ts”: No.**  
**If it means “stop using role heuristics as the bilingual brain”: Yes.**

1B models are a **benchmark candidate**, not a presumed winner: JSON reliability + mixed Arabic are the failure modes.

---

## 10. Required model capabilities

| Requirement | Bar |
|---|---|
| Size | Prefer **≤4B** dense (or MoE with ≤4B active). 1B only if it passes JSON + mixed-AR tests. |
| Latency | **P95 < 400 ms** on the production box for ≤256 token island; else pause-only. Never block InputEngine. |
| RAM | Fit in remaining host RAM after Node API. Plan **3–6 GB** for 4B Q4 + KV + OS. Current compose: **no GPU**. |
| VRAM | **Do not assume.** CPU llama.cpp / Ollama first. |
| CPU | Must run on a single Node-adjacent process; one in-flight generation per field (better: per server with queue). |
| Context | **2k–8k** is enough (island + ~200 chars context). Do not send whole 60-minute buffers. |
| Arabic | MSA + Gulf/Levant informal; must not “correct” dialect into MSA unless asked |
| English | L2 errors (`comming`, agreement) |
| Mixed-language | Preserve intentional `hello` + Arabic; fix in-script typos independently |
| JSON | Constrained decoding / `format: json`; reject extra keys `write`/`html`/`replacement` of whole field |
| Throughput | Design for **one generation at a time** per process initially; extra requests abort |
| Quantization | Q4_K_M or Q5_K_M starting point |
| Runtime | **llama.cpp or Ollama sidecar**; not Transformers-in-Node; not vLLM unless a GPU host exists |

---

## 11. Candidate model shortlist

**EXTERNAL RESEARCH** (not Flowlary winners). Benchmark all; do not pick from this list alone.

| Model | Why shortlist | Risk |
|---|---|---|
| **Qwen3-4B / Qwen3-1.7B** | Strong multilingual + JSON/tooling reputation; Apache-2.0 on Qwen3 | Arabic quality vs dedicated AR models unknown here |
| **Gemma 3 4B / Gemma 3 1B / Gemma 3n E2B** | Small-device targeting; Nile-Chat is Gemma-3 based | License review for commercial |
| **Phi-4-mini** | Tight RAM (~3 GB Q4) | Weaker AR/mixed than Qwen/Gemma in public AR tables |
| **IBM granite-4.0-h-3b-ar** | Explicit EN + MSA + dialects; 8k context | New; runtime/GGUF maturity |
| **Nile-Chat-4B** | Egyptian + Arabizi scripts | Dialect specialization may not match Gulf product users |
| **SmolLM2 / other <2B** | CPU-cheap | Likely fail mixed+JSON; include as **negative control** |

Existing eval harness already lists Ollama names `qwen3:0.6b`, `llama3.2:3b` — those are **study stubs**, not recommended production brains.

---

## 12. Evaluation methodology

**Same holdout for all systems. No golden sentence as architecture proof.**

**Systems**

1. **BASELINE:** current Local Engine (`inspectLocal` / `decideWriting` without advisor).
2. **CANDIDATE:** current safety + Local AI understanding → merge hyps → `decideWriting` → (eval-only, no DOM).
3. **OPTIONAL:** candidate + existing cloud advisor/review (Gemini/Groq) on `uncertain` only.

**Protocol**

- Frozen seed + versioned case file.
- Metrics: useful intervention, harmful intervention, protected violation, mixed-preserve violation, layout FP/FN, spelling/grammar recall, JSON validity, span-offset validity, P50/P95 latency, abort/stale rate.
- Product value: `useful - 3*harmful - unnecessary` (already in `local-ai-model-selection.eval.test.ts`).
- Harmful auto-write **weights more** than a miss.
- Run CPU-only and (if available) GPU; report both.
- Long-session: 30–60 min typed replay or 400+ sequential islands with cancellation.

Reuse: `tests/audit/evaluation/local-ai-model-selection/` contracts (`DETECTOR_SYSTEM`, `RANKER_SYSTEM`, `REVIEW_SYSTEM`). Ranker-only is a **control**, not the candidate architecture.

---

## 13. Existing dataset assessment

**MEASURED RESULTS / FACTS FROM FILES** (counts from generators, result JSON, or explicit literals). No invented accuracy for missing runs.

| Corpus | Path | n | Gold | Notes |
|---|---|---:|---|---|
| Arch local baseline | `tests/audit/evaluation/generate.ts` + `local-baseline-results.json` | 4500 / holdout **1105** | layout_fix / preserve / fix_english / unknown | Best local metrics we have |
| GPT-OSS / Gemini | `tests/unit/writing-engine/gpt-oss-20b-shadow/generate.ts` | 5500 / holdout **1326** | same 4 | Gemini ranked **layout only (200)**; GPT-OSS live **0 ranks** |
| Live Groq generator | `live-groq-shadow/generate.ts` | 5500 / holdout **1355** (report) | same | Live ranks unusable |
| Docs experiment | `docs/audit/_experiments/holdout-results.json` | 2826 / holdout **715** | layout_fix / noop / preserve / … | Older shim era |
| Hyp-v2 | report ~5400 / holdout 1350 | layout / preserve / spelling_or_preserve | Ambiguous spelling gold |
| Advisor holdout | ~2500 / ~625 | layout_fix / preserve / english_or_abstain | Ambiguous English gold |
| Golden intent | `golden-intent-cases.ts` | ~115 | often forbid/role, not action | |
| Local-AI strata hand | `local-ai-model-selection/dataset.ts` | **49 hand** + golden + arch holdout | 26 strata A–Z | **Sufficient taxonomy sketch; insufficient labeled AR spelling / grammar / mixed-error gold** |
| Scenario unit | `scenario-classes.test.ts` | 18 | assertions | |
| Bilingual unit | `bilingual-keyboard-mix.test.ts` | 17 | includes “do not layout-rewrite” the mixed sentence — **and that test PASSES while spelling is still wrong** |
| E2E | `fresh-browser-corpus.ts`, `real-usage-writing.spec.ts` | tens | browser | Layout + preserve; not Arabic spelling |
| Safety tokens | `characterization/safety-tokens.test.ts` | ~15 | skip reasons | |

**Is this enough to evaluate a Local AI model?**  
**No, not as-is.**

Missing:

- Gold **span + proposed text** (not only action enum)
- Arabic in-script typos (`فادم` class) as first-class labels
- Mixed-field English typos that must be corrected (today mixed family gold is preserve)
- Grammar/punctuation gold (hand set is tiny)
- Names/slang/Arabizi **with** near-miss spellings
- Incremental/open-token sequences (not single snapshots)
- Paste vs type source labeled on every case
- Human-reviewed holdout of real chats (generated corpora overfit layout frames)

Class imbalance: preserve/unknown dominate; intervening gold is mostly layout. A model that always preserves would look strong on mixed/technical/short.

---

## 14. Required new test classes

Label each with `goldAction`, `goldKind`, `span`, `proposed` (or null), `mustPreserve`, `protectedContent`, `inputSource`, `openToken`.

Required families (do not one-shot the audit sentence):

- Arabic, English, mixed AR/EN
- Keyboard-layout both directions, leftover single token, punctuation-bearing remap
- Spelling EN and **AR**
- Grammar, punctuation
- Technical, URLs, emails, JWTs, API keys, code
- Names, slang, Arabizi (digit and digit-less)
- Intentional unusual language / L2 English preserve
- Preserve vs correct pairs that share surface form
- Ambiguous
- Incomplete typing, rapid typing, paste, long sentences, multiple errors
- After-layout spelling (`comming` after remap)

---

## 15. Cloud provider relationship

**FACTS FROM CODE:** Groq (`gpt-oss-20b`), Gemini (`gemini-3.5-flash-lite`), OpenRouter (configurable). Advisor ranks IDs. Writing review proposes edits. Fallback flags default off. `localDecisionAuthoritative: true` on provider failure.

**RECOMMENDATION:** **Local AI first → cloud only on uncertainty or English polish.**

Not recommended without evidence: local+cloud voting; cloud verification of every local decision; local candidates → cloud ranking as the primary path (Gemini accuracyDelta 0 on layout ranks).

| | Local-first | Cloud-on-uncertain | Rank-every-cycle (today’s intent) |
|---|---|---|---|
| Cloud calls avoided | High | High | Low (`shouldConsultAdvisor` already sparse) |
| Latency | Local P95 + optional 1s cloud | Same | User already doesn’t wait |
| Cost | GPU/CPU host vs tokens | Tokens only on tail | Groq 429 is a **measured** cost/reliability problem |
| Accuracy | Unknown until benchmark | Cloud may help grammar | Ranking cannot create missing hyps |
| Privacy | Text can stay on server you control | Snippets still leave | Current advisor already sends snippets (masked secrets) |

Do not introduce voting unless a holdout shows local and cloud disagree on a class where both are calibrated.

---

## 16. Trigger strategy

**FACTS FROM CODE:** Enforce already runs on **every `input` event** plus Space/Enter/Tab and focus-out. Local path is cheap. LLM paths are async.

**RECOMMENDATION: hybrid**

| Work | Trigger |
|---|---|
| Deterministic layout remap (current unique-strong-layout) | Keep current input/word-boundary (already gated by open token + mixed-intent) |
| Local AI understanding | **Word completed (space/punct) OR 350–900 ms pause**, whichever first; **cancel** on generation bump |
| Not | Every keystroke |
| Not | Every 5 words as a sole rule (too coarse for typos, too chatty for CPU) |
| Cloud review | Keep sentence boundary / 900 ms pause / 2500 ms interval; skip if local already applied or verdict confident |

**UX:** Typing stays on the 0.4 ms path. AI never holds the mutex until Write Gate after a **completed**, **non-open** span.

**Load:** Assume a fast typist ~200–400 characters/min ≈ 40–80 words/min. Pause/word trigger ≈ **20–80 local-AI requests per active hour per user**, not thousands. Queue depth 1; drop superseded islands.

---

## 17. Server feasibility

**FACTS FROM CODE**

- Production deploy: `deploy/Dockerfile` **node:22-bookworm-slim**, `deploy/docker-compose.yml` API + nginx. **No GPU service, no Ollama, no CUDA, no model volume.**
- Data: JSON file store, single process (horizontal scale already unsafe for credits).
- This audit **did not SSH into a production VM**. CPU/RAM/GPU of the live host are **UNVERIFIED**.
- Developer-machine notes inside `local-ai-model-selection.eval.test.ts` describe an Apple M3 / 16 GB study environment — **not** production.

**ENGINEERING INFERENCE**

| Host | 1.7B Q4 | 4B Q4 |
|---|---|---|
| Current Node-only container | Not feasible in-process | Not feasible in-process |
| Same VM + Ollama/llama.cpp CPU sidecar, **≥8 GB RAM free** | Plausible, higher latency | Plausible if RAM ≥ ~12 GB |
| GPU 8 GB+ | Comfortable 4B | Comfortable |

Runtimes: **llama.cpp or Ollama sidecar** first (simple, abort, GGUF). vLLM only with a GPU and ops ownership. Transformers Python in the API process: avoid. Node-binding llama.cpp is optional later.

**Feasibility verdict:** Local AI is **not deployable on the current compose file**. It is **feasible** as a second container **if** the host has RAM (CPU) or a GPU. Confirm host specs before GO to implementation.

---

## 18. Latency expectations

| Component | Source | Value |
|---|---|---|
| Local analyze+decide | MEASURED `local-baseline-results.json` | ~0.4 ms mean |
| Write cooldown | CODE | 450 ms |
| Review pause | CODE | 900 ms |
| Advisor client abort | CODE | 1800 ms |
| Gemini rank | MEASURED | P50 940 / P95 1173 ms |
| Local 4B CPU JSON | RESEARCH (not measured here) | Budget **400 ms P95**; if missed, pause-only |
| Target UX | INFERENCE | User never waits on keydown; correction lands on space/pause like a competent IME |

---

## 19. Cost implications

| Item | Direction |
|---|---|
| Groq/Gemini/OpenRouter tokens | Should **fall** if local absorbs mixed/spelling and cloud is uncertain-only |
| Host RAM/CPU or GPU | **New** fixed cost (largest) |
| Engineering | Hypothesis merge + eval set + sidecar ops |
| Failure cost of more rules | Ongoing false-confidence; already visible in mixed spelling |

No dollar amounts are in-repo for Groq/Gemini unit cost; do not invent them.

---

## 20. Safety model

Non-negotiable:

1. Model output is **data**, never a write command.
2. Protected tokens / sensitive fields / paste: no AI rewrite.
3. Layout proposed text must equal `mapLayout` (existing `layoutRemapMatches`).
4. Open token / composing / stale generation / neighborGuard unchanged.
5. Snippets to cloud remain masked; local model should receive **islands**, not whole passwords.
6. JSON schema allowlist; reject `write`, `html`, DOM verbs (already sketched in `contracts.ts`).
7. User override always wins.
8. Failure mode = current local baseline (layout + preserve), not a stuck cursor.

---

## 21. Integration impact

Fits **beside** InputEngine, FieldSession, analyzeFieldText (as signal pack), collectHypotheses (merge), decideWriting, UserWritingPolicy, Write Gate, Writing Review, AdvisorProviderManager.

Does **not** require replacing Chrome event capture or DOM writers.

Advisor Groq/Gemini/OpenRouter remain valid as **tail** cloud. Telemetry (`writing.decision`, `writing.advisor_consult`) needs a `local_ai` result enum — additive.

Tests: keep safety/layout/write-gate suites as regression gates. Add local-AI eval as **opt-in** like other `*.eval.test.ts` (already excluded from default vitest).

---

## 22. Files/modules affected

**Must remain untouched in behavior (implementation may call them):**  
`writeGate.ts`, `dom/editor.ts`, `tokenKind.ts`, `tokenize.ts`, `layouts/registry.ts`, `FieldSession` mutex/generation, `InputEngine` ownership.

**Reusable as-is:**  
`analyzeFieldText` (signals), `inferLayoutSpans`, `mixedLayoutSafety`, `ingestReviewEdits` validation, `reviewIsland` clipping, writing-review JSON types, `AdvisorProviderManager` pattern for a new local provider.

**Modify (later implementation, not this audit):**  
`hypotheses.ts` (merge), `pipeline.ts` (schedule local AI like review, cancel on generation), `decide.ts` (consume AI hyps; do not add more bilingual special cases), `advisor.ts` `shouldConsultAdvisor`, `writingReview.ts` island language policy, backend `http.ts` new local-inference route **or** sidecar, `deploy/docker-compose.yml`.

**Retire as *brain*, keep as *fast path / signals*:**  
Role heuristics in `chunks.ts` that encode “unknown Latin near Arabic = intentional”; uncalibrated decide thresholds as linguistic truth; expanding `COMMON_TYPOS` / lexicons as the product strategy.

**Do not retire:** layout sequence as candidate generator; instant spell as optional high-precision fast path.

---

## 23. Migration strategy

1. Freeze a **relabeled** holdout (span gold), including mixed spelling + Arabic typos.  
2. Run BASELINE metrics on that holdout (expect mixed-spelling FN).  
3. Sidecar + constrained JSON on 3–5 shortlisted models, **eval only**.  
4. Shadow: local AI hyps recorded, **Write Gate still local-only**.  
5. Apply on `spelling`/`grammar` with review-equivalent validation, suggestions-first if helpStyle requires.  
6. Only then allow auto-write for high-confidence in-script spelling that does not overlap protected/layout.  
7. Narrow cloud to uncertain + English polish.  
8. Stop adding mixed-language heuristics unless they are safety/layout-map bugs.

No production cutover in this audit.

---

## 24. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| 4B CPU too slow → backlog | High | Queue 1, cancel, pause trigger |
| Model rewrites secrets / URLs | Critical | Deterministic skip before prompt; never send; Write Gate |
| Hallucinated layout remap | High | `mapLayout` equality |
| Over-correction of dialect / names / slang | High | Preserve-biased contract; mustPreserve strata |
| JSON schema failure | High | Constrained decode; fallback baseline |
| Eval gold still “preserve mixed” | High | Relabel before claiming wins |
| RAM on tiny VPS | High | NO-GO deploy until host measured |
| Two brains disagree (local rules vs AI) | Medium | AI hyps win on language; rules win on safety |
| Groq 429 remains | Medium | Local-first reduces dependence |

---

## 25. GO / NO-GO decision

| Decision | Verdict |
|---|---|
| Keep adding deterministic bilingual “intelligence” | **NO-GO** |
| Delete Local Engine / Write Gate / mapLayout | **NO-GO** |
| Treat current advisor ranking as the Local AI solution | **NO-GO** (measured consult=false; accuracyDelta 0) |
| Architecture F: safety + deterministic layout candidates + local LM understanding + decide + Write Gate | **GO to benchmark** |
| Implement/ship a model in production in this phase | **NO-GO until holdout + host RAM/GPU + P95 latency** |
| 1B–4B as primary *understanding* layer | **CONDITIONAL GO** (4B-class preferred; 1B is a test, not a promise) |

### Critical question

> If the current Local Deterministic Engine is making Flowlary feel stupid, is the correct solution to keep adding deterministic rules, or should we change the architecture so a small local language model becomes the primary understanding layer?

**Answer:** Change the architecture. The engine is already a competent **control plane** (safety, layout maps, Write Gate) and an incompetent **language model**. The inspect of the mixed sentence proves the failure is **hypothesis generation / role heuristics**, not missing `if (token === 'comming')`. A small local LM should become the primary understanding layer; deterministic safety and Write Gate stay in charge of whether anything hits the DOM.

---

## Evidence appendix

### Live inspect (this audit)

Command: `npm run test -w @flowlary/extension -- ../tests/unit/writing-engine/_tmp-inspect-example.test.ts`  
Temporary test deleted after capture. Production files unchanged.

### Stale prior audit (do not trust blindly)

`docs/audit/DECISION_ENGINE_VS_LLM_ARCHITECTURE_AUDIT.md` (2026-08-31) claimed `advisorImpl` was null and `chunks.ts` did not compile. **Current tree:** production advisor is registered; `chunks.ts` compiles and ran in this inspect. That document’s *strategic* conclusion (stop growing the engine as a bilingual brain) still matches **this** code.

### Machine-readable twin

`tests/audit/evaluation/local-ai-architecture-audit.json`
