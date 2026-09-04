/**
 * Canonical extension API / site hosts.
 *
 * Selected at build time via FLOWLARY_API_TARGET (and FLOWLARY_RELEASE=1).
 * Vite injects the chosen URLs; leftover extension/.env.local must not win.
 */

export const FLOWLARY_API_TARGETS = {
  local: {
    apiUrl: 'http://127.0.0.1:8787',
    siteUrl: 'https://flowlary.test',
  },
  production: {
    apiUrl: 'https://api.flowlary.com',
    siteUrl: 'https://flowlary.com',
  },
} as const

export type FlowlaryApiTargetId = keyof typeof FLOWLARY_API_TARGETS

export type ResolvedFlowlaryApiTarget = {
  id: FlowlaryApiTargetId
  apiUrl: string
  siteUrl: string
  /** Production API + production Chrome manifest (no local host_permissions). */
  useProductionManifest: boolean
}

export class InvalidApiTargetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidApiTargetError'
  }
}

function normalizeTargetId(raw: string | undefined): FlowlaryApiTargetId | '' {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return ''
  if (value === 'local' || value === 'production') return value
  throw new InvalidApiTargetError(
    `Invalid FLOWLARY_API_TARGET="${raw}". Use "local" or "production".`,
  )
}

/**
 * Resolve the extension API target from process env (Vite / npm scripts).
 * Unset target defaults to local. FLOWLARY_RELEASE=1 always forces production.
 */
export function resolveFlowlaryApiTarget(env: Record<string, string | undefined>): ResolvedFlowlaryApiTarget {
  const release = env.FLOWLARY_RELEASE === '1'
  const requested = normalizeTargetId(env.FLOWLARY_API_TARGET)

  if (release && requested === 'local') {
    throw new InvalidApiTargetError(
      'FLOWLARY_RELEASE=1 cannot use FLOWLARY_API_TARGET=local. Release builds must target production.',
    )
  }

  const id: FlowlaryApiTargetId = release || requested === 'production' ? 'production' : 'local'
  const spec = FLOWLARY_API_TARGETS[id]
  return {
    id,
    apiUrl: spec.apiUrl,
    siteUrl: spec.siteUrl,
    useProductionManifest: id === 'production',
  }
}
