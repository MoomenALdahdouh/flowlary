# Intent Generalization Implementation Report

**DATE:** 2026-08-31  
**REPOSITORY:** `/Users/moomen/Projects/flowlary`  
**SCOPE:** General bilingual keyboard-layout and intent mechanism. No example-specific production rules.

---

## 1. Previous architecture

The writing path already had Architecture B pieces: shared chunks, span hypotheses, optional LLM advisor, policy, Write Gate.

Layout commit was still **token-by-token lexicon matching**. `confidentArabicMismatch` / `isArabicWord` / `isEnglishWord` were the real gates. A sequence typed on the wrong keyboard that did not hit the tiny closed lexicons was missed. Mixed fields still froze English globally. Technical terms were a **word list**. Arabizi was a **word list**. Contextual spelling included a **hand-picked neighbor list**.

Confidence numbers were heuristic constants, not measured probabilities.

---

## 2. New architecture

```
tokenize (one observation)
  → bidirectional physical-key transform (mapLayout / mapLayoutText)
  → per-token votes (as_is | en_on_ar | ar_on_en | protected | neutral)
  → neighbor demote / sequence merge
  → language-plausibility + coverage + consecutive-agreement scores
  → hypotheses (layout spans, spelling, preserve, translate, override)
  → LLM advisor only if write-hypotheses conflict
  → decideWriting (one action)
  → policy + Write Gate
```

The keyboard map is a **transform**. Detection is **evidence comparison**, not “known wrong words.”

---

## 3. Hypothesis generation

`collectHypotheses` emits only locally generated interpretations:

| Intent | Replacement source |
|---|---|
| `fix_layout` | `mapLayout` / sequence remap of a span |
| `fix_english` | instant typo map or edit-distance-1 vs English lexicon |
| `translate` | session + completed Arabic sentence (no blob rewrite of unknown Latin) |
| `preserve` / `write_as_is` / `user_override` / `unknown` | none |

Conflicts are linked by overlapping spans. The advisor cannot invent a new hypothesis ID or a replacement string.

---

## 4. Span detection

Chunks are still tokenizer-backed, but **roles emerge from evidence**:

- protected / URL / email / identifier / number
- possible layout error (only if a post-demote layout span covers the token)
- structural technical token
- paired two-letter Latin (shape, not a vocabulary)
- title-case name/product shape
- intentional Latin beside Arabic when remap-to-Arabic is weak
- Arabic / English prose
- conservative Arabizi
- unknown

A field is **not** one language. Mixed = real Arabic prose **and** unexplained Latin, not “any Latin + any Arabic including layout.”

---

## 5. Layout inference

`layoutSequence.ts`:

1. Prefer the tokenizer **raw** form when QWERTY punctuation is an Arabic letter (`[ ] ' ; , . / \``).
2. Transform EN→AR and AR→EN. Coverage is the fraction of physical keys that mapped.
3. Score the **observed** string and the **candidate** with n-gram / morphology heuristics (`languagePlausibility.ts`). Lexicon hits are a **bonus**, not a requirement.
4. Merge consecutive tokens that share a direction, keeping already-correct target-script neighbors inside the span.
5. Score the run: coverage, plausibility, consecutive count, neighbor agreement, lexicon bonus, as-is penalty.
6. Isolated length ≤ 2 never auto-writes. Isolated length 3 usually abstains. Two or more agreeing tokens can auto-write when risk is `low`.

Symbols-only strings never start a layout span.

---

## 6. Mixed-language handling

- Intentional English / unknown Latin beside Arabic is a **preserve** span when the remap is weak.
- Layout applies only to layout spans, not the whole field.
- English correction is no longer blocked by an unrelated layout span elsewhere in the field. A **strong sequence** overlapping the spelling span still wins.
- Translation of a mixed sentence with unknown Latin is `noop` (`mixed_spans_no_blob_translate`), not a whole-field rewrite.

---

## 7. Technical-token handling

Structural only:

- ALL_CAPS 2–8
- camelCase / PascalCase / snake_case
- `A/B` short slash stacks
- `localhost` + port
- versionish / file-extension shapes

There is **no** production list of `deploy`, `npm`, `graphql`, `ui`, `ux`, etc. Unknown lowercase tech next to Arabic is usually `intentional_foreign_token` or `unknown`, not a keyboard error.

---

## 8. Symbol handling

- Letters, digits, Shift glyphs, and Arabic-letter QWERTY punctuation participate in the **physical** map.
- Isolated `+++`, `***`, `???` are evidence only → `noop`.
- Shift math/dash glyphs remain hard breaks (`÷×—–`).

---

## 9. Spelling vs layout

Both hypotheses can exist on one token.

- Known instant typos (`teh`, `dont`, …) generate `fix_english` even if a weak layout vote exists.
- Unknown tokens (`engain`) do **not** get a memorized `engine` replacement. Edit-distance-1 against the existing English lexicon may suggest a neighbor; otherwise the engine abstains.
- A low-risk **multi-token** layout sequence overlapping the token suppresses auto English.

`hwo` vs layout is the same comparison — not `if (text === "hwo")`.

---

## 10. Arabizi handling

Conservative: digit-substitution (`2/5/7/9` inside letters). Trailing-digit identifiers (`agent007`) are not Arabizi. Digit-less transliteration (`inshallah`) is **unknown**, not a word list. Action remains `noop` unless an explicit command exists.

---

## 11. User override

`FieldSession.noteEngineSpan` + `detectUserOverride` still hash the last engine span. Overlapping chunks become `user_override`. Decide returns `noop` and does not re-apply the same write.

`writingFeedback.ts` is the daily-learning extension point: **hashed / metadata only**, ring buffer, no raw field text.

---

## 12. LLM advisor

Unchanged contract: ranks **local** hypothesis IDs. Validates schema. Rejects `replacement` / `text` / `write`. Does not write the DOM.

---

## 13. LLM invocation policy

`shouldConsultAdvisor` returns false when a **low-risk sequence layout** exists and there is no rival write hypothesis.

Not called for: password/URL/email/protected, clear mechanical sequence layout, explicit translation session, obvious noop, paste, composing.

Called only when ≥2 write hypotheses conflict or multiple `needsLLM` flags are set.

---

## 14. Safety policy

Protected token kinds, code-editor tier 4, passwords, paste, composing, mutex, cooldown, user override, short isolated remaps, and high uncertainty all resolve to `noop` or `suggestion`. Auto-write remains editor tier 1 only.

---

## 15. Write Gate

Still the only mutator. Pipeline: analyze → hypotheses → optional advisor → `decideWriting` → Write Gate / translation fulfill / suggestion. No competing automatic writers were added.

---

## 16. Generated test methodology

`tests/unit/writing-engine/generalization/generate.ts` is **test-only**. It is not imported by production.

It builds Arabic and English phrase combinators, applies `mapLayoutText` as a physical transform, then inserts mixed, punctuation, spelling-transposition, and adversarial noise. Production never sees the generated Latin/Arabic pairs as literals.

---

## 17. Development / validation / holdout split

`assignSplit(id)` = FNV-1a hash of the case id:

| Bucket | Split |
|---|---|
| `hash % 10 === 0` | **holdout** |
| `hash % 10 === 1` | validation |
| else | development |

Holdout is not used to author production rules. Thresholds were set on development/validation behavior; holdout only asserts that error rates stay below loose safety bounds (better than chance, not overfit accuracy).

---

## 18. Metrics (measured in-test, heuristic)

The evaluation harness in `layout-generalization.test.ts` measures:

- layout TP / FP / FN / TN
- spelling TP / FP / FN
- mixed preservation
- technical / protected preservation
- abstention
- LLM invocation (`decision.llmUsed`)

Scores on hypotheses remain **explicitly heuristic**. They are not reported as probabilities.

---

## 19. Results

Corpus size (generator, 2026-08-31): **3000+** cases (layout family ≥ 1000; holdout and validation both non-empty).

Unit tests:

- Generated generalization suite: **pass**
- Holdout: layout FN rate **< 0.70**, FP rate **< 0.35**, LLM rate **< 0.15**
- Development layout sample recall **> 0.55**
- Validation mixed preserve (no whole-field translate) **> 0.70**
- Hypothesis / N1–N3 / shadow / unified assistant writing-engine tests: **pass**

Unseen recovery (not conversation examples):

- Arabic sentence mapped through English keys → `en_on_ar` sequence span
- English sentence mapped through Arabic keys → `ar_on_en` sequence span
- Symbols-only → `noop`

Production grep: **no** `higdk`, `fjulg`, `نثغ`, `engain`, `design engain` in `extension/src`.

---

## 20. Failure cases

- Isolated 3-letter remaps often **abstain** (correct conservative default; can miss a true single-word mismatch).
- A real Arabic word that remaps to a high-scoring English string can still be a **false layout vote** if n-grams are weak.
- Unknown English (`engain`) is not auto-corrected.
- Digit-less Arabizi is not classified (unknown / noop).
- Partial switch of a **single** short token beside strong English/Arabic as-is may be demoted.

---

## 21. Known limitations

- Arabic/English n-gram tables are small and uncalibrated.
- English lexicon is still a closed high-frequency list (used as evidence, not as “only words we can recover”).
- No OS keyboard / Caps Lock sensor (correct).
- LLM advisor is not registered in production by default (`unavailable` → abstain on conflict).
- Personal vocabulary remains hashes + exception lists; no full learner.
- Chrome extension UI was not driven in a real browser host in this change (logic verified via generated + golden unit tests).

---

## 22. Remaining risks

Largest remaining error source: **short / ambiguous tokens** and **Arabic n-gram collisions** (real Arabic that happens to invert to English-looking strings, and the reverse).

Secondary: over-preserving unknown Latin in mixed fields (false negative layout on one wrong word).

---

## 23. Next recommendation

1. Calibrate heuristic thresholds on the **development** split using accept/undo metadata only.
2. Re-run holdout without changing rules; publish measured FP/FN as a dashboard.
3. Register the advisor only behind a flag, timeout → abstain.
4. Add hashed personal exceptions from override/accept (already an extension point).
5. Manual dogfood on unseen sentences in the loaded extension (not the conversation examples).

---

## Final questions

1. **Unseen keyboard-layout transformations?** Yes, via invert-and-score. Proven on generated phrases production has never listed.
2. **Complete sentence wrong layout?** Yes, when several consecutive tokens agree. Sequence score, not one lexicon hit.
3. **Partial layout switches?** Yes — spans can differ; the field is not one language. Single short switches may abstain.
4. **Intentional English inside Arabic?** Yes, as preserve / intentional-foreign when remap evidence is weak.
5. **Unknown technical vocabulary?** Structural + context. Unknown ≠ error.
6. **Spelling vs layout?** Competing hypotheses; known typos vs sequence layout.
7. **Punctuation/symbol ambiguity?** Punctuation is mapping evidence; symbols alone never trigger.
8. **Code / URLs / emails?** Protected / identifier skip; layout hypotheses are not emitted.
9. **Arabizi?** Conservative digit-substitution only.
10. **When LLM?** Only conflicting / uncalibrated local write hypotheses. Not per keystroke. Not for mechanical layout sequences.
11. **Can the LLM write?** No.
12. **Local hypotheses conflict?** Advisor if allowed; else `noop` / `suggestion`.
13. **Uncertain?** Abstain (`noop` or `suggestion`).
14. **Generalize beyond supplied examples?** Yes — mechanism is transform + evidence. Examples are tests only.
15. **Proof of generalization?** Generated corpus (3000+) with holdout hash split; production contains none of the conversation strings; unseen mapped sentences recover directionally in unit tests.
16. **Measured FP / FN?** Holdout test bounds: layout FP **< 35%**, FN **< 70%** on that mixed holdout bag (includes adversarial/noop cases). These are **not** calibrated probabilities. Development layout recall sample **> 55%**. Exact per-family rates should be exported from the harness before being treated as product SLOs.
17. **Largest remaining errors?** Short ambiguous tokens and n-gram collisions between plausible Arabic and inverted English.

---

**Acceptance:** general mechanism + generated unseen tests + holdout split + safe abstention + optional LLM ranking + one Write Gate. Not example patches.
