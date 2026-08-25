# FL0_AUDIT — Flowlary Unified Extension Forensic Analysis

**Date:** 25 Aug 2026  
**Auditor scope:** Read-only inspection of three source repositories  
**Target product:** **FLOWLARY** — "Your AI Writing Companion"  
**Status:** **AUDIT ONLY — NO IMPLEMENTATION**

---

## Sources (verified accessible)

| # | Repository | Product name | Audit clone path | Version |
|---|------------|--------------|------------------|---------|
| 1 | `english-writing-assistant` | **English Writing Assistant (EWA)** | `/tmp/audit/english-writing-assistant` | **1.3.13** |
| 2 | `ai-writing-translator` | **Lingo** | `/tmp/audit/ai-writing-translator` | **0.1.0** |
| 3 | `autofix-layout` | **Layfix** | `/tmp/audit/autofix-layout` | **0.1.0** |

Original repositories were **not modified**. Evidence cites actual file paths in the audit clones.

---

## Table of Contents

1. [Architecture of Each Repository](#1-architecture-of-each-repository)
2. [Feature Inventory](#2-feature-inventory)
3. [Shared Modules](#3-shared-modules)
4. [Conflicting Modules](#4-conflicting-modules)
5. [Storage Keys](#5-storage-keys)
6. [Chrome Permissions](#6-chrome-permissions)
7. [Background Messages](#7-background-messages)
8. [Content-Script Behavior](#8-content-script-behavior)
9. [AI/API Behavior](#9-aiapi-behavior)
10. [Keyboard Shortcuts](#10-keyboard-shortcuts)
11. [Risks](#11-risks)
12. [Recommended Migration Map](#12-recommended-migration-map)
13. [Conclusion — KEEP / ADAPT / REPLACE / DELETE / FEATURE-SPECIFIC](#13-conclusion)
14. [Executive Deliverables (User Request §24)](#14-executive-deliverables)

---

## 1. Architecture of Each Repository

### 1.1 English Writing Assistant (EWA)

**Monorepo layout** (npm workspaces: `extension`, `backend`, `packages/shared`):

```
english-writing-assistant/
├── extension/           # MV3 Chrome extension (Vite build via build-extension.mjs)
│   ├── src/
│   │   ├── content/     # Single content entry: index.ts
│   │   ├── background/  # Service worker + groqCorrect.ts
│   │   ├── adapters/    # textarea / input / contenteditable
│   │   ├── language/    # English detection heuristics
│   │   ├── ui/correction-card/  # Shadow DOM suggestion overlay
│   │   ├── storage/     # ewa_* keys
│   │   └── popup/       # React settings + consent + API key
│   └── manifest.config.ts
├── backend/             # Hono Node server (dev/unpacked fallback)
│   └── src/routes/correct.ts → POST /api/correct
└── packages/shared/     # Zod schemas, prompts, DEFAULTS
```

**Runtime model:**

```
Page field → adapters → content/index.ts (session + debouncer)
  → chrome.runtime.sendMessage(CORRECT)
  → background/index.ts → groqCorrect.ts → api.groq.com (BYOK)
  → CORRECT_RESULT → CorrectionCard or direct mergeCorrection
```

**Key architectural traits:**

| Trait | Detail |
|-------|--------|
| Content scope | All `http(s)://*/*`, **`all_frames: true`** (`manifest.config.ts:39–42`) |
| AI path | **Direct extension → Groq** (user API key in local storage) |
| Auto mode | Always on when enabled + consented (debounced, no keyboard shortcut) |
| UI pattern | **Suggestion overlay** (`CorrectionCard`) or **direct in-place edit** |
| Session model | Per-field session with debouncer generation, request seq, merge guards |
| Safety | Distributed (no `safety/` module): adapter ignores password types, code editors |
| Build | Custom `build-extension.mjs` (3 Vite bundles + generated manifest) |

**Docs present:** `README.md`, `LIMITATIONS.md`, `PRIVACY.md`, `STORE.md`  
**Dedicated architecture doc:** **NOT VERIFIED**

---

### 1.2 Lingo (ai-writing-translator)

**Single-package layout** (Vite + CRXJS, Chrome/Edge builds):

```
ai-writing-translator/
├── src/
│   ├── content_script.ts      # Single content entry
│   ├── background.ts          # SW + API + license + cache
│   ├── dom/                   # Snapshot read/write/verify/generation
│   ├── safety/                # Field probes, token safety, privacy payloads
│   ├── translation/           # Engine, segments, cache, stale tickets
│   ├── entitlement/           # Trial/Free/Pro + Lemon Squeezy
│   ├── content/               # evaluateGate, translateCurrentText
│   └── popup/                 # React UI
├── backend/                   # FastAPI :8004
│   ├── main.py
│   └── providers/groq_provider.py
└── manifest.json
```

**Runtime model:**

```
Page field → content_script.ts (document listeners)
  → chrome.runtime.sendMessage(TRANSLATE_TEXT) [or shortcut path]
  → background.ts → POST /api/translate → Groq (server key)
  → commitReplacement() via dom/write.ts (surgical DOM replace)
```

**Key architectural traits:**

| Trait | Detail |
|-------|--------|
| Content scope | `<all_urls>`, **not** `all_frames` |
| AI path | **Server-only** — extension never calls Groq directly |
| Auto mode | **Live translation OFF by default**; 750ms pause; sentence/paragraph only |
| UI pattern | **Inline text replacement** (no overlay card) |
| Session model | `WeakMap` element generation + `TranslationTicket` + `isStaleTicket` |
| Safety | Full `safety/` module (fields, tokens, markdown, privacy allowlist) |
| License | Lemon Squeezy via `/api/license/activate`, product ID `LINGO` |

**Docs present:** `ARCHITECTURE.md`, `TRANSLATION_ENGINE.md`, `SECURITY.md`, `PRIVACY.md`, `DEPLOYMENT.md`

---

### 1.3 Layfix (autofix-layout)

**Single-package layout** (structural sibling of Lingo):

```
autofix-layout/
├── src/
│   ├── content_script.ts      # Single content entry (641 lines)
│   ├── content/speedBox.ts    # Manual converter overlay (Ctrl+Shift+L)
│   ├── content/fixCurrentText.ts
│   ├── layouts/               # mapLayout, planFieldFixes, catalog (13 layouts)
│   ├── cache/                 # Word classification cache + persistence
│   ├── dom/                   # Same family as Lingo (minor diffs)
│   ├── safety/                # Same family as Lingo (minor diffs)
│   ├── entitlement/           # Trial/Free/Pro (Layfix product)
│   └── popup/                 # React UI + history + exceptions
├── backend/                   # FastAPI :8003
│   ├── main.py
│   └── classification.py
└── manifest.json
```

**Runtime model:**

```
Page field → content_script.ts (boundary triggers: Space/Enter/Tab/blur)
  → planFieldFixes() + mapLayout() [local-first]
  → chrome.runtime.sendMessage(CHECK_WORD) [cache miss / ambiguous]
  → background.ts → POST /api/analyze-word → Groq classify only
  → commitReplacement() for LAYOUT_MISMATCH tokens
```

**Key architectural traits:**

| Trait | Detail |
|-------|--------|
| Content scope | `<all_urls>`, **not** `all_frames` |
| AI path | **Server classify only** — remap always local via `mapLayout()` |
| Auto mode | **ON by default** (when enabled); triggers on word boundaries, not keystrokes |
| UI pattern | Inline replace + popup manual converter + speed box overlay |
| Learning | Personal exceptions, accept/ignore/revert events, history (40 items) |
| Cache | 3-layer: content hot cache, SW persistent `wordCacheV2`, backend TTLCache |
| Extra permission | `clipboardWrite` (speed box copy) |

**Docs present:** `ARCHITECTURE.md` (comprehensive, 18 sections), `REAL_TIME_ARCHITECTURE_AUDIT.md`

---

## 2. Feature Inventory

### 2.1 Capability Matrix

| Capability | EWA | Lingo | Layfix |
|------------|-----|-------|--------|
| **Fix keyboard layout** | — | — | ✅ Local `mapLayout` + classify API |
| **Improve English writing** | ✅ Grammar/spelling/wording | — | — |
| **Meaning translation** | — | ✅ 12 languages | — |
| Auto while typing | ✅ Debounced (20–120ms) | ✅ Live (750ms, **off default**) | ✅ Space/Enter/Tab/blur |
| Manual shortcut | — | ✅ Ctrl/Cmd+Shift+, | ✅ Ctrl/Cmd+Shift+P |
| Speed box / manual UI | — | — | ✅ Ctrl/Cmd+Shift+L |
| Suggestion overlay | ✅ CorrectionCard | — | — |
| Direct in-place edit | ✅ mergeCorrection | ✅ commitReplacement | ✅ commitReplacement |
| Contenteditable support | ✅ ContentEditableAdapter | ✅ dom/read+write | ✅ dom/read+write |
| iframe support | ✅ `all_frames: true` | ❌ top frame only | ❌ top frame only |
| Personal learning | — | — | ✅ exceptions + revert threshold |
| History | ✅ 50 correction pairs | — | ✅ 40 layout fixes |
| License / entitlement | — (BYOK only) | ✅ Lemon Squeezy | ✅ Lemon Squeezy |
| Excluded domains | ❌ **NOT VERIFIED** | ✅ | ✅ |
| Pause temporarily | ❌ (enabled toggle only) | ✅ 1 hour | ✅ 1 hour (auto only) |
| Instant local fixes | ✅ instantSpell | — | ✅ localClassificationHint |
| IME/composition guard | ✅ | ✅ | ✅ |
| Stale response protection | ✅ generation + seq + merge | ✅ generation + ticket | ✅ generation + verify |
| Backend required | Optional (dev) | Yes (prod) | Yes (prod) |
| BYOK Groq | ✅ Required for correction | ❌ | ❌ |

### 2.2 Supported Field Types (all three)

| Field type | EWA | Lingo | Layfix |
|------------|-----|-------|--------|
| `<textarea>` | ✅ | ✅ | ✅ |
| `<input type="text">` etc. | ✅ (ignores password, email, etc.) | ✅ (safety probe) | ✅ (safety probe) |
| `contenteditable` | ✅ MutationObserver | ✅ range-based | ✅ range-based |
| Code editors (Monaco, etc.) | ✅ ignored | ✅ blocked | ✅ blocked |
| Password / OTP / payment | ✅ type-based ignore | ✅ probe-based block | ✅ probe-based block |

### 2.3 Default User-Facing Behavior (verified)

| Setting | EWA default | Lingo default | Layfix default |
|---------|---------------|---------------|----------------|
| Master enabled | false until consent | true (after install) | true |
| Auto assist | ON when enabled | Live OFF | Auto ON |
| Source language | English (detected) | Arabic (`ar`) | Layout profile (en-US + ar-101) |
| Target language | English (same-lang correct) | English (`en`) | Layout remap target |
| API key | User must enter Groq key | Server license | Server license |

### 2.4 Test Coverage Summary

| Repo | Unit test files | E2E | Backend tests |
|------|-----------------|-----|---------------|
| EWA | 15 (Vitest + Playwright) | 2 Playwright specs | 3 (Vitest) |
| Lingo | 15 Vitest | `e2e/chrome.mjs` (**NOT VERIFIED** as CI) | 3 pytest |
| Layfix | 27 Vitest | `e2e/chrome.mjs` (**NOT VERIFIED** as CI) | 3 pytest |

---

## 3. Shared Modules

### 3.1 Lingo ↔ Layfix (near-duplicate siblings)

Verified via `diff -rq`:

| Module | Similarity | Notes |
|--------|------------|-------|
| `src/dom/read.ts` | ~identical | Field text, caret, selection, text node mapping |
| `src/dom/write.ts` | minor diffs | Generation tracking, `commitReplacement`, `setNativeValue` |
| `src/dom/verify.ts` | ~identical | Pre-write stale/mismatch checks |
| `src/dom/composition.ts` | ~identical | IME composition depth |
| `src/dom/types.ts` | ~identical | `ReplacementSnapshot`, `DiscardReason` |
| `src/dom/caret.ts` | Lingo only | Layfix lacks separate caret.ts (logic may be inlined) |
| `src/safety/fields.ts` | minor diffs | Password, OTP, code region probes |
| `src/safety/tokenKind.ts` | ~identical | Email, URL, JWT, API key detection |
| `src/safety/tokenize.ts` | ~identical | Token splitting |
| `src/safety/domains.ts` | ~identical | Excluded host matching |
| `src/safety/markdown.ts` | ~identical | Code fence detection |
| `src/safety/privacy.ts` | **different allowlists** | `buildTranslatePayload` vs `buildAnalyzeWordPayload` |
| `src/content/evaluateGate.ts` | **identical** | `local-now` vs `await-usage` gate |
| `src/background/commands.ts` | same pattern | Tab message dispatch for shortcuts |
| `src/entitlement/*` | same engine | Different product IDs and storage key prefixes |
| `src/popup/` shell | same React structure | Different feature toggles |
| `src/browser/*` | ~identical | Extension API wrappers, store prefs |
| `src/messaging.ts` shape | similar | Different message type unions |
| `backend/observability.py` | ~identical | Request IDs, security headers |
| `backend/ratelimit.py` | ~identical | Sliding window limiter |

### 3.2 Cross-repo conceptual overlap

| Concept | EWA | Lingo/Layfix | Merge opportunity |
|---------|-----|--------------|-------------------|
| Editable field detection | `adapters/index.ts` | `dom/read.ts` `isValueEditable` | **Unify into InputEngine** |
| Generation / stale guard | debouncer generation + requestSeq | `WeakMap` generation + tickets | **Unify FieldSession** |
| Debouncing | IntelligentDebouncer | 750ms live timer / boundary keys | **Keep per-feature schedulers under router** |
| History | `ewa_history` | — / `autofixHistory` | **Unified history schema** |
| Popup React + tokens.css | own | shared design system | **One popup shell** |
| Keepalive port | ❌ | ✅ every 20s | **One keepalive** |
| English detection | `language/detect.ts` | ❌ (user config) | **LanguagePolicy module** |

### 3.3 EWA-unique modules (no equivalent in Lingo/Layfix)

| Module | Path | Purpose |
|--------|------|---------|
| CorrectionCard | `extension/src/ui/correction-card/` | Shadow DOM suggestion overlay |
| mergeCorrection | `extension/src/content/mergeCorrection.ts` | Stale-safe direct edit merge |
| instantSpell | `extension/src/content/instantSpell.ts` | Local typo fixes before API |
| IntelligentDebouncer | `extension/src/content/debounce.ts` | Adaptive debounce by boundary |
| extractWritingContext | `extension/src/content/segment.ts` | Trailing segment extraction |
| language/detect | `extension/src/language/detect.ts` | English/non-English heuristics |
| groqCorrect | `extension/src/background/groqCorrect.ts` | Direct BYOK Groq client |
| @ewa/shared | `packages/shared/src/index.ts` | Correction JSON schema + prompt |

---

## 4. Conflicting Modules

### 4.1 Hard conflicts (cannot coexist as-is)

| Conflict | Repos | Evidence | Impact |
|----------|-------|----------|--------|
| **Three content scripts** | All | Each registers capturing `input`/`keydown`/`focusin` on `document` | Competing DOM writes, infinite loops, stale races |
| **Three background SWs** | All | Separate MV3 service workers | Cannot ship as one extension without merge |
| **Three popups** | All | Separate `action.default_popup` | UX fragmentation |
| **Storage key namespaces** | All | `ewa_*` vs `lingo*` vs `autofix*` | Settings collision if keys reused blindly |
| **Different host_permissions** | All | Groq direct + 3 API hosts | Manifest must union + route correctly |
| **Different auto triggers on same field** | EWA + Layfix + Lingo | EWA debounced input; Layfix Space/Enter; Lingo 750ms live | Text changed by one feature retriggers others |
| **Different max field limits** | All | EWA 250 assist / 2000 send; Lingo 4000; Layfix 2000 / 48 tokens | Router must enforce per-operation limits |
| **iframe policy** | EWA vs others | EWA `all_frames: true`; Lingo/Layfix top-frame only | Must decide unified iframe policy |
| **Entitlement models** | EWA vs Lingo/Layfix | BYOK vs Lemon Squeezy server license | Unified product needs combined entitlement story |

### 4.2 Semantic conflicts (behavioral)

| Scenario | Conflict | Mitigation |
|----------|----------|------------|
| User types `hsjo]lj I dont know...` | Layfix remaps Arabic token; EWA tries to correct English | CommandRouter + LanguagePolicy: layout first on boundary, correct only English segments |
| English prose with ar-101 layout enabled | Layfix may false-positive Latin tokens | Preserve Layfix `canCommitMismatch` + personal exceptions |
| Lingo live ON + EWA ON | Translate then correct loop | Default live OFF; no auto-chaining; generation mutex |
| EWA direct edit changes text | Layfix sees new input event on space | Single InputEngine owns all input events; features subscribe via router |
| Same-language translation (en→en) | Lingo noop | Router should skip TRANSLATE for same-language pairs |
| Correction on Arabic text | EWA should skip (`detect.ts`) | Preserve English gate in LanguagePolicy |

### 4.3 Cache isolation conflicts

| Cache | Key space | Must NOT satisfy |
|-------|-----------|------------------|
| EWA SW LRU | text hash | translation or layout requests |
| Lingo memory | `(text, src, tgt, mode)` hash | correction or layout |
| Layfix word cache | `token\|layout\|candidates[\|ctx]` | correction or translation |
| Layfix backend TTLCache | server-side classify | other operations |

**Requirement:** Shared dedup layer must include `operation` in cache key (per Flowlary spec §11).

### 4.4 Documentation drift (not code conflicts, but migration risk)

| Doc | Says | Code says |
|-----|------|-----------|
| Lingo `ARCHITECTURE.md` storage table | `translator*` keys | `lingo*` keys (`identity.test.ts`) |
| Lingo `ARCHITECTURE.md` product ID | `AI_WRITING_TRANSLATOR` | `LINGO` (`brand.ts:11`) |
| EWA `STORE.md` history limit | "20 recent pairs" | `HISTORY_LIMIT = 50` (`packages/shared`) |

---

## 5. Storage Keys

### 5.1 EWA keys

| Key | Storage area | Schema / purpose | File |
|-----|--------------|------------------|------|
| `ewa_settings` | `chrome.storage.sync` | `enabled`, `highlights`, `correctionMode`, `backendUrl`, `consentAccepted` | `extension/src/storage/settings.ts:20` |
| `ewa_groq_api_key` | `chrome.storage.local` | User Groq API key (never synced) | `settings.ts:21` |
| `ewa_history` | `chrome.storage.local` | Recent correction pairs (max 50) | `settings.ts:22` |

**Listeners:** Content script watches `ewa_settings` sync changes (`content/index.ts:548–551`).

### 5.2 Lingo keys

| Key | Storage area | Schema / purpose | File |
|-----|--------------|------------------|------|
| `lingoProfile` | local | Languages, toggles, exclusions, pause | `src/profile/types.ts:4` |
| `lingoUsage` | local | Free-tier usage balance | `src/entitlement/config.ts:12` |
| `lingoLicenseCache` | local | Cached license verification | `config.ts:14` |
| `lingoLicenseKey` | sync | User license key | `config.ts:15` |
| `lingoFirstActivatedAt` | sync | Trial start timestamp | `config.ts:13` |

**NOT persisted:** Translation text cache (in-memory SW only).

### 5.3 Layfix keys

| Key | Storage area | Schema / purpose | File |
|-----|--------------|------------------|------|
| `autofixProfile` | local | enabled, toggles, layouts, exclusions, exceptions | `src/profile/types.ts:4` |
| `autofixEvents` | local | accepted/ignored/reverted events | `types.ts:5` |
| `autofixHistory` | local | token→replacement (max 40) | `types.ts:10` |
| `wordCacheV2` | local | Classification cache (max 5000 persist) | `src/cache/types.ts:3` |
| `autofixUsage` | local | Free-tier usage balance | `src/entitlement/config.ts:12` |
| `autofixLicenseCache` | local | Cached license verification | `config.ts:14` |
| `autofixFirstActivatedAt` | sync | Trial start timestamp | `config.ts:13` |
| `licenseKey` | sync | User license key | `background.ts:99` |
| `enabled`, `layoutProfile`, `excludedDomains` | sync | **Legacy mirror keys** for migration | `background.ts:108–111` |
| `languagesAutoDetected` | sync | Install flag only | `background.ts:668` |

### 5.4 Proposed Flowlary namespace

| Proposed key | Migrates from | Notes |
|--------------|---------------|-------|
| `flowlary.settings` | EWA + Lingo + Layfix master toggles | Unified enabled/pause/exclusions |
| `flowlary.correction` | `ewa_settings` (subset) | mode, highlights, consent |
| `flowlary.correction.groqKey` | `ewa_groq_api_key` | BYOK, local only |
| `flowlary.translation` | `lingoProfile` (subset) | languages, live, shortcut toggles |
| `flowlary.layout` | `autofixProfile` (subset) | layouts, auto/manual/shortcut toggles |
| `flowlary.layout.exceptions` | `autofixProfile.personalExceptions` | Never-correct tokens |
| `flowlary.layout.wordCache` | `wordCacheV2` | Optional rename; can keep `wordCacheV2` internally |
| `flowlary.history` | `ewa_history` + `autofixHistory` | Unified event log |
| `flowlary.entitlement` | `lingoLicense*` + `autofixLicense*` + usage | Single license story TBD |
| `flowlary.migrations.v1` | — | Migration completion flags |

### 5.5 Migration functions required

```typescript
// Proposed (not yet implemented)
migrateEWASettings(): Promise<void>      // ewa_settings + ewa_groq_api_key → flowlary.*
migrateLingoSettings(): Promise<void>      // lingoProfile + lingoLicense* → flowlary.*
migrateLayfixSettings(): Promise<void>     // autofixProfile + wordCacheV2 + legacy sync keys → flowlary.*
migrateHistories(): Promise<void>          // merge ewa_history + autofixHistory → flowlary.history
```

**Rule:** Delete old keys only after successful migration + verification. Never silently destroy API keys or personal exceptions.

---

## 6. Chrome Permissions

### 6.1 Side-by-side comparison

| Permission / host | EWA | Lingo | Layfix | Flowlary (proposed) |
|-------------------|-----|-------|--------|---------------------|
| `storage` | ✅ | ✅ | ✅ | ✅ Required |
| `activeTab` | ❌ | ✅ | ✅ | ✅ (shortcut dispatch) |
| `clipboardWrite` | ❌ | ❌ | ✅ | ✅ (speed box copy) |
| `https://api.groq.com/*` | ✅ | ❌ | ❌ | ✅ (BYOK correction) |
| `https://writing-api.zaixos.com/*` | ✅ | ❌ | ❌ | ⚠️ Optional (EWA backend fallback) |
| `http://127.0.0.1:8787/*` | ✅ | ❌ | ❌ | ⚠️ Dev only |
| `http://127.0.0.1:8004/*` | ❌ | ✅ | ❌ | ⚠️ Dev only |
| `https://lingo-api.zaixos.com/*` | ❌ | ✅ | ❌ | → unified API host |
| `http://127.0.0.1:8003/*` (+ 8000–8002) | ❌ | ❌ | ✅ | ⚠️ Dev only |
| Production Layfix API | ❌ in source manifest | ❌ | Injected via `VITE_API_BASE_URL` at build | → unified API host |

### 6.2 Content script declaration

| | EWA | Lingo | Layfix | Flowlary |
|---|-----|-------|--------|----------|
| Matches | `http://*/*`, `https://*/*` | `<all_urls>` | `<all_urls>` | `<all_urls>` or http(s) (equivalent) |
| `all_frames` | **true** | false (default) | false (default) | **Decision required** — recommend `true` with same-origin guards |
| `run_at` | `document_idle` | `document_idle` | `document_idle` | `document_idle` |

### 6.3 Commands (manifest)

| Command | EWA | Lingo | Layfix |
|---------|-----|-------|--------|
| Translate | — | `TRANSLATE_CURRENT_TEXT` → Ctrl/Cmd+Shift+Comma | — |
| Fix layout | — | — | `FIX_CURRENT_TEXT` → Ctrl/Cmd+Shift+P |
| Speed box | — | — | **NOT in manifest** — content-script `KeyL` listener only |

**Shortcut conflicts across three extensions today:** **NONE** (verified — different keys).

### 6.4 Options UI

| | EWA | Lingo | Layfix |
|---|-----|-------|--------|
| Options page | ❌ | `src/testpad/index.html` (tab) | `src/testpad/index.html` (tab) |
| Flowlary | — | — | — → keep one testpad/playground |

---

## 7. Background Messages

### 7.1 EWA message types

**File:** `extension/src/shared/messages.ts`, handler: `extension/src/background/index.ts`

| Type | Direction | Purpose |
|------|-----------|---------|
| `GET_SETTINGS` | popup/content → SW | Read merged settings + API key |
| `SET_SETTINGS` | popup → SW | Persist settings patch |
| `GET_HISTORY` | popup → SW | Read correction history |
| `CLEAR_HISTORY` | popup → SW | Clear history |
| `ADD_HISTORY` | content → SW | Append correction pair |
| `CANCEL_CORRECT` | content → SW | Abort in-flight request by `requestId` |
| `CORRECT` | content → SW | Run correction (BYOK or backend fallback) |
| `CORRECT_RESULT` | SW → content | `{ ok, data, error, aborted, timing }` |

**No content-script inbound messages** (EWA SW does not send messages to tabs).

### 7.2 Lingo message types

**File:** `src/messaging.ts`, handler: `src/background.ts`

| Type | Direction | Purpose |
|------|-----------|---------|
| `GET_STATUS` | popup → SW | Full status snapshot |
| `REQUEST_PAGE_TRANSLATE` | popup → SW → tab | Dispatch shortcut |
| `TRANSLATE_TEXT` | content → SW | API translation |
| `TRANSLATE_CURRENT_TEXT` | SW → content | Shortcut handler |
| `ACTIVATE_LICENSE` | popup → SW | Lemon Squeezy activate |
| `SET_ENABLED` | popup → SW | Master toggle |
| `SET_SHORTCUT_ENABLED` | popup → SW | Shortcut toggle |
| `SET_LIVE_ENABLED` | popup → SW | Live translation toggle |
| `SET_LANGUAGES` | popup → SW | Source/target update |
| `SWAP_LANGUAGES` | popup → SW | Swap language pair |
| `SET_EXCLUDED_DOMAINS` | popup → SW | Domain exclusion list |
| `ADD_EXCLUDED_DOMAIN` | popup → SW | Add one domain |
| `REMOVE_EXCLUDED_DOMAIN` | popup → SW | Remove one domain |
| `PAUSE_TEMPORARILY` | popup → SW | 1-hour pause |
| `NOTE_USAGE_ACTIVITY` | content → SW | Entitlement heartbeat |
| `CAN_INTERVENE` | content → SW | Entitlement gate check |

### 7.3 Layfix message types

**File:** `src/messaging.ts`, handler: `src/background.ts`

| Type | Direction | Purpose |
|------|-----------|---------|
| `CHECK_WORD` | content → SW | Classify token (cache → local → API) |
| `CHECK_WORD_RESULT` / `CHECK_WORD_ERROR` | SW → content | Classification result |
| `GET_STATUS` | popup → SW | Full status |
| `SET_ENABLED` | popup → SW | Auto layout toggle |
| `SET_MANUAL_CONVERSION` | popup → SW | Manual converter / speed box |
| `SET_DIRECT_SHORTCUT` | popup → SW | Fix shortcut toggle |
| `FIX_CURRENT_TEXT` | SW → content | Shortcut handler |
| `SET_PROFILE` | popup → SW | Layout profile |
| `SET_EXCLUDED_DOMAINS` | popup → SW | Domain exclusions |
| `ADD_EXCEPTION` / `REMOVE_EXCEPTION` | popup → SW | Personal exceptions |
| `RECORD_CORRECTION` | content → SW | accepted/ignored/reverted |
| `ACTIVATE_LICENSE` | popup → SW | License activate |
| `PAUSE_TEMPORARILY` | popup → SW | 1-hour pause (auto only) |
| `ADD_EXCLUDED_DOMAIN` / `REMOVE_EXCLUDED_DOMAIN` | popup → SW | Per-domain skip |
| `CLEAR_HISTORY` | popup → SW | Clear layout history |
| `NOTE_USAGE_ACTIVITY` | content → SW | Usage heartbeat |
| `CAN_INTERVENE` | content → SW | Entitlement gate |

### 7.4 Proposed Flowlary message taxonomy

```
Core:
  GET_STATUS, SET_SETTINGS, PAUSE_TEMPORARILY
  CAN_INTERVENE, NOTE_USAGE_ACTIVITY
  ACTIVATE_LICENSE

Router (content ↔ SW):
  DISPATCH_COMMAND { command: CORRECT|TRANSLATE|FIX_LAYOUT|PIPELINE, ... }
  COMMAND_RESULT { ok, data, error, aborted, stale }

Feature-specific (internal or namespaced):
  CORRECT / CORRECT_RESULT / CANCEL_CORRECT        (from EWA)
  TRANSLATE_TEXT / TRANSLATE_CURRENT_TEXT          (from Lingo)
  CHECK_WORD / CHECK_WORD_RESULT / FIX_CURRENT_TEXT (from Layfix)
  RECORD_EVENT { type: CORRECTION|TRANSLATION|LAYOUT_FIX, ... }
```

**Merge strategy:** Preserve existing message contracts inside feature modules; add thin router facade. Do not break characterization tests during port.

---

## 8. Content-Script Behavior

### 8.1 Event listener inventory

#### EWA (`extension/src/content/index.ts`)

| Target | Event | Phase | Purpose |
|--------|-------|-------|---------|
| `document` | `focusin` | bubble | Start session |
| `document` | `focusout` | bubble | Teardown session (delayed) |
| `document` | `input` | **capture** | Schedule debounced correction |
| Field | `compositionstart/end` | bubble | IME guard |
| Field | `keydown` (Enter) | bubble | Empty-field sync |
| Field | `input`, `change`, `keyup`, `compositionend` | bubble | Via adapters |
| CE field | MutationObserver | — | Programmatic DOM changes |
| `documentElement` | MutationObserver | — | SPA navigation, card reattach |
| `window` | `popstate` | — | SPA hook |
| `history` | `pushState/replaceState` patch | — | SPA hook |
| `chrome.storage` | `onChanged` | — | Settings sync |
| `chrome.runtime` | `sendMessage` only (outbound) | — | No inbound tab messages |

#### Lingo (`src/content_script.ts`)

| Target | Event | Phase | Purpose |
|--------|-------|-------|---------|
| `document` | `compositionstart/end` | bubble | IME guard |
| `document` | `focusin` | **capture** | Remember focus |
| `document` | `keydown` | **capture** | Activity + Enter live trigger |
| `document` | `input` | **capture** | bumpGeneration + schedule live translate |
| `chrome.runtime` | `onMessage` | — | `TRANSLATE_CURRENT_TEXT` |
| `chrome.storage` | `onChanged` | — | Profile + usage sync |
| `chrome.runtime` | `connect` keepalive | — | Every 20s |

#### Layfix (`src/content_script.ts` + `speedBox.ts`)

| Target | Event | Phase | Purpose |
|--------|-------|-------|---------|
| `document` | `keydown` | **capture** | Enter/Tab early eval; KeyP shortcut |
| `document` | `keyup` | **capture** | Space/Enter/Tab boundary eval |
| `document` | `input` | **capture** | Boundary eval; pending accept/revert |
| `document` | `focusin/out` | **capture** | Focus tracking; blur finalize |
| `document` | `compositionstart/end` | **capture** | IME lock |
| `window` | `keydown` | **capture** | Speed box Ctrl+Shift+L (`speedBox.ts`) |
| `chrome.runtime` | `onMessage` | — | `FIX_CURRENT_TEXT` |
| `chrome.storage` | `onChanged` | — | Profile, usage, word cache |

### 8.2 DOM modification points

| Repo | Modification mechanism | Locations |
|------|------------------------|-----------|
| EWA | `adapter.setText()` via mergeCorrection | Field value/textContent |
| EWA | CorrectionCard shadow host inserted `afterend` | `[data-ewa-correction-host]` |
| Lingo | `commitReplacement()` surgical replace | Field text nodes / value |
| Layfix | `commitReplacement()` token replace | Field text nodes / value |
| Layfix | Speed box shadow DOM | Ephemeral overlay only (no field write until copy) |

### 8.3 Timing / debounce behavior

| Feature | Trigger | Delay / boundary | File |
|---------|---------|------------------|------|
| EWA correction | Every input (capture) | 20–120ms adaptive (`IntelligentDebouncer`) | `debounce.ts`, `shared/index.ts` |
| Lingo live | Input + 750ms idle | Sentence or paragraph segment only | `content_script.ts:63`, `segments.ts` |
| Layfix auto | Space, Enter, Tab, blur | **No debounce** — immediate on boundary | `content_script.ts:75` |
| Layfix classify | Per unknown token | Async fire-and-forget; stale discarded | `content_script.ts`, `verify.ts` |

### 8.4 Page markers (detection if multiple extensions installed)

| Repo | Marker |
|------|--------|
| Lingo | `document.documentElement.dataset.lingo = 'active'` |
| Layfix | `document.documentElement.dataset.autofixLayout = 'active'` |
| EWA | `[data-ewa-correction-host]` on injected card only |

Flowlary should set: `document.documentElement.dataset.flowlary = 'active'`

---

## 9. AI/API Behavior

### 9.1 Three separate AI operations (must remain separate)

| Operation | Provider | Endpoint | Model (default) | When called |
|-----------|----------|----------|-----------------|-------------|
| **Correction** | Extension BYOK (EWA) | `POST https://api.groq.com/openai/v1/chat/completions` | `llama-3.1-8b-instant` | Debounced English text, consent + key |
| **Correction (fallback)** | EWA Hono backend | `POST /api/correct` | `llama-3.1-8b-instant` | Dev/unpacked without BYOK |
| **Translation** | Lingo FastAPI → Groq | `POST /api/translate` | `openai/gpt-oss-120b` | Manual shortcut or live (750ms) |
| **Layout classify** | Layfix FastAPI → Groq | `POST /api/analyze-word` | `allam-2-7b` | Cache miss / ambiguous token only |

**Layout remap:** Always local `mapLayout()` — Groq never returns corrected text for layout.

### 9.2 Prompt / response contracts

#### Correction (EWA)

- **System prompt:** `CORRECTION_SYSTEM_PROMPT` (`packages/shared/src/index.ts:117–120`)
- **Response:** JSON `{ originalText, correctedText, changes[] }` with types `spelling|grammar|wording`
- **Params:** `temperature: 0.1`, `max_tokens: 400`, `response_format: json_object`
- **Retries:** 2 attempts on schema failure
- **Truncation:** Max 2000 chars sent; fields >250 chars get no assist

#### Translation (Lingo)

- **Backend:** `backend/translation.py` builds system + user prompts
- **Response:** JSON via Groq `json_object` mode
- **Params:** `temperature: 0`, `max_tokens: 2048`
- **Limit:** 4000 chars per request (`translation/engine.ts`)
- **Cache:** In-memory 40 entries, 60s TTL, FNV-1a keys

#### Layout classification (Layfix)

- **Backend:** `backend/classification.py` + `build_system_prompt`
- **Response kinds:** `VALID`, `LAYOUT_MISMATCH` (`UNCERTAIN` → VALID client-side)
- **Params:** `temperature: 0`, `max_tokens: 48`, timeout 5s, `max_retries: 0`
- **Payload:** Single token + source layout + candidate layouts + safe context (≤200 chars)
- **Cache:** Persistent `wordCacheV2` (5000 entries, 24h TTL) + backend TTLCache (86400s, 10k)

### 9.3 Cost optimization (verified current + proposed)

| Feature | Current cost control | Flowlary requirement |
|---------|---------------------|----------------------|
| Layout | Local-first + 3-layer cache + coalescing | ✅ Preserve; no Groq on confident local map |
| Translation | Live off default; sentence/paragraph only | ✅ Preserve 750ms unless strong reason |
| Correction | Debounced; skip non-English; dedup lastSentText | ✅ Preserve; add shared dedup with operation tag |
| Cross-operation cache | None shared today | ⚠️ Build CacheCoordinator with operation in key |

### 9.4 Backend ports (development)

| Service | Port | Framework |
|---------|------|-----------|
| EWA | 8787 | Hono (Node) |
| Lingo | 8004 | FastAPI (Python) |
| Layfix | 8003 | FastAPI (Python) |

**Production hosts (manifest/build):**

- EWA: `writing-api.zaixos.com`
- Lingo: `lingo-api.zaixos.com`
- Layfix: via `VITE_API_BASE_URL` (**NOT VERIFIED** in source manifest)

**Flowlary backend strategy:** Do NOT force single FastAPI during initial merge unless necessary. Three routes may coexist behind one host later.

### 9.5 Rate limits (backend)

| Route | Limit | File |
|-------|-------|------|
| Lingo `/api/translate` | 40/min/IP | `ai-writing-translator/backend/settings.py:59–67` |
| Lingo `/api/license/activate` | 20/min/IP | same |
| Layfix `/api/analyze-word` | 120/min/IP | `autofix-layout/backend/settings.py:64–66` |
| EWA `/api/correct` | 60/min/IP | `english-writing-assistant/backend/src/config.ts` |

---

## 10. Keyboard Shortcuts

| Shortcut | Action | Extension | Manifest command | Handler file | Default enabled |
|----------|--------|-----------|-------------------|--------------|-----------------|
| **Ctrl/Cmd+Shift+,** | Translate selection or paragraph | Lingo | `TRANSLATE_CURRENT_TEXT` | `translateCurrentText.ts` | `shortcutEnabled` in profile |
| **Ctrl/Cmd+Shift+P** | Fix layout on selection/token/field | Layfix | `FIX_CURRENT_TEXT` | `fixCurrentText.ts` | `directShortcutEnabled` |
| **Ctrl/Cmd+Shift+L** | Toggle layout speed box | Layfix | ❌ not in manifest | `speedBox.ts:329–336` | `manualConversionEnabled` |
| *(none)* | English correction | EWA | — | — | — |

**Physical key codes:** Layfix/Lingo use `event.code` (`KeyP`, `KeyL`, `Comma`) so shortcuts survive wrong keyboard layouts.

**Flowlary defaults (per spec):**

| Feature | Shortcut | Default |
|---------|----------|---------|
| Translate | Ctrl/Cmd+Shift+, | Manual always works |
| Fix layout | Ctrl/Cmd+Shift+P | ON (when configured) |
| Speed box | Ctrl/Cmd+Shift+L | ON (when manual conversion enabled) |
| Improve English | — (auto debounced) | ON when configured |

**Chrome limitation note:** Max 4 suggested commands in manifest; current total = 2 manifest commands + 1 content-script listener. **No conflict verified.**

---

## 11. Risks

### 11.1 Critical risks

| Risk | Severity | Evidence | Mitigation |
|------|----------|----------|------------|
| Triple content script listener collision | **CRITICAL** | 3× capturing `input`/`keydown` on `document` | Single InputEngine (mandatory) |
| Infinite correction ↔ layout ↔ translate loop | **CRITICAL** | Each write triggers `input` on others | FieldSession mutex + generation + no auto-chaining |
| Stale AI overwrite after fast typing | **HIGH** | All three have stale guards (different patterns) | Unify FieldSession stale model from Lingo/Layfix tickets + EWA merge |
| EWA direct edit + Layfix auto on same field | **HIGH** | Documented in prior audits | CommandRouter serializes writes; layout on boundary only |
| Arabic/CJK text sent to English correction | **HIGH** | EWA `detect.ts` gates — must preserve | LanguagePolicy before CORRECT dispatch |
| Password/OTP field processing | **HIGH** | Lingo/Layfix stricter than EWA | Unified safety gate (stricter probe) before ANY operation |
| Loss of personal exceptions / word cache | **HIGH** | Layfix learning in `autofixProfile` | Migration + never delete old keys until verified |
| Loss of Groq API key | **HIGH** | `ewa_groq_api_key` | `migrateEWASettings()` local-only copy |

### 11.2 Medium risks

| Risk | Severity | Notes |
|------|----------|-------|
| iframe behavior change | MEDIUM | EWA `all_frames: true` vs others; merging may change behavior in cross-origin iframes |
| Entitlement/license unification | MEDIUM | Two Lemon products (Lingo + Layfix) + BYOK EWA — product strategy needed |
| Combined host_permissions store review | MEDIUM | Chrome Web Store justification for broader permissions |
| CorrectionCard UX regression | MEDIUM | Unique Shadow DOM overlay; must port intact |
| Speed box clipboard permission | MEDIUM | Layfix-only today; needed for Flowlary |
| Backend unavailability | MEDIUM | Lingo/Layfix fail closed; EWA can work offline with BYOK |
| Performance: EWA documentElement MutationObserver | MEDIUM | Consolidate observers in unified engine |
| Doc/code drift during port | MEDIUM | Several stale docs in Lingo repo |

### 11.3 Low risks / acceptable

| Risk | Notes |
|------|-------|
| Keepalive port duplication | Merge to one 20s keepalive |
| Testpad/options duplication | Keep one playground |
| Popup visual inconsistency | Unified design system (Layfix `DESIGN_SYSTEM.md` as reference) |

### 11.4 Functionality that may be lost (if merge done poorly)

| Feature | Risk of loss | Prevention |
|---------|--------------|------------|
| Layfix personal exception learning | Medium | Port `learn.ts` + `RECORD_CORRECTION` |
| Layfix persistent word cache | Medium | Migrate `wordCacheV2` |
| EWA CorrectionCard theming | Medium | Port `hostStyleAdapter.ts` |
| EWA instantSpell local fixes | Low | Port module verbatim |
| EWA all_frames iframe assist | Medium | Explicit iframe policy decision |
| Lingo 12-language support | Low | Port `languages.ts` |
| Layfix 13 keyboard layouts | Low | Port `layouts/` catalog |
| Independent feature toggles (Layfix auto vs manual vs shortcut) | Medium | Preserve three toggles in unified settings |
| Separate Chrome + Edge builds | Low | Port `build/` target pattern |
| EWA Playwright e2e | Low | Adapt fixture paths |

**Nothing should be intentionally deleted** if migration map is followed.

---

## 12. Recommended Migration Map

### 12.1 Phase order (from spec §20, aligned with verified dependencies)

| Phase | Name | Deliverable | Depends on |
|-------|------|-------------|------------|
| **0** | Freeze originals | Tag releases; no destructive edits | — |
| **1** | New Flowlary project | Empty monorepo scaffold | 0 |
| **2** | Shared DOM + safety + FieldSession | `core/dom/`, `core/safety/`, `core/session/` | 1 |
| **3** | ContentEngine + CommandRouter | Single `content_script` entry | 2 |
| **4** | Port Layfix | `features/layout/` — local-first | 3 |
| **5** | Port Lingo manual translate | Shortcut path only | 3 |
| **6** | Port Lingo live translate | 750ms scheduler (default OFF) | 5 |
| **7** | Port EWA correction | BYOK + debouncer | 3 |
| **8** | CorrectionCard + direct-edit | UI overlay integration | 7 |
| **9** | Unified popup | Flowlary UX | 4–8 |
| **10** | Unified storage + migration | `flowlary.*` + migrate*() | 9 |
| **11** | Unified history | CORRECTION / TRANSLATION / LAYOUT_FIX events | 10 |
| **12** | Performance / cost optimization | CacheCoordinator | 11 |
| **13** | Security / privacy review | Unified safety gate audit | 12 |
| **14** | Full regression testing | Characterization + integration tests | 13 |

**Do NOT skip to phase 7.** Layfix and Lingo manual paths must land before EWA correction (lowest cross-feature conflict first).

### 12.2 Module migration map

| Source module | Flowlary destination | Action |
|---------------|---------------------|--------|
| Lingo/Layfix `dom/*` | `core/dom/` | **ADAPT** — merge diffs, add EWA adapter bridge |
| Lingo/Layfix `safety/*` | `core/safety/` | **ADAPT** — stricter gate; union privacy allowlists |
| EWA `adapters/*` | `core/input/adapters/` | **ADAPT** — feed unified EditableElement |
| EWA `language/detect.ts` | `core/router/LanguagePolicy.ts` | **ADAPT** |
| Lingo `translation/*` | `features/translation/` | **KEEP** (module) |
| Layfix `layouts/*`, `cache/*` | `features/layout/` | **KEEP** (module) |
| EWA `ui/correction-card/*` | `features/correction/ui/` | **KEEP** |
| EWA `groqCorrect.ts` | `features/correction/GroqCorrectionClient.ts` | **KEEP** |
| EWA `@ewa/shared` | `shared/correction/` | **KEEP** |
| Lingo `background.ts` translate path | `background/` + `features/translation/` | **ADAPT** |
| Layfix `background.ts` classify path | `background/` + `features/layout/` | **ADAPT** |
| All three `content_script.ts` / `content/index.ts` | `core/input/InputEngine.ts` | **REPLACE** |
| Lingo/Layfix popup | `popup/` | **REPLACE** with unified Flowlary popup |
| Lingo/Layfix entitlement | `shared/entitlement/` | **ADAPT** — single product ID TBD |

### 12.3 Proposed Flowlary architecture

```
flowlary/
├── extension/
│   ├── manifest.json              # ONE manifest
│   ├── src/
│   │   ├── content_script.ts      # ONE entry → InputEngine.boot()
│   │   ├── background.ts          # ONE service worker
│   │   └── popup/
│   ├── core/
│   │   ├── input/
│   │   │   ├── InputEngine.ts     # Single document listener owner
│   │   │   ├── FieldSession.ts    # generation, mutex, abort, history
│   │   │   └── adapters/          # EWA textarea/input/CE adapters
│   │   ├── dom/                   # Merged Lingo/Layfix dom/
│   │   ├── safety/                # Merged safety/ (strictest rules)
│   │   ├── router/
│   │   │   ├── CommandRouter.ts   # CORRECT|TRANSLATE|FIX_LAYOUT|PIPELINE
│   │   │   └── LanguagePolicy.ts  # English gate + user lang config
│   │   ├── state/
│   │   │   └── StateManager.ts    # Profile, pause, exclusions
│   │   └── events/
│   │       └── EventBus.ts        # chrome.runtime messaging facade
│   ├── features/
│   │   ├── correction/            # EWA: debouncer, card, merge, instantSpell, groq
│   │   ├── translation/           # Lingo: engine, segments, cache, stale
│   │   └── layout/                # Layfix: mapLayout, planFieldFixes, speedBox, cache
│   ├── shared/
│   │   ├── correction/            # @ewa/shared schemas + prompts
│   │   ├── entitlement/
│   │   └── storage/
│   │       ├── schema.ts          # flowlary.* keys
│   │       └── migrate.ts         # migrateEWA/Lingo/Layfix*
│   └── icons/
├── backend/                       # Optional unified FastAPI (later phase)
│   ├── translate/                 # from Lingo
│   └── classify/                  # from Layfix
└── tests/
    ├── characterization/          # Port existing tests per feature
    └── integration/               # Unified engine tests
```

### 12.4 CommandRouter decision logic (proposed)

```
On input event (single listener):
  1. Safety gate → skip if blocked
  2. Update FieldSession snapshot + generation
  3. On boundary (space/enter/tab/blur):
     a. If layout mismatch detected → FIX_LAYOUT (local first)
     b. Do NOT chain to CORRECT or TRANSLATE automatically
  4. On debounced idle (EWA):
     a. If LanguagePolicy.isEnglishEligible → CORRECT
  5. On 750ms idle (if live translation ON):
     a. If languages differ → TRANSLATE segment
  6. On explicit shortcut:
     a. Ctrl+Shift+, → TRANSLATE (selection > paragraph)
     b. Ctrl+Shift+P → FIX_LAYOUT (selection > token > field)
     c. Ctrl+Shift+L → speed box (no field write)
  7. Mutex: only one write per field per generation
```

**Explicit non-goals:** No automatic TRANSLATE→CORRECT or CORRECT→TRANSLATE chaining.

---

## 13. Conclusion

### WHAT TO KEEP (reuse with minimal changes)

| Item | Source |
|------|--------|
| Layfix `layouts/*` (mapLayout, planFieldFixes, catalog, heuristics) | autofix-layout |
| Layfix word cache + coalescing | autofix-layout |
| Layfix speed box + manual converter | autofix-layout |
| Layfix accept/ignore/revert learning | autofix-layout |
| Lingo translation engine + segments + 750ms live | ai-writing-translator |
| Lingo 12-language registry | ai-writing-translator |
| Lingo stale ticket model | ai-writing-translator |
| EWA CorrectionCard + hostStyleAdapter | english-writing-assistant |
| EWA mergeCorrection + instantSpell | english-writing-assistant |
| EWA IntelligentDebouncer + language detect | english-writing-assistant |
| EWA Groq BYOK client + correction prompt/schema | english-writing-assistant |
| Lingo/Layfix dom/ verify / generation pattern | both |
| Lingo/Layfix safety field probes (stricter) | both |
| All keyboard shortcuts (comma, P, L) | Lingo + Layfix |
| All existing characterization tests | all three |

### WHAT TO ADAPT

| Item | Change needed |
|------|---------------|
| `dom/` layer | Merge Lingo/Layfix diffs; bridge EWA adapters |
| `safety/privacy.ts` | Union translate + analyze-word allowlists |
| Background service worker | Single SW with namespaced handlers |
| Entitlement engine | Single product; support BYOK + license |
| Popup | Unified Flowlary UX (spec §13) |
| Storage | Namespace to `flowlary.*` + migration |
| History | Unified schema with type enum |
| iframe policy | Decide `all_frames` + same-origin guards |
| Cache layer | CacheCoordinator with operation-tagged keys |

### WHAT TO REPLACE

| Item | Reason |
|------|--------|
| Three content script entries | Must become ONE InputEngine |
| Three manifest files | ONE Flowlary manifest |
| Three popup apps | ONE Flowlary popup |
| EWA `content/index.ts` orchestration | Superseded by CommandRouter |
| Duplicate document event listeners | Single listener set in InputEngine |

### WHAT TO DELETE (only in NEW Flowlary repo — never in originals)

| Item | When |
|------|------|
| Duplicate `content_script.ts` copies | After unified engine passes tests |
| Old storage keys | After successful migration + user verification |
| Redundant keepalive / duplicate observers | After consolidation |
| **Original repos** | **NEVER DELETE** |

### WHAT MUST REMAIN FEATURE-SPECIFIC

| Module | Feature | Reason |
|--------|---------|--------|
| `GroqCorrectionClient` + correction prompt | Correction | Different AI contract |
| `TranslationClient` + translate prompt | Translation | Different AI contract |
| `LayoutClassifierClient` + classify prompt | Layout | Classification only; remap stays local |
| `mapLayout()` + layout maps | Layout | Must stay local-first |
| CorrectionCard UI | Correction | Unique UX not shared |
| speedBox overlay | Layout | Layout-specific manual tool |
| Translation segment logic | Translation | Sentence/paragraph semantics |
| Personal layout exceptions | Layout | Learned per-user |
| English detection heuristics | Correction | Must not run on Arabic/CJK |
| Separate operation caches | All | Must not cross-contaminate |

---

## 14. Executive Deliverables

### 14.1 Repository structure (summary)

Three separate repos today; one new Flowlary repo required. See §1 for per-repo trees and §12.3 for target tree.

### 14.2 What can be reused directly

- Layfix `layouts/` entire subtree
- Lingo `translation/` entire subtree
- EWA `packages/shared` correction schema + prompt
- EWA `CorrectionCard` + tests
- Lingo/Layfix `evaluateGate.ts` (identical)
- Lingo/Layfix entitlement engine structure
- All backend route handlers (initially as separate services or mounted routes)
- ~80% of Lingo/Layfix dom/ and safety/ (minor merge diffs)

### 14.3 What must be adapted

- DOM layer (merge 2 variants + EWA adapter bridge)
- Background SW (unify message routing)
- Popup (new unified UX)
- Storage (namespace + migration)
- Entitlement (single product story)
- Manifest (union permissions)

### 14.4 What must be rewritten

- Content script entry → `InputEngine` + `CommandRouter`
- Event listener registration (one owner)
- Cross-feature write coordination (`FieldSession` mutex)
- Unified history module

### 14.5 What must remain independent

- Three AI provider contracts (correction, translation, layout classify)
- Three feature modules under `features/`
- Layout local remap engine
- Operation-specific caches

### 14.6 All conflicts (consolidated)

1. Three content scripts → one required  
2. Competing document listeners → one required  
3. Auto-trigger interaction (EWA input vs Layfix boundary vs Lingo live) → router + defaults  
4. Storage key namespaces → migration required  
5. Safety strictness (EWA weaker) → unify to Lingo/Layfix level  
6. iframe policy (`all_frames`) → decision required  
7. Entitlement models (BYOK vs 2× Lemon) → product decision required  
8. Field size limits differ (250 vs 2000 vs 4000) → per-operation limits in router  
9. Cache key spaces → operation-tagged coordinator  
10. No auto-chaining between translate and correct → router rule  

### 14.7 All storage migrations

| From | To | Priority |
|------|-----|----------|
| `ewa_groq_api_key` | `flowlary.correction.groqKey` | P0 — user credential |
| `ewa_settings` | `flowlary.correction` + `flowlary.settings` | P0 |
| `ewa_history` | `flowlary.history` (type=CORRECTION) | P1 |
| `lingoProfile` | `flowlary.translation` + `flowlary.settings` | P0 |
| `lingoLicenseKey` + cache | `flowlary.entitlement` | P0 |
| `autofixProfile` | `flowlary.layout` + `flowlary.settings` | P0 |
| `wordCacheV2` | `flowlary.layout.wordCache` | P1 — performance |
| `autofixHistory` + events | `flowlary.history` (type=LAYOUT_FIX) | P1 |
| Legacy sync keys (`enabled`, `layoutProfile`, etc.) | Absorbed into `flowlary.*` | P2 |

### 14.8 All API migrations

| Current | Flowlary phase 1 | Flowlary phase 2 (optional) |
|---------|-------------------|----------------------------|
| EWA direct Groq BYOK | **Keep unchanged** | Keep |
| EWA Hono `:8787` | Dev fallback only | Deprecate or mount in unified backend |
| Lingo `:8004` `/api/translate` | Keep as-is | Mount at `/api/translate` on unified host |
| Layfix `:8003` `/api/analyze-word` | Keep as-is | Mount at `/api/analyze-word` on unified host |
| Two Lemon product IDs (`LINGO`, Layfix product) | **NOT VERIFIED** Layfix PRODUCT_ID constant | Single entitlement product TBD |

**Do NOT combine into one Groq prompt.**

### 14.9 Chrome manifest/permission conflicts

- **Union required:** `storage`, `activeTab`, `clipboardWrite`  
- **Union host_permissions:** `api.groq.com`, unified API host, dev localhost ports (build-time gated)  
- **Commands:** 2 manifest commands + 1 content-script shortcut (speed box) — no conflicts  
- **Content script:** single script, `all_frames` decision pending  
- **Store review:** broader host permissions need combined justification  

### 14.10 Exact proposed Flowlary architecture

See §12.3 diagram. Core principle: **ONE content engine**, **THREE feature modules**, **THREE AI contracts**.

### 14.11 Implementation phases

14 phases defined in §12.1 (Phase 0–14). Critical path: **2 → 3 → 4 → 5 → 7 → 9 → 10 → 14**.

Technical complexity: **High but bounded** — Lingo/Layfix ~70–80% structural overlap; EWA ~30% overlap. Expect new monorepo rather than extending any single repo root.

### 14.12 Risks

See §11. Top three: listener collision, infinite loops, stale overwrites.

### 14.13 Tests required

#### Characterization tests to port (minimum)

From existing suites — must continue passing when ported:

| Category | Source tests |
|----------|-------------|
| textarea / input / contenteditable | EWA `adapters/index.test.ts`; Lingo/Layfix `dom/replace.test.ts` |
| cursor / selection preservation | Lingo/Layfix `dom/replace.test.ts`; EWA CorrectionCard tests |
| Arabic / English / mixed | EWA `detect.test.ts`; Layfix `mixedLanguage.test.ts`, adversarial corpus |
| keyboard layout mismatch | Layfix `mapLayout.test.ts`, `convert.test.ts` |
| correction | EWA `mergeCorrection.test.ts`, `specCases.test.ts`, `instantSpell.test.ts` |
| translation | Lingo `translateCurrentText.test.ts`, `live.typing.test.ts` |
| rapid typing / stale AI | Lingo `stale`; Layfix `dom-races.test.ts`, `fixCurrentText.test.ts`; EWA debounce + merge |
| API failure | Backend tests all three; entitlement tests |
| disabled features | `evaluateGate.test.ts` (both) |
| excluded domains | Safety + profile tests |
| password fields | `safety/fields.test.ts` (both) |

#### New integration tests required

- Unified InputEngine: single listener verification  
- CommandRouter: CORRECT / TRANSLATE / FIX_LAYOUT dispatch in isolation  
- Cross-feature: layout fix then English correction on mixed field (no loop)  
- Mutex: concurrent operations on same field → single writer  
- Migration: `migrateEWA/Lingo/LayfixSettings()` round-trip  
- Popup: unified toggles reflect feature state  
- Shortcut: all three shortcuts in one extension  

### 14.14 Functionality that may be lost

| Item | Likelihood | Notes |
|------|------------|-------|
| Separate extension install/uninstall | Certain | By design — replaced by Flowlary |
| Independent version cadence per product | Certain | By design |
| EWA backend-only path (no BYOK) | Low | Can keep dev fallback |
| Layfix Edge-specific build tweaks | Low | Port `build/edge` |
| Lingo website/marketing site | None | Out of extension scope |
| testpad/playground as separate options | Low | Consolidate to one |
| Cross-origin iframe EWA assist | Medium | If `all_frames` policy changes |
| Two separate Lemon licenses (Lingo + Layfix) | Medium | Business decision — may need grandfathering |

---

## STOP — Awaiting Approval

This document completes **Phase 0 forensic analysis only**.

**No Flowlary implementation has been started.**  
**No original repository has been modified.**

Next step after approval: **Phase 1** — create new Flowlary project/monorepo (separate from the three source repos).

---

*Generated from read-only clones at `/tmp/audit/{english-writing-assistant,ai-writing-translator,autofix-layout}`. Items marked **NOT VERIFIED** were not confirmed from source code in this audit environment.*
