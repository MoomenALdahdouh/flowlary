# Phase 22A — Flowlary Foundation Cleanup

**Status:** Complete  
**Baseline:** Phase 21 (540 tests) → **548 tests green**  
**Scope:** Foundation cleanup only. No Progress analytics, Practice, LearningEvent, LearningProfile, or onboarding.

---

## 1. Files changed

### Extension — backend path & storage
| File | Change |
|------|--------|
| `extension/src/storage/retireByok.ts` | **NEW** — idempotent BYOK retirement migration |
| `extension/src/background/index.ts` | Calls `retireByokIfNeeded` on startup; status no longer exposes BYOK fields |
| `extension/src/background/correct.ts` | Removed client Groq path; correction always via Flowlary API |
| `extension/src/features/correction/readiness.ts` | Consent-only readiness; always managed |
| `extension/src/storage/schemas.ts` | `normalizeCorrection` forces managed / empty key |
| `extension/src/storage/facade.ts` | Strips groq key on save; never loads BYOK key |
| `extension/src/messaging/types.ts` | Removed `aiProvider`, `hasGroqKey` from public status |
| `extension/src/messaging/validate.ts` | Removed groq/BYOK from user patch schemas |
| `extension/src/features/correction/client.ts` | No groq key parameter |
| `extension/src/features/correction/applyCorrection.ts` | No BYOK error copy |
| `extension/src/popup/api.ts` | `acceptFlowlaryAi()`; removed save/remove Groq key |
| `extension/src/popup/status.ts` | Flowlary AI copy; offline = all AI unavailable, layout still ready |

### Extension — UI & IA
| File | Change |
|------|--------|
| `extension/src/popup/i18n/messages.ts` | Flowlary AI copy; Activity strings; removed all BYOK/Groq keys |
| `extension/src/ui/domainState.ts` | AI states: available / temporarily_unavailable / requires_consent |
| `extension/src/ui/SystemStatus.tsx` | Extension vs Flowlary AI status; no BYOK badges |
| `extension/src/ui/useFeatureMutations.ts` | Uses `acceptFlowlaryAi` |
| `extension/src/popup/views/HomeView.tsx` | Consent CTA only; no BYOK deep links |
| `extension/src/popup/openDashboard.ts` | New sections: progress, practice, activity; removed byok |
| `extension/src/dashboard/App.tsx` | Nav: Overview / Progress / Practice / Settings / Privacy / Account |
| `extension/src/dashboard/panels/OverviewPanel.tsx` | Flowlary AI consent CTA; removed BYOK setup |
| `extension/src/dashboard/panels/SettingsPanel.tsx` | New IA: Appearance, Writing, Learning (placeholder), Translation, Layout, Shortcuts, AI, Data |
| `extension/src/dashboard/panels/HistoryPanel.tsx` | User copy → Activity log |
| `extension/src/dashboard/panels/ProgressPanel.tsx` | **NEW** — placeholder shell |
| `extension/src/dashboard/panels/PracticePanel.tsx` | **NEW** — placeholder shell |
| `extension/manifest.json` | Removed `https://api.groq.com/*` |
| `extension/manifest.prod.json` | Removed `https://api.groq.com/*` |

### Website (minimum consistency)
| File | Change |
|------|--------|
| `website/src/i18n/en.ts` | Flowlary AI copy; removed BYOK pricing/support strings |
| `website/src/i18n/ar.ts` | Aligned AI/support types; removed BYOK sections |
| `website/src/components/pricing/PricingShowcase.tsx` | Removed BYOK card |
| `website/src/components/support/SupportCenter.tsx` | Removed BYOK topic/section |
| `website/src/pages/Privacy.tsx` | Flowlary AI narrative; Activity log; no BYOK |
| `website/src/pages/Terms.tsx` | Replaced BYOK section with Flowlary AI |
| `website/src/seo.ts` | Updated privacy meta description |

### Tests
| File | Change |
|------|--------|
| `tests/integration/phase22a-foundation.test.tsx` | **NEW** — 22A regression suite |
| `tests/unit/storage/retireByok.test.ts` | **NEW** — migration tests |
| `tests/unit/ui/domainState.test.ts` | No BYOK offline exception |
| `tests/unit/popup/status.test.ts` | Flowlary AI labels |
| `tests/unit/correction/readiness.test.ts` | Managed-only readiness |
| `tests/integration/phase-dashboard.test.tsx` | New nav + no BYOK settings |
| `tests/integration/phase9-popup.test.tsx` | No hasGroqKey assertions |
| `tests/integration/phase10-migration.test.ts` | Groq keys not retained in correction settings |
| `tests/integration/phase12-cache.test.ts` | Flowlary API cache path |
| `tests/integration/phase14-api-failures.test.ts` | Flowlary AI correction failures |
| `tests/integration/phase7-correction.test.ts` | Consent gate instead of BYOK key gate |
| `tests/integration/phase15-release-manifest.test.ts` | No groq.com permission |
| `tests/unit/security/validate.test.ts` | CORRECT_TEXT without groq key |
| `website/src/__tests__/routes.test.tsx` | Expect Flowlary AI, not BYOK |
| `website/src/__tests__/demos.test.tsx` | Extension active / Flowlary AI ready |

---

## 2. BYOK/Groq surfaces removed

**Extension UI**
- Groq API key form, reveal/hide, save/remove/replace
- Managed vs BYOK selector and mode-switch buttons
- `#byok` dashboard deep link and hash aliases
- BYOK consent/add-key CTAs in popup and overview
- `byok_ready`, `byok_missing`, `managedAi*` copy and badges
- Privacy BYOK card

**Messaging / API**
- `hasGroqKey`, `aiProvider` removed from `ExtensionStatus`
- `groqApiKey` stripped from `SET_CORRECTION` validation
- `callGroqByokOnce()` removed from correction handler

**Website**
- BYOK pricing card, support section, and topic nav item
- BYOK/Groq references in privacy, terms, SEO, and primary EN copy

**Kept internal (not user-facing)**
- `backend/src/providers/groqClient.ts` and gateway abstraction
- `StateManager` internal fields normalized to managed on read/write
- `STORAGE_KEYS.correctionGroqKey` for migration cleanup only

---

## 3. Migration behavior

`retireByokIfNeeded()` runs on background startup after storage hydration:

1. If `flowlary.correction.groqKey` exists in local storage → **remove** (never logged, never sent, never displayed)
2. If correction settings have `aiProvider: 'byok'` or in-memory groq key → force `aiProvider: 'managed'`, `groqApiKey: ''`
3. Idempotent — safe on every startup

Legacy EWA migration may still copy keys into intermediate storage; normalization and retirement clear them before use. Existing users are not stuck: correction always routes through Flowlary AI once consent is given.

---

## 4. Manifest changes

Removed from both `manifest.json` and `manifest.prod.json`:

```json
"https://api.groq.com/*"
```

**Retained:** `https://api.flowlary.com/*`, localhost dev hosts (dev manifest only), storage, activeTab, clipboardWrite, content scripts, commands.

---

## 5. Navigation changes

**Before:** Overview · Account · Settings · History · Privacy  

**After:** Overview · Progress · Practice · Settings · Privacy · Account

- **Progress** and **Practice** — placeholder shells (“Coming soon”)
- **History** removed from primary nav
- Legacy `#history` hash redirects to `#activity` internally

---

## 6. Activity restructuring

- User-facing **History** renamed to **Activity log**
- Copy clarifies: activity records what Flowlary did; **not** language-learning progress
- **Settings → Data → Activity log** embeds the existing history engine (`HistoryPanel`)
- Internal `#activity` route preserved for deep links
- Engine unchanged: `CORRECT`, `TRANSLATE`, `FIX_LAYOUT` remain activity records

---

## 7. Settings restructuring

| Section | Status |
|---------|--------|
| Appearance | Implemented (theme) |
| Writing | Implemented (mode, highlights) |
| Learning | Structural placeholder only |
| Translation | Implemented (source/target) |
| Keyboard Layout | Implemented (manual shortcut) |
| Shortcuts | Implemented (translate, layout, Speed Box) |
| AI | Flowlary AI status + consent only |
| Data | Activity log (existing history engine) |

No invented Export/Import or Reset controls (Phase 22E).

---

## 8. Privacy changes

- Removed BYOK/Groq-specific language from dashboard privacy page and website legal pages
- Structured sections: local data, Flowlary AI processing, protected fields, activity log, account/usage
- Honest claim: writing **does** leave the device when correction/translation run
- Does **not** claim “nothing ever leaves your device”

---

## 9. Tests

| Metric | Result |
|--------|--------|
| Total tests | **548 passed** (76 files) |
| New 22A regressions | manifest, BYOK UI absent, nav, Progress/Practice shells, Activity under Data, Flowlary AI offline + layout ready, legacy key retirement |
| Phase 21 tests | Preserved and updated where BYOK semantics changed |

---

## 10. Build results

| Target | Result |
|--------|--------|
| `npm test` (monorepo) | ✅ 548/548 |
| Extension production build | ✅ `extension/dist` v1.1.0 |
| Website production build | ✅ 14 prerendered routes |

---

## 11. Remaining Phase 22B work

Phase 22A stops here. Next phases per product plan:

| Phase | Scope |
|-------|--------|
| **22B** | LearningProfile + LearningEvents |
| **22C** | Progress analytics (populate Progress panel) |
| **22D** | Practice loop (populate Practice panel) |
| **22E** | Export/Import + final privacy narrative |
| **Future** | Onboarding, Arabic UI, cloud learning sync |

**Not done in 22A (by design):**
- Progress analytics UI
- Practice sessions
- LearningEvent / LearningProfile
- Learning settings implementation
- Export/Import data controls
- Full website redesign
- Billing architecture changes

---

## Copy reference

| Old | New |
|-----|-----|
| Managed AI | **Flowlary AI** |
| Flowlary is active | **Extension active** |
| History | **Activity log** |
| Groq / BYOK / API key | *(removed from user surfaces)* |

---

*Phase 22A complete. Foundation is ready for 22B learning domain work.*
