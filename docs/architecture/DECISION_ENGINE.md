# Decision engine

File: `extension/src/core/engine/decide.ts`  
Function: `decideWriting(context, analysis, candidates, options) → WritingDecision`

A **decision** is not a hypothesis and not a write. It is one of: `layout_fix`, `english_correction`, `translation`, `suggestion`, `noop`.

```mermaid
flowchart TD
  C[Candidates + hypotheses] --> G{editorTier greater than 2?}
  G -->|yes| N[noop unsupported_editor]
  G -->|no| P{policy / shortcuts_only?}
  P -->|shortcuts| N2[noop]
  P -->|ok| L{unique strong layout?}
  L -->|yes auto| W1[layout_fix]
  L -->|mixed intent| N3[noop or suggestion]
  L -->|no| T{translation hyp + session?}
  T -->|yes| W2[translation]
  T -->|no| E{fix_english with replacement?}
  E -->|mixed not island| N4[noop]
  E -->|low risk auto| W3[english_correction]
  E -->|else| S[suggestion]
```

## Distinctions

| Term | Meaning |
| --- | --- |
| Hypothesis | Span-level proposal with evidence, risk, optional replacement |
| Candidate | Action-shaped view of a hypothesis (`candidatesFromHypotheses`) |
| Decision | Single chosen action + reason codes + winner ids |
| Fulfillment | `fulfillWritingDecision` — suggestion UI or Write Gate |
| Write | `commitWriteTransaction` only |

## Invariants

- `noop` is success (intentional abstain), not a crash.
- Language detection is **evidence**, not intent.
- Advisor vote may reorder among **existing IDs** only. Invalid advisor → ignore.
- Late advisor apply: **suggestion only**.
- Strong overlapping layout beats English on the same span.
- Arabizi / ambiguous mixed / protected / open token → English auto-write forbidden.
- Translated English is not grammar-polished unless `polishAfterTranslate`.

## Failure

The function does not throw for normal uncertainty. It returns `noop` with reason codes (`ambiguous_mixed`, `stale` is a cycle outcome, not decide).

## Related

Hypothesis generation: [HYPOTHESIS_SYSTEM.md](./HYPOTHESIS_SYSTEM.md). Policy gates: [POLICY_AND_SETTINGS.md](./POLICY_AND_SETTINGS.md).
