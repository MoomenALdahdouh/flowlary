export type EditableKind = 'value' | 'contenteditable'

export type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

export type FieldSnapshot = {
  element: EditableElement
  kind: EditableKind
  text: string
  caret: number | null
  selection: { start: number; end: number } | null
  generation: number
  timestamp: number
}

export type ReplacementSnapshot = {
  element: EditableElement
  kind: EditableKind
  originalWord: string
  wordStart: number
  wordEnd: number
  caret: number
  timestamp: number
  generation: number
}

export type WriteVerdict = 'written' | 'discarded'

export type DiscardReason =
  | 'disconnected'
  | 'wrong-node'
  | 'missing-range'
  | 'text-mismatch'
  | 'region-edited'
  | 'caret-inside-word'
  | 'selection-overlap'
  | 'invalid-replacement'
  | 'mapping-stale'
  | 'stale-generation'

export type SelectionRange = { start: number; end: number }
