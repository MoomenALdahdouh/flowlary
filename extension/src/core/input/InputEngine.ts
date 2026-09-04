import { BRAND, type WriteOrigin } from '@flowlary/shared'
import { isControlledWriteActive, shouldIgnoreInputForGeneration } from '../dom/writeOrigin.ts'
import { bumpUserGeneration, syncDomGeneration } from '../dom/generation.ts'
import { findEditableFromTarget } from '../dom/adapter.ts'
import { resolveEditableKind } from '../dom/read.ts'
import { markPageActive, shouldProcessFrame } from '../dom/frameGuard.ts'
import { beginComposition, endComposition, isComposing } from '../dom/composition.ts'
import { evaluateFieldSafety } from '../safety/index.ts'
import { EventBus, OWNED_DOCUMENT_EVENTS, type NormalizedInputEvent } from '../events/EventBus.ts'
import { FieldSession, FieldSessionRegistry } from '../session/FieldSession.ts'
import { stateManager } from '../state/StateManager.ts'
import { detectShortcut } from './shortcuts.ts'

export type InputEngineOptions = {
  eventBus?: EventBus
  sessions?: FieldSessionRegistry
}

/**
 * Single owner of document-level input events.
 * Feature modules must NOT attach competing global listeners.
 */
export class InputEngine {
  readonly eventBus: EventBus
  readonly sessions: FieldSessionRegistry
  readonly ownedEvents = OWNED_DOCUMENT_EVENTS
  private activeElement: Element | null = null
  private started = false
  private bound = {
    focusIn: (event: FocusEvent) => this.onFocusIn(event),
    focusOut: (event: FocusEvent) => this.onFocusOut(event),
    input: (event: Event) => this.onInput(event),
    paste: (event: ClipboardEvent) => this.onPaste(event),
    drop: (event: DragEvent) => this.onDrop(event),
    keyDown: (event: KeyboardEvent) => this.onKeyDown(event),
    keyUp: (event: KeyboardEvent) => this.onKeyUp(event),
    compositionStart: (event: CompositionEvent) => this.onCompositionStart(event),
    compositionUpdate: (event: CompositionEvent) => this.onCompositionUpdate(event),
    compositionEnd: (event: CompositionEvent) => this.onCompositionEnd(event),
  }

  constructor(options: InputEngineOptions = {}) {
    this.eventBus = options.eventBus ?? new EventBus()
    this.sessions = options.sessions ?? new FieldSessionRegistry()
  }

  start(): void {
    if (this.started || !shouldProcessFrame()) return
    this.started = true
    markPageActive(BRAND.pageMarker)

    const opts = { capture: true } as const
    document.addEventListener('focusin', this.bound.focusIn, opts)
    document.addEventListener('focusout', this.bound.focusOut, opts)
    document.addEventListener('input', this.bound.input, opts)
    document.addEventListener('paste', this.bound.paste, opts)
    document.addEventListener('drop', this.bound.drop, opts)
    document.addEventListener('keydown', this.bound.keyDown, opts)
    document.addEventListener('keyup', this.bound.keyUp, opts)
    document.addEventListener('compositionstart', this.bound.compositionStart, opts)
    document.addEventListener('compositionupdate', this.bound.compositionUpdate, opts)
    document.addEventListener('compositionend', this.bound.compositionEnd, opts)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    document.removeEventListener('focusin', this.bound.focusIn, true)
    document.removeEventListener('focusout', this.bound.focusOut, true)
    document.removeEventListener('input', this.bound.input, true)
    document.removeEventListener('paste', this.bound.paste, true)
    document.removeEventListener('drop', this.bound.drop, true)
    document.removeEventListener('keydown', this.bound.keyDown, true)
    document.removeEventListener('keyup', this.bound.keyUp, true)
    document.removeEventListener('compositionstart', this.bound.compositionStart, true)
    document.removeEventListener('compositionupdate', this.bound.compositionUpdate, true)
    document.removeEventListener('compositionend', this.bound.compositionEnd, true)
    this.activeElement = null
  }

  isStarted(): boolean {
    return this.started
  }

  getActiveElement(): Element | null {
    return this.activeElement
  }

  getActiveSession(): FieldSession | undefined {
    if (!this.activeElement) return undefined
    return this.sessions.get(this.activeElement)
  }

  getSession(element: Element): FieldSession | undefined {
    return this.sessions.get(element)
  }

  private resolveEditableTarget(target: EventTarget | null): Element | null {
    return findEditableFromTarget(target)?.element ?? null
  }

  private shouldAssist(element: Element): boolean {
    if (!stateManager.isActive()) return false
    const hostname = typeof location !== 'undefined' ? location.hostname : undefined
    const decision = evaluateFieldSafety(element, {
      hostname,
      excludedDomains: stateManager.settings.excludedDomains,
    })
    return decision.allowed
  }

  private writeOrigin(): WriteOrigin {
    return isControlledWriteActive() ? 'SYSTEM' : 'USER'
  }

  private onFocusIn(event: FocusEvent): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return
    this.activeElement = target
    const session = this.sessions.getOrCreate(target)
    this.emit({
      type: 'focus-in',
      target,
      session,
      composing: session.isComposing(),
      origin: 'USER',
    })
  }

  private onFocusOut(event: FocusEvent): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target) return
    const session = this.sessions.get(target)
    if (this.activeElement === target) {
      this.activeElement = null
    }
    this.emit({
      type: 'focus-out',
      target,
      session,
      composing: session?.isComposing() ?? false,
      origin: 'USER',
    })
  }

  private onInput(event: Event): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return

    const inputEvent = event as InputEvent
    const session = this.sessions.getOrCreate(target)
    session.noteInput()
    let inputSource = inputSourceFromType(inputEvent.inputType)
    if (
      session.isPasteAssistanceSuppressed()
      && (inputSource === 'typing' || inputSource === 'unknown')
    ) {
      inputSource = 'paste'
    }
    const insertLength =
      inputSource === 'paste' || inputSource === 'drop'
        ? inputEvent.data?.length ?? 0
        : 0
    if (inputSource === 'paste' || inputSource === 'drop') {
      session.notePasteBurst(insertLength)
    } else {
      session.noteInputSource(inputSource, insertLength)
    }

    const composing = session.isComposing() || isComposing()
    const ignoreGeneration =
      composing || shouldIgnoreInputForGeneration(inputEvent.inputType)

    if (ignoreGeneration) {
      syncDomGeneration(target, session)
      this.emit({
        type: 'input',
        target,
        session,
        inputType: inputEvent.inputType,
        generation: session.getGeneration(),
        origin: this.writeOrigin(),
        composing,
      })
      return
    }

    const generation = bumpUserGeneration(target, session)
    this.emit({
      type: 'input',
      target,
      session,
      inputType: inputEvent.inputType,
      generation,
      origin: 'USER',
      composing: false,
    })
  }

  private onKeyDown(event: KeyboardEvent): void {
    const shortcut = detectShortcut(event)
    if (shortcut) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const hit = event.composedPath?.()[0] ?? event.target
      const target =
        this.resolveEditableTarget(hit instanceof EventTarget ? hit : event.target)
        ?? this.activeElement
      const session = target ? this.sessions.get(target) : this.getActiveSession()
      this.emit({
        type: 'shortcut',
        command: shortcut,
        target,
        session,
        composing: false,
        origin: 'USER',
      })
      return
    }

    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return
    const session = this.sessions.getOrCreate(target)
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.code === 'KeyV') {
      session.notePasteBurst()
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
      session.clearPasteBurst()
    }
    this.emit({
      type: 'keydown',
      target,
      session,
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      composing: session.isComposing(),
      origin: 'USER',
    })
  }

  private onPaste(event: ClipboardEvent): void {
    const target = this.resolveEditableTarget(event.target) ?? this.activeElement
    if (!target || !this.shouldAssist(target)) return
    const session = this.sessions.getOrCreate(target)
    session.notePasteBurst(clipboardPlainLength(event))
    this.emit({
      type: 'input',
      target,
      session,
      inputType: 'insertFromPaste',
      generation: session.getGeneration(),
      origin: 'USER',
      composing: session.isComposing(),
    })
  }

  private onDrop(event: DragEvent): void {
    const target = this.resolveEditableTarget(event.target) ?? this.activeElement
    if (!target || !this.shouldAssist(target)) return
    const session = this.sessions.getOrCreate(target)
    const dropped = dropPlainLength(event)
    session.notePasteBurst(dropped, Date.now(), 'drop')
    this.emit({
      type: 'input',
      target,
      session,
      inputType: 'insertFromDrop',
      generation: session.getGeneration(),
      origin: 'USER',
      composing: session.isComposing(),
    })
  }

  private onKeyUp(event: KeyboardEvent): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return
    const session = this.sessions.get(target)
    this.emit({
      type: 'keyup',
      target,
      session,
      key: event.key,
      code: event.code,
      composing: session?.isComposing() ?? false,
      origin: 'USER',
    })
  }

  private onCompositionUpdate(event: CompositionEvent): void {
    const target =
      this.resolveEditableTarget(event.target) ?? this.activeElement
    if (!target || !this.shouldAssist(target)) return
    const session = this.sessions.getOrCreate(target)
    session.setComposing(true)
    this.emit({
      type: 'composition-update',
      target,
      session,
      composing: true,
      origin: 'USER',
    })
  }

  private onCompositionStart(event: CompositionEvent): void {
    beginComposition()
    const target =
      this.resolveEditableTarget(event.target) ?? this.activeElement
    if (!target || !this.shouldAssist(target)) return
    this.activeElement = target
    const session = this.sessions.getOrCreate(target)
    session.setComposing(true)
    this.emit({
      type: 'composition-start',
      target,
      session,
      composing: true,
      origin: 'USER',
    })
  }

  private onCompositionEnd(event: CompositionEvent): void {
    endComposition()
    const target =
      this.resolveEditableTarget(event.target) ?? this.activeElement
    if (!target) return
    const session = this.sessions.getOrCreate(target)
    session.setComposing(false)
    const generation = bumpUserGeneration(target, session)
    this.emit({
      type: 'composition-end',
      target,
      session,
      generation,
      composing: false,
      origin: 'USER',
    })
  }

  private emit(event: NormalizedInputEvent): void {
    this.eventBus.emit(event)
  }
}

function inputSourceFromType(inputType?: string): 'typing' | 'paste' | 'drop' | 'programmatic' | 'unknown' {
  if (inputType === 'insertFromPaste') return 'paste'
  if (inputType === 'insertFromDrop') return 'drop'
  if (inputType === 'insertReplacementText') return 'programmatic'
  if (inputType) return 'typing'
  return 'unknown'
}

function clipboardPlainLength(event: ClipboardEvent): number {
  const data = event.clipboardData
  if (!data) return 0
  return (data.getData('text/plain') || data.getData('text') || '').length
}

function dropPlainLength(event: DragEvent): number {
  const data = event.dataTransfer
  if (!data) return 0
  return (data.getData('text/plain') || data.getData('text') || '').length
}

/** Detect whether an element is a supported editable target. */
export function detectEditable(element: Element): boolean {
  return resolveEditableKind(element) !== null
}
