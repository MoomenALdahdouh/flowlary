/** Deterministic demo timing — stable states dominate each cycle. */
export const DEMO_HOLD = {
  stable: 4200,
  input: 2200,
  analyze: 1800,
  process: 1600,
  step: 2400,
  loopGap: 1200,
} as const

/** Educational stepped demos — each phase must be readable. */
export const STEP_HOLD = {
  input: 3200,
  detect: 2800,
  interpret: 2800,
  action: 2400,
  result: 4800,
} as const

/** Homepage scroll stories — deliberate pacing, hold final state. */
export const STORY_HOLD = {
  typeChar: 120,
  typingPause: 600,
  detect: 1800,
  interpret: 1600,
  action: 1400,
  result: 4000,
  mode: 2800,
  transition: 500,
} as const

export function demoAt(offsets: number[]): number {
  return offsets.reduce((sum, ms) => sum + ms, 0)
}
