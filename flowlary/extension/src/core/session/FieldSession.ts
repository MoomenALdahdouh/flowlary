import type { WriterTag } from '@flowlary/shared'
import type { FieldSnapshot } from '../dom/types.ts'
import { resolveEditableKind } from '../dom/read.ts'

let nextFieldCounter = 0

const fieldIds = new WeakMap<Element, string>()

export function fieldIdentity(element: Element): string {
  const existing = fieldIds.get(element)
  if (existing) return existing
  const id = `field-${++nextFieldCounter}-${element.tagName.toLowerCase()}`
  fieldIds.set(element, id)
  return id
}

export function toFieldRef(element: Element) {
  const kind = resolveEditableKind(element)
  return {
    id: fieldIdentity(element),
    tag: element.tagName,
    kind: kind === 'value'
      ? element instanceof HTMLTextAreaElement
        ? 'textarea' as const
        : 'text' as const
      : kind === 'contenteditable'
        ? 'contenteditable' as const
        : undefined,
  }
}

export type ActiveRequest = {
  operation: WriterTag
  requestId: number
  generation: number
  signal: AbortSignal
  controller: AbortController
}

export type AcquireResult =
  | { ok: true; requestId: number; generation: number; signal: AbortSignal }
  | { ok: false; reason: 'mutex-held' | 'composing' }

export type CommitVerdict =
  | { ok: true }
  | { ok: false; reason: 'stale-generation' | 'stale-request' | 'composing' | 'aborted' | 'mutex' }

export class FieldSession {
  readonly field: ReturnType<typeof toFieldRef>
  readonly element: Element

  private generation = 0
  private requestSequence = 0
  private activeRequest: ActiveRequest | null = null
  private lastCommittedSnapshot: FieldSnapshot | null = null
  private composing = false
  private lastWriter: WriterTag | null = null
  private lastInputAt = 0

  constructor(element: Element) {
    this.element = element
    this.field = toFieldRef(element)
  }

  getGeneration(): number {
    return this.generation
  }

  bumpGeneration(): number {
    this.generation += 1
    this.abortActiveRequest()
    return this.generation
  }

  getRequestSequence(): number {
    return this.requestSequence
  }

  nextRequestId(): number {
    this.requestSequence += 1
    return this.requestSequence
  }

  isStale(operationGeneration: number, requestId?: number): boolean {
    if (operationGeneration !== this.generation) return true
    if (requestId !== undefined && requestId < this.requestSequence) return true
    return false
  }

  getActiveRequest(): ActiveRequest | null {
    return this.activeRequest
  }

  tryAcquireWrite(operation: WriterTag): AcquireResult {
    if (this.composing) return { ok: false, reason: 'composing' }
    if (this.activeRequest !== null) return { ok: false, reason: 'mutex-held' }

    const requestId = this.nextRequestId()
    const generation = this.getGeneration()
    const controller = new AbortController()
    this.activeRequest = {
      operation,
      requestId,
      generation,
      signal: controller.signal,
      controller,
    }
    return { ok: true, requestId, generation, signal: controller.signal }
  }

  releaseWrite(operation: WriterTag, requestId: number): void {
    if (!this.activeRequest) return
    if (this.activeRequest.requestId !== requestId) return
    if (this.activeRequest.operation !== operation) return
    this.activeRequest = null
  }

  abortActiveRequest(): void {
    if (this.activeRequest) {
      this.activeRequest.controller.abort()
      this.nextRequestId()
      this.activeRequest = null
    }
  }

  /** @deprecated use abortActiveRequest */
  abortActive(): void {
    this.abortActiveRequest()
  }

  canCommit(operationGeneration: number, requestId: number): CommitVerdict {
    if (this.composing) return { ok: false, reason: 'composing' }
    const active = this.activeRequest
    if (active) {
      if (active.signal.aborted) return { ok: false, reason: 'aborted' }
      if (active.requestId !== requestId) return { ok: false, reason: 'mutex' }
    }
    if (this.isStale(operationGeneration, requestId)) {
      return {
        ok: false,
        reason: operationGeneration !== this.generation ? 'stale-generation' : 'stale-request',
      }
    }
    return { ok: true }
  }

  noteWrite(writer: WriterTag, requestId: number, snapshot?: FieldSnapshot): void {
    this.lastWriter = writer
    if (snapshot) this.lastCommittedSnapshot = snapshot
    this.releaseWrite(writer, requestId)
  }

  setComposing(value: boolean): void {
    this.composing = value
    if (value) this.abortActiveRequest()
  }

  isComposing(): boolean {
    return this.composing
  }

  noteInput(): void {
    this.lastInputAt = Date.now()
  }

  getLastInputAt(): number {
    return this.lastInputAt
  }

  getLastWriter(): WriterTag | null {
    return this.lastWriter
  }

  getLastCommittedSnapshot(): FieldSnapshot | null {
    return this.lastCommittedSnapshot
  }

  /** Legacy API — prefer tryAcquireWrite */
  beginOperation(operation: WriterTag): AbortController {
    const acquired = this.tryAcquireWrite(operation)
    if (!acquired.ok) {
      const controller = new AbortController()
      controller.abort()
      return controller
    }
    return this.activeRequest!.controller
  }

  completeOperation(operation: WriterTag, snapshot?: FieldSnapshot): void {
    const active = this.activeRequest
    if (active && active.operation === operation) {
      this.noteWrite(operation, active.requestId, snapshot)
    }
  }
}

export class FieldSessionRegistry {
  private sessions = new WeakMap<Element, FieldSession>()
  private idToElement = new Map<string, Element>()

  getOrCreate(element: Element): FieldSession {
    let session = this.sessions.get(element)
    if (!session) {
      session = new FieldSession(element)
      this.sessions.set(element, session)
    }
    this.idToElement.set(session.field.id, element)
    return session
  }

  get(element: Element): FieldSession | undefined {
    return this.sessions.get(element)
  }

  resolveElement(fieldId: string): Element | undefined {
    const element = this.idToElement.get(fieldId)
    if (!element) return undefined
    if (!element.isConnected) {
      this.idToElement.delete(fieldId)
      return undefined
    }
    return element
  }

  delete(element: Element): void {
    const session = this.sessions.get(element)
    if (session) this.idToElement.delete(session.field.id)
    session?.abortActiveRequest()
    this.sessions.delete(element)
  }
}
