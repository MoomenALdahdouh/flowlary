# THREE CHROME EXTENSIONS — FORENSIC AUDIT & MERGE FEASIBILITY REPORT

**Date:** 25 Aug 2026  
**Sources (all cloned successfully, read-only):**

| # | GitHub | Product name | Clone path |
|---|--------|--------------|------------|
| 1 | [MoomenALdahdouh/ai-writing-translator](https://github.com/MoomenALdahdouh/ai-writing-translator) | **Lingo** | `/tmp/audit/ai-writing-translator` |
| 2 | [MoomenALdahdouh/autofix-layout](https://github.com/MoomenALdahdouh/autofix-layout) | **Layfix** | `/tmp/audit/autofix-layout` |
| 3 | [MoomenALdahdouh/english-writing-assistant](https://github.com/MoomenALdahdouh/english-writing-assistant) | **English Writing Assistant (EWA)** | `/tmp/audit/english-writing-assistant` |

No source was modified. Evidence below cites actual files.

---

## 1. Executive Summary

All three are **real, production-shaped Chrome MV3 extensions**, but they are **not one codebase today**.

| Product | Core job | Groq where? | Auto while typing? | Manual shortcut |
|---------|----------|-------------|-------------------|-----------------|
| **EWA** | English grammar/spelling correction | **Extension → `api.groq.com` (BYOK)** | Yes (debounced) | **None** |
| **Lingo** | Meaning translation (ar→en, etc.) | **FastAPI → Groq (server key)** | Optional live (off default; 750ms; sentence only) | `Ctrl/⌘+Shift+,` |
| **Layfix** | Keyboard **layout** remap (not translation) | **FastAPI → Groq for classify only**; remap is **local** | Yes (on Space/Enter/Tab/blur, token-level) | `Ctrl/⌘+Shift+P` (+ `Ctrl/⌘+Shift+L` speed box) |

**Lingo and Layfix** are explicit siblings: shared `dom/`, `safety/`, `entitlement/` patterns; separate storage keys and commands (`ARCHITECTURE.md` in each repo).

**EWA** is a third fork: npm workspaces, `@ewa/shared`, direct Groq BYOK, English-only gate, different adapters and overlay (`CorrectionCard`).

### Merge verdict

| Question | Answer |
|----------|--------|
| Can all three become one extension? | **YES — CONDITIONAL** |
| Should they? | **YES** — one “Language Assistant” with three feature modules |
| Safest approach | **Option D:** one extension, **one content engine**, command router, preserve feature modules |
| Do not merge blindly | Three content scripts today **will fight** on the same field if installed together |

---

## 2. Project Access Verification

### PROJECT ACCESS STATUS

| Project | Status | Absolute path (audit VM) |
|---------|--------|--------------------------|
| 1. ai-writing-translator | **ACCESSIBLE** | `/tmp/audit/ai-writing-translator` |
| 2. autofix-layout | **ACCESSIBLE** | `/tmp/audit/autofix-layout` |
| 3. english-writing-assistant | **ACCESSIBLE** | `/tmp/audit/english-writing-assistant` |

### Per-project inventory

| Item | Lingo | Layfix | EWA |
|------|-------|--------|-----|
| Manifest | `manifest.json` MV3 v0.1.0 | `manifest.json` MV3 v0.1.0 | `extension/manifest.config.ts` v**1.3.13** |
| package.json | root + `website/` | root | workspaces: `extension`, `backend`, `@ewa/shared` |
| Service worker | `src/background.ts` | `src/background.ts` | `extension/src/background/index.ts` |
| Content script | `src/content_script.ts` | `src/content_script.ts` | `extension/src/content/index.ts` |
| Popup | `src/popup/` React | `src/popup/` React | `extension/src/popup/` React |
| Options | `src/testpad/` (dev tab) | `src/testpad/` | **none** |
| Dashboard | **none** (website only) | history in popup (`autofixHistory`) | Recent pairs in popup only |
| Tests | 15 unit + e2e | 27 unit + e2e | 17 unit + Playwright |
| Build | Vite + CRXJS; Chrome/Edge | same | Vite + CRXJS workspaces |

---

## 3. Technology Stack Comparison

| Capability | Lingo | Layfix | EWA |
|------------|-------|--------|-----|
| Manifest | MV3 | MV3 | MV3 |
| Language | TypeScript | TypeScript | TypeScript |
| UI | React 19 | React 19 | React 19 |
| Build | Vite 8 + @crxjs | same | Vite 6 + @crxjs |
| Content scope | `<all_urls>`, **not** `all_frames` | `<all_urls>` | `http(s)://*/*`, **`all_frames: true`** |
| Permissions | `storage`, `activeTab` | + `clipboardWrite` | `storage` only |
| Host permissions | `lingo-api.zaixos.com`, localhost:8004 | localhost:8000–8003 (+ prod via env) | `api.groq.com`, writing-api, localhost:8787 |
| Groq in extension | **No** | **No** | **Yes (BYOK)** |
| Backend | FastAPI :8004 | FastAPI :8003 | Hono :8787 (dev/unpacked) |
| Default Groq model | `openai/gpt-oss-120b` (backend) | `allam-2-7b` (backend classify) | `llama-3.1-8b-instant` (extension) |
| License | Lemon Squeezy via API | Lemon Squeezy via API | None (BYOK) |
| Keyboard shortcuts | `TRANSLATE_CURRENT_TEXT` | `FIX_CURRENT_TEXT` | **none** |
| Analytics SDK | **none found** | **none found** | **none found** |

---

## 4. What Each Product Does (verified)

### A. English Writing Assistant — Correction

**Evidence:** `extension/src/content/index.ts`, `language/detect.ts`, `background/groqCorrect.ts`, `packages/shared/src/index.ts`.

1. **Purpose:** English spelling/grammar/wording in the same language.
2. **Activation:** Popup consent + Groq API key; then automatic on supported fields.
3. **Auto while typing:** Yes — `IntelligentDebouncer` (120ms default; 30ms after sentence boundary).
4. **Manual shortcut:** None.
5. **Sentence finish:** Shorter debounce after `.!?` or newline; not a hard “wait for period.”
6. **UI:** Suggestion box (default) or direct in-place rewrite.
7. **Target text:** Trailing segment via `extractWritingContext()` (≤2000 chars sent; field >250 chars ignored entirely).
8. **Language:** Local heuristics — skips Arabic/CJK/Cyrillic-dominant and Turkish signals (`detect.ts`).
9. **Groq when:** After debounce, if English-eligible, consent + key present; skip if same segment as last send.
10. **Model:** `llama-3.1-8b-instant`.
11. **Prompt:** `CORRECTION_SYSTEM_PROMPT` — JSON `{originalText, correctedText, changes[]}`.
12. **Stale protection:** `requestSeq`, `mergeCorrectionIntoField`, `canMergeCorrection` in direct mode.
13. **contenteditable:** `ContentEditableAdapter` with `execCommand('insertText')` fallback.
14. **Dashboard:** Popup “Recent” only (`ewa_history`, max 50). **No learning stats.**

### B. Lingo — Translation

**Evidence:** `src/content_script.ts`, `src/content/translateCurrentText.ts`, `src/translation/segments.ts`, `src/background.ts`, `README.md`.

1. **Purpose:** Translate **meaning** (e.g. Arabic → English), not keyboard layout.
2. **Activation:** Shortcut and/or optional live mode (default **off**).
3. **Auto while typing:** Only if `liveEnabled === true` — after **750ms pause**, **completed sentence or paragraph** (`liveSegmentOnPause`); never word-by-word (`segments.ts` comment).
4. **Manual shortcut:** `Ctrl/⌘+Shift+,` → selection first, else current paragraph (`translateCurrentText.ts`).
5. **UI:** Replaces text in field via surgical DOM (`commitReplacement`); no floating suggestion card.
6. **Languages:** User picks source + target (`languages.ts`: en, ar, tr, es, fr, de, pt, it, ru, zh, ja, ko). Default **ar → en**.
7. **Groq when:** Content script → SW `TRANSLATE_TEXT` → `POST /api/translate` → Groq on server.
8. **Cache:** In-memory 40 entries, 60s TTL (`translation/cache.ts`); hashed keys.
9. **Stale:** `snapshotGeneration` + `isStaleTicket` before write.
10. **Does NOT auto-translate English drafts** unless user enabled live and languages differ from field content logic — same-language pair is noop.

### C. Layfix — Layout switching

**Evidence:** `src/content_script.ts`, `src/layouts/convert.ts`, `ARCHITECTURE.md`, `src/background.ts`.

1. **Purpose:** Remap tokens typed on wrong **keyboard layout** (e.g. `hsjo]lj` → `استخدمت`).
2. **NOT translation** — `mapLayout()` is local; Groq returns `VALID | UNCERTAIN | LAYOUT_MISMATCH` only.
3. **Auto while typing:** On **Space, Enter, Tab, blur** — **not every keystroke**; paste/drop ignored.
4. **Manual shortcut:** `Ctrl/⌘+Shift+P` (fix selection/token/field); `Ctrl/⌘+Shift+L` opens on-page speed box (manual converter).
5. **Local path:** `planFieldFixes` + `mapLayout` without API when confident.
6. **Groq when:** Per **unknown token** via `CHECK_WORD` → `/api/analyze-word` (model `allam-2-7b`).
7. **Cache:** Persistent word cache in `chrome.storage.local` + memory + request coalescing.
8. **Learning:** `autofixEvents`, `autofixHistory`, personal exceptions from accept/ignore/revert.
9. **Layouts:** en-US-qwerty, ar-101, ru, de, fr, tr, he, el, es, it, pt, uk, fa, etc.

---

## 5. Feature Comparison Table

| Capability | Lingo | Layfix | EWA |
|------------|-------|--------|-----|
| Background | SW + API + license | SW + classify API + cache | SW + BYOK Groq or dev backend |
| Content script | 1 × all URLs | 1 × all URLs | 1 × all URLs + all frames |
| Popup | Languages, live toggle, license | Layouts, manual converter, history | Key, modes, recent |
| Dashboard | — | History in popup | Recent only |
| Storage keys | `lingoProfile`, `lingoUsage`, … | `autofixProfile`, `autofixHistory`, … | `ewa_settings`, `ewa_groq_api_key`, `ewa_history` |
| Shortcuts | ⌘⇧, | ⌘⇧P, ⌘⇧L | — |
| Input detection | `dom/` snapshot | `dom/` snapshot | `adapters/` |
| Sentence detection | `lastCompletedSegment` (live) | token boundaries + triggers | debounce boundaries |
| Language detection | **User config** (not auto-detect text) | layout heuristics + lexicons | **English heuristics** (skip non-English) |
| Groq | Server translate | Server classify only | Extension correct |
| Model | gpt-oss-120b | allam-2-7b | llama-3.1-8b-instant |
| Cache | Memory 40/60s | Memory + persistent word cache | SW LRU 50 |
| Debounce | 750ms live | boundary keys | 20–120ms |
| Auto mode | Live (off default) | On (space/enter/tab) | On (always when enabled) |
| Manual mode | Shortcut | Shortcut + speed box | — |
| History | — | Yes (40 items) | Yes (50 pairs) |

---

## 6. Groq / API Cost Analysis

| Feature | Trigger | Calls | Typical payload | Cache | Notes |
|---------|---------|-------|-----------------|-------|-------|
| EWA correct | Debounced typing | 0–1 per pause; up to 2 retries | ≤2000 chars segment + system prompt | LRU 50 (SW RAM) | Can fire mid-word after 90–120ms |
| Lingo shortcut | User ⌘⇧, | 1 per invocation | Selection or paragraph | Memory hash | User-initiated |
| Lingo live | 750ms after sentence + live ON | 1 per completed sentence | Sentence/paragraph | Same | **Off by default** |
| Layfix local | Space/Enter/Tab | **0 Groq** | — | layout cache | High-confidence `mapLayout` |
| Layfix classify | Unknown token | 1 per token (coalesced) | Single word + context | Persistent + coalesce | Worst case: many tokens per sentence |

### Unified cost strategy (recommended)

1. **Keep three operation types separate** — do not combine correction + translation in one prompt (accuracy > savings).
2. **Layout:** Maximize local `mapLayout` + cache; Groq only on cache miss (already Layfix design).
3. **Translation:** Keep sentence-level live (not keystroke); default live **off**.
4. **Correction:** Keep EWA segment cap + 250-char field cap; consider sentence boundary like Lingo to reduce calls.
5. **Shared request dedup layer:** hash `(operation, text, languages, settings)` with generation id + abort (merge EWA LRU + Lingo TTL + Layfix coalescer).

**Normal steady typing (all auto ON):** roughly **0–2 Groq calls per sentence boundary** — Layfix tokens (classify misses only) + EWA (one correct) + Lingo live (one translate if enabled). **With Lingo live off and Layfix cache warm:** often **0–1** (EWA only).

---

## 7. Correction + Translation Both Enabled

**Verified risk if three extensions installed separately:**

```
User types English: "I dont know..."
  → EWA debounce → Groq correct → field text changes
  → Layfix on space → may classify/changed tokens
  → Lingo live (if ON, ar→en) → could translate segment
  → EWA sees new input event → may correct again
```

**Lingo README:** live is **off by default**. **EWA** only runs on English. **Layfix** runs on Latin tokens that look like layout mismatch — English prose can trigger false positives if layouts include ar-101 + en-US (documented in ARCHITECTURE).

**Safe unified design:**

- **Command router** with explicit `mode`: `correct | translate | layout | pipeline`.
- **Default auto:** Correction ON for English; Translation **manual only**; Layout ON for configured layout pairs.
- **Never chain** translate→correct without user intent; use **generation tokens** and **field snapshot** (already in Lingo/Layfix `dom/`).
- **Mutex:** one in-flight write per field per generation.

---

## 8. Automatic vs Manual Modes

| Mode | EWA | Lingo | Layfix |
|------|-----|-------|--------|
| Auto | Always (when enabled) | `liveEnabled` (default false) | `enabled` + not paused |
| Manual | — | ⌘⇧, | ⌘⇧P, ⌘⇧L |

**Shortcut conflicts between the three:** **None** (EWA has none; Lingo uses Comma; Layfix uses P and L).

**Duplicate listeners:** **Yes — critical issue if all three installed.** Each registers capturing `input`/`keydown` on `document`. **Merge requires one content script.**

---

## 9. Duplication & Merge Map

### Shared between Lingo ↔ Layfix (near-duplicate)

| Module | Action | Why |
|--------|--------|-----|
| `src/dom/*` | **MERGE** | Snapshot read/write/verify; minor diffs only |
| `src/safety/*` | **MERGE** | Password/OTP/code field probes |
| `src/entitlement/*` | **ADAPT** | Same engine; different product IDs |
| `src/content/evaluateGate.ts` | **KEEP** | Identical |
| `src/background.ts` shape | **ADAPT** | Different message types |
| Popup shell / SettingsPanel | **ADAPT** | Different toggles |

### EWA (separate)

| Module | Action | Why |
|--------|--------|-----|
| `extension/src/adapters/*` | **ADAPT** into unified input engine | Rich textarea/input/CE handling |
| `extension/src/content/index.ts` | **REPLACE** with orchestrator | Becomes router host |
| `CorrectionCard` UI | **KEEP** | Unique UX; Layfix/Lingo use inline replace |
| `background/groqCorrect.ts` | **KEEP** as Correction provider | BYOK path |
| `packages/shared` prompt/schema | **KEEP** | Correction contract |
| `language/detect.ts` | **MERGE** with router language policy | English gate + future locales |
| `instantSpell.ts` | **KEEP** | Free local wins |
| `mergeCorrection.ts` | **KEEP** | Stale-safe direct edit |

### Layfix-specific

| Module | Action |
|--------|--------|
| `src/layouts/*` | **KEEP SEPARATE** feature module |
| `src/cache/*` (word classify) | **KEEP SEPARATE** |
| `speedBox.ts` | **KEEP** (manual layout UI) |

### Lingo-specific

| Module | Action |
|--------|--------|
| `src/translation/*` | **KEEP SEPARATE** feature module |
| `src/languages.ts` | **KEEP** |

### Backends

| Backend | Action |
|---------|--------|
| EWA Hono `/api/correct` | **OPTIONAL** dev; store uses BYOK |
| Lingo FastAPI `/api/translate` | **MERGE** into unified API or keep route |
| Layfix FastAPI `/api/analyze-word` | **MERGE** into unified API or keep route |

**Recommendation:** One FastAPI service with three routes; EWA can keep BYOK direct path for users who prefer no server.

---

## 10. Recommended Unified Architecture

```
Unified Extension ("Language Assistant" / Zaixos Writing)
│
├── Core (extract from Lingo/Layfix dom + EWA adapters)
│   ├── InputEngine          ← single content script entry
│   ├── FieldSession         ← one active field, one generation counter
│   ├── CommandRouter        ← CORRECT | TRANSLATE | FIX_LAYOUT | PIPELINE
│   ├── LanguagePolicy       ← EWA detect + user translate targets + layout profile
│   ├── StateManager         ← per-field tickets (reuse isStaleTicket pattern)
│   └── EventBus             ← chrome.runtime messages
│
├── AI Layer
│   ├── GroqCorrectionClient (BYOK — from EWA)
│   ├── TranslationClient    (server — from Lingo)
│   ├── LayoutClassifierClient (server — from Layfix)
│   ├── CacheCoordinator     ← unified dedup + LRU + persistent word cache
│   └── Retry/Abort          ← AbortController per request id
│
├── Features
│   ├── correction/          ← EWA prompt, card, instantSpell, mergeCorrection
│   ├── translation/         ← Lingo engine, segments, live scheduler
│   └── layout/              ← Layfix mapLayout, planFieldFixes, speedBox
│
└── UI
    ├── Popup                ← one simple surface (see §11)
    ├── CorrectionCard       ← EWA overlay (optional per mode)
    └── History/Dashboard    ← extend Layfix history + EWA pairs
```

**Why not three content scripts:** Verified — triple `document` listeners, triple DOM writes, loop risk.

**Why Lingo/Layfix dom as base:** Mature snapshot + stale checks + tests; EWA adapters should feed the same `EditableElement` abstraction.

---

## 11. Unified Popup (recommended)

**Philosophy:** “Remove friction from writing.”

| Section | Contents |
|---------|----------|
| Status | Active / Paused; API health |
| Writing languages | Preferred: English, Arabic, Turkish (+ more later) |
| Auto assists | ☑ Correct English · ☐ Translate (default off) · ☑ Fix keyboard layout |
| Translate pair | Source → Target (when translate enabled or manual) |
| Layout | Source layout + enabled layouts (Layfix) |
| Shortcuts | Correct (future), Translate ⌘⇧,, Layout ⌘⇧P |
| Today | Corrections count · Translations · Layout fixes (from history) |
| Advanced | Groq key (correction BYOK), license, excluded domains |

Hide license/API complexity until needed.

---

## 12. Dashboard / Learning

| | Current | Proposed |
|---|---------|----------|
| EWA | Recent correction pairs in popup | Keep; add diff view |
| Layfix | Token history + personal exceptions | Keep; feed “repeated layout mistakes” |
| Lingo | None in extension | Log translate events locally |
| Learning stats | **NOT VERIFIED** — not implemented | **Future:** aggregate history locally (no Groq) |

**Do not destroy:** EWA correction behavior, Layfix exception learning, Lingo stale-safe writes.

---

## 13. Privacy & Security

| Issue | Severity | Where |
|-------|----------|-------|
| Typed text to Groq (correction BYOK) | HIGH (by design) | EWA |
| Typed text to your FastAPI (translate/classify) | HIGH | Lingo, Layfix |
| All-URL content scripts | HIGH | All three |
| Password fields skipped | MEDIUM — probes exist but not perfect | Lingo/Layfix `safety/fields.ts`; EWA ignores password **type** only |
| Groq keys in extension storage | HIGH | EWA `ewa_groq_api_key` |
| License keys in sync storage | MEDIUM | Lingo/Layfix |
| No analytics | LOW (good) | All |

Unified product should use **one** safety gate (Lingo/Layfix probe is stricter than EWA).

---

## 14. Performance

| | Risk if separate | After merge |
|---|------------------|-------------|
| 3× content scripts | HIGH CPU/listeners | One script |
| EWA page MutationObserver on `documentElement` | MEDIUM | Consolidate |
| Layfix token API on every unknown word | MEDIUM Groq cost | Same, but shared coalescer |
| Lingo keepalive port every 20s | LOW | One keepalive |

---

## 15. Merge Decision

**Chosen: D — Rebuild shared architecture while preserving feature modules.**

Not **A** (glue three MV3 packages — triple injection).  
Not **C** (keep three store listings forever — bad UX and conflict).

**B partial:** Could ship “Writing Suite” as one extension containing Lingo+Layfix first (already siblings), add EWA in phase 2.

---

## 16. Safest Migration Order

1. **Phase 0** — Freeze three repos; tag releases  
2. **Phase 1** — New monorepo; shared `dom/` + `safety/` from Lingo/Layfix  
3. **Phase 2** — Single `content_script` + `FieldSession`  
4. **Phase 3** — Port Layfix layout module (local-first; lowest cross-feature conflict)  
5. **Phase 4** — Port Lingo translation (manual shortcut first; live off)  
6. **Phase 5** — Port EWA correction + CorrectionCard + BYOK  
7. **Phase 6** — Command router + mutex / stale policy unification  
8. **Phase 7** — Unified popup  
9. **Phase 8** — Unified backend (optional) or dual path BYOK + server  
10. **Phase 9** — History/dashboard merge  
11. **Phase 10** — Regression matrix + store single-purpose review  

---

## 17. Regression Matrix (highlights)

Must pass before shipping unified build:

- English typing + EWA box/direct modes unchanged  
- Arabic typed on US keyboard → Layfix remap; **EWA must not “correct” Arabic**  
- English sentence + Lingo live **off** → no translation  
- ⌘⇧, translate selection without enabling live  
- Rapid typing → no stale overwrite (all three stale patterns)  
- correction + layout both auto on same field → no infinite loop  
- Gmail, GitHub textarea, contenteditable compose (best-effort)  
- API failure → silent no-op (all three already fail closed)

---

# FINAL DECISION SECTION

### Can the three projects be merged?
**YES — CONDITIONAL** (requires single content engine + command router; not a zip merge).

### Should they become one Chrome Extension?
**YES.**

### Should they share one Core?
**YES.**

### Should they share one Content Engine?
**YES** (mandatory).

### Should they share one Groq Client?
**CONDITIONAL** — one **orchestrator** with three providers (BYOK correct, server translate, server classify).

### Should Correction and Translation share an AI request?
**NO.**

### Should Layout Switching use Groq?
**CONDITIONAL** — only for ambiguous token **classification**; remapping stays **local**.

### What must remain independent?
- Correction prompt/schema (EWA)  
- Translation engine + segments (Lingo)  
- Layout maps + `mapLayout` + classify API (Layfix)  
- Separate operation caches keyed by operation type  

### What should be shared?
- `dom/` snapshot layer  
- `safety/` field probes  
- Content script entry + session/generation  
- Command router + stale ticket model  
- Popup shell + pause/excluded domains  
- Entitlement engine (adapt product id)  

### Highest-risk existing functionality
- EWA **direct edit** + `mergeCorrectionIntoField`  
- Layfix **auto on space** changing tokens EWA then “corrects”  
- Lingo **live translate** if enabled while user writes English  
- Triple-install **listener collision** (today)  

### Safest merge order
Layfix module → Lingo manual → Lingo live → EWA correction → unified popup → deprecate old extensions.

### What should NOT be merged
- Three separate content scripts in one package  
- One combined Groq prompt for correct+translate  
- Layfix layout tables into Lingo translation prompts  

### Engineering complexity
**High but bounded:** Lingo/Layfix ~70–80% structural overlap; EWA ~30% overlap (adapters, card, BYOK). Expect a **new monorepo** rather than picking one repo as root.

### Final UX feel
User types in any language/layout; one assistant quietly fixes keyboard mistakes, optionally polishes English, and translates only when asked or when live translate is explicitly enabled — **one icon, one pause switch, three shortcuts.**

---

*Report generated from cloned public repositories. Re-run after major commits to refresh SHAs.*
