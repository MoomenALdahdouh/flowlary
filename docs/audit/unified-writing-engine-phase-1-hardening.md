# Unified Writing Engine — Phase 1 Hardening

**Date:** 2026-08-31  
**Contract:** [docs/architecture/unified-writing-decision-engine-spec.md](../architecture/unified-writing-decision-engine-spec.md)  
**Scope:** Foundation hardening only. No Decision Engine, no `PIPELINE` implementation, no settings UI redesign.

---

## Changed files

### New

| File | Role |
|---|---|
| `extension/src/core/policy/writingPolicy.ts` | Derive `helpStyle` (`auto` / `suggestions` / `shortcuts_only`) from existing toggles or optional `settings.helpStyle` |
| `extension/src/core/observability/writeTelemetry.ts` | In-memory ring buffer (max 80). No raw text. `shadowOnly` reserved, unused as a writer |
| `extension/src/core/safety/autoWrite.ts` | Tier 1 auto-write allowlist (`input` / `textarea` only) |
| `tests/unit/writing-engine/phase1-hardening.test.ts` | Lock, CE block, spell, policy, telemetry, listener |
| `docs/audit/unified-writing-engine-phase-1-hardening.md` | This report |

### Modified

| File | Change |
|---|---|
| `extension/src/content/accountBootstrap.ts` | `chrome.storage.onChanged` hydrates policy keys, not only `authAccountId` |
| `extension/src/core/state/StateManager.ts` | Optional `helpStyle` on settings |
| `extension/src/storage/schemas.ts` | Normalize optional `helpStyle` |
| `extension/src/messaging/validate.ts` | Allow `helpStyle` on `SET_SETTINGS` (no UI) |
| `extension/src/core/dom/editor.ts` | Mutex honored when another request owns the field; `auto` writes require lock + Tier 1 + not `shortcuts_only` |
| `extension/src/core/safety/index.ts` | Re-export auto-write guard |
| `extension/src/features/layout/fixCurrentText.ts` | Auto/unlocked `applyLayoutFix` acquires `FIX_LAYOUT` mutex; telemetry |
| `extension/src/features/layout/scheduler.ts` | Skip auto on `shortcuts_only`, CE, protected; skip remote classify when network assist forbidden |
| `extension/src/features/correction/scheduler.ts` | Same gates; instant-spell writes use `auto: true` |
| `extension/src/features/correction/applyCorrection.ts` | Auto API skipped under `shortcuts_only`; direct auto commit blocked on CE |
| `extension/src/features/correction/instantSpell.ts` | Removed `fo`/`ot`/`im`; min 3 chars; `isSafeToken` |
| `extension/src/features/translation/liveTranslate.ts` | Block CE + `shortcuts_only`; `auto: true` on write |
| `extension/src/features/translation/scheduler.ts` | Live timer requires `allowAutomaticNetworkAssist()` |
| `extension/src/background/index.ts` | `SET_LAYOUT` no longer wipes `personalExceptions` / trust events |
| `extension/vitest.setup.ts` | Stub `chrome.storage.onChanged` |
| `tests/unit/correction/instantSpell.test.ts` | Short-token cases |

---

## Exact behavior changed

1. **Live settings sync (spec §16).** Content script listens for `flowlary.settings`, `.correction`, `.translation`, `.layout`, `.layout.profile`. On change it calls `hydrateStateFromStorage` and refreshes the layout feature profile. Account-id changes still take the existing account path (which also hydrates). **No page reload required** for those keys.

2. **Shared write lock (spec §14).**  
   - `writeReplacement` rejects if `session` has an active request and `requestId` is missing or mismatched. Auto layout can no longer write through a held mutex.  
   - `applyLayoutFix` without `requestId` **acquires** `FIX_LAYOUT` and releases after the write.  
   - `auto: true` writes **must** supply session + `requestId`.

3. **Contenteditable auto-write (spec §15).** Automatic layout, instant-spell, direct auto-correction commit, and live translation **do not mutate** `contenteditable`. Reason: `unsupported_editor` / telemetry `unsupported_editor_auto_write`. Manual shortcut / suggestion apply paths do **not** set `auto: true` and remain available.

4. **Instant spell (approved policy).** `fo`, `ot`, `im` removed from the auto map. Any token shorter than 3 letters is refused. Unsafe tokens (`isSafeToken`) are skipped.

5. **`shortcuts_only` (spec §9, §16).** Derived when no direct-auto capability is on, **or** when `settings.helpStyle === 'shortcuts_only'`. Then: no auto remote layout classify, no auto correction API, no live translation, no `auto: true` writes. Shortcuts still use `CommandOrchestrator` → `feature.execute` (not `auto`).

6. **Telemetry (spec §17, Phase 1 subset).** In-memory events: capability, trigger, outcome (`applied` / `blocked` / `stale` / `noop` / `skipped`), reason codes, field kind, composing, `rangeLength` only. `shadowOnly` exists on the type and is always `false` in this phase. **No raw text.**

7. **Layout pair change** no longer clears personal exceptions (spec §4.2).

---

## Intentionally not changed

- No Unified Writing Decision Engine, no shared chunk layer, no `PIPELINE` runner.
- No popup/dashboard settings redesign. `helpStyle` is internal / `SET_SETTINGS` only.
- No translation **session** engine (approved: later, per-field).
- No editor adapters; no Tier 2 auto-write.
- Feature schedulers still subscribe to EventBus and still decide independently (legacy writers, now locked).
- Speed Box / manual `mapLayoutText` remains full physical-key remap including symbols.
- Suggestion cards, chrome.commands, and `CorrectionFeature.execute` / `TranslationFeature.execute` / layout shortcut path.
- Learning/history product UI.

---

## Compatibility notes

- Existing users with layout auto on still get `helpStyle: auto` (derived). Enforce-mode default `suggestions` is **not** applied.
- Contenteditable users lose **automatic** mutation; shortcuts and box/suggestion may still apply if the existing CE write path succeeds.
- `SET_SETTINGS` with `helpStyle: 'shortcuts_only'` can force the policy without turning individual feature flags off (for tests and future UI).
- Policy sync depends on `chrome.storage.onChanged` in the content script. Account-scoped keys still go through the existing storage facade after hydrate.

**Synced keys:** `CONTENT_SCRIPT_POLICY_STORAGE_KEYS` in `accountBootstrap.ts`:

- `flowlary.settings`
- `flowlary.correction`
- `flowlary.translation`
- `flowlary.layout`
- `flowlary.layout.profile`

---

## Tests added/updated

| File | Coverage |
|---|---|
| `tests/unit/writing-engine/phase1-hardening.test.ts` | Spell, helpStyle, mutex, CE auto block, telemetry privacy, shortcuts_only write reject, policy key list, listener install |
| `tests/unit/correction/instantSpell.test.ts` | `fo`/`ot`/`im` unchanged |

**Ran (pass):**

- `tests/unit/writing-engine/phase1-hardening.test.ts` (12)
- `tests/unit/correction/instantSpell.test.ts` (3)
- `tests/integration/phase2.test.ts` (8)
- `tests/unit/layout/**`, `tests/unit/correction/**`
- `tests/integration/phase3d-layout-learning.test.ts`, `phase4-layout`, `phase5-translation`, `phase6-live-translation`, `phase8-correction-ui`
- `tests/characterization/dom-replace.test.ts`

**28 files / 251 tests passed** in the layout+correction+translation+hardening slice.  
`npm run typecheck` in the extension package still reports pre-existing repo TS5097 / backend include noise; no new errors identified in the Phase 1 files.

---

## Mapping to the specification

| Work | Spec sections |
|---|---|
| Live settings sync | §16 runtime sync; §4.2 stale policy forbidden |
| Write lock | §14 mutex; §4.1 invariants 1–2 (partial — features still call write, but only through locked `writeReplacement`) |
| CE auto block | §15 Tier 1 vs 2/3 |
| Instant spell | Approved product policy; §13 instant-spell as gated candidates |
| shortcuts_only | §9 rule 9; §16 help style |
| Telemetry | §17 (subset; no product UI; no shadow writer) |
| Exception persist | §4.2; Phase 1 “foundation hardening” |
| Not building the engine | §2 non-goals; §18 `engineMode: off`; §19 Phase 1 only |

---

## Known remaining risks (blocks / inputs for Phase 2)

1. **Three EventBus auto-schedulers still decide independently.** Mutex prevents overlap writes; it does not prevent grammar on wrong-layout Latin or live-translate vs layout races at the *decision* level.
2. **No translation session.** Live translate can still replace a paragraph after pause on Tier 1 if live is on (unchanged product behavior).
3. **CE suggestion/manual** still uses generic offset writes and can fail on complex hosts (Tier 3 not distinguished beyond “contenteditable”).
4. **Settings sync is not a full e2e browser test** (no live tab in this phase). Unit coverage: listener install + key list + hydrate function already used by bootstrap.
5. **`helpStyle` is not in the popup.** Users cannot pick `suggestions` without `SET_SETTINGS` or by turning all directs off / using box modes.
6. **Remote classifier** is skipped when `shortcuts_only` or `!allowAutomaticNetworkAssist()`. If derived style is `auto`, remote classify still runs (legacy).
7. **Telemetry is process-local** (content script). Not persisted; lost on navigation. Intentional.
8. **Suggestion apply** still writes without `auto: true` and without always taking the mutex first (layout/translation cards). Overlap with an in-flight auto write is now rejected on the card path if mutex is held.

---

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Auto layout cannot write without the shared field lock | **Met** — `applyLayoutFix` acquires; tests hold CORRECT and assert no layout write |
| 2 | Auto correction and auto translation respect the lock | **Met** — already acquired; `writeReplacement` now rejects foreign holders; live/correct use `auto: true` |
| 3 | Locked field cannot receive overlapping automatic mutation | **Met** — mutex mismatch → `rejected` / `mutex` |
| 4 | Settings propagate to an open tab without reload | **Met in code** — policy `onChanged` → hydrate. Not browser-verified |
| 5 | Auto mutation blocked for contenteditable with inspectable reason | **Met** — `unsupported_editor` + telemetry `unsupported_editor_auto_write` |
| 6 | `fo`, `ot`, `im` no longer auto-replace | **Met** |
| 7 | `shortcuts_only` blocks auto remote/AI/live | **Met** — schedulers + `writeReplacement({ auto: true })` |
| 8 | No raw field text in new telemetry | **Met** — test serializes snapshot |
| 9 | Manual shortcuts continue | **Met** — `auto` not set on command/suggestion writes; existing command tests pass |
| 10 | No complete engine / pipeline / settings UI | **Met** |
| 11 | Focused + related tests pass | **Met** (251 in slice) |
| 12 | This report exists | **Met** |

---

## Decision that still blocks Phase 2

Phase 2 (shadow Decision Engine) should not start until product confirms:

- Whether shadow compare runs in production builds or internal-only.
- That legacy writers remain the **only** mutators while shadow logs (already specified; Phase 1 did not add a second writer).

No Phase 2 implementation was started.
