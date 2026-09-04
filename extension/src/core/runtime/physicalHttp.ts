import type { OperationFeature } from './types.ts'

export const MAX_PHYSICAL_HTTP = 3

export type PhysicalHttpFeature = Extract<
  OperationFeature,
  'english' | 'translate' | 'layout' | 'pipeline' | 'shortcut'
>

type Waiter = {
  fieldId: string
  feature: PhysicalHttpFeature
  isCurrent: () => boolean
  resolve: (granted: boolean) => void
}

function slotKey(fieldId: string, feature: PhysicalHttpFeature): string {
  return `${fieldId}\0${feature}`
}

/**
 * Bounds in-flight HTTP per (fieldId, feature).
 * "Open" means dispatched and not yet settled. Abort does not free the slot
 * until the request promise reaches finally.
 */
export class PhysicalHttpLimiter {
  private readonly counts = new Map<string, number>()
  private waiters: Waiter[] = []

  count(fieldId: string, feature: PhysicalHttpFeature): number {
    return this.counts.get(slotKey(fieldId, feature)) ?? 0
  }

  async acquire(input: {
    fieldId: string
    feature: PhysicalHttpFeature
    isCurrent: () => boolean
  }): Promise<boolean> {
    if (!input.isCurrent()) return false
    const key = slotKey(input.fieldId, input.feature)
    if (this.count(input.fieldId, input.feature) < MAX_PHYSICAL_HTTP) {
      this.counts.set(key, this.count(input.fieldId, input.feature) + 1)
      return true
    }
    return await new Promise<boolean>((resolve) => {
      this.waiters.push({
        fieldId: input.fieldId,
        feature: input.feature,
        isCurrent: input.isCurrent,
        resolve,
      })
    })
  }

  release(fieldId: string, feature: PhysicalHttpFeature): void {
    const key = slotKey(fieldId, feature)
    const next = Math.max(0, this.count(fieldId, feature) - 1)
    if (next === 0) this.counts.delete(key)
    else this.counts.set(key, next)
    this.pump(fieldId, feature)
  }

  discardStaleWaiters(): void {
    const kept: Waiter[] = []
    for (const waiter of this.waiters) {
      if (waiter.isCurrent()) kept.push(waiter)
      else waiter.resolve(false)
    }
    this.waiters = kept
  }

  resetForTests(): void {
    this.counts.clear()
    for (const waiter of this.waiters) waiter.resolve(false)
    this.waiters = []
  }

  private pump(fieldId: string, feature: PhysicalHttpFeature): void {
    const index = this.waiters.findIndex(
      (waiter) => waiter.fieldId === fieldId && waiter.feature === feature,
    )
    if (index < 0) return
    const waiter = this.waiters.splice(index, 1)[0]!
    if (!waiter.isCurrent()) {
      waiter.resolve(false)
      this.pump(fieldId, feature)
      return
    }
    if (this.count(fieldId, feature) >= MAX_PHYSICAL_HTTP) {
      this.waiters.unshift(waiter)
      return
    }
    const key = slotKey(fieldId, feature)
    this.counts.set(key, this.count(fieldId, feature) + 1)
    waiter.resolve(true)
  }
}

const limiter = new PhysicalHttpLimiter()

export function getPhysicalHttpLimiter(): PhysicalHttpLimiter {
  return limiter
}

export function resetPhysicalHttpForTests(): void {
  limiter.resetForTests()
}

export type PhysicalHttpContext = {
  fieldId: string
  feature: PhysicalHttpFeature
  isCurrent?: () => boolean
}

export async function runWithPhysicalHttp<T>(
  context: PhysicalHttpContext,
  dispatch: () => Promise<T>,
): Promise<{ dispatched: false } | { dispatched: true; value: T }> {
  const granted = await limiter.acquire({
    fieldId: context.fieldId,
    feature: context.feature,
    isCurrent: context.isCurrent ?? (() => true),
  })
  if (!granted) return { dispatched: false }
  try {
    return { dispatched: true, value: await dispatch() }
  } finally {
    limiter.release(context.fieldId, context.feature)
  }
}
