# WL-5 — Website Writing Lab Forensic Audit

**Date:** 2026-08-27  
**Scope:** Public website entry point into Flowlary's English-learning loop  
**Baseline:** Extension learning engine (WL-1–4F), backend AI gateway, website marketing site

---

## 1. Executive summary

The Flowlary **website is a static React marketing site** with rich **mock** correction UX but **no live AI integration**. The **extension owns Learning Memory** (`chrome.storage.local` + account-scoped keys). The **backend** exposes `/api/ai/correction` and requires **account JWT + install ID**.

**WL-5 is safe to implement** as a thin website layer that:
1. Bootstraps web install auth
2. Calls existing correction API for signed-in users
3. Records learning events to **web-local storage** (same schema, account-scoped) — **not** extension storage
4. Shows honest bridge UX to extension dashboard for longitudinal learning

**Do NOT create a second learning engine.** Reuse `@flowlary/shared` schemas, explanation enrichment, and event normalization.

---

## 2. Current website architecture

| Layer | Path | Status |
|-------|------|--------|
| Router | `website/src/App.tsx`, `routes.ts` | 12 marketing routes, no `/writing-lab` |
| Home | `website/src/pages/Home.tsx` | Hero + mock playground |
| Hero | `HeroSection.tsx` + `HeroStage.tsx` | Animated demo only |
| Playground | `PlaygroundSection.tsx`, `CorrectionMode.tsx` | Offline mock (`demoData.ts`) |
| Auth | `account/client.ts` | JWT in `sessionStorage`; no install ID |
| API | `config.ts` → `api.flowlary.com` | Auth/billing only |
| i18n | 12 locales, RTL for ar/fa | `heroCompose` strings **unused** |
| Tests | `website/src/__tests__/` | No live API tests |

**Build:** Vite + SSR prerender → static deploy.

---

## 3. Extension learning pipeline (source of truth)

```
Content script / Practice
  → CORRECT_TEXT (background/correct.ts)
  → POST /api/ai/correction
  → enrichCorrectionResponseWithExplanations
  → recordCorrectionLearning.ts
  → LearningEventService (events/index.ts)
  → flowlary.account.{id}.learning.events (chrome.storage.local)
  → progress / practice / brief / report / coach
```

**Dashboard ComposeWorkbench** runs correction but **does not record learning events** — try-it surface only.

---

## 4. Audit questions — answers

### A. Where should the Writing Lab live?

**Home page hero** — replace/supplement `HeroStage` animated demo with live `WritingLab` component. Anchor: `#writing-lab`. Keep mock playground as secondary multi-feature demo.

### B. Is the current website capable?

**Yes**, with new: install bootstrap, AI client, consent gate, Writing Lab UI. CORS already allows website origins.

### C. Can it reuse CORRECT_TEXT safely?

**Same backend endpoint**, not the extension message. Website calls `POST /api/ai/correction` directly with identical body/validation.

### D. Can website writing create LearningEvents?

**Not today.** Extension-only storage. **V1 approach:** web-local `localStorage` using **identical** `LearningEvent` schema and account-scoped key pattern. **Does not sync** with extension until future bridge (documented P1).

### E. Anonymous visitors?

**Real correction denied** — backend requires account JWT (`auth.allowed = false` for install-only). **V1:** textarea + Analyze → sign-in prompt + value explanation. Mock playground remains for offline demo.

### F. Signed-in users?

JWT + install ID + consent + credits → live correction → record events (web-local) → show recurrence from web-local history → CTAs to extension/account.

### G. Consent missing?

Local `flowlary.web.ai.consent` flag. Block Analyze until accepted (mirror extension `consentAccepted`).

### H. Credits exhausted?

Backend 403 `AI_ENTITLEMENT_DENIED`. Show existing usage messaging + pricing CTA. **Not** "sign in required."

### I. Translation/layout contamination?

Writing Lab is **correction-only**. No translation/layout API calls. Learning events filter `category !== 'layout'`. Translation activity not recorded.

### J. Account isolation?

Web events keyed by `flowlary.web.account.{accountId}.learning.events`. Account switch clears in-flight requests via snapshot guard. Sign-out does not delete scoped data.

### K. Data persistence?

| Data | Persist? | Where |
|------|----------|-------|
| Raw textarea input | **No** | Transient React state |
| Correction response | **No** | Session UI only |
| LearningEvent aggregates | **Yes** (signed-in) | localStorage, account-scoped |
| Full writing samples | **No** | Only `sampleHash` + word count in events |

### L. Minimum backend?

**None new.** Existing `/api/auth/register` (install bootstrap), `/api/ai/correction`.

### M. Duplicate learning events?

Reuse shared dedupe: `(batchId, category, normalizedOriginal)`. One batch per Analyze click. Failed/aborted requests do not record.

### N. Website vs extension corruption?

**Separate storage silos** in v1. Extension learning unaffected. Honest UX: "Install extension for learning everywhere you write."

### O. Security/privacy risks

| Risk | Mitigation |
|------|------------|
| JWT in sessionStorage | Existing account model |
| Text sent to api.flowlary.com | Same as extension; update privacy copy |
| Cross-account write | Account ID guard on record |
| XSS in results | React text nodes only |

### P. Cost implications

1 credit per successful Analyze (same as extension). No additional Groq for analytics. Stale/duplicate request protection on client.

---

## 5. Product hierarchy (required)

```
PRIMARY:    Learn English through Writing (Writing Lab hero)
SECONDARY:  Writing Correction (results panel)
SUPPORTING: Translation, Layout (nav/feature pages only — not hero)
```

---

## 6. Groq / AI operations

| Operation | WL-5 |
|-----------|------|
| Correction | 1 Groq call per Analyze (existing gateway) |
| Recurring detection | 0 — local event count |
| Progress/trends | 0 — not computed on website v1 |
| Explanations | 0 extra — `enrichCorrectionResponseWithExplanations` client-side |
| Coach/Brief/Report | 0 — dashboard only |

---

## 7. Explanation integration (WL-4C)

Use `CorrectionResponse.explanations[]` after client enrichment. Show trusted rule summary when present. No invented rule IDs. No second explanation engine.

---

## 8. Practice integration

Website has no Practice panel. **CTA:** link to extension install / account with copy "Practice this pattern in Flowlary." Use `practiceTargetPatternId()` when recurrence ≥ 2 from **web-local** events.

---

## 9. Recommended v1 scope

### In scope

- Hero Writing Lab with live correction (signed-in)
- Install bootstrap + AI client + consent
- Result panel: corrections + explanations + learning summary
- Web-local LearningEvent recording (signed-in, successful analysis)
- Recurrence count from web-local history
- Gate states: signed_out, consent, credits, unavailable
- i18n (en + ar overrides)
- Mobile-responsive editor
- Tests + regression

### Out of scope (v1)

- Extension ↔ website learning sync
- Practice session on website
- Daily Brief / Full Report / Coach on website
- Anonymous live AI correction (policy blocked)
- Translation/layout in Writing Lab hero
- New backend endpoints

---

## 10. P0/P1/P2/P3 findings

| ID | Severity | Finding |
|----|----------|---------|
| P0-1 | P0 | No website AI client — **must build** |
| P0-2 | P0 | No web install ID — **must build** |
| P0-3 | P0 | LearningEvents extension-only — **web-local adapter required for signed-in memory** |
| P1-1 | P1 | Web/extension learning silos — document + bridge CTA |
| P1-2 | P1 | Anonymous cannot get real AI — sign-in gate required |
| P1-3 | P1 | Privacy copy says "no text sent" — must update for Writing Lab |
| P2-1 | P2 | ComposeWorkbench (extension dashboard) also skips learning recording |
| P2-2 | P2 | `heroCompose` i18n unused — wire to Writing Lab |
| P3-1 | P3 | No `/writing-lab` route — hero anchor sufficient v1 |

---

## 11. Verdict

```
FORENSIC AUDIT: PASS
IMPLEMENTATION SAFE: YES (with documented web-local learning silo)
ADDITIONAL LEARNING ENGINE: ZERO
PRODUCTION BLOCKER: NO (pending implementation + tests)
```

---

*Proceed to minimal implementation per §9.*
