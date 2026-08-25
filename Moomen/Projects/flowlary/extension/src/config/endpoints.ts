/**
 * API endpoint configuration.
 * Production builds (vite PROD + FLOWLARY_RELEASE) use HTTPS production hosts.
 * Development defaults to localhost; override with VITE_* env vars.
 */

function readEnv(key: string): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean> }).env
  const value = env?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const isProductionBuild =
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD === true

export const TRANSLATION_API_BASE =
  readEnv('VITE_TRANSLATION_API_URL') ??
  (isProductionBuild ? 'https://lingo-api.zaixos.com' : 'http://127.0.0.1:8004')

export const LAYOUT_API_BASE =
  readEnv('VITE_LAYOUT_API_URL') ??
  (isProductionBuild ? 'https://flowlary-api.zaixos.com' : 'http://127.0.0.1:8003')
