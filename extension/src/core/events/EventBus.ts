import type { WriteOrigin } from '@flowlary/shared'
import type { FieldSession } from '../session/FieldSession.ts'
import type { ShortcutCommand } from '../input/shortcuts.ts'

export type NormalizedInputEvent =
  | {
      type: 'focus-in'
      target: Element
      session?: FieldSession
      composing: boolean
      origin: WriteOrigin
    }
  | {
      type: 'focus-out'
      target: Element
      session?: FieldSession
      composing: boolean
      origin: WriteOrigin
    }
  | {
      type: 'input'
      target: Element
      session?: FieldSession
      inputType?: string
      generation: number
      origin: WriteOrigin
      composing: boolean
    }
  | {
      type: 'keydown'
      target: Element
      session?: FieldSession
      key: string
      code: string
      ctrlKey: boolean
      metaKey: boolean
      shiftKey: boolean
      composing: boolean
      origin: WriteOrigin
    }
  | {
      type: 'keyup'
      target: Element
      session?: FieldSession
      key: string
      code: string
      composing: boolean
      origin: WriteOrigin
    }
  | {
      type: 'composition-start'
      target: Element
      session?: FieldSession
      composing: true
      origin: WriteOrigin
    }
  | {
      type: 'composition-end'
      target: Element
      session?: FieldSession
      generation: number
      composing: false
      origin: WriteOrigin
    }
  | {
      type: 'shortcut'
      command: ShortcutCommand
      target: Element | null
      session?: FieldSession
      composing: boolean
      origin: WriteOrigin
    }

export type InputEventListener = (event: NormalizedInputEvent) => void

export class EventBus {
  private listeners = new Set<InputEventListener>()

  subscribe(listener: InputEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: NormalizedInputEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const OWNED_DOCUMENT_EVENTS = [
  'focusin',
  'focusout',
  'input',
  'keydown',
  'keyup',
  'compositionstart',
  'compositionend',
] as const
