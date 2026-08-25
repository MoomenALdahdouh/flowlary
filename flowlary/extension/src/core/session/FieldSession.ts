import type { Command, FieldRef, OperationType } from '@flowlary/shared'
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

export function toFieldRef(element: Element): FieldRef {
  const kind = resolveEditableKind(element)
  return {
    id: fieldIdentity(element),
    tag: element.tagName,
    kind: kind === 'value'
      ? element instanceof HTMLTextAreaElement
        ? 'textarea'
        : 'text'
      : kind === 'contenteditable'
        ? 'contenteditable'
        : undefined,
  }
}

export type FieldSessionState = {
  field: FieldRef
  element: Element
  generation: number
  requestSequence: number
  activeOperation: OperationType | null
  currentOperation: OperationType | null
  lastCommittedSnapshot: FieldSnapshot | null
  abortController: AbortController | null
  composing: boolean
  pendingCommand: Command | null
  lastWriter: OperationType | null
  lastInputAt: number
}

export class FieldSession {
  readonly field: FieldRef
  readonly element: Element

  private generation = 0
  private requestSequence = 0
  private activeOperation: OperationType | null = null
  private currentOperation: OperationType | null = null
  private lastCommittedSnapshot: FieldSnapshot | null = null
  private abortController: AbortController | null = null
  private composing = false
  private pendingCommand: Command | null = null
  private lastWriter: OperationType | null = null
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
    this.abortActive()
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

  beginOperation(operation: OperationType): AbortController {
    this.abortActive()
    this.activeOperation = operation
    this.currentOperation = operation
    this.abortController = new AbortController()
    return this.abortController
  }

  completeOperation(operation: OperationType, snapshot?: FieldSnapshot): void {
    if (this.activeOperation === operation) {
      this.activeOperation = null
      this.abortController = null
    }
    if (snapshot) {
      this.lastCommittedSnapshot = snapshot
    }
    this.lastWriter = operation
    this.pendingCommand = null
  }

  abortActive(): void {
    this.abortController?.abort()
    this.abortController = null
    this.activeOperation = null
  }

  setComposing(value: boolean): void {
    this.composing = value
  }

  isComposing(): boolean {
    return this.composing
  }

  setPendingCommand(command: Command | null): void {
    this.pendingCommand = command
  }

  getPendingCommand(): Command | null {
    return this.pendingCommand
  }

  noteInput(): void {
    this.lastInputAt = Date.now()
  }

  getLastInputAt(): number {
    return this.lastInputAt
  }

  getLastWriter(): OperationType | null {
    return this.lastWriter
  }

  getLastCommittedSnapshot(): FieldSnapshot | null {
    return this.lastCommittedSnapshot
  }

  snapshot(): FieldSessionState {
    return {
      field: this.field,
      element: this.element,
      generation: this.generation,
      requestSequence: this.requestSequence,
      activeOperation: this.activeOperation,
      currentOperation: this.currentOperation,
      lastCommittedSnapshot: this.lastCommittedSnapshot,
      abortController: this.abortController,
      composing: this.composing,
      pendingCommand: this.pendingCommand,
      lastWriter: this.lastWriter,
      lastInputAt: this.lastInputAt,
    }
  }
}

export class FieldSessionRegistry {
  private sessions = new WeakMap<Element, FieldSession>()

  getOrCreate(element: Element): FieldSession {
    let session = this.sessions.get(element)
    if (!session) {
      session = new FieldSession(element)
      this.sessions.set(element, session)
    }
    return session
  }

  get(element: Element): FieldSession | undefined {
    return this.sessions.get(element)
  }

  delete(element: Element): void {
    const session = this.sessions.get(element)
    session?.abortActive()
    this.sessions.delete(element)
  }
}
