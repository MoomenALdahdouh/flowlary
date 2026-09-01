# Phase 4 — Layfix Source Mapping

Source: `/tmp/audit/autofix-layout` (read-only). Destination: `flowlary/extension/src/features/layout/`.

## 1. Layout mappings

| Layfix | Flowlary |
|--------|----------|
| `src/layouts/registry.ts` (`mapLayout`, `mapLayoutText`) | `features/layout/layouts/registry.ts` |
| `src/layouts/ar-101.ts`, `en-US-qwerty.ts`, `ru-standard.ts`, `world.ts` | same paths under `layouts/` |
| `src/layouts/lexicons/*` | `layouts/lexicons/*` |

Physical-key tables map output sequences left-to-right via greedy longest match.

## 2. Supported layouts

`en-US-qwerty`, `ar-101`, `ru-standard`, plus world layouts (`de-qwertz`, `fr-azerty`, `tr-q`, `el-standard`, `es-latam`, `it-standard`, `pt-abnt`, `uk-standard`, `fa-standard`).

## 3. mapLayout()

Deterministic remap of a single token. Returns `null` if any character cannot be mapped.

## 4. Manual conversion

| Layfix | Flowlary |
|--------|----------|
| `src/layouts/convert.ts` | `layouts/convert.ts` |
| Speed Box UI | `features/layout/speedBox.ts` |

Uses `convertManualText` / `mapLayoutText` — no AI.

## 5. Mixed language

| Layfix | Flowlary |
|--------|----------|
| `src/layouts/sentence.ts` (`planFieldFixes`) | `layouts/sentence.ts` |
| `src/layouts/heuristics.ts` | `layouts/heuristics.ts` |
| `src/safety/tokenize.ts` | `core/safety/tokenize.ts` (upgraded) |

Token-level planning with two-pass overlay and `LOCAL_CONTEXT_RADIUS = 3`.

## 6. Candidate selection

`tokenizeText` → infer source layout → `candidateTargets` → `mapLayout` → `canCommitMismatch`.

## 7. Ambiguous classification

When `localClassificationHint` returns `null`.

## 8. Classifier API

Layfix: content → SW `CHECK_WORD` → `POST /api/analyze-word`.

Flowlary: `LayoutClassifier` → `chrome.runtime.sendMessage({ type: 'CHECK_WORD' })` → `background/classify.ts` → fetch `http://127.0.0.1:8003/api/analyze-word`.

Model (source): `allam-2-7b` via Groq on backend.

## 9. wordCacheV2

Layfix persisted cache deferred to Phase 12. Phase 4 uses in-memory `LayoutCache` + `CacheCoordinator` (`FIX_LAYOUT:` keys).

Cache key (Layfix): `{word}|{source}|{sorted candidates}[|ctx:{...}]`.

## 10. Personal exceptions

| Layfix | Flowlary |
|--------|----------|
| `src/profile/exceptions.ts` | `features/layout/profile/exceptions.ts` |
| Storage `autofixProfile` | `flowlary.layout.profile` (Phase 4 abstraction, migration Phase 10) |

## 11. Trust / accept / ignore / revert

| Layfix | Flowlary |
|--------|----------|
| `src/profile/learn.ts` | `features/layout/profile/trust.ts` |

`REVERT_EXCEPTION_THRESHOLD = 2` adds exception.

## 12. History

Layfix `autofixHistory` — not ported (Phase 11 unified history).

## 13. Ctrl+Shift+P

Layfix `FIX_CURRENT_TEXT` → Flowlary `FIX_LAYOUT` via `CommandOrchestrator` → `LayoutFeature.execute` → `fixCurrentText.ts`.

## 14. Ctrl+Shift+L

Layfix Speed Box with `window.addEventListener` → Flowlary Speed Box toggled via `CommandOrchestrator.onSpeedBox` + `InputEngine` shortcut event (no global listener).

## 15. Stale prevention

`FieldSession.canCommit`, generation checks, `writeReplacement` stale gates, `shortcutSessionStillValid`.

## 16. DOM replacement

Layfix `commitReplacement` → Flowlary `writeReplacement(..., { origin: 'FIX_LAYOUT' })`.

## 17. Rapid typing

Boundary-triggered evaluation (Space/Enter/Tab/blur) — no per-keystroke classifier.

## 18. Safety

Unified Flowlary `evaluateFieldSafety` before commands; token guards via `isSafeToken`.

## 19. Backend endpoints

`/api/analyze-word` — classifier only. Translation/correction not implemented.

## 20. Local vs AI

| Local | AI |
|-------|-----|
| `mapLayout`, `planFieldFixes`, lexicons, heuristics, Speed Box, manual FIX_LAYOUT | Classifier verdict only (`VALID` / `LAYOUT_MISMATCH`) |

## Architecture change

Layfix standalone content script listeners → Flowlary:

```
InputEngine → EventBus → LayoutScheduler (auto)
CommandOrchestrator → LayoutFeature.execute (manual FIX_LAYOUT)
CommandOrchestrator.onSpeedBox → SpeedBox UI
```

No second content script. No feature-level `document.addEventListener`.
