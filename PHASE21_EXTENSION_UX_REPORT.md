# Phase 21 — Extension Control Center + Popup UX Rebuild

Production UX / UI / frontend / state architecture rebuild for the Flowlary Chrome extension popup and dashboard.

---

## 1. Architecture changes

### Unified UI layer (`extension/src/ui/`)

| Module | Role |
|--------|------|
| `domainState.ts` | Single domain model derived from `ExtensionStatus` |
| `useFeatureMutations.ts` | Shared toggle/command handlers for popup + dashboard |
| `SystemStatus.tsx` | `SystemStatusBlock`, `StatusBadge`, `HeaderStatusPill`, `featureReason()` |
| `FeatureControl.tsx` | Shared feature row/card with explicit readiness + disabled toggles |
| `shared.tsx` | `ConfirmDialog`, `ShortcutKey`, `InfoCard`, `DataFlowDiagram`, etc. |

### Session hook

`useExtensionSession` now exposes:

- `domain` — computed via `computeDomainState(status, loading)`
- Debounced, silent background reload on `chrome.storage.onChanged` for `flowlary.*` keys
- Race-safe reload sequencing

Popup and dashboard both consume the same hook and mutation layer — no duplicated toggle logic in `App.tsx` files.

---

## 2. State model changes

### Separated concerns

| Layer | Values |
|-------|--------|
| Extension | `active` / `paused` / `loading` |
| Managed AI | `available`, `temporarily_unavailable`, `requires_consent`, `byok_ready`, `byok_missing` |
| Account | `signed_out` / `signed_in` |
| Subscription | `trial`, `free`, `pro`, `expired`, `unknown` |
| Features | `ready`, `disabled`, `unavailable`, `requires_setup`, `requires_consent`, `paused`, `locked` |

Each feature carries:

- `enabled` — user preference
- `canToggle` — whether the UI toggle should be interactive
- `reasonKey` — mapped to human copy via `featureReason()`

### Key rules implemented

- Extension paused → features show `paused`, toggles disabled
- Managed AI offline → correction/translation unavailable; layout stays ready (local)
- BYOK configured → correction ready even when managed API is offline
- Translation/live always require managed API path → unavailable when API offline
- Usage exhausted → `locked` with disabled toggles

---

## 3. Popup changes

- Header uses `HeaderStatusPill` instead of generic connection warning
- `SystemStatusBlock` separates **Extension active** from **Managed AI** status
- Master extension toggle in system block (not conflated with AI state)
- Four distinct feature rows: Correction, Translation, Live Translation, Layout
- Toggles disabled when `canToggle: false` (unavailable ≠ misleading ON)
- Quick actions show reason text when unavailable instead of silent failure
- Footer: plan · usage · Open dashboard
- No settings/history/privacy/billing in popup

---

## 4. Dashboard changes

- Sidebar: Overview, Account, Settings, History, Privacy
- `HeaderStatusPill` in sidebar footer (replaces generic connection pill)
- Overview uses same `SystemStatusBlock` + `FeatureControl` cards as popup
- Duplicate consent/BYOK CTAs removed from overview footer (handled per feature)
- Shared `useFeatureMutations` — no inline patch handlers in `App.tsx`

---

## 5. Settings changes

Reorganized hierarchy:

1. **Appearance** — theme toggle (existing light/dark behavior)
2. **Writing** — correction mode, highlights + brief descriptions
3. **AI** — managed vs BYOK choice with clear copy
4. **BYOK** — password input, reveal/hide, save/remove/replace
5. **Translation** — source/target language selects
6. **Keyboard layout** — manual shortcut toggle

---

## 6. History changes

- Compact activity list with operation tag, site, timestamp, diff
- Search input
- Filter chips: All, Corrections, Translations, Layout fixes
- **Clear all** opens confirmation dialog
- Local-only note: “Stored locally in this browser.”

---

## 7. Privacy changes

Structured trust surface:

- Data flow visualization (LOCAL / LEAVES DEVICE / BLOCKED)
- What stays local
- What may leave this device
- Protected fields
- What Flowlary never receives
- BYOK explanation
- Local history
- Analytics statement

No single large paragraph dump.

---

## 8. Account changes

Signed out:

- “You are using Flowlary locally.”
- Create account / Sign in

Signed in:

- Email, plan, usage, subscription status
- Billing opens `flowlary.com/account` (no Paddle, no raw API URLs)
- Sign out

---

## 9. BYOK security changes

- Password input type by default
- Reveal/hide toggle (`aria-pressed`)
- Keys never shown after save (masked status only)
- Replace/remove flows preserved
- No URL/logging/analytics exposure (existing architecture preserved — local-only storage)

---

## 10. Lemon Squeezy preparation

- No Paddle references in extension UI
- Billing CTA opens website account page
- Honest copy: “Billing is being prepared” when unavailable
- No fake checkout, portal, or renewal dates

---

## 11. Tests

| Suite | Result |
|-------|--------|
| Full monorepo | **540/540 passing** |
| New: `tests/unit/ui/domainState.test.ts` | Extension/AI separation, BYOK offline, consent, pause |
| Updated: `tests/unit/popup/status.test.ts` | New summary strings |
| Updated: integration popup + dashboard | Chrome mock fix, privacy/history expectations |

Coverage includes:

- Domain state matrix (offline + BYOK, consent, pause)
- Popup compact surface + dashboard navigation
- Privacy structured sections
- History local-only note

---

## 12. Build results

```
extension npm run build — ✓ success (v1.1.0)
Popup + dashboard bundles generated in extension/dist/
```

---

## 13. Responsive QA

CSS additions support:

- System status block stacking
- Privacy grid (`auto-fill, minmax(220px, 1fr)`)
- History filters wrapping
- Dialog overlay for confirmations

Dashboard sidebar remains persistent on desktop; existing dashboard shell handles layout. Mobile drawer behavior inherits from existing `fl-dash` structure — dedicated drawer toggle not added in this pass (no regression).

---

## 14. Accessibility QA

- `visually-hidden` for system status heading
- `role="switch"` + `aria-checked` on toggles
- `role="alertdialog"` on confirm dialog
- `role="tablist"` / `aria-selected` on history filters
- `role="status"` on header pill
- Focus visible via existing `:focus-visible` tokens
- Status communicated with badge text + tone, not color alone

---

## 15. Remaining backend limitations

| Area | State |
|------|--------|
| Lemon Squeezy | Not integrated; website + extension show honest prep state |
| Paddle | May exist in backend; excluded from all extension UI |
| Extension connection tracking | No server-side “extension connected” flag |
| Managed AI health | Probed via `/health`; offline state is best-effort |
| Theme | Light/dark toggle only (system follows OS when no stored preference) |
| Speed Box | Shortcut-only; no popup quick action button (by design) |

---

## Product language updates

| Before | After |
|--------|-------|
| Flowlary is active | Extension active |
| Flowlary AI is temporarily unavailable | Managed AI is temporarily unavailable |
| Generic red connection warning | Header pill: Ready / AI temporarily unavailable |

---

## Files touched (primary)

- `extension/src/ui/*` — new shared layer
- `extension/src/popup/useExtensionSession.ts`
- `extension/src/popup/views/HomeView.tsx`
- `extension/src/popup/App.tsx`
- `extension/src/dashboard/App.tsx`
- `extension/src/dashboard/panels/OverviewPanel.tsx`
- `extension/src/dashboard/panels/HistoryPanel.tsx`
- `extension/src/dashboard/panels/SettingsPanel.tsx`
- `extension/src/popup/i18n/messages.ts`
- `extension/src/popup/tokens.css`
- `tests/unit/ui/domainState.test.ts`
- Integration test chrome mocks

---

*Verified: full test suite green, extension production build successful.*
