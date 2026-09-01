# Hypothesis Generation 2.0 Report

**DATE:** 2026-08-31  
**SCOPE:** General local candidate generation for unseen keyboard remaps and mixed spans.  
**NOT IN SCOPE:** New LLM writer, UI, translation redesign, second Decision Engine, auto-write relaxation.

---

## 1. Current architecture

Unchanged pipeline:

Local analysis (`analyzeFieldText`)  
→ hypotheses (`collectHypotheses`)  
→ optional LLM advisor (rank IDs only)  
→ `decideWriting` / Policy  
→ Write Gate

This phase changed **how layout spans and hypotheses are produced**, not who writes.

---

## 2. Current failure mechanism

Observed remapped text often **looked like valid Arabic or English**.

Then:

- `layoutSuspicion = none`
- `inferLayoutSpans` emitted nothing
- `collectHypotheses` had no `fix_layout`
- advisor unused
- correct interpretation missed

Advisor-phase holdout (same generator family, N=625): **68.96%** action accuracy, **194** layout false negatives. The advisor could not recover missing IDs.

---

## 3. Root cause

Inspected, not guessed:

1. **Token vote required lexicon or very low as-is Arabic** (`asIsAr < 0.28` plus `lexiconEn` or `mappedEnScore >= 0.6`). Remapped unseen English is Arabic-script n-gram soup with `asIsAr` often ≥ 0.28, so the vote was `as_is`.
2. **A second force-`as_is`** when `asIsAr >= 0.28` and the mapped token was not an English lexicon/technical word. That is a **lexicon gate on candidate existence**.
3. **Chunk roles** refused `possible_layout_error` for Arabic-only tokens unless `tokenMapsToEnglish` (lexicon/technical). Unseen remaps stayed `arabic_prose`.
4. **`collectHypotheses` dropped** layout spans when every covered chunk was `arabic_prose` with `layoutSuspicion === none` (the usual outcome of 1–3).
5. Isolated short remaps were intentionally weak (still correct for auto-write).

Lexicons were used as **existence gates**, not evidence.

---

## 4. New hypothesis generation architecture

Keyboard mapping remains the only replacement operator (`mapLayout` / `mapLayoutText`).

New local signals:

- **Structural remap:** high mapping coverage + script flip + mapped ≠ observed + not a confirmed lexicon word of the *observed* language.
- **Comparative vote:** mapped *target quality* beats as-is plausibility by a margin, or mapped lexicon hit.
- **Sequence run:** two or more same-direction structural tokens whose **mean mapped quality > mean as-is + 0.08**.
- **Target quality:** English/Arabic plausibility of the mapped string, minus junk glyphs (`]`, leftover Latin in Arabic maps) and a cap on 1–3 letter maps. This stops garbage `Hvd]` from beating real Arabic.
- **Confirmed as-is:** lexicon word of the observed script, or high as-is Arabic without a mapped-English lexicon win. Sequence growth **stops** at confirmed as-is / protected.
- **Mixed-neighbor risk:** a layout span next to confirmed opposite-language as-is is **high risk** (candidate may exist; auto-write must not).
- **Dedup** of identical span+intent+replacement hypotheses; evidence merged.

Auto-write still requires unique **low-risk** layout, `mixedLayoutSafety`, and Write Gate. No threshold was lowered to force more writes.

---

## 5. Character evidence

Existing: mapping coverage, script ratios, punctuation/whitespace copied through `buildSpanReplacement`.

Added: junk-glyph penalty and short-map quality cap on the **mapped** side only.

Punctuation-only tokens stay `neutral` and cannot seed a span.

---

## 6. Word evidence

- Lexicon hit on **observed** text → confirmed as-is (not a layout seed).
- Lexicon hit on **mapped** text → bonus / vote support.
- Dictionary miss ≠ “not layout.” Sequence + coverage can still emit a candidate.
- Edit-distance spelling still separate; contextual spell is no longer fully suppressed when layout suspicion exists if distance is 1.

---

## 7. Sequence evidence

Runs grow through `neutral` (spaces/punct) and same-direction structural tokens. They do **not** swallow confirmed as-is prose or protected tokens.

A second pass emits a span when ≥2 structural tokens share a direction and mapped quality wins on average.

`scoreSpan` still uses coverage, mapped plausibility, as-is, lexicon bonus, neighbor boost, consecutive count. Low risk now also requires `plausibility > asIs + 0.08` and `asIs <= 0.48`.

---

## 8. Span segmentation

Spans are token-index runs, not whole-field blobs. Partial remaps can exist beside intentional English/Arabic/technical tokens. Growing into confirmed as-is was removed (that previously over-consumed mixed fields).

---

## 9. Mixed-language handling

`mixedLayoutSafety` is unchanged and still the auto-write veto.

Additional: mixed-neighbor → high risk so a *partial* Arabic-looking run next to real English does not unique-strong auto-write.

Holdout mix auto-write risk: **0**.

---

## 10. Technical-token handling

Structural remap is false for `isTechnicalToken` / `isStructuralTechnicalToken` on Latin. Protected kinds still vote `protected`. Unknown tech in an Arabic frame does not have to be in a dictionary; surrounding layout runs stop at that token.

---

## 11. Spelling / layout ambiguity

Independent hypotheses can coexist (preserve, spelling, layout). Contextual spelling is only skipped under layout suspicion when edit distance > 1. Decision/advisor still choose.

---

## 12. Short-token handling

Length ≤ 3 mapped targets have quality capped. Isolated short remaps remain **high/medium risk** (`needsLLM` / no unique-strong). Candidates may exist; auto-write should not.

---

## 13. Punctuation

Used as glue in a run, not as a seed. Symbol-only fields still noop (foundation + generalization tests).

---

## 14. Protected content

URL / email / jwt / identifiers still skip layout votes. Holdout **protected layout hyps: 0**.

---

## 15. Arabizi

Unchanged local detector. Arabizi role still gets write-as-is; it does not delete neighbor layout spans.

---

## 16. User override

Covered override / exception chunks still skip layout hypothesis emission. No new personalization.

---

## 17. Deduplication

`dedupeHypotheses` keys: `start:end:intent:action:replacement`. Evidence lists merge; max score kept.

Layout spans also skip identical `range+direction+replacement`.

---

## 18. Candidate precision

**Holdout: 96.07%**  
(layout-gold hits / (hits + false layout-on-preserve))

Development 96.85%, validation 96.32%.

25 false layout *candidates* on preserve-gold holdout rows (adversarial random strings / some spelling-preserve). **Not** an auto-write explosion: mix auto-write risk 0; advisor-holdout layout **FP actions: 0**.

Precision did **not** collapse.

---

## 19. Candidate recall

**Holdout layout-candidate recall: 100%** (layout-gold rows).

Same on development and validation.

Pre-change, this exact 5400-case candidate harness did not exist. Proxy: advisor-phase holdout **194 layout action FNs / 625** and documented missing `fix_layout` IDs. Post-change same advisor holdout: **86 FN**, action accuracy **86.24%**.

---

## 20. Generated test methodology

`tests/unit/writing-engine/hypothesis-generation-v2.eval.test.ts` (not imported by the app):

| Family | N |
| --- | --- |
| Keyboard-layout (unseen/in-lex EN↔AR sentences) | 2000 |
| Mixed Arabic + technical/Latin | 1000 |
| Spelling vs remapped token | 1000 |
| Technical / symbol | 1000 |
| Adversarial random Latin/Arabic | 400 |
| **Total** | **5400** |

Seed `20260831`. Split 50/25/25 per family.

---

## 21. Development / validation / holdout

Thresholds were adjusted on **safety regressions** (real Arabic must not auto-remap; `أحمد` stays prose; foundation mix). Holdout was scored after those freezes.

| Split | N | Layout recall | Precision | Avg hyps |
| --- | --- | --- | --- | --- |
| Development | 2700 | 100% | 96.85% | 3.39 |
| Validation | 1350 | 100% | 96.32% | 3.38 |
| Holdout | 1350 | 100% | 96.07% | 3.39 |

---

## 22. Holdout results

- Layout candidate recall: **100%**
- Candidate precision: **96.07%**
- False layout-on-preserve candidates: **25**
- Mix auto-write risk: **0**
- Protected layout hyps: **0**
- Mean hypotheses / cycle: **3.39**
- Mean analysis+collect: **0.434 ms**

Advisor-holdout *actions* (separate suite): **86.24%** vs previous **68.96%**.

---

## 23. Baseline comparison

| Metric | Before (advisor phase) | After v2 |
| --- | --- | --- |
| Action accuracy (advisor holdout N=625) | 68.96% | 86.24% |
| Layout action FN | 194 | 86 |
| Layout action FP | 0 | 0 |
| Layout candidate recall (5400-case holdout) | not instrumented; often 0 for unseen remaps | 100% |
| Candidate precision (same) | n/a | 96.07% |
| LLM invocation | 1.76% | 1.12% |

Improvement is **candidate existence + safer scoring**, not more advisor calls. Strong mechanical sequences now skip the LLM (as designed).

---

## 24. Performance

Local only. No network in analysis. Holdout ~0.43 ms/cycle. **PASS.**

---

## 25. Regression results

```bash
cd extension && npm run test -- ../tests/unit/writing-engine/
cd extension && npm run test -- ../tests/unit/fieldSession.test.ts ../tests/unit/layout/
```

- writing-engine **195/195**
- foundation-safety **25/25**
- advisor layer + holdout pass
- fieldSession + layout **99/99**

Chrome manual battery **not run** this session.

---

## 26. Remaining failures

- Isolated / very short remaps: candidate may exist or still be weak; auto-write correctly abstains.
- 25 preserve-gold rows still grow a layout *candidate* (mostly adversarial random). Decision stays conservative (0 layout FP on advisor holdout).
- Real Groq ranking still unmeasured.
- Whole-sentence remaps of *lexicon-poor* Arabic that also remap to clean Latin remain a theoretical FP class; junk-quality + as-is confirmation blocked the known Arabic sentence regression (`أريد إرسال…`).

---

## 27. Overfitting check

Grep of `extension/src/core/engine` for `نثغ`, `higdk`, `design engain`, `pull request`, `FastAPI`, `ui ux`: **no hits**.

No new word lists. No example `if token ===`.

---

## 28. Files changed

- `extension/src/core/engine/layoutSequence.ts` — structural votes, target quality, sequence pass, mixed-neighbor risk, span dedup
- `extension/src/core/engine/chunks.ts` — `possible_layout_error` no longer requires mapped lexicon English
- `extension/src/core/engine/hypotheses.ts` — narrower prose skip, hyp dedup, spelling coexistence
- `tests/unit/writing-engine/hypothesis-generation-v2.eval.test.ts`
- `docs/audit/HYPOTHESIS_GENERATION_V2_REPORT.md`

---

## 29. Recommended next phase

Run the **already-registered advisor in shadow** against live Groq on unseen remaps that are now `needsLLM` / conflicting. Do not invent candidates in the model. Do not start UI.

---

## Required answers

1. **Why were correct layout hypotheses missing?** Lexicon-gated votes + force-`as_is` on moderate Arabic n-grams + role/hypothesis filters that required a mapped English dictionary hit.

2. **Unseen transformed text?** Yes — holdout layout-candidate recall 100% on generated unseen remaps.

3. **Sentence-level?** Yes, via same-direction sequence runs (both EN-on-AR and AR-on-EN).

4. **Partial transformations?** Yes; runs stop at confirmed as-is / protected / technical.

5. **Mixed without whole-field language?** Yes; mix veto unchanged; mix auto-write risk 0.

6. **Technical tokens separate?** Yes; structural Latin tech does not seed layout; protected 0.

7. **Generation vs write?** Yes. High-risk / mix-unsafe / short candidates do not unique-strong write.

8. **Did candidate recall improve?** Yes (100% on this holdout; action FN 194→86 on the advisor suite).

9. **Did precision degrade?** No collapse: 96.07% candidate precision; 0 layout action FP.

10. **Candidates per cycle?** **3.39** mean hypotheses.

11. **Performance?** **0.43 ms** mean; PASS.

12. **Safety regression?** Foundation, mix, translation-off, protected, paste, composition: **pass**.

13. **Better advisor input?** **YES** — `fix_layout` IDs now exist for unseen remaps. Consult rate dropped because many sequences are strong/local.

14. **General mechanisms vs special cases?** All of the gain is coverage / quality / sequence / role-gate removal. Overfitting grep clean.

15. **Unseen failures left?** Short isolates; some adversarial false *candidates*; live LLM rank unknown; Chrome E2E not run.

---

HYPOTHESIS GENERATION V2:  
**READY**

CORRECT-HYPOTHESIS RECALL:  
**100%** (layout-gold holdout N≈ layout share of 1350)

CANDIDATE PRECISION:  
**96.07%**

LAYOUT RECALL:  
**100%**

MIXED-LANGUAGE SAFETY:  
**PASS**

PROTECTED CONTENT:  
**PASS**

WHOLE-SPAN LAYOUT:  
**PASS**

OVERFITTING:  
**PASS**

PERFORMANCE:  
**PASS**

HOLDOUT:  
**layout recall 100% / precision 96.07% / action accuracy (advisor suite) 86.24% vs 68.96% prior**

LLM ADVISOR NOW HAS BETTER INPUT:  
**YES**

GENERALIZATION:  
**IMPROVED**

REMAINING BLOCKERS:  
Live Groq shadow eval not run; Chrome manual battery not run; isolated-token auto-write still conservative by design.

NEXT STEP:  
Shadow-evaluate the existing hypothesis advisor on live Groq using these new local candidates; do not let the model invent replacements.
