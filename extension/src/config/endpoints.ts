/**
 * API endpoint configuration.
 * Release builds (`FLOWLARY_RELEASE=1`) use production hosts.
 * Dev server and local `vite build` default to flowlary.test + Herd API (writing-api.test).
 * Override with VITE_* env vars in extension/.env.local (e.g. http://127.0.0.1:8787).
 */

function readEnv(key: string): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean> }).env
  const value = env?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** True only for `npm run build:release` (FLOWLARY_RELEASE=1), not plain `vite build`. */
const isReleaseBuild = import.meta.env.VITE_FLOWLARY_RELEASE === '1'

/** Local Herd API. Override with VITE_FLOWLARY_API_URL (e.g. http://127.0.0.1:8787). */
export const LOCAL_DEV_API_BASE = isReleaseBuild
  ? 'https://api.flowlary.com'
  : 'https://writing-api.test'

/** Unified Flowlary API — correction, translation, and layout classification. */
export const FLOWLARY_API_BASE = isReleaseBuild
  ? 'https://api.flowlary.com'
  : (readEnv('VITE_FLOWLARY_API_URL') ?? LOCAL_DEV_API_BASE)

export const FLOWLARY_SITE_URL = isReleaseBuild
  ? 'https://flowlary.com'
  : (readEnv('VITE_FLOWLARY_SITE_URL') ?? 'https://flowlary.test')

/** @deprecated Use FLOWLARY_API_BASE. Kept for transitional overrides/tests. */
export const TRANSLATION_API_BASE = readEnv('VITE_TRANSLATION_API_URL') ?? FLOWLARY_API_BASE

/** @deprecated Use FLOWLARY_API_BASE. Kept for transitional overrides/tests. */
export const LAYOUT_API_BASE = readEnv('VITE_LAYOUT_API_URL') ?? FLOWLARY_API_BASE
