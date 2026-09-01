/** Deterministic demo timing — stable states dominate each cycle. */
export const DEMO_HOLD = {
  stable: 3200,
  input: 1200,
  analyze: 900,
  process: 700,
  step: 1000,
  loopGap: 400,
} as const

export function demoAt(offsets: number[]): number {
  return offsets.reduce((sum, ms) => sum + ms, 0)
}
