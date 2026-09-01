# WL-4C-E — Explain This Correction UI Implementation

**Date:** 2026-08-27  
**Baseline:** WL-4C-A through WL-4C-D complete  
**Mode:** Presentation layer only — consumes `CorrectionResponse.explanations[]`

---

## Executive Summary

WL-4C-E adds a user-facing **Explain** affordance to the Box-mode correction card and a reusable **explanation panel** that presents pre-computed `RuleExplanation` metadata from WL-4C-D.

**Core guarantee:** The UI never calls `resolveExplanation()`, never imports the trusted rule library, and never invents grammar rules. Correction accept/reject behavior is unchanged.

---

## UI Forensic Audit

### Existing correction UI architecture

| Component | Role |
|---|---|
| `CorrectionCard.ts` | Shadow DOM inline card below editable field (Box mode) |
| `CorrectionSuggestionBinding` | Holds full `CorrectionResponse` + stale guards |
| `applyCorrection.ts` | Delivers correction to card (box) or auto-applies (direct) |
| `CorrectionFeature.ts` / `scheduler.ts` | Creates card per field |
| `tokenDiff.ts` | Renders highlighted diff in card |

### Findings

1. **Box mode** shows one card with all changes highlighted together.
2. **Direct mode** auto-applies — no card, no Explain UI (documented limitation).
3. **`CorrectionResponse.explanations[]`** is available on `binding.response` after WL-4C-D.
4. **Single UI boundary:** `CorrectionCard` — smallest safe integration point.
5. **Design system:** Shadow DOM + CSS variables (`--flowlary-bg`, `--flowlary-fg`, etc.) from `hostStyleAdapter`.
6. **i18n:** Popup/dashboard use React i18n; content script uses dedicated string module + `en.ts` keys for future locale wiring.
7. **Practice navigation:** `openDashboard('practice')` — existing dashboard entry point.

### Audit vs prior reports

| Claim | Code truth | Action |
|---|---|---|
| explanations[] on CORRECT_TEXT response | Confirmed via WL-4C-D | Consumed in UI |
| CorrectionCard is Box-mode surface | Confirmed | Explain added here |
| Direct mode has no suggestion card | Confirmed | Explain not added (by design) |
| No Explain UI existed | Confirmed before WL-4C-E | New panel added |

---

## Data Flow

```
CORRECT_TEXT (background)
      ↓
CorrectionResponse { changes[], explanations[] }
      ↓
CorrectionSuggestionBinding.response
      ↓
CorrectionCard.setReady(binding)
      ↓
User clicks Explain
      ↓
ExplanationPanel.show(binding)
      ↓
getAlignedExplanations(changes, explanations)
      ↓
Render RuleExplanation fields (text only)
```

**No resolver in UI path.**

---

## Explanation Mapping

**File:** `explanationMapping.ts`

- `areExplanationsAligned()` — requires `changes.length === explanations.length`
- `getAlignedExplanations()` — returns null if misaligned
- `shouldShowTrustedRuleTitle()` — only `trusted_rule` + `high` + `ruleId` + `ruleTitle`
- `shouldShowPracticeLink()` — requires `practiceTargetId` and `category !== layout`

**Never matches by text, offsets, or fuzzy search.**

---

## Component Design

| Component | Purpose |
|---|---|
| `ExplanationPanel.ts` | Fixed right-side drawer (bottom sheet on narrow screens) |
| `explanationStrings.ts` | English UI strings for content script |
| `explanationMapping.ts` | Safe presentation helpers |
| `CorrectionCard.ts` | Added Explain button + panel lifecycle |

### Panel contents (per change)

1. What changed (You wrote / Suggested)
2. Trusted rule title (only when safe)
3. Summary + optional why
4. Example line
5. Practice this (when valid `practiceTargetId`)

**Not shown:** `ruleId`, `source`, `confidence`, internal IDs.

---

## State Management

- Explanation panel state lives on `CorrectionCard` instance (in-memory).
- `setReady()` clears any open panel from previous correction.
- `hide()` / `dismiss()` / `destroy()` clear panel.
- Panel tied to current `CorrectionSuggestionBinding` — no global store.
- Escape on card: closes panel first, then dismisses card (existing behavior preserved).

---

## Trusted Rule Presentation

Shown only when:

```
source === 'trusted_rule'
AND confidence === 'high'
AND ruleId exists
AND ruleTitle exists
```

Uses `ruleTitle`, `summary`, `why` from `RuleExplanation` verbatim (text nodes only).

---

## Fallback Presentation

Pair/fallback/uncertain explanations show summary text without invented rule names. Grammar fallback never displays "Subject–verb agreement" unless explicitly in trusted metadata (impossible from fallback source).

---

## Layout Presentation

Layout explanations render summary from metadata (keyboard-input language from WL-4C-B). No grammar/spelling rule labels. No practice link for layout.

---

## Practice Integration

When `practiceTargetId` is valid and category ≠ layout:

- Shows **Practice this** button
- Calls `openDashboard('practice')` — existing dashboard Practice section
- Does not start a session, create learning events, or duplicate WL-4B targeting

---

## Accessibility

- Real `<button>` for Explain, Close, Practice
- `aria-label` on Explain and Close
- Panel uses `role="dialog"` + `aria-modal="true"`
- `:focus-visible` outlines match correction card style
- Escape closes panel
- Focus returns to Explain trigger on close

---

## Responsive Behavior

- Desktop: right-side drawer (~360px)
- ≤640px: bottom sheet drawer (no horizontal overflow)
- Backdrop dismisses panel

---

## I18n

- Content script: `explanationStrings.ts` (English baseline)
- Popup i18n: `correctionExplain` keys added to `en.ts` for future locale merge (WL-4C-F)
- No Groq translation

---

## Account Isolation

- Panel bound to card instance, not account ID
- Card hidden on stale/account-changed paths clears panel
- No cross-account explanation persistence

---

## Stale State Safety

- New correction (`setReady`) clears panel
- Card hide/dismiss clears panel
- WL-4A stale guards unchanged in `applyCorrection.ts`

---

## Learning / History Boundaries

Explain click does **not** call:

- `recordCorrectionLearning`
- `recordLearningEvents`
- History writers

Verified: CORRECT_TEXT + Explain path creates no learning events (WL-4C-D TEST 17; UI adds no writers).

---

## Groq / Cost Impact

**0 additional calls. 0 credits.**

UI reads local metadata only.

---

## Security

- All explanation text via `textContent` — no `innerHTML`, no `dangerouslySetInnerHTML`
- Test verifies `<script>` in summary renders as text, not executable

---

## Performance

- No explanation recomputation in UI
- No network on Explain click
- Panel renders synchronously from existing metadata

---

## Tests

| File | Tests |
|---|---|
| `tests/unit/correction/explanationMapping.test.ts` | 4 |
| `tests/unit/correction/ExplanationPanel.test.ts` | 7 |
| `tests/unit/correction/CorrectionCard.test.ts` | +3 (18 total in file, 15 original + 3 new) |
| `tests/integration/wl4c-d-explanation-integration.test.ts` | 19 (unchanged, regression) |

**Key scenarios covered:**

- Trusted spelling explanation display
- Fallback grammar (no named rule)
- Layout keyboard language
- Multiple changes indexed correctly
- Misaligned/missing explanations (safe unavailable message)
- Explain does not apply correction
- Panel clears on hide
- Correction works without explanations
- HTML injection safety
- Practice button conditional display

**Regression:** 265 tests passed, 0 failed.

---

## Files Modified

| File | Change |
|---|---|
| `extension/src/features/correction/ui/CorrectionCard.ts` | Explain button, panel lifecycle, Escape handling |
| `extension/src/features/correction/ui/ExplanationPanel.ts` | **New** — drawer panel component |
| `extension/src/features/correction/ui/explanationMapping.ts` | **New** — alignment + display guards |
| `extension/src/features/correction/ui/explanationStrings.ts` | **New** — UI strings |
| `extension/src/popup/i18n/en.ts` | `correctionExplain` keys for future locales |
| `tests/unit/correction/ExplanationPanel.test.ts` | **New** |
| `tests/unit/correction/explanationMapping.test.ts` | **New** |
| `tests/unit/correction/CorrectionCard.test.ts` | Explain panel tests |
| `docs/audit/WL4C_E_EXPLANATION_UI_IMPLEMENTATION.md` | **New** — this report |

---

## Files Intentionally Untouched

- Trusted rule library, resolver, enrichCorrectionResponse
- `background/correct.ts`, Groq, cache
- Learning, History, Practice engines
- `CorrectionChange` schema
- Direct mode auto-apply path
- Dashboard PracticePanel logic

---

## Known Limitations

1. **Box mode only** — Direct mode has no Explain UI (no suggestion card).
2. **English strings in content script** — full locale wiring deferred to WL-4C-F.
3. **Practice link opens dashboard** — does not deep-link to specific WL-4B target yet.
4. **Single Explain opens all changes** — multi-change shown as numbered sections in one panel.
5. **`practiceTargetId` rarely present** — background path does not auto-attach yet (WL-4C-D P2).

---

## Future WL-4C-F Readiness

**Safe to start WL-4C-F** (optional Groq localization of trusted rule content).

WL-4C-F can:
- Wire `readUiLocale()` into `explanationStrings.ts`
- Localize panel chrome strings
- Optionally localize trusted rule content via controlled pipeline

Do not move rule resolution or AI explanation generation into UI.

---

## Before / After

**BEFORE:**

```
Correction suggestion → CorrectionCard → Accept / Dismiss
```

**AFTER:**

```
Correction suggestion → CorrectionCard → Explain → ExplanationPanel
                                      → Accept / Dismiss (unchanged)
```

---

## Safety Proof

| Question | Answer |
|---|---|
| 1. Can UI invent a grammar rule? | **NO** |
| 2. Can UI show unsupported trusted rule? | **NO** (`shouldShowTrustedRuleTitle` guard) |
| 3. Can explanation failure break correction? | **NO** |
| 4. Can Explain click create LearningEvents? | **NO** |
| 5. Can Explain click create History? | **NO** |
| 6. Can Explain click consume Groq credits? | **NO** |
| 7. Can account A explanation appear for account B? | **NO** (instance-bound, cleared on hide) |
| 8. Can stale explanation remain after new correction? | **NO** (`setReady` clears panel) |
| 9. Can malformed explanation crash correction UI? | **NO** (unavailable message) |
| 10. Can explanation content execute HTML/JS? | **NO** (textContent only) |

---

## Final Verdict

```
WL-4C-E STATUS:
COMPLETE

UI AUDIT:
PASS

EXPLANATION MAPPING:
PASS

TRUSTED RULE PRESENTATION:
PASS

FALLBACK PRESENTATION:
PASS

GRAMMAR SAFETY:
PASS

LAYOUT SAFETY:
PASS

PRACTICE LINK:
PASS

ACCESSIBILITY:
PASS

RESPONSIVE:
PASS

I18N:
PASS (English baseline + en.ts keys)

ACCOUNT ISOLATION:
PASS

STALE STATE SAFETY:
PASS

LEARNING:
UNCHANGED

HISTORY:
UNCHANGED

CORRECTION:
UNCHANGED

GROQ:
0 ADDITIONAL CALLS

CREDITS:
0 ADDITIONAL COST

TRUSTED RULES ADDED:
0

TESTS:
265 passed
0 failed

P0:
0

P1:
0

P2:
Direct mode has no Explain UI

P3:
Practice button opens dashboard section, not specific target

PRODUCTION BLOCKER:
NO

NEXT PHASE:
WL-4C-F
```
