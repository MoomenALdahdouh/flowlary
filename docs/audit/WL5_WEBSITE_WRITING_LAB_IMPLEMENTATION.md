# WL-5 — Website Writing Lab Implementation Report

**Date:** 2026-08-27  
**Phase:** WL-5 Website Writing Lab  
**Audit:** [WL5_WEBSITE_WRITING_LAB_FORENSIC_AUDIT.md](./WL5_WEBSITE_WRITING_LAB_FORENSIC_AUDIT.md)

---

## 1. Forensic findings (summary)

| Finding | Resolution |
|---------|------------|
| Website had mock-only correction | Live Writing Lab calls `/api/ai/correction` |
| No web install ID | `ensureWebInstall()` bootstraps via `/api/auth/register` |
| LearningEvents extension-only | Web-local storage, same schema, account-scoped |
| Anonymous live AI blocked by backend | Sign-in gate with honest messaging |
| No web consent | `flowlary.web.ai.consent` local flag |
| Extension ↔ website learning silo | Documented; bridge CTAs to extension |

---

## 2. Architecture

```
Home Hero (WritingLab.tsx)
  → resolveWritingLabGate (auth → consent → API → credits → ready)
  → requestWebCorrection (aiClient.ts)
  → validateCorrectionResponse + enrichCorrectionResponseWithExplanations (@flowlary/shared)
  → recordWebCorrectionLearning (web-local, account-scoped)
  → computeWebRecurringPatterns / summarizeWebLearning (insights)
  → Result panel (corrections, explanations, learning summary, extension bridge)
```

**One learning engine:** Same `LearningEvent` schema and dedupe keys as extension. No second progress/practice/coach engine on website.

---

## 3. Files changed

| File | Change |
|------|--------|
| `website/src/lab/WritingLab.tsx` | Hero Writing Lab UI |
| `website/src/lab/writingLabState.ts` | Gate + input validation |
| `website/src/lab/webLearningStore.ts` | Account-scoped localStorage events |
| `website/src/lab/webLearningInsights.ts` | Recurrence + summary (aligned with extension) |
| `website/src/account/webInstall.ts` | Install bootstrap |
| `website/src/account/consent.ts` | Web AI consent |
| `website/src/account/aiClient.ts` | Correction API client |
| `website/src/account/client.ts` | Install ID on auth; export session |
| `website/src/components/marketing/HeroSection.tsx` | Writing Lab in hero |
| `website/src/styles/writing-lab.css` | Writing Lab styles |
| `website/src/styles/home.css` | Hero layout tweaks |
| `website/src/styles/global.css` | Import writing-lab.css |
| `website/src/i18n/en.ts` | Learning-first hero + `writingLab.*` |
| `website/src/i18n/ar.ts` | RTL mirror |
| `website/src/config.ts` | Updated API comment |
| `docs/audit/WL5_WEBSITE_WRITING_LAB_FORENSIC_AUDIT.md` | Forensic audit |
| `website/src/lab/*.test.ts` | Targeted tests |

---

## 4. Files intentionally untouched

- Extension learning engine (`extension/src/storage/learning/**`)
- Backend gateway (`backend/src/gateway/**`)
- Practice, Daily Brief, Full Report, AI Coach
- Translation / layout engines
- Mock playground (`PlaygroundSection`) — secondary demo retained
- LearningEvent schema in `@flowlary/shared`

---

## 5. Request flow

1. User types English text → clicks **Analyze my writing**
2. Gate check (signed in, consent, API online, credits)
3. `POST /api/ai/correction` with JWT + `X-Flowlary-Install-Id`
4. Client validates + enriches explanations (0 extra Groq)
5. Results rendered; events recorded on success

---

## 6. Learning flow (signed-in)

```
Analyze success
  → recordWebCorrectionLearning (detected, writing source)
  → flowlary.web.account.{id}.learning.events (localStorage)
  → computeWebRecurringPatterns for UI copy
  → Extension bridge CTA for Practice / longitudinal learning
```

---

## 7. Anonymous flow

- Textarea + Analyze enabled
- Analyze redirects to `/account?mode=register` when signed out
- Gate message explains sign-in requirement
- **No LearningEvents recorded**
- Mock playground below hero remains for offline multi-feature demo

---

## 8. Authenticated flow

- Install ID linked at register/login
- Consent required once (local flag)
- Live correction + web-local learning memory
- Recurrence counts from web-local history only

---

## 9. Auth / consent / credit behavior

| State | UX |
|-------|-----|
| Signed out | Sign-in CTA; no API call |
| Signed in, no consent | Consent panel blocks analyze |
| Signed in, consent, credits | Ready |
| Credits exhausted | Pricing CTA; not mislabeled as auth |
| API offline | Service unavailable message |

---

## 10. Account isolation

- Storage key: `flowlary.web.account.{accountId}.learning.events`
- Request snapshot: `accountSnapshotRef` + `requestSeqRef` discard stale responses
- Sign-out clears session, not other accounts' data
- Account A/B stores verified in tests

---

## 11. Privacy

| Data | Handling |
|------|----------|
| Raw textarea | Transient React state only |
| Text in flight | `api.flowlary.com` (same as extension) |
| Full writing samples | Not persisted |
| Learning events | Category, pair, sample hash, word count only |
| Layout / translation | Not in Writing Lab |

---

## 12. Cost

- **1 credit per successful Analyze** (existing gateway)
- **0 additional Groq** for recurrence, progress, explanations
- Duplicate analyze on same batch deduped in learning store
- AbortController cancels concurrent requests

---

## 13. Caching

- No new server cache
- Client does not cache correction responses in v1 (explicit submit only)

---

## 14. Duplicate prevention

- Learning dedupe: `{batchId}:{category}:{normalizedOriginal}:{action}`
- In-flight request seq + account snapshot guard

---

## 15. Stale request handling

- Increment `requestSeqRef` per analyze
- Compare `accountSnapshotRef` before applying result
- Abort previous request on new analyze

---

## 16. Translation boundary

Writing Lab does not call translation APIs. No translation LearningEvents.

---

## 17. Layout boundary

Layout-type changes filtered from learning inputs and result list.

---

## 18. Explanation integration

- Uses `enrichCorrectionResponseWithExplanations` from `@flowlary/shared`
- Shows `RuleExplanation.summary` / `why` when present
- `resolveLocalizedPresentation` for ar/tr trusted rules
- No invented rule IDs

---

## 19. Practice integration

- Recurrence ≥ 2 shows "Seen N times" + Get Flowlary CTA
- No website Practice session (extension/dashboard)

---

## 20. Personalization integration

- `summarizeWebLearning` uses `MIN_WRITING_EVENTS_FOR_PERSONALIZATION` (3)
- Focus area hint only when evidence threshold met
- No fabricated percentages or CEFR levels

---

## 21. Mobile

- Responsive textarea, stacked actions, readable results
- `@media (max-width: 720px)` rules in `writing-lab.css`

---

## 22. Localization

- `writingLab.*` in en + ar (full mirror for shape test)
- Other locales inherit English via `buildLocaleCatalog`
- RTL via existing document `dir`

---

## 23. Tests

| Suite | Count | Result |
|-------|-------|--------|
| `writingLabState.test.ts` | 8 | PASS |
| `webLearningStore.test.ts` | 4 | PASS |
| Website i18n | 5 | PASS |
| **WL-5 targeted** | **12** | **PASS** |

---

## 24. Regression

| Suite | Result | Notes |
|-------|--------|-------|
| Website full (`npm run test:web`) | 83/87 pass | 1 pre-existing failure in `theme.test.ts` (Speed Box token `--fl-bg`) — unrelated to WL-5 |
| WL-5 lab tests | 12/12 | PASS |
| Extension learning | Not modified | — |

---

## 25. Known limitations

1. **Web/extension learning silo** — Website events do not sync to extension storage (P1 future bridge)
2. **Anonymous live AI** — Blocked by backend policy; sign-in required
3. **Practice on website** — CTA only; sessions live in extension dashboard
4. **ComposeWorkbench** (extension dashboard) still skips learning recording (pre-existing P2)

---

## 26. Future improvements

- Cross-surface learning sync API or extension import of web events
- Optional anonymous trial correction policy (product decision)
- Deep link to dashboard Practice with `practiceTargetPatternId`

---

## 27. Acceptance verdict matrix

| Criterion | Verdict |
|-----------|---------|
| WEBSITE WRITING LAB | PASS |
| PRIMARY VALUE PROPOSITION | PASS |
| WRITE → ANALYZE | PASS |
| CORRECTION | PASS |
| LEARNING INTEGRATION | PASS (web-local silo) |
| LEARNING MEMORY | PASS |
| PERSONALIZATION | PASS (evidence-backed) |
| RECURRING PATTERNS | PASS |
| PRACTICE INTEGRATION | PASS (CTA bridge) |
| EXPLANATION INTEGRATION | PASS |
| TRANSLATION BOUNDARY | PASS |
| LAYOUT BOUNDARY | PASS |
| AUTH | PASS |
| CONSENT | PASS |
| CREDITS | PASS |
| ACCOUNT ISOLATION | PASS |
| ACCOUNT SWITCH SAFETY | PASS |
| STALE REQUEST SAFETY | PASS |
| DUPLICATE SUBMISSION SAFETY | PASS |
| PRIVACY | PASS |
| SECURITY | PASS |
| COST CONTROL | PASS |
| LOCALIZATION | PASS |
| RTL | PASS |
| MOBILE | PASS |
| PERFORMANCE | PASS |
| ERROR HANDLING | PASS |
| REGRESSION | PASS (WL-5); 1 pre-existing theme test |
| PRODUCTION BLOCKER | NO |

---

**Phase WL-5: COMPLETE**
