# Decision Engine vs LLM-First — Architecture Validation Audit

**AUDIT DATE:** 2026-08-31  
**REPOSITORY:** `/Users/moomen/Projects/flowlary`  
**SCOPE:** Audit only. Application code was not modified. No LLM was added. No Decision Engine was removed. No UI, storage, or production behavior was changed.  
**METHOD:** Trace of the current writing runtime; verification of prior audit documents against the current tree; a labeled holdout experiment outside `extension/src`.

---

## Files requested that do not exist

| Path | Status |
|---|---|
| `docs/audit/UNIFIED_WRITING_ASSISTANT_FULL_AUDIT.md` | Exists. Partially stale (see §1). |
| `docs/audit/INTENT_INTELLIGENCE_AND_LLM_DECISION_AUDIT.md` | Exists. Partially stale (see §1). |
| `docs/audit/INTENT_INTELLIGENCE_IMPLEMENTATION_REPORT.md` | **Does not exist.** |
| `docs/audit/INTENT_GENERALIZATION_IMPLEMENTATION_REPORT.md` | **Does not exist.** |

---

## 1. Executive Summary

The current writing path is **already a hybrid skeleton**: span hypotheses, local layout-sequence inference, policy gates, and Write Gate. It is **not** LLM-first. It is **not** a finished linguistic brain.

What actually auto-writes today (after a local decision):

1. **Layout remaps** produced by `inferLayoutSpans` + `mapLayout` when `decideWriting` picks a low-risk layout winner.
2. **Tiny local English spelling** (closed typo map + conservative edit-distance) when there is no layout suspicion and help style is `auto`.
3. **Remote translation** only if translation mode/session is on and the decision is `translation` — the translation **LLM/Google path can write** through Write Gate.
4. **Remote English grammar** is scheduled as a **suggestion**, not an auto-write, in the unified pipeline.

The hypothesis **advisor hook exists** (`consultAdvisor` / `setHypothesisAdvisor`) and is called from `runFieldCycle` when `shouldConsultAdvisor` is true. **No production advisor is registered.** `advisorImpl` is `null`. Ambiguous cycles therefore get `advisorResult: 'unavailable'` and usually **noop**.

### Compile blocker (current tree)

`extension/src/core/engine/chunks.ts` references `corrected` without declaring it (line ~113). Existing `tests/unit/writing-engine/*` suites **do not load**. A content script that imports `analyzeFieldText` from this file **cannot transform**.

Holdout metrics below used an **experiment shim** (`docs/audit/_experiments/analyzeShim.ts`) that is a copy of that analyzer **plus** `const corrected = …`. That is the closest runnable stand-in for the intended current design. It is **not** the loadable production module.

### Core question

**Should Flowlary keep investing in the rule-based Decision Engine as linguistic intelligence, or simplify it and move linguistic understanding to an LLM advisor?**

**Evidence-based answer:** keep the **deterministic orchestration / safety / Write Gate**, stop growing the Decision Engine as the bilingual brain, and use an **LLM only as a bounded advisor** on ambiguous cycles. That is option **C**, not A (more rules) and not B (LLM decides / LLM on every keystroke).

The holdout shows both sides:

- **Sentence-length English typed on an Arabic keyboard** can now be remapped locally (sequence layer). That is real progress versus the older lexicon-only story.
- **Isolated unseen words**, **Arabic-on-English unseen**, **generated spelling swaps**, and especially **intentional English inside Arabic** still fail. The last class is a **false-positive auto-write** (garbage remap), which is worse than a miss.

---

## 2. Current Runtime Reality

### Boot (actually executed)

`extension/src/content/startWritingRuntime.ts`:

```
account/settings hydrate
→ establishEngineMode()          // default memory mode becomes enforce
→ InputEngine.start()
→ startShadowEngine()            // observe coordinator
→ startEnforceCoordinator()      // auto path
→ correction / layout / translation feature.start()
→ CommandOrchestrator.start()
→ translation session chip
```

Legacy feature schedulers **still start**. Each returns early when `isEnforceEngineEnabled()` is true (`layout/scheduler.ts`, `correction/scheduler.ts`, `translation/scheduler.ts`). Shortcuts, Speed Box, and explicit English assist **bypass `decideWriting`**.

Speed Box still assigns `input.value` directly (`speedBox.ts`) — it is **not** Write Gate.

### What happens when the user types (enforce)

```
DOM input / keyup (Space, Enter, Tab)
→ InputEngine
    origin USER vs SYSTEM
    noteInputSource(insertFromPaste → paste, …)
    composition flags
    bump generation unless controlled write
    EventBus
→ startEnforceCoordinator
    ignore SYSTEM, composing, cooldown
    runFieldCycle
→ policy: ensure/end TranslationSession from arabicToEnglishMode
→ buildFieldContext (safety, editor tier, policy, mutex, cooldown, inputSource)
→ read whole field + caret
→ prune translated / corrected / override tags
→ detectUserOverride
→ analyzeFieldText (chunks + inferLayoutSpans)     // currently does not compile
→ collectHypotheses
→ candidatesFromHypotheses
→ if shouldConsultAdvisor: consultAdvisor          // unused impl → unavailable
→ decideWriting
→ writing.decision analytics (no raw text)
→ stale generation check
→ action:
    noop → return
    suggestion → card and/or scheduleRemoteEnglishAssist (debounced LLM, no auto write)
    translation → fulfillTranslationDecision (remote, Write Gate, can write)
    layout_fix / english_correction with local replacement → Write Gate
→ cooldown (WRITE_COOLDOWN_MS = 450)
```

This is **what executes**, not the architecture spec.

`decideWriting` never calls an LLM. The advisor, if present, may only **rank existing hypothesis ids**. `validateAdvisorVote` rejects payloads that contain `replacement`, `text`, or `write`.

### Prior audits vs current code

| Prior claim | Current reality |
|---|---|
| Unified audit: enforce only does local layout + tiny spelling; translation has no replacement | Translation **does** call remote APIs through `fulfillTranslationDecision` and **can write**. Remote English is **suggestion-only** in the pipeline. |
| Unified audit: suggestion cards unmounted | `pipelineSuggest.ts` exists and is used. |
| Intent audit: no hypotheses; total-order layout → translation → English | `hypotheses.ts` + `selectedIntent` exist. Decide still prefers a **unique strong layout** winner, then translation, then spelling. |
| Intent audit: `inferLayoutSpans` unused | **Now used** by `analyzeFieldText` and `collectHypotheses`. |
| Intent audit: paste not conservative | `inputSource === 'paste'/'drop'` → `paste_conservative` noop. InputEngine maps `insertFromPaste`. |
| Intent audit: no user override | `FieldSession.detectUserOverride` + `user_override` intent exist. Write Gate calls `noteEngineSpan`. |
| Intent audit: advisor does not exist | Advisor **module exists**, **not wired** to a model. |

---

## 3. Current Decision Engine

**Primary files:** `decide.ts`, `hypotheses.ts`, `chunks.ts`, `layoutSequence.ts`, `candidates.ts`, `advisor.ts`, `contextualSpell.ts`, `technicalTokens.ts`, `arabizi.ts`, `languagePlausibility.ts`, `preserveTokens.ts`, `context.ts`, `flag.ts`.

### What it can infer

| Category | Status | Evidence |
|---|---|---|
| Arabic as Arabic | **PARTIALLY WORKS** | Script → `arabic_prose`. Unknown Arabic is still “prose,” not NER. Isolated unseen Arabic remapped from English keys usually **misses**. |
| English as English | **PARTIALLY WORKS** | Closed lexicon → `english_prose`. Unknown Latin is `unknown` unless a neighbor is Arabic (`intentional_foreign_token`). |
| Mixed Arabic/English | **PARTIALLY WORKS / DANGEROUS** | Roles can coexist. `hasAmbiguousMixed` blocks English auto. Layout sequence can still **auto-write a remap** of Arabic/Latin spans (holdout FP). |
| Wrong keyboard (word, in-lexicon / sequence) | **WORKS** when consecutive votes + plausibility fire (`risk === 'low'`). | |
| Wrong keyboard (isolated unseen word) | **DOES NOT WORK** | Holdout: EN-on-AR unseen singles **0/27** auto-fix. AR-on-EN unseen **1/8**. |
| Partial / one-word layout in an English sentence | **DOES NOT WORK** | `please قثحخقف this` → noop. |
| Sentence-level wrong keyboard | **PARTIALLY WORKS** | EN sentences on Arabic keys: generated holdout **128/128** layout_fix. Critical EN/AR sentences also remapped. Arabic **generated** multi-word unseen: **11/102**. Replacement can drop leading tokens (`I will…` → `will send…`). |
| Spelling (known map) | **PARTIALLY WORKS** | `instantSpell.ts` ~40 entries; `contextualSpell` distance-1 vs English lexicon, first-letter lock, needs English neighbor. |
| Spelling (unseen swaps) | **DOES NOT WORK** | Holdout `ambig_generated_swap` **0/112** corrections (all noop). |
| Grammar | **DOES NOT WORK** in `decideWriting` | Remote grammar is suggestion-only after decide. |
| Technical vocabulary | **PARTIALLY WORKS** | Structural regex (ALL_CAPS, camel, snake, slash stack, version, file ext). Lowercase `deploy`/`error` depend on lexicon or neighbor rules. Unknown products (`FlowlaryX`) correctly noop in the critical set. |
| Unknown vocabulary | **PARTIALLY WORKS** | Prefer preserve/unknown. Isolated layout of unknown words usually abstains; mixed fields can still false-remap. |
| Arabizi | **PARTIALLY WORKS** | Digit marks `2/5/7/9` only (`arabizi.ts`). `inshallah` / `shukran` are **not** Arabizi. Golden set expects them to be — that contract is false. |
| Punctuation / Shift symbols | **PARTIALLY WORKS** | `÷×—–` → `shift_symbol_break`. Sequence can remap punctuation-as-letters. `hello?` noop. `Hello, world!` remapped but `!` dropped. |
| Capitalization | **PARTIALLY WORKS** | No Caps Lock sensor (correct). `UI ux` preserved. Instant spell can copy case. No “intentional casing” model. |
| URLs, emails, code, identifiers | **WORKS** for skip regexes | `tokenKind` + preserve hypotheses. Holdout tech-alone / URL / email / camelCase: no English FP. |
| Names | **DOES NOT WORK** as names | No NER. `Ahmed` is unknown Latin; `أحمد` is Arabic prose. |
| Numbers | **WORKS** | Digit role / skip. |
| User edits after AI | **PARTIALLY WORKS** | Hash of last engine span; override blocks colliding actions. No long-term memory of the span. |
| Paste | **WORKS** (conservative noop) | If `inputType` is paste. |
| Selection | **PARTIALLY WORKS** | Recorded as `unknown` hypothesis; does not change auto-write by itself. |
| Composition | **WORKS** | Coordinator + decide `composing` → noop. |
| Multiple fields | **WORKS** | `FieldSessionRegistry` per element. |
| Mode switching | **PARTIALLY WORKS** | Policy + translation session. Not a linguistic “user switched language” event. |

### Intent vs action

The engine **now has** `WritingIntent` (`write_as_is`, `fix_layout`, `fix_english`, `translate`, `preserve`, `unknown`, `user_override`) separate from `DecisionAction`. That is a real improvement.

It does **not** reliably bind them:

- Observed `نثغ` can still be `fix_layout` + `key` (lexicon remap) **and** `write_as_is` on the same span. Strong layout still wins.
- `design engain` can produce `fix_english` if `suggestSpelling` hits `engine`.
- `ui ux` is preserve — good.
- `أحتاج مراجعة الـ pull request قبل الدمج` was decided as **`layout_fix`** with replacement `Hpjh[ lvh[um hgJ` — intent was treated as keyboard error, action was a **confident wrong write**.

So: the **types** separate intent and action; the **runtime** still collapses to one action with hardcoded score thresholds (`0.8`, `risk === 'low'`).

---

## 4. Current LLM Usage

| Where | Why | Trigger | Input | Writes? | Influences `decideWriting`? |
|---|---|---|---|---|---|
| `consultAdvisor` | Rank hypotheses | `needsLLM` + conflicts | Hypothesis ids/scores/evidence only — **no field text** | No | Only if `setHypothesisAdvisor` is set. **Production: unused.** |
| `fulfillTranslationDecision` | Produce English | Decision `translation` + session | Sentence (placeholders via `planPreservedTranslation`) | **Yes**, via Write Gate | No — called **after** decide |
| `scheduleRemoteEnglishAssist` / `pipelineEnglish.ts` | Grammar/spelling | Suggestion / no local replacement | Segment text | **No** (suggestion card). Shortcut `runExplicitEnglishAssist` **can** write | No |
| `backend/.../correctionProvider.ts` | Groq `openai/gpt-oss-20b` | `/api/ai/correction` | JSON `{ text, fieldType, previousText? }` | Downstream only | No |
| `translationProvider.ts` / Google router | Groq `openai/gpt-oss-120b` or Google | `/api/ai/translation` | Source sentence | Downstream only | No |
| `layoutClassifierProvider.ts` | Groq `allam-2-7b` | `/api/ai/layout-classification` | Token + layouts | No | **No** — legacy `CHECK_WORD` / scheduler, not `decideWriting` |
| Learning coach / report / explanation localize | Product learning, not typing | Dedicated APIs | Learning/explanation payloads | No field write | No |
| Speed Box / dashboard / popup | Manual tools | User click | Box text | Speed Box mutates DOM; others use clients | No |

**Is the LLM used for:**

| Job | In `decideWriting`? | Elsewhere? |
|---|---|---|
| Layout interpretation | No | Legacy classifier only |
| English understanding | No | Suggestion / shortcut correction |
| Grammar | No | Same |
| Translation | No | **Yes, as producer**, can write |
| Intent | Hook exists, **not connected** | No |
| Candidate ranking | Hook exists, **not connected** | No |
| Final decision | **No** | Translation write is post-decision |

Validation: correction uses `validateCorrectionResponse`. Advisor vote uses id allow-list. Translation restore fails closed (`preserve_lost` → noop). Stale: generation + ticket text match. Failures: catch → analytics + noop.

Latency: **not measured in this audit** (no production traces). Remote Groq is hundreds of ms typical; local decide is ~1–2 ms in the holdout loop (2826 decisions in 1.36s including generation).

---

## 5. Generalization Test

**Experiment (labeled, outside production):** `docs/audit/_experiments/`.

| Family | Generated | Split |
|---|---|---|
| Keyboard-layout | 1255 | 50% development / 25% validation / 25% holdout |
| Mixed language | 520 | same |
| Spelling / layout ambiguity | 520 | same |
| Technical / symbol | 520 | same |
| **Total** | **2826** | holdout **715** |

Holdout cases were **not** added to lexicons, golden lists, or `extension/src`.

**Caveats (do not ignore):**

- Shim analyzer (missing `corrected` in production).
- Expected labels are **structural** (mapped via `mapLayout` / `mapLayoutText`), not human-annotated intent.
- “Match” for mixed/tech expects **noop** — a suggestion counts as match for noop-expected rows.
- Translation accuracy **not measured** (no API in the experiment).
- Grammar accuracy **not measured**.
- `deadSequenceLowRiskWhenMissed = 0` is expected: the sequence module **is** the production layout source.

---

## 6. Holdout Results

Source: `docs/audit/_experiments/holdout-results.json`.

| Metric | Holdout |
|---|---|
| Cases | 715 |
| Missed layout (expected `layout_fix`, action ≠ `layout_fix`) | **139** |
| False layout (action `layout_fix`, expected not layout) | **39** |
| False English auto-write | **0** |
| Advisor consult rate (all 2826) | **16.9%** of cycles meet `shouldConsultAdvisor` |

### Layout

| Slice | Holdout n | Auto layout correct | Miss | Notes |
|---|---|---|---|---|
| EN generated multi-word unseen on Arabic keys | 128 | 128 | 0 | Sequence layer generalizes **when many tokens vote together** |
| EN isolated unseen on Arabic keys | 27 | 0 | 27 | Single-token unseen English **abstains** |
| AR generated unseen on English keys | 102 | 11 | 91 | Weak reverse direction |
| AR isolated unseen | 8 | 1 | 7 | |
| Correct English / Arabic as-is | 22+6+8+1 | — | — | Almost all noop; 1 FP on unseen Arabic as-is (7 holdout, 3/45 all-splits) |

### Mixed / technical

| Slice | Holdout | False layout writes |
|---|---|---|
| Arabic frame + tech token | 40 | **8** |
| Generated mixed | 87 | **21** |
| Natural mixed | 3 | **1** |
| Tech in English / Arabic / alone / protected | 35 | 0 |
| Tech generated mixed | 95 | **6** |

### Spelling / ambiguity

| Slice | Holdout | Result |
|---|---|---|
| Generated letter-swap “typos” | 112 | **0** English corrections (all noop) |
| One unseen layout word in English sentence | 13 | **0** layout fixes |
| One in-lex layout word in Arabic sentence | 5 | **5** layout fixes |

### Critical new sentences

| Case | Expected | Actual |
|---|---|---|
| English sentence on Arabic keyboard | layout_fix | **layout_fix** (`will send the report tomorrow` — dropped leading `I`) |
| Arabic sentence on English keyboard | layout_fix | **layout_fix** (`هذا المساء` — partial span) |
| Arabic + intentional English (`pull request`) | noop | **`layout_fix` → `Hpjh[ lvh[um hgJ`** |
| Arabic + technical English (`FastAPI service`) | noop | **`layout_fix` → `hgJ`** |
| English + intentional Arabic | noop | noop |
| One wrong-layout word in English | layout_fix | **noop** |
| English typo inside Arabic | noop | noop |
| Unknown product `FlowlaryX` | noop | noop |
| Punctuation under other layout | layout_fix | layout_fix (dropped `!`) |
| `UI ux` / `hello?` | noop | noop |

**Cannot measure from this run:** English grammar accuracy, translation quality, calibrated confidence, live Chrome latency, real user accept/undo rates.

---

## 7. Failure Analysis

**Dominant false negative:** isolated or Arabic-direction layout of **unseen** words; **one** wrong-layout token in an otherwise English sentence; **all** generated spelling swaps.

**Dominant false positive (more serious):** layout sequence treating **real Arabic plus Latin tech/prose** as a keyboard run and **auto-writing garbage**.

**Secondary:** incomplete sentence remaps (dropped words/punctuation); Arabizi without digits; compile-broken analyzer.

These are **generalization** failures, not missing golden strings.

---

## 8. Rules-Only Architecture

To make the current engine “genuinely strong” as the linguistic brain would require:

- Growing lexicons (does not scale to names, slang, products).
- More sequence / n-gram / neighbor thresholds (already `layoutSequence.ts` + plausibility + technical + Arabizi + roles).
- Special cases for mix, الـ, pull request, FastAPI, punctuation.
- Per-language copies for Turkish/French/Spanish.

**Complexity is already growing.** `extension/src/core/engine/` has **18+ modules**. Branch-like `if` / `else if` counts in that folder are on the order of **~250** (not a rule inventory — a branching signal). Unused or overlapping ideas still appear (legacy layout classifier, leftover golden Arabizi expectations).

**Can this generalize to thousands of unseen writing situations?**  
**No, not as the sole intelligence layer.** Multi-word EN-on-AR is the exception that proves the mechanic: physical remap + sequence voting works **when the whole span is one layout error**. Daily bilingual writing is **not** that. Mix, names, typos vs layout, and new terms are open-ended. More heuristics will add **false positives** (already visible) faster than they add coverage.

Latency of rules-only is excellent. Reliability of **safety rails** is good. Reliability of **linguistic judgment** is not.

---

## 9. LLM-First Architecture

```
USER INPUT → FAST LOCAL SAFETY → LLM INTENT → STRUCTURED DECISION → POLICY → WRITE GATE
```

| Dimension | Assessment |
|---|---|
| Accuracy | **Likely higher** on mix, names, unseen spelling, sentence meaning. **Not measured** here. |
| Generalization | Strongest of the three for language. |
| Latency | Bad if every `input` event (enforce already fires that often). Acceptable after sentence/ambiguity. |
| Cost | Scales with calls × tokens. No usage telemetry — **UNKNOWN** at fleet scale. |
| Privacy | Field text leaves the browser. Worse than rules-only. |
| Failure modes | Timeout, hallucination, stale reply, rate limit. Must fail to noop. |
| Predictability | Weaker than mapLayout. |
| Debuggability | Weaker unless structured I/O + logs without raw text. |
| Scalability (languages) | Best. |
| Safety | Only if LLM **cannot** write and **cannot** invent replacements for layout. |

LLM-first **without** the current Write Gate / policy / composition / paste / override would be **unsafe**. The interesting LLM-first is really **B-with-C’s rails** — at that point it is hybrid.

---

## 10. Hybrid Architecture

```
FAST LOCAL DETERMINISTIC LAYER
→ HYPOTHESIS GENERATION (including mapLayout candidates)
→ LLM ONLY WHEN AMBIGUOUS / CONFLICTING
→ POLICY GUARD
→ WRITE GATE
```

This is **the architecture the code already sketches**. It is **not** what production runs (advisor unused; layout still auto-writes on mixed FP).

Is hybrid automatically better than A and B?

- **Better than A** for mix, unseen spelling, one-word layout, names — **if** the advisor is actually called and **if** layout auto-write is forbidden when hypotheses conflict or Arabic prose + Latin coexist.
- **Better than B** for latency, cost, privacy, and mechanical remaps that the sequence layer already gets right (128/128 EN multi-word holdout) **without** a network hop.
- **Worse than either** if we keep **both** a growing heuristic pile **and** an unconstrained LLM writer.

Hybrid is better **only if** the Decision Engine is **reduced** to orchestrator/policy/validator and **stops** treating uncalibrated `heuristicScore >= 0.72` as bilingual understanding.

---

## 11. Intent vs Action

Should they be separated? **Yes.** The types already do. The runtime often does not.

Examples from the brief:

| Observed | Plausible intent | Plausible action | Current |
|---|---|---|---|
| نثغ | English “key” | layout | Often works (lexicon) |
| design engain | English sentence | English correction | Works if `engine` is the unique distance-1 hit |
| ui ux | Intentional tech | preserve | Works |
| pull request in Arabic sentence | Intentional English | preserve | **Failed** — layout write |

---

## 12. False Positives

| Class | Evidence |
|---|---|
| Wrong layout correction | Holdout **39** on 715; critical mixed sentences **wrote garbage** |
| Wrong English correction | Holdout **0** auto English FP |
| Wrong translation | **Not measured** |
| Technical / names / code / URL / email | Mostly preserved when isolated; **corrupted** when sequence remap hits mixed Arabic (`الـ`, `service`) |
| Mixed language | **Dominant FP class** |
| Unwanted capitalization / punctuation | Partial drops (`!`, leading `I`) on “successful” remaps |

The product constraint is correct: **NOOP > confidently wrong auto modification.** The current unique-strong-layout path **violates** that on mixed fields.

---

## 13. False Negatives

| Class | Evidence |
|---|---|
| Missed isolated / AR-direction / single-word-in-English layout | 139 holdout misses; 13/13 one-word-in-English |
| Missed English spelling | 112/112 generated swaps |
| Missed translation | Not measured; translation is mode-gated, not inferred |
| Missed mixed interpretation | System often noops English (good) but **wrongly acts** on layout |
| Missed technical correction | Unknown products correctly left alone |

**Dominant error type depends on the slice:**  
- Pure wrong-keyboard sentences: **FN on Arabic-direction and singles**, **TP on EN sequences**.  
- Daily bilingual: **FP layout** is the user-visible disaster.

---

## 14. Latency

| Design | Local | Remote |
|---|---|---|
| Current decide (no advisor) | ~sub-ms to few ms | 0 |
| Current translation write | + RTT | Groq/Google |
| Current English suggestion | + debounce + RTT | Groq |
| LLM every keystroke | Enforce already runs every `input` | **Unacceptable** (IME, mobile, cost, flicker) |
| LLM after debounce | Similar to current English assist | Plausible |
| LLM after word boundary | Fewer calls | Misses mid-word layout |
| LLM after sentence | Fewest | Late for layout-as-you-type |
| LLM only when `shouldConsultAdvisor` | ~17% of **this** synthetic mix | Best default |
| LLM only on shortcut | Lowest | Weak “just write” UX |

**Recommend:** LLM **only when ambiguity exists** (and optionally sentence-final English polish as today’s suggestion). **Do not** call on every keystroke.

---

## 15. Cost

**Actual usage statistics: unavailable.** Analytics record action/reason codes, not request volume or tokens.

Conceptual only:

- Every keystroke × Groq 20B/120B: unbounded; incompatible with enforce-on-input.
- Every sentence: order-of-magnitude fewer; still continuous if users type long chats.
- Ambiguous-only: bounded by conflict rate. Synthetic consult rate ~17% is **not** a production rate.

Do not invent user counts.

---

## 16. Privacy

| Architecture | What leaves the browser |
|---|---|
| Rules-only | Nothing for decide/layout/spell. Translation/correction still leave if those features are on. |
| LLM-first | Essentially all assisted text |
| Hybrid | Only spans that are ambiguous; advisor packet today is **ids/scores only** (good). A useful linguistic advisor will need **span text**, not just ids. |

Can only the relevant span be sent? **Yes.**  
Can protected tokens be stripped? **Yes** (`planPreservedTranslation` already placeholders).  
Can code/URL/email be blocked? **Yes** (already skipped locally).  
Risk: residual PII in the remaining span; logging; provider retention.

---

## 17. Safety

| Failure | Rules | LLM-first | Hybrid (advisor) |
|---|---|---|---|
| LLM unavailable | N/A | Must noop / local only | **Already coded:** `advisor_unavailable` → noop on conflict |
| Network / timeout | Local still works | Dead | Local mechanical path + noop on conflict |
| Invalid response | N/A | Reject | `validateAdvisorVote` → invalid → noop |
| Rate limit | N/A | Fail | Same as unavailable |
| Hallucinated replacement | N/A | High if LLM writes | **Forbidden** if vote cannot carry `replacement` |

Write Gate, mutex, generation, cooldown, editor tier 1-only auto-write, password/code-editor safety, paste conservative: **must remain** in all options.

---

## 18. Scalability

New languages (TR/FR/ES), domains, slang, products: **LLM generalizes; closed lexicons do not.**  
Keyboard tables remain **local and necessary** (physical remap is not an LLM job).  
Code/names: local skip + LLM “preserve” vote.

**Best generalization:** hybrid with LLM on linguistic ambiguity; **not** more `en-words.ts` / `ar-words.ts`.

---

## 19. Personalization

Current extension points (do not implement here):

- `inExceptionList` / `vocabularyHashes` on analysis
- Layout profile exceptions (legacy scheduler; not the main decide path)
- `user_override` ranges (session-scoped)
- Learning event stores (separate product)

Rules-only can learn hashed accept/undo. LLM-first can too, at higher privacy cost. Hybrid can attach personal vocab as **evidence** on hypotheses.

---

## 20. Decision Complexity

Interacting dimensions include language, layout, chunk role, neighbors, mode, policy, field type, technical shape, punctuation, capitalization, spelling vs remap, translation session, timing, paste, composition, selection, override, editor tier.

Rule-based branching is **combinatorial**: each new language pair × mix × tech × typo vs layout multiplies special cases. That is already visible in `hasAmbiguousMixed` vs `layoutSpans` vs `needsLLM` vs score cutoffs **disagreeing** (mix should noop English **and** still auto-laid-out).

---

## 21. Architecture Comparison

Scores only where this audit has evidence. Otherwise **UNKNOWN**.

| Criterion | Rules Decision Engine | LLM-first | Hybrid |
|---|---|---|---|
| Accuracy | Mixed (strong EN sequence; weak singles/AR/mix FP) | UNKNOWN (likely higher on language) | UNKNOWN until advisor ships; **best expected** if FP layout is gated |
| Generalization | Poor on unseen singles/spelling; good on EN sequences | High (language) | High if LLM used; local keeps mechanical wins |
| Mixed language | **Poor** (FP writes) | UNKNOWN | **Best expected** if mix ⇒ no auto layout without advisor |
| Keyboard inference | Partial | UNKNOWN | Local map + LLM disambiguation |
| Spelling/grammar | Poor local; remote suggestion unused by decide | UNKNOWN | Local tiny + remote/LLM |
| Technical language | Partial (regex) | UNKNOWN | Local preserve + LLM |
| Latency | **Good** | Poor if frequent | Good if rare LLM |
| Cost | **Good** | Poor if frequent | Medium |
| Privacy | **Best** | Worst | Medium (span-only) |
| Safety | Good rails; **bad FP writes** | Unsafe if LLM writes | **Best** if LLM cannot write |
| Debuggability | Good (reason codes) | Poor | Medium |
| Maintainability | **Worsening** | Prompt/ops burden | Better if rules shrink |
| Scalability | Poor | Good | **Good** |
| Personalization | Extension points unused | UNKNOWN | Extension points exist |
| Offline fallback | **Best** | Worst | Local mechanical + noop |

---

## 22. Recommendation

**C — Hybrid: simplify the Decision Engine into orchestration/policy/validation; use an LLM for linguistic intelligence on ambiguous cases only.**

Not A: holdout + mixed FP show rules will not cover daily bilingual writing without more dangerous heuristics.  
Not B: LLM-on-input is incompatible with enforce-on-keystroke, privacy, and the already-good mechanical sequence remaps.  
Not D as the **architecture** choice: we already have enough failure-class evidence. D remains true for **fleet cost/latency numbers** only.

---

## 23. Proposed Target Architecture

```
InputEngine (composition, paste, generation)
→ local tokenize / protect / mapLayout candidates / sequence votes
→ hypotheses (intent + optional local replacement)
→ if unique low-risk mechanical layout AND no real Arabic+Latin coexistence
      → policy → Write Gate
→ else if unique tiny known typo AND no layout suspicion
      → policy → Write Gate
→ else if shouldConsultAdvisor
      → LLM ranks hypothesis ids (or abstains)
      → validate vote
      → policy (helpStyle, mix, override)
      → Write Gate or suggestion
→ else NOOP
Translation / grammar models remain PRODUCERS after intent is chosen.
```

### If implementing LLM advisor (not in this audit)

**LLM should understand:** which local hypothesis matches user intent (layout vs English vs preserve vs translate vs write-as-is).

**Remains deterministic:** field state, protected fields, composition, translation **mode**, policy, stale generation, Write Gate, cooldown, action validation, editor compatibility, `mapLayout` candidate production, token skips.

**When to call:** `needsLLM` or conflicting candidate actions or `hasAmbiguousMixed` / single-token layout. **Never** every keystroke.

**Context:** ambiguous **spans** only; strip URL/email/code; no full-field dump by default.

**Allowed to return:** ordered hypothesis ids + reason + ambiguity class. Optional: `abstain`.

**Forbidden:** replacement text, write commands, new actions, DOM, bypassing Write Gate.

**Validation:** known ids, no extra write fields, optional agreement with local scores.

**Low confidence / invalid / timeout / unavailable:** **NOOP** or suggestion — never auto-write.

**Stale:** abort if generation or span text changed (same as translation/English pipeline).

**Write Gate:** only writer for auto path. Advisor never imports `writeReplacement`.

---

## 24. Migration Risk

| Risk | Why |
|---|---|
| Leaving unique-strong-layout auto-write on mixed fields | Users already lose text (holdout critical cases) |
| Wiring advisor that sends full fields | Privacy + cost |
| Letting translation LLM keep rewriting mixed sentences | `preserveTokens` helps but decide must not choose blob translate on mix (`mixed_spans_no_blob_translate` exists — keep it) |
| Adding more golden words instead of shrinking rules | Confirms option A failure mode |
| Shipping while `chunks.ts` does not compile | Enforce path cannot load |
| Dual writers (legacy scheduler + enforce) if flag flips | Known boot residual |

---

## 25. Remaining Unknowns

- Production keystroke / sentence / ambiguity rates
- Real accept / dismiss / undo rates
- Advisor accuracy if implemented
- Translation quality on mixed placeholder payloads
- Whether sequence EN-on-AR 128/128 holds on real IME / contenteditable
- Turkish/French/Spanish (not tested)
- Live latency of Groq from the extension

---

## Final questions

1. **Is the current Decision Engine actually intelligent enough?**  
   No. It is a strong **mechanical remapper** for some sequence cases and a weak **intent** model.

2. **How much of its behavior is hard-coded heuristics?**  
   Essentially all local intelligence: lexicons, n-grams, regex roles, score cutoffs, Arabizi digits, typo map, `shouldConsultAdvisor` counts.

3. **How well does it generalize to unseen cases?**  
   Well for **multi-word English-on-Arabic**. Poor for isolated words, Arabic-on-English, spelling, and mixed intent.

4. **Can it understand sentence-level keyboard-layout errors?**  
   **Partially.** EN-on-AR sentences often yes; incomplete spans and Arabic-on-EN generated sentences often no.

5. **Can it understand mixed Arabic/English naturally?**  
   **No.** It can label roles and then **auto-corrupt** the field.

6. **Can it distinguish keyboard errors from English spelling errors?**  
   **Only in easy cases.** Generated swaps never became English corrections. Layout suspicion blocks English. One-word layout in English missed.

7. **Can it handle unknown technical words?**  
   **Isolated: usually preserve. In Arabic sentences: sometimes false layout.**

8. **Is the current Decision Engine becoming unnecessarily complex?**  
   **Yes.** Many modules, overlapping evidence, unused advisor, compile breakage, stale audits.

9. **Would an LLM improve intent understanding materially?**  
   **Yes, for mix / names / unseen typos / one-word layout** — that is the failure class. Not proven with a live advisor.

10. **Should the LLM participate in final decision making?**  
    **No as judge.** Yes as **ranker of local hypotheses**. Policy + Write Gate decide.

11. **Should the current Decision Engine remain as a linguistic brain?**  
    **No.**

12. **Could it become a lightweight orchestrator/policy/validator?**  
    **Yes.** Most of that already exists (`FieldSession`, policy, Write Gate, advisor validation).

13. **Safest LLM architecture?**  
    Advisor, structured vote, no replacements, fail-closed, span-only, never on every keystroke.

14. **What should remain deterministic?**  
    Everything in §23 “Remains deterministic.”

15. **Low LLM confidence?**  
    NOOP or visible suggestion.

16. **LLM unavailable?**  
    Local unique mechanical layout **only if mix-safe**; otherwise NOOP. Translation/grammar already fail closed.

17. **Best expected real-world accuracy?**  
    **Hybrid C**, after mixed-field auto-layout is disabled.

18. **What should we implement NEXT?**  
    Repair the analyzer compile error; **forbid auto `layout_fix` when real Arabic and unexplained Latin coexist** unless a validated advisor picks a layout hypothesis; register a **span-limited advisor** behind a flag. Do **not** add more lexicon examples. Do **not** call LLM on every input.

---

## FINAL VERDICT

RECOMMENDED ARCHITECTURE:  
**C**

CONFIDENCE IN RECOMMENDATION:  
**MEDIUM**

WHY:  
The runnable holdout and the current code agree: mechanical sequence remaps can fix some unseen English-on-Arabic sentences, but the engine is not a bilingual intent model. It already grows heuristic modules, already has an unused advisor contract, and already **auto-writes garbage** on realistic mixed Arabic+English. An LLM-first writer would add cost/privacy/latency without replacing Write Gate. Rules-only will not cover thousands of mix/name/typo situations. Hybrid — **if** the engine shrinks to policy/orchestration — is the only option consistent with both the failure modes and the safety requirements.

TOP 5 EVIDENCE POINTS:  
1. Holdout **39** false layout auto-writes; critical `pull request` / `FastAPI service` sentences remapped to **`Hpjh[ lvh[um hgJ`** / **`hgJ`**.  
2. Holdout **0/27** isolated unseen EN-on-AR fixes; **0/112** generated spelling fixes; **0/13** one-wrong-word-in-English fixes.  
3. Holdout **128/128** generated multi-word EN-on-AR layout_fix — local sequence inference is worth keeping, not replacing.  
4. `setHypothesisAdvisor` is **null** in production; `consultAdvisor` already fail-closes; `validateAdvisorVote` already forbids replacements.  
5. `chunks.ts` currently **does not compile**; engine folder branching is already large; prior audits are stale within a day of new modules.

TOP 5 RISKS:  
1. Shipping mixed-field layout auto-write (data loss).  
2. Calling an LLM on every enforce `input`.  
3. Letting any LLM emit replacement text or skip Write Gate.  
4. Continuing to patch generalization with more golden words and thresholds.  
5. No production volume data — cost/latency of even “ambiguous-only” is UNKNOWN.

NEXT STEP:  
**Do not add features in this audit.** Next implementation (separate change): make the analyzer load; treat Arabic+Latin coexistence as **not** auto-layout; wire a flagged, validated, span-limited hypothesis advisor; keep Write Gate as the only auto writer.
