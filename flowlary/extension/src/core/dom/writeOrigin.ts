import type { WriteOrigin } from '@flowlary/shared'

let depth = 0
let currentOrigin: WriteOrigin | null = null

export function getWriteOrigin(): WriteOrigin | null {
  return currentOrigin
}

export function isControlledWriteActive(): boolean {
  return depth > 0
}

/** Run a programmatic DOM write without treating it as user input. */
export function withWriteOrigin<T>(origin: WriteOrigin, fn: () => T): T {
  depth += 1
  const previous = currentOrigin
  currentOrigin = origin
  try {
    return fn()
  } finally {
    currentOrigin = previous
    depth = Math.max(0, depth - 1)
  }
}

/** Chrome/React controlled components emit this for programmatic replacements. */
export function isProgrammaticInputType(inputType?: string): boolean {
  return inputType === 'insertReplacementText'
}

/** True when an input event should NOT bump user generation. */
export function shouldIgnoreInputForGeneration(inputType?: string): boolean {
  return isControlledWriteActive() || isProgrammaticInputType(inputType)
}
