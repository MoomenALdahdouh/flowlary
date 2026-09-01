import { UPGRADE_PROMPT_SUPPRESS_MS } from '@flowlary/shared'
import type { FlowlaryStorage } from '../storage/index.ts'

const SUPPRESS_KEY = 'flowlary.ux.upgradePromptSuppressUntil'

/**
 * Suppress identical contextual upgrade prompts after an exhaustion attempt.
 * Does NOT suppress the underlying error/locked state — only repeated CTAs.
 */
export async function shouldShowContextualUpgradePrompt(
  storage: FlowlaryStorage,
  now = Date.now(),
): Promise<boolean> {
  const raw = await storage.get(SUPPRESS_KEY, 'local')
  const until =
    raw && typeof raw === 'object' && typeof (raw as { until?: unknown }).until === 'number'
      ? (raw as { until: number }).until
      : 0
  return until <= now
}

export async function markContextualUpgradePromptShown(
  storage: FlowlaryStorage,
  now = Date.now(),
): Promise<void> {
  await storage.set(SUPPRESS_KEY, { until: now + UPGRADE_PROMPT_SUPPRESS_MS }, 'local')
}
