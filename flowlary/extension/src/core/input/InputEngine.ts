import { BRAND } from '@flowlary/shared'
import { isControlledWriteActive, shouldIgnoreInputForGeneration } from '../dom/writeOrigin.ts'
import { bumpUserGeneration, syncDomGeneration } from '../dom/generation.ts'
import { isEditableElement, resolveEditableKind } from '../dom/read.ts'
import { markPageActive, shouldProcessFrame } from '../dom/frameGuard.ts'
import { beginComposition, endComposition } from '../dom/composition.ts'
import { evaluateFieldSafety } from '../safety/index.ts'
import { EventBus, type NormalizedInputEvent } from '../events/EventBus.ts'
import { FieldSessionRegistry } from '../session/FieldSession.ts'
import { stateManager } from '../state/StateManager.ts'

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
  private activeElement: Element | null = null
  private started = false
  private bound = {
    focusIn: (event: FocusEvent) => this.onFocusIn(event),
    focusOut: (event: FocusEvent) => this.onFocusOut(event),
    input: (event: Event) => this.onInput(event),
    keyDown: (event: KeyboardEvent) => this.onKeyDown(event),
    keyUp: (event: KeyboardEvent) => this.onKeyUp(event),
    compositionStart: () => this.onCompositionStart(),
    compositionEnd: () => this.onCompositionEnd(),
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
    document.addEventListener('keydown', this.bound.keyDown, opts)
    document.addEventListener('keyup', this.bound.keyUp, opts)
    document.addEventListener('compositionstart', this.bound.compositionStart, opts)
    document.addEventListener('compositionend', this.bound.compositionEnd, opts)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    document.removeEventListener('focusin', this.bound.focusIn, true)
    document.removeEventListener('focusout', this.bound.focusOut, true)
    document.removeEventListener('input', this.bound.input, true)
    document.removeEventListener('keydown', this.bound.keyDown, true)
    document.removeEventListener('keyup', this.bound.keyUp, true)
    document.removeEventListener('compositionstart', this.bound.compositionStart, true)
    document.removeEventListener('compositionend', this.bound.compositionEnd, true)
    this.activeElement = null
  }

  getActiveElement(): Element | null {
    return this.activeElement
  }

  getActiveSession() {
    if (!this.activeElement) return undefined
    return this.sessions.get(this.activeElement)
  }

  private resolveEditableTarget(target: EventTarget | null): Element | null {
    if (!(target instanceof Element)) return null
    if (isEditableElement(target)) return target
    const closest = target.closest('textarea,input,[contenteditable=""],[contenteditable="true"]')
    if (closest && isEditableElement(closest)) return closest
    return null
  }

  private shouldAssist(element: Element): boolean {
    if (!stateManager.isActive()) return false
    const hostname = location.hostname
    const decision = evaluateFieldSafety(element, {
      hostname,
      excludedDomains: stateManager.settings.excludedDomains,
    })
    return decision.allowed
  }

  private onFocusIn(event: FocusEvent): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return
    this.activeElement = target
    this.sessions.getOrCreate(target)
    this.emit({ type: 'focus-in', target })
  }

  private onFocusOut(event: FocusEvent): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target) return
    if (this.activeElement === target) {
      this.activeElement = null
    }
    this.emit({ type: 'focus-out', target })
  }

  private onInput(event: Event): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return

    const inputEvent = event as InputEvent
    const session = this.sessions.getOrCreate(target)
    session.noteInput()

    if (shouldIgnoreInputForGeneration(inputEvent.inputType)) {
      syncDomGeneration(target, session)
      this.emit({
        type: 'input',
        target,
        inputType: inputEvent.inputType,
        generation: session.getGeneration(),
        origin: isControlledWriteActive() ? 'SYSTEM' : 'USER',
      })
      return
    }

    const generation = bumpUserGeneration(target, session)

    this.emit({
      type: 'input',
      target,
      inputType: inputEvent.inputType,
      generation,
      origin: 'USER',
    })
  }

  private onKeyDown(event: KeyboardEvent): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return
    this.emit({ type: 'keydown', target, key: event.key, code: event.code })
  }

  private onKeyUp(event: KeyboardEvent): void {
    const target = this.resolveEditableTarget(event.target)
    if (!target || !this.shouldAssist(target)) return
    this.emit({ type: 'keyup', target, key: event.key, code: event.code })
  }

  private onCompositionStart(): void {
    beginComposition()
    if (this.activeElement) {
      this.sessions.getOrCreate(this.activeElement).setComposing(true)
      this.emit({ type: 'composition-start', target: this.activeElement })
    }
  }

  private onCompositionEnd(): void {
    endComposition()
    if (this.activeElement) {
      const session = this.sessions.getOrCreate(this.activeElement)
      session.setComposing(false)
      const generation = session.bumpGeneration()
      this.emit({ type: 'composition-end', target: this.activeElement, generation })
    }
  }

  private emit(event: NormalizedInputEvent): void {
    this.eventBus.emit(event)
  }
}

/** Detect whether an element is a supported editable target. */
export function detectEditable(element: Element): boolean {
  return resolveEditableKind(element) !== null
}
