import type { WriteOrigin } from '@flowlary/shared'
import type { CommitOptions, ReplacementSnapshot, WriteVerdict } from './types.ts'
import { commitReplacement } from './write.ts'
import { generationTracker } from './generation.ts'
import { verifyRangeSnapshot } from './snapshot.ts'

export type WriteReplacementOptions = CommitOptions & {
  origin: WriteOrigin
  mappingStillValid?: boolean
}

export type WriteReplacementResult =
  | { ok: true; verdict: 'written' }
  | { ok: false; verdict: 'discarded'; stale: boolean; reason?: string }

/** Canonical write API — marks programmatic origin before DOM mutation. */
export function writeReplacement(
  snapshot: ReplacementSnapshot,
  replacement: string,
  options: WriteReplacementOptions,
): WriteReplacementResult {
  const verification = verifyRangeSnapshot(snapshot, replacement, {
    allowActiveEdit: options.allowActiveEdit,
    expectedGeneration: snapshot.generation,
  })
  if (!verification.valid) {
    return {
      ok: false,
      verdict: 'discarded',
      stale: verification.stale,
      reason: verification.reason,
    }
  }

  generationTracker.markProgrammaticWrite(snapshot.element, options.origin)

  const verdict: WriteVerdict = commitReplacement(
    snapshot,
    replacement,
    options.mappingStillValid ?? true,
    snapshot.element,
    options,
  )

  if (verdict === 'discarded') {
    return { ok: false, verdict: 'discarded', stale: true, reason: 'write-discarded' }
  }
  return { ok: true, verdict: 'written' }
}
