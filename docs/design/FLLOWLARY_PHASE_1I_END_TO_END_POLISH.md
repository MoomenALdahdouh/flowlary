# Flowlary Phase 1I — End-to-End Product Consistency & Conversion Polish

## 1. Executive summary

Phase 1I is the final cross-surface UX/UI reconciliation before launch. It aligns **terminology**, **AI state language**, **empty states**, **student/pricing honesty**, and **pricing-page visuals** across the website, account, dashboard, Writing Lab, and Chrome extension — without changing product functionality, commercial logic, or AI behavior.

The product now speaks one language: **AI writing checks**, **Fix Layout**, **Speed Box**, **Writing Lab**, and human AI failure copy everywhere users look.

---

## 2. Cross-surface audit (before implementation)

| Issue | Surfaces affected |
|-------|-------------------|
| “AI credits” vs “AI writing checks” mixed | Website account, shared `usageUx`, extension usage |
| “Free AI” / “AI allowance” in exhaustion copy | Shared `usageUx`, Writing Lab gates, extension |
| “Couldn't reach Flowlary AI” inconsistent with Phase 1H | Shared `usageUx`, extension `status.ts` |
| Groq named in public FAQ | Website pricing FAQ |
| Developer error in correction apply path | Extension in-page correction |
| Student “full year” vs 12-month implementation | Website EN/AR pricing |
| Weak empty states (report, brief, progress) | Website dashboard |
| Pricing cards still glass-heavy | Website `/pricing` CSS |
| Arabic “رصيد الذكاء” / “مختبر الكتابة” inconsistent | Website account + Writing Lab AR |
| `npm run dev:api` removed from popup but remained in applyCorrection | Extension content UI |

**Protected systems:** untouched (AI gateway, credits values, Paddle, auth, engines, bridges).

---

## 3. Brand consistency

Reinforced calm, useful, professional tone by:

- Removing pricing-page atmospheric glow default
- Solid plan/trust cards on `/pricing`
- Human product language instead of provider/dev terminology
- No new colors, no new animations, no conversion dark patterns

---

## 4. Terminology (canonical map)

| Concept | Canonical user-facing term |
|---------|---------------------------|
| Daily AI quota | **AI writing checks** |
| Keyboard repair | **Fix Layout** |
| Overlay utility | **Speed Box** |
| Website writer | **Writing Lab** |
| Learning area | **Learning** / **Practice** / **Progress** |
| Paid tier | **Pro** |
| Academic tier | **Student Pro** |
| AI outage | **AI is temporarily unavailable** |
| Offline | **You're offline. Local tools are still available.** |
| Exhaustion | **You've used today's AI writing checks** |

Avoid in live UX: “AI credits”, “Free AI”, “Groq”, “gateway”, “npm run dev:api”.

Internal code may retain `creditsRemaining` identifiers — not user-facing.

---

## 5. CTA consistency

Existing routes preserved:

| Surface | Primary CTA |
|---------|-------------|
| Marketing home | Get Flowlary → install/account |
| Pricing | Try Pro Free / Start Pro → account |
| Account | Start writing / Manage subscription |
| Dashboard | Writing Lab + Learn sections (Phase 1G) |
| Extension popup | Fix Writing (primary), Translate/Layout (secondary) |
| First Win | Fix Layout |

No new routes. No forced upgrade modals.

---

## 6. Conversion flow

Audited path: Landing → Pricing → Register → Trial → Install → First Win → Write → Learn → Upgrade.

- Trial terms remain honest (30 days, no card)
- Free local tools always available at exhaustion
- Student verification requires server confirmation
- No fake urgency, counters, or dark patterns

---

## 7. First 10 minutes

Copy improvements only:

- Writing Lab gates explain exhaustion in product language
- First Win unchanged functionally; messaging aligned with website (Fix Layout, Speed Box)
- Account welcome lines already guide Trial → Writing Lab → extension

---

## 8. Pricing consistency

Verified live values via `FLOWLARY_PRICING`:

| Plan | AI writing checks/day | Price |
|------|----------------------|-------|
| Free | 500 | $0 |
| Trial | 1,000 | 30-day trial |
| Pro | 1,000 | $4.99/mo · $39/yr |
| Student Pro | 1,000 | 12 months after verification |

No stale $9/$90/40/60/200 in live UX. Pricing tests pass.

---

## 9. Student consistency

- EN: “12 months” (not “full year” / calendar-year claim)
- AR: “12 شهرا” (not “سنة كاملة”)
- FAQ retains honest academic-email verification language
- Implementation remains 12 × 30 days (360 days) — marketing uses “12 months”

---

## 10. Credit UX consistency

Aligned shared `usageUx.ts`, website account, Writing Lab, extension popup:

- Healthy: quiet strip/card
- Low: “running low on AI writing checks”
- Exhausted: calm message + local tools note
- Google translation availability preserved in copy

Credit **values and accounting unchanged**.

---

## 11. AI states

Unified offline/unavailable/exhausted strings in:

- `packages/shared/src/usageUx.ts`
- `extension/src/popup/status.ts`
- Website Writing Lab gates/errors
- Extension `applyCorrection.ts` user errors

---

## 12. Learning consistency

Improved empty/building copy for Progress, Report, Daily Brief (EN + AR):

- Explains what the surface is
- Why empty
- What to do next (write in Writing Lab or extension)

No fake metrics introduced.

---

## 13. Empty states

| Surface | After |
|---------|-------|
| Progress building | “Keep writing… patterns will appear as Flowlary records corrections” |
| Learning report | “Not enough writing yet… report will appear here” |
| Daily brief | “Appears after you write with Flowlary” |

---

## 14. Error/loading states

- Correction network error: “You're offline…” (no dev:api)
- Writing Lab: “Checking…”, “Analyzing…”, human retry
- Account: already humanized in Phase 1F

---

## 15. Arabic

High-priority pass:

- فحوصات الكتابة (not رصيد الذكاء)
- مساحة الكتابة (consistent Writing Lab naming)
- Natural exhaustion/offline/offline-network copy
- Student 12-month wording
- Progress/report/brief empty states rewritten

---

## 16. RTL

No structural RTL changes this phase. Existing `dir` attributes, logical properties on pricing cards (Phase 1I CSS), and extension Phase 1H RTL preserved.

---

## 17. Mobile

No layout regressions introduced. Pricing solid cards retain clamp padding from prior phases. Full mobile matrix not automated — manual spot-check recommended at 390px.

---

## 18. Desktop

Pricing hero/card max-widths unchanged. Removed hover lift on pricing cards (reduced motion-friendly).

---

## 19. Design-system cleanup

- Shared `usageUx` display strings centralized
- Pricing `.pr-surface` / `.pr-card` aligned with solid surface language from Phases 1F–1H
- No new abstractions or UI library

---

## 20. Glass/pill cleanup

**Pricing page (`product-pages.css` Phase 1I block):**

- Hidden `.pr-glow` atmospheric layer
- Solid `.pr-trust li`, `.pr-surface`, `.pr-card`
- Removed backdrop-filter from plan cards
- Pro badge row solid surface

**Not changed:** approved status pills, overlay contexts, features page `.pp-glass` (deferred).

---

## 21. Motion

- Disabled pricing card hover translate in Phase 1I
- Existing `prefers-reduced-motion` rules preserved

---

## 22. Accessibility

- Terminology clarity in aria-adjacent labels (account usage section)
- No focus/contrast regressions introduced
- Human error strings improve screen-reader comprehension

---

## 23. SEO/marketing honesty

- Removed Groq name from public pricing FAQ (AI-backed refinement)
- Student verification claims unchanged and honest
- No fake statistics added

---

## 24. Security

- No secrets, tracking, or debug endpoints added
- Release security scan passes
- `apiHealth.ts` dev hint remains dev-only (not in release bundles for user UI)

---

## 25. Tests

```
npm test                          → 1125 passed, 2 skipped
npm run test:web                  → 128 passed
```

Updated tests for unified AI unavailable / exhaustion copy.

**New regressions:** none.

---

## 26. Builds

```
npm run build:web                 → ✓ (14 prerendered routes)
npm run build:release -w @flowlary/extension → ✓
npm run package:release           → ✓ flowlary-v1.1.0.zip
```

---

## 27. Visual QA

Automated cross-surface screenshots **not captured** (no browser automation for extension/popup). Recommended manual matrix documented in Phase 1H; still applicable.

Build + prerender verified; visual spot-check recommended before launch.

---

## 28. User journey QA (logical walkthrough)

| Journey | Status |
|---------|--------|
| New user: Landing → Pricing → Register → Trial | Copy consistent; pricing values canonical |
| Install → First Win → Fix Layout | Promise matches extension behavior |
| Write → Correction → Learning | Writing Lab + dashboard empty states guide next step |
| Free → low → exhausted | Human copy; local tools noted |
| Pro upgrade → billing | Unchanged (Phase 1F) |
| Student verify → Student Pro | 12-month honest messaging |

No business behavior altered.

---

## 29. UX scorecard (evidence for scores < 8)

| Surface | Clarity | Hierarchy | Consistency | Trust | Ease | Visual | Arabic | Mobile | A11y |
|---------|---------|-----------|-------------|-------|------|--------|--------|--------|------|
| Marketing | 8 | 8 | 8 | 8 | 8 | 8 | 7 | 8 | 8 |
| Account/Auth | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| Dashboard | 8 | 8 | 8 | 8 | 7 | 8 | 7 | 7 | 8 |
| Writing Lab | 8 | 8 | 8 | 8 | 8 | 8 | 7 | 8 | 8 |
| Extension popup | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| In-page extension UI | 7 | 7 | 7 | 8 | 8 | 6 | 7 | 8 | 7 |

**Below 8 — evidence:**

- **Marketing Arabic (7):** Features page AR overrides less complete than pricing/account.
- **Dashboard Arabic (7):** Some dashboard panel strings still fall back to English.
- **Dashboard mobile (7):** Authenticated nav dense at 390px — functional but not fully polished.
- **In-page extension visual (6):** Correction card, Speed Box, translation overlays not restyled in Phases 1H–1I (glass/legacy overlay styling remains).

---

## 30. Before → After (18 improvements)

| # | BEFORE | AFTER | WHY |
|---|--------|-------|-----|
| 1 | Shared exhaustion: “Today's Free AI is used up” | “You've used today's AI writing checks” | One product term everywhere |
| 2 | Account card: “AI credits” | “AI writing checks” | Removes meter anxiety |
| 3 | Writing Lab: “AI allowance is used up” | “You've used today's AI writing checks” | Matches extension + account |
| 4 | FAQ named “Groq-backed translation” | “AI-backed translation refinement” | No provider leakage |
| 5 | Offline summary: “Couldn't reach Flowlary AI” | “AI is temporarily unavailable” | Consistent AI state language |
| 6 | Correction apply error mentioned `npm run dev:api` | “You're offline…” | Production-safe in-page error |
| 7 | Student EN: “full year of Pro” | “12 months of Pro” | Honest vs 360-day implementation |
| 8 | Student AR: “سنة كاملة” | “12 شهرا” | Same honesty in Arabic |
| 9 | AR account: “رصيد الذكاء” | “فحوصات الكتابة” | Professional product Arabic |
| 10 | AR Writing Lab: “حصة الذكاء” | “فحوصات الكتابة بالذكاء الاصطناعي” | Natural MSA |
| 11 | Progress empty: “Building your profile” | “Your progress is building” + what appears next | Empty state answers why/when |
| 12 | Report empty: “Write more” | Full context sentence | Actionable empty state |
| 13 | Daily brief empty: one line | Explains Writing Lab/extension entry | First-10-minutes clarity |
| 14 | Pricing cards: glass + glow | Solid bordered cards | Brand consistency |
| 15 | Pricing hover lift | No lift (calmer) | Less gimmick, better reduced-motion |
| 16 | Help troubleshooting: “remaining credits” | “remaining AI writing checks” | Terminology audit |
| 17 | Extension usage.exhausted: “Free AI writing checks used” | “You've used today's AI writing checks” | Cross-surface match |
| 18 | Shared trial-ending copy: “Free AI and free local tools” | “daily AI writing checks and free local tools” | Removes “Free AI” brand confusion |

---

## 31. Remaining design debt

1. **In-page extension overlays** (correction card, Speed Box, translation bubble) — visual language still pre-1H
2. **Features page `.pp-glass`** — marketing feature cards not migrated to solid surfaces
3. **Partial Arabic fallbacks** on dashboard for non-launch locales
4. **Automated visual regression** — no CI screenshot matrix
5. **Shared code comments** still say “AI credits” (internal only)

---

## 32. Files changed

| File | Change |
|------|--------|
| `packages/shared/src/usageUx.ts` | Canonical display strings |
| `website/src/i18n/en.ts` | Terminology, empty states, FAQ, student, help |
| `website/src/i18n/ar.ts` | Arabic terminology, empty states, student |
| `website/src/styles/product-pages.css` | Phase 1I pricing solid surfaces |
| `extension/src/popup/i18n/en.ts` | Usage exhausted string |
| `extension/src/popup/status.ts` | Offline summary copy |
| `extension/src/features/correction/applyCorrection.ts` | Human network error |
| `tests/unit/shared/usageUx.test.ts` | Updated expectations |
| `tests/unit/popup/status.test.ts` | Offline copy |
| `tests/unit/popup/usage-ux.test.ts` | Offline copy |

---

## 33. Recommended next step

**Manual launch QA pass (2–3 hours):** Walk the user-journey matrix in EN + AR at 390px and 1440px with light/dark — especially authenticated dashboard, Writing Lab exhaustion, and in-page correction overlay. Then publish `release/flowlary-v1.1.0.zip` to Chrome Web Store with CWS copy aligned to canonical terminology.

**Post-launch (optional):** In-page extension overlay visual reconciliation (correction card + Speed Box) as a small follow-up — requires UX-only CSS in content scripts.

---

*Phase 1I complete. Phase 1J not started.*
