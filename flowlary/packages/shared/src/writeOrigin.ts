/** Origin of a DOM write — used to prevent programmatic write loops. */
export type WriteOrigin = 'USER' | 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT' | 'SYSTEM'

/** Tracks which feature last wrote to a field (diagnostic only). */
export type LastWriter = WriteOrigin | null
