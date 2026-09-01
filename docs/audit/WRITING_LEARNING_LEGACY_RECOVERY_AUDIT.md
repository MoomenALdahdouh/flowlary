# Writing Learning Legacy Recovery Audit

**Date:** 2026-08-27  
**Mode:** FORENSIC RECOVERY AUDIT ONLY — no production code changes  
**Legacy source:** https://github.com/MoomenALdahdouh/english-writing-assistant.git  
**Legacy clone location:** `/tmp/flowlary-legacy-writing-assistant` (isolated, read-only)  
**Current project:** `/Users/moomen/Projects/flowlary`

---

## Executive Summary

### A. How complete was the original Writing Learning system?

**The authoritative legacy GitHub repository did not contain a Writing Learning system.**

Forensic inspection of all six commits on `origin/master` (2025-08-15 → 2025-08-16) shows the legacy *English Writing Assistant* (EWA) was a **correction-only Chrome extension**: inline spelling/grammar/wording fixes, box/direct modes, Groq-backed AI, and a **simple correction history list** in the popup. There is **no** learning event layer, no progress metrics, no dashboard analytics, no practice mode, no personalized feedback, and no recurring-error engine in any commit, branch, or tag.

The Writing Learning product loop (Write → Notice → Understand → Practice → Improve) was **designed and implemented inside Flowlary** during Phase 22 (Aug 2025), as documented in `PHASE22_PRODUCT_RECONCILIATION_AUDIT.md` (“No learning layer exists” at Phase 21 baseline) and implemented in Phase 22B/22C/22D.

**Legacy completeness for Writing Learning: 0%** (feature category absent).  
**Legacy completeness for correction foundation: ~95%** (fully functional correction product).

### B. How much of it still exists in current Flowlary?

| Domain | Legacy had it | Current Flowlary |
|--------|---------------|------------------|
| Correction pipeline (box/direct, debounce, Groq) | Yes | **FULLY PRESERVED** (ported Phases 1–7, gateway Phase 16+) |
| ChangeType taxonomy (spelling/grammar/wording) | Yes | **FULLY PRESERVED** (`packages/shared/src/correction/index.ts`) |
| Simple correction history | Yes | **MOVED** → unified `HistoryService` + Activity panel |
| Learning events | **No** | **IMPLEMENTED NEW** (Phase 22C) |
| Error rate / errors per 100 words | **No** | **IMPLEMENTED NEW** (`progress.ts`) |
| Progress dashboard | **No** | **IMPLEMENTED NEW** (`ProgressPanel.tsx`) |
| Practice | **No** | **IMPLEMENTED NEW** (Phase 22D) |
| Personalized feedback | **No** | **PARTIAL** (recommendation engine only; no narrative “rising error rate” copy from screenshots) |
| Recurring error detection | **No** | **IMPLEMENTED NEW** (`computeRecurringPatterns`) |

**Estimated preservation of legacy *correction* code paths: ~90%** (logic ported; architecture refactored into InputEngine/CorrectionFeature/AiGateway).  
**Estimated preservation of legacy *Writing Learning*: N/A** — it never existed in the legacy repo.

### C. How much can be recovered directly?

**From the legacy GitHub repository: correction foundation only — and it is already recovered.**

Directly reusable legacy artifacts already present in Flowlary:

- `CORRECTION_SYSTEM_PROMPT` (verbatim lineage)
- `ChangeType` / `CorrectionChange` schema
- Debounce thresholds (`DEBOUNCE_MS`, `MIN_CHARS`, `MIN_WORDS`, `MAX_ASSIST_CHARS`)
- Box vs direct mode semantics
- `instantSpell` local typo map (direct mode)
- `mergeCorrection` stale-guard logic
- `extractWritingContext` / segment truncation
- History diff token coloring concept (`tokenDiff.ts`)

**Writing Learning components: 0 recoverable from legacy** (not present in source).

### D. How much would require porting?

**0 Writing Learning features** require porting from legacy (source not found).

**2 correction-adjacent UX behaviors** could still be ported if desired (optional, not blocking):

1. **History diff coloring by change type** — legacy `HistoryDiff.tsx` + `tokenDiff.ts` classify edits as spelling/grammar/wording in the popup history list. Current Activity panel shows entries but does not reuse this diff visualization.
2. **Legacy popup history as lightweight fallback** — EWA stored `{ id, timestamp, original, corrected }` without operation type; Flowlary history is richer but EWA migration preserves raw arrays under `history.ewa`.

### E. How much truly needs rewriting?

**0 features** need rewriting because legacy source is missing — the Writing Learning stack was **authored in Flowlary**, not lost from EWA.

What **does** need work (reconnection, not rewrite):

- **Phase 3A P1 wiring gaps** — content-script account context, practice session key alignment, layout learning connection (see Section 20).
- **Product gaps vs screenshot expectations** — `focusAreas` not wired to recommendations; no speech/listening practice controls; trend compares error counts not error rate.

### F. Single most valuable legacy component to recover first

**None for Writing Learning** — the legacy repo cannot supply it.

For the overall product, the highest-value action is **not legacy recovery** but **reconnecting the existing Phase 22 Writing Learning stack to the live content-script correction path** (account context bootstrap in content script realm). The correction foundation from EWA is already integrated.

---

## 1. Legacy Repository Identification

| Field | Value |
|-------|-------|
| URL | https://github.com/MoomenALdahdouh/english-writing-assistant.git |
| Clone path | `/tmp/flowlary-legacy-writing-assistant` |
| Remote verified | Yes (`origin` matches expected URL) |
| Default branch | `master` |
| Commits | 6 (entire history) |
| Branches | `master` only |
| Tags | None |
| Date range | 2025-08-15 17:24 → 2025-08-16 15:27 (+0300) |
| Product name | English Writing Assistant (EWA) |
| Package scope | `@ewa/shared` |

---

## 2. Current Working Tree (Audit Start)

Recorded at audit time — **no modifications made**.

| Field | Value |
|-------|-------|
| Branch | `main` |
| HEAD commit | `61f349827f111231dd8ebdac1c557478dcb10cb8` |
| Commit message | `feat: add production readiness audit and entitlement gating` |
| Ahead of origin | 2 commits |
| Modified tracked files | 111 |
| Untracked files | Many (Phase reports, dashboard, learning, website, tests, `.qa-shots/`) |

---

## 3. Legacy Repository Inventory

### Root

| Directory / file | Purpose | Key files | Responsibilities | Current equivalent |
|------------------|---------|-------------|------------------|-------------------|
| `README.md` | Developer landing | — | Install, BYOK Groq key, box/direct usage | `README.md`, `website/` |
| `PRIVACY.md` | Privacy summary | — | Local key, Groq forwarding, history in Chrome storage | `docs/privacy/PRIVACY.md` |
| `STORE.md` | Chrome Web Store checklist | — | Listing copy, privacy URL | `docs/release/` |
| `LIMITATIONS.md` | Product limits | — | 250-char assist cap, iframe rules, direct-mode merge | Correction readiness docs |
| `package.json` | Monorepo root | workspaces: extension, backend, packages/shared | Build orchestration | Root `package.json` |
| `scripts/` | Dev tooling | `pack-store.mjs`, `measure-groq-latency.mjs`, `secret-scan.mjs` | Store zip, latency probe | `scripts/` in Flowlary |

### `extension/`

| Area | Purpose | Key files | Responsibilities | Current equivalent |
|------|---------|-----------|------------------|-------------------|
| `src/content/` | In-page correction runtime | `index.ts`, `debounce.ts`, `segment.ts`, `mergeCorrection.ts`, `instantSpell.ts` | Focus tracking, debounced Groq requests, box/direct apply, instant spell | `CorrectionScheduler`, `applyCorrection.ts`, `CorrectionFeature` |
| `src/background/` | Service worker | `index.ts`, `groqCorrect.ts` | Settings, history, Groq BYOK + backend fallback, LRU cache | `background/index.ts`, `background/correct.ts`, AiGateway |
| `src/popup/` | Settings + history UI | `App.tsx`, `HistoryDiff.tsx` | Consent, Groq key, mode toggle, history list with diff | `popup/` + `dashboard/` (expanded) |
| `src/ui/correction-card/` | Box-mode suggestion row | `CorrectionCard.ts`, `hostStyleAdapter.ts` | Inline card, apply button, highlights | `features/correction/ui/CorrectionCard.ts` |
| `src/adapters/` | DOM input adapters | `index.ts` | textarea, input, contenteditable detection | `core/dom/EditableAdapter` |
| `src/diff/` | History visualization | `tokenDiff.ts` | Token diff + change-type coloring | **Not ported** to Activity panel |
| `src/language/` | English detection | `detect.ts` | Eligibility gating | `features/correction/language.ts` |
| `src/storage/` | Settings + history | `settings.ts` | `ewa_settings`, `ewa_history`, `ewa_groq_api_key` | `storage/facade.ts`, account-scoped keys |
| `src/shared/` | Messages, cache, logger | `messages.ts`, `cache.ts` | IPC types, LRU cache | `messaging/types.ts`, shared cache |
| `e2e/` | Playwright smoke tests | 2 specs | Extension load | Flowlary integration tests |

**Not present in legacy extension:** `dashboard/`, `learning/`, `practice/`, `progress/`, `entitlement/`, `translation/`, `layout/`.

### `backend/`

| File | Purpose | Current equivalent |
|------|---------|-------------------|
| `src/routes/correct.ts` | POST `/api/correct` | `backend/src/routes/http.ts` + gateway |
| `src/services/groq.ts` | Groq structured output correction | Gateway correction provider |
| `src/middleware/rateLimit.ts` | IP rate limit | `backend/src/middleware/rateLimit.ts` |
| `src/config.ts` | `GROQ_API_KEY`, model | `backend/src/config/env.ts` |

### `packages/shared/`

| Export | Purpose | Current equivalent |
|--------|---------|-------------------|
| `ChangeType`, `CorrectionChange`, `CorrectionResponse` | AI response schema | `packages/shared/src/correction/index.ts` |
| `CORRECTION_SYSTEM_PROMPT` | Groq system prompt | Same prompt in Flowlary shared (near-identical) |
| `GROQ_CORRECTION_JSON_SCHEMA` | Structured output schema | Gateway provider |
| `DEFAULTS` | Debounce, limits, model | `CORRECTION_DEFAULTS` |
| `PRODUCT` | URLs, branding | `packages/shared/src/brand.ts` |

### `site/`

Static marketing site (`writing.zaixos.com`) — privacy, terms, landing.  
Current equivalent: `website/` (Flowlary brand).

---

## 4. Legacy Git History

| Date | Commit | Message | Files changed | Features added | Features removed | Architectural changes |
|------|--------|---------|---------------|----------------|------------------|----------------------|
| 2025-08-15 | `a0365e9` | Add English Writing Assistant extension and Groq-backed API | 81 files (+14,374) | **Initial product**: MV3 extension, content script correction, CorrectionCard, popup settings/history, optional backend, shared types, static site | — | Monorepo scaffold |
| 2025-08-15 | `b78ca1f` | Speed up corrections and harden local API fallbacks | 13 files | `instantSpell.ts`, faster debounce, backend coerce tests, multi-URL fallback | — | Performance hardening |
| 2025-08-15 | `99af72d` | Add bring-your-own Groq key | 14 files | Client-side Groq (`groqCorrect.ts`), BYOK popup UX, no hosted backend required | Backend as default for store builds | **Security model shift** to user-owned keys |
| 2025-08-16 | `5924008` | Polish README | 1 file | Docs only | — | — |
| 2025-08-16 | `894057f` | Restyle README | 1 file | Docs only | — | — |
| 2025-08-16 | `ea3a7bb` | Polish README (Simple Notes style) | 1 file | Docs only | — | — |

**Commits involving learning/history/practice/dashboard/analytics:**  
- **History:** present from `a0365e9` — simple `HistoryItem[]` in popup only. No analytics.  
- **learning, practice, progress, dashboard, analytics, personalization:** **NOT FOUND in any commit.**

**Deleted features:** None observed — linear 6-commit history with no feature removals.

---

## 5. Legacy Architecture

Actual runtime (mapped to files):

```
USER INPUT
  extension/src/adapters/index.ts (findEditableFromTarget)
  extension/src/content/index.ts (focus/input handlers)
        ↓
DETECTION
  extension/src/language/detect.ts (shouldShowEnglishAssistant, isEligibleForCorrection)
  packages/shared DEFAULTS (MIN_CHARS=8, MIN_WORDS=3, MAX_ASSIST_CHARS=250)
        ↓
CORRECTION
  extension/src/content/debounce.ts (IntelligentDebouncer)
  extension/src/content/instantSpell.ts (direct mode local fixes only)
  extension/src/background/index.ts → groqCorrect.ts OR backend/src/routes/correct.ts
  backend/src/services/groq.ts (Groq llama-3.1-8b-instant)
        ↓
LEARNING EVENT
  ❌ NOT IMPLEMENTED — no LearningEvent, no category persistence beyond AI response
        ↓
STORAGE
  extension/src/storage/settings.ts
    - chrome.storage.sync: ewa_settings
    - chrome.storage.local: ewa_groq_api_key, ewa_history
        ↓
ANALYTICS
  ❌ NOT IMPLEMENTED
        ↓
DASHBOARD
  ❌ NOT IMPLEMENTED — popup only (App.tsx)
        ↓
PRACTICE
  ❌ NOT IMPLEMENTED
```

**History side-path (not learning):**

```
applyCorrection() → ADD_HISTORY message → addHistoryItem()
  Used for: box-mode user apply + direct-mode auto-apply
  NOT used for: card dismiss, detection-only, rejected suggestions
```

---

## 6. Legacy Correction Pipeline

### Detection & correction

| Aspect | Legacy implementation | Evidence |
|--------|----------------------|----------|
| Spelling/grammar/wording | Groq JSON response with typed `changes[]` | `packages/shared/src/index.ts`, `backend/src/services/groq.ts` |
| Trigger | Input debounce after word/sentence boundary | `content/debounce.ts`, `content/index.ts:onInput` |
| Debounce (box) | 120ms default / 45ms word / 30ms sentence | `DEFAULTS` in shared |
| Debounce (direct) | 90ms / 25ms / 20ms | `DEFAULTS` |
| Text thresholds | MIN_CHARS=8, MIN_WORDS=3, MAX_ASSIST=250, MAX_CORRECTION=2000 | `DEFAULTS` |
| Provider | Groq `llama-3.1-8b-instant` | `GROQ_MODEL_DEFAULT` |
| API | User BYOK → `api.groq.com`; dev → `POST /api/correct` | `background/groqCorrect.ts`, `background/index.ts` |
| Response validation | Zod `CorrectionResponseSchema` + `coerceCorrectionPayload` | shared + backend |
| Caching | LRU 50 entries keyed by text hash | `shared/cache.ts`, background |
| Instant spell | Direct mode only, word-boundary triggered | `content/instantSpell.ts` |

### Box mode vs direct mode

| Mode | Legacy behavior | File |
|------|----------------|------|
| **Box** (`correctionMode !== 'direct'`) | Show CorrectionCard; user clicks Apply → `applyCorrection` → history | `content/index.ts:applyResult`, `CorrectionCard.ts` |
| **Direct** | Auto-merge on API result; no card; instant spell pre-pass | `content/index.ts:applyResult`, `maybeApplyInstantSpelling` |
| **Dismiss** | Card `hide()` — **no history, no reject record** | `CorrectionCard.ts:hide` |

### Comparison to current Flowlary

| Legacy | Current |
|--------|---------|
| Monolithic content script | `InputEngine` + `CorrectionScheduler` + `CorrectionFeature` |
| Direct Groq BYOK | AiGateway managed AI (+ retired BYOK path) |
| ADD_HISTORY on apply | `recordHistory` + `recordCorrectionAccepted/Detected/Rejected` |
| No learning events | Full `LearningEventService` |
| Same prompt & taxonomy | Preserved in `@flowlary/shared` |

---

## 7. Legacy Learning Events

**NOT FOUND.**

Repository-wide search for `LearningEvent`, `learningEvents`, `recordLearning`, `recordCorrection` (learning sense), `sampleHash`, `normalizedOriginal` returned **zero implementation matches** (only unrelated text in `site/privacy.html`).

### What caused a legacy “learning-like” record?

Only **history append on successful apply**:

- **Box mode:** user clicks Apply → `applyCorrection` → `ADD_HISTORY`
- **Direct mode:** API result auto-applied → `applyCorrection` → `ADD_HISTORY`
- **Detection (card shown):** no record
- **Dismiss:** no record

History schema:

```typescript
// extension/src/storage/settings.ts
type HistoryItem = { id, timestamp, original, corrected }
```

No category, action, batch, normalization, or dedupe key at storage layer. Category exists only transiently in AI `changes[]` and history diff display.

---

## 8. Legacy Learning Taxonomy

### In AI response only

| Internal name | Display | Color in history diff | Storage | Dashboard | Practice |
|---------------|---------|----------------------|---------|-----------|----------|
| `spelling` | via CSS class `spelling` | red-ish in popup | ❌ not persisted per entry | ❌ | ❌ |
| `grammar` | CSS class `grammar` | ❌ | ❌ | ❌ | ❌ |
| `wording` | CSS class `wording` | ❌ | ❌ | ❌ | ❌ |

`tokenDiff.ts:classifyHistoryChange()` infers type from token diff when AI changes array unavailable.

**No `layout` category** in legacy (layout feature absent).

### Current Flowlary comparison

`ChangeType` adds `layout`. `LearningEventCategory` = `ChangeType`. Full persistence with `category` on every event.

---

## 9. Legacy Accept / Reject Semantics

| Semantic | Legacy | Evidence |
|----------|--------|----------|
| Detected | Implicit (card shown) — **not recorded** | `setReady()` only updates UI |
| Accepted | User Apply or direct auto-apply → history | `applyCorrection` → `ADD_HISTORY` |
| Rejected | Card hidden / ignored — **not recorded** | `hide()` no message |
| Ignored | Field cleared, stale results skipped | `isResultStillRelevant`, `mergeCorrection` null |
| Applied (automatic) | Direct mode auto-merge | `applyResult` direct branch |
| Applied (manual) | Box Apply click | `CorrectionCard.applyIfReady` |

**Safe reuse today:** Flowlary's explicit `detected | accepted | rejected` model is **strictly richer** than legacy. Do not downgrade to history-only semantics.

---

## 10. Legacy Dashboard

**NOT FOUND.**

Legacy UI surfaces:

| Surface | File | Data |
|---------|------|------|
| Popup settings | `popup/App.tsx` | Settings, Groq key, mode, pause |
| Popup history | `popup/App.tsx` + `HistoryDiff.tsx` | `ewa_history` list, diff tokens |

No error rate, trends, charts, recent mistakes panel, practice controls, or personalized feedback.

---

## 11. Legacy Metrics — Exact Formulas

| Metric | Formula in legacy code |
|--------|------------------------|
| Error rate | **FORMULA NOT FOUND** |
| Errors per 100 words | **FORMULA NOT FOUND** |
| Total errors | **FORMULA NOT FOUND** |
| Unique errors | **FORMULA NOT FOUND** |
| Category counts | **FORMULA NOT FOUND** |
| Trend | **FORMULA NOT FOUND** |
| Recurrence | **FORMULA NOT FOUND** |
| Improvement | **FORMULA NOT FOUND** |

Closest legacy computation: `countEdits(tokens)` in `HistoryDiff.tsx` — counts diff tokens per history entry for badge display, not aggregate analytics.

**Current Flowlary formulas (Phase 22C — not from legacy):**

```
errorCount = |unique keys (batchId:category:normalizedOriginal)| excluding rejected
wordsWritten = sum(unique sampleHash word counts)
errorsPer100Words = (errorCount / wordsWritten) * 100  [if wordsWritten >= 50]
trendPercent = ((current7dErrors - previous7dErrors) / previous7dErrors) * 100  [if each period >= 3 errors]
recurringPattern = group by (category:normalizedOriginal), count >= 2
```

Source: `extension/src/storage/learning/progress.ts`, `packages/shared/src/learningEvents.ts`.

---

## 12. Legacy Recent Mistakes

**NOT FOUND as a product feature.**

Legacy popup history shows recent corrections (newest first, limit 50) but:

- No "Recent Mistakes" label or filtering by mistake type
- No category column
- No accept/reject distinction
- Data source: `ewa_history` only — not a separate mistakes index

---

## 13. Legacy History

| Aspect | Legacy | Current Flowlary |
|--------|--------|------------------|
| Storage | `chrome.storage.local` key `ewa_history` | Account-scoped `flowlary.account.<id>.history` |
| Schema | `{ id, timestamp, original, corrected }` | `HistoryEntry` with operation, domain, metadata |
| Display | Popup list with token diff | Dashboard Activity panel |
| Filters | None | By operation type |
| Categories | Inferred in diff UI only | Learning separate from Activity |
| Accepted/rejected | Not tracked | Learning events track; history records successful ops |
| Retention | 50 entries (`HISTORY_LIMIT`) | Configurable cap in Flowlary history service |
| Account scoping | Device-global | Account-isolated (Phase 32A) |

Migration: `extension/src/storage/migration/steps/ewa.ts` preserves legacy arrays under `history.ewa`.

---

## 14. Legacy Practice

**NOT FOUND.**

No practice page, session store, prompts, scoring, box/direct practice modes, speech controls, or recommendation engine in any legacy file.

Current Flowlary practice (Phase 22D) is entirely **Flowlary-native**:

- `extension/src/dashboard/panels/PracticePanel.tsx`
- `extension/src/storage/learning/practice/*`
- `packages/shared/src/practice.ts`

---

## 15. Practice Personalization

**NOT FOUND in legacy.**

Current Flowlary implementation (`recommendation.ts`):

```
writingEvents = events where source=writing, action≠rejected, category≠layout
if count=0 → none; count<3 → emerging
recurring patterns: score = count*100 + (25 if latest within 7 days)
if top score >= 200 → ready with pattern
else best category by concentration (count >= 2)
```

No legacy thresholds to recover. Profile `focusAreas` stored but **not wired** to recommendations.

---

## 16. Recurring Error Detection

**NOT FOUND in legacy.**

Current Flowlary (`progress.ts:computeRecurringPatterns`):

- Dedupe key: `batchId:category:normalizedOriginal` (merge detected→accepted)
- Group key: `category:normalizedOriginal`
- Threshold: count >= 2
- Normalization: `trim → collapse whitespace → lowercase` (no stemming)

Legacy history diff could detect repeated *text* visually but has no recurrence algorithm.

---

## 17. Legacy Storage

| Name | Schema | Owner | Account scoping | Retention | Used by |
|------|--------|-------|-----------------|-----------|---------|
| `ewa_settings` (sync) | ExtensionSettings minus key | Device | ❌ global sync | indefinite | Popup, content script |
| `ewa_groq_api_key` (local) | string | Device | ❌ | until cleared | Background Groq calls |
| `ewa_history` (local) | HistoryItem[] | Device | ❌ | max 50 | Popup history |
| In-memory LRU cache | correction response | Session | ❌ | 50 entries | Background |

No IndexedDB, no backend database, no learning keys.

---

## 18. Legacy Account Model

- **Single-user / device-scoped** — no accounts, no sign-in, no installation identity beyond Chrome extension install.
- Settings sync via `chrome.storage.sync` (may sync across Chrome profile devices).
- API key local-only (correctly not synced).
- History local-only, global per browser profile.

**Do not import** into Flowlary's account isolation model.

---

## 19. Legacy AI Architecture

| Aspect | Legacy |
|--------|--------|
| Provider | Groq only |
| Model | `llama-3.1-8b-instant` (default) |
| Prompt | `CORRECTION_SYSTEM_PROMPT` in `@ewa/shared` |
| Client path | Extension → Groq API with user key (BYOK) |
| Server path | Optional local/hosted backend → Groq with server key |
| Validation | Zod schema + coerce aliases |
| Retries | Backend multi-URL fallback; Groq single attempt |
| Caching | LRU 50, text-hash key |
| Token limits | max_tokens 400 (json_object) or 1536 (json_schema) |

**Product logic worth preserving:** prompt wording, change-type taxonomy, smallest-edit preference — **already in Flowlary shared**.

**Do not restore:** client-side Groq key storage, direct `api.groq.com` from extension (retired in Flowlary).

---

## 20. Current Flowlary Architecture

```
USER INPUT → InputEngine / FieldSession
        ↓
DETECTION → correction/language.ts, layout heuristics
        ↓
CORRECTION → CorrectionScheduler / CorrectionFeature → background/correct.ts → AiGateway → Groq
        ↓
LEARNING EVENT → recordCorrectionLearning.ts → LearningEventService (account-scoped)
        ↓
STORAGE → learning.events, learning.sessions, learning.profile (account-scoped)
        ↓
ANALYTICS → progress.ts (computeProgressMetrics)
        ↓
DASHBOARD → ProgressPanel, PracticePanel, OverviewPanel
        ↓
PRACTICE → PracticePanel → recordPractice* → PracticeSessionStore
```

**Known wiring gaps (Phase 3A, still relevant):**

1. Content script may not activate `activeAccountContext` → learning/history writes fail silently.
2. `GET_PROGRESS` practice summary key mismatch (unscoped read vs account-scoped write) — verify fixed in current branch.
3. `focusAreas` not connected to recommendation engine.

---

## 21. Legacy → Current Mapping

| Legacy | Current | Status |
|--------|---------|--------|
| `content/index.ts` correction session | `CorrectionScheduler` + `applyCorrection.ts` | MOVED / REFACTORED |
| `CorrectionCard.ts` | `features/correction/ui/CorrectionCard.ts` | MOVED |
| `background/groqCorrect.ts` | `backend` gateway + retired BYOK | REPLACED (managed AI) |
| `storage/settings.ts` history | `HistoryService` + `recordHistory` | MOVED + ENRICHED |
| `storage/settings.ts` settings | `StateManager` + correction settings schema | MOVED |
| `packages/shared` correction types | `packages/shared/src/correction` | FULLY PRESERVED |
| `diff/tokenDiff.ts` | — | NOT PORTED |
| LearningEventService | `storage/learning/events/` | **NEW in Flowlary** |
| Progress engine | `storage/learning/progress.ts` | **NEW in Flowlary** |
| Practice | `storage/learning/practice/` | **NEW in Flowlary** |
| Dashboard | `extension/src/dashboard/` | **NEW in Flowlary** |
| Error rate / analytics | `progress.ts` | **NEW in Flowlary** |

---

## 22. Recovery Matrix

| Legacy Feature | Legacy Location | Current Equivalent | Status | Recovery |
|---|---|---|---|---|
| Learning Events | ❌ not in legacy | `storage/learning/events/` | NEW (Flowlary) | REUSE CURRENT |
| Spelling Learning | AI taxonomy only | LearningEvent category=spelling | PARTIALLY PRESERVED | REUSE CURRENT |
| Grammar Learning | AI taxonomy only | LearningEvent category=grammar | PARTIALLY PRESERVED | REUSE CURRENT |
| Wording Learning | AI taxonomy only | LearningEvent category=wording | PARTIALLY PRESERVED | REUSE CURRENT |
| Error Rate | ❌ | `progress.ts` | NEW | REUSE CURRENT |
| Errors / 100 Words | ❌ | `progress.ts` | NEW | REUSE CURRENT |
| Error Trend | ❌ | `progress.ts` trend | NEW | REUSE CURRENT |
| Errors By Type | ❌ | `ProgressPanel` byType | NEW | REUSE CURRENT |
| Recent Mistakes | ❌ (history list only) | `ProgressPanel` recentEvents | NEW | REUSE CURRENT |
| History | `settings.ts:ewa_history` | `HistoryService` | MOVED | REUSE CURRENT |
| Recurring Errors | ❌ | `computeRecurringPatterns` | NEW | REUSE CURRENT |
| Personalized Feedback | ❌ | `computePracticeRecommendation` | PARTIAL | RECONNECT (wire focusAreas) |
| Practice | ❌ | `PracticePanel` + stores | NEW | REUSE CURRENT |
| Practice Recommendation | ❌ | `recommendation.ts` | NEW | REUSE CURRENT |
| Box Mode | `content/index.ts` | `applyCorrection.ts` | FULLY PRESERVED | REUSE CURRENT |
| Direct Mode | `content/index.ts` | `applyCorrection.ts` | FULLY PRESERVED | REUSE CURRENT |
| Practice Progress | ❌ | `PracticeSessionStore` + metrics | NEW | REUSE CURRENT |
| Correction prompt | `@ewa/shared` | `@flowlary/shared` correction | FULLY PRESERVED | REUSE CURRENT |
| History diff UI | `HistoryDiff.tsx` | — | MISSING | PORT LEGACY LOGIC (optional) |
| BYOK Groq | `groqCorrect.ts` | Retired | REMOVED | NOT NEEDED |

---

## 23. Current Writing Learning That Must NOT Be Rewritten

Verified present and tested in Flowlary:

| Component | Path | Verified by |
|-----------|------|-------------|
| LearningEvent schema | `packages/shared/src/learningEvents.ts` | unit tests |
| LearningEvent storage + dedupe | `storage/learning/events/index.ts` | phase22c integration |
| Event validation / import sanitize | `storage/learning/events/validation.ts` | unit tests |
| Progress metrics engine | `storage/learning/progress.ts` | `progress.test.ts` |
| Word count denominator | `packages/shared/src/wordCount.ts` | unit tests |
| Correction → learning bridge | `features/learning/recordCorrectionLearning.ts` | phase22c |
| Layout → learning bridge | `features/learning/recordLayoutLearning.ts` | phase3d |
| Accept/reject semantics | `features/correction/applyCorrection.ts` | phase22c, phase7/8 |
| Practice recommendation | `storage/learning/practice/recommendation.ts` | unit + phase22d |
| Practice sessions | `storage/learning/practice/sessions.ts` | phase22d |
| Practice prompts | `storage/learning/practice/prompts.ts` | phase22d |
| Learning profile / onboarding | `storage/learning/index.ts`, `OnboardingFlow.tsx` | phase22b |
| Progress UI | `dashboard/panels/ProgressPanel.tsx` | phase-dashboard |
| Practice UI | `dashboard/panels/PracticePanel.tsx` | phase22d |
| Account-scoped learning keys | `accountScopedStorage.ts` | phase32a |
| Activity history (separate) | `storage/history/service.ts` | phase11, phase22c |
| Data export/import | `storage/data/export.ts`, `import.ts` | phase22e |

**Count: 17 major components — do not rewrite.**

---

## 24. Legacy Writing Learning Functionality Lost During Integration

**None supported by legacy repository evidence.**

The Writing Learning feature set was **introduced during Flowlary consolidation (Phase 22)**, not removed from EWA. The reconciliation audit explicitly recorded “No learning layer exists” before Phase 22 implementation.

### Functionality gaps vs product vision (not legacy loss)

| Gap | Evidence |
|-----|----------|
| Learning events not recorded from content-script path | Phase 3A P1 — account context |
| `focusAreas` not driving recommendations | code inspection |
| No speech/listening practice controls | PracticePanel has text-only sandbox |
| Trend uses error count not error rate | `progress.ts` design choice |
| Personalized narrative messages (“rising error rate”) | not implemented as copy rules |

---

## 25. Recoverable Without Rewrite

| Feature | Legacy source | Current target | Strategy | Risk |
|---------|---------------|----------------|----------|------|
| Correction taxonomy + prompt | `@ewa/shared` | Already in `@flowlary/shared` | **Done** | None |
| Box/direct semantics | EWA content script | `applyCorrection.ts` | **Done** | None |
| Debounce/threshold defaults | EWA DEFAULTS | CORRECTION_DEFAULTS | **Done** | None |
| History diff visualization | `HistoryDiff.tsx` | Activity panel | Port UI component only | Low |
| EWA history data | `ewa_history` | `history.ewa` preserve | Migration exists | Low |
| Writing Learning stack | N/A (Flowlary Phase 22) | Current dashboard | **Reconnect wiring** (Phase 3B) | Medium if rewritten instead |

---

## 26. True Reimplementation

Features with **no legacy source** and **existing Flowlary implementation** — reimplementation **not required**:

- Learning events, progress, practice, recommendations, recurring patterns — all authored in Flowlary.

Features with **no legacy source** and **incomplete current product**:

| Feature | Status | Action |
|---------|--------|--------|
| Speech/listening practice controls | Not in legacy or current | **Net-new product design** if desired |
| Narrative personalized feedback copy | Not in legacy | **Net-new** (rules + i18n) |
| `focusAreas` → recommendation weighting | Profile exists | **Wire existing profile** — not rewrite |
| Error-rate-based trend (vs count-based) | Current uses counts | **Enhance** `progress.ts` — not legacy recovery |

**True rewrite count: 0** (for legacy-recoverable features).

---

## 27. Security Differences

| Legacy pattern | Risk | Verdict |
|----------------|------|---------|
| User Groq key in `chrome.storage.local` | Key theft via XSS/profile compromise | **LEGACY ONLY — DO NOT RECOVER** |
| Direct extension → `api.groq.com` | Bypasses server entitlement/credits | **LEGACY ONLY — DO NOT RECOVER** |
| Global unscoped history/settings | Cross-account leakage on shared device | **LEGACY ONLY — DO NOT RECOVER** |
| Device-only identity | No account isolation | **LEGACY ONLY — DO NOT RECOVER** |
| Unscoped LRU correction cache | Cross-user cache bleed if shared | Fixed in Flowlary account-scoped cache |

**Security issues in legacy: 5**

---

## 28. Privacy Differences

| Data | Legacy | Current |
|------|--------|---------|
| Full original/corrected text in history | ✅ stored locally | Activity stores operation metadata; learning stores mistake pairs locally |
| Groq transmission | User key, user-initiated | Managed gateway, entitlement-gated |
| Learning analytics upload | N/A (no analytics) | Explicitly local-only (Phase 22C) |
| Account-scoped deletion | ❌ | ✅ per-account reset/export |

Legacy stored raw writing text in history with no retention policy beyond 50-entry cap.

**Privacy issues in legacy: 2** (unscoped storage, full text history without account boundary).

---

## 29. Cost / AI Impact

| Feature | Local / AI | Provider | Recovery impact |
|---------|------------|----------|-----------------|
| Correction detection | AI | Groq via gateway | Already integrated |
| Learning event record | Local | — | No AI cost |
| Progress metrics | Local | — | No AI cost |
| Recurring patterns | Local | — | No AI cost |
| Practice check | AI | Same correction pipeline | 1 Groq call per practice item check |
| Practice recommendation | Local | — | No AI cost |
| History diff (if ported) | Local | — | No AI cost |

Recovering legacy correction logic: **no incremental AI cost** (already live).  
Reconnecting learning: **no incremental AI cost** for analytics; practice adds correction calls during sessions only.

---

## 30. Account Isolation Adaptation

Every recovered or retained feature must use:

- `activeAccountContext.getAccountId()`
- `getAccountScopedStorage()` keys: `learning.events`, `learning.sessions`, `learning.profile`, `history`
- Write guards on sign-out race

Legacy global keys (`ewa_*`) → migrate once via `ewa.ts` steps → **never read unscoped for new writes**.

---

## 31. Screenshot → Legacy → Current Mapping

**Note:** Supplied `.qa-shots/` images are **Flowlary marketing website** screenshots (homepage, pricing, account), **not** Writing Learning dashboard screenshots. No screenshot in the repository depicts error rate, practice, or progress panels.

| Screenshot feature | Screenshot evidence | Legacy code | Current code | Gap |
|--------------------|--------------------|--------------|--------------|-----|
| Writing Learning dashboard | ❌ not in .qa-shots | ❌ not in legacy | `ProgressPanel.tsx` | None — feature is Flowlary-native |
| Error rate | ❌ | ❌ | `progress.ts` | Wiring to content script |
| Errors per 100 words | ❌ | ❌ | `progress.ts` | Wiring |
| Spelling/grammar/wording counts | ❌ | AI types only | `countErrorsByType` | None |
| Error trends | ❌ | ❌ | `computeTrend` | Uses count not rate |
| Recent mistakes | ❌ | history list (unlabeled) | `recentEvents` | None |
| Practice | ❌ | ❌ | `PracticePanel` | No speech controls |
| Box mode | ✅ marketing mock | `CorrectionCard.ts` | `CorrectionCard.ts` | None |
| Direct mode | ❌ in screenshots | `content/index.ts` | `applyCorrection.ts` | None |
| Personalized feedback | ❌ | ❌ | `recommendation.ts` | No narrative rules |
| Repeated-error feedback | ❌ | ❌ | `recurringPatterns` | None |
| Correction in field | ✅ d-home.png mock | `content/index.ts` | `CorrectionScheduler` | None |

---

## 32. Recommended Recovery Order

Since legacy Writing Learning does not exist, the order is **reconnection and hardening**, not legacy porting:

1. **Fix content-script account context** — unlock learning event writes from primary runtime path (Phase 3B P1).
2. **Verify practice session key alignment** in `GET_PROGRESS` (Phase 3A P1).
3. **Validate end-to-end learning loop** — write → correct → accept → progress updates (integration test gap from Phase 3A).
4. **Wire `focusAreas` into recommendation weighting** — profile data already stored.
5. **Optional: port history diff visualization** from EWA for Activity panel polish.
6. **Product enhancements** — error-rate trend, narrative feedback copy, speech controls (net-new, not legacy).

---

## 33. Proposed Future Phases

| Phase | Name | Scope |
|-------|------|-------|
| **WL-1** | Learning Path Reconnection | Content-script account bootstrap; E2E write→progress test; fix session key reads |
| **WL-2** | Analytics Hardening | Error-rate trend option; metric label fixes; insufficient-data UX |
| **WL-3** | Personalization Wiring | Connect `focusAreas` to recommendations; recurring-pattern CTA copy |
| **WL-4** | Practice Enhancement | Abandoned session save; richer prompts; optional speech (net-new) |
| **WL-5** | Activity UX Polish | Port EWA token diff to Activity panel (optional) |

**No WL phase should rewrite** the Phase 22 learning storage or progress engine.

---

## 34. Files Inspected

### Legacy repository (sample)

- `/tmp/flowlary-legacy-writing-assistant/` — full tree (63 TS/MD/JSON files)
- `extension/src/content/index.ts`, `debounce.ts`, `instantSpell.ts`, `mergeCorrection.ts`, `segment.ts`
- `extension/src/background/index.ts`, `groqCorrect.ts`
- `extension/src/storage/settings.ts`
- `extension/src/popup/App.tsx`, `HistoryDiff.tsx`
- `extension/src/ui/correction-card/CorrectionCard.ts`
- `extension/src/diff/tokenDiff.ts`
- `packages/shared/src/index.ts`
- `backend/src/services/groq.ts`, `routes/correct.ts`
- Git: all 6 commits, `--stat`, branches, tags, remotes

### Current Flowlary

- `packages/shared/src/learningEvents.ts`, `learning.ts`, `practice.ts`, `correction/index.ts`, `wordCount.ts`
- `extension/src/storage/learning/**`
- `extension/src/features/learning/**`
- `extension/src/features/correction/applyCorrection.ts`
- `extension/src/dashboard/panels/ProgressPanel.tsx`, `PracticePanel.tsx`
- `extension/src/storage/history/service.ts`
- `extension/src/storage/migration/steps/ewa.ts`
- `docs/audit/PHASE3A_CORE_FEATURES_LEARNING_FORENSIC_AUDIT.md`
- `PHASE22B_REPORT.md`, `PHASE22C_REPORT.md`, `PHASE22D_REPORT.md`
- `PHASE22_PRODUCT_RECONCILIATION_AUDIT.md`
- `.qa-shots/d-home.png` (marketing screenshot review)

---

## 35. Files Modified

| Category | Modified |
|----------|----------|
| Production source (`extension/`, `backend/`, `packages/`) | **NO** |
| Legacy clone | **NO** |
| Database | **NO** |
| Environment / deployment | **NO** |
| Audit document only | `docs/audit/WRITING_LEARNING_LEGACY_RECOVERY_AUDIT.md` (this file) |

---

## 36. Final Verdict

```
LEGACY WRITING LEARNING AUDIT:
COMPLETE

LEGACY REPOSITORY:
FOUND

LEGACY LEARNING:
NOT FOUND

LEGACY DASHBOARD:
NOT FOUND

LEGACY ANALYTICS:
NOT FOUND

LEGACY PRACTICE:
NOT FOUND

LEGACY HISTORY:
FOUND

LEGACY PERSONALIZATION:
NOT FOUND

LEGACY RECURRING ERROR LOGIC:
NOT FOUND

CURRENT WRITING LEARNING:
PARTIAL

FUNCTIONALITY RECOVERABLE:
LOW

FUNCTIONALITY REQUIRING PORT:
2

FUNCTIONALITY REQUIRING TRUE REWRITE:
0

FEATURES THAT MUST NOT BE REWRITTEN:
17

SECURITY ISSUES IN LEGACY:
5

PRIVACY ISSUES IN LEGACY:
2

PRODUCTION CHANGES:
NO

DATA MIGRATION:
NO

DEPLOYMENT:
NO

RECOMMENDED NEXT PHASE:
WL-1: Learning Path Reconnection
```

### Core question answered

> "How much of the original Writing Learning system from english-writing-assistant still exists, and how can we reuse it instead of rebuilding it?"

**Answer:** The GitHub `english-writing-assistant` repository **never contained a Writing Learning system**. It contained a **correction engine** (box/direct modes, Groq taxonomy, simple history) that Flowlary has **already absorbed**. The Writing Learning product (events, metrics, progress, practice, recommendations) was **built new in Flowlary Phase 22** and should be **kept, reconnected, and hardened** — not rebuilt from legacy sources that do not exist.

The correct strategy is:

```
EWA correction foundation (already integrated)
        +
Flowlary Phase 22 learning stack (keep + reconnect)
        +
Fix Phase 3A wiring gaps
        ≠
Recover Writing Learning from legacy repo
```
