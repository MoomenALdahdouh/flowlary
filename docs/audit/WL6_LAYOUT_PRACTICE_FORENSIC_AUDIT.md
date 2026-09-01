# WL-6 — Keyboard Layout Practice Forensic Audit

**Date:** 2026-08-27  
**Scope:** Deterministic keyboard layout practice, isolated from English learning  
**Baseline:** WL-1–WL-5 complete, Phase 3D layout boundary hardened

---

## 1. Executive summary

Flowlary has a **mature local layout remapping engine** (12 layouts, golden pairs, `convertManualText`) and **explicit English/layout separation** in learning, practice, brief, report, and coach.

**WL-6 is safe** as a **parallel utility practice track**:
- Local-only exercises from golden mappings
- Separate session store (`layoutPractice.sessions`)
- **Zero Groq, zero credits, zero LearningEvents**
- Tab in Practice section next to English Practice

**Do NOT extend** English Practice engine, progression, or LearningEvent schema.

---

## 2. Existing layout architecture

| Component | Path | Notes |
|-----------|------|-------|
| Physical remap | `extension/src/features/layout/layouts/registry.ts` | `mapLayout`, `mapLayoutText` |
| Manual convert | `extension/src/features/layout/layouts/convert.ts` | `convertManualText` — **0 AI** |
| FIX_LAYOUT | `extension/src/features/layout/fixCurrentText.ts` | Local first, AI fallback optional |
| Auto-detect | `extension/src/features/layout/scheduler.ts` | Does not record learning |
| Golden pairs | `registry.ts` | `ARABIC_GOLDEN`, `ARABIC_REVERSE_GOLDEN`, `RUSSIAN_GOLDEN`, `WORLD_GOLDEN` |
| Layout learning | `recordLayoutLearning.ts` | Manual FIX_LAYOUT only → `category: 'layout'` |
| Compose demo | `ComposeWorkbench.tsx` layout mode | Local convert, no learning |

### Supported layouts (12)

`en-US-qwerty`, `ar-101`, `ru-standard`, `de-qwertz`, `fr-azerty`, `tr-q`, `el-standard`, `es-latam`, `it-standard`, `pt-abnt`, `uk-standard`, `fa-standard`

---

## 3. Audit questions — answers

### A. Where should Layout Practice live?

**Dashboard → Practice section → tab:** “English Practice” | “Keyboard Layout Practice”

### B. Reuse Practice session architecture?

**Pattern only** — separate `LayoutPracticeSessionRecord` and store key. Do not reuse `PracticeSessionRecord` (English correction-centric, sanitizer rejects layout).

### C. Reuse layout mappings?

**Yes** — golden pairs + `convertManualText` for validation.

### D. Reuse correction logic?

**No Groq correction.** Use `convertManualText` / string compare only.

### E. Create LearningEvents?

**NO** during layout practice sessions.

### F. Create practice progression?

**NO** — separate simple score (correct/incorrect count). Do not touch `practiceProgression.ts`.

### G. Affect English progress?

**NO** — layout practice uses separate store; no writes to `learning.events` or `learning.sessions`.

### H–J. Daily Brief / Full Report / AI Coach?

**NO** — all filter `category !== 'layout'` or writing-only sources.

### K. What to store?

Optional account-scoped session summaries: `{ itemsCorrect, itemsIncorrect, layouts, timestamp }` in `layoutPractice.sessions`. No raw typing history.

### L. What NOT to store?

- English LearningEvents
- Full textarea history
- Groq responses

### M–P. Account isolation / sign-out / switch

Reuse `AccountScopedStorage` + write guards. Session save discarded on account mismatch.

### Q. Authentication?

**Not required** for practice itself. Persistence optional when signed in.

### R. AI consent?

**Not required** — no AI.

### S. Groq credits?

**Zero.**

### T. Backend?

**Not required** for core exercises.

### U. Minimum implementation

1. Shared layout practice types
2. Deterministic exercise generator from goldens
3. `LayoutPracticePanel` UI (10 exercises, local scoring)
4. Optional session persistence (account-scoped)
5. Practice tab switcher
6. i18n (en + ar)
7. Tests + boundary verification

---

## 4. English-learning boundary (verified)

| System | Layout exclusion |
|--------|------------------|
| `computePracticeRecommendation` | `category !== 'layout'` |
| `filterWritingPracticeEvents` | layout excluded |
| `computeDailyBrief` | layout excluded |
| Full report snapshot | layout excluded from recurring |
| `learningCoach` context | layout excluded |
| `practiceProgression` | rejects layout category |
| Explanation WL-4C | blocks layout + practiceTargetId |

**Layout practice must not call any of these.**

---

## 5. Preferred architecture (approved)

```
Golden pairs + user layout profile pair
        ↓
buildLayoutPracticeExercises()
        ↓
LayoutPracticePanel (local UI)
        ↓
scoreLayoutPracticeAnswer() — string / convertManualText
        ↓
Session summary (8/10 correct)
        ↓
Optional: layoutPractice.sessions (account-scoped)
```

**Groq calls: 0**  
**LearningEvents: 0**  
**English progression: unchanged**

---

## 6. P0/P1 findings

| ID | Severity | Finding |
|----|----------|---------|
| P0-1 | P0 | No layout practice UI exists — **build parallel panel** |
| P0-2 | P0 | English session schema rejects layout — **separate schema required** |
| P1-1 | P1 | Product copy says “layout practice coming later” — update after ship |
| P1-2 | P1 | ComposeWorkbench layout mode is reference UX only |
| P2-1 | P2 | User layout LearningEvents could seed future personalized drills — v1 uses goldens only |

---

## 7. Verdict

```
FORENSIC AUDIT: PASS
IMPLEMENTATION SAFE: YES (parallel utility track)
ENGLISH CONTAMINATION RISK: LOW (with separate store + no LearningEvents)
PRODUCTION BLOCKER: NO (pending implementation + tests)
```

---

*Proceed to minimal implementation.*
