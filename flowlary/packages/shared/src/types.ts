/** Supported writing operations routed through CommandRouter. */
export type OperationType = 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT' | 'PIPELINE'

/** Reference to an editable field in the page. */
export type FieldRef = {
  /** Stable identity for the field within a document frame. */
  id: string
  /** Underlying element tag name at registration time. */
  tag: string
  /** Editable kind when known. */
  kind?: 'textarea' | 'text' | 'contenteditable' | 'value'
}

/** Command dispatched to a feature handler via CommandRouter. */
export type Command = {
  type: OperationType
  field: FieldRef
  text: string
  sourceLanguage?: string
  targetLanguage?: string
  reason?: string
  /** Field generation captured when the command was created. */
  generation?: number
  /** Monotonic request id for stale detection. */
  requestId?: number
}

/** Result returned by feature handlers and CommandRouter. */
export type CommandResult = {
  ok: boolean
  operation: OperationType
  data?: unknown
  error?: string
  stale?: boolean
  aborted?: boolean
}

/** Safety gate decision before any operation proceeds. */
export type SafetyDecision = {
  allowed: boolean
  reason?: string
}

/** Namespaced storage keys for Flowlary. */
export const STORAGE_KEYS = {
  settings: 'flowlary.settings',
  correction: 'flowlary.correction',
  translation: 'flowlary.translation',
  layout: 'flowlary.layout',
  history: 'flowlary.history',
  entitlement: 'flowlary.entitlement',
  migrations: 'flowlary.migrations.v1',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Product branding constants. */
export const BRAND = {
  name: 'Flowlary',
  tagline: 'Your AI Writing Companion',
  version: '0.1.0',
  pageMarker: 'flowlary',
} as const

export const COMMANDS = {
  translate: 'TRANSLATE',
  fixLayout: 'FIX_LAYOUT',
} as const
