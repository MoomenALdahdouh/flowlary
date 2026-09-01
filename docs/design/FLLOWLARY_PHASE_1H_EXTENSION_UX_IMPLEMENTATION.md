# Flowlary Phase 1H — Chrome Extension UX/UI Reconciliation

## 1. Executive summary

Phase 1H reconciled the Flowlary Chrome Extension popup, dashboard shell, usage presentation, and Arabic product copy with the Phase 1C–1G design system — **without changing product behavior, AI engines, entitlements, billing, or messaging contracts**.

The extension now reads as a compact daily companion: **Write → Get help → Keep flowing → Learn**, with one dominant primary action (Fix Writing), quieter secondary tools, solid surfaces instead of glass-by-default, and human product language (“AI writing checks” instead of “AI credits” / “Free AI”).

---

## 2. Surfaces inspected

| Surface | Location |
|---------|----------|
| Popup shell | `extension/src/popup/App.tsx`, `tokens.css` |
| First Win | `extension/src/popup/views/FirstWinView.tsx` |
| Popup home | `extension/src/popup/views/HomeView.tsx` |
| Usage / credits | `extension/src/ui/UsageStatusCard.tsx`, `usageUx.ts` |
| System status | `extension/src/ui/SystemStatus.tsx` |
| Dashboard | `extension/src/dashboard/App.tsx`, `dashboard.css` |
| Correction explain UI | `extension/src/features/correction/ui/*` (copy only via i18n) |
| Speed Box entry | popup shortcuts + First Win hint |
| Settings panels | dashboard settings panels |
| EN/AR i18n | `extension/src/popup/i18n/en.ts`, `ar.ts` |
| Error humanization | `extension/src/popup/api.ts` |

Protected systems (AI gateway, correction/translation/layout engines, credits accounting, auth, background worker, content scripts) were **not modified**.

---

## 3. Existing UX problems

1. **Glass-heavy chrome** — popup header, footbar, usage strip, cards, and dashboard sidebar used backdrop-filter, gradients, and glow.
2. **Flat action hierarchy** — Fix Writing, Translate, and Fix Layout were all styled as primary CTAs.
3. **Wrong popup order** — feature toggles appeared before quick actions; shortcuts duplicated at the bottom.
4. **Technical error copy** — `humanizePopupError` and i18n referenced `npm run dev:api` and provider-style failures.
5. **Credits terminology** — usage progress aria-label said “AI credits”; usage card comment referenced “Glass Blur Snow”.
6. **Anxiety-inducing usage copy** — “Free AI”, “credits used”, UTC reset jargon in user-facing strings.
7. **Arabic debt** — literal “أرصدة AI”, inconsistent action labels, duplicate `usage` catalog key.
8. **AI state tokens unused** — `--fl-ai-*` existed but strips did not reflect state visually.

---

## 4. First Win changes

- Preserved install-scoped first-win gating and command flow unchanged.
- Added calm card surface (`.fl-first-win` solid border/background).
- Arabic: “إصلاح لوحة المفاتيح” primary label; Speed Box hint describes Layout + Translate + Fix in one place.
- Title size tightened (15px) for popup density.

---

## 5. Popup changes

**Home hierarchy (new order):**

1. Extension / system status (compact)
2. Sign-in banner (when applicable)
3. **Quick actions** — Fix Writing (primary), Translate + Fix Layout (secondary)
4. Usage strip or usage card (quiet when healthy)
5. Tools toggles (correction, translation, layout modes)

Removed duplicate shortcuts section at the bottom; shortcut hint lives under quick actions.

Usage strip label changed from “Flowlary AI” to localized **Usage** (`usage.title`).

AI strip tones: `is-ready`, `is-working`, `is-unavailable`, `is-exhausted` with `--fl-ai-*` border accent.

---

## 6. Dashboard changes

Phase 1H CSS block at end of `dashboard.css`:

- Solid sidebar, header, nav rail, and cards
- Removed default backdrop-filter from dashboard chrome
- Nav active state uses accent-soft fill instead of glass inset highlight

No nav structure or panel logic changed.

---

## 7. Correction UI changes

- No algorithm, segmentation, debounce, or card behavior changed.
- Arabic explanation panel test aligned with catalog string `لماذا هذا التغيير؟`.
- Content-script explain strings continue to load via `localeCatalog.ts` (unchanged architecture).

---

## 8. Translation changes

- No routing or accounting changes.
- Translate remains a **secondary** popup action (outlined), visually distinct from primary Fix Writing.
- Arabic: “ترجم النص” action label.

---

## 9. Fix Layout changes

- Secondary button styling in popup (not competing with Fix Writing).
- First Win remains primary entry for Fix Layout with unchanged shortcut/command path.
- Arabic: “إصلاح لوحة المفاتيح”.

---

## 10. Speed Box changes

- Hint copy preserved in First Win and compact shortcut note.
- No overlay, settings toggle, or command architecture changes.

---

## 11. Usage/credits presentation

- User language: **“AI writing checks”** throughout EN usage UX overrides.
- Exhaustion: “You've used today's AI writing checks” + local tools still available.
- Healthy usage: quiet compact strip (no full card).
- Low / exhausted / unavailable: `UsageStatusCard` unchanged structurally; solid styling applied.
- Progress bar aria-label humanized (no “AI credits”).

Credit values (500 Free / 1,000 Pro/Trial), reset behavior, and server accounting **unchanged**.

---

## 12. Account/plan presentation

- Footbar plan label unchanged (`resolveAccountPlanLabel`).
- Sign-in banner and account CTAs use existing dashboard bridge.
- Student Pro display relies on existing server plan strings (no entitlement logic changes).

---

## 13. Learning entry points

- Dashboard footbar “Dashboard” link and brief teaser unchanged.
- Learning remains a bridge (progress teaser in footbar), not an LMS in the popup.

---

## 14. Settings changes

- No new settings exposed.
- Settings blocks inherit solid surface overrides from Phase 1H CSS.
- Developer/provider diagnostics remain out of normal user paths.

---

## 15. Error/loading/success states

| Before | After |
|--------|-------|
| `npm run dev:api` in network/register errors | “You're offline. Local tools are still available.” |
| Provider-style AI errors with layout shortcut noise | “AI is temporarily unavailable. Try again — local tools still work.” |
| “Today's Free AI is used up” | “You've used today's AI writing checks…” |
| `featureReason.serviceUnavailable` with dev commands | Human retry message |

Loading strings remain localized (“Checking…”, “جاري التحقق…”).

---

## 16. Arabic copy changes

Natural Modern Standard Arabic pass on:

- Quick actions: صحّح كتابتك / ترجم النص / إصلاح لوحة المفاتيح
- Usage exhaustion: استهلكت فحوصات الكتابة بالذكاء الاصطناعي لهذا اليوم
- AI unavailable: الذكاء الاصطناعي غير متاح مؤقتا
- First Win: إصلاح لوحة المفاتيح primary CTA
- Removed duplicate `usage` key; fixed harakat where added (متبقٍ)

---

## 17. RTL changes

- `border-inline-start` for AI strip state accents (direction-aware).
- `text-align: end` on usage strip value.
- Existing RTL popup/dashboard layouts preserved; no blind icon mirroring added.

---

## 18. Responsive changes

- Popup width unchanged (360px default; 320–480 supported by existing shell).
- Compact section labels (10px uppercase) and tighter shortcut note (10px).
- No horizontal overflow introduced by hierarchy reorder.

---

## 19. Accessibility

- Usage progress aria-label uses human “AI writing checks” wording.
- Quick actions retain semantic buttons + shortcut kbd elements.
- AI strip keeps `role="status"`.
- Focus-visible outline unchanged (`--fl-focus`).
- Reduced glass/blur improves contrast stability in light and dark themes.

---

## 20. Design-system migrations

- Reused shared tokens (`--fl-surface-2`, `--fl-border`, `--fl-accent`, `--fl-ai-*`).
- Added `.fl-action-btn-secondary` for outlined actions.
- Solid surfaces replace default glass on shell, cards, usage, and dashboard chrome.
- No duplicate Button component; existing `.fl-action-btn-*` primitives extended.

---

## 21. Protected systems untouched

AI gateway, Groq provider, Google translation routing, credits accounting, credit values, pricing, Paddle, student verification, trial rules, auth/session, API contracts, learning events, writing segmentation, correction scheduler, DOM engines, content scripts, background worker, bridge protocols, `chrome.commands` — **not modified**.

---

## 22. Files changed

| File | Change |
|------|--------|
| `extension/src/popup/views/HomeView.tsx` | Hierarchy, button tiers, AI strip tones |
| `extension/src/popup/api.ts` | Humanized errors |
| `extension/src/popup/tokens.css` | Phase 1H solid surfaces + secondary button + AI strip |
| `extension/src/dashboard/dashboard.css` | Phase 1H dashboard solid surfaces |
| `extension/src/ui/UsageStatusCard.tsx` | Aria-label + comment |
| `extension/src/popup/i18n/en.ts` | Usage UX, errors, actions.section, readiness |
| `extension/src/popup/i18n/ar.ts` | Arabic product copy, duplicate key fix |
| `tests/unit/popup/errors.test.ts` | Updated expectations |
| `tests/unit/popup/status.test.ts` | Updated low-usage copy expectation |
| `tests/unit/ui/translateUsageUx.test.ts` | Updated EN catalog expectation |
| `tests/unit/correction/ExplanationPanel.test.ts` | Arabic string alignment |

---

## 23. Tests

```
npm run test -w @flowlary/extension
→ 1125 passed | 2 skipped (1127)
```

**Pre-existing failures:** none after Phase 1H (ExplanationPanel Arabic expectation was stale vs catalog).

**New regressions:** none.

---

## 24. Build

```
npm run build:release -w @flowlary/extension  → ✓
npm run package:release                       → ✓ flowlary-v1.1.0.zip
Package validation: OK (no localhost in host_permissions)
```

---

## 25. Security verification

```
npm run test -w @flowlary/extension -- ../tests/integration/phase23-security.test.ts
→ 2/2 passed
```

No security checks weakened.

---

## 26. Visual QA

Automated extension screenshots were **not captured** in this pass (no extension popup automation in CI). Recommended manual matrix:

| Surface | EN Light | EN Dark | AR Light | AR Dark |
|---------|----------|---------|----------|---------|
| Popup home | — | — | — | — |
| First Win | — | — | — | — |
| Dashboard | — | — | — | — |
| Settings | — | — | — | — |
| Usage exhausted | — | — | — | — |
| AI unavailable | — | — | — | — |

Build artifacts verified; visual spot-check recommended at 360px popup width.

---

## 27. Remaining design debt

1. **Legacy glass tokens** — base rules in mid-file `tokens.css` still define glass variables; Phase 1H overrides at file end win for targeted selectors but a future pass could simplify source rules.
2. **Content-script overlays** (correction card, Speed Box, translation card) — not restyled in 1H; still use feature-specific overlay styling.
3. **Shared `usageUx.ts` English defaults** — extension i18n overrides launch locales; shared defaults still say “Today's Free AI is used up” for non-catalog consumers.
4. **Dashboard compose/practice panels** — solid shell only; inner panel density not fully reconciled.
5. **Student Pro dedicated popup badge** — relies on plan string from server; no new student-specific card art.
6. **Automated visual regression** — extension popup screenshot CI not yet wired.

---

## Before → After (12 UX improvements)

| # | BEFORE | AFTER | WHY |
|---|--------|-------|-----|
| 1 | Three primary-blue action buttons | One primary (Fix Writing) + two secondary | Clear daily hierarchy |
| 2 | Feature toggles above actions | Quick actions immediately after status | Answers “what can I do now?” |
| 3 | Duplicate shortcuts section at bottom | Single quick-actions block + hint | Less scroll, less repetition |
| 4 | Glass header/footbar/cards | Solid `surface-2` + border | Matches website Phase 1F/1G language |
| 5 | “Flowlary AI” usage strip label | Localized “Usage” + compact line | Less technical branding in meter |
| 6 | “AI credits” aria-label | “AI writing checks remaining” | Accessible, human wording |
| 7 | Errors mentioned `npm run dev:api` | “You're offline” / retry guidance | Production-safe copy |
| 8 | “Today's Free AI is used up” | “You've used today's AI writing checks” | Calmer, accurate product term |
| 9 | AI errors referenced providers/shortcuts | “AI is temporarily unavailable” | No implementation leakage |
| 10 | Arabic “أرصدة AI المجانية” | “فحوصات الكتابة بالذكاء الاصطناعي” | Professional product Arabic |
| 11 | No visual AI state on usage strip | Colored inline-start accent per state | Scannable status without reading codes |
| 12 | First Win floated in open layout | Bordered calm card | Onboarding feels intentional, not empty |

---

*Phase 1H complete. Phase 1I not started.*
