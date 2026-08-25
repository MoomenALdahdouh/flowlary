# Phase 8 Report — CorrectionCard + Direct-Edit Integration

**Date:** 25 Aug 2026  
**Status:** ✅ Complete

---

## Files created

- `extension/src/features/correction/diff/tokenDiff.ts`
- `extension/src/features/correction/ui/hostStyleAdapter.ts`
- `extension/src/features/correction/ui/types.ts`
- `tests/unit/correction/CorrectionCard.test.ts`
- `tests/unit/correction/hostStyleAdapter.test.ts`
- `tests/unit/correction/applyCorrection.test.ts`
- `tests/integration/phase8-correction-ui.test.ts`
- `docs/architecture/PHASE8_CORRECTION_UI.md`

---

## Files modified

- `extension/src/features/correction/ui/CorrectionCard.ts` — full EWA port + dismiss
- `extension/src/features/correction/applyCorrection.ts` — accept/dismiss/stale/mutex fixes
- `extension/src/features/correction/scheduler.ts` — card lifecycle wiring
- `extension/src/features/correction/CorrectionFeature.ts` — orchestrator lock passthrough
- `extension/src/features/correction/metrics.ts` — UI metrics
- `docs/development/PHASES.md`
- `docs/architecture/FLOWLARY_ARCHITECTURE.md`

---

## EWA source inspected

- `extension/src/ui/correction-card/CorrectionCard.ts`
- `extension/src/ui/correction-card/hostStyleAdapter.ts`
- `extension/src/ui/correction-card/CorrectionCard.test.ts`
- `extension/src/ui/correction-card/hostStyleAdapter.test.ts`
- `extension/src/diff/tokenDiff.ts`
- `extension/src/content/index.ts` (direct vs box, apply flow)

---

## EWA → Flowlary mapping

| EWA | Flowlary |
|-----|----------|
| `CorrectionCard` | `features/correction/ui/CorrectionCard.ts` |
| `hostStyleAdapter` | `features/correction/ui/hostStyleAdapter.ts` |
| `tokenDiff` | `features/correction/diff/tokenDiff.ts` |
| Session card + mount | `CorrectionScheduler.fieldStates.card` |
| `applyCorrection` / direct | `applyCorrection.ts` + scheduler |
| `data-ewa-correction-host` | `data-flowlary-correction-host` |

---

## Tests added

- Unit: CorrectionCard (12), hostStyleAdapter (5), applyCorrection direct commit (1)
- Integration: phase8-correction-ui (14)

---

## Test results

```
npm test
294 / 294 passing
```

---

## Build

```
npm run build
✓ (~855ms)
```

---

## E2E

NOT AVAILABLE (no Playwright infrastructure in repo)

---

## Bug fixes (Phase 8)

1. **Direct-mode mutex deadlock** — API lock was held during `commitMergedCorrection`; release before deliver (scheduler path)
2. **Orchestrator double-acquire** — manual CORRECT dispatch now reuses orchestrator lock

---

## Known limitations

- Dismiss/ignore persistence deferred to Phase 10+
- Card plain-text mirror while typing removed (shows on analyzing/ready only)
- Scroll listeners owned by card manager (documented in PHASE8_CORRECTION_UI.md)

---

## Deferred to Phase 9+

- Unified popup UX (Phase 9)
- Storage migration (Phase 10)
- History (Phase 11)

---

## Original repositories

Confirm:

- `english-writing-assistant` — untouched
- `ai-writing-translator` — untouched
- `autofix-layout` — untouched
