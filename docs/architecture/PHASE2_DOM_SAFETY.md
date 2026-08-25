# Phase 2 — DOM, Safety, and FieldSession

## 1. DOM Model

Single abstraction in `extension/src/core/dom/`:

- **Value fields:** `<textarea>`, `<input type="text">` via native value + `selectionStart/End`
- **Contenteditable:** text-node walk + `Range`/`Selection` offset mapping
- **Adapter layer:** `EditableAdapter` for field detection (EWA edge cases)

No feature-specific DOM modules.

## 2. Snapshot Model

```typescript
FieldSnapshot {
  element, kind, text, caret, selection, generation, timestamp
}
```

- Created via `createSnapshot(element, generation)`
- `generation` comes from `FieldSession` (authoritative), synced to DOM WeakMap via `generation.ts`
- `timestamp` is diagnostic only

## 3. Stale Detection

Before any write:

1. `verifySnapshot()` / `verifyFieldSnapshot()` — text + generation match
2. `FieldSession.canCommit()` — generation, request sequence, composing, abort
3. `verifyReplacement()` — range slice still matches (word-level writes)
4. Optional `baselineSnapshot` on `writeReplacement()` — reject if field changed since operation started

Returns `stale` — never writes.

## 4. Write Protection

```
writeReplacement(element, start, end, text, options)
  → session composing? reject
  → session stale/aborted/mutex? reject
  → baselineSnapshot mismatch? stale
  → verifyReplacement + commitReplacement(with WriteOrigin)
```

`commitReplacement` dispatches `insertReplacementText` for value fields; contenteditable uses surgical range replace.

## 5. FieldSession Lifecycle

```
User input → bumpUserGeneration (session + DOM)
User input → session.noteInput()

Feature start → tryAcquireWrite(operation)
  → fail if composing or mutex held
  → returns { requestId, generation, signal }

Feature complete → writeReplacement(..., { session, requestId, expectedGeneration })
  → success → noteWrite(lastWriter, requestId, snapshot)
  → releaseWrite

Superseded → abortActiveRequest() → abort signal + invalidate requestId
```

## 6. Safety Decision Flow

```
evaluateFieldSafety(element, context)
  1. excluded domain? → block
  2. code editor (Monaco/etc.)? → block
  3. field probe (password, OTP, payment, …)? → block
  4. inside markdown code fence? → block
  5. token pattern (JWT, API key, …)? → block
  6. else → allow
```

## 7. Programmatic Write Protection

| Mechanism | Location |
|-----------|----------|
| `WriteOrigin` + `withWriteOrigin()` | `writeOrigin.ts` |
| Skip generation on `insertReplacementText` | `InputEngine.onInput` |
| Skip DOM bump during controlled write | `writeOrigin.shouldIgnoreInputForGeneration` |
| `bumpUserGeneration` only on user input | `generation.ts` + `InputEngine` |

InputEngine is **not** wired to CommandRouter (Phase 3).

## 8. Test Mapping

See `TEST_MIGRATION.md` Phase 2 completed section and `tests/characterization/`, `tests/integration/phase2.test.ts`.
