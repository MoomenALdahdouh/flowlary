export const MAX_EXCEPTION_LENGTH = 64
export const MAX_EXCEPTIONS = 200
export const MAX_EVENTS = 500
export const REVERT_EXCEPTION_THRESHOLD = 2

export type CorrectionEventKind = 'accepted' | 'ignored' | 'reverted'

export type CorrectionEvent = {
  kind: CorrectionEventKind
  token: string
  replacement?: string
  ts: number
}

export const LAYOUT_PROFILE_STORAGE_KEY = 'flowlary.layout.profile'
