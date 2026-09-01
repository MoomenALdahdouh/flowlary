```text
AUDIT MODE: READ ONLY
IMPLEMENTATION: NONE
SOURCE OF TRUTH: ACTUAL CURRENT CODE
```

# FLOWLARY — COMPLETE SYSTEM ARCHITECTURE & DATA FLOW FORENSIC AUDIT

**Date:** 2026-08-26  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Package brand:** `@flowlary/shared` / Flowlary  
**Method:** Code-first forensic trace. Documentation treated as secondary evidence and marked when it diverges from implementation.

**Status legend used throughout:**

| Tag | Meaning |
| --- | --- |
| `IMPLEMENTED` | Present and wired in runtime paths |
| `PARTIAL` | Present but incomplete / gated / limited |
| `LEGACY` | Migration / tombstone / retired path still in tree |
| `UNUSED` | Code exists but not on live path |
| `PLANNED` | Documented or stubbed (`PIPELINE`) |
| `NOT IMPLEMENTED` | Absent from code |
| `NOT VERIFIED` | Not exercised end-to-end in this audit |
| `INFERENCE` | Reasonable conclusion from code structure, not a direct runtime proof |
| `DOCUMENTED ONLY` | Claimed in docs; not matching current code |

---

## 1. Executive Summary

Flowlary is a **Chrome MV3 extension + Node AI gateway + marketing/account website + shared package**, evolved from three prior extensions (EWA / Lingo / Layfix).

The live product core is:

1. **One content script** owns all document listeners via `InputEngine`.
2. **Three feature modules** (`layout`, `correction`, `translation`) subscribe to a shared `EventBus` and/or receive explicit commands via `CommandRouter`.
3. **One background service worker** brokers AI calls, account auth, status, history, and learning APIs to the page UI (popup/dashboard).
4. **One backend AI gateway** fronts **Groq only** for correction, translation, and remote layout classification.
5. **Learning / history are local** (`chrome.storage.local`), account-namespaced after Phase 32A — **not** server-synced learning records.
6. **Keyboard layout correction is primarily local** (maps + lexicons + heuristics). Groq is a **fallback classifier** for ambiguous tokens and is entitlement-gated (`layout_ai`). Auto layout remap itself is **`layout_auto` = local-only / free**.

### End-to-end answer (the audit’s primary question)

> From keystroke → detect → correct/translate → display → record → learn:

```text
USER KEYSTROKE / PASTE / COMPOSITION
  → DOM event (capture phase)
  → InputEngine (sole document listener owner)
  → FieldSession (generation bump / composing / write mutex)
  → EventBus NormalizedInputEvent
      ├─ LayoutScheduler   (Space/Enter/Tab/blur → local fix → optional CHECK_WORD → Groq)
      ├─ CorrectionScheduler (input debounce → instant local typos → CORRECT_TEXT → Groq)
      └─ TranslationScheduler (optional live 750ms pause → TRANSLATE_TEXT → Groq)
  → (explicit shortcuts / RUN_COMMAND only)
      → CommandOrchestrator → safety → FieldSession.tryAcquireWrite → CommandRouter
  → Feature apply write (WriteOrigin CORRECT|TRANSLATE|FIX_LAYOUT)
  → CorrectionCard UI (box mode) / direct merge / layout auto-replace / live overwrite
  → recordHistory (activity) + recordCorrection{Detected|Accepted|Rejected} (learning)
  → chrome.storage.local under flowlary.account.<accountId>.*
  → Dashboard Progress/Practice panels aggregate locally (no learning server DB)
```

**Critical product facts verified in code:**

- Keyboard layout auto-fix does **not** require Groq when local heuristics/cache hit.
- Spelling/grammar “detection” for AI correction is **not** a local grammar engine — Groq returns typed changes (`spelling|grammar|wording`). Local instant spelling is a **small typo map only**.
- Translation is **Groq-only**. Google Translate is implemented via backend `TranslationProviderRouter` (see `PHASE_TRANSLATION_PROVIDER_IMPLEMENTATION.md`).
- Free vs Pro: local layout included; AI features need sign-in + credits/capabilities.
  - Evidence: `packages/shared/src/credits.ts` — `FREE_DAILY_CREDITS = 40`, `PRO_DAILY_CREDITS = 200`; weights correction/layout-classification/practice `1`, translation/live-translation `2`.
  - Evidence: `packages/shared/src/entitlement/index.ts` — `layout_auto` is `isLocalOnlyFeature` (always allowed); `layout_ai` / correction / translation require AI tier + credits.
- Account isolation for learning/history/feature settings: **largely IMPLEMENTED** (Phase 32A). Residual: **global** `settings` (enable/pause/excluded domains) and entitlement cache key are not account-scoped.
  - Evidence: `extension/src/storage/facade.ts` `getSettings`/`setSettings` use unscoped `storage.keys.settings`; correction/translation/layout/learning/history use `getAccountScopedStorage`.

---

## 2. Repository Architecture

### Meaningful tree (generated / node_modules omitted)

```text
flowlary/
├── extension/                 # Chrome MV3 extension (content + SW + popup + dashboard)
│   ├── manifest.json
│   ├── src/
│   │   ├── content_script.ts  # boots InputEngine + features + orchestrator
│   │   ├── background/        # service worker: AI proxy, account, status
│   │   ├── core/              # input, session, router, dom, events, safety, state
│   │   ├── features/          # layout | correction | translation | learning
│   │   ├── storage/           # chrome.storage facade, account scope, cache, history, learning
│   │   ├── messaging/         # typed runtime messages + validation
│   │   ├── entitlement/       # client entitlement decisions
│   │   ├── popup/             # React popup
│   │   ├── dashboard/         # React learning / settings dashboard
│   │   ├── ui/                # shared usage / feature controls
│   │   └── config/            # endpoints, account auth, API health
│   └── icons/
├── backend/                   # Node HTTP AI gateway + auth + Paddle billing + JSON store
│   └── src/
│       ├── routes/http.ts
│       ├── gateway/           # AiGateway orchestration
│       ├── providers/         # groqClient + correction/translation/layout providers
│       ├── services/          # account, usage/credits, crypto
│       ├── billing/           # Paddle
│       ├── db/store.ts        # JSON file persistence (not SQL)
│       └── middleware/        # auth, cors, rateLimit, entitlement
├── website/                   # Marketing + account/billing UI (talks to backend auth/billing only)
├── packages/shared/           # @flowlary/shared contracts, prompts, credits, learning types
├── tests/                     # unit / integration / characterization
├── scripts/                   # verify-live-api, website serve, icons
└── docs/                      # architecture, production, monetization, audit
```

### Directory responsibilities

| Area | Responsibility |
| --- | --- |
| `extension/src/core` | Shared runtime substrate: input ownership, field sessions, command routing, DOM R/W, safety |
| `extension/src/features/*` | Product features; must not attach competing global DOM listeners |
| `extension/src/background` | SW message hub; only place that calls Flowlary AI HTTP APIs from extension |
| `extension/src/storage` | Persistence, migrations, account isolation, caches, learning/history |
| `extension/src/popup` + `dashboard` | Control / learning UX; message the SW; no direct Groq keys |
| `backend` | Auth, entitlements/credits, Groq providers, Paddle webhooks |
| `website` | Public site + account login/register/checkout/portal |
| `packages/shared` | Cross-surface types, prompts, credit weights, capability matrix |
| `tests` | Characterization of the above |

### Environment / config (high level)

- Extension: API base via `extension/src/config/endpoints.ts`; account session in chrome.storage.
- Backend: `backend/src/config/env.ts` — Groq key, JWT secret, Paddle keys, CORS, timeouts, store path.
- Website: public API URL for auth/billing only.

### Feature flags

No dedicated remote feature-flag service found. Runtime gates are:

- `stateManager` feature toggles (correction/translation/layout enablement, consent, modes)
- Entitlement capabilities + daily credits
- Safety / excluded domains / global pause

---

## 3. Actual Architecture vs Documented Architecture

Primary doc: `docs/architecture/FLOWLARY_ARCHITECTURE.md`.

| Claim (docs) | Code reality | Status |
| --- | --- | --- |
| One content engine, three features | `content_script.ts` registers correction/translation/layout | `IMPLEMENTED` |
| InputEngine owns document listeners | `InputEngine.start()` capture listeners | `IMPLEMENTED` |
| CommandOrchestrator does not auto-dispatch on ordinary input | Explicit comment + only shortcut/RUN_COMMAND path | `IMPLEMENTED` |
| Layout auto via LayoutScheduler | `features/layout/scheduler.ts` | `IMPLEMENTED` |
| Translation live default OFF, 750ms | `LIVE_PAUSE_MS = 750` in translation scheduler | `IMPLEMENTED` |
| Correction via IntelligentDebouncer + Groq | scheduler + backend correction provider | `IMPLEMENTED` |
| BYOK Groq opt-in still primary | BYOK retired (`retireByok` / scrub groq key); managed gateway is the path | **Docs stale** → `LEGACY` / `DOCUMENTED ONLY` |
| PIPELINE operation | Router returns `pipeline_not_implemented` | `PLANNED` stub |
| History local-only | History service in extension storage; not in backend store learning tables | `IMPLEMENTED` |
| Account isolation | Phase 32A account-scoped keys + attach/detach | `IMPLEMENTED` (with residual globals) |
| Google Translate | No provider / no deps | `NOT IMPLEMENTED` |
| SQL migrations / relational DB | `backend/src/db/store.ts` JSON file store | Docs sometimes imply richer DB → **actual = JSON store** |

### Doc vs code drift summary

- **Documented but outdated:** BYOK Groq as first-class correction path.
- **Implemented but under-documented in older phase docs:** credit weights, account-scoped learning, dashboard practice, Paddle billing, capability sets.
- **Stub/planned:** `PIPELINE`.
- **Dead/legacy:** unscoped storage keys tombstoned by isolation migration; BYOK key scrubbing; legacy license activation surfaces still partially present in messaging.

---

## 4. Runtime Architecture

### Diagram 1 — Global Architecture

```text
┌──────────────┐     HTTPS auth/billing      ┌─────────────────────────────┐
│   Website    │ ───────────────────────────▶│  Backend (AI Gateway)        │
│  (marketing, │                             │  /api/auth/*                 │
│   account,   │                             │  /api/account[/entitlement]  │
│   pricing)   │                             │  /api/billing/* (Paddle)     │
└──────────────┘                             │  /api/ai/correction          │
                                             │  /api/ai/translation         │
┌──────────────┐  chrome.runtime messages    │  /api/ai/layout-classification│
│ Popup /      │ ◀──────────────────────────▶│                             │
│ Dashboard    │                             │  providers/* ──▶ Groq API   │
└──────┬───────┘                             │  db/store.ts (JSON)         │
       │                                     └─────────────────────────────┘
       ▼
┌──────────────┐  chrome.runtime             ┌─────────────────────────────┐
│ Background   │ ◀──────────────────────────▶│ Content Script (page world  │
│ Service      │  CHECK_WORD / CORRECT_TEXT /│ isolated from page JS)      │
│ Worker       │  TRANSLATE_TEXT / RUN_CMD   │  InputEngine                │
└──────┬───────┘                             │  FieldSession               │
       │ HTTPS AI + auth                     │  Features + DOM writes      │
       └────────────────────────────────────▶│  EventBus                   │
                                             └─────────────┬───────────────┘
                                                           ▼
                                                    Browser Page DOM
```

**Runtime boundary note:** Content scripts run in an isolated world. They cannot call page JS directly; they read/write DOM and talk to the extension via `chrome.runtime`. The SW is the only extension context that performs authenticated backend AI fetches in production paths traced here.

---

## 5. Input Engine

**File:** `extension/src/core/input/InputEngine.ts`  
**Class:** `InputEngine`

### Owned listeners (capture: true)

| DOM event | Handler | Emits |
| --- | --- | --- |
| `focusin` | `onFocusIn` | `focus-in` |
| `focusout` | `onFocusOut` | `focus-out` |
| `input` | `onInput` | `input` (+ generation bump unless composing / ignored inputType) |
| `keydown` | `onKeyDown` | `shortcut` (if matched) or `keydown` |
| `keyup` | `onKeyUp` | `keyup` |
| `compositionstart` | `onCompositionStart` | `composition-start` |
| `compositionend` | `onCompositionEnd` | `composition-end` (+ generation bump) |

**Not owned as first-class listeners:** dedicated `paste` listener. Paste arrives as `input` with `inputType` such as `insertFromPaste` (layout scheduler explicitly ignores paste/drop).

### What starts processing?

| Trigger | Starts |
| --- | --- |
| Ordinary `input` | FieldSession note + EventBus → feature schedulers |
| Word boundary keys Space/Enter/Tab | LayoutScheduler evaluate |
| Debounced input / composition-end | CorrectionScheduler |
| Live translation enabled + input/Enter/composition-end | TranslationScheduler (750ms) |
| Shortcut / `RUN_COMMAND` | CommandOrchestrator → CommandRouter only |
| Idle timer | **No global idle timer** for correction/layout (`NOT IMPLEMENTED` as product trigger) |

### Generation / stale protection

- User `input` (non-composing) → `bumpUserGeneration` (`core/dom/generation.ts`) → aborts in-flight field request via `FieldSession.bumpGeneration()`.
- System writes flagged via write-origin helpers so feature writes do not recursively look like user input.

---

## 6. FieldSession

**File:** `extension/src/core/session/FieldSession.ts`  
**Class:** `FieldSession` + `FieldSessionRegistry`

| Concern | Mechanism |
| --- | --- |
| Identity | WeakMap element → `field-<n>-<tag>` |
| Stale | monotonic `generation` |
| Request ordering | `requestSequence` / `requestId` |
| Mutex | `tryAcquireWrite(operation)` / `releaseWrite` / `abortActiveRequest` |
| IME | `composing` blocks acquire + aborts active |
| Commit gate | `canCommit(generation, requestId)` |
| Diagnostics | `lastWriter`, `lastCommittedSnapshot`, `lastInputAt` |

**Does NOT store field text or caret.** Text/cursor are always read live from the DOM (`readFieldText` / `readCaret`). `noteInput()` only updates `lastInputAt`.

**Lifetime:** per focused editable element; WeakMap allows GC with detached nodes; registry also keeps id→element for command retargeting.

---

## 7. CommandRouter

**Files:**

- `extension/src/core/router/CommandRouter.ts` — operation → feature handler map
- `extension/src/core/router/CommandOrchestrator.ts` — shortcut / RUN_COMMAND pipeline
- `extension/src/core/router/dispatch.ts` — result mapping

### Diagram 2 — Input / Command Flow

```text
Keyboard / Chrome command / popup RUN_COMMAND
        │
        ▼
InputEngine (shortcut event)  ──or──  chrome.runtime message
        │
        ▼
CommandOrchestrator
  · dedupe 250ms
  · resolve editable target
  · evaluateFieldSafety
  · FieldSession.tryAcquireWrite(op)
        │
        ▼
CommandRouter.dispatch(Command)
  · CORRECT     → CorrectionFeature.execute
  · TRANSLATE   → TranslationFeature.execute
  · FIX_LAYOUT  → LayoutFeature.execute
  · PIPELINE    → error: pipeline_not_implemented
        │
        ▼
Feature write + release mutex / stale checks
```

**Important:** Auto layout/correction/live-translation **do not** go through CommandOrchestrator. They subscribe to EventBus directly. Orchestrator is for **explicit** user commands.

---

## 8. Keyboard Layout System

### Files (primary)

| Path | Role |
| --- | --- |
| `features/layout/LayoutFeature.ts` | Feature module + Speed Box + shortcut execute |
| `features/layout/scheduler.ts` | Auto evaluate on boundaries |
| `features/layout/classifier/LayoutClassifier.ts` | Local → cache → remote |
| `features/layout/layouts/heuristics.ts` | Source inference, local hint, commit confidence |
| `features/layout/layouts/registry.ts` | Physical key maps + `mapLayout` |
| `features/layout/layouts/lexicons/*` | EN/AR word lists |
| `features/layout/fixCurrentText.ts` | Apply fixes + history |
| `features/layout/speedBox.ts` | Manual conversion overlay |
| `background/classify.ts` | CHECK_WORD → optional `/api/ai/layout-classification` |
| `backend/.../layoutClassifierProvider.ts` | Groq classifier |

### Architecture classification

```text
LOCAL FIRST
  → (cache)
  → optional REMOTE Groq classifier when local hint is null
```

**Verdict:** `LOCAL → (optional) BACKEND/GROQ` — **not** Groq-required for the primary happy path.

### Algorithm (reverse-engineered)

1. **Tokenize** field text; evaluate completed tokens (whitespace / Enter / Tab / blur finalize).
2. **`inferSourceLayout(word, profile)`** using script/charset (`heuristics.ts`).
3. **`localClassificationHint`:**
   - Known English on QWERTY → `VALID`
   - QWERTY token maps to known Arabic word via `mapLayout` + `confidentArabicMismatch` → `LAYOUT_MISMATCH` target `ar-101`
   - Arabic source not in AR lexicon but reverse maps to English → mismatch to `en-US-qwerty`
   - High-confidence RU set (`ghbdtn`) for Russian
4. **Commit gate** `canCommitMismatch` / `confidentArabicMismatch`:
   - Reject if English word or mapped not Arabic
   - Tokens ≤2 letters need Arabic context
   - Min length 3 for lexicon mismatch without context
5. If local hint null → cache → remote `CHECK_WORD` (entitlement `layout_ai`).
6. **Auto-apply** via `applyLayoutFix` (no confirmation card on auto path). Speed Box is manual.

### Concrete examples (executed against current maps/lexicons)

| Typed | Intent | Result in code |
| --- | --- | --- |
| `lvpfh` | مرحبا | Verified via `mapLayout('lvpfh','en-US-qwerty','ar-101')` → `مرحبا`; local `LAYOUT_MISMATCH` + `confidentArabicMismatch=true` → **auto-replace** (`heuristics.ts`) |
| `hello` | hello | `VALID` (English lexicon) — **no remap** even though map to Arabic exists |
| `اثممخ` | hello | Reverse mismatch → `hello` |
| `مرحبا` | مرحبا | `VALID` Arabic |
| `ghbdtn` | привет (RU) | Local hint null for AR path; RU high-confidence set may apply if RU enabled |

### Free vs Pro gating

| Path | Gate |
| --- | --- |
| Auto local remap (`layout_auto`) | **`isLocalOnlyFeature` → always allowed** (`packages/shared/src/entitlement/index.ts`) |
| Remote classifier (`layout_ai`) | Sign-in + capability + credits (`background/classify.ts`) |

**Product intent “layout free for everyone”:** **MATCHES** for local auto-fix. AI fallback is gated (expected for cost control).

### Learning / history for layout

- **History:** `recordHistory({ operation: 'FIX_LAYOUT', ... })` on successful apply (`fixCurrentText.ts`) — `IMPLEMENTED`
- **Learning events:** layout mismatches are **not** written into learning event store categories (`spelling|grammar|wording` only) — layout learning = **`NOT IMPLEMENTED`** as learning taxonomy

---

## 9. Keyboard Layout Detection Algorithm (detail)

### Maps

Physical QWERTY key → layout glyph tables in:

- `layouts/en-US-qwerty.ts`
- `layouts/ar-101.ts`
- `layouts/ru-standard.ts`
- plus `world.ts` layouts for conversion tooling

`mapLayout(token, source, target)` walks key ids to remap strings (`registry.ts`).

### Scoring / confidence

Not a floating probabilistic model locally. Confidence is **boolean gates**:

- lexicon membership
- length thresholds
- contextSuggestsTarget (Arabic chars / remappable neighbors)
- special-case sets (RU)

Remote Groq returns `VALID` | `LAYOUT_MISMATCH` JSON (`LAYOUT_CLASSIFIER_SYSTEM_PROMPT`).

### False-positive prevention

- Never remap known English words to Arabic
- Short tokens need context
- Personal exceptions list
- Markdown code / unsafe tokens skipped
- Oversized fields only evaluate last completed token
- Speed Box open suppresses auto scheduler

---

## 10–12. Spelling / Grammar / Correction

### Spelling detection

| Mechanism | Status |
| --- | --- |
| Local `COMMON_TYPOS` map (`instantSpell.ts` / `instantSpell`) | `IMPLEMENTED` (tiny dictionary) |
| Full dictionary spellcheck | `NOT IMPLEMENTED` |
| Browser spellcheck API | `NOT IMPLEMENTED` |
| AI (Groq) change list | `IMPLEMENTED` — primary grammar/spelling engine |

### Pipeline

```text
Typed English text
  → CorrectionScheduler (EventBus USER input / composition-end)
  → safety + English eligibility
  → Eligibility gate: CORRECTION_DEFAULTS.MIN_CHARS=8 AND/OR MIN_WORDS=3
    (packages/shared/src/correction/index.ts; language.ts)
  → (direct mode only) applyInstantSpelling on word/sentence boundary
     NOTE: instant typo map does NOT write learning events
  → IntelligentDebouncer (box ~120/45/30ms; direct ~90/25/20ms)
  → CORRECT_TEXT → SW → POST /api/ai/correction → Groq
  → changes[] { type, original, corrected, start, end }
  → box: CorrectionCard | direct: merge into field
  → learning (see mode rules below) + history CORRECT
```

### Taxonomy (exact, from code)

`ChangeType` / learning categories (**only these**):

1. `spelling`
2. `grammar`
3. `wording`

Coercion map also folds model aliases: `punctuation→grammar`, `typo→spelling`, `style|word→wording` (`packages/shared/src/correction/index.ts`).

**No separate code categories for:** keyboard-layout error, translation issue, capitalization-only, punctuation-only (except folded into grammar), style-as-first-class type.

### Correction generation

- **Model:** `AI_MODELS.CORRECTION = 'llama-3.1-8b-instant'` (`packages/shared/src/ai/models.ts`)
- **Prompt:** `CORRECTION_SYSTEM_PROMPT` (shared)
- **Payload:** JSON `{ text, previousText?, fieldType? }` — writing segment; truncated to `MAX_CORRECTION_CHARS=2000`; previousText truncated (~200 chars on backend provider)
- **Confidence:** no numeric confidence field; stale checks use generations + text relevance
- **Accept/reject:** box mode card apply/dismiss; direct mode auto-commit
- **Undo:** **`NOT IMPLEMENTED`** as a product feature (no correction undo stack; browser native undo only — not guaranteed for all field types)

### Learning recording rules (verified call sites in `applyCorrection.ts`)

| Mode / path | `detected` | `accepted` | `rejected` |
| --- | --- | --- | --- |
| Box — card shown with changes | YES (`recordCorrectionDetected` when card `setReady`) | YES on Apply | YES on Dismiss |
| Direct — silent AI merge | **NO** | YES on auto-commit only | NO |
| Instant local typo map | **NO** | **NO** | **NO** |
| Stale/ignored card (user keeps typing) | — | — | metrics only; **no** learning action |

### Example lifecycle: `I has a car.` → `have`

```text
input events → CorrectionScheduler
  → debounce → runCorrectionRequest / applyCorrection path
  → background/correct.ts entitlement(correction)
  → AiGateway.correction → runCorrectionProvider → callGroqChat
  → response.changes includes { type:'grammar', original:'has', corrected:'have', ... }
  → box: CorrectionCard.setReady(binding) + recordCorrectionDetected
  → user Apply → acceptCorrectionSuggestion → DOM merge + recordCorrectionAccepted + history
  → dashboard progress reads local learning events
```

Backend does **not** store the learning event. Only usage/credits metadata.

---

## 13. Correction Card / Visual System

**File:** `extension/src/features/correction/ui/CorrectionCard.ts` (Shadow DOM)

**Binding type** (`ui/types.ts`):

```ts
{
  remoteRequestId: string
  debouncerGeneration: number
  fieldGeneration: number
  segment: string
  requestedFullText: string
  response: CorrectionResponse
}
```

**Highlight colors (CSS classes):**

| Class | Approx color | Meaning |
| --- | --- | --- |
| `.spelling` | rose tint | spelling change |
| `.grammar` | amber tint | grammar change |
| `.wording` | indigo tint | wording change |

Multiple changes can appear in one card via token diff (`diff/tokenDiff.ts`). One card per field. Accept/dismiss recorded as learning actions when changes validate.

---

## 14–18. Learning / History / Dashboard / Storage

### What is recorded on correction events

**LearningEvent fields (actual):**

`id, version, timestamp, batchId, source ('writing'|'practice'), category ('spelling'|'grammar'|'wording'), original, corrected, normalizedOriginal, normalizedCorrected, action ('detected'|'accepted'|'rejected'), sampleWordCount, sampleHash`

**Not stored:** domain/website, language, AI confidence, cursor offsets, full before/after document, layout errors, translation events as learning categories.

### Accept vs reject

| Action | Recorded? |
| --- | --- |
| detected (card shown / changes found) | YES in **box** mode only (`detected`) — **not** emitted in direct auto-commit |
| accepted | YES (box Apply **or** direct silent AI commit) |
| rejected/dismissed | YES (`rejected`) on box dismiss |
| ignored (user keeps typing, card goes stale) | metrics only — **no learning action** |
| instant local typo fix | **not recorded** as learning |
| undone | **NOT IMPLEMENTED** |
| correction clicked (without accept) | **NOT IMPLEMENTED** as distinct event |

### History (activity log)

Separate from learning: `HistoryOperation = CORRECT | TRANSLATE | FIX_LAYOUT` with source/result text, mode, optional metadata. Bounded (~50), local, account-scoped.

### Dashboard

`extension/src/dashboard/panels/ProgressPanel.tsx` + practice panels:

```text
USER ACTION → LearningEvent (local) → chrome.storage account namespace
  → getLearningEvents / progress aggregation (client-side)
  → ProgressPanel / PracticePanel
```

No backend learning aggregation API.

### Storage locations

| Data | Store |
| --- | --- |
| Learning events/profile/practice | `chrome.storage.local` `flowlary.account.<id>.learning.*` |
| History | account-scoped `history` |
| Correction/translation/layout settings | account-scoped |
| Global enable/pause/excludedDomains | **unscoped `settings`** |
| AI response cache | `flowlary.cache` (cleared on logout) |
| Account session tokens | auth keys (session) |
| Server | accounts, sessions, usage, subscriptions, webhookEvents in JSON file — **no learning tables** |

### Retention

- Learning: max 2000 events, trim newest retained
- History: max ~50 entries
- Credits: daily UTC reset; Pro monthly soft cap

### Export/import/reset

Dashboard data-control paths exist (`storage/data/*`, messaging export/import/reset). Account-owned clear supported via scoped storage helpers.

---

## 19. Account Isolation

### Intended model

```text
User A → flowlary.account.A.* + server account A
User B → flowlary.account.B.* + server account B
```

### Current code path

- `attachActiveAccount` / `detachActiveAccount` (`storage/accountSessionLifecycle.ts`)
- `activeAccountContext` generation guards writes
- `ACCOUNT_OWNED` datasets namespaced
- Legacy unscoped claim-once migration (`accountIsolationMigration.ts`)
- On logout: clear in-memory feature state + AI cache; **do not delete** account namespaces (so A→logout→A restores)

### Independent verification vs PHASE31

PHASE31 reported B inherits A learning after logout. **Phase 32A implementation is present in current code** and tests (`tests/integration/phase32a-account-isolation.test.ts` referenced by docs).

**Residual violations / gaps:**

1. **`settings` (enabled/pause/excludedDomains) are global** — B sees A’s domain exclusions / pause after switch if not overwritten.  
2. **Entitlement local cache key global** — mitigated because server entitlement re-syncs on login.  
3. **First account after upgrade may claim legacy unscoped data** — by design, one-time.  
4. **Access JWT may remain valid until expiry after logout** — documented residual in Phase 32A.

### Diagram 7 — Account Isolation

```text
User A login  → activate(A) → hydrate account A namespaces
User A logout → clear context + memory defaults + cache clear
                 (A data remains under flowlary.account.A.*)
User B login  → activate(B) → hydrate account B namespaces
                 B does NOT read A learning/history/feature settings

VIOLATION / GAP:
  flowlary.settings (global) shared across A/B
```

---

## 20–22. Groq System / Provider Sharing / Cost

### Every Groq feature path

| Feature | Caller | SW message / route | Provider | Model |
| --- | --- | --- | --- | --- |
| Correction | CorrectionFeature/scheduler | CORRECT_TEXT → `/api/ai/correction` | `correctionProvider` | `llama-3.1-8b-instant` |
| Translation (manual+live) | TranslationFeature/scheduler | TRANSLATE_TEXT → `/api/ai/translation` | `translationProvider` | `openai/gpt-oss-120b` |
| Layout AI fallback | LayoutClassifier remote | CHECK_WORD → `/api/ai/layout-classification` | `layoutClassifierProvider` | `allam-2-7b` |
| Practice | uses correction path (`practice` mode) | same correction route | same | same (credit weight `practice`) |

Models source of truth: `packages/shared/src/ai/models.ts` (`AI_MODELS`).

**Shared infrastructure:** single `callGroqChat` + `AiGateway` — **one gateway, feature-specific providers**, not separate ad-hoc clients in the extension.

**Provider abstraction today:** backend providers per operation; **no** Google provider; **no** multi-provider router interface beyond operation switch.

### Duplicate cost risks

| Risk | Evidence | Severity |
| --- | --- | --- |
| Live translation 750ms after each pause while typing | TranslationScheduler | **P0 cost** if enabled |
| Correction debounce still fires often while editing | IntelligentDebouncer | P1 |
| Layout remote for every unknown token | classifier after local miss | P1 (mitigated by cache/coalesce) |
| Correction + translation both enabled on same field | independent schedulers | P1 |
| No PIPELINE combining | separate calls | OK |

**Mitigations present:** AbortSignal, generation stale checks, request coalescing (layout), L1/L2 caches, credit reservation, rate limits.

---

## 23. Translation Architecture

| Topic | Actual |
| --- | --- |
| Provider | Groq via backend only |
| Timing | Manual shortcut/command; optional live 750ms pause |
| Chunking/segments | segment helpers in `features/translation/segments.ts` + liveTranslate |
| Language | stateManager translation source/target |
| Cache | memory + persistent coordinator |
| Cancel/stale | abort + ticket/generation checks |
| Shared InputEngine | YES — same EventBus; independent feature state |
| Google | `NOT IMPLEMENTED` |

### Diagram 5 — Translation (current vs future)

**Current:**

```text
Input → (optional live debounce) → TRANSLATE_TEXT → Backend → Groq → write/replace
```

**Future target (not built):**

```text
Input → Google → (Pro) Groq refine → Output
```

---

## 24–25. Future Google + Real-time

### Where Google should connect (recommendation)

**Own it in the backend translation provider / AiGateway translation path** — not InputEngine, not each feature UI.

```text
TranslationFeature → SW TRANSLATE_TEXT → AiGateway.translation
   → TranslationRouter (NEW, backend)
        → CACHE
        → GOOGLE
        → optional GROQ refine (Pro)
```

This matches existing “features never call providers directly” boundary and keeps entitlement/credits server-authoritative.

### Real-time without per-character sends

Best fit with **current code**: keep **word/punctuation/Enter boundaries** (layout already does this) or **pause debounce** (translation already 750ms). Prefer **completed word + sentence boundary** hybrid for Free Google path to cut cost vs raw live-per-pause Groq.

---

## 26. Shared State Audit

| State | Owner | Location | Lifetime | Persist | Sync | Consumers | Mutators |
| --- | --- | --- | --- | --- | --- | --- | --- |
| settings enabled/pause/domains | StateManager | memory + unscoped storage | profile | YES | no account sync | InputEngine safety | popup/SW SET_SETTINGS |
| correction/translation/layout flags | StateManager | memory + account storage | account session | YES | account-local | feature schedulers | SET_* messages |
| FieldSession | registry | memory WeakMap | element lifetime | no | n/a | features/orchestrator | InputEngine |
| pending AI requests | FieldSession.activeRequest | memory | until complete/abort | no | n/a | features | tryAcquire/abort |
| entitlement/credits | SW cache + server | storage + API | session | cache | server authoritative | entitlement service | login/sync/usage |
| learning events | LearningEventService | account storage | until trim/clear | YES | no multi-device | dashboard | recordCorrection* |
| history | HistoryService | account storage | bounded | YES | no | popup/dashboard | recordHistory |
| AI cache | cache coordinator | memory+persist | TTL/clear on logout | YES | no | features | gateway responses |

---

## 27. Communication Map

| Path | Mechanism | Examples | Validation |
| --- | --- | --- | --- |
| Page DOM ↔ Content | DOM events + DOM R/W | input/keydown | safety gate |
| Content ↔ SW | `chrome.runtime.sendMessage` | CHECK_WORD, CORRECT_TEXT, TRANSLATE_TEXT, RUN_COMMAND | `messaging/validate.ts`, trusted sender checks |
| Popup/Dashboard ↔ SW | runtime messages | GET_STATUS, SET_*, ACCOUNT_*, GET_HISTORY, learning APIs | validate + sender |
| SW ↔ Backend | HTTPS fetch | `/api/ai/*`, `/api/auth/*`, `/api/account/*` | bearer JWT / install auth |
| Backend ↔ Groq | HTTPS chat completions | providers/* | API key server-side |
| Website ↔ Backend | fetch | auth, entitlement, billing checkout/portal | session tokens |
| Backend ↔ Paddle | webhooks + API | `/api/billing/webhook` | signature verify |
| Backend ↔ Google | — | — | `NOT IMPLEMENTED` |

Payload shapes live in `extension/src/messaging/types.ts` and shared Command types.

---

## 28–29. Storage & Database

### Extension persistence

- `chrome.storage.local` primary
- Persistent AI cache store
- No IndexedDB learning store found as primary path (`NOT VERIFIED` / effectively unused for learning)

### Backend JSON store collections (`db/store.ts`)

`accounts`, `sessions`, `installs`, `usage`, `subscriptions`, `webhookEvents`

**No tables for:** corrections, learning events, translation memory, analytics event stream.

---

## 30. Event / Analytics Audit

**Product events actually implemented:**

- Learning: `detected` / `accepted` / `rejected` (categories spelling/grammar/wording)
- History operations: `CORRECT` / `TRANSLATE` / `FIX_LAYOUT`
- Shared `events.ts` defines future system kinds (`extension_enabled`, etc.) — mostly **schema / planned**, not a full telemetry pipeline

**Not found as first-class emitted analytics names:** `feature_enabled`, `layout_detected`, `translation_failed`, `ai_requested`, etc. (metrics counters exist inside features, not a unified analytics bus).

---

## 31. Error Taxonomy Table

| Error Type | Implemented? | Detector | Corrector | AI? | Recorded? | Dashboard? |
| --- | --- | --- | --- | --- | --- | --- |
| spelling | YES | Groq (+ tiny local typo map) | Groq / local map | YES/local | learning category | YES |
| grammar | YES | Groq | Groq | YES | learning | YES |
| wording | YES | Groq | Groq | YES | learning | YES |
| keyboard layout mismatch | YES | local heuristics (+ optional Groq) | mapLayout | optional | history FIX_LAYOUT only | NO as learning category |
| punctuation (explicit) | PARTIAL | folded→grammar | Groq | YES | as grammar | as grammar |
| capitalization | NO distinct type | — | — | — | — | — |
| translation issue | NO | — | — | — | history TRANSLATE only | NO |
| style | folded→wording | Groq | Groq | YES | wording | wording |

---

## 32. Feature Matrix

| Feature | Detection | Processing | Provider | UI | Storage | Learning | Dashboard | Free | Pro |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Keyboard Layout | local heuristics/lexicon | mapLayout + scheduler | local; Groq fallback | auto replace + Speed Box | history + layout settings | NO category | NO | local YES; AI fallback credits | same + more AI credits |
| Spelling | typo map + Groq | instant + AI | Groq | card/direct | history+learning | YES | YES | limited AI credits if signed in | higher credits |
| Grammar | Groq | AI | Groq | card/direct | history+learning | YES | YES | limited | higher |
| Translation | user/live trigger | segment translate | Groq | field replace | history+cache | NO | activity only | limited credits (weight 2) | higher |
| Rewrite | — | — | — | — | — | — | — | N/A | N/A (`NOT IMPLEMENTED`) |
| Practice | from learning patterns | correction mode practice | Groq | dashboard | practice sessions | YES | YES | basic | full capability |

---

## 33. End-to-End Data Lifecycle

### Diagram 6 — Learning

```text
Correction response changes
  → recordCorrectionDetected (box)
  → user accept/reject
  → LearningEventStore (account-scoped)
  → progress.ts aggregation
  → ProgressPanel / Practice recommendation
```

### Combined lifecycle

```text
USER → INPUT(InputEngine) → DETECTION(feature schedulers)
  → CLASSIFICATION(layout heuristics | Groq change types)
  → FEATURE ROUTER(EventBus auto OR CommandRouter explicit)
  → LOCAL and/or AI(Groq via gateway)
  → RESULT(DOM write / card)
  → USER ACTION(accept/dismiss/ignore)
  → EVENT(learning/history/metrics)
  → STORAGE(local account namespace)
  → AGGREGATION(client progress)
  → DASHBOARD
```

Layout enters at local classification and usually exits before Groq. Correction/translation enter AI more often.

---

## 34. Privacy / Data Flow

| Feature | Local | Backend | Groq | Future Google | Stored? |
| --- | --- | --- | --- | --- | --- |
| Keyboard layout auto | YES text in page | only if remote classify | word+context if remote | n/a | history source/result locally |
| Instant spelling | YES | NO | NO | n/a | only if counted as correction commit |
| AI correction | segment prepared locally | YES raw segment | YES | n/a | learning originals/corrections locally; usage meta server |
| Translation | YES | YES raw text | YES | would leave browser | history locally |
| Learning history | YES | NO | NO | n/a | local account-scoped |
| Billing/auth | tokens | YES email/password hashes/sub | NO | n/a | server accounts |

**Raw user text leaves browser for:** AI correction, translation, and ambiguous layout classification — not for successful local layout fixes.

---

## 35. Performance Notes

- Capture listeners on document (necessary); features forbidden from competing listeners.
- Layout work synchronous on boundary keys — must stay lexicon-cheap (it is).
- Correction/translation network off main path via async; still can cause DOM writes that feel like jumps.
- Caches + coalescing reduce repeat Groq calls.
- Risk: live translation enabled + long fields → frequent expensive Groq calls (model `gpt-oss-120b`).

---

## 36. Failure / Recovery

| Failure | Behavior |
| --- | --- |
| Groq down | Gateway maps provider errors; features show error/hide card; local layout/instant spell still work |
| Backend down | AI features fail; apiHealth surfaced in status |
| Network offline | remote paths fail; local layout continues |
| Malformed AI JSON | provider throws invalid_response; no commit |
| Timeout | gateway AbortController timeout |
| Rate limit / credits | entitlement denial; UX points to local tools |
| Logout | detach clears memory + cache; AI locked without account |
| Account switch | hydrate other namespace (settings global residual) |
| Tab close | field sessions discarded |
| SW restart | restoreActiveAccountFromSession + hydrate |

Google unavailable: N/A today.

---

## 37. Architectural Strengths (evidence-based)

1. **Single InputEngine ownership** — prevents listener chaos (`InputEngine.ts` comment + content boot).
2. **FieldSession generation/mutex** — real stale/abort protocol.
3. **Feature separation** — layout/correction/translation modules with distinct providers/prompts.
4. **Local-first layout** — maps/lexicons before Groq; free `layout_auto`.
5. **Server-authoritative credits/capabilities** — reservation in accountService + gateway.
6. **Account-scoped learning/history** after Phase 32A.
7. **Correction card stale bindings** — generation checks before accept.
8. **Shared package contracts** — prompts/models/credits single-sourced.

---

## 38. Weaknesses & Risks (P0/P1/P2)

### P0

1. **Live translation Groq cost** if users enable live (`gpt-oss-120b`, weight 2, 750ms pauses).
2. **Global settings not account-scoped** — cross-account leakage of exclusions/pause.
3. **Docs still describe BYOK** — operational confusion risk.

### P1

4. Correction+translation dual schedulers can double-charge same typing session.
5. Learning lacks domain/language/layout dimensions — limits product analytics claims.
6. JSON file DB not horizontally scalable (explicit comment in store).
7. Layout remote fallback can still spend credits on ambiguous tokens.
8. JWT validity after logout residual.

### P2

9. PIPELINE unimplemented while present in types.
10. Naming drift across historical docs/phases increases maintainer load.
11. No unified product analytics bus.
12. Correction undo not first-class.

---

## 39. Do Not Overengineer

Preserve:

- InputEngine + FieldSession + per-feature schedulers
- AiGateway operation split
- Local layout engine
- Local learning store

Avoid greenfield orchestration platforms. Prefer a **thin translation provider router** and **tighten entitlement/cost defaults**.

---

## 40–41. Target Architecture & Provider Routing

### FREE (target)

```text
Layout        → LOCAL only (AI classify off or severely capped)
Spelling basic→ LOCAL typo map (+ optional tiny trial Groq)
Translation   → GOOGLE
Groq          → very limited trial credits
Learning      → local (existing)
```

### PRO (target)

```text
Layout        → LOCAL + optional Groq classify
Correction    → existing Groq correction pipeline
Translation   → GOOGLE then optional Groq refine
Learning      → existing local system (+ optional future sync)
```

### Provider router location

**Backend `AiGateway` / translation+correction providers** — features keep sending domain commands (`CORRECT`/`TRANSLATE`/`FIX_LAYOUT` classify). Router returns results only.

```text
Feature → Command/SW message → AiGateway → ProviderRouter → LOCAL|GOOGLE|GROQ|CACHE
```

---

## 42. Learning Must Stay Out of Providers

**Current separation:** **GOOD / mostly followed.**

- Groq providers return correction/translation/layout verdicts only.
- `recordCorrectionLearning.ts` and history recording live in extension application layer after user-visible outcomes.

Keep it that way when adding Google.

---

## 43. Learning Design Review (can it answer…?)

| Question | Answerable now? | Missing |
| --- | --- | --- |
| Most common errors? | YES (category + normalizedOriginal counts) | — |
| Categories improving? | PARTIAL (7-day trend on error rate) | longer horizons |
| Repeatedly rejected? | PARTIAL (rejected events exist) | weak product surfacing |
| Recurring mistakes? | YES (recurringPatterns) | — |
| Language causing errors? | NO | language field |
| Websites producing mistakes? | NO | domain field |
| Correction types common? | YES | — |
| Improve over time? | PARTIAL | needs consistent sampleWordCount discipline |

---

## 44. Investor / Product Architecture Verdict

| Dimension | Score | Evidence |
| --- | --- | --- |
| Technical maturity | **7.5/10** | Solid MV3 core, gateway, billing, tests; JSON DB & cost controls still young |
| Architecture quality | **8/10** | Clear input ownership + feature modules + server AI boundary |
| Feature integration | **7/10** | Three features coexist well; dual auto-schedulers can interact on cost |
| AI architecture | **7/10** | Clean Groq gateway split; no multi-provider yet; expensive translation model |
| Learning system | **6.5/10** | Real local loop + dashboard; limited dimensions; no server learning |
| Privacy architecture | **7/10** | Local-first layout; AI text egress explicit; isolation mostly fixed; settings gap |
| Scalability | **5.5/10** | Single-process JSON store; SW fan-in OK for early stage |
| Maintainability | **6.5/10** | Good module seams; doc drift + phase residue |
| Production readiness | **7/10** | Auth, Paddle, entitlements, caches, safety present; monitor live AI cost |

---

## 45. Final Recommendation Answers

1. **Coherent?** Yes — content-core + SW gateway + local learning is coherent.  
2. **Strongest technically?** Keyboard layout local engine + FieldSession/InputEngine.  
3. **Strongest commercially?** Layout (differentiated, free-capable) + correction learning loop.  
4. **Layout independent of Groq?** **Yes for primary path**; Groq optional fallback.  
5. **Correction independent of Translation?** **Yes** — separate features/providers.  
6. **Unnecessarily Groq-dependent?** Live translation; remote layout classify for cases solvable by growing lexicons.  
7. **Biggest AI cost source?** Live translation (model + weight + frequency).  
8. **Provider routing owner?** Backend AiGateway.  
9. **Learning owner?** Extension application/domain layer (current).  
10. **Google connect?** Backend translation provider router.  
11. **Groq refine connect?** Same router, post-Google stage for Pro.  
12. **Free/Pro share pipeline?** Yes — same commands; router + entitlements differ.  
13. **Remain free:** local layout auto, basic local typo assist, basic progress.  
14. **Pro:** full AI correction, translation refine, higher credits, advanced progress/practice.  
15. **Never send to external AI:** passwords/secret fields (safety), pure local layout successes, learning aggregates if possible; minimize raw text.  
16. **Stored locally:** settings, account-scoped feature settings, history, learning, caches, auth session.  
17. **Stored server-side:** accounts, sessions, usage/credits, subscriptions, webhook idempotency — not learning corpora.  
18. **Learning isolated per account?** **Mostly yes** post-32A; settings global residual.  
19. **Duplicated pipelines?** Auto EventBus paths vs CommandRouter explicit paths (intentional); no duplicate Groq clients.  
20. **Top 10 risks:** (1) live translation cost (2) global settings leak (3) dual AI schedulers (4) JSON DB scale (5) doc/BYOK drift (6) learning dimension gaps (7) layout AI credit spend (8) JWT-after-logout (9) malformed model outputs edge cases (10) PIPELINE/types residue confusing contributors |

---

## 46–47. Required Diagrams (collected)

### Diagram 3 — Keyboard Layout

```text
Input boundary (Space/Enter/Tab/blur)
  → tokenize
  → inferSourceLayout
  → localClassificationHint / mapLayout / lexicon
  → canCommitMismatch
  → applyLayoutFix (DOM)
  → history FIX_LAYOUT
  → (else) cache → CHECK_WORD → Groq classify → maybe apply
```

### Diagram 4 — Spelling/Grammar

```text
Input → CorrectionScheduler → instant typo map (optional)
  → debounce → Groq correction
  → classify changes spelling|grammar|wording
  → CorrectionCard or direct merge
  → accept/reject → learning events → dashboard
```

---

## Minimal Implementation Plan (no code in this audit)

1. Treat this audit as freeze baseline.  
2. Add backend translation ProviderRouter (GOOGLE / GROQ / GOOGLE_THEN_GROQ / CACHE) without touching InputEngine.  
3. Default Free live translation off; prefer Google; keep Groq refine Pro-gated.  
4. Scope or fork global `settings` per account.  
5. Expand lexicon coverage to reduce layout_ai calls.  
6. Add learning optional `domain`/`language` fields only if product requires those dashboard answers.  
7. Update architecture docs to remove BYOK-as-primary.  
8. Cost telemetry on live translation before widening Free AI.

---

## Final Verdict Scores Recap

Technical 7.5 · Architecture 8 · Integration 7 · AI 7 · Learning 6.5 · Privacy 7 · Scale 5.5 · Maintainability 6.5 · Production 7.

---

```text
FINAL VERDICT

The audit is complete.

No implementation was performed.

The next implementation phase must be based on this audit and must NOT begin until the current data flow, provider boundaries, learning boundaries, and account isolation behavior are understood.
```
