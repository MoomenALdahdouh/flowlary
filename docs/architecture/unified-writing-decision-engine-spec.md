# Unified Writing Decision Engine Specification

**Status:** Implemented (see `extension/src/core/engine/decide.ts` and `writeGate/pipeline.ts`).  
**Audience:** Historical contract + normative language. For a map to **current files**, start at [WRITING_ENGINE.md](./WRITING_ENGINE.md) and [DECISION_ENGINE.md](./DECISION_ENGINE.md).  
**Supersedes for writing-path decisions:** independent auto-schedulers as writers; `PIPELINE` as an unused stub; per-feature language reclassification as authority.

Normative language: **MUST**, **MUST NOT**, **MAY**, **SHOULD**.  
`noop` is a successful, intentional decision. It is not a failure, skip, or missing log.

---

## 1. Purpose and Product Contract

Flowlary is one bilingual writing assistant inside the browser.

The user-facing promise is exactly four behaviors:

1. If the user typed with the wrong keyboard layout, fix the mismatch.
2. If the user wrote weak original English, improve it lightly.
3. If the user wants to write Arabic and output English, translate inline under an explicit translation session.
4. If the user does not want automatic behavior, shortcuts and suggestions remain available.

The user MUST NOT experience three tools competing in the same field.

The product MUST behave as one assistant with:

- one observation layer
- one decision layer
- one execution gate
- three coordinated capabilities (layout fix, English correction, Arabic→English translation)

Language detection, script counts, and lexicon hits are **evidence**. They are not user intent.  
User intent is established only by:

- an explicit user policy (settings),
- an explicit command (shortcut, popup, Speed Box, suggestion accept),
- or an explicit translation session.

Detected Arabic script does not mean “translate.”  
Detected Latin script does not mean “correct English.”  
A token that remaps to a known word does not, by itself, mean “auto-fix.”

---

## 2. Scope and Non-Goals

### In scope

- Decision, orchestration, and write-gate contracts for the Chrome MV3 extension writing path.
- Shared field context, chunking, candidates, confidence, and analytics taxonomy.
- Settings as user policy, including live content-script synchronization.
- Editor support tiers and honest CE limits.
- Incremental migration from the current three-scheduler architecture.

### Non-goals (this contract does not require)

- A greenfield rewrite of InputEngine, FieldSession, safety, or layout key tables.
- New languages or keyboard layouts beyond the existing catalog.
- An OS-level keyboard-layout API.
- A Grammarly-scale suggestion product.
- Website Writing Lab parity as part of the engine.
- Account, billing, practice, or learning-coach redesign (they MUST consume the new event taxonomy; they MUST NOT define writing decisions).
- Implementing this spec in the same change that authors it.

---

## 3. Confirmed Current-State Constraints

These audit facts are input to the architecture. Implementation MUST treat them as defects to close, not as optional style.

1. `extension/src/content_script.ts` starts layout, correction, and translation independently.
2. Layout auto, correction auto, and live translation subscribe to the same EventBus and decide independently.
3. Auto behavior bypasses `CommandOrchestrator`.
4. `PIPELINE` is a stub (`pipeline_not_implemented`).
5. Only shortcut/manual paths consistently use the field mutex (`FieldSession.tryAcquireWrite`).
6. Auto layout can mutate a field without taking the mutex (`applyLayoutFix` without `requestId`).
7. Layout, correction, and translation each classify language/context separately.
8. Grammar / instant spelling can run on wrong-layout Latin (`hwo` → `how` instead of a layout candidate).
9. Live translation can replace an unfinished Arabic paragraph after a 750ms pause (`liveSegmentOnPause` falls back to the whole paragraph).
10. Translation output can later be modified by correction.
11. Layout and translation can run on the same field/range without shared intent.
12. Content-script settings hydrate at bootstrap; `chrome.storage.onChanged` in the content script listens only to `authAccountId`.
13. Contenteditable handling is generic text-offset replacement and is unsafe for complex editors.
14. Analytics does not reliably distinguish original English, translated English, auto vs manual layout, and grammar.
15. Settings expose feature-level switches (`autoEnabled`, `shortcutEnabled`, `liveEnabled`, three box/direct modes) that do not form one user policy.
16. Short-token and mixed Arabic–English behavior are only partially handled (lexicon + ±3 neighbor window).
17. Physical-key tables exist (`mapLayout`); a complete key-state and tokenizer policy does not.

---

## 4. Architecture Principles and Invariants

### 4.1 Invariants (enforceable)

1. **No feature writes.** Layout, correction, and translation MUST NOT call `writeReplacement`, `commitReplacement`, or any DOM mutation helper except as the body of a Write Gate–issued transaction.
2. **One Write Gate.** Every mutation — automatic, shortcut, Speed Box apply, or suggestion accept — MUST go through the Central Write Gate.
3. **One decision per input cycle.** For a given field generation and analysis cycle, the Decision Engine MUST emit exactly one `WritingDecision` whose `action` is one of: `layout_fix` | `translation` | `english_correction` | `suggestion` | `noop`.
4. **Low confidence is not auto-write.** Confidence class `low` or `ambiguous` MUST resolve to `noop` or `suggestion`. It MUST NOT resolve to automatic mutation.
5. **Shared chunks.** Layout, translation, and English correction MUST consume the same `WritingChunk[]` for a cycle. They MUST NOT re-tokenize or re-language the field independently for eligibility.
6. **Translation is a session.** Automatic translation MUST NOT run unless a `TranslationSession` is active. An active session MUST suppress auto layout and auto English correction on covered ranges.
7. **Grammar exclusion.** Automatic English correction MUST NOT run on chunks tagged `suspected_layout_mismatch`, `arabizi`, `translated_output`, `protected`, or `ambiguous_mixed`.
8. **Short tokens.** Isolated tokens of length ≤ 2 MUST NOT be auto-remapped. They MAY produce `suggestion` only when neighbor-chunk evidence meets the bilingual policy (Section 10). Isolated, they MUST be `noop`.
9. **Key-state is first-class for layout.** Shift, unshifted, punctuation, and physical-key mapping MUST be represented in layout evidence. Letter-only heuristics MUST NOT be treated as complete layout authority.
10. **Protected contexts.** Passwords, OTPs, emails, URLs, code, shell, paths, formulas, identifiers, and formatting-sensitive spans MUST NOT receive automatic mutation. Shortcuts MAY run only when the safety layer allows the specific command and range.
11. **Honest editors.** Auto-write is allowed only on editor tiers that declare `auto_write` capability (Section 15). Complex editors MUST NOT receive unsafe offset writes.
12. **Policy settings.** Primary UI MUST express user policy (assistant, help style, capabilities, excludes). It MUST NOT require the user to understand internal scheduler flags.
13. **Analytics honesty.** Events MUST distinguish trigger, action, text origin, and outcome. Layout MUST NOT be recorded as grammar. Translation output MUST NOT be recorded as original English writing.
14. **Explainable decisions.** Every `WritingDecision` MUST include `reasonCodes` and debug metadata sufficient to answer “why this action, on this range, at this confidence.”
15. **`noop` is success.** A `noop` decision MUST be emitted and, when meaningful (Section 17), MUST be logged with reason codes and aggregate metadata only. Raw user text MUST NOT be stored for `noop` by default.
16. **Shadow mode is observe-only.** When the engine flag is `shadow`, the Decision Engine MUST observe and log only. It MUST NOT write, show new suggestion UI, or start a second automatic writer. Comparison events MUST be tagged `shadow_only`. Exactly one writer path may mutate a field: the **legacy** path. The new path MUST NOT mutate.

### 4.2 Forbidden behavior

- Feature schedulers attaching document listeners (InputEngine remains the sole owner).
- Feature schedulers committing DOM writes from EventBus handlers.
- Two concurrent write transactions on one field.
- Two automatic writers (legacy + new) on the same field/range in any mode, including shadow.
- Using script detection alone as a translation or correction trigger.
- Re-correcting tagged `translated_output` automatically.
- Treating closed lexicons as complete language truth.
- Wiping user exception lists as a side effect of changing layout pair (current SW `SET_LAYOUT` behavior is forbidden under this contract).
- Content-script policy that remains stale after a settings write.

---

## 5. Layer Ownership Model

### 5.1 Input Observation Layer

**Reuse:** `InputEngine`, `EventBus`, composition helpers, generation bump.

| | |
|---|---|
| Responsibility | Own document-level events; emit normalized input events; track composing and user vs system origin. |
| Inputs | DOM events (`focusin/out`, `input`, `keydown/keyup`, `compositionstart/end`). |
| Outputs | `NormalizedInputEvent`; active element; `FieldSession` lookup. |
| MAY | Filter non-editables; ignore controlled writes for generation. |
| MUST NOT | Decide features; write the field; call feature schedulers. |

### 5.2 Field Context Layer

**Reuse:** `evaluateFieldSafety`, `createEditableAdapter`, `FieldSession` identity, excluded domains.

| | |
|---|---|
| Responsibility | Build `FieldContext` for the cycle: editor tier, safety, policy snapshot, session flags. |
| Inputs | Active element, current settings policy, `FieldSession`, safety probes. |
| Outputs | `FieldContext` or a terminal `noop` (`protected_context` / `unsupported_editor`). |
| MAY | Classify editor tier; attach translation session id if any. |
| MUST NOT | Produce candidates; mutate DOM; call AI. |

### 5.3 Shared Chunk / Language Analysis Layer

**New orchestration over existing tokenize/lexicon helpers.**

| | |
|---|---|
| Responsibility | Segment the field once into `WritingChunk[]` with script mix, protected spans, and layout-suspicion flags. |
| Inputs | Field text, caret/selection, `FieldContext`, layout profile, exception list. |
| Outputs | Ordered `WritingChunk[]` covering the analyzed range. |
| MAY | Use `tokenizeText`, lexicons, and `mapLayout` as **evidence**. |
| MUST NOT | Commit fixes; send text to correction/translation APIs; invent a second segmentation per feature. |

### 5.4 Candidate Producer Layer

**Convert:** `planFieldFixes` / classifier, translation engine, correction remote + instant map — produce candidates only.

| | |
|---|---|
| Responsibility | From shared chunks, emit zero or more `CandidateAction`s with evidence and confidence. |
| Inputs | `WritingChunk[]`, `FieldContext`, user policy, optional command. |
| Outputs | `CandidateAction[]`. |
| MAY | Call remote APIs **for candidate generation** when policy and eligibility allow. |
| MUST NOT | Write DOM; show cards that apply text; acquire the write mutex for mutation. |

### 5.5 Decision Engine

**Occupies the reserved `PIPELINE` conceptual slot.**

| | |
|---|---|
| Responsibility | Apply priority, ambiguity, and session rules; emit exactly one `WritingDecision` per cycle. |
| Inputs | Candidates, chunks, context, command (if any), help-style policy. |
| Outputs | `WritingDecision`. |
| MAY | Drop or downgrade candidates to `suggestion` or `noop`. |
| MUST NOT | Write DOM; emit two actions; treat missing candidates as an error (that is `noop`). |

### 5.6 Orchestration Layer

**Evolve:** `CommandOrchestrator` becomes the only cycle runner for **both** auto ticks and commands.

| | |
|---|---|
| Responsibility | Bind observation events and commands to one analysis cycle; enforce lifecycle; call Decision Engine then Write Gate or Suggestion UI. |
| Inputs | Events, commands, policy. |
| Outputs | Cycle id; handoff to gate or UI. |
| MAY | Debounce auto ticks; coalesce bursts into one cycle. |
| MUST NOT | Let feature `.start()` handlers remain parallel writers. In `shadow` mode MUST NOT invoke Write Gate for engine decisions. |

### 5.7 Central Write Gate

**Wrap:** `writeReplacement` + `FieldSession.tryAcquireWrite` for **all** writers.

| | |
|---|---|
| Responsibility | Serialize mutation; verify generation, range, and text; tag origin; apply cooldown; emit write analytics. |
| Inputs | `WriteTransaction` derived from an accepted decision or accepted suggestion. |
| Outputs | `written` \| `stale` \| `rejected` plus analytics. |
| MAY | Restore caret per transaction policy. |
| MUST NOT | Invent a decision; write without a decision id (except documented undo of a prior transaction); run in shadow mode for new-engine actions. |

### 5.8 Suggestion UI Layer

**Reuse:** correction/layout/translation cards, Speed Box — apply only via gate.

| | |
|---|---|
| Responsibility | Present a single suggestion bound to a decision; accept/dismiss. |
| Inputs | `WritingDecision` with `action: suggestion`. |
| Outputs | Accept → Write Gate; dismiss → analytics. |
| MAY | Show reason-safe copy (no raw dumps in UI telemetry). |
| MUST NOT | Apply text except by submitting a transaction to the Write Gate. MUST NOT appear as a new surface in shadow mode. |

### 5.9 Feature Executors

**Current feature modules after migration.**

| | |
|---|---|
| Responsibility | Execute the **chosen** capability: compute replacement text (if not already on the candidate), explanations, history payload **after** gate success. |
| Inputs | Winning `CandidateAction` + `WriteTransaction` permit. |
| Outputs | Replacement string, metadata. |
| MAY | Exist as libraries called by producers and by the gate’s apply step. |
| MUST NOT | Subscribe to EventBus for writes; start independent schedulers. |

### 5.10 Settings Policy Layer

| | |
|---|---|
| Responsibility | Map stored policy to runtime `UserWritingPolicy`; sync all extension contexts including the live content script. |
| Inputs | Storage, popup/dashboard writes. |
| Outputs | Policy snapshot on `FieldContext`. |
| MAY | Keep internal flags as hidden derived state. |
| MUST NOT | Require users to set per-scheduler internals; leave content-script policy stale. |

### 5.11 Analytics / Event Layer

| | |
|---|---|
| Responsibility | Persist taxonomy-compliant events; enforce privacy (no raw text on `noop` by default; no shadow events as user activity). |
| Inputs | Decisions, gate results, suggestion outcomes, shadow comparisons. |
| Outputs | History (user-visible activity), learning events (only eligible origins), debug log (opt-in). |
| MAY | Aggregate counters. |
| MUST NOT | Classify layout as grammar; treat translated English as original writing; store `noop` raw text by default; record shadow comparisons as applied user actions. |

### 5.12 Editor Compatibility / Adapter Layer

| | |
|---|---|
| Responsibility | Declare tier and capabilities; later host editor-specific adapters. |
| Inputs | Element probe. |
| Outputs | `EditorTier` + capability bits. |
| MAY | Refuse auto-write. |
| MUST NOT | Pretend generic CE offset writes are safe for Tier 3. |

---

## 6. Shared Data Contracts

These types are the implementation contract. They MUST be introduced as real types in a later phase. They MUST NOT be implemented as part of authoring this document.

```ts
type DecisionAction =
  | 'layout_fix'
  | 'translation'
  | 'english_correction'
  | 'suggestion'
  | 'noop'

type DecisionTrigger = 'auto' | 'shortcut' | 'command_ui' | 'suggestion_accept' | 'speed_box'

type TextOrigin =
  | 'original_en'
  | 'original_ar'
  | 'original_mixed'
  | 'translated_en'
  | 'layout_mismatch_suspected'
  | 'arabizi_suspected'
  | 'unknown'

type ConfidenceClass = 'high' | 'medium' | 'low' | 'ambiguous'

type EditorTier = 1 | 2 | 3 | 4

type HelpStyle = 'auto' | 'suggestions' | 'shortcuts_only'

interface TextRange {
  start: number
  end: number
}

interface UserWritingPolicy {
  assistantEnabled: boolean
  helpStyle: HelpStyle
  fixWrongTyping: boolean
  improveEnglish: boolean
  arabicToEnglishMode: boolean
  excludedHosts: string[]
  sourceLayout: string
  targetLayouts: string[]
  translationSource: string
  translationTarget: string
  exceptionTokens: string[]
}

interface FieldContext {
  fieldId: string
  generation: number
  cycleId: string
  editorTier: EditorTier
  capabilities: {
    autoWrite: boolean
    suggestion: boolean
    manualShortcut: boolean
  }
  safetyAllowed: boolean
  safetyReason?: string
  policy: UserWritingPolicy
  composing: boolean
  translationSessionId: string | null
  hostname: string
  fieldKind: 'text' | 'textarea' | 'contenteditable' | 'unknown'
}

interface WritingChunk {
  id: string
  range: TextRange
  textHash: string
  scripts: { arabic: number; latin: number; other: number }
  origin: TextOrigin
  protectedKind:
    | null
    | 'email'
    | 'url'
    | 'code'
    | 'path'
    | 'shell'
    | 'formula'
    | 'identifier'
    | 'secret'
  layoutSuspicion: 'none' | 'en_on_ar' | 'ar_on_en' | 'shift_symbol_break'
  inExceptionList: boolean
  neighborChunkIds: string[]
}

interface Evidence {
  kind:
    | 'lexicon_ar'
    | 'lexicon_en'
    | 'physical_key_map'
    | 'shift_level'
    | 'neighbor_script'
    | 'user_command'
    | 'translation_session'
    | 'protected_span'
    | 'short_token'
    | 'policy_disabled'
  detail: string
}

interface Confidence {
  score: number
  class: ConfidenceClass
}

interface CandidateAction {
  id: string
  capability: 'layout_fix' | 'translation' | 'english_correction'
  range: TextRange
  sourceChunkIds: string[]
  proposedTextHash?: string
  confidence: Confidence
  evidence: Evidence[]
  eligibleForAuto: boolean
}

type DecisionReasonCode =
  | 'policy_assistant_off'
  | 'policy_shortcuts_only'
  | 'policy_capability_off'
  | 'protected_context'
  | 'unsupported_editor'
  | 'composing'
  | 'mutex_held'
  | 'stale_generation'
  | 'low_confidence'
  | 'ambiguous_short_token'
  | 'ambiguous_mixed'
  | 'arabizi'
  | 'out_of_lexicon_noop'
  | 'suspected_layout_blocks_grammar'
  | 'translation_session_blocks_layout'
  | 'translation_session_blocks_grammar'
  | 'translated_output_excluded'
  | 'single_winner_layout'
  | 'single_winner_translation'
  | 'single_winner_correction'
  | 'downgraded_to_suggestion'
  | 'user_command'
  | 'user_exception'
  | 'no_candidates'
  | 'shadow_observe_only'
  | 'help_style_requires_suggestion'

interface WritingDecision {
  decisionId: string
  cycleId: string
  fieldId: string
  generation: number
  action: DecisionAction
  trigger: DecisionTrigger
  winnerCandidateId: string | null
  range: TextRange | null
  confidence: Confidence
  reasonCodes: DecisionReasonCode[]
  textOrigin: TextOrigin
  suggestionPayload?: { candidateId: string; capability: CandidateAction['capability'] }
  debug: {
    chunkIds: string[]
    candidateIds: string[]
    editorTier: EditorTier
    helpStyle: HelpStyle
    translationSessionId: string | null
    engineMode: 'off' | 'shadow' | 'enforce'
  }
}

interface WriteTransaction {
  transactionId: string
  decisionId: string
  fieldId: string
  expectedGeneration: number
  requestId: number
  range: TextRange
  expectedSliceHash: string
  replacement: string
  origin:
    | 'FIX_LAYOUT'
    | 'TRANSLATE'
    | 'CORRECT'
    | 'SYSTEM'
  placeCaretAfter: boolean
  allowActiveEdit: boolean
}

interface TranslationSession {
  sessionId: string
  fieldId: string
  sourceLanguage: string
  targetLanguage: string
  range: TextRange | 'field'
  startedAt: number
  lastStableAt: number
  preserveSpans: TextRange[]
}

interface AnalyticsEvent {
  eventId: string
  name:
    | 'writing.decision'
    | 'writing.write'
    | 'writing.suggestion'
    | 'writing.shadow_compare'
  timestamp: number
  action: DecisionAction
  trigger: DecisionTrigger
  outcome:
    | 'applied'
    | 'suggested'
    | 'accepted'
    | 'dismissed'
    | 'reverted'
    | 'noop'
    | 'rejected'
    | 'shadow_only'
  reasonCodes: DecisionReasonCode[]
  textOrigin: TextOrigin
  capability?: CandidateAction['capability']
  fieldKind: FieldContext['fieldKind']
  editorTier: EditorTier
  confidenceClass: ConfidenceClass
  /** Aggregate only. MUST NOT be raw user text. */
  metrics: {
    rangeLength: number
    chunkCount: number
    candidateCount: number
  }
  shadowOnly: boolean
  /** Present only when user opted into debug logging or event is a user-visible history apply. */
  sampleRetention: 'none' | 'history_apply' | 'debug_opt_in'
}
```

**Intent vs detection (required distinction):**

| Term | Meaning | May auto-write? |
|---|---|---|
| User intent | Policy + command + translation session | Only if decision allows |
| Detected script/language | Counts on a chunk | Never by itself |
| Suspected layout mismatch | Map + lexicon + key evidence | Only `layout_fix` / suggestion per Section 10 |
| Requested command | Shortcut / UI / accept | Yes, still through Write Gate |
| Final decision | `WritingDecision.action` | Only via gate when not `noop`/`suggestion` |

---

## 7. Field Lifecycle and State Machine

### States

| State | Meaning |
|---|---|
| `idle` | No active field or no pending cycle. |
| `observing` | Field focused; collecting input. |
| `composing` | IME composition active. |
| `analyzing` | Shared chunk + candidate generation in progress. |
| `decision_pending` | Decision Engine running. |
| `suggesting` | A suggestion is visible and bound to a decision. |
| `applying` | Write Gate holds the mutex. |
| `cooldown` | Post-write quiet period; new auto cycles MUST NOT start. |
| `translation_session` | Explicit Arabic→English session active (may also be `observing`). |
| `unsupported_editor` | Tier 3/4 without capability; auto forbidden. |
| `protected_context` | Safety denied; no auto, limited or no command. |

`translation_session` is a **mode overlay**. The field MAY be `observing` + `translation_session` simultaneously. It MUST NOT be `applying` + `analyzing`.

### Allowed transitions

```
idle → observing | unsupported_editor | protected_context
observing → composing | analyzing | translation_session | idle | protected_context | unsupported_editor
composing → observing | idle
analyzing → decision_pending | observing (cancelled / stale)
decision_pending → suggesting | applying | cooldown | observing
suggesting → applying | observing | cooldown
applying → cooldown | observing
cooldown → observing | idle
translation_session → observing | analyzing | idle
```

In `engineMode: shadow`, `decision_pending` MUST transition to `observing` (log only). It MUST NOT transition to `applying` or `suggesting` for engine-originated decisions.

### Forbidden transitions

- `composing` → `applying`
- `applying` → `analyzing` (must finish or abort the transaction first)
- `protected_context` → `applying` (auto)
- `unsupported_editor` → `applying` when `autoWrite` is false
- `suggesting` → `analyzing` without dismissing or invalidating the bound decision
- Any state → `applying` without a `WritingDecision` and `WriteTransaction`

---

## 8. Decision Pipeline

Exact sequence for every auto tick and every command (command injects `trigger` and MAY inject a forced capability):

```
input event or command
  → Field Context + safety
  → if blocked: WritingDecision(action=noop) → analytics → stop
  → Shared segmentation / chunking
  → Script / language / layout analysis (evidence on chunks)
  → Protected-span detection
  → Candidate generation (only eligible producers)
  → Ambiguity / confidence evaluation
  → Feature priority / conflict resolution
  → WritingDecision (exactly one)
  → if shadow: analytics(shadow_only) → stop
  → if noop: analytics(noop) → stop
  → if suggestion: Suggestion UI
  → if auto apply: Write Gate
  → analytics(write or suggestion outcome)
```

### Where `noop` occurs (successful exits)

The cycle MUST emit `WritingDecision.action = noop` and MUST NOT write when:

- assistant disabled or paused
- help style is `shortcuts_only` and trigger is `auto`
- capability off (e.g. `fixWrongTyping` false for layout candidates)
- protected context or unsupported editor for this trigger
- composing
- mutex held / stale generation
- no candidates
- all candidates `low` / `ambiguous` and help style is not `suggestions` (or suggestions disallowed on this tier)
- isolated short token
- out-of-lexicon Arabic/English under Section 10 no-op rules
- Arabizi
- translation session blocks layout/grammar and no translation candidate is eligible
- engine is `shadow` (engine decision is logged as `shadow_only`; visible behavior is unchanged — the **legacy** path, if still enabled, is the only mutator)

`noop` is not “did nothing by accident.” It is the recorded choice.

---

## 9. Feature Priority and Conflict Rules

### Rules (highest first)

1. **Protected context / composing / mutex / unsupported auto:** `noop` (or reject command).
2. **Active Write Transaction:** new auto cycles MUST `noop` (`mutex_held`).
3. **User command** (shortcut, popup, Speed Box commit, suggestion accept): wins over auto. Still one decision. Command MAY force a capability; eligibility and safety still apply.
4. **Translation session + translation candidate:** `translation` or `suggestion`. Auto layout and auto English MUST `noop` on session ranges (`translation_session_blocks_*`).
5. **Suspected layout mismatch with high confidence:** `layout_fix` or `suggestion`. English correction MUST NOT auto-run on those chunks.
6. **Original English, eligible, high confidence, improve-English on:** `english_correction` or `suggestion`.
7. **Low / ambiguous:** `suggestion` if help style is `suggestions` and tier allows; else `noop`.
8. **Multiple high-confidence different capabilities:** MUST NOT apply two. Priority: command > translation session > layout > English. The loser is dropped (not queued on the same cycle).
9. **Help style `shortcuts_only`:** auto candidates MUST become `noop`. Commands still decide.

### Decision table

| Condition | Auto layout | Auto translate | Auto English | Result |
|---|---|---|---|---|
| Protected / composing / applying | no | no | no | `noop` |
| Shortcuts only | no | no | no | `noop` unless command |
| Translation session, unstable range | no | no (wait) | no | `noop` |
| Translation session, stable eligible chunk | no | yes / suggest | no | `translation` or `suggestion` |
| High-conf layout mismatch | yes / suggest | no | no | `layout_fix` or `suggestion` |
| Layout suspected, low conf | no | no | no | `noop` or `suggestion` |
| Original English, high conf | no | no | yes / suggest | `english_correction` or `suggestion` |
| Translated output tagged | no | no | no | `noop` |
| Arabizi / ambiguous mixed | no | no | no | `noop` |
| Isolated token ≤ 2 | no | no | no | `noop` |
| Manual translate command | no | command | no | `translation` / `suggestion` / `noop` |
| Suggestion accept | — | — | — | Write Gate only |
| Shadow mode (engine) | engine: no | engine: no | engine: no | log `shadow_only`; legacy writer unchanged |

---

## 10. Bilingual Ambiguity Policy

Language detection alone MUST NOT decide. A chunk that is “mostly Arabic” is not a translate request. A Latin token is not automatically English to correct.

| Scenario | Default decision | Auto allowed? | Notes |
|---|---|---|---|
| Pure Arabic, no session | `noop` | Layout only if **high-conf mismatch**; never grammar; never translate | In-lexicon Arabic (`في`, `من`, `لا`, …) MUST be `noop` for layout |
| Pure original English | English per policy | Yes if eligible | Instant-spell maps are candidates, not writers |
| Arabic on English keys | `layout_fix` or `suggestion` | Yes if high conf and length ≥ 3 or (≤ 2 **and** neighbor Arabic evidence **and** help style allows suggestion only for ≤ 2) | Isolated ≤ 2 MUST `noop` |
| English on Arabic keys | `layout_fix` or `suggestion` | Yes if reverse map is English lexicon **and** token is **not** in-lexicon Arabic | Out-of-lexicon Arabic MUST `noop`, not reverse-map |
| Mixed intentional | `noop` unless one chunk is high-conf mismatch | Per chunk, never whole-field | English terms in Arabic stay if lexicon/exception/identifier |
| Arabic + English technical terms | `noop` on terms | Terms: ignore | `ALL_CAPS` / camelCase / known tech tokens are protected spans |
| English + Arabic names | `noop` on names | Grammar MUST NOT “fix” names | Suggestion MAY if user command |
| Short ambiguous tokens | `noop` | Never auto | Suggestion only with neighbor evidence |
| Arabizi | `noop` | Never auto layout/grammar/translate | Manual command MAY still be offered as explicit convert/translate |
| User exceptions | `noop` for that token | Never auto | Exceptions MUST survive layout-pair edits |
| Unknown Arabic (out of lexicon) | `noop` | MUST NOT reverse-map to English | Manual layout command MAY convert with confirmation |
| Unknown English (out of lexicon) | `noop` for layout | Grammar only if chunk origin is `original_en` and not layout-suspected | Brand/name collisions MUST NOT auto-remap to Arabic |

**Correct result is `noop` when:** any row above says so; confidence is not `high` for auto; two interpretations remain plausible; evidence conflicts (symbol map vs language); the only evidence is a closed-list miss.

---

## 11. Shift, Uppercase, Symbol, and Physical-Key Policy

### Ownership

- **Physical-key mapping** remains in layout tables (`mapLayout` / `mapLayoutText`). The layout candidate producer MUST use key id + level (`unshifted` | `shifted` | `altGr`).
- The Decision Engine MUST receive shift-level evidence when `keydown` observed `shiftKey` in the same token burst. Absence of key-state MUST lower confidence (character-only remap is weaker).

### Policies

| Topic | Rule |
|---|---|
| Shifted / unshifted | Remap MUST keep the **same key level**. Latin uppercase is not “capital Arabic.” |
| Uppercase | Intended Latin case on a Latin target MUST preserve case. Arabic target has no case; Shift means the Arabic shift layer (diacritics, ligatures, `÷` `×`). Auto MUST NOT assume the user wanted the unshifted Arabic letter if the glyph is a known shifted output. |
| Punctuation / symbols | Tokenizer MUST NOT split tokens on glyphs that are Arabic-101 **letters or shift letters** (`]`, `;`, `` ` ``, `÷`, `×` when they are layout outputs). Current `LAYOUT_SYMBOL_BREAK` behavior is non-compliant for auto layout. |
| Shift + wrong layout | If shift glyphs break or mix with letters, confidence MUST be `ambiguous` unless the full raw sequence maps to a high-conf lexicon word. Default: `suggestion` or `noop`. |
| Caps Lock | Not observable reliably. MUST NOT be assumed. Lowers confidence. |
| Dead keys / AltGr | Supported only when tables have `altGr`. Incomplete sequences MUST `noop`. |
| Symbol-sensitive text | Formulas, operators, paths, shell: protected spans; auto ignore; manual convert only on explicit command. |
| Auto vs manual convert | **Auto** is lexicon- and confidence-gated. **Manual** (shortcut / Speed Box) MAY remap every matched key, including symbols, because the user requested conversion. Manual still goes through Write Gate and safety. |

---

## 12. Translation Session Policy

### Begin

A translation session MUST start only by explicit user action:

- policy `arabicToEnglishMode` turned on, **or**
- translation shortcut / command / Speed Box translate.

Turning on live translation in today’s settings is **not** a session until it is mapped to `arabicToEnglishMode` (Section 16). Default today (`liveEnabled: false`) remains off until policy says otherwise.

### End

Session ends when: user turns the mode off; field blur after cooldown; explicit cancel; or field identity is lost. Ending MUST clear `translated_output` tagging only for **new** typing; already-written English remains tagged until the user edits that span substantially (hash change of the tagged range).

### Languages

Session uses `translationSource` / `translationTarget` from policy (default `ar` → `en`). Same-language MUST `noop`.

### Range

Prefer last **stable** sentence (terminal punctuation or explicit Enter). MUST NOT translate the whole unfinished paragraph on pause. Unstable / no boundary: `noop` (or suggestion if help style is `suggestions`).

### Stability timing

A chunk is stable when composing is false and no user input for the policy debounce (existing 750ms MAY be reused) **and** a sentence/Enter boundary exists. Pause alone is insufficient.

### Technical terms

Spans tagged identifier/url/code/exception MUST be listed in `preserveSpans`. The translator SHOULD receive them as do-not-translate; if the model rewrites them, Write Gate MUST still be able to restore preserved slices if the executor supplies a preserve plan. If preserve cannot be guaranteed, decision MUST be `suggestion` or `noop`.

### Write vs suggest

Help style `auto` + high confidence + Tier 1: MAY auto-write. Otherwise suggestion or command-only. Shadow: never write from engine.

### During session

- Auto layout MUST NOT run on session ranges.
- Auto English MUST NOT run on session ranges or on `translated_output`.
- Manual layout/correct commands MAY run if the user issues them (user intent).

### Output tagging

Successful translation MUST mark the written range `origin: translated_en` in field overlay state (in-memory per `FieldSession`, not necessarily persisted text).

### Cancel / undo

Write Gate MUST retain the last transaction per field for revert. Session cancel MUST NOT silently revert already-applied translations unless the user invokes undo.

---

## 13. English Correction Policy

### Eligible original English

A chunk is eligible only if **all** are true:

- `origin === original_en`
- not `layoutSuspicion` other than `none`
- not protected
- not Arabizi
- not `ambiguous_mixed`
- `improveEnglish` policy on
- consent/AI readiness still required for remote AI (existing product gate)
- length/word floors: reuse existing `CORRECTION_DEFAULTS` as minimums; below floor → `noop` (not UI-only “maybe”)

Instant-spell dictionary entries are **candidates** with their own confidence. Tokens that are also plausible layout mismatches MUST be withheld from instant-spell (`suspected_layout_blocks_grammar`).

### Boundaries

Light spelling / grammar / wording only. MUST NOT rewrite meaning, MUST NOT translate, MUST NOT layout-remap.

### Direct vs suggestion

| Help style | High conf | Medium | Low |
|---|---|---|---|
| `auto` | MAY auto on Tier 1 | `suggestion` | `noop` |
| `suggestions` | `suggestion` | `suggestion` | `noop` |
| `shortcuts_only` | command only | command only | `noop` |

### Exclusions (MUST NOT auto)

Wrong-layout candidates; `translated_en`; Arabizi; mixed ambiguous; protected; names/technical/code tokens; short phrases below floors.

### Names and terms

No automatic “correction” of tokens tagged identifier, exception, or non-English script names inside an English chunk. MAY suggest only on explicit command.

---

## 14. Central Write Gate and Transaction Rules

1. **One mutex per field** for automatic and manual writers. Layout auto MUST acquire the same `tryAcquireWrite` path. Missing `requestId` writes are forbidden.
2. **Stale checks:** `expectedGeneration` and `requestId` MUST match `FieldSession`. Mismatch → reject, no write.
3. **Range verify:** current slice MUST match `expectedSliceHash` (or exact original slice). Mismatch → reject.
4. **Caret:** default `placeCaretAfter` for replacements that grow/shrink the active token; commands MAY specify. CE Tier 2 MUST refuse if caret cannot be mapped.
5. **Origin tag:** transaction `origin` MUST be `FIX_LAYOUT` | `TRANSLATE` | `CORRECT` | `SYSTEM` (undo). Controlled write origin MUST suppress user-generation bump (existing `withWriteOrigin`).
6. **Cooldown:** after `written`, field enters `cooldown` for a bounded interval; auto cycles MUST `noop`.
7. **Undo / revert:** gate MUST keep last successful transaction (original slice + range) to revert via a new transaction referencing the prior `decisionId`. Feature modules MUST NOT implement a second undo writer.
8. **One mutation per decision.** No multi-range apply in one transaction. Multiple tokens require multiple cycles or a single contiguous range owned by one candidate.
9. **No direct feature writes.** Code review acceptance: zero `writeReplacement` call sites outside the Write Gate module.

Shadow mode: the Write Gate MUST reject engine-originated transactions (`shadow_observe_only`). Legacy writers, until removed, remain the sole mutators and MUST NOT be duplicated by the engine.

---

## 15. Editor Compatibility Policy

| Tier | Definition | Auto write | Suggestion | Manual shortcut |
|---|---|---|---|---|
| 1 | `input[type=text]` / `textarea` passing safety | Allowed if policy and decision allow | Allowed | Allowed |
| 2 | Simple single-text-node contenteditable, no custom input pipeline | **MUST NOT** auto-write in v1 of the engine | Allowed if caret map succeeds | Allowed if write verify succeeds; else `noop` |
| 3 | Complex editors (React/Slate/ProseMirror/Lexical/Monaco/iframe apps) | MUST NOT | MUST NOT until an adapter exists | MUST NOT via generic offsets |
| 4 | Protected / password / OTP / email field / code editor / excluded host | MUST NOT | MUST NOT | MUST NOT (safety may allow a documented exception later; default no) |

v1 engine enablement: **Tier 1 only** for auto. Tier 2 suggestion/manual is optional and MUST fail closed. Tier 3 waits for adapters. Generic CE `deleteContents` auto-write is non-compliant.

---

## 16. Settings Policy and Simplified User Model

### Visible policy (primary UI)

| Control | Maps to |
|---|---|
| Assistant on/off | `assistantEnabled` (+ existing pause) |
| Help style: Auto / Suggestions / Shortcuts only | `helpStyle` |
| Fix wrong typing | `fixWrongTyping` |
| Improve English | `improveEnglish` (still requires consent for AI) |
| Arabic → English mode | `arabicToEnglishMode` (creates/ends translation session) |
| Shortcuts | chrome.commands + labels (not separate “feature enabled” for translate vs layout) |
| Sites to exclude | `excludedHosts` |
| Privacy and learning | existing data/learning consent surfaces |
| Advanced / debug | engine mode, decision log, exception list |

### Hidden / derived (MUST NOT be primary)

- `layout.autoEnabled`, `directShortcutEnabled`, `manualConversionEnabled` as separate user concepts
- Per-feature box vs direct triplicates (derived from `helpStyle`)
- `translation.shortcutEnabled` vs `liveEnabled` split
- Debounce ms, classifier cache, mutex internals
- Remote vs local classifier

### Operating states (user language)

| User language | Internal mapping |
|---|---|
| **Normal** | No `TranslationSession`. `helpStyle` is `auto` or `suggestions`. Layout and light English MAY run. |
| **Translation** | Sticky `arabicToEnglishMode` creates/keeps a `TranslationSession`. Translate first; optional light English polish only on tagged `translated_output` after cooldown. |
| **Manual** | `helpStyle: shortcuts_only`. Auto cycles MUST `noop`. Shortcuts and suggestion-accept remain. |

Field lifecycle names stay `observing` / `analyzing` / `suggesting` / `applying` / `cooldown` (Section 7). Do not rename them in code for marketing copy.

### Defaults (product-locked, Wave A)

- Assistant on
- **Enforce cutover:** do **not** force existing users onto `shortcuts_only` if they already have layout auto on. Preserve their derived/persisted `helpStyle`. Layout remains the most automatic capability.
- **New installs:** onboarding asks three questions (see [unified-writing-assistant-user-flow.md](./unified-writing-assistant-user-flow.md)). Recommended defaults: layout auto **on**, English **light auto + suggestion**, `arabicToEnglishMode` **off**.
- Fix wrong typing: on
- Improve English: on, consent still required
- Arabic → English mode: off until the user enables it. `liveEnabled` MUST NOT start a session by script detection or pause-on-Arabic. Map `liveEnabled` → `arabicToEnglishMode` only when a `TranslationSession` exists.
- Exceptions: persist across layout-pair changes

### Runtime sync

Any policy write MUST update:

1. `chrome.storage`
2. service worker `stateManager`
3. **live content-script** `stateManager` via `storage.onChanged` (all policy keys, not only `authAccountId`)

A tab MUST apply the new policy on the next observation cycle without reload.

---

## 17. Analytics and Decision Observability

### Event taxonomy

| `name` | When |
|---|---|
| `writing.decision` | Every Decision Engine output, including `noop` and shadow |
| `writing.write` | Write Gate result |
| `writing.suggestion` | shown / accepted / dismissed |
| `writing.shadow_compare` | Old vs new action comparison |

### Required fields

Every event MUST include: `action`, `trigger`, `outcome`, `reasonCodes`, `textOrigin`, `editorTier`, `confidenceClass`, `metrics` (lengths/counts only), `shadowOnly`.

### Distinctions (MUST)

- `textOrigin: original_en` vs `translated_en` vs `layout_mismatch_suspected`
- `trigger: auto` vs `shortcut` vs `suggestion_accept`
- `outcome: applied` vs `noop` vs `shadow_only`
- Layout capability MUST NOT appear as grammar learning
- Auto layout, when applied by the **legacy** path during migration, MUST still be tagged `capability: layout_fix` and `trigger: auto` if recorded — never as `english_correction`

### `noop` observability

- `noop` MUST be a first-class `writing.decision` with `outcome: noop`.
- Meaningful noops (ambiguity, policy block, session block, grammar exclusion, short token, protected, unsupported editor) MUST be logged.
- Payload MUST be reason codes + aggregate metadata only (`rangeLength`, `chunkCount`, `candidateCount`, hostname bucket optional).
- Raw user text, exact tokens, and field contents MUST NOT be stored for `noop` by default (`sampleRetention: none`).
- Debug opt-in MAY attach a hash-only sample, never the raw string, unless a separate debug flag explicitly allows it (off by default).

### Shadow comparison

- `writing.shadow_compare` MUST set `shadowOnly: true` and `outcome: shadow_only`.
- MAY include old-path action enum vs new-path action enum and reason codes.
- MUST NOT include raw text by default.
- MUST NOT be ingested as user-visible history or learning progress.
- MUST NOT trigger a write.

### Privacy limits

User-visible history MAY store source/result text only for **applied** user-visible operations, subject to existing history length caps. Learning events MAY record original/corrected **pairs** only for `original_en` or manual layout accepts — never for `translated_en` auto output, never for shadow, never for default `noop`.

### Debug decision log (opt-in)

```
cycleId | fieldId | generation | action | reasonCodes | candidateIds | editorTier | engineMode
```

No raw field text unless debug flag is on.

---

## 18. Migration Strategy

No big-bang rewrite.

### Preserve

- `InputEngine`, `EventBus`, `FieldSession`, safety, `mapLayout` tables, command plumbing, cards, Speed Box.

### Move

- Feature modules: EventBus **writers** → candidate **producers**.
- All `writeReplacement` call sites → Write Gate.
- `CommandOrchestrator` + reserved `PIPELINE` → cycle runner + Decision Engine.

### Engine modes

| Mode | New engine | Writes |
|---|---|---|
| `off` | Not constructed | Legacy only |
| `shadow` | Observes every cycle; logs `writing.decision` + `writing.shadow_compare` | **Legacy only**. Engine MUST NOT write, MUST NOT show new UI, MUST NOT start a second scheduler that writes |
| `enforce` | Sole decision path | Write Gate only; legacy auto schedulers MUST be disabled |

### Shadow-mode safety (normative)

- Shadow MAY compare old vs new decisions and log.
- Shadow MUST NOT introduce a second automatic writer.
- Shadow MUST NOT alter visible user behavior (no extra cards, no extra preventDefault, no extra mutations).
- Every comparison event MUST be tagged `shadow_only`.
- No two paths MAY mutate the same field/range during shadow mode. If a defect would cause the engine to write, that write MUST be refused by the Write Gate.

### Rollout

1. Feature flag `engineMode` (storage, hidden/advanced).
2. Shadow on internal builds; compare reason-code distributions.
3. Write Gate wrap of **existing** single-writer calls (still one writer).
4. Enforce on **Tier 1** only; layout first; then translation session; then English.
5. Delay broad contenteditable.
6. Remove legacy schedulers only after enforce acceptance criteria pass.

---

## 19. Future Implementation Phases

### Phase 1 — Foundation hardening

- **Objective:** Mutex for all current writers; content-script policy sync; stop exception wipe; no dual writers later.
- **Likely areas:** `FieldSession`, `fixCurrentText` / `LayoutScheduler`, `accountBootstrap.ts`, `background/index.ts` `SET_LAYOUT`, `writeReplacement`.
- **Risks:** Timing changes if layout suddenly blocks behind correction.
- **Validation:** Tests that auto layout acquires mutex; settings change hydrates CS without reload (unit + integration).
- **Done when:** No write without mutex; policy sync works; exceptions persist.

### Phase 2 — Central decision engine in shadow mode

- **Objective:** Types + Decision Engine + orchestrated cycle; **observe/log only**.
- **Likely areas:** new engine modules (when implementation is approved), `CommandOrchestrator`, `content_script.ts` wiring behind `engineMode`.
- **Risks:** Accidental second writer; EventBus double-handling; performance.
- **Validation:** Shadow fixtures: engine emits decisions; Write Gate rejects engine transactions; no DOM change vs legacy-only control; events `shadow_only`.
- **Done when:** Shadow runs on Tier 1 fixtures; visible behavior unchanged; noop + compare events privacy-safe.

### Phase 3 — Layout migration and accuracy guards

- **Objective:** Layout producer + bilingual/short-token/shift tokenizer policy; enforce layout via gate on Tier 1.
- **Likely areas:** `heuristics.ts`, `sentence.ts`, `tokenize.ts`, `LayoutScheduler` removal as writer.
- **Risks:** Golden-test drift; `i,` / `td` regressions.
- **Validation:** Existing layout goldens + mixed-language tests + new isolated short-token and Shift cases; no auto ≤ 2 isolated.
- **Done when:** Layout auto only through decision + gate; out-of-lexicon Arabic is `noop`.

### Phase 4 — Translation / correction integration

- **Objective:** Translation sessions; grammar exclusions; shared chunks; no live whole-paragraph translate.
- **Likely areas:** `TranslationScheduler`, `liveTranslate.ts`, `CorrectionScheduler`, `language.ts`, `instantSpell.ts`.
- **Risks:** Product change vs current live-on-pause; AI eligibility.
- **Validation:** Session blocks layout/grammar; translated ranges tagged; instant-spell withheld on layout-suspicion; sentence-boundary required.
- **Done when:** Priority table holds on integration tests.

### Phase 5 — Settings, analytics, UX, test hardening

- **Objective:** Policy UI; taxonomy; editor-tier surfacing; bilingual scenario suite.
- **Likely areas:** popup/dashboard settings, `domainState.ts`, history/learning ingest, tests.
- **Risks:** Settings mapping bugs; learning dashboard emptiness after exclusions (correct).
- **Validation:** Live tab policy; events distinguish origins; Tier 3 never auto-writes.
- **Done when:** Section 20 criteria pass.

---

## 20. Acceptance Criteria

The architecture is accepted for enforce mode only when all are true:

1. No direct auto write from feature schedulers (static: no `writeReplacement` outside Write Gate).
2. One `WritingDecision` per action cycle.
3. One `WriteTransaction` per mutation; mutex always held.
4. Isolated short tokens and listed bilingual ambiguities produce `noop` or `suggestion`, never auto.
5. Automatic grammar never runs on `layout_mismatch_suspected`, Arabizi, `translated_en`, protected, or `ambiguous_mixed`.
6. Active translation session: no auto layout and no auto grammar on session ranges.
7. Settings updates apply in a live tab without reload.
8. Analytics distinguish `textOrigin`, trigger, action, and outcome; `noop` logged with reason codes and no raw text by default; shadow events are `shadow_only` and non-mutating.
9. Editor tiers are explicit; Tier 3/4 auto-write is zero.
10. Scenario suite covers: pure AR, pure EN, AR-on-EN, EN-on-AR, mixed, technical terms, names, short tokens, Arabizi, translation session, shortcut vs auto, Shift/symbol, protected text, Tier 1 vs CE.
11. Shadow mode never mutates and never runs two writers on one range.

---

## 21. Open Questions and Explicit Limitations

### Locked (Wave A product ratification)

1. **Enforce-mode default help style** — do **not** force first enforce users onto `shortcuts_only` if they already have layout auto on. Layout stays the most automatic capability. New-install defaults: layout auto on, English light auto + suggestion, translation mode off.
2. **Arabic→English mode UX** — sticky **Translation Mode** while `arabicToEnglishMode` is on, plus a strong shortcut. Never start from script detection or a 750ms Arabic pause. Map `liveEnabled` to `arabicToEnglishMode` only after a `TranslationSession` object exists.
3. **Speed Box manual convert** — remains fully key-mapped (ungated by lexicon). Speed Box is a manual overlay, not a second auto brain.

### Still unresolved

1. **Tier 2 CE** — whether suggestion-only ships with translation/correction integration or waits entirely for adapters.
2. **Caps Lock / OS layout** — remain unknown; no implementation may claim to detect them.
3. **Instant-spell list** — which entries are too aggressive (`fo`, `ot`, `im`) for even candidate status.
4. **Learning dashboard** — after excluding translated and auto-layout-from-learning, metrics will drop; product must accept that as honesty.
5. **Remote layout classifier** — keep as candidate evidence only; whether to call it at all under `shortcuts_only`.
6. **Undo stack depth** — spec requires last transaction only; longer undo is out of scope.
7. **Website lab** — not bound by this engine until a later decision.

**Limitations (accepted):** Chrome cannot reliably read OS keyboard layout. Contenteditable will remain capability-limited. Closed lexicons will remain incomplete; the required behavior for incompleteness is `noop`, not creative remap.

---

*End of contract. Implementation starts only after explicit approval of an implementation phase.*
