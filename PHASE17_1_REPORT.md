# Phase 17.1 Report — Popup / Control Surface

**Date:** 2026-08-25  
**Repository:** `/Users/moomen/Projects/flowlary`

---

## 1. What the old popup contained

**Audit finding:** The popup was **not** a bare three-label shell. `App.tsx` already implemented:

- Home view with feature cards (Correction, Translation + Live, Layout)
- Quick actions, shortcuts, global pause toggle
- Settings panel (account, BYOK, languages, privacy)
- History panel (list, delete, clear)
- Header gear icon for settings navigation
- Footer link to settings

**Gap:** The product control surface was **incomplete as a dashboard**:

| Gap | Issue |
|-----|--------|
| Navigation | No bottom tab bar — settings via header gear only |
| Account / AI | Account buried in Settings; no home AI/plan/usage card |
| Master control | Global pause at bottom of Home, not prominent |
| Connection | No extension/API connection indicator |
| Entitlement | Locked/exhausted state not shown on features |
| Layout | No local vs AI classifier distinction |
| i18n | Strings hardcoded throughout components |
| Speed Box | Listed as toggle-like feature — now labeled shortcut-only |

**Dist was not stale** — build pipeline correct; popup entry `src/popup/index.html` in manifest.

---

## 2. What was changed

Upgraded popup into a **coherent Flowlary control surface**:

### Home dashboard
- **Master banner** — prominent enable/pause with status summary
- **Flowlary AI card** — managed/BYOK label, plan, usage, account summary, billing unavailable
- **Feature cards** — Writing Correction, Translation, Live Translation, Keyboard Layout
- **Shortcuts** — translate, fix layout, Speed Box (shortcut only)
- **Connection indicator** — checking / connected / unavailable / sign-in hint

### Navigation
- **Bottom tab bar** — Home | History | Settings

### Settings (preserved, reorganized)
- Account sign-in/out
- Writing AI (managed/BYOK)
- Translation languages
- Layout shortcut
- Privacy

### i18n boundary
- `extension/src/popup/i18n/messages.ts` — English string catalog
- `extension/src/popup/i18n/index.ts` — `t()` helper for future Arabic/RTL

### Status helpers
- Entitlement locked state
- Usage formatting
- Connection state
- Layout mode labels (auto · manual · shortcut)

---

## 3. Files changed

| File | Change |
|------|--------|
| `extension/src/popup/App.tsx` | Restructured shell, bottom nav, connection indicator |
| `extension/src/popup/views/HomeView.tsx` | **New** — home dashboard |
| `extension/src/popup/components.tsx` | BottomNav, MasterBanner, AiAccountCard, ConnectionIndicator |
| `extension/src/popup/status.ts` | Entitlement, connection, usage, layout helpers |
| `extension/src/popup/tokens.css` | New layout styles |
| `extension/src/popup/i18n/messages.ts` | **New** — i18n catalog |
| `extension/src/popup/i18n/index.ts` | **New** — `t()` function |
| `tests/integration/phase9-popup.test.tsx` | Updated + nav/live tests |
| `tests/unit/popup/status.test.ts` | Entitlement locked test |

---

## 4. Real controls (connected to state)

| Control | Message / API | State |
|---------|---------------|-------|
| Master enable/pause | `SET_SETTINGS` | `settings.enabled` |
| Writing Correction | `SET_CORRECTION` | `correction.enabled` |
| Translation | `SET_TRANSLATION` | `translation.shortcutEnabled` |
| Live Translation | `SET_TRANSLATION` | `translation.liveEnabled` |
| Keyboard Layout | `SET_LAYOUT` | `layout.autoEnabled` |
| Enable Flowlary AI | `SET_CORRECTION` | `consentAccepted` |
| BYOK key | `SET_CORRECTION` | `groqApiKey` (never shown in UI) |
| Account sign-in/out | `ACCOUNT_*` | server session |
| Refresh account | `ACCOUNT_SYNC` | server entitlement |
| Quick Translate/Layout | `RUN_COMMAND` | command router |
| History delete/clear | `DELETE/CLEAR_HISTORY` | local history store |
| Settings toggles | existing patches | real storage |

---

## 5. Features remain unavailable (honest UI)

- **Billing / checkout** — shows “Billing unavailable”
- **Pro self-activation** — no fake upgrade button
- **License activation** — `ACTIVATE_LICENSE` still not implemented
- **Live API health ping** — connection reflects extension messaging, not production DNS
- **Usage when unknown** — shows “Usage unavailable”

---

## 6. Test count

```
502 passed (67 files)
```

Added: live translation persistence test, popup nav test, entitlement locked status test.

---

## 7–8. Build results

| Command | Result |
|---------|--------|
| `npm run build` | **PASS** |
| `npm run build:release` | **PASS** |

---

## 9. Dist verification

Release bundle contains new UI strings:

- `AI Writing Assistant`
- `Live Translation`
- `Billing unavailable`
- `Local remap · AI classifier fallback`

Popup entry: `extension/dist/src/popup/index.html` (manifest `default_popup`).

---

## 10. Chrome verification

**NOT VERIFIED in this session** — Chrome manual E2E requires loading unpacked extension:

```
/Users/moomen/Projects/flowlary/extension/dist
```

**To verify locally:**
1. `npm run build:release`
2. Chrome → Extensions → Load unpacked → select `extension/dist`
3. Open popup — confirm bottom nav, AI card, feature toggles

If an old popup appears, ensure Chrome loads this dist path (not a cached older extension ID).

---

## Remaining blocker

- **Chrome manual E2E** — must be performed by user in browser

---

## Success criteria

| Criterion | Status |
|-----------|--------|
| Popup audited | ✅ |
| Control surface implemented | ✅ |
| Real state connections | ✅ |
| No fake functionality | ✅ |
| No secrets in UI | ✅ |
| i18n boundary | ✅ |
| Tests pass (502) | ✅ |
| Build / release build | ✅ |
| Dist contains new UI | ✅ |
| Chrome runtime verified | ❌ NOT VERIFIED |
