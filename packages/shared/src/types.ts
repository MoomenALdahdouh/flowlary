/** Supported writing operations routed through CommandRouter. */
export type OperationType = 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT' | 'PIPELINE'

/** Origin of a DOM write or synthetic input event. */
export type WriteOrigin = 'USER' | 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT' | 'SYSTEM'

/** Tracks which actor last committed a field write (diagnostic only). */
export type WriterTag = OperationType | 'SYSTEM'

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
  /** Shared-analysis span for explicit shortcuts. */
  rangeStart?: number
  rangeEnd?: number
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
  correctionGroqKey: 'flowlary.correction.groqKey',
  translation: 'flowlary.translation',
  layout: 'flowlary.layout',
  layoutProfile: 'flowlary.layout.profile',
  history: 'flowlary.history',
  learningProfile: 'flowlary.learning.profile',
  learningInstall: 'flowlary.learning.install',
  learningEvents: 'flowlary.learning.events',
  learningSessions: 'flowlary.learning.sessions',
  entitlement: 'flowlary.entitlement',
  entitlementLicenseKey: 'flowlary.entitlement.licenseKey',
  migrations: 'flowlary.migrations.v1',
  cache: 'flowlary.cache',
  authInstallId: 'flowlary.auth.installId',
  authInstallToken: 'flowlary.auth.installToken',
  authAccessToken: 'flowlary.auth.accessToken',
  authRefreshToken: 'flowlary.auth.refreshToken',
  authSessionId: 'flowlary.auth.sessionId',
  /** Server-authenticated account id — ownership key for local account-scoped data. */
  authAccountId: 'flowlary.auth.accountId',
  authAccountEmail: 'flowlary.auth.accountEmail',
  authAccountPlan: 'flowlary.auth.accountPlan',
  authServerEntitlement: 'flowlary.auth.serverEntitlement',
  authEntitlementSyncedAt: 'flowlary.auth.entitlementSyncedAt',
  authTokenExpiresAt: 'flowlary.auth.tokenExpiresAt',
  /** Legacy claim / quarantine marker for pre-isolation unscoped keys. */
  accountIsolationMeta: 'flowlary.account.isolation.meta',
  uiLocale: 'flowlary.ui.locale',
  /** Install-scoped first-session / retention flags (not account-scoped). */
  uiFirstWin: 'flowlary.ui.firstWin',
} as const

export type EntitlementStatus = 'trial' | 'free' | 'pro' | 'unknown'

/** Unified product identifier for entitlement and licensing. */
export const FLOWLARY_PRODUCT_ID = 'FLOWLARY' as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Product branding constants. */
export const BRAND = {
  name: 'Flowlary',
  tagline: 'Your AI Writing Companion',
  version: '1.1.0',
  pageMarker: 'flowlary',
} as const

export const COMMANDS = {
  translate: 'TRANSLATE',
  fixLayout: 'FIX_LAYOUT',
  correct: 'CORRECT',
  speedBox: 'SPEED_BOX',
} as const
