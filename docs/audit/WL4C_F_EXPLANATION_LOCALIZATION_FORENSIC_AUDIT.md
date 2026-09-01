# WL-4C-F — Explanation Localization Forensic Audit

**Date:** 2026-08-27  
**Baseline:** WL-4C-A through WL-4C-E complete (265 tests passing)  
**Mode:** Audit-first — implementation follows this document

---

## Pipeline Trace (Verified)

```
CorrectionChange
→ resolveExplanation()                    [shared/explanation/trustedRules/resolver.ts]
→ RuleExplanation
→ enrichCorrectionResponseWithExplanations() [shared/explanation/enrichCorrectionResponse.ts]
→ handleCorrectText() / CORRECT_TEXT       [extension/background/correct.ts]
→ CorrectionSuggestionBinding.response     [extension/features/correction/ui/types.ts]
→ CorrectionCard.setReady()                [Box mode only]
→ ExplanationPanel.show()                    [extension/features/correction/ui/ExplanationPanel.ts]
→ explanationStrings.ts (English hardcoded)  [pre WL-4C-F]
→ readUiLocale() exists but unused in content script
```

Direct mode auto-applies corrections — no Explain UI (WL-4C-E limitation preserved).

---

## Audit Questions (20)

### 1. Where is UI language stored?

**`chrome.storage.local`** under `STORAGE_KEYS.uiLocale` (`flowlary.ui.locale`).

Shape: `{ value: UiLocaleCode, _v: 1 }` or raw string (legacy).

Reader: `extension/src/popup/i18n/localeStorage.ts` → `readUiLocale()`.

### 2. How does content script determine locale?

**Before WL-4C-F:** It does not — `explanationStrings.ts` returns hardcoded English.

**After WL-4C-F:** Content script reads `readUiLocale()` and loads `correctionExplain` strings from popup i18n catalogs.

### 3. How do popup/dashboard determine locale?

- `I18nProvider` loads `readUiLocale()` on mount
- `writeUiLocale()` persists choice
- Dashboard/popup use merged locale catalogs (`en` + overrides)

### 4. Are locale settings account-scoped?

**No.** `uiLocale` is device-local in `chrome.storage.local`, not namespaced by `authAccountId`.

Learning profile and learning events ARE account-scoped. UI locale follows device preference (consistent with keyboard/layout UX).

Account isolation for explanations: binding instance + stale guards — not locale storage.

### 5. Is English always the learning language?

**Yes in V1.**

- `DEFAULT_LEARNING_LANGUAGE = 'en'` in `packages/shared/src/learning.ts`
- Onboarding locks learning language to English
- Learning events assume English writing categories (spelling/grammar/wording)

### 6. Where should explanation localization happen?

| Layer | Responsibility |
|---|---|
| Resolver (WL-4C-C) | English canonical RuleExplanation — **unchanged** |
| CORRECT_TEXT enrichment (WL-4C-D) | Attach English explanations — **unchanged** |
| **Presentation (WL-4C-F)** | UI strings + optional localized copy of ruleTitle/summary/why |
| ExplanationPanel | Consumes presentation layer — never resolves rules |

### 7. Client-side vs backend-side?

| Content | Location |
|---|---|
| UI chrome strings | **Client** — deterministic i18n catalogs |
| Static trusted rule copy (ar/tr) | **Client/shared** — deterministic, free |
| AI localization (missing static) | **Backend only** — Groq via AiGateway, Pro-gated |
| English examples | **Never translated** — remain on RuleExplanation |

### 8. Safe to localize

- `ruleTitle` (presentation)
- `summary` (presentation)
- `why` (presentation)
- UI labels (Explain, Why, Close, etc.)

### 9. Must remain untouched

- `incorrectExample`, `correctExample` (English learning evidence)
- `ruleId`, `category`, `confidence`, `source`, `practiceTargetId`
- `CorrectionChange` fields
- Correction offsets/categories

### 10. Prevent Groq from inventing rules

- Groq receives only `{ locale, ruleTitle, summary, why }` — no user writing sample
- Strict system prompt: localize only, do not identify rules
- Structured JSON output validated server-side
- Reject output that adds fields or modifies identity metadata
- Client merges validated text onto original RuleExplanation via `applyLocalizedPresentation()`
- Never upgrade `source` or `confidence`

### 11. Validate localized output

- Required string fields present and non-empty
- No `ruleId`, `source`, `confidence`, examples in Groq payload
- Locale matches request
- Field length bounds
- On failure → return original English explanation

### 12. Groq cost estimate

| Path | Cost |
|---|---|
| Free user opens Explain | **0** — static + UI i18n only |
| Pro user, static locale hit (ar/tr) | **0** |
| Pro user, AI localize (rare locale / missing static) | **1 credit** (translation mode `explanation-localize`, weight 1) |
| Correction | **Unchanged** — existing credit model |

Not called on correction render. Only on Explain open when static copy missing and user is Pro/Trial with credits.

### 13. Can localization be cached?

**Yes.**

Key (account-independent for trusted rules):

```
EXPLAIN_LOCALIZE:{ruleId}:{ruleVersion}:{locale}
```

No user text in key. AI and static results share identity dimensions.

### 14. Cache key contents

- `ruleId`
- `ruleVersion` (from trusted rule)
- `locale` (UiLocaleCode)
- Optional: `presentationVersion` if copy schema changes

AccountId **not** required — payload contains no user-specific text.

### 15. Account A vs Account B localized explanation?

Cached entries are account-independent (trusted educational text only).

AI request uses authenticated account for credits only — cache write/read is keyed without accountId to allow safe reuse.

Stale guard: account switch during in-flight AI request uses existing `activeAccountContext` pattern.

### 16. Groq fails?

→ Panel keeps English/static deterministic copy. Correction unaffected.

### 17. Malformed localization?

→ Server returns `ok: false` or validation rejects → client keeps English.

### 18. User changes language?

Next Explain open reads fresh `readUiLocale()`. In-memory panel cache is per-session only.

### 19. Unsupported locale?

`readUiLocale()` falls back to `'en'`. Invalid codes rejected by `isUiLocaleCode()`.

### 20. Cheapest architecture preserving quality

1. **Deterministic UI i18n** for all 12 UI locales (merge from popup catalogs)
2. **Static trusted rule copy** for ar + tr (4 rules) — zero Groq
3. **Optional Pro Groq** only when static missing — click-gated on Explain open
4. **Never** Groq on correction path
5. **Never** Groq for pair/fallback explanations on Free

---

## Groq / Gateway / Credits (Verified)

- Groq only in backend (`groqClient.ts`, providers)
- Content script has no API keys
- Credits: `reserveManagedUsage()` in `accountService.ts`
- WL-4C-F adds translation mode `explanation-localize` with weight **1**, **Pro/Trial only** at handler gate

---

## Privacy (Verified)

Groq localization payload:

```json
{
  "locale": "ar",
  "ruleId": "english.spelling.receive_ie_ei",
  "ruleVersion": "1.0",
  "ruleTitle": "...",
  "summary": "...",
  "why": "..."
}
```

**No** user sentence, **no** correction segment, **no** LearningEvent data.

---

## Fallback Hierarchy (Target)

1. Local deterministic UI translation (`correctionExplain` i18n)
2. Static trusted rule copy for locale (ar/tr)
3. In-memory/cache validated AI localization (Pro)
4. Optional controlled Groq localization (Pro, click-gated)
5. Original English RuleExplanation
6. Safe unavailable message

---

## Future Roadmap Compatibility

| Future phase | WL-4C-F compatibility |
|---|---|
| Daily Brief (max 3/day) | Separate endpoint; shares locale infra, not explanation resolver |
| Full Report (max 1/day) | Uses Learning Snapshot — not explanation contract |
| PDF/DOCX/MD export | Separate renderers — RuleExplanation contract stable |
| Website Writing Lab | Reuses correction + explanation pipeline |
| AI Learning Coach | Reads deterministic snapshot — not Explain panel |
| Practice Scoring | Unchanged — practiceTargetId stable |
| Layout Practice | Layout explanations remain input-focused |

**Stable contracts:** `RuleExplanation`, `CorrectionResponse.explanations[]`, resolver invariants.

---

## WL-4C-F Implementation Scope

**In scope:**
- UI string localization in content script
- Static ar/tr trusted rule presentation
- Presentation merge helper (identity-safe)
- Pro-only optional Groq localization backend + background handler
- Client cache for localized presentation
- Tests + implementation report

**Out of scope:**
- Daily Brief, Full Report, exports, coach, scoring, layout practice
- Modifying resolver, CorrectionChange, LearningEvent
- Groq on correction render
- Free-tier Groq for explanations

---

## Audit Verdict

**Ready to implement WL-4C-F.**
