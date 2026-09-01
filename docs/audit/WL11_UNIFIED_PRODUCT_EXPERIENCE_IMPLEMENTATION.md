# WL-11 — Website ↔ Extension Unified Product Experience

**Status:** PARTIAL (implementation complete; automated tests pass for website/shared/WL-11 unit scope; full extension integration suite and manual acceptance not fully verified in this session)

## Product goal

Website and Chrome extension are **surfaces** on one Flowlary account — same entitlement, same canonical learning memory (`POST/GET/DELETE /api/learning/events`), same practice/report/coach pipelines. No duplicate account, billing, or learning engines were added.

## Architecture (unchanged authority)

| Concern | Authority |
|--------|-----------|
| Account ID | Server `AccountRecord.id` (JWT `sub`) |
| Entitlement / Trial / Credits | `resolveServerEntitlementForAccount()` |
| Learning memory | Backend learning events service + extension/website clients |
| Practice / Brief / Report / Coach | Existing extension engines fed by canonical events |

## Account identity bridge

- **Website → Extension:** `flowlary:account-session` custom event → content script `websiteBridge.ts` → `ACCOUNT_IMPORT_SESSION` in service worker.
- **ExtensionSessionSync** re-syncs on mount, window focus, `storage` events, and every 60s (not mount-only anymore).
- **After import:** entitlement sync + **best-effort** `ensureLearningEventsInitialized()` pull (errors swallowed; local-first preserved).
- **Logout asymmetry preserved:** website logout does not sign out extension (per spec §9).

## Learning synchronization

```
Website Writing Lab ──ingest──► Learning Events API ◄──pull/merge── Extension
Extension writing   ──ingest──► Learning Events API ◄──fetch────── Website Account
```

- Writing Lab sync statuses: `synced` | `already_recorded` | `pending` | `idle`
- Offline: queue in `localStorage` per account; retry via `flushLearningEventQueue`
- Deduplication: server ingest + existing client dedupe keys unchanged

## Practice deep link (P2 resolved — safe subset)

- Hash format: `#practice?target=category:normalizedOriginal` (e.g. `spelling:recieved`)
- `parsePracticeTargetPatternId()` in `@flowlary/shared`
- `resolvePracticeSessionTargetById()` selects eligible recurring target only
- `PracticePanel` auto-starts targeted session when deep link resolves
- `ExplanationPanel` passes `explanation.practiceTargetId` to `openDashboard()`
- **Website → Extension:** `flowlary:open-dashboard` → `OPEN_DASHBOARD` → new tab with hash
- **Limitation:** Website cannot open practice without extension installed; bridge probe uses neutral/fallback CTA

## Writing Lab UX

- Learning sync messages (en/ar/tr): added / already recorded / pending offline
- Recurring corrections (≥2): **Practice this** CTA when extension bridge responds
- Install bridge copy unchanged; no false sync claims

## Account Center

New **Learning progress** panel:

- Writing event count + recurring pattern count (canonical fetch)
- Extension bridge status (connected / not detected — probe-based, not install fingerprint)
- Links: Writing Lab, Get Flowlary

## Extension dashboard

- Overview: **Writing Lab on the web** bridge link
- Practice section accepts `initialTargetPatternId` from hash

## Website navigation

- Primary nav includes **Writing Lab** → `/#writing-lab`

## Entitlement / trial / credits

No `websitePlan` / `extensionPlan` duplication. Cached presentation only. Paddle webhook → server entitlement → both surfaces refresh via existing clients.

## Boundaries preserved

- Layout practice: local-first, no auth/backend/Groq requirement
- Translation/layout events excluded from English learning analytics (existing filters)

## Security & privacy

- Account-scoped API calls unchanged
- Bridge forwards existing session tokens only on user-origin page events
- No internal IDs exposed in Account Center UI
- Learning events remain evidence/aggregate based

## Localization

- en / ar / tr updated for sync states, practice CTA, account learning panel, nav
- Arabic RTL via existing site i18n direction

## Tests added

| Area | File |
|------|------|
| Practice target ID parse | `tests/unit/shared/practice-target-id.test.ts` |
| Deep-link target resolution | `tests/unit/storage/practice-target-selection.test.ts` |
| Dashboard URL hash | `tests/unit/popup/openDashboard.test.ts` |
| Website bridge | `website/src/account/extensionBridge.test.ts` |
| Already-recorded sync | `website/src/lab/webLearningSync.test.ts` |

## Automated test results (this session)

| Package | Passed | Failed |
|---------|--------|--------|
| `@flowlary/website` | 113 | 0 |
| `@flowlary/backend` | 91 | 0 |
| `@flowlary/shared` | 126 | 0 |
| WL-11 extension unit | 9 | 0 |

Full `@flowlary/extension` integration suite: environmental/network failures in sandbox (pre-existing pattern for tests hitting `127.0.0.1:8787` without backend).

## Manual acceptance

Not executed end-to-end in this session. Recommended flow: spec §33 (register → Writing Lab → extension sync → Brief → Practice deep link → Report → Coach → account switch → logout safety).

## Known limitations

1. Extension install detection is **bridge probe only** — cannot distinguish “not installed” vs “installed but bridge not injected on this page”
2. Website Practice CTA requires extension bridge; otherwise user must install/sign in on extension
3. Practice deep link requires eligible recurring target (≥2 occurrences, safe token length) — otherwise Practice home shows without auto-start
4. Full extension CI/integration matrix not green in offline sandbox

## Files touched (primary)

- `packages/shared/src/practice.ts`
- `extension/src/storage/learning/practice/targetSelection.ts`
- `extension/src/popup/openDashboard.ts`
- `extension/src/dashboard/App.tsx`, `PracticePanel.tsx`, `PracticeSection.tsx`
- `extension/src/features/correction/ui/ExplanationPanel.ts`
- `extension/src/content/websiteBridge.ts`
- `extension/src/background/index.ts`
- `extension/src/messaging/types.ts`, `validate.ts`
- `website/src/account/extensionBridge.ts`, `ExtensionSessionSync.tsx`
- `website/src/lab/webLearningSync.ts`, `WritingLab.tsx`
- `website/src/pages/Account.tsx`
- `website/src/components/Layout.tsx`
- i18n: `en.ts`, `ar.ts`, `tr.ts`
- `extension/src/popup/i18n/en.ts`, `I18nProvider.tsx` (duplicate export fix)

## Next phase

**WL-12** — Full Product UI/UX Finishing & Production Readiness Pass
