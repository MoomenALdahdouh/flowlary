# Final Product Gap Audit

**Date:** 2026-08-31  
**Sources:** current code, `PRODUCTION_HARDENING_REPORT.md`, Chrome E2E from the hardening phase. Provider architecture is out of scope.

## User journey (actual)

```
Load unpacked extension/dist
  → content script starts in enforce mode (no toggle wall)
  → popup: First Win (3 questions) if firstWin.completed is false
  → skip currently marks complete without applying those answers
  → user types in input/textarea
  → local analysis → Write Gate → DOM write (no visible “what changed”)
  → Ctrl/⌘Z often cannot undo (value set via setter, not setRangeText)
  → popup Home: status + three quick actions + three feature toggles
  → dashboard Settings: writing / languages / learning / data / privacy
```

## Issues with evidence

| ID | Sev | Evidence | Issue |
|----|-----|----------|-------|
| G1 | P1 | `write.ts` `setNativeValue` + full `value` replace | Auto-writes are not on the browser undo stack. User cannot reliably undo a silent correction. |
| G2 | P1 | `writeGate.ts` records analytics only; no in-page status | After a successful write the user sees text change with no “Flowlary fixed typing” cue. Invisible value → uninstall. |
| G3 | P1 | `App.tsx` `onSkip` → `completeFirstWin({})` | Skip does not apply First Win defaults. User can leave First Win without an explicit policy save. |
| G4 | P2 | `FirstWinView.tsx` has no demo; `handleTryLayout` unused | First open is a questionnaire, not a demonstration of value. |
| G5 | P2 | `HomeView.tsx` still presents three tools | Popup still reads as Correction / Translate / Layout rather than one assistant. |
| G6 | P2 | Hardening E2E did not open popup/settings | First-run and settings were unverified in Chrome. |
| G7 | P3 | Contenteditable auto-write blocked by design | Gmail/Notion remain suggestion/shortcut only. |
| G8 | P3 | OpenRouter not live-tested; fallback flag off | Explicit rollout decisions, not product blockers for this phase. |

No P0 found in the current writing path (hardening already closed URL corruption and example-key leakage).
