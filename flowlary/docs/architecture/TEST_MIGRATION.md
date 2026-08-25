# Test Migration Plan

Tests to port in Phase 2+ from source repositories. Source paths refer to audit clones.

## English Writing Assistant (EWA)

| Test file | Port phase | Coverage |
|-----------|------------|----------|
| `extension/src/adapters/index.test.ts` | 2–3 | textarea, input, contenteditable, password ignore |
| `extension/src/content/mergeCorrection.test.ts` | 7–8 | stale merge, suffix append |
| `extension/src/content/debounce.test.ts` | 7 | IntelligentDebouncer boundaries |
| `extension/src/content/instantSpell.test.ts` | 7 | local typo fixes |
| `extension/src/content/segment.test.ts` | 7 | writing context extraction |
| `extension/src/language/detect.test.ts` | 7 | English/non-English gate |
| `extension/src/ui/correction-card/CorrectionCard.test.ts` | 8 | overlay UX |
| `extension/src/ui/correction-card/hostStyleAdapter.test.ts` | 8 | theme mirroring |
| `extension/src/storage/settings.test.ts` | 10 | settings persistence |
| `extension/src/shared/cache.test.ts` | 12 | LRU cache |
| `extension/e2e/fixture.spec.ts` | 14 | extension load smoke |
| `extension/e2e/extension-load.spec.ts` | 14 | correction card e2e |

## Lingo (ai-writing-translator)

| Test file | Port phase | Coverage |
|-----------|------------|----------|
| `src/dom/replace.test.ts` | 2 | DOM read/write/caret |
| `src/content/translateCurrentText.test.ts` | 5 | shortcut translate path |
| `src/content/evaluateGate.test.ts` | 5 | entitlement gate |
| `src/translation/engine.test.ts` | 5–6 | translate eligibility |
| `src/translation/live.typing.test.ts` | 6 | 750ms live segments |
| `src/safety/fields.test.ts` | 2 | field probes |
| `src/safety/safety.test.ts` | 2 | token safety |
| `src/background/commands.test.ts` | 3 | shortcut dispatch |
| `src/entitlement/entitlement.test.ts` | 10 | license/usage |
| `src/identity.test.ts` | 10 | storage key naming |

## Layfix (autofix-layout)

| Test file | Port phase | Coverage |
|-----------|------------|----------|
| `src/layouts/mapLayout.test.ts` | 4 | local layout remap |
| `src/layouts/convert.test.ts` | 4 | manual converter |
| `src/layouts/mixedLanguage.test.ts` | 4 | mixed Arabic/English |
| `src/content/fixCurrentText.test.ts` | 4 | Ctrl+Shift+P shortcut |
| `src/content/speedBox.test.ts` | 4 | Ctrl+Shift+L speed box |
| `src/cache/cache.test.ts` | 4 | word classification cache |
| `src/adversarial/dom-races.test.ts` | 4 | stale async classifier |
| `src/adversarial/realtime.typing.test.ts` | 4 | boundary typing |
| `src/profile/profile.test.ts` | 10 | personal exceptions |
| `src/profile/trust.test.ts` | 4 | accept/ignore/revert learning |

## New Integration Tests (Flowlary-only)

| Test | Phase |
|------|-------|
| Single listener verification (no duplicate handlers) | 3 |
| Cross-feature mutex (layout + correct same field) | 4–7 |
| CommandRouter no auto-chaining | 3 |
| Storage migration round-trip | 10 |
| Unified popup toggles | 9 |
| Mixed field: `hsjo]lj I dont know...` | 14 |

## Phase 1 Tests (Already Implemented)

Located in `flowlary/tests/` and `flowlary/packages/shared/src/`:

- InputEngine field detection (textarea, input, contenteditable)
- FieldSession generation + stale rejection
- Safety password + OTP blocks
- CommandRouter dispatch isolation
- Cache operation-specific keys
- Storage namespace isolation
- GET_STATUS messaging
- Manifest single-entry verification
- DOM read/write/caret/stale
