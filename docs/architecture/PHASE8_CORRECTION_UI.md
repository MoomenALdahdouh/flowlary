# Phase 8 — CorrectionCard + Direct-Edit Integration

## Overview

Phase 8 completes the user-facing correction layer on top of the Phase 7 Groq/BYOK pipeline. All writes still pass through `writeReplacement()` with `WriteOrigin.CORRECT`.

```
InputEngine → EventBus → CorrectionScheduler
  → runCorrectionRequest → CorrectionAI
  → CorrectionResult → CorrectionCard (box mode)
  → accept/dismiss → commitMergedCorrection → writeReplacement

Direct mode:
  InputEngine → CorrectionScheduler → runCorrectionRequest
  → stale verification → commitMergedCorrection → writeReplacement
```

## CorrectionCard

- Shadow DOM host: `[data-flowlary-correction-host]`
- One card per field via scheduler `fieldStates` map
- Lifecycle: hidden → idle/analyzing → ready → accepted/dismissed/stale → removed
- Ported from EWA with Flowlary CSS variables (`--flowlary-*`)
- Dismiss button + Escape (EWA had apply-only; dismiss added per Phase 8 spec)
- Enter/Space accept when card row is focused

## Stale handling

Each ready suggestion binds:

- `remoteRequestId`, `debouncerGeneration`, `fieldGeneration`
- `segment`, `requestedFullText`, full `CorrectionResponse`

Stale when:

- User edits text (`fullText !== requestedFullText`)
- Debouncer generation changes
- Field generation changes
- Merge is no longer safe

Stale cards are hidden; accept re-verifies before write.

## Accept / dismiss

**Accept**

1. Re-check safety, generation, request binding, merge viability
2. Acquire mutex (or reuse orchestrator lock)
3. `writeReplacement(..., { origin: 'CORRECT' })`
4. Remove card, record metrics

**Dismiss**

- Remove card, preserve text, no API call

## Direct edit

When `stateManager.correction.mode === 'direct'`:

- No suggestion card
- AI result verified stale-safe, then auto-merged
- Instant spelling still runs locally at word boundaries
- Mutex released after API completes, before commit (scheduler path)
- Orchestrator dispatch reuses its held lock (execute path)

## Host style adapter

`ui/hostStyleAdapter.ts` mirrors editable chrome (border, radius, font, padding, dark/light surfaces) without mutating the host field.

## Positioning

- Inline after field (`insertAdjacentElement('afterend')`)
- `ResizeObserver` on target, window resize, scroll listeners on scrollable ancestors (card-owned, cleaned up on unmount)

## Accessibility

- Semantic buttons with `aria-label`
- Card row `role="group"`, `tabindex="0"`
- Enter accept, Escape dismiss
- Visible focus ring

## Safety

- No card on blocked fields (password, code editors, excluded domains)
- Safety re-checked before accept
- No sensitive data in DOM attributes

## Concurrency

- FieldSession mutex respected
- Translation/layout cannot write while correction holds lock
- API mutex released before direct-mode commit (scheduler)
- CommandOrchestrator lock reused for manual CORRECT dispatch

## Known limitations

- No persistent ignore / never-suggest (Phase 10+)
- No history UI (Phase 11)
- Plain-text mirror row while typing removed (card appears on analyzing/ready only)
- Scroll listeners scoped to card lifecycle (not global InputEngine)

## Deferred

- Popup UX redesign (Phase 9)
- Legacy storage migration (Phase 10)
