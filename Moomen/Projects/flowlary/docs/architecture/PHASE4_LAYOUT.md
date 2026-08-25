# Phase 4 — Layout Module

Phase 4 ports Layfix keyboard-layout correction into `features/layout/` using existing Flowlary infrastructure.

## 1. Architecture

```
Manual:  shortcut / RUN_COMMAND → CommandOrchestrator → LayoutFeature.execute → fixCurrentText
Auto:    InputEngine → EventBus → LayoutScheduler → planFieldFixes → writeReplacement
Speed:   shortcut SPEED_BOX → CommandOrchestrator.onSpeedBox → SpeedBox overlay
Classify: LayoutClassifier → CHECK_WORD (SW) → /api/analyze-word (optional)
```

## 2. Local conversion

`mapLayout` / `planFieldFixes` run first. Classifier only when `localClassificationHint === null`.

## 3. Candidate detection

Rich tokenizer in `core/safety/tokenize.ts`. Word boundaries on space/punctuation/`÷×—–`.

## 4. Mixed language

Token-independent fixes; two-pass overlay in `planFieldFixes`.

## 5. Classifier

`LayoutClassifier` with local hint → cache → remote. Remote via service worker `background/classify.ts`.

## 6. Cache

`LayoutCache` wraps `CacheCoordinator`. Keys isolated under `FIX_LAYOUT:` namespace.

## 7. Personal exceptions

`LayoutProfileState.personalExceptions` — ignored/revert semantics from Layfix trust module.

## 8. Speed Box

Shadow DOM overlay (`speedBox.ts`). Toggle via orchestrator; Esc handled via EventBus keydown subscription.

## 9. Automatic correction

`LayoutScheduler` on Space/Enter/Tab/blur via normalized events. Does **not** call `orchestrator.dispatch`.

## 10. FieldSession

Manual commands use orchestrator mutex. Auto writes use generation checks via `writeReplacement`.

## 11. DOM

All writes through `writeReplacement(..., { origin: 'FIX_LAYOUT' })`.

## 12. WriteOrigin

Controlled writes do not bump user generation (Phase 2/3 invariant preserved).

## 13. Safety

Orchestrator runs safety before `LayoutFeature.execute`. Scheduler re-checks per field.

## 14. Stale handling

Generation + `canCommit` + `shortcutSessionStillValid` + DOM snapshot verification.

## 15. Mutex

Manual FIX_LAYOUT: orchestrator `tryAcquireWrite`. Auto: no command mutex; generation gates only.

## 16. Abort

`AbortSignal` on active request aborts classifier loop.

## 17. Error handling

Classifier/network failures preserve text; feature never throws into page.

## 18. Performance

Boundary-only evaluation; no full-document scan; local-first.

## 19. Metrics (dev)

`layout_local_hits`, `layout_cache_hits`, `layout_classifier_calls`, `layout_stale_results`, `layout_blocked`.

## 20. Phase 5+ extension points

Translation remains stub. Correction remains stub. Persistent cache Phase 12. Storage migration Phase 10.
