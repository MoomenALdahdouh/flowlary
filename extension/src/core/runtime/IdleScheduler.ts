import { runtimeTrace } from './trace.ts'

export type SchedulerFeature = 'layout' | 'english' | 'translate' | 'review'

export type IdleWake = {
  fieldId: string
  revision: number
  due: SchedulerFeature[]
  now: number
  focusOut: boolean
}

export type IdleSchedulerHooks = {
  now?: () => number
  setTimeout?: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
  onWake: (wake: IdleWake) => void
}

export type FieldScheduleSnapshot = {
  revision: number
  lastInputAt: number
  snapshotText: string
  deadlines: Map<SchedulerFeature, number>
  timerForDueAt: number | null
  composing: boolean
}

type FieldSchedule = FieldScheduleSnapshot & {
  timer: ReturnType<typeof setTimeout> | null
  focusOut: boolean
  wakeRevision: number
}

/**
 * One pending setTimeout per field. Features contribute deadlines, not timers.
 * FieldRevision is not stored here as a second clock — callers pass the session revision.
 */
export class IdleScheduler {
  private readonly fields = new Map<string, FieldSchedule>()
  private readonly now: () => number
  private readonly setTimeoutFn: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>
  private readonly clearTimeoutFn: (handle: ReturnType<typeof setTimeout>) => void
  private readonly onWake: (wake: IdleWake) => void

  constructor(hooks: IdleSchedulerHooks) {
    this.now = hooks.now ?? (() => Date.now())
    this.setTimeoutFn = hooks.setTimeout ?? ((handler, ms) => setTimeout(handler, ms))
    this.clearTimeoutFn = hooks.clearTimeout ?? ((handle) => clearTimeout(handle))
    this.onWake = hooks.onWake
  }

  pendingTimerCount(): number {
    let count = 0
    for (const field of this.fields.values()) {
      if (field.timer) count += 1
    }
    return count
  }

  getSnapshot(fieldId: string): FieldScheduleSnapshot | undefined {
    const field = this.fields.get(fieldId)
    if (!field) return undefined
    return {
      revision: field.revision,
      lastInputAt: field.lastInputAt,
      snapshotText: field.snapshotText,
      deadlines: new Map(field.deadlines),
      timerForDueAt: field.timerForDueAt,
      composing: field.composing,
    }
  }

  noteUserInput(input: {
    fieldId: string
    revision: number
    lastInputAt: number
    snapshotText: string
    composing: boolean
    deadlines: Map<SchedulerFeature, number>
  }): void {
    const existing = this.ensure(input.fieldId)
    existing.revision = input.revision
    existing.wakeRevision = input.revision
    existing.lastInputAt = input.lastInputAt
    existing.snapshotText = input.snapshotText
    existing.composing = input.composing
    existing.focusOut = false
    existing.deadlines = new Map(input.deadlines)
    this.arm(input.fieldId, this.now())
  }

  recompute(input: {
    fieldId: string
    revision: number
    lastInputAt: number
    snapshotText: string
    composing: boolean
    focusOut?: boolean
    deadlines: Map<SchedulerFeature, number>
  }): void {
    const existing = this.ensure(input.fieldId)
    existing.revision = input.revision
    existing.wakeRevision = input.revision
    existing.lastInputAt = input.lastInputAt
    existing.snapshotText = input.snapshotText
    existing.composing = input.composing
    existing.focusOut = input.focusOut === true
    existing.deadlines = new Map(input.deadlines)
    this.arm(input.fieldId, this.now())
  }

  cancel(fieldId: string): void {
    const field = this.fields.get(fieldId)
    if (!field) return
    this.clearTimer(field)
    this.fields.delete(fieldId)
  }

  stop(): void {
    for (const fieldId of [...this.fields.keys()]) this.cancel(fieldId)
  }

  private ensure(fieldId: string): FieldSchedule {
    let field = this.fields.get(fieldId)
    if (!field) {
      field = {
        revision: 0,
        wakeRevision: 0,
        lastInputAt: 0,
        snapshotText: '',
        deadlines: new Map(),
        timer: null,
        timerForDueAt: null,
        composing: false,
        focusOut: false,
      }
      this.fields.set(fieldId, field)
    }
    return field
  }

  private clearTimer(field: FieldSchedule): void {
    if (field.timer) {
      this.clearTimeoutFn(field.timer)
      field.timer = null
    }
    field.timerForDueAt = null
  }

  private arm(fieldId: string, now: number): void {
    const field = this.fields.get(fieldId)
    if (!field) return
    this.clearTimer(field)
    if (field.composing) {
      field.deadlines.clear()
      return
    }

    const due: SchedulerFeature[] = []
    let next: number | null = null
    for (const [feature, dueAt] of field.deadlines) {
      if (dueAt <= now) due.push(feature)
      else if (next === null || dueAt < next) next = dueAt
    }

    if (due.length > 0) {
      this.fireDue(fieldId, due, now)
      return
    }
    if (next === null) return

    const wait = Math.max(0, next - now)
    field.timerForDueAt = next
    const wakeRevision = field.revision
    field.timer = this.setTimeoutFn(() => {
      const current = this.fields.get(fieldId)
      if (!current) return
      current.timer = null
      current.timerForDueAt = null
      if (current.revision !== wakeRevision) return
      const firedAt = this.now()
      const dueNow: SchedulerFeature[] = []
      for (const [feature, dueAt] of current.deadlines) {
        if (dueAt <= firedAt) dueNow.push(feature)
      }
      if (dueNow.length === 0) {
        this.arm(fieldId, firedAt)
        return
      }
      this.fireDue(fieldId, dueNow, firedAt)
    }, wait)

    runtimeTrace({
      name: 'SCHEDULE',
      fieldId,
      revision: field.revision,
    })
  }

  private fireDue(fieldId: string, due: SchedulerFeature[], now: number): void {
    const field = this.fields.get(fieldId)
    if (!field) return
    if (field.revision !== field.wakeRevision) return
    for (const feature of due) field.deadlines.delete(feature)
    this.onWake({ fieldId, revision: field.revision, due, now, focusOut: field.focusOut })
    this.arm(fieldId, now)
  }
}
