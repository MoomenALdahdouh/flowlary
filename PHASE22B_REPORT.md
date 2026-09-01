# Phase 22B — Learning Foundation + First-Run Onboarding

## Implementation Summary

### 1. LearningProfile

**Schema** (`packages/shared/src/learning.ts`):
- `version`, `learningLanguage`, `nativeLanguage?`, `level?`, `focusAreas[]`
- `onboardingCompleted`, `onboardingVersion`, `onboardingStep?`
- `setupPromptDismissed?`, `createdAt`, `updatedAt`
- Levels: `beginner` → `advanced` (CEFR-oriented)
- Focus areas: `spelling`, `grammar`, `wording` only
- V1 learning language: English (`en`)

**Storage** (`extension/src/storage/learning/index.ts`):
- Key: `flowlary.learning.profile`
- Install meta key: `flowlary.learning.install` (`fresh` | `existing`)
- `LearningProfileStore` API: get, patch, reset, ensure, complete onboarding, set step, dismiss prompt, restart
- Normalization handles missing/malformed profiles safely
- No secrets; local only

**Migration**:
- `ensureLearningProfile()` runs on background startup (before history init)
- Fresh installs (`onInstalled` reason `install`) → full onboarding
- Upgrades without profile → defaults + `onboardingCompleted: false`, lightweight setup prompt
- Existing correction/translation/layout settings preserved; defaults are not overwritten
- Install kind `fresh` takes precedence over auto-detected default namespaces from migration

**Reset behavior**:
- `RESET_LEARNING_PROFILE` resets learning profile only
- Does not clear Activity, translation, layout, account, or AI consent

### 2. Onboarding

**Screens** (`extension/src/dashboard/onboarding/OnboardingFlow.tsx`):
1. **Welcome** — product intro, privacy bullets, Flowlary AI consent checkbox, Get started
2. **Learning** — English learning language, optional level, focus areas, optional native language
3. **Tools** — translation pair, keyboard layouts, writing mode (box/direct), live translation (default off)
4. **Ready** — summary + Start writing

**Navigation**:
- Explicit step machine: `welcome → learning → tools → ready → complete`
- Back, Skip, Continue
- Step persisted via `SET_ONBOARDING_STEP`
- Refresh-safe recovery from stored step

**Skip behavior**:
- Learning skip → safe defaults (`en`, `grammar+spelling`, no level)
- Tools skip → preserves existing settings (no overwrite)
- Does not destroy pre-existing user settings

**Consent behavior**:
- Welcome screen owns consent decision (checkbox)
- Declining consent allows continuing; keyboard layout remains available locally
- Only Flowlary AI user-facing language

**Existing-user behavior**:
- Setup card on Overview: “Set up your learning profile” + Not now
- No forced full onboarding on upgrade
- Restart available from Settings → Learning

### 3. Settings

**Learning section** (`extension/src/dashboard/panels/LearningSettingsSection.tsx`):
- Reads/writes same `flowlary.learning.profile` as onboarding
- Fields: learning language, level, focus areas, native language, onboarding status
- Actions: Restart learning setup, Not now, Reset learning profile (confirmed)
- Settings order updated: Appearance → Writing → AI → Translation → Keyboard → Shortcuts → Learning → Data

### 4. Privacy

- Local storage list updated to include learning profile
- New Privacy card: Learning profile stays local; future learning events noted as planned local-only
- Existing AI processing / protected fields / account wording preserved

### 5. Progress

- **No metrics added**
- Empty state unchanged (“Your progress is building”)
- Optional personalization copy when profile complete: “You are learning English.”
- Activity remains excluded from Progress

### 6. Tests

**Added**:
- `tests/unit/storage/learning.test.ts` (7 tests)
- `tests/integration/phase22b-learning.test.tsx` (8 tests)

**Total**: 573 tests — **573 passed, 0 failed**

Coverage includes:
- Profile CRUD, reset, malformed data, install kinds
- Fresh vs existing user behavior
- Onboarding consent
- Progress empty state (no fake metrics)
- Reset does not clear Activity
- BYOK regression in onboarding/learning settings UI

### 7. Build

- Production build: **SUCCESS** (`npm run build`)

### 8. Files changed

**Shared**
- `packages/shared/src/learning.ts` (new)
- `packages/shared/src/types.ts`
- `packages/shared/src/index.ts`

**Extension — storage / background / messaging**
- `extension/src/storage/learning/index.ts` (new)
- `extension/src/storage/index.ts`
- `extension/src/background/index.ts`
- `extension/src/messaging/types.ts`
- `extension/src/messaging/validate.ts`
- `extension/src/popup/api.ts`

**Extension — dashboard / UI**
- `extension/src/dashboard/onboarding/OnboardingFlow.tsx` (new)
- `extension/src/dashboard/components/LearningCards.tsx` (new)
- `extension/src/dashboard/panels/LearningSettingsSection.tsx` (new)
- `extension/src/dashboard/App.tsx`
- `extension/src/dashboard/panels/OverviewPanel.tsx`
- `extension/src/dashboard/panels/ProgressPanel.tsx`
- `extension/src/dashboard/panels/SettingsPanel.tsx`
- `extension/src/dashboard/dashboard.css`
- `extension/src/popup/i18n/messages.ts`

**Tests**
- `tests/unit/storage/learning.test.ts` (new)
- `tests/integration/phase22b-learning.test.tsx` (new)

### 9. Remaining Phase 22C work

Phase 22C will introduce:
- **LearningEvent** persistence
- Real mistake persistence from `CorrectionResponse.changes[]`
- Word counting
- **Errors / 100 words** metric
- **Progress metrics** driven by learning events (not Activity)
- Practice functionality connection

**Phase 22B boundary respected**: no LearningEvents, no Progress metrics, no Practice functionality, no cloud learning sync.
