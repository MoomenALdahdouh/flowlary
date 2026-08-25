# THREE CHROME EXTENSIONS — FORENSIC AUDIT & MERGE FEASIBILITY REPORT

**Date:** 25 Aug 2026  
**Scope:** GitHub URLs supplied by the owner (this Cloud VM has no Mac disk).  
**Method:** `git clone` of each URL. No edits to cloned trees. No merge.

| Clone URL | HTTP without auth | Clone result |
| --- | --- | --- |
| https://github.com/MoomenALdahdouh/english-writing-assistant.git | 200 | **ACCESSIBLE** → `/tmp/audit/english-writing-assistant` (shallow, HEAD `v1.3.13` era) |
| https://github.com/MoomenALdahdouh/ai-writing-translator.git | **404** | **NOT ACCESSIBLE** (`fatal: could not read Username`) |
| https://github.com/MoomenALdahdouh/autofix-layout.git | **404** | **NOT ACCESSIBLE** (same) |

Unauthenticated GitHub 404 on a repo that “exists on your account” usually means **private**. This agent has **no `GH_TOKEN` / `gh auth`**. Those two trees were **not** read. Their behavior is **NOT VERIFIED FROM SOURCE**.

Phases 3–17 below are **complete for English Writing Assistant only**. Translator and AutoFix sections stop at access failure.

---

## 1. Executive Summary

**English Writing Assistant (EWA)** is a real Chrome MV3 TypeScript extension: all-site content script, Groq BYOK (`llama-3.1-8b-instant`), suggestion-box vs direct-edit, local typo map in direct mode, English/script gating, stale-merge protection, popup history. There is **no** `chrome.commands` shortcut, **no** in-extension learning dashboard (only Recent history), **no** analytics SDK.

**AI Writing Translator** and **AutoFix Layout** could not be cloned. **A three-way merge decision from code is impossible.**

**Merge decision (evidence-limited):** **not A/B/C.** Closest honest label: **blocked / D later** — do not merge products you cannot read. EWA is a plausible **host** if the other two are also MV3 field tools; that is **INFERRED**, not verified.

To finish: make the two repos public, or add a GitHub token to the Cloud environment, or copy the folders into `/workspace`.

---

## 2. Project Access Verification

### Project 1 — English Writing Assistant — ACCESSIBLE

| Item | Evidence |
| --- | --- |
| Absolute path (this VM) | `/tmp/audit/english-writing-assistant` |
| Manifest | `extension/manifest.config.ts` (CRXJS `defineManifest`, MV3, version `1.3.13`) |
| package.json | root workspaces: `packages/*`, `extension`, `backend` |
| Source dirs | `extension/src/{content,background,popup,adapters,language,storage,ui,diff,shared}` |
| Service worker | `extension/src/background/index.ts` |
| Content script | `extension/src/content/index.ts` (`http://*/*`, `https://*/*`, `all_frames: true`, `document_idle`) |
| Popup | `extension/src/popup/{App.tsx,index.html,main.tsx}` |
| Options page | **none** in manifest |
| Dashboard | **none** in extension; `site/` is a static marketing/privacy site |
| Tests | Vitest under extension/shared/backend; Playwright `extension/e2e/` |
| Build | Vite + `@crxjs/vite-plugin`; `extension/scripts/build-extension.mjs` |

### Project 2 — AI Writing Translator — NOT ACCESSIBLE

Clone and GitHub HTML/API both failed (404 / auth required). **STOP for this project.** No manifest, no entrypoints.

### Project 3 — AutoFix Layout — NOT ACCESSIBLE

Same as Project 2. **STOP for this project.**

---

## 3. English Writing Assistant — architecture (VERIFIED FROM CODE)

```
Page (all http/https frames)
  content/index.ts
    focusin/input capture → adapters (textarea | text | contenteditable)
    IntelligentDebouncer → CORRECT message
    CorrectionCard (Shadow DOM)
    mergeCorrectionIntoField / instantSpell (direct mode)
Service worker background/index.ts
    GET/SET_SETTINGS, HISTORY, CORRECT, CANCEL_CORRECT
    LruCache(50) keyed by hashText(trimmed)
    correctWithUserGroqKey  OR  (unpacked only) POST /api/correct
Optional backend (Hono :8787)
    groq-sdk, rate limit 60/min/IP, same prompt/schema
Popup React
    consent → Groq key → Pause → box|direct → highlights → Recent history
```

**Permissions:** `storage` only.  
**Host permissions:** `api.groq.com`, `writing-api.zaixos.com`, `writing-api.test`, `127.0.0.1:8787`, `localhost:8787`.  
**Commands / shortcuts:** **none** in `manifest.config.ts` (VERIFIED: no `commands` key).

### Module classification (EWA only)

| Module | Path | Class | Why |
| --- | --- | --- | --- |
| Input adapters | `extension/src/adapters/index.ts` | **KEEP** | Field read/write, cursor mapping, code-editor skip |
| Content session | `extension/src/content/index.ts` | **KEEP** / **ADAPT** as host orchestrator | One active field session, cancel, generation |
| Debouncer | `content/debounce.ts` | **KEEP** | Word/sentence-aware delays |
| Segment | `content/segment.ts` | **KEEP** | Caps Groq payload |
| Instant spell | `content/instantSpell.ts` | **KEEP** | Local, no Groq; English typo map |
| Merge apply | `content/mergeCorrection.ts` | **KEEP** | Stale-response guard |
| Language gate | `language/detect.ts` | **KEEP** / **ADAPT** | English-only; Arabic/Turkish already skipped |
| Groq client (SW) | `background/groqCorrect.ts` | **KEEP** as AI adapter | BYOK JSON correction |
| Groq client (backend) | `backend/src/services/groq.ts` | **KEEP SEPARATE** from store path | Dev/hosted duplicate of SW client |
| Cache | `shared/cache.ts` | **KEEP** | In-memory LRU 50, process lifetime |
| Settings/history | `storage/settings.ts` | **KEEP** / **ADAPT** keys `ewa_*` | Sync settings + local key |
| Correction card | `ui/correction-card/*` | **KEEP** | Overlay; host style matching |
| Popup | `popup/App.tsx` | **KEEP** / **ADAPT** | Consent, key, modes, recent |
| Shared prompt/schema | `packages/shared/src/index.ts` | **KEEP** | Correction-only prompt today |
| Site | `site/` | **KEEP SEPARATE** | Not extension runtime |
| Tests | `*.test.ts`, e2e | **KEEP** | Regression for merge |

---

## 4. What EWA actually does (Phase 3 answers)

Evidence: `content/index.ts`, `detect.ts`, `groqCorrect.ts`, `packages/shared/src/index.ts`, `manifest.config.ts`, `popup/App.tsx`.

1. **What it does:** English spelling/grammar/wording suggestions (or in-place rewrite). Prompt forbids style rewrites and non-English.
2. **Activation:** After popup **Continue** (consent) + Groq key. Then automatic on typing in supported fields. No keyboard command.
3. **Automatic while typing:** **Yes** — `input` capture + debounce (`DEBOUNCE_MS` 120 / word 45 / sentence 30; faster in direct).
4. **Manual shortcut:** **No** — no `commands`. Pause/Resume is popup-only.
5. **Sentence finish:** Shorter debounce (`endsWithSentenceBoundary` → 30ms box / 20ms direct), then Groq. Does **not** wait for a full stop as a hard gate.
6. **Modify vs suggest:** Default `correctionMode: 'box'` shows Shadow DOM row; click applies. `'direct'` calls `adapter.setText` after merge.
7. **Target text:** Focused textarea / `input[type=text]` / contenteditable via `findEditableFromTarget`. Skips password and Monaco/CodeMirror/Ace.
8. **Language:** Heuristic `detectEnglish` — function words, Arabic/CJK/Cyrillic counts, Turkish diacritics (`ğüşıöç`), Latin diacritics. **Not** a Groq language-detect call.
9. **When Groq is called:** After debounce, if `consentAccepted`, field ≤ 250 chars (`MAX_ASSIST_CHARS`), `isEligibleForCorrection(segment)` (min 8 chars or 3 words **and** `detectEnglish().isEnglish`), segment ≠ `lastSentText`/`lastCorrectedFor`. Direct mode may fix typos **locally** first (`instantSpell`) without Groq.
10. **Model:** `llama-3.1-8b-instant` (`DEFAULTS.GROQ_MODEL_DEFAULT` / backend `GROQ_MODEL`).
11. **Prompt:** `CORRECTION_SYSTEM_PROMPT` in `packages/shared/src/index.ts` — correct English, preserve meaning, JSON `{originalText, correctedText, changes[]}`.
12. **Data sent:** JSON user payload `{ text: segment, fieldType, previousText? }` (previous ≤ 200 chars). Authorization: user Groq key. Segment typically last paragraph / last 2 sentences / ≤ 2000 chars (`extractWritingContext` + `MAX_CORRECTION_CHARS`).
13. **API failure:** Box mode `CorrectionCard.setError` with key/rate/network copy. Direct mode: no card errors (card hidden). Typing never blocked. Backend: 2 attempts then 502/503.
14. **Typing while pending:** New `schedule` cancels timer; `CANCEL_CORRECT` aborts inflight AbortControllers. New `requestSeq`.
15. **Stale results:** `seq < lastAppliedSeq` skip; `isResultStillRelevant`; `mergeCorrectionIntoField` returns `null` if source span gone → skip apply (`applyCorrection`).
16. **Cursor:** `adapters` `mapCursorAfterReplace` + `setSelection`. Not a full OT editor.
17. **Contenteditable:** `ContentEditableAdapter` — `execCommand('insertText')` fallback `textContent`; MutationObserver on the node.
18. **Sites:** All URLs. Docs in `LIMITATIONS.md`: Google Docs unsupported; Gmail/iframes limited; code editors ignored.

**Translator / AutoFix Phase 3:** NOT VERIFIED FROM SOURCE.

---

## 5. Competing features (Phase 4)

**EWA only:** One feature (correction). English-dominant fields only. Arabic/Turkish-heavy text **never** gets Groq (`hasDominantNonLatinScript` / `likely_turkish`).

**Correction + translation loop:** **NOT VERIFIED FROM SOURCE** across products. **INFERRED:** if a translator also auto-rewrites the same field, EWA’s `input` listener **would** see the new text and may call Groq again (`onInputCapture` → `schedule`). That loop is a **future** risk, not observed in a second codebase.

---

## 6. Automatic vs manual (Phase 5)

| | EWA |
| --- | --- |
| Auto | Yes (content script) |
| Manual shortcut | **None** |
| Duplicate listeners | `input` on adapter **and** capturing `document` `input` — both schedule debounce (duplicate schedule, same generation bump) |
| Commands | None → no shortcut conflicts **inside EWA** |

**Command router (RECOMMENDED FUTURE, not in code):** would need to be added; EWA today is “always CORRECT after debounce” gated by language/eligibility.

---

## 7. Groq cost (Phase 6) — EWA only

| Feature | Trigger | Calls | Prompt | Model | Cache | Optimization already in code |
| --- | --- | --- | --- | --- | --- | --- |
| Correction (SW BYOK) | Debounced typing | 1 chat completion per eligible pause; **retry up to 2** in `correctWithUserGroqKey` | System prompt + JSON `{text, fieldType, previousText?}`; `max_tokens: 400` | `llama-3.1-8b-instant` | LRU 50 on `hashText(trim)` in **service worker memory** (lost on SW sleep) | Skip if same segment; 250 char field cap; 2000 char send cap; cancel abort; eligibility |
| Instant spell | Direct mode, word/sentence boundary | **0 Groq** | n/a | n/a | typo map | Local |
| Backend path | Unpacked, no user key | Same as SW + IP rate 60/min | Same | env model | none in backend | 2 attempts |

**Does it call Groq while still typing?** After 20–120ms pause, **yes** (not keystroke-by-keystroke). Mid-token uses default 90–120ms so **partial words can still hit Groq**.

**Combined correction+translation request:** NOT VERIFIED (no translator code). **RECOMMENDED:** keep separate prompts if translation is added — EWA prompt explicitly forbids rewrite/translate.

**Layout + Groq:** NOT VERIFIED FROM SOURCE.

---

## 8. Language detection (Phase 7) — EWA

**VERIFIED:** local heuristics only (`detect.ts`). User does **not** pick English/Arabic/Turkish. Mixed Arabic+English: if Arabic chars ≥ Latin, assistant hides. Turkish letters with low English function-word ratio → skip.

**RECOMMENDED FUTURE (not implemented):** keep auto-detect for “should correct?”; add a **single** translate target only if translator source is later audited. Do not add a language matrix in the popup until the other repos exist.

---

## 9–10. Unified architecture / single content engine

**Cannot design from three trees.** EWA already has **one** content engine (`content/index.ts`) with **one** `active` session. That is the right **host** shape **if** the other extensions also inject on every page (unverified).

Gluing three independent content scripts **without** reading the others is unsafe. **Do not implement.**

---

## 11. UI

**Popup (VERIFIED):** consent → Groq key → Pause → Suggestion box | Direct edit → Highlights (box only) → Recent (`HistoryList`) → links. No options page. No dashboard app.

**In-page:** `CorrectionCard` under field; analyzing / ready / error / plain. Direct mode hides card.

**Translator/layout UI:** NOT VERIFIED FROM SOURCE.

---

## 12. Dashboard / learning

**CURRENT (VERIFIED):** `ewa_history` local, max 50 pairs (`HISTORY_LIMIT`), original/corrected strings, popup list with token diff (`HistoryDiff.tsx`). No spelling-pattern stats, no vocabulary, no time series.

**PROPOSED / FUTURE:** can aggregate history **locally** without Groq. **Do not claim** a “Personal Language Improvement Dashboard” exists today.

---

## 13. Privacy & security (EWA)

| Issue | Severity | Evidence |
| --- | --- | --- |
| Groq key in `chrome.storage.local` (`ewa_groq_api_key`) | **HIGH** (by design BYOK; XSS on page cannot read extension storage, but malware/extension theft can) | `storage/settings.ts` |
| Typed text to `api.groq.com` after consent | **HIGH** (necessary for product; not sent if no consent/key) | `groqCorrect.ts`, `PRIVACY.md` |
| Content script all sites | **HIGH** (broad; skips password **type** but not all secrets, e.g. `input type=text` OTP) | `adapters` `IGNORED_INPUT_TYPES`, manifest matches |
| Host permission to Zaixos API + localhost | **MEDIUM** | unused for store BYOK path when key present |
| History of corrections on device | **MEDIUM** | `ADD_HISTORY` |
| `chrome.storage.sync` for settings (not key) | **LOW** | `ewa_settings` |
| Analytics | **none found** | grep: no gtag/telemetry in src |
| Shadow DOM overlay | **LOW–MEDIUM** | isolated UI; still page-injected host node |
| Prompt injection from page text | **MEDIUM** | field text is the user message; JSON mode + strict prompt reduce but do not eliminate |

---

## 14. Performance (EWA)

- One capturing `input` + `focusin`/`focusout` on `document`.
- Per-session MutationObserver on the field; page-level observer on `documentElement` `{childList, subtree}` — **can be expensive** on heavy SPAs (`observeDom`).
- History `pushState` wrap.
- Groq after debounce; SW LRU 50.
- 250-char hard stop avoids huge calls.

Combining **unknown** extra observers from the other two extensions would likely **hurt** until they are inventoried.

---

## 15. Merge decision

**A. Merge all three** — **NO** (2/3 unread).  
**B. Merge two, keep one separate** — **NO** (cannot name which).  
**C. Keep all three separate** — **default until the other repos are readable**.  
**D. Rebuild shared architecture preserving modules** — **only after** translator + autofix source is in this workspace.

**Chosen: C until access; then re-audit toward D with EWA as likely core.**

---

## 16. Merge map

**Translator / AutoFix:** no files.  

**EWA file → future host (RECOMMENDED only after other source exists):**

| Source | Destination |
| --- | --- |
| `adapters/index.ts` | Core input engine **KEEP** |
| `content/index.ts` | Core session **ADAPT** (router hook) |
| `language/detect.ts` | Language engine **ADAPT** |
| `background/groqCorrect.ts` | AI layer **KEEP** |
| `background/index.ts` | Message bus **ADAPT** |
| `popup/App.tsx` | Unified popup **ADAPT** |
| `packages/shared` | Correction feature module **KEEP** |
| `instantSpell.ts` | Correction local **KEEP** |
| `site/` | Docs **KEEP SEPARATE** |
| `backend/` | Dev-only **KEEP SEPARATE** from Chrome package |

---

## 17. Migration plan

**Do not migrate until clones succeed.** Then:

0. Backup three git SHAs  
1. Inventory translator + autofix manifests/permissions/commands  
2. Compare content-script overlap  
3. Only then extract shared input engine from EWA  
4. Add features as modules  
5. Shortcuts last (EWA has none today)  
6. Popup  
7. History/dashboard  
8. Groq cache persistence (today SW-only)  
9. Tests from EWA + new race tests  
10. Store listing / single-purpose review  

---

## 18. Regression matrix

**Runnable today against EWA only** (from `LIMITATIONS.md` + tests): textarea/input/contenteditable, English vs Arabic skip, 250-char skip, direct merge, debounce, instant typos, Gmail/Docs **known weak**, no shortcut tests.

**Correction+translation+layout:** NOT VERIFIED FROM SOURCE — cannot write a real matrix for missing products.

---

# FINAL DECISION

### Can the three projects be merged?
**CONDITIONAL / BLOCKED** — only EWA source verified.

### Should they become one Chrome Extension?
**NOT YET** — missing two repos.

### Should they share one Core / Content Engine / Groq client?
**NOT VERIFIED** for three. EWA already **is** one content engine + one Groq client.

### Should Correction and Translation share an AI request?
**NOT VERIFIED** (no translator). EWA prompt is correction-only.

### Should Layout Switching use Groq?
**NOT VERIFIED FROM SOURCE.**

### What must remain independent?
Backend/site of EWA vs extension; **unknown** modules in the private repos.

### What should be shared?
**Unknown** until those clones work. EWA adapters/debounce/cache are the only verified shareable core.

### Highest-risk existing functionality
EWA **direct edit** + `mergeCorrectionIntoField`; English skip for Arabic; 250-char cap; BYOK path vs leftover `writing-api.zaixos.com` host permission / `LIMITATIONS.md` “backend required” (docs **stale** vs SW BYOK — VERIFIED contradiction).

### Safest merge order
**Read the other two repos first.** Then EWA host → layout if local → correction → translation last (most likely to fight auto-correct).

### What should NOT be merged
Anything unread. Do not merge ACF (Zaixos filter product) — not in this trio.

---

## How to unblock

1. Set GitHub repos **public**, or  
2. `gh auth login` / `GH_TOKEN` with `repo` scope for this agent, or  
3. Copy local folders into the workspace.

Then re-run this prompt. I will not invent translator or autofix behavior.
