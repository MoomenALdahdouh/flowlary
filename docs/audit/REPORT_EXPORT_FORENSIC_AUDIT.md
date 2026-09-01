# Report Export — Forensic Audit

**Date:** 2026-08-27  
**Scope:** PDF / DOCX / Markdown export of Full Learning Report  
**Status:** Audit complete — implementation justified

---

## 1. Existing report architecture (verified)

### Data flow (repository trace)

```
LearningEvent
  → computeProgressMetrics()          [extension/src/storage/learning/progress.ts]
  → attachPersonalizationToProgress() [personalization.ts]
  → computePracticeRecommendation()   [practice/recommendation.ts]
  → computeLearningAnalysisSnapshot() [report/computeLearningAnalysisSnapshot.ts]
  → buildDeterministicFullReportNarrative() [report/buildDeterministicReport.ts]
  → validateLearningReportNarration() [packages/shared/src/learningReportValidation.ts] (optional)
  → resolveFullLearningReport()       [report/resolveFullLearningReport.ts]
  → GET_FULL_LEARNING_REPORT          [background/index.ts]
  → fetchFullLearningReport()         [popup/api.ts]
  → LearningReportPanel               [dashboard/panels/LearningReportPanel.tsx]
```

### Contract types (`packages/shared/src/learningReport.ts`)

| Type | Purpose |
|------|---------|
| `LearningAnalysisSnapshot` | Structured evidence (activity, patterns, trend, focus, practice plan) |
| `FullLearningReportNarrative` | Learner-facing sections (overview, strengths, recommendations, …) |
| `FullLearningReport` | Resolved report = snapshot + narrative + locale + cache/quota metadata |

**Export-relevant fields already present:** overview, activity metrics, strengths, focus areas, recurring patterns (with optional explanations), improvements, focus, recommendations, next steps, locale, evidence quality, period days, generatedAt.

**Internal fields to strip from exports:** `evidenceVersion`, `targetPatternId`, `ruleId`, quota/cache flags, `aiNarrationAvailable`, `fromCache`, `generationsUsedToday`.

### Documentation accuracy check

`FULL_LEARNING_REPORT_IMPLEMENTATION.md` claims match the codebase. Export placeholder at line 232–234 of `LearningReportPanel.tsx` is **disabled** with `exportSoon` tooltip — confirmed.

---

## 2. Export placeholder (verified)

```tsx
<button type="button" className="fl-btn fl-btn-ghost" disabled title={t('learningReport.exportSoon')}>
  {t('learningReport.export')}
</button>
```

No export logic exists yet. No PDF/DOCX/Markdown libraries in any workspace `package.json`.

---

## 3. Best export insertion point

**After** `FullLearningReport` is resolved in the dashboard — export consumes the in-memory report the panel already displays.

```
FullLearningReport (resolved)
  → toExportableLearningReport()   [shared — canonical adapter]
  → ┌─────────────┬─────────────┬─────────────┐
    │ Markdown    │ DOCX        │ PDF         │
    │ (shared)    │ (extension) │ (extension) │
  → downloadBlob()                  [extension — existing pattern]
```

**Do NOT** add `GET_EXPORT_REPORT` background message that re-resolves (would risk quota/Groq). Export is a **pure render** of the already-loaded report.

Account guard: compare `activeAccountContext.snapshot()` at export time with snapshot captured when report was loaded.

---

## 4. Available runtime libraries (verified)

| Package | Present | Notes |
|---------|---------|-------|
| PDF libs | **No** | Must add |
| DOCX libs | **No** | Must add |
| Markdown | N/A | Pure string generation |
| React | Yes | Dashboard only |
| Blob download | Yes | `DataControlSection.downloadJson()` pattern |

**Extension permissions:** `storage`, `activeTab`, `clipboardWrite` — **no `downloads` permission required** for `<a download>` + blob URL pattern.

**CSP:** `script-src 'self'` — all generation must be bundled locally; no external CDN scripts at runtime.

---

## 5. PDF strategy (decision)

**Library:** `pdfmake` (browser-compatible, table support, custom TTF fonts).

**Arabic:** Default pdfmake vfs (Roboto) does **not** support Arabic glyphs. Bundle `NotoSansArabic-Regular.ttf` under `extension/public/fonts/` and register with pdfmake vfs at first export.

**RTL:** pdfmake `alignment: 'right'` + Arabic font for `ar` locale. Mixed Arabic/English examples use the same font (Noto Sans Arabic covers Latin). Imperfect bidirectional ordering for inline English within Arabic paragraphs is a **known P3 limitation** — documented, not hidden.

**LTR locales (en, tr):** Roboto from pdfmake default vfs.

---

## 6. DOCX strategy (decision)

**Library:** `docx` (generates valid OOXML in browser/Node).

**Arabic:** Section `rightToLeft: true` + paragraph `bidirectional: true` for `ar` locale.

**Tables:** Recurring patterns as simple table rows.

---

## 7. Markdown strategy (decision)

Pure deterministic renderer in `@flowlary/shared` — UTF-8, headings, lists, pattern table. No dependencies. Fully testable in Node.

---

## 8. Browser download strategy (verified)

Reuse existing pattern from `DataControlSection.tsx`:

```typescript
const blob = new Blob([bytes], { type: mime })
const url = URL.createObjectURL(blob)
link.download = filename
link.click()
URL.revokeObjectURL(url)
```

Runs in dashboard extension page (full tab) — no new permissions.

---

## 9. Localization strategy

Reuse `resolveMessage()` / export labels built from same i18n keys as `LearningReportPanel`.

| Locale | Support |
|--------|---------|
| `en` | Full |
| `ar` | Full overrides in `ar.ts` |
| `tr` | Falls back to English (`resolveMessage` fallback) — **document honestly** |

English learning examples (`original → corrected`) never translated.

---

## 10. Arabic / RTL strategy

| Format | Approach |
|--------|----------|
| Markdown | UTF-8; no structural RTL (acceptable for `.md`) |
| DOCX | `rightToLeft` section property |
| PDF | Noto Sans Arabic font + right alignment |
| Dashboard | Already uses `document.dir` from locale |

---

## 11. Account isolation

- Report loaded via account-scoped `resolveFullLearningReport()` — confirmed in prior phase tests.
- Export must capture `activeAccountContext.snapshot()` when report loads; reject export if context changed.
- No client-provided account ID in export path.

---

## 12. Privacy

Export adapter strips: `targetPatternId`, `ruleId`, `evidenceVersion`, account IDs, cache keys, API URLs.

---

## 13. Quota / cost implications

Export is **render-only**:

| Resource | Consumed on export? |
|----------|---------------------|
| Groq | **No** |
| Correction credits | **No** |
| Full report quota | **No** |
| Daily brief quota | **No** |

Same resolved report → unlimited exports.

---

## 14. Security

- No upload to external services
- No new host permissions
- Font loaded from extension package (`chrome.runtime.getURL`)
- CSP compliant (bundled scripts only)

---

## 15. Test strategy

| Layer | Tests |
|-------|-------|
| Shared | Markdown renderer, export adapter, semantic fingerprint, no internal IDs |
| Extension | DOCX/PDF bytes, cross-format fingerprint match, account guard |
| Integration | Quota unchanged after export, signed-out blocked, isolation |

PDF/DOCX validation: magic bytes + text extraction from raw bytes / unzip.

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Arabic PDF missing glyphs | Bundled Noto Sans Arabic; test Arabic string in output |
| pdfmake + Vite ESM | Dynamic import / default export shim |
| Font binary size (~200KB) | Acceptable for learning report quality |
| TR incomplete i18n | Document English fallback |
| RTL inline mixing | Document P3 limitation |

---

## 17. Recommended implementation plan

1. `packages/shared/src/learningReportExport.ts` — adapter + Markdown + fingerprint
2. `extension/src/features/learningReport/export/` — labels, download, DOCX, PDF
3. Bundle Noto Sans Arabic font
4. Replace disabled Export button with accessible dropdown
5. Tests + regression
6. `REPORT_EXPORT_IMPLEMENTATION.md`

**Files intentionally untouched:** Learning engine, quota resolver, Groq provider, entitlement, practice, translation, layout.

---

## Audit verdict

Export can attach **downstream of resolved `FullLearningReport`** with minimal new surface area. No architectural change to the learning engine required.

**PROCEED WITH IMPLEMENTATION.**
