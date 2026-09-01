# Intent Intelligence — Hypothesis Layer Implementation

**DATE:** 2026-08-31  
**SCOPE:** Implementation of span-level hypotheses on the existing Unified Decision Engine.  
**NON-GOALS:** Second writer, second decision engine, LLM replacement text, personal vocabulary product, UI redesign, mixed-sentence translation rewrite.

This report is the implementation counterpart to `docs/audit/INTENT_INTELLIGENCE_AND_LLM_DECISION_AUDIT.md`. Claims were re-checked against the code in `extension/src/core/engine/` and `extension/src/core/writeGate/`.

---

## Verdict

**READY FOR NEXT PHASE**

The architecture now exists:

local evidence → span-level `Hypothesis[]` → optional LLM advisor (rank IDs only) → `decideWriting` → policy → Write Gate.

It is **not** “production ready” in the sense of understanding bilingual writing. Tests passing means the contracts and the conservative fallbacks hold, not that Flowlary can resolve thousands of real situations.

---

## Architecture before

Surface evidence (script, closed lexicons, `mapLayout`, a small typo map, token-kind skips) collapsed into **one field-level interpretation**, then **one capability** with hard priority:

layout candidate (if any) → translation session (if any) → English correction → otherwise noop.

Mixed Arabic+Latin usually meant **give up** (`hasAmbiguousMixed` blocked English). Unknown Latin was often treated as a layout problem. There was no first-class `user_override`, no competing interpretations per span, and `decideWriting` never consulted an LLM.

---

## Architecture after

```
analyzeFieldText (chunks, layout spans, roles)
        ↓
collectHypotheses (many intents per field / span)
        ↓
candidatesFromHypotheses (actions only where a hypothesis has one)
        ↓
shouldConsultAdvisor?  →  consultAdvisor (optional, rare)
        ↓
decideWriting (same function; compares hypotheses)
        ↓
policy / eligibleForAuto
        ↓
Write Gate (commitWriteTransaction)
```

One field can now carry Arabic prose, technical Latin, protected tokens, layout suspicion, and Arabizi **as separate chunks and hypotheses**. Mixed script is no longer an automatic field-level noop.

---

## Files changed (this phase)

### New engine modules

- `extension/src/core/engine/hypotheses.ts` — `Hypothesis[]` generation
- `extension/src/core/engine/advisor.ts` — packet, validation, consult hook
- `extension/src/core/engine/technicalTokens.ts` — structural + small seed evidence
- `extension/src/core/engine/contextualSpell.ts` — known typo + conservative edit-distance
- `extension/src/core/engine/arabizi.ts` — conservative digit-substitution Arabizi
- `extension/src/core/engine/layoutSequence.ts` — `mapLayout` as evidence, sequence scores
- `extension/src/core/engine/languagePlausibility.ts`
- `extension/src/core/engine/preserveTokens.ts` — future mix-safe translation planning
- `extension/src/core/engine/mixedLayoutSafety.ts` — do not auto-layout mixed intent
- `extension/src/core/engine/writingFeedback.ts` — extension point (hashes only)

### Existing engine / pipeline

- `types.ts`, `chunks.ts`, `candidates.ts`, `decide.ts`, `context.ts`, `coordinator.ts`, `index.ts`
- `extension/src/core/writeGate/pipeline.ts` — collect hypotheses, optional advisor, analytics timings
- `extension/src/core/session/FieldSession.ts` — override ranges after user edits AI output
- `extension/src/core/observability/writingAnalytics.ts` — decision/hypothesis/LLM fields, no raw text

### Tests

- `tests/unit/writing-engine/hypothesis-layer.test.ts`
- `tests/unit/writing-engine/golden-intent-cases.ts` (115 cases)
- Updates to n1–n4, phase2, unified-assistant tests

Unrelated marketing / backend files were not part of this phase.

---

## New abstractions

### `Hypothesis`

Adapted to existing types (not a parallel engine):

| Field | Role |
|---|---|
| `id` | Stable in-cycle id (`h1`…) |
| `span` | Existing `TextRange` |
| `intent` | `write_as_is` / `fix_layout` / `fix_english` / `translate` / `preserve` / `unknown` / `user_override` |
| `candidateAction` | `layout_fix` / `translation` / `english_correction` or `null` |
| `replacementSource` | `map_layout` / `instant_spell` / `contextual_spell` / `none` |
| `replacement` | Only from approved local mechanisms |
| `localScore` | **Uncalibrated heuristic**, not a probability |
| `evidence[]` | Kind + optional weight |
| `conflicts[]` | Overlapping rival hypothesis ids |
| `risk` | `low` / `medium` / `high` |
| `needsLLM` | Ranking may be useful; never “please write” |
| `sourceChunkIds` | Trace to analysis chunks |

Intent ≠ action. Many intents produce `candidateAction: null` (preserve / write_as_is / unknown / user_override).

### Span roles

Chunks can be `arabic_prose`, `english_prose`, `intentional_foreign_token`, `technical_token`, `identifier`, `url`, `email`, `code`, `number`, `punctuation`, `arabizi`, `possible_layout_error`, `unknown`, `protected`, `translated_output`, `user_override`. Script is evidence, not destiny.

### Personal vocabulary (extension point only)

`AnalyzeOptions.vocabularyHashes` and `inPersonalVocabulary` can mark `intentional_foreign_token`. Evidence kind `personal_vocab` exists. **No learning loop was built.**

---

## Hypothesis lifecycle

1. **Analyze** the field locally (`analyzeFieldText`). IME composition never reaches this if `decideWriting` short-circuits on `composing`.
2. **Generate** hypotheses from chunks + `inferLayoutSpans` (`mapLayout` unchanged as the mechanical mapper).
3. **Link conflicts** when overlapping spans disagree on intent/action.
4. **Project** action-bearing hypotheses to `CandidateAction[]`.
5. **Optionally rank** via advisor if `shouldConsultAdvisor` (conflicting write-actions that `needsLLM`, never a lone obvious layout).
6. **Resolve** in `decideWriting` (deterministic if no advisor vote).
7. **Mutate** only through Write Gate.

---

## How conflicts are resolved

Deterministic order inside the same `decideWriting`:

1. Hard stops: assistant off, shortcuts-only, unsafe, **composing**, mutex, cooldown, non-tier-1, **paste/drop**.
2. `user_override` overlapping an action → **noop / preserve**.
3. Valid advisor ranking → that hypothesis, or suggestion if not auto-safe, or noop if preserve/unknown.
4. Invalid / unavailable advisor when local conflict needs LLM → **noop** (never a risky auto write).
5. Unique **low-risk** layout hypothesis that does not cover a translation-ready Arabic sentence → may `layout_fix`.
6. Overlapping write-actions that all need LLM or are not low-risk → **noop** (`hypothesis_conflict`).
7. Translation hypothesis: session + low risk + no unknown-Latin blob → `translation`; mixed unknown Latin → **noop** (`mixed_spans_no_blob_translate`).
8. English spelling with replacement: suggestion unless known typo, auto help-style, and no layout/Arabizi/mixed-scope block.
9. Otherwise preserve / no unambiguous winner.

Mechanical layout still wins when the span is a coherent keyboard run (e.g. `hsjo]lj` → Arabic). It must **not** win because a Latin token is merely unknown.

---

## When the LLM is called

Only if **all** of these hold:

- not composing
- two or more hypotheses, including conflicting **actions** or multiple `needsLLM` items
- no unique obvious mechanical layout without a rival write-action
- `setHypothesisAdvisor` is installed

Typical linguistic ambiguity: layout vs spelling, name vs typo, Arabizi vs English, unknown technical vs error.

### When the LLM is NOT called

- every keystroke / normal typing path (default: no advisor installed)
- unique strong layout with no rival action
- paste / drop / composition
- empty or preserve-only fields
- production today: **no Groq/network advisor is wired**. The hook is `setHypothesisAdvisor`. Absent hook → `unavailable` → local fallback.

---

## LLM input / output / validation

**Input (`AdvisorPacket`):** cycle id, policy flags, allowed intents, hypothesis ids + intent + localScore + risk + needsLLM + conflicts + evidence **kinds**. No raw field text, no page dump, no replacement strings.

**Allowed output:** `rankedHypothesisIds`, `reasonCode`, `ambiguityClass`.

**Rejected:** missing fields, empty ranking, unknown ids, any `replacement` / `text` / `write` key.

Unknown id or malformed JSON → `invalid` → **abstain / noop**. Timeout or throw → `unavailable` → local deterministic path. The advisor **cannot invent an action** outside generated hypotheses and **cannot write**.

---

## Write Gate remains authoritative

`runFieldCycle` still applies layout, English, and translation only through `commitWriteTransaction` / `fulfillTranslationDecision` / suggestion apply.

### Other write paths found (not fixed in this phase)

| Location | What |
|---|---|
| `extension/src/core/dom/write.ts` | Gate implementation (`element.value =`). Expected. |
| `extension/src/features/layout/speedBox.ts` | Speed Box still assigns `input.value` for in-box conversion. **Outside Write Gate.** Report only. |
| UI `textContent` / `<option value>` | Overlay chrome, not field mutation. |
| `copyText.ts` `execCommand('copy')` | Clipboard, not the editor field. |

No second writer was added.

---

## Test results

Command: `npx vitest run ../tests/unit/writing-engine` from `extension/`.

**11 files, 169 passed, 0 failed** (2026-08-31).

Includes:

- Required cases 1–27 in `hypothesis-layer.test.ts` (`نثغ`, `design engain` without inventing `engine`, `ui ux` preserve, mixed deploy/error, Arabizi, paste, composition, selection, advisor invalid/unavailable/unknown id)
- **115** golden cases (Arabic, English, mixed, technical, layout, spelling, Arabizi, symbols, caps, URL/email/code/names/numbers)
- Existing n1–n4, phase 2 shadow, unified assistant

`localScore` / `confidence.score` remain heuristics. Tests do not treat them as calibrated probabilities.

---

## Remaining limitations

1. **Advisor is not a product feature yet.** No production LLM ranking call. No per-keystroke LLM (by design).
2. **Mixed translation** still translates a completed Arabic-containing **sentence blob** when the session is on and Latin is only technical/protected. Span structure is preserved for the next phase (`preserveTokens`); this phase does not ship mix-safe translation writes.
3. **Spelling coverage is still small.** Known instant-spell map + conservative distance-1 lexicon. Isolated 1–3 letter tokens do not auto-correct (`hwo` alone stays). Contextual `engain` does **not** invent `engine`.
4. **Technical vocabulary** uses structural shapes (camelCase, ALL_CAPS, localhost, file.ext, paired 2-letter tokens) plus a **small seed** (`deploy`, `ui`, `api`, …). Unknown ≠ layout, but unknown also ≠ understood.
5. **Arabizi** is conservative (digit substitution). Digit-less `inshallah` / `shukran` are not forced into translation or English; they are not a rich Arabizi model.
6. **Names** have no NER. `أحمد` stays Arabic prose unless a **strong** English remap exists. `Ahmed` is title-case / preserve, not auto-cased.
7. **User override** is span-hash after the last engine write, not a learning system. Easy to miss if the user edits far from the last write range.
8. **Caret:** unfocused fields use end-of-text for completed-segment lookup so tests/programmatic values still translate. A focused caret at 0 is respected.
9. **Speed Box** can still mutate its own input outside the gate.
10. **No calibrated confidence.** Do not quote 0.85 as P(correct).
11. Concurrent layout-sequence work added `mixedLayoutSafety`; it is correct in spirit (don’t remap genuine mixed fields) but will **under-fire** some borderline layout+neighbor cases.

---

## Known unsafe / fragile cases

- A long Arabic sentence that **is** a real layout run of several tokens can still be remapped if it is **not** in a translation session and scores as a coherent `en_on_ar` sequence. Translation session + Arabic prose now suppresses that auto path.
- `mapLayout` + English/tech lexicon hit on a short Arabic token (`نثغ` → `key`) is represented and may auto if risk is low. That is intended for isolated mechanical wins; it is wrong if the user meant a rare Arabic word.
- Seed technical words (`error`, `chrome`, `git`) are classified `technical_token` even in casual English. That prefers preserve over layout; it can hide a real typo of those strings.
- Instant-spell in an English sentence can still auto-write (`I dont know` → `I don't know`) when policy allows. That is the existing approved correction path, not LLM text.
- Speed Box field writes remain ungated.

---

## Recommended next phase

1. **Mix-safe translation:** translate Arabic spans only; keep technical/protected spans; never one uncontrolled blob.
2. **Wire the advisor** to a backend rank endpoint (structured JSON, timeouts, no replacement field) and measure how rarely it fires.
3. **Suggestion / multi-hypothesis UI** using existing suggestion contracts (do not redesign the popup first).
4. **Personal vocabulary** as evidence from accepts/overrides (hashes only).
5. **Close or gate Speed Box** through Write Gate if that surface still writes the page field.
6. **Calibration later.** Until then, keep calling scores heuristics.

---

## Acceptance checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Multiple hypotheses per span | Met |
| 2 | Multiple language intents per field | Met |
| 3 | Mixed language ≠ automatic give-up | Met |
| 4 | Unknown technical ≠ automatic layout | Met (structural + seed + as-is vote) |
| 5 | `نثغ` can hypothesize `key` via `mapLayout` | Met |
| 6 | `design engain` can hypothesize English spelling without inventing `engine` | Met |
| 7 | `ui ux` preserved | Met |
| 8 | Technical / protected tokens preserved | Met |
| 9 | Arabizi local, not a global freeze | Met |
| 10 | `user_override` representable | Met |
| 11 | LLM optional and rare | Met |
| 12–13 | LLM cannot write or invent actions | Met |
| 14 | LLM failure falls back safely | Met |
| 15 | Automatic writes through Write Gate | Met (Speed Box exception reported) |
| 16–17 | No second engine / writer | Met |
| 18 | No per-keystroke LLM | Met |
| 19 | Mechanical layout wins still work | Met (`hsjo]lj`) |
| 20 | Existing safety skips remain | Met |
| 21 | ≥100 golden cases | Met (115) |
| 22 | No fake probability claims | Met |

---

**READY FOR NEXT PHASE**
