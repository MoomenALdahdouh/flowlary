/** Quiet period after a correction API rate limit — suppress repeat CORRECT_TEXT calls. */
export const ASSIST_RATE_LIMIT_COOLDOWN_MS = 60_000

let coolUntil = 0

export function isAssistCooldownActive(now = Date.now()): boolean {
  return now < coolUntil
}

export function assistCooldownRemainingMs(now = Date.now()): number {
  return Math.max(0, coolUntil - now)
}

export function noteAssistRateLimited(untilMs = Date.now() + ASSIST_RATE_LIMIT_COOLDOWN_MS): void {
  coolUntil = Math.max(coolUntil, untilMs)
}

export function clearAssistCooldownForTests(): void {
  coolUntil = 0
}
