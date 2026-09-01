# Foundation Safety Implementation Report

**DATE:** 2026-08-31  
**SCOPE:** Repair analyzer load + stop destructive mixed-language automatic layout writes.  
**NOT IN SCOPE:** LLM advisor, UI, dictionaries, new writers, Decision Engine redesign.

---

## 1. What was broken

Two independent problems:

1. **Loadability.** An earlier snapshot of `chunks.ts` used `corrected` without a binding, so Vitest/esbuild could not transform the production analyzer. Existing writing-engine tests failed to collect.
2. **Safety.** `inferLayoutSpans` can emit a wide layout candidate that overlaps **genuine Arabic prose** and **as-is Latin / technical text**. `decideWriting` then treated a “unique strong layout” as auto-writable and remapped mixed sentences into garbage.

The architecture audit’s critical examples (`pull request` / `FastAPI service` inside Arabic) were **symptoms** of (2), not rules to encode.

---

## 2. Why `chunks.ts` failed

`SharedAnalysis` / `AnalyzeOptions` already include `correctedRanges`: spans previously written by English correction. The origin field `corrected_en` is set when a chunk overlaps those ranges.

The failure mode was a **missing local binding**:

```ts
const origin = corrected && scripts.latin > 0 && !translated
  ? 'corrected_en'
  : tokenOrigin(...)
```

without:

```ts
const corrected = options.correctedRanges?.some((range) => overlaps(range, span.start, span.end))
```

At the start of this phase the binding **was already present** in the working tree. This phase kept it, documented it, and verified the production import path loads.

---

## 3. How it was fixed

- Confirmed `corrected` means “this chunk still overlaps a tagged engine English-correction range.”
- Left the typed `boolean` binding in place (no `any`, no deleted origin).
- Role/suspicion no longer inherit a **covering multi-token layout span**. They follow **this token’s** `tokenVotesForTests` vote. That stops unknown Arabic from being re-labeled `possible_layout_error` just because a neighbor span exists.

Production load path: `extension/src/core/engine/index.ts` → `analyzeFieldText` from `chunks.ts` (used by `foundation-safety.test.ts` and all writing-engine tests). No shim.

---

## 4. Why mixed-language false layout happened

Sequence inference votes per token, then **grows a run**. Unknown or low-lexicon Arabic next to Latin can be absorbed into one `LayoutSpanInference`. Chunk roles were then painted from that covering span, so the field looked like a whole-span mismatch. `decideWriting` auto-applied `layout_fix`.

That is **span over-consumption**, not “the user used the wrong keyboard for the whole field.”

---

## 5. What generic safety rule now prevents it

New local helper: `extension/src/core/engine/mixedLayoutSafety.ts`.

A layout candidate is **unsafe for auto-write** when its span covers:

- as-is Arabic (`arabic_prose`, or Arabic script that is not `possible_layout_error`), **and**
- as-is Latin keep (`english_prose`, technical, intentional foreign, identifier/url/email/code/protected, or Latin with no layout vote),

or when it overlaps user-override / protected kinds,

or when the replacement **drops punctuation that is stable across both layouts** (same glyph both ways — not keys that become letters on the other layout).

Then:

- Hypothesis: `risk: high`, `needsLLM: true`, lower score (kept for a future advisor; not auto).
- Decide: cannot be `uniqueStrongLayout`. If every layout hyp is weak/mix-blocked → **`noop`** with `mixed_intent_blocks_auto_layout` (or **`suggestion`** if `helpStyle === 'suggestions'`).

No field-wide “any Arabic + any English ⇒ disable layout.” A **scoped** mismatch that does not consume as-is Arabic+Latin can still auto-fix.

---

## 6. How whole-span layout remains supported

A coherent EN-on-AR (or AR-on-EN) run has tokens that **vote layout**. Those chunks are `possible_layout_error`, not as-is Arabic + as-is Latin. `layoutSpanConflictsWithMixedIntent` is false. Existing `risk === 'low'` sequence scores still produce `layout_fix`.

Regression: eight generated English sentences mapped through `mapLayoutText(..., 'en-US-qwerty', 'ar-101')` — at least 75% still auto-fix. Additional generated sentences in the same test file. Existing generalization corpus tests still pass.

---

## 7. How span-level evidence is used

| Layer | Evidence |
|---|---|
| `layoutSequence` | Per-token vote + consecutive run (unchanged mechanically) |
| `chunks` | Role from **own vote**, not covering span |
| `mixedLayoutSafety` | Covered chunk roles vs candidate range |
| `hypotheses` | Skip protected/exception; downgrade mix-unsafe |
| `decide` | Auto only if low risk, no mix conflict, no rival action |

---

## 8. Protected-token behavior

Unchanged skip reasons (URL, email, identifier, path, secrets). Mix safety **also** treats those roles as blocking auto layout if a candidate overlaps them. Tests L/M/N.

---

## 9. Paste behavior

`inputSource === 'paste' | 'drop'` still `paste_conservative` noop before layout. Unchanged. Test Q.

---

## 10. Composition behavior

Coordinator skips composing; decide returns `composing`. Unchanged. Test R.

---

## 11. Override behavior

`user_override` chunks still short-circuit colliding candidates. Mix safety also treats override overlap as unsafe. Test S.

---

## 12. Translation compatibility

Translation still requires mode + session + completed segment. Arabic script alone does not translate (test T). Existing N2/N4 translation tests still pass. No translation redesign.

---

## 13. Tests added

- `tests/unit/writing-engine/foundation-safety.test.ts` — classes A–T, generated EN-on-AR, mix helper.
- Golden `mix-9` expected role updated from `technical_token` to `english_prose` (`chrome` is lexicon English, not a structural technical shape). Test-only.

---

## 14. Generated test methodology

- Hand list of English sentences transformed with `mapLayoutText` (not stored in production).
- Existing `tests/unit/writing-engine/generalization/` corpus (2500+ cases, holdout split) still runs against **production** `analyzeFieldText`.
- Holdout strings are not imported by `extension/src`.

---

## 15. Before / after

| Check | Before (audit) | After this phase |
|---|---|---|
| `chunks.ts` transform | Failed (`corrected` unbound) in the audited snapshot | **Loads** via production `index.ts` |
| Analyzer import | Experiment shim | **Production** |
| Mixed Arabic + intentional/technical English | Auto `layout_fix` garbage | **No auto layout** (tests E, F) |
| Whole-span EN-on-AR | 128/128 in audit experiment | **Preserved** (≥75% of 8 + extra generated; generalization suite pass) |
| Isolated `hsjo]lj` layout | Worked | **Still `layout_fix`** (punct-stable check does not treat `]` as dropped shared punct) |
| Spelling | Unchanged local map / edit-distance | N4 English typo still applies |
| Protected / paste / composition / override | Already conservative | Unchanged + retested |
| LLM | Unused advisor | **Not registered** |

---

## 16. Regressions

- Golden `mix-9` role expectation updated (test contract). Runtime: `chrome` remains English lexicon / as-is Latin, not remapped.
- No production example strings added.
- `npm run typecheck` in the extension package still reports **pre-existing** `TS5097` on `.ts` imports across tests/backend/website. **Engine modules transform and unit-test cleanly.** That repo-wide typecheck was not claimed as newly green.

---

## 17. Remaining limitations

- Isolated unseen layout words and one-wrong-token-in-English can still **miss** (false negative). Out of scope.
- Mix-unsafe layout is **noop/suggestion**, not an LLM rank. Advisor still unused.
- `layoutSequence` can still *propose* a wide span; we refuse **auto-write**, we do not delete the sequence module.
- Speed Box still assigns `input.value` (pre-existing bypass; not used by this fix).
- No production usage telemetry.

---

## 18. Files changed

| File | Change |
|---|---|
| `extension/src/core/engine/chunks.ts` | Own-token layout vote for role/suspicion; document `corrected` |
| `extension/src/core/engine/mixedLayoutSafety.ts` | **New** generic mix / punct-drop guard |
| `extension/src/core/engine/hypotheses.ts` | Downgrade mix-unsafe layout hyps |
| `extension/src/core/engine/decide.ts` | Replace ad-hoc translation/prose layout filters with mix guard + reason |
| `extension/src/core/engine/types.ts` | `mixed_intent_blocks_auto_layout` |
| `extension/src/core/engine/index.ts` | Export safety helpers |
| `tests/unit/writing-engine/foundation-safety.test.ts` | **New** |
| `tests/unit/writing-engine/golden-intent-cases.ts` | mix-9 role |
| `docs/audit/FOUNDATION_SAFETY_IMPLEMENTATION_REPORT.md` | This report |

---

## 19. Files intentionally NOT changed

Advisor implementation, Write Gate, InputEngine, FieldSession, translation/correction providers, layout key tables, lexicons, Speed Box, UI, storage, `layoutSequence` scoring (except consumed more carefully). No Groq/OpenAI/Google calls added.

---

## 20. Recommended next phase

Implement the **LLM hypothesis advisor** (audit option C): rank local hypothesis ids on mix-unsafe / `needsLLM` cycles only. Do not let it write or invent replacements. Do not call it on every keystroke.

---

## Test commands run

```bash
cd extension && npm run test -- ../tests/unit/writing-engine
cd extension && npm run test -- ../tests/unit/fieldSession.test.ts \
  ../tests/unit/layout/mapLayout.test.ts ../tests/unit/layout/mixedLanguage.test.ts
```

**Results:** writing-engine **11 files, 170 passed**; fieldSession + layout **3 files, 57 passed**.

**Not run:** full monorepo (website, backend, e2e, Chrome integration).

**Write Gate search:** no new `element.value` / `setRangeText` / `execCommand` on the auto path. Pre-existing Speed Box `input.value` assignments remain; not required for this fix.

**Example overfitting search** in `extension/src/core/engine`: no `pull request`, `FastAPI`, `نثغ`, `higdk`, `design engain`.

---

FOUNDATION STATUS:  
**READY**

COMPILER STATUS:  
**PASS** (production engine modules load under Vitest/esbuild; package-wide `tsc` still has pre-existing TS5097 noise)

ANALYZER LOAD STATUS:  
**PASS**

MIXED-LANGUAGE SAFETY:  
**PASS**

WHOLE-SPAN LAYOUT:  
**PASS**

WRITE GATE INTEGRITY:  
**PASS** (no new bypass; Speed Box pre-existing)

EXAMPLE OVERFITTING:  
**PASS**

TEST STATUS:  
writing-engine 170/170; fieldSession+layout 57/57; foundation-safety 25/25. Full repo not run.

REMAINING BLOCKERS:  
None for this phase. Advisor still absent (intentional). Isolated-word layout FN remains.

NEXT STEP:  
Implement a flagged, validated, span-limited hypothesis advisor; keep this mix guard as the deterministic auto-write veto.
