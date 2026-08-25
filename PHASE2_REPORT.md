# Phase 2 Report — DOM / Safety / FieldSession Hardening

**Date:** 25 Aug 2026  
**Status:** ✅ Complete

---

## 1. Phase 2 Objective

Harden the shared foundation (DOM, FieldSession, Safety, WriteOrigin) before porting feature modules. No feature AI, no InputEngine→Router wiring.

---

## 2. Files Modified

- `packages/shared/src/types.ts` — `WriteOrigin`, `WriterTag`
- `extension/src/core/dom/read.ts`, `write.ts`, `verify.ts`, `index.ts`
- `extension/src/core/dom/editor.ts` — unified DOM API
- `extension/src/core/dom/generation.ts`, `writeOrigin.ts`, `adapter.ts`
- `extension/src/core/session/FieldSession.ts` — mutex, acquire, abort, canCommit
- `extension/src/core/input/InputEngine.ts` — programmatic write detection
- `extension/src/core/events/EventBus.ts` — `origin` on input events
- `extension/src/core/safety/*` — full tokenKind, markdown, tokenize, codeEditor
- `docs/architecture/FLOWLARY_ARCHITECTURE.md`
- `docs/development/PHASES.md`
- `docs/architecture/TEST_MIGRATION.md`
- `tests/unit/fieldSession.test.ts`

---

## 3. Files Created

- `docs/architecture/PHASE2_GAP_ANALYSIS.md`
- `docs/architecture/PHASE2_DOM_SAFETY.md`
- `tests/characterization/dom-replace.test.ts`
- `tests/characterization/adapters.test.ts`
- `tests/characterization/safety-fields.test.ts`
- `tests/characterization/safety-tokens.test.ts`
- `tests/integration/phase2.test.ts`

---

## 4. DOM Improvements

- Canonical API: `readText`, `readSelection`, `readCaret`, `createSnapshot`, `verifySnapshot`, `writeReplacement`, `restoreSelection`
- `baselineSnapshot` option for stale DOM rejection
- `EditableAdapter` with EWA edge cases (password, code editor, CE host)
- Generation sync via `bumpUserGeneration` / `syncDomGeneration`
- Contenteditable nested element replacement tested

---

## 5. FieldSession Improvements

- `tryAcquireWrite` / `releaseWrite` mutex (explicit reject, no hidden queue)
- `canCommit(generation, requestId)` pre-write gate
- Abort invalidates request sequence
- Composition blocks acquire
- `lastWriter` includes `SYSTEM`
- Session ↔ DOM generation synchronization

---

## 6. Safety Improvements

- Full Lingo/Layfix `tokenKind` patterns ported
- Inline + fenced markdown code detection (Lingo parity)
- `looksLikeCodeEditor` (EWA Monaco/CodeMirror/Ace)
- Username, cc-number, hidden input coverage
- Domain exclusion: `notexample.com` vs `example.com` tested
- Tokenizer foundation for Phase 4+

---

## 7. WriteOrigin Implementation

- Types in `@flowlary/shared`
- `withWriteOrigin()`, `isControlledWriteActive()`, `shouldIgnoreInputForGeneration()`
- InputEngine skips generation bump on programmatic input
- `commitReplacement` accepts `WriteOrigin` parameter

---

## 8. Characterization Tests Ported

| Source | Flowlary |
|--------|----------|
| Lingo/Layfix `dom/replace.test.ts` | `characterization/dom-replace.test.ts` (6 tests) |
| EWA `adapters/index.test.ts` | `characterization/adapters.test.ts` (4 tests) |
| Lingo/Layfix `safety/fields.test.ts` | `characterization/safety-fields.test.ts` (2 tests) |
| Lingo `safety/safety.test.ts` | `characterization/safety-tokens.test.ts` (4 tests) |

---

## 9. New Integration Tests

`tests/integration/phase2.test.ts` — 8 tests:

1. Stale response (generation advance)
2. Concurrent writers (mutex)
3. Aborted operation
4. Programmatic write (no generation bump)
5. Composition block
6. Safety (prose vs password/token/code)
7. Contenteditable nested replace
8. Stale DOM (baseline snapshot)

---

## 10. Total Test Count

| Suite | Count |
|-------|-------|
| Phase 1 | 34 |
| Phase 2 added | 22 |
| **Total** | **56** (all passing) |

---

## 11. Build Result

```
npm run build — ✓ built in 636ms
```

---

## 12. Warnings

1. EWA `ContentEditableAdapter` MutationObserver for programmatic clears not yet ported — deferred to Phase 3 if needed.
2. `selectionDirection` not read (low impact).
3. Rich editor iframe edge cases beyond same-origin not tested in harness.

---

## 13. Unresolved Issues

None blocking Phase 3.

---

## 14. Explicit Confirmations

- ✅ **No AI feature implemented** — correction, translation, layout remain stubs
- ✅ **InputEngine NOT wired to CommandRouter**
- ✅ **Original repositories NOT modified**

---

## 15. Recommended Phase 3

**InputEngine + CommandRouter event wiring**

1. Connect normalized input events to router dispatch (still no auto-chaining)
2. Wire manifest shortcuts (`TRANSLATE`, `FIX_LAYOUT`) to router
3. Port `background/commands.test.ts` pattern
4. Single-listener verification test
5. Do **not** port Layfix/Lingo/EWA feature logic yet

---

*Phase 2 complete — awaiting approval before Phase 3.*
