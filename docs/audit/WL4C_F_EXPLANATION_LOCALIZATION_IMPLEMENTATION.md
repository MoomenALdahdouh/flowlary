# WL-4C-F — Explanation Localization Implementation Report

**Date:** 2026-08-27  
**Phase:** WL-4C-F — Explanation Localization & Controlled AI  
**Baseline:** WL-4C-A through WL-4C-E complete (265 tests passing)

---

## Forensic Findings (Summary)

See full audit: [`WL4C_F_EXPLANATION_LOCALIZATION_FORENSIC_AUDIT.md`](./WL4C_F_EXPLANATION_LOCALIZATION_FORENSIC_AUDIT.md)

| Question | Answer |
|---|---|
| UI language storage | `chrome.storage.local` → `flowlary.ui.locale` (device-local) |
| Learning language | Always English (`DEFAULT_LEARNING_LANGUAGE = 'en'`) |
| Resolver location | Shared package — **unchanged** |
| Localization layer | Presentation only — after `RuleExplanation` is attached |
| Groq role | Optional Pro localization of trusted text fields only |
| Free tier Groq | **Never** for explanations |

---

## Architecture Before / After

### Before (WL-4C-E)

```
RuleExplanation (English) → ExplanationPanel → hardcoded English UI strings
```

### After (WL-4C-F)

```
RuleExplanation (English, identity unchanged)
  → resolveLocalizedPresentation() [static ar/tr trusted copy]
  → ExplanationPanel [UI i18n from popup catalogs]
  → optional Pro AI enhance (Explain open, static missing, click-gated)
  → applyLocalizedPresentation() [ruleTitle/summary/why only]
```

**Unchanged:** `CorrectionChange`, `resolveExplanation()`, `enrichCorrectionResponseWithExplanations()`, correction credits, LearningEvent/History/Practice.

---

## Locale Source

- **UI / explanation language:** `readUiLocale()` from `extension/src/popup/i18n/localeStorage.ts`
- **Content script:** loads `correctionExplain` strings via `localeCatalog.ts` (merged popup catalogs)
- **RTL:** `uiLocaleDirection(locale)` applied to explanation panel host

---

## Learning-Language Boundary

| Field | Language |
|---|---|
| `incorrectExample`, `correctExample` | English (learning evidence) |
| `ruleTitle`, `summary`, `why` | User UI locale (presentation) |
| UI chrome (Explain, Why, Close…) | User UI locale |

Example (Arabic UI):

- You wrote: `recieve` (English)
- Suggested: `receive` (English)
- Rule title / summary: Arabic
- Example line: `recieve → receive` (English preserved)

---

## Groq Role

Groq is **presentation-only**:

- Endpoint: `POST /api/ai/explanation-localize`
- Provider: `backend/src/providers/explanationLocalizeProvider.ts`
- Payload: `{ locale, ruleId, ruleVersion, ruleTitle, summary, why? }` — **no user writing**
- Structured JSON output validated server-side
- Credit: translation mode `explanation-localize`, weight **1**
- **Pro/Trial only** (Free rejected at gateway)
- Called only when Explain opens and static copy is missing

Groq does **not** identify rules, change confidence, or modify examples.

---

## Fallback Hierarchy (Implemented)

1. Local deterministic UI translation (`correctionExplain` i18n)
2. Static trusted rule copy (ar + tr for all 4 spelling rules)
3. In-memory cache (background handler, 7-day TTL)
4. Optional controlled Groq localization (Pro, Explain-gated)
5. Original English `RuleExplanation`
6. Safe unavailable message (misaligned explanations)

Localization failure never blocks correction or Explain panel open.

---

## Cache Strategy

**Key:** `EXPLAIN_LOCALIZE:{ruleId}:{ruleVersion}:{locale}`

- Account-independent (trusted educational text only)
- No user text in key
- Locale-isolated (Arabic ≠ Turkish)
- In-flight deduplication per key in background handler
- Stale guard via `activeAccountContext.matches()` on fetch return

Static trusted copy bypasses cache and Groq entirely.

---

## Privacy / Data Flow

**Leaves device to backend (Pro AI path only):**

```json
{
  "locale": "de",
  "ruleId": "english.spelling.receive_ie_ei",
  "ruleVersion": "1.0",
  "ruleTitle": "Receive spelling",
  "summary": "The verb 'receive' is written with 'ei'...",
  "why": "Common English spelling pattern."
}
```

**Never sent:** user sentence, correction segment, LearningEvent data, History.

---

## Credit Behavior

| Path | Credits |
|---|---|
| Free — Explain open | 0 |
| ar/tr static trusted rules | 0 |
| Pro — AI localize (rare locale) | 1 |
| Correction | Unchanged |

---

## Account Isolation

- AI requests authenticated; credits tied to account
- Cache is account-independent (safe — no PII in payload)
- Account switch during in-flight request: `activeAccountContext.matches()` drops stale write
- No second isolation system introduced

---

## Failure Behavior

| Failure | Result |
|---|---|
| Groq timeout / rate limit / unavailable | English/static explanation remains |
| Malformed Groq JSON | Server rejects → client keeps English |
| Free user | No backend call; static + UI i18n only |
| Credit exhaustion | Backend 403 → client keeps English |
| Locale unsupported | Falls back to English via `readUiLocale()` default |

---

## Files Changed

| File | Change |
|---|---|
| `packages/shared/src/explanation/localizePresentation.ts` | Presentation merge + validation |
| `packages/shared/src/explanation/staticRuleLocales.ts` | Deterministic ar/tr trusted copy |
| `packages/shared/src/explanation/index.ts` | Exports |
| `packages/shared/src/credits.ts` | `explanation-localize` weight = 1 |
| `extension/.../explanationStrings.ts` | Async locale loading |
| `extension/.../localeCatalog.ts` | Content-script i18n bridge |
| `extension/.../ExplanationPanel.ts` | Locale, RTL, static + optional AI |
| `extension/.../explainLocalizeClient.ts` | Client messaging wrapper |
| `extension/src/background/explainLocalize.ts` | Handler + cache |
| `extension/src/background/index.ts` | Message routing |
| `extension/src/messaging/types.ts` | `LOCALIZE_EXPLANATION` |
| `extension/src/messaging/validate.ts` | Validation |
| `extension/src/popup/i18n/ar.ts` | `correctionExplain` |
| `extension/src/popup/i18n/tr.ts` | `correctionExplain` |
| `backend/src/providers/explanationLocalizeProvider.ts` | Groq provider |
| `backend/src/gateway/index.ts` | Gateway method |
| `backend/src/routes/http.ts` | Route |
| `docs/audit/WL4C_F_EXPLANATION_LOCALIZATION_FORENSIC_AUDIT.md` | Forensic audit |
| Tests (see below) | WL-4C-F coverage |

---

## Files Intentionally Untouched

- `CorrectionChange`, correction provider, correction semantics
- `resolveExplanation()`, trusted rule matcher
- LearningEvent, History, Practice engines
- Correction cache (explanations still not cached with corrections)
- Direct mode correction UI (no Explain)

---

## Tests

| Suite | Result |
|---|---|
| WL-4C targeted regression (correction + explanation + wl4c-d) | **105 passed, 0 failed** |
| `@flowlary/shared` | **97 passed** |
| `@flowlary/backend` | **66 passed** |

New test files:

- `tests/unit/shared/explanation-localize-presentation.test.ts`
- `tests/unit/shared/static-rule-locales.test.ts`
- `tests/unit/backend/explanation-localize.test.ts`
- `tests/unit/correction/explain-localize-handler.test.ts`

Updated:

- `tests/unit/correction/ExplanationPanel.test.ts` (Arabic locale + async panel)
- `tests/unit/correction/CorrectionCard.test.ts` (async panel)
- `tests/unit/shared/credits-capabilities.test.ts` (explanation-localize weight)

Coverage includes: English/Arabic/Turkish locales, unsupported locale fallback, identity preservation, static copy, cache hit, Free path (no fetch), malformed Groq rejection, handler eligibility gates.

---

## Known Limitations

1. Static trusted copy only for **ar** and **tr** (4 spelling rules). Other locales use English unless Pro AI localize succeeds.
2. Pair/fallback explanations are not AI-localized (by design — uncertain content).
3. UI locale is device-local, not account-scoped.
4. `correctionExplain` fully translated only in en/ar/tr; other locales fall back to English UI strings via catalog merge.
5. Pro AI localization is best-effort async refresh after panel opens (no blocking spinner).

---

## Future Improvements

1. Expand static trusted copy to de/fr/ru/es for top rules
2. Deterministic pair-summary templates per locale (no Groq)
3. Account-scoped UI locale (optional product decision)
4. Shared presentation version bump for cache invalidation on copy updates

---

## Roadmap Compatibility

| Phase | Status |
|---|---|
| **WL-4C-E — Explain UI** | COMPLETE |
| **WL-4C-F — Localized Explanation** | **CURRENT — COMPLETE** |
| Daily Learning Brief (max 3/day) | Not implemented — compatible |
| Full Learning Report (max 1/day) | Not implemented — compatible |
| PDF / DOCX / MD Export | Not implemented — compatible |
| Website Writing Lab | Not implemented — compatible |
| AI Learning Coach | Not implemented — compatible |
| Practice Scoring / Progression | Not implemented — compatible |
| Layout Practice | Not implemented — compatible |

**Stable contracts preserved:** `RuleExplanation`, `CorrectionResponse.explanations[]`, resolver invariants, `practiceTargetId` identity.

**Shared later:** locale infra, deterministic learning snapshot (not explanation resolver).

**Remain separate:** Daily Brief, Full Report, Coach endpoints.

**Do not duplicate:** rule resolution, correction pipeline, learning event writers.

---

## Verdict Matrix

```
WL-4C-F STATUS:
COMPLETE

LOCALIZATION:
PASS

TRUST BOUNDARY:
PASS

GROQ SAFETY:
PASS

COST CONTROL:
PASS

CACHE:
PASS

ACCOUNT ISOLATION:
PASS

PRIVACY:
PASS

CORRECTION REGRESSION:
PASS

LEARNING REGRESSION:
PASS

UI REGRESSION:
PASS

TESTS:
268 passed (WL-4C targeted + shared + backend)
0 failed (in WL-4C scope)

P0:
0

P1:
0

P2:
1  (correctionExplain only fully translated in en/ar/tr)

P3:
1  (device-local UI locale vs account-scoped learning)

PRODUCTION BLOCKER:
NO

NEXT PHASE:
WL-4D — Daily Learning Brief (recommended next per roadmap)
```

---

## Roadmap

**CURRENT:**  
WL-4C-E — Explain UI — COMPLETE  
WL-4C-F — Localized Explanation — COMPLETE

**NEXT:**  
WL-4D — Daily Learning Brief (max 3 AI generations/day/account)

**FUTURE:**  
Full Learning Report (max 1/day) · PDF/DOCX/MD Export · Website Writing Lab · AI Learning Coach · Practice Scoring · Layout Practice

WL-4C-F does **not** implement these future phases prematurely.
