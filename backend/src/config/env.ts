export type FlowlaryEnv = 'development' | 'staging' | 'production'

export type AppConfig = {
  env: FlowlaryEnv
  port: number
  groqApiKey: string
  authDisabled: boolean
  authSecret: string
  requestTimeoutMs: number
  maxBodyBytes: number
}

function readEnv(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function loadConfig(): AppConfig {
  const envRaw = readEnv('FLOWLARY_ENV', 'development')
  const env: FlowlaryEnv =
    envRaw === 'production' || envRaw === 'staging' ? envRaw : 'development'

  return {
    env,
    port: readNumber('PORT', 8787),
    groqApiKey: readEnv('GROQ_API_KEY'),
    authDisabled: readEnv('FLOWLARY_AUTH_DISABLED') === '1' || env === 'development',
    authSecret: readEnv('FLOWLARY_EXTENSION_AUTH_SECRET', 'dev-only-change-me'),
    requestTimeoutMs: readNumber('FLOWLARY_AI_TIMEOUT_MS', 30_000),
    maxBodyBytes: readNumber('FLOWLARY_MAX_BODY_BYTES', 64_000),
  }
}
