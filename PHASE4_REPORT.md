# Phase 4 Report — Port Layfix Layout Module

**Date:** 25 Aug 2026  
**Status:** ✅ Complete

---

## 1. Phase objective

Port Layfix keyboard-layout correction into `flowlary/features/layout/` using InputEngine, FieldSession, CommandOrchestrator, DOM layer, Safety Gate, WriteOrigin, and CacheCoordinator. No translation or English correction AI.

---

## 2. Source repository mapping

See `docs/architecture/PHASE4_SOURCE_MAPPING.md`. Key ports: `mapLayout`, `planFieldFixes`, heuristics, lexicons, convert, Speed Box, trust/exceptions, classifier contract.

---

## 3. Files ported

- `layouts/registry.ts`, `convert.ts`, `sentence.ts`, `heuristics.ts`, layout tables, lexicons
- Trust/exceptions semantics from `profile/learn.ts`, `profile/exceptions.ts`

---

## 4. Files adapted

- Speed Box: no `window.addEventListener`; orchestrator + EventBus
- Auto-fix: `LayoutScheduler` instead of Layfix content script listeners
- Cache: `LayoutCache` + Flowlary `CacheCoordinator` keys

---

## 5. Files created

- `features/layout/LayoutFeature.ts`, `fixCurrentText.ts`, `scheduler.ts`, `speedBox.ts`
- `features/layout/classifier/LayoutClassifier.ts`
- `features/layout/cache/*`, `profile/*`, `metrics.ts`, `copyText.ts`
- `background/classify.ts`
- `docs/architecture/PHASE4_SOURCE_MAPPING.md`, `PHASE4_LAYOUT.md`
- `tests/unit/layout/*`, `tests/integration/phase4-layout.test.ts`

---

## 6. Layout architecture

Manual FIX_LAYOUT → orchestrator → LayoutFeature → local `planFieldFixes` → optional classifier → `writeReplacement(FIX_LAYOUT)`.

Auto → InputEngine events → LayoutScheduler → same local path.

---

## 7. Local-first algorithm

`localClassificationHint` and `planFieldFixes` resolve most tokens without network.

---

## 8. Classifier behavior

Ambiguous tokens only. SW `CHECK_WORD` → `POST /api/analyze-word` (backend optional; local path works offline).

---

## 9. Cache behavior

In-memory `LayoutCache` + `FIX_LAYOUT:` coordinator keys. No persistence (Phase 12).

---

## 10. Mixed-language behavior

Token-level fixes with two-pass overlay; ported Layfix tests pass.

---

## 11. Personal exceptions

Ignored/revert adds token to `personalExceptions` via trust module.

---

## 12. Trust behavior

`applyCorrectionEvent` preserves Layfix revert threshold (2).

---

## 13. Speed Box

Ctrl/Cmd+Shift+L opens Shadow DOM manual converter. No manifest command.

---

## 14. Automatic layout correction

Space / Enter / Tab / blur via `LayoutScheduler` on EventBus.

---

## 15. DOM integration

All writes via `writeReplacement` with caret preservation.

---

## 16. FieldSession integration

Mutex for manual commands; generation stale gates for auto + async classifier.

---

## 17. Safety integration

Unified gate before manual dispatch; scheduler re-evaluates per field.

---

## 18. WriteOrigin integration

All layout writes use `FIX_LAYOUT`; no user-generation bump.

---

## 19. Stale protection

`canCommit`, generation checks, `shortcutSessionStillValid`.

---

## 20. Mutex protection

Orchestrator `tryAcquireWrite` for FIX_LAYOUT command path.

---

## 21. Abort behavior

Active request `AbortSignal` stops classifier loop.

---

## 22. Error handling

Network/classifier failures preserve user text; no page throws.

---

## 23. Performance

Boundary-only triggers; local-first; no full-field classifier scans.

---

## 24. Security

Safety before classify; no raw text logging in production paths.

---

## 25. Tests added

- `tests/unit/layout/mapLayout.test.ts` (45)
- `tests/unit/layout/convert.test.ts` (16)
- `tests/unit/layout/mixedLanguage.test.ts` (7)
- `tests/unit/layout/layoutFeature.test.ts` (3)
- `tests/unit/layout/layoutCache.test.ts` (3)
- `tests/unit/layout/trust.test.ts` (3)
- `tests/integration/phase4-layout.test.ts` (16)

---

## 26. Total test count

**179 / 179 passing** (Phases 1–4).

---

## 27. Build result

```
npm run build — ✓ built in 851ms
```

---

## 28. Known limitations

- Classifier backend is optional adapter (localhost:8003); production backend not fully deployed
- Cache not persisted to storage
- Unified history/popup/storage migration deferred
- Correction and translation remain stubs

---

## 29. Backend status

`background/classify.ts` implements `CHECK_WORD` with fetch to `/api/analyze-word`. FastAPI backend in repo remains placeholder; classifier degrades safely when API unavailable.

---

## 30. Explicit confirmation

- ✅ No English correction AI implemented
- ✅ No translation feature implemented
- ✅ No live translation implemented
- ✅ No CorrectionCard implemented
- ✅ No storage migration completed
- ✅ No unified popup completed
- ✅ No Phase 5 work started
- ✅ Original repositories were not modified

---

## Next: Phase 5 (awaiting approval)

Port Lingo manual translation. Do not start until approved.
