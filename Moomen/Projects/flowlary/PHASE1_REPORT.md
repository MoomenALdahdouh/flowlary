# Phase 1 Report — Flowlary Foundation

**Date:** 25 Aug 2026  
**Phase:** 1 — New monorepo + core scaffold  
**Status:** ✅ Complete

---

## 1. Files Created

### Monorepo root
- `package.json`, `README.md`, `.gitignore`

### Extension (`extension/`)
- `manifest.json` — MV3, single content script, SW, popup, commands
- `vite.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `tsconfig.json`, `package.json`
- `src/content_script.ts` — single content entry
- `src/background/index.ts` — single service worker
- `src/popup/` — minimal React shell (App, main, index.html, tokens.css)
- `src/core/input/InputEngine.ts`
- `src/core/session/FieldSession.ts`
- `src/core/router/CommandRouter.ts`
- `src/core/events/EventBus.ts`
- `src/core/state/StateManager.ts`
- `src/core/dom/` — read, write, verify, composition, caret, frameGuard, types
- `src/core/safety/` — fields, tokenKind, domains, markdown, index
- `src/features/correction|translation|layout/` — stub interfaces
- `src/storage/index.ts`
- `src/messaging/types.ts`
- `icons/` — copied from Lingo reference (read-only source)

### Shared package (`packages/shared/`)
- Types: `OperationType`, `Command`, `CommandResult`, `SafetyDecision`, `STORAGE_KEYS`
- AI contracts: `CorrectionAI`, `TranslationAI`, `LayoutClassifierAI`
- Feature interfaces + stubs
- `CacheCoordinator` + `buildCacheKey`

### Backend (`backend/`)
- Placeholder package (no routes yet)

### Tests (`tests/`)
- `unit/` — inputEngine, fieldSession, safety, commandRouter, storage, messaging, dom
- `integration/manifest.test.ts`
- `packages/shared/src/cache.test.ts`

### Documentation (`docs/`)
- `architecture/FLOWLARY_ARCHITECTURE.md`
- `architecture/TEST_MIGRATION.md`
- `development/PHASES.md`
- `privacy/PRIVACY.md`

---

## 2. Architecture Implemented

| Component | Status |
|-----------|--------|
| ONE content script (`content_script.ts`) | ✅ |
| ONE service worker (`background/index.ts`) | ✅ |
| ONE popup (React shell) | ✅ |
| InputEngine (single document listener owner) | ✅ |
| FieldSession (data model + lifecycle) | ✅ |
| CommandRouter (handler registration + dispatch) | ✅ |
| Unified DOM layer (read/write/verify/snapshot) | ✅ |
| Unified safety gate (Lingo/Layfix baseline) | ✅ |
| Storage namespace (`flowlary.*`) | ✅ |
| CacheCoordinator (operation-isolated keys) | ✅ |
| Messaging (`GET_STATUS`, `DISPATCH_COMMAND`, …) | ✅ |
| Feature stubs (correction, translation, layout) | ✅ |
| AI provider interfaces (no implementation) | ✅ |

---

## 3. Decisions Made

### iframe policy
- **Manifest:** `all_frames: true` (FL0 audit recommendation — EWA same-origin iframe support).
- **Runtime:** `shouldProcessFrame()` skips cross-origin iframes; same-origin iframes allowed.
- Documented in `docs/architecture/FLOWLARY_ARCHITECTURE.md`.

### Speed box shortcut
- **Not** registered as manifest command (matches Layfix).
- `Ctrl/Cmd+Shift+L` will be content-script listener in Phase 4.

### Manifest commands
- `TRANSLATE` → Ctrl/Cmd+Shift+Comma
- `FIX_LAYOUT` → Ctrl/Cmd+Shift+P

### Build tooling
- Vite 6 + `@crxjs/vite-plugin` (proven by Lingo/Layfix).
- Vitest + happy-dom for DOM tests.

### Permissions (union from audit)
- `storage`, `activeTab`, `clipboardWrite`
- Host permissions: Groq BYOK + dev API ports + production API placeholders

---

## 4. Decisions Intentionally Deferred

| Item | Target phase |
|------|--------------|
| Groq correction (BYOK) | 7 |
| Translation API | 5–6 |
| Layout classification + mapLayout | 4 |
| CorrectionCard UI | 8 |
| Live translation (750ms) | 6 |
| Storage migration from legacy keys | 10 |
| Unified history | 11 |
| License / entitlement unification | 10 |
| Backend route mounting | 12+ |
| Speed box overlay | 4 |
| InputEngine → CommandRouter event wiring | 3 |
| Persistent word cache migration | 10 |

---

## 5. Tests Created

| # | Test | File |
|---|------|------|
| 1 | InputEngine detects textarea | `tests/unit/inputEngine.test.ts` |
| 2 | InputEngine detects text input | same |
| 3 | InputEngine detects contenteditable | same |
| 4 | FieldSession generation increments | `tests/unit/fieldSession.test.ts` |
| 5 | FieldSession rejects stale operation | same |
| 6 | Safety blocks password fields | `tests/unit/safety.test.ts` |
| 7 | Safety blocks OTP-like fields | same |
| 8 | Router dispatches CORRECT | `tests/unit/commandRouter.test.ts` |
| 9 | Router dispatches TRANSLATE | same |
| 10 | Router dispatches FIX_LAYOUT | same |
| 11 | Router does not cross-dispatch | same |
| 12 | Cache keys are operation-specific | `packages/shared/src/cache.test.ts` |
| 13 | Storage namespaces isolated | `tests/unit/storage.test.ts` |
| 14 | Messaging responds to GET_STATUS | `tests/unit/messaging.test.ts` |
| 15 | ONE content entry | `tests/integration/manifest.test.ts` |
| 16 | ONE service worker | same |

Additional: DOM read/write/caret/stale tests (`tests/unit/dom.test.ts`).

**Total:** 34 tests, all passing.

---

## 6. Build Result

```
npm run build
✓ built in 744ms
dist/manifest.json
dist/src/popup/index.html
dist/assets/content_script.ts-*.js
dist/assets/index.ts-*.js (service worker)
```

---

## 7. Test Result

```
npm test
packages/shared: 5 passed
extension:       29 passed
Total:           34 passed
```

---

## 8. Warnings

1. **Icons** copied from Lingo reference repo for build convenience — replace with Flowlary-branded icons before store submission.
2. **Production API host** `flowlary-api.zaixos.com` is a placeholder — not verified as deployed.
3. **Background `DISPATCH_COMMAND`** routes to stub handlers returning `feature_not_ported`.
4. **InputEngine** does not yet wire normalized events to CommandRouter (Phase 3).
5. **EWA `all_frames` iframe behavior** in cross-origin contexts is intentionally skipped — may differ from EWA for cross-origin embeds.

---

## 9. Unresolved Issues

| Issue | Notes |
|-------|-------|
| Entitlement product ID unification | Business decision — Lingo `LINGO` vs Layfix product TBD |
| Unified backend vs dual FastAPI services | Deferred; three routes can coexist initially |
| `packages/shared` TypeScript path in extension tests | Works via workspace `*` dependency |

None block Phase 2.

---

## 10. Exact Next Recommended Phase

**Phase 2 — DOM / Safety / FieldSession hardening**

1. Port characterization tests from EWA adapters, Lingo/Layfix dom/safety (see `TEST_MIGRATION.md`).
2. Harden FieldSession mutex integration with DOM generation map.
3. Expand safety tests (markdown fences, excluded domains, code regions).
4. Add EWA adapter bridge for edge cases (code editor detection).
5. Do **not** port feature AI or CorrectionCard yet.

---

## Original Repositories

**Not modified.** All work is in `Moomen/Projects/flowlary/`.

---

*Phase 1 complete — awaiting approval before Phase 2.*
