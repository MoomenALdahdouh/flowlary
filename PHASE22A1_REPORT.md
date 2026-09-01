# Phase 22A.1 — Critical Product Reconciliation

**Status:** Complete  
**Scope:** Stop Progress pollution; honest empty states; Practice placeholder; BYOK field cleanup; docs/tests.  
**No LearningEvent, PracticeSession, onboarding, or metrics invented.**

---

## 1. Files changed

### Extension — Progress / IA
| File | Change |
|------|--------|
| `extension/src/dashboard/panels/ProgressPanel.tsx` | **REDESIGN** — removed `fetchHistory` / `HistoryStats`; honest empty state only |
| `extension/src/dashboard/panels/PracticePanel.tsx` | **ADD** — safe “coming soon” placeholder |
| `extension/src/dashboard/App.tsx` | **REDESIGN** — nav: Overview · Progress · Practice · Settings · Privacy · Account; `#activity` direct route; View activity → `#activity` |
| `extension/src/popup/i18n/messages.ts` | **REDESIGN** — progress/practice copy; removed activity metric strings |

### Extension — BYOK cleanup
| File | Change |
|------|--------|
| `extension/src/core/state/StateManager.ts` | **REMOVE** `aiProvider`, `groqApiKey`, `CorrectionAiProvider` from user settings |
| `extension/src/storage/schemas.ts` | **REDESIGN** — `normalizeCorrection` strips legacy provider fields |
| `extension/src/storage/facade.ts` | **REDESIGN** — `setCorrectionSettings` no longer writes provider fields |
| `extension/src/storage/retireByok.ts` | **REDESIGN** — detects legacy fields in raw storage; clears `correctionGroqKey` |
| `extension/src/storage/migration/steps/ewa.ts` | **REDESIGN** — migration no longer attaches groq to correction settings |
| `extension/src/features/correction/CorrectionFeature.ts` | **REMOVE** `missing_api_key` dead path |
| `extension/src/config/auth.ts` | **REMOVE** `'byok'` from entitlement header types |

### Backend
| File | Change |
|------|--------|
| `backend/src/middleware/entitlement.ts` | **REMOVE** `'byok'` from valid client claims |
| `backend/src/middleware/rateLimit.ts` | **REMOVE** dead `byok` tier |

### Shared domain boundaries
| File | Change |
|------|--------|
| `packages/shared/src/events.ts` | **ADD** — `ActivityEventKind`, `LearningEventKind`, `SystemEventKind` (types only) |
| `packages/shared/src/index.ts` | export events |

### Website / docs
| File | Change |
|------|--------|
| `website/src/i18n/ar.ts` | **REMOVE** user-facing BYOK/Groq copy |
| `README.md` | Flowlary AI (not BYOK) |
| `docs/privacy/DATA_FLOW.md` | **REDESIGN** — Flowlary AI path; activity vs learning section |
| `docs/security/SECURITY_ARCHITECTURE.md` | **REDESIGN** — no client Groq; server credentials only |

### Tests
| File | Change |
|------|--------|
| `tests/integration/phase22a1-reconciliation.test.tsx` | **ADD** — regression suite (A–N) |
| `tests/integration/phase22a-foundation.test.tsx` | Updated nav + Progress expectations |
| `tests/integration/phase-dashboard.test.tsx` | Practice in nav |
| `tests/unit/correction/readiness.test.ts` | Consent-only readiness |
| `tests/unit/storage/retireByok.test.ts` | No provider fields on settings |
| Multiple integration tests | Removed `aiProvider` / `groqApiKey` on `stateManager.correction` |

---

## 2. Progress data-source changes

**Before:** `ProgressPanel` called `fetchHistory()` and rendered `HistoryStats` (CORRECT + TRANSLATE + FIX_LAYOUT counts).

**After:** Progress reads **nothing** from `flowlary.history`. It shows:

- Title: Progress  
- Lead: language improvement trends (future)  
- Empty state: “Your progress is building” + guidance to keep writing  
- Optional link: View activity log (navigates to `#activity`)

No fake Errors/100 words, trends, or type breakdowns.

---

## 3. Activity routing changes

| Route | Behavior |
|-------|----------|
| `#activity` | Full Activity log (`HistoryPanel`) — **KEEP** |
| Settings → Data | Embedded `HistoryPanel` — **KEEP** |
| Progress → View activity | Now `go('activity')` — **FIXED** (was `go('settings')`) |
| `#history` | Alias → `#activity` — **KEEP** |

Activity engine unchanged: `flowlary.history`, dedupe, 50 cap, privacy gates.

---

## 4. Practice route status

| Item | Status |
|------|--------|
| Nav item | **ADD** — “Practice” between Progress and Settings |
| `#practice` hash | Renders `PracticePanel` placeholder |
| Functionality | **NOT IMPLEMENTED** — clear “coming soon” copy |
| LearningEvent / editor / sessions | **DEFER** Phase 22D |

---

## 5. BYOK/Groq cleanup

### Removed from user domain
- `CorrectionSettings.aiProvider` / `groqApiKey`
- `CorrectionFeature.missing_api_key`
- Client `'byok'` entitlement claim
- Server rate-limit `byok` tier
- Arabic website BYOK strings

### Kept (internal)
- `backend/src/providers/groqClient.ts`
- `GROQ_API_KEY` in backend env
- AI gateway + providers
- `STORAGE_KEYS.correctionGroqKey` for migration/retirement only
- `retireByokIfNeeded` on extension startup

User sees **Flowlary AI** only.

---

## 6. Migration behavior

1. Legacy installs may still have `flowlary.correction.groqKey` and `{ aiProvider: 'byok' }` in stored correction JSON from pre-22A.
2. `retireByokIfNeeded` (startup): deletes groq key storage; rewrites correction settings without legacy fields.
3. EWA migration may still move legacy `ewa_groq_api_key` → `correctionGroqKey` once; retirement clears it on next run.
4. Keys are never logged, displayed, exported, or sent to Flowlary servers.

---

## 7. Privacy/documentation changes

- **DATA_FLOW.md:** Correction via Flowlary API; activity vs learning split; Speed Box not in activity; honest remote/local table.
- **SECURITY_ARCHITECTURE.md:** No `api.groq.com` host permission; server-side provider credentials.
- **README.md:** Flowlary AI for correction.
- **Arabic i18n:** Aligned with English Flowlary AI narrative.

**Honest claims preserved:** writing text leaves device for Flowlary AI when correction/translation/classifier run; activity stays local; server stores usage metadata not writing text.

**Remaining:** Historical phase reports (`PHASE16_REPORT.md`, `AI_PRODUCTION_ARCHITECTURE.md`, etc.) still mention BYOK as archive — **DEFER** bulk doc sweep to Phase 22B planning.

---

## 8. Tests added/changed

**New:** `tests/integration/phase22a1-reconciliation.test.tsx` (10 tests)

Covers:
- A–D: Progress does not fetch history; no activity metrics on Progress
- E–G: Activity under Settings/Data; View activity → `#activity`
- H: Honest Progress empty state
- I: Practice placeholder
- J–N: No BYOK UI; no provider fields on StateManager; no `missing_api_key`; retireByok; manifest; backend unchanged

**Updated:** phase22a-foundation, phase-dashboard, phase10-migration, readiness, retireByok, and tests that set removed correction fields.

---

## 9. Full test result

```
Test Files  77 passed (77)
Tests       558 passed (558)
Duration    ~8s
```

---

## 10. Production build result

```
npm run build — success
Extension dist v1.1.0 built
Website prerender — success (via monorepo build)
```

---

## 11. Remaining work for Phase 22B

1. **LearningProfile** + onboarding flow (consent folded into welcome)
2. **LearningEvent** persistence at correction accept/reject (use existing `CorrectionChange[]`)
3. **Progress metrics** from learning store only (errors/100 words, by type, trends)
4. **Settings → Learning** real fields (learning language, level, focus)
5. **Layout pickers** in Settings (today: Speed Box only)
6. **Export/import** and granular data resets
7. **Historical doc sweep** — phase reports, store listing copy, `PRIVACY.md` BYOK sections
8. **Remove** migration-only `correctionGroqKey` path once upgrade cohort is negligible

---

**STOP.** No LearningEvent implementation, no Practice editor, no invented metrics. Product architecture is now semantically safe to build Phase 22B on.
