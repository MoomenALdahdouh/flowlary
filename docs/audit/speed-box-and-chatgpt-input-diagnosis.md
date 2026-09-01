# Speed Box `§` and ChatGPT input — diagnostic report

**Date:** 2026-08-31  
**Scope:** Observation A (Speed Box partial Arabic) and Observation B (ChatGPT / external editors).  
**Constraint:** Diagnosis only. No Phase 3. No production-code, test, flag, or settings changes.

**No source code was changed.** This file is the only deliverable.

**Live browser inspection:** not available for ChatGPT.com or a loaded extension isolate in this session. Observation A is reconstructed from the reported Speed Box output plus the layout converter. Observation B is the code path that would run if the ChatGPT composer were focused.

---

## Executive finding

These are **two different defects**.

**Observation A is a layout-intelligence / mapping-table issue, not an editor issue.** Speed Box ran a full `en-US-qwerty` → `ar-101` physical-key remap and succeeded on almost every letter. The leftover `§` is **not** Arabic `ذ`. Under the default source table, `§` is **unmatched and passed through**. The intended words `اذهب` / `الذهاب` require source `` ` `` (Backquote unshifted → `ذ`). The converter did a **literally correct** conversion of the characters it was given. It did **not** invent `ذ` from `§`. That is an incomplete source glyph table (and/or a hardware/OS glyph the user produced instead of `` ` ``), **not** tokenizer, lexical-confidence, or symbol-break rejection. Speed Box does not run those policies.

**Observation B is an editor-compatibility issue, not a layout-mapping issue.** ChatGPT’s composer is a **complex contenteditable** (ProseMirror / React). Phase 1 **intentionally blocks auto mutation** on every contenteditable. The runtime still labels all contenteditable as **Tier 2**; the writing-engine spec classifies this host as **Tier 3**. Manual `FIX_LAYOUT` may still call the **generic** CE writer. Speed Box **does not write back** into contenteditable at all (prefill, Apply, and Enter-insert are value-field only). A generic `deleteContents` + text-node insert would not dispatch a host `input` event and would not be a ChatGPT-safe adapter.

---

## Evidence limits

| Source | Result |
|---|---|
| Reported Speed Box output (user) | Recoverable; used as ground truth for Observation A |
| Content-script write/shadow telemetry | In-memory only; not persisted; not inspectable here |
| Agent transcripts / repo logs / QA shots | No dump of this Speed Box input or ChatGPT session |
| Live ChatGPT DOM | Not inspected |

Original typed text was **not** in logs. It **is** recoverable by inverting the converter (see below).

---

## Observation A — Speed Box partial Arabic

### 1. Recovered original input

Speed Box layout mode calls `convertManualText` → `mapLayoutText` (character remap, not the auto-layout tokenizer).

Default / test pair is `en-US-qwerty` → `ar-101` (`DEFAULT_PROFILE`, Speed Box unit defaults, `resolveConverterPair`).

Inverting the reported Arabic with that pair (preserving unmatched `§`) recovers this source string:

```text
hkh hgd,l td u'gm g;k ghhuvt ig s,t h§if hl gh g;k ]ukh kvn ig dl;kkh hg§ihf hl gh s,t hofv; fhgjthwdg hgd,l hglyvt h, hguahx
```

Forward remap of that string under `en-US-qwerty` → `ar-101` reproduces the reported output, including both `§` residues.

The intended `ذ` keys would have been **backtick**, not section sign:

| Intended Arabic | Required source (US QWERTY) | Actual source span |
|---|---|---|
| اذهب | `h`if | `h§if` |
| الذهاب | `hg`ihf | `hg§ihf` |

If the live Speed Box pair had been `de-qwertz` or `fr-azerty` as source, `§` **would have remapped** (German Shift-3 → Arabic `#`; French Shift-Slash → Arabic `؟`). The surviving `§` therefore **rules those sources out**. Active pair for this result is **`en-US-qwerty` → `ar-101`** (or any source table that does not contain `§`).

**Not recovered from logs:** OS keyboard, Caps Lock, whether Speed Box source/target selects were changed after open. Profile **code default** is enough to explain the output.

### 2. Active keyboard profile / layout

| Layer | Value used by Speed Box layout mode |
|---|---|
| Stored / default profile | `sourceLayout: en-US-qwerty`, `enabledLayouts: [en-US-qwerty, ar-101]` |
| Converter pair at open | `resolveConverterPair(profile)` → source `en-US-qwerty`, target `ar-101` |
| User override | Possible via Speed Box selects; **inconsistent with leftover `§`** if source were `de-qwertz` or `fr-azerty` |

Chrome cannot read the OS layout. The extension assumes the **selected source table** produced the typed characters.

### 3. Physical-key mapping for `§`

| Layout | Where `§` lives | Maps to on `ar-101` (same physical key + shift level) |
|---|---|---|
| `en-US-qwerty` | **Absent** | No key id. See §4. |
| `ar-101` | Absent | — |
| `de-qwertz` | `Digit3` **shifted** | `Digit3` shifted = `#` |
| `fr-azerty` | `Slash` **shifted** | `Slash` shifted = `؟` |
| Other catalog layouts (`ru-standard`, `tr-q`, `el-standard`, `es-latam`, `it-standard`, `pt-abnt`, `uk-standard`, `fa-standard`) | **No `§`** | Pass-through if used as source |

Arabic `ذ` is **`Backquote` unshifted** on `ar-101`. On `en-US-qwerty` that key is `` ` `` / `~`, **not** `§`.

There is **no** Mac-ISO / British-ISO / Apple “key left of 1 = §” table in the catalog.

### 4. What `§` is in this run

| Hypothesis | Verdict |
|---|---|
| Mapped key under the active source | **No** (`en-US-qwerty` has no `§`) |
| Unmatched symbol → pass-through | **Yes.** `mapLayoutText`: no `matchOutput` → append the raw character |
| Shift-generated glyph **of the intended ذ key** | **No.** EN Backquote shifted is `~` → AR `ّ`. `§` is a different code point. |
| Tokenizer separator | **No for Speed Box** (no tokenizer). Auto tokenizer `LAYOUT_SYMBOL_BREAK` is only `÷×—–`; `§` would **stay inside** the token |
| Lexical confidence rejection | **No.** Speed Box is ungated full remap (spec §21 Q5) |
| User-produced glyph that is not `` ` `` | **Yes**, as input to a correct converter |

`mapLayout` (auto path, all-or-nothing) would return `null` for a token containing `§`. `mapLayoutText` (Speed Box) **never fails the whole string**; it skips the unmatched char.

### 5. Failure-cause classification

| Cause | Applies to Observation A? |
|---|---|
| Wrong active layout profile (e.g. German/French source) | **No** — those sources would consume `§` |
| Incomplete mapping table | **Yes, as a catalog gap** — `§` is a real OS/hardware glyph (Mac Option-6; ISO/UK/DE Shift-3; some Mac ISO left-of-1 keys) and is not aliased to `Backquote` |
| Shifted / unshifted map bug for Backquote | **No** — Backquote was never matched |
| Tokenizer behavior | **No** (Speed Box) |
| Symbol-break policy | **No** (`§` is not a break glyph) |
| Lexical confidence rejection | **No** |
| User typing error beyond layout mismatch | **Partly** — `المغرف` is consistent with `t` instead of `f` (`المغرب`). `لااعرف` is a missing space (`لا اعرف`). Those letters remapped correctly. |

**Primary A finding:** mapping output is **literally correct physical-key conversion of the received characters**, **linguistically incomplete** because `§` ≠ `` ` ``. That is a **source-table / glyph-alias gap**, not a write-path bug.

### 6. Span table (Speed Box)

**Runtime:** Speed Box emits **no** per-span confidence or reason codes. Codes below are **diagnostic labels**, not logged events.

**Policy for Speed Box (current spec):** remap every matched source glyph; preserve whitespace; **pass through** unmatched characters. No lexicon gate.

| Input span | Mapped output | Confidence (runtime) | Diagnostic reason | Expected current policy |
|---|---|---|---|---|
| `hkh` | انا | not computed | `physical_key_mapped` | keep |
| `hgd,l` | اليوم | not computed | `physical_key_mapped` | keep |
| `td` | في | not computed | `physical_key_mapped` | keep |
| `u'gm` | عطلة | not computed | `physical_key_mapped` | keep |
| `g;k` | لكن | not computed | `physical_key_mapped` | keep |
| `ghhuvt` | لااعرف | not computed | `physical_key_mapped` + missing space in source | keep remap; not a layout miss |
| `ig` | هل | not computed | `physical_key_mapped` | keep |
| `s,t` | سوف | not computed | `physical_key_mapped` | keep |
| **`h§if`** | **ا§هب** | not computed | **`unmatched_passthrough` on `§`**; `h`/`i`/`f` mapped | pass through `§`; do **not** invent `ذ` |
| `hl` | ام | not computed | `physical_key_mapped` | keep |
| `gh` | لا | not computed | `physical_key_mapped` | keep |
| `g;k` | لكن | not computed | `physical_key_mapped` | keep |
| `]ukh` | دعنا | not computed | `physical_key_mapped` | keep |
| `kvn` | نرى | not computed | `physical_key_mapped` | keep |
| `ig` | هل | not computed | `physical_key_mapped` | keep |
| `dl;kkh` | يمكننا | not computed | `physical_key_mapped` | keep |
| **`hg§ihf`** | **ال§هاب** | not computed | **`unmatched_passthrough` on `§`** | same as `h§if` |
| `hofv;` | اخبرك | not computed | `physical_key_mapped` | keep |
| `fhgjthwdg` | بالتفاصيل | not computed | `physical_key_mapped` | keep |
| `hglyvt` | المغرف | not computed | `physical_key_mapped`; likely adjacent-key typo vs `hglyvf` → المغرب | keep remap |
| `h,` | او | not computed | `physical_key_mapped` | keep |
| `hguahx` | العشاء | not computed | `physical_key_mapped` | keep |
| spaces | spaces | — | `preserved_structure` | keep |

**Unresolved / partial spans (product):**

| Input | Mapped | Intended | Verdict |
|---|---|---|---|
| `h§if` | ا§هب | اذهب | Literal map OK; `§` not `ذ` |
| `hg§ihf` | ال§هاب | الذهاب | Same |
| `hglyvt` | المغرف | المغرب (context) | Layout OK; extra typing error |
| `ghhuvt` | لااعرف | لا اعرف | Layout OK; no space in source |

If this text were in a **Tier 1 field under auto layout**, `mapLayout('h§if', …)` would be `null` → **no token fix** (`lexical` / commit path never sees a corrected form). That is **stricter** than Speed Box, not the cause of leftover `§`.

### 7. Literal map vs mapping defect

| Question | Answer |
|---|---|
| Did the converter apply the wrong physical key for `h`, `i`, `f`, `g`? | **No** |
| Did it fail to map `§` because of confidence? | **No** |
| Is leftover `§` the correct behavior of the **current** `mapLayoutText` contract? | **Yes** |
| Is the catalog complete for users who produce `§` on the key they believe is `ذ`? | **No** — no ISO/Mac-§ alias to `Backquote` |
| Must Phase 3 “fix Arabic quality” by rewriting this sentence in an editor? | **No** — this is table / glyph-alias policy |

---

## Observation B — ChatGPT / external input

### 1. Editor classification (code path, not live DOM)

ChatGPT’s message composer (chatgpt.com / chat.openai.com, 2024–2026) is a **ProseMirror** surface: `contenteditable`, often still wrapped with a `prompt-textarea` id, **not** a native `HTMLTextAreaElement` / `HTMLInputElement`.

If the composer (or a child) is `document.activeElement`:

| Check | Result |
|---|---|
| `HTMLInputElement` textual | No |
| `HTMLTextAreaElement` | No (legacy ChatGPT textarea is gone) |
| `isContentEditable` / `createEditableAdapter` | **Yes** → `ContentEditableAdapter`, `fieldKind: contenteditable` |
| `looksLikeCodeEditor` | No (not Monaco/CodeMirror) |
| `editorTier()` in `context.ts` | **2** (any safe contenteditable) |
| Spec §15 | **Tier 3** — React / ProseMirror / Lexical; no generic-offset writes |

If focus is not inside an editable (empty page chrome, shadow, iframe without adapter): `resolveCommandTarget` → **no target**. Speed Box can still open; it simply has nothing to insert into.

**Diagnosis label for ChatGPT:** **complex contenteditable / unsupported editor (spec Tier 3)**. Runtime **does not** emit a separate “Tier 3” kind; it only knows `contenteditable`.

### 2. Does Phase 1 block auto mutation?

**Yes, intentionally**, for **all** contenteditable, including ChatGPT.

`allowsAutomaticFieldWrite` is true only for value fields. Layout / correction / live-translate auto paths record telemetry and skip or reject.

Shadow `shouldSkipAnalysis` skips when `editorTier !== 1`. `decideWriting` then finishes `noop` with `unsupported_editor` (plus `shadow_observe_only` in Phase 2).

### 3. Exact reason codes that would be emitted

Depends on trigger. **No live events were captured.** These are the codes the current code **would** emit:

| Trigger | Where | Reason / status |
|---|---|---|
| Auto layout | `LayoutScheduler` telemetry | `unsupported_editor_auto_write`, `fieldKind: contenteditable`, outcome `blocked` |
| Auto correction (direct) | `applyCorrection` telemetry | `unsupported_editor_auto_write` |
| Live translation | `liveTranslate` | `unsupported_editor_auto_write` |
| Auto `writeReplacement({ auto: true })` | `editor.ts` | `verdict: rejected`, `reason: unsupported_editor` |
| Shadow (if `internal_shadow`) | `decideWriting` | `unsupported_editor` (and `shadow_observe_only`) |
| Shortcuts-only policy | auto writers | `shortcuts_only` **instead of** or **before** editor codes |
| Protected / excluded host | safety | `protected_context` (chatgpt.com is not a built-in exclude) |
| Manual `FIX_LAYOUT` | command result | **Not** `unsupported_editor`. May `written` / `text_mismatch` / `noop` / `no_target` |
| Speed Box | orchestrator | `speed_box` or `blocked`/`disabled`; **no editor reason** |

### 4. Manual shortcut vs auto

| | Auto | Manual `FIX_LAYOUT` / suggestion apply |
|---|---|---|
| `auto: true` on write | Yes | **No** |
| CE allowed by Phase 1 gate | **Blocked** | **Allowed to attempt** generic CE write |
| ChatGPT result | Field unchanged by auto | May mutate DOM text nodes; **unlikely** to stick in ProseMirror (see §6) |
| Speed Box | Independent overlay | Does not use `writeReplacement` |

Phase 1 hardening text: manual shortcut / suggestion remain available **if** the existing CE write path succeeds. On ChatGPT that path is the **unsafe generic** writer, not an adapter.

### 5. Does Speed Box bypass the external editor write path?

**Yes, for contenteditable.**

| Speed Box action | ChatGPT / CE |
|---|---|
| Open / convert in overlay | Works (own `<textarea>`). This is how Observation A can succeed while ChatGPT fails |
| Prefill from focused field | **Empty** — `prefillFromField` only reads `input`/`textarea` |
| Apply (box mode) | Writes **Speed Box input only** (`writeInput`), not the page |
| Enter insert / `insertResult` | **No-op** — `canInsert()` requires `HTMLInputElement` \| `HTMLTextAreaElement` |
| Copy | User must paste; host editor then owns the text |

Speed Box is a **side channel**, not a ChatGPT writer.

### 6. If the generic CE path did write

`writeContentEditable` (`write.ts`):

1. Flatten text nodes, `mapOffsetToNode` for `[start, end)`.
2. `range.deleteContents()` + `insertNode(document.createTextNode(replacement))` + `normalize()`.
3. Best-effort caret via offsets.
4. **Does not** `dispatchEvent(InputEvent)` (value fields do: `insertReplacementText`).
5. **Does not** fire `beforeinput` that ProseMirror’s input plugin expects.

Therefore, if this path ran on ChatGPT:

| Question | Answer |
|---|---|
| Selection / caret preserved? | **Only if** flatten offsets still match PM’s document. Decorations, placeholders, and multi-node paragraphs often make `mapOffsetToNode` wrong or `discarded`. |
| `input` event dispatched? | **No** |
| Would ChatGPT / React / ProseMirror recognize it? | **Typically no.** State lives in the editor view, not in raw text nodes. |
| Could it be overwritten on rerender? | **Yes.** Next React/PM update restores the model and wipes the orphan text node. |

Value-field `setNativeValue` + `InputEvent` is what Speed Box uses for **native** insert — and it **never runs** for ChatGPT.

### 7. What must become a ChatGPT adapter vs what must not be reused

**Must become (later, not Phase 3):** a host-specific adapter that:

- Detects the ChatGPT / ProseMirror composer (origin + editor view), not “any contenteditable”.
- Reads document text and selection from the **editor API** (or an equivalent beforeinput/execCommand the host accepts).
- Writes through that same channel so React/PM update.
- Maps caret in **document positions**, not concatenated `TreeWalker` text.
- Declares **Tier 3** until those capabilities exist; keep auto-write off.

**Must not be reused unchanged:**

- `writeContentEditable` (`deleteContents` + raw text node)
- `collectTextNodes` / `mapOffsetToNode` / `readFieldText` flatten as authority
- `editorTier()` treating all CE as Tier 2 with `manualShortcut: tier <= 2`
- Speed Box `canInsert` / `prefillFromField` / `insertResult` value-only helpers as a ChatGPT write path
- Auto-write allowlist remaining “all CE” (it is correctly **false**; do not flip it for ChatGPT)
- `mapLayoutText` as a substitute for an editor adapter

### 8. Tier 2 or Tier 3?

| Authority | ChatGPT |
|---|---|
| Spec §15 | **Tier 3** |
| `buildFieldContext` / `editorTier()` | **Tier 2** (undifferentiated CE) |
| Phase 1 auto-write | Treated as **unsupported for auto** (same practical gate as Tier 3 auto) |
| Phase 1 manual | Treated as **Tier 2-capable** (generic write allowed) |

**Product diagnosis:** ChatGPT is **Tier 3**. The runtime **under-classifies** it as Tier 2, which is why a shortcut can still poke the generic writer.

---

## Current behavior: auto vs shortcut vs Speed Box

```text
Focus on ChatGPT composer (contenteditable / ProseMirror)
        │
        ├─ Auto layout / auto correct / live translate
        │     allowsAutomaticFieldWrite === false
        │     → telemetry unsupported_editor_auto_write
        │     → no DOM write
        │
        ├─ Shadow (if internal_shadow)
        │     editorTier runtime 2 ≠ 1 → skip analysis
        │     → decideWriting noop [shadow_observe_only, unsupported_editor]
        │
        ├─ FIX_LAYOUT shortcut
        │     resolveCommandTarget → ContentEditableAdapter
        │     safety usually allowed
        │     writeReplacement({ auto: false })
        │     → generic writeContentEditable (no input event)
        │     → likely discarded, ignored, or reverted by PM
        │
        └─ SPEED_BOX (⌘⇧L / Ctrl+Shift+L)
              overlay textarea; mapLayoutText
              → conversion can succeed (Observation A)
              → no write-back to CE
```

On a native `textarea`/`input`, auto and shortcut can write; Speed Box can prefill and insert.

---

## Layout intelligence vs editor compatibility

| Symptom | Class | Owner later |
|---|---|---|
| ا§هب / ال§هاب | Layout: unmatched `§` vs `` ` `` / `ذ` | Mapping tables, ISO aliases, Shift/symbol policy |
| المغرب typed as المغرف | User adjacent-key error | Not a converter bug |
| Speed Box works, ChatGPT field does not | Editor: CE / PM / no insert path | Tier 3 adapter; do not “fix” via layout tables |
| Runtime Tier 2 vs spec Tier 3 | Classification debt | Engine context, not Phase 3 layout goldens |

---

## Recommended Phase 3 prerequisites only

Phase 3 in the spec is **layout migration and accuracy guards on Tier 1**, not ChatGPT adapters and not a Speed Box rewrite.

Before Phase 3 implementation:

1. **Freeze Speed Box contract for unmatched glyphs.** Confirm (spec §21 Q5) that manual convert stays ungated and that `§` pass-through remains the correct Speed Box outcome until a catalog alias exists. Do not “fix” Observation A by sending layout auto through ChatGPT.
2. **Add Shift/symbol fixtures that Phase 3 already owes:** `` ` `` → `ذ`; `~` → `ّ`; `§` under `en-US-qwerty` (pass-through); `§` under `de-qwertz` (`#`); `§` under `fr-azerty` (`؟`). Treat ISO/Mac-§ → `Backquote` as a **catalog decision**, not a tokenizer change.
3. **Keep layout enforce on Tier 1 only.** Do not use chatgpt.com as a Phase 3 acceptance surface. Observation B must not drive generic CE auto-write.
4. **Do not use `mapLayout` vs `mapLayoutText` inconsistency as a silent Phase 3 behavior change** without an explicit policy: auto tokens containing unmatched symbols stay `noop`; Speed Box may still pass them through.
5. **Record the Tier 2/3 mislabel as out of Phase 3 scope.** Fixing ChatGPT requires an adapter phase; Phase 3 accuracy guards must not assume flatten-CE writes are valid evidence.
6. **Do not treat leftover `§` as lexical-confidence or symbol-break work.** Those policies did not run on this Speed Box sample.

No implementation plan beyond these prerequisites.

---

## Explicit non-change statement

No production code, tests, feature flags, settings, or documents other than this report were modified.
