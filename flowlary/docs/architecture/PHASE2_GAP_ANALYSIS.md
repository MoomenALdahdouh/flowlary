# Phase 2 Gap Analysis

**Date:** 25 Aug 2026  
**Scope:** Audit of Phase 1 foundation vs FL0 audit requirements, before Phase 2 implementation.

---

## 1. DOM Layer Gaps

| Area | Phase 1 state | Gap | Risk if unaddressed |
|------|---------------|-----|---------------------|
| Unified API | Functions scattered (`readFieldText`, `commitReplacement`) | No canonical `readText` / `writeReplacement` / `verifySnapshot` facade | Features will import inconsistently |
| Dual generation | DOM `WeakMap` + `FieldSession.generation` bump independently in InputEngine | Desync between stale checks | AI writes pass DOM verify but fail session verify (or vice versa) |
| Selection restore | Caret restored on write; no standalone `restoreSelection()` | Cannot reapply selection after failed write | UX regression in contenteditable |
| Rich contenteditable | Basic text node replace only | Nested elements partially tested; no `<b>`/`<span>` selection tests | Gmail-like editors may break |
| Full-field replace | Range-based only | No explicit "replace selection" / "replace all" helpers | Features duplicate range math |
| EWA code editors | Not in Flowlary | Monaco/CodeMirror not blocked at adapter layer | Auto-assist in code editors |
| Rapid sequential writes | Not tested | Unknown behavior under burst programmatic writes | Race in Phase 4–7 |
| `selectionDirection` | Not read | Low priority for Phase 2 | Minor caret edge cases |

---

## 2. FieldSession Gaps

| Area | Phase 1 state | Gap | Risk |
|------|---------------|-----|------|
| Mutex | `beginOperation` aborts prior but allows sequential acquire | No explicit reject when mutex held; no `tryAcquireWrite` | Concurrent CORRECT + TRANSLATE both acquire |
| Request sequence | `isStale` checks `requestId < requestSequence` | Not wired to commit path | Old request overwrites new |
| AbortController | Created on `beginOperation` | No test for post-abort commit; no `signal.aborted` gate on commit | Aborted ops still write |
| Composition | `setComposing` exists | No commit block during composition | IME corruption |
| lastWriter | `OperationType` only | Missing `SYSTEM`; no diagnostic separation | Ambiguous audit trail |
| DOM sync | Session bumps without updating DOM map | Generation mismatch | Stale detection false negatives |
| Commit gate | No `canCommit()` helper | Features must reimplement rules | Inconsistent stale handling |

---

## 3. InputEngine Gaps

| Area | Phase 1 state | Gap | Risk |
|------|---------------|-----|------|
| Programmatic input | `bumpGeneration` skips `insertReplacementText` in DOM only | Session still bumps on every `input` event | Infinite loop when features write |
| WriteOrigin | Not present | Cannot distinguish USER vs FLOWLARY writes | Phase 3 loop risk |
| Double bump | Both DOM and session increment on user input | Redundant; can desync if one path skipped | Generation drift |

---

## 4. Safety Gaps

| Area | Phase 1 state | Gap | Risk |
|------|---------------|-----|------|
| tokenKind | Partial (subset of Lingo) | Missing env-secret, shell, code-identifier, private-key patterns | Secrets sent to AI |
| markdown | Simple fence open count | Lingo inline backtick parity not ported | Code in prose modified |
| tokenize | Missing | No tokenizer for future layout/translation boundaries | Phase 4+ retest burden |
| Code editor probe | Missing | EWA `looksLikeCodeEditor` not ported | Code regions assisted |
| Domain exclusion | Basic match | `notexample.com` vs `example.com` not tested | False exclusions |
| Username field | In fields.ts | Not in Phase 1 tests | Regression unnoticed |
| cardNumber/cc-number | Partial | name-based payment fields need tests | Payment data leakage |

---

## 5. FL0 Audit Alignment

| FL0 requirement | Phase 1 | Phase 2 action |
|-------------------|---------|----------------|
| Single content engine | ✅ | Keep; add WriteOrigin only |
| FieldSession mutex | Partial | Harden acquire/release |
| Stale before write | DOM verify only | Add session + snapshot verify |
| Safety stricter than EWA | Partial | Port full Lingo/Layfix token + field tests |
| No feature AI | ✅ | Maintain |
| Cache isolation | ✅ | No change |
| iframe policy | ✅ | No change |

---

## 6. Duplicated Logic

- Generation tracking in both `write.ts` WeakMap and `FieldSession` — **consolidate via `generation.ts` sync helper**.
- `isEditableElement` vs future `EditableAdapter` — **adapter wraps read/write; detection stays in read.ts**.
- Safety field skip vs `isValueEditable` type filter — **intentional defense in depth; document both layers**.

---

## 7. Assumptions That May Fail When Features Land

1. **Word-range replacement only** — translation may need paragraph ranges (Phase 5); facade must accept arbitrary start/end.
2. **Single active element in InputEngine** — shortcut paths may target non-focused field (Phase 3); registry already supports multiple sessions.
3. **Stub handlers return immediately** — real async AI will expose abort/stale race; mutex must be in place first.
4. **Timestamp in snapshot** — must not be used for stale decisions (generation authoritative).

---

## 8. Phase 2 Implementation Plan (from gaps)

1. Add `WriteOrigin` + `withWriteOrigin()` + InputEngine programmatic detection.
2. Add `generation.ts` to sync FieldSession ↔ DOM WeakMap on user input only.
3. Add `editor.ts` unified DOM facade + `writeReplacement()` with session commit gate.
4. Harden `FieldSession`: `tryAcquireWrite`, `releaseWrite`, `canCommit`, composition block.
5. Add `EditableAdapter` with EWA edge cases (password, code editor, contenteditable host).
6. Port full `tokenKind`, `markdown`, `tokenize`, code editor probe; expand safety tests.
7. Port characterization tests from EWA/Lingo/Layfix sources.
8. Add 8 integration tests specified in Phase 2 spec.

---

*This document was created before Phase 2 implementation began.*
