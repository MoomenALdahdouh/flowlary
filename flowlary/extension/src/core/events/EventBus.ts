export type NormalizedInputEvent =
  | { type: 'focus-in'; target: Element }
  | { type: 'focus-out'; target: Element }
  | { type: 'input'; target: Element; inputType?: string; generation: number }
  | { type: 'keydown'; target: Element; key: string; code: string }
  | { type: 'keyup'; target: Element; key: string; code: string }
  | { type: 'composition-start'; target: Element }
  | { type: 'composition-end'; target: Element; generation: number }

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
