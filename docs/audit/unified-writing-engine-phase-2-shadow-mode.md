# Unified Writing Engine — Phase 2 Shadow Mode

**Date:** 2026-08-31  
**Contract:** [docs/architecture/unified-writing-decision-engine-spec.md](../architecture/unified-writing-decision-engine-spec.md)  
**Predecessor:** [unified-writing-engine-phase-1-hardening.md](./unified-writing-engine-phase-1-hardening.md)  
**Scope:** Observe-only Decision Engine. No enforce mode. No Central Write Gate. No legacy scheduler removal. No user-visible behavior change.

`ENGINE_VERSION`: `2.0.0-shadow`  
`ENGINE_FLAG_KEY`: `flowlary.debug.engineMode`  
Default variant: `off`

---

## Changed files

### New

| File | Role |
|---|---|
| `extension/src/core/engine/types.ts` | Internal contracts: `FieldContext`, chunks, candidates, `WritingDecision`, reason codes, shadow event + engine/flag metadata |
| `extension/src/core/engine/flag.ts` | Internal-only enablement (`off` / `internal_shadow`). Default off. No remote flags |
| `extension/src/core/engine/context.ts` | Shared field context from session + Phase 1 policy/safety |
| `extension/src/core/engine/chunks.ts` | Local-only script/layout/protected/Arabizi evidence. No API |
| `extension/src/core/engine/candidates.ts` | Shadow adapters for layout / live-translation / correction. No API writes |
| `extension/src/core/engine/decide.ts` | One `WritingDecision` per cycle (`layout_fix` \| `translation` \| `english_correction` \| `suggestion` \| `noop`) |
| `extension/src/core/engine/telemetry.ts` | Privacy-safe in-memory shadow comparison ring (max 80) |
| `extension/src/core/engine/coordinator.ts` | Single EventBus observer. Skip analysis on gated contexts |
| `extension/src/core/engine/index.ts` | `startShadowEngine` / test exports. Must not import writers or cards |
| `tests/unit/writing-engine/phase2-shadow-engine.test.ts` | Focused shadow-mode tests |
| `docs/audit/unified-writing-engine-phase-2-shadow-mode.md` | This report |

### Modified

| File | Change |
|---|---|
| `extension/src/content_script.ts` | After `orchestrator.start()`, call `startShadowEngine(engine)`. Shadow coordinator no-ops unless internal flag is on |

No popup, dashboard, backend, or settings-schema changes.

---

## Architecture roles introduced

```
InputEngine.EventBus
        │
        ▼
Shadow coordinator (one subscriber)
        │
        ├─ gated? → decide(noop) + telemetry (analyzed: false)
        │
        └─ analyzeFieldText (local)
                │
                ▼
        collectShadowCandidates (adapters, local only)
                │
                ▼
        decideWriting → one WritingDecision
                │
                ▼
        recordShadowDecision (in-memory, no raw text)
```

| Role | Responsibility |
|---|---|
| Flag | `off` unless `__FLOWLARY_ENGINE_MODE__`, `setInternalEngineMode`, or `chrome.storage.local` key |
| FieldContext | Tier, safety, composing, mutex, helpStyle, capability bits. Distinguishes policy from script evidence |
| Shared analysis | Chunk-level Arabic / English / mixed / layout-suspicion / Arabizi / protected. Uncertainty is explicit |
| Candidate adapters | Observe reusable local heuristics. Do not subscribe independently. Do not call correction/translation APIs |
| Decision engine | Future product policy as **decision output only**. `noop` is first-class |
| Telemetry | Comparison event; `legacyObserved: 'not_observable'` when the live writer is not captured at this instant |

---

## What is deliberately still legacy

- `LayoutScheduler`, `CorrectionScheduler`, `TranslationScheduler` remain the **only** automatic writers.
- `writeReplacement` / mutex / Tier 1 auto-write rules from Phase 1 are unchanged.
- Live translation still writes on pause when enabled (legacy). Shadow marks that candidate `session_missing` / `legacy_live_behavior` and `eligibleForAuto: false`.
- Grammar still uses the existing eligibility + API path.
- No translation sessions, no editor adapters, no PIPELINE runner, no Central Write Gate as a mutator.
- No settings UI. `helpStyle` remains derived / `SET_SETTINGS` only (Phase 1).
- Suggestion cards, Speed Box, and `CommandOrchestrator` shortcuts are unchanged.

---

## Proof that no shadow writer or UI exists

1. `extension/src/core/engine/**` does not import `writeReplacement`, `commitReplacement`, `applyLayoutFix`, or card/toast modules. The tree only reads via `readFieldText` / `readCaret` and records memory events.
2. `decideWriting` returns a `WritingDecision` object. Nothing applies it to the DOM.
3. The coordinator never calls `session.acquire` / write lock.
4. Tests: field value is unchanged after `runShadowDecisionForTests`; source scan forbids writer/card imports.
5. `startShadowEngine` only installs a flag listener + EventBus observer. When mode is `off` (production default), the observer returns immediately.

There is **no dual-writer window**: the new engine cannot write.

---

## Flag enablement (internal / dogfood only)

Default is **off**. Production users never receive this unless a developer sets it.

**How to enable:**

1. Content-script console (that tab only):

   `globalThis.__FLOWLARY_ENGINE_MODE__ = 'internal_shadow'`

2. Persist for this browser profile (no UI):

   `chrome.storage.local.set({ 'flowlary.debug.engineMode': 'internal_shadow' })`

3. Tests: `setInternalEngineMode('internal_shadow')`

Invalid / missing values parse to `off`. Comments live in `extension/src/core/engine/flag.ts`.

Shadow auto analysis still does **not** run when effective policy is `shortcuts_only`, the field is protected, composing, mutex-held, or not editor Tier 1.

---

## Telemetry schema summary

In-memory ring, max **80** events. Same retention style as Phase 1 write telemetry. Not persisted. No raw field text or raw tokens (chunks store `textHash` only inside analysis; the emitted event stores counts and enums).

| Field | Notes |
|---|---|
| `shadow_only` / `shadowOnly` | Always `true` |
| `engine_version` / `engineVersion` | `2.0.0-shadow` |
| `feature_flag_key` / `featureFlagKey` | `flowlary.debug.engineMode` |
| `feature_flag_variant` / `featureFlagVariant` | `off` \| `internal_shadow` |
| `timestamp` | `Date.now()` |
| `fieldTier` / `fieldKind` | Editor tier and element kind |
| `scriptMix` / `dominantOrigin` | High-level classification (or null if not analyzed) |
| `candidateTypes` | `layout_fix` / `translation` / `english_correction` |
| `decision` | Selected action |
| `confidenceClass` | `high` \| `medium` \| `low` \| `ambiguous` |
| `reasonCodes` | Always includes `shadow_observe_only` when a decision is produced |
| `comparison` | `blocked_by_policy` \| `unsupported_editor` \| `low_confidence_noop` \| `legacy_not_observable` (same_decision / write-vs-noop classes reserved until a live legacy hook exists) |
| `legacyObserved` | Always `not_observable` in this phase (not invented) |
| `analyzed` | `false` when gates skip chunk/candidate work |

---

## Tests run and results

**Phase 2 file:** `tests/unit/writing-engine/phase2-shadow-engine.test.ts` — **14 passed**.

Coverage vs requested cases:

| # | Case | Result |
|---|---|---|
| 1 | Never calls write functions / never mutates field | Pass |
| 2 | Never shows UI (no card imports) | Pass |
| 3 | Protected context → noop | Pass |
| 4 | Active composition → noop, no analysis | Pass |
| 5 | `shortcuts_only` → noop, no candidates | Pass |
| 6 | Contenteditable → `unsupported_editor` | Pass |
| 7 | Short token → not `layout_fix` auto | Pass |
| 8 | High-confidence layout outranks correction | Pass |
| 9 | Translation-live marked session/legacy; no write | Pass |
| 10 | Mixed ambiguous blocks English correction auto | Pass |
| 11 | Telemetry has no raw text | Pass |
| 12 | Event includes `shadow_only`, version, flag metadata | Pass |
| 13 | Legacy tests still pass | Pass (slice below) |

**Related slice (pass):** 32 files / **238 tests**.

- `phase1-hardening`, `phase2-shadow-engine`, `instantSpell`
- `tests/unit/layout/**`, `tests/unit/correction/**`, `tests/unit/translation/**`
- `inputEngine`, `fieldSession`, `commandRouter`
- `tests/integration/phase2.test.ts`
- `tests/characterization/dom-replace.test.ts`

**Lint:** No diagnostics on `extension/src/core/engine` or the Phase 2 test file.

**Typecheck:** `npm run typecheck` in the extension package still reports pre-existing repo `TS5097` / website-include noise. No errors under `extension/src/core/engine` or `content_script.ts`.

---

## Known discrepancies (legacy vs shadow decision)

These are **expected**. Legacy behavior is unchanged; shadow records future policy.

1. **Live translation.** Shadow may emit `suggestion` + `session_missing` / `legacy_live_behavior` while the legacy scheduler still auto-writes after pause. Comparison is `legacy_not_observable` (no live write hook yet).
2. **English correction on mixed / layout-suspect Latin.** Shadow `noop`s (`ambiguous_mixed`, `suspected_layout_blocks_grammar`, layout winner). Legacy correction may still schedule if its own eligibility says English.
3. **High-confidence layout.** Shadow can decide `layout_fix` while legacy also writes independently. We do **not** claim `same_decision` without observing the write.
4. **Short tokens (≤2).** Shadow never selects `layout_fix` auto. Phase 1 already tightened instant-spell; layout commit rules may still differ on edge tokens.
5. **Arabizi.** Shadow treats digit-Latin hints as evidence and prefers `noop`. Legacy has no dedicated Arabizi gate.
6. **`translated_en` origin** is in the type system but is not inferred (no session). Dominant origin will not be `translated_en` in this phase.
7. **Comparison classes** `same_decision`, `legacy_write_new_noop`, `legacy_noop_new_candidate`, `different_action_type`, `same_action_different_range` are defined but unused until a legacy observation hook exists. Inventing a legacy action is forbidden.

---

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Engine produces one explicit decision per eligible shadow cycle | **Met** |
| 2 | Observe-only; cannot write to a user field | **Met** |
| 3 | No shadow user-visible UI | **Met** |
| 4 | Shadow defaults off | **Met** |
| 5 | Internal/developer enablement only | **Met** |
| 6 | `shortcuts_only`, protected, composing, unsupported editor, mutex → no shadow auto analysis/write | **Met** |
| 7 | One coordinator evaluates all candidate types | **Met** |
| 8 | Explicit `noop` + reason codes | **Met** |
| 9 | Telemetry excludes raw text/tokens by default | **Met** |
| 10 | Every shadow event includes flag metadata + engine version | **Met** |
| 11 | Legacy user-visible behavior unchanged | **Met** |
| 12 | Focused + related tests pass | **Met** (238 in slice) |
| 13 | This report exists | **Met** |
| 14 | No dual-writer window | **Met** |

---

## Explicit Phase 3 prerequisites

Do **not** start Phase 3 until product/engineering accept:

1. Shadow comparison quality on dogfood (`internal_shadow`) is good enough to migrate **layout writes only**.
2. Central Write Gate will be the **only** new mutator for layout auto; legacy `LayoutScheduler` apply path is removed only after gate acceptance.
3. Isolated tokens of length ≤ 2 remain non-auto (already shadow policy).
4. Shift-symbol / physical-key ambiguity stays suggestion or noop unless commit heuristics already allow it.
5. A real legacy-observation hook (or write-telemetry join) if comparison classes other than `legacy_not_observable` are required.
6. No translation-session or correction migration in Phase 3 (those are Phase 4).
7. Production `engineMode` stays `off` for enforce until a later phase explicitly ships it.

Phase 3 must not enable a second writer. Enforce layout only after the gate owns mutation and the scheduler write path is disabled.
