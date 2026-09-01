import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function loadBackendEnvFile(): void {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'backend/.env'),
    resolve(here, '../../.env'),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
    return
  }
}
import { readCorsOrigins } from '../middleware/cors.ts'

export type FlowlaryEnv = 'development' | 'staging' | 'production'

export type PaddleEnvironment = 'sandbox' | 'production'

export type AppConfig = {
  env: FlowlaryEnv
  port: number
  groqApiKey: string
  advisorEnabled: boolean
  writingReviewEnabled: boolean
  /** Failure-only Groq → Gemini → OpenRouter for writing review. Independent of advisor ranking fallback. */
  writingReviewFallbackEnabled: boolean
  /** Total deadline for one writing-review request, including failure-only fallbacks. */
  writingReviewTimeoutMs: number
  advisorProviderOrder: string[]
  groqAdvisorEnabled: boolean
  groqAdvisorModel: string
  groqAdvisorMaxTokens: number
  geminiAdvisorMaxTokens: number
  openRouterAdvisorMaxTokens: number
  /** @deprecated Use the provider-specific generation budgets. */
  advisorMaxTokens: number
  advisorTimeoutMs: number
  advisorFallbackMinRemainingMs: number
  advisorFallbackEnabled: boolean
  advisorMaxProviderAttempts: number
  advisorMaxFallbacks: number
  advisorUserRequestsPerMinute: number
  advisorGlobalRequestsPerMinute: number
  groqAdvisorRequestsPerMinute: number
  geminiAdvisorRequestsPerMinute: number
  openRouterAdvisorRequestsPerMinute: number
  geminiApiKey: string
  geminiAdvisorEnabled: boolean
  geminiAdvisorModel: string
  openRouterApiKey: string
  openRouterAdvisorEnabled: boolean
  openRouterAdvisorModel: string
  authDisabled: boolean
  authSecret: string
  jwtSecret: string
  dataPath: string
  requestTimeoutMs: number
  maxBodyBytes: number
  corsOrigins: string[]
  paddleEnvironment: PaddleEnvironment
  paddleApiKey: string
  paddleWebhookSecret: string
  paddleClientToken: string
  paddlePriceIdPro: string
  /** Optional annual Pro price. When unset, annual checkout is unavailable. */
  paddlePriceIdProYearly: string
  /** Official Google Cloud Translation (server only). */
  googleTranslateEnabled: boolean
  googleProjectId: string
  googleLocation: string
  googleApplicationCredentials: string
  googleTranslateApiKey: string
  /** auto | google | groq | google_then_groq */
  translationForceProvider: 'auto' | 'google' | 'groq' | 'google_then_groq'
  /** When 1, Free Google failures may fall back to Groq (observable, credit-gated). */
  translationAllowGroqFallback: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  emailFrom: string
  /** Public website origin for verification links (no trailing slash). */
  webOrigin: string
  /** Comma-separated admin emails allowed to access feedback admin APIs. */
  feedbackAdminEmails: string[]
  chromeWebStoreUrl: string | null
  edgeAddonsUrl: string | null
  publicStatsEnabled: boolean
  showRegisteredUsers: boolean
  showActiveUsers: boolean
  showWritingChecks: boolean
  showLinkedInstalls: boolean
  showInternalRating: boolean
  showStoreRatings: boolean
  showTestimonials: boolean
  showFeatureRequests: boolean
  showPlatforms: boolean
  showRoadmap: boolean
  /** Externally verified Chrome Web Store rating (manual config — never scraped). */
  verifiedChromeRating: number | null
  verifiedChromeReviewCount: number | null
  verifiedChromeRatingVerifiedAt: number | null
  verifiedEdgeRating: number | null
  verifiedEdgeReviewCount: number | null
  verifiedEdgeRatingVerifiedAt: number | null
}

function readEnv(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback
}

function readOptionalNumber(name: string): number | null {
  const raw = readEnv(name)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function readFlag(name: string, fallback: boolean): boolean {
  const raw = readEnv(name)
  if (!raw) return fallback
  return raw === '1' || raw.toLowerCase() === 'true'
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function readFlagAlias(name: string, legacyName: string, fallback: boolean): boolean {
  if (process.env[name] !== undefined) return readFlag(name, fallback)
  return readFlag(legacyName, fallback)
}

function readNumberAlias(name: string, legacyName: string, fallback: number): number {
  if (process.env[name] !== undefined) return readNumber(name, fallback)
  return readNumber(legacyName, fallback)
}

function readAdvisorProviderOrder(): string[] {
  const configured = (
    readEnv('AI_ADVISOR_PROVIDER_ORDER')
    || readEnv('ADVISOR_PROVIDER_ORDER')
    || 'groq,gemini,openrouter'
  )
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => provider === 'groq' || provider === 'gemini' || provider === 'openrouter')
  return [...new Set(configured)]
}


function parseTranslationForceProvider(
  raw: string,
): 'auto' | 'google' | 'groq' | 'google_then_groq' {
  const value = raw.trim().toLowerCase()
  if (value === 'google' || value === 'groq' || value === 'google_then_groq') return value
  return 'auto'
}

export function loadConfig(): AppConfig {
  const envRaw = readEnv('FLOWLARY_ENV', 'development')
  const env: FlowlaryEnv =
    envRaw === 'production' || envRaw === 'staging' ? envRaw : 'development'

  const authSecret = readEnv('FLOWLARY_EXTENSION_AUTH_SECRET', 'dev-only-change-me')
  const dataPath = readEnv('FLOWLARY_DATA_PATH', resolve(process.cwd(), 'data', 'flowlary-store.json'))

  const paddleEnvironmentRaw = readEnv('PADDLE_ENVIRONMENT', 'sandbox').toLowerCase()
  const paddleEnvironment: PaddleEnvironment =
    paddleEnvironmentRaw === 'production' ? 'production' : 'sandbox'

  return {
    env,
    port: readNumber('PORT', 8787),
    groqApiKey: readEnv('GROQ_API_KEY'),
    advisorEnabled: readFlag('ADVISOR_ENABLED', true),
    writingReviewEnabled: readFlag('WRITING_REVIEW_ENABLED', true),
    writingReviewFallbackEnabled: readFlag('WRITING_REVIEW_FALLBACK_ENABLED', true),
    writingReviewTimeoutMs: readNumber('WRITING_REVIEW_TIMEOUT_MS', 4_500),
    advisorProviderOrder: readAdvisorProviderOrder(),
    groqAdvisorEnabled: readFlag('GROQ_ADVISOR_ENABLED', true),
    groqAdvisorModel: readEnv('GROQ_ADVISOR_MODEL', 'openai/gpt-oss-20b'),
    // gpt-oss-20b spends reasoning tokens before JSON. Live probes at 180
    // return HTTP 400 json_validate_failed / CONTRACT_FAILURE. 512 is the
    // smallest previously measured budget that produced valid JSON on this
    // advisor packet. Still provider-specific and env-overridable.
    groqAdvisorMaxTokens: readNumberAlias(
      'GROQ_ADVISOR_MAX_TOKENS',
      'FLOWLARY_ADVISOR_MAX_TOKENS',
      512,
    ),
    geminiAdvisorMaxTokens: readNumber('GEMINI_ADVISOR_MAX_TOKENS', 512),
    openRouterAdvisorMaxTokens: readNumber('OPENROUTER_ADVISOR_MAX_TOKENS', 512),
    advisorMaxTokens: readNumberAlias(
      'GROQ_ADVISOR_MAX_TOKENS',
      'FLOWLARY_ADVISOR_MAX_TOKENS',
      512,
    ),
    advisorTimeoutMs: process.env.ADVISOR_TOTAL_DEADLINE_MS !== undefined
      ? readNumber('ADVISOR_TOTAL_DEADLINE_MS', 1_500)
      : readNumberAlias('ADVISOR_TIMEOUT_MS', 'FLOWLARY_ADVISOR_TIMEOUT_MS', 1_500),
    advisorFallbackMinRemainingMs: readNumber('ADVISOR_FALLBACK_MIN_REMAINING_MS', 100),
    advisorFallbackEnabled: readFlagAlias(
      'ADVISOR_FALLBACK_ENABLED',
      'FLOWLARY_ADVISOR_FALLBACK_ENABLED',
      false,
    ),
    advisorMaxProviderAttempts: Math.min(3, readNumber('ADVISOR_MAX_PROVIDER_ATTEMPTS', 3)),
    advisorMaxFallbacks: Math.min(2, readNumber('ADVISOR_MAX_FALLBACKS', 2)),
    advisorUserRequestsPerMinute: readNumber('ADVISOR_USER_RPM', 30),
    advisorGlobalRequestsPerMinute: readNumberAlias(
      'ADVISOR_GLOBAL_RPM',
      'FLOWLARY_ADVISOR_GLOBAL_RPM',
      60,
    ),
    groqAdvisorRequestsPerMinute: readNumber('GROQ_ADVISOR_RPM', 60),
    geminiAdvisorRequestsPerMinute: readNumber('GEMINI_ADVISOR_RPM', 60),
    openRouterAdvisorRequestsPerMinute: readNumber('OPENROUTER_ADVISOR_RPM', 60),
    geminiApiKey: readEnv('GEMINI_API_KEY'),
    geminiAdvisorEnabled: readFlag('GEMINI_ADVISOR_ENABLED', false),
    geminiAdvisorModel: readEnv('GEMINI_ADVISOR_MODEL', 'gemini-3.5-flash-lite'),
    openRouterApiKey: readEnv('OPENROUTER_API_KEY'),
    openRouterAdvisorEnabled: readFlag('OPENROUTER_ADVISOR_ENABLED', false),
    openRouterAdvisorModel: readEnv('OPENROUTER_ADVISOR_MODEL'),
    authDisabled: readEnv('FLOWLARY_AUTH_DISABLED') === '1' || env === 'development',
    authSecret,
    jwtSecret: readEnv('FLOWLARY_JWT_SECRET', authSecret),
    dataPath,
    requestTimeoutMs: readNumber('FLOWLARY_AI_TIMEOUT_MS', 30_000),
    maxBodyBytes: readNumber('FLOWLARY_MAX_BODY_BYTES', 64_000),
    corsOrigins: readCorsOrigins(env),
    paddleEnvironment,
    paddleApiKey: readEnv('PADDLE_API_KEY'),
    paddleWebhookSecret: readEnv('PADDLE_WEBHOOK_SECRET') || readEnv('PADDLE_NOTIFICATION_WEBHOOK_SECRET'),
    paddleClientToken: readEnv('PADDLE_CLIENT_TOKEN'),
    paddlePriceIdPro: readEnv('PADDLE_PRICE_ID_PRO'),
    paddlePriceIdProYearly: readEnv('PADDLE_PRICE_ID_PRO_YEARLY'),
    googleTranslateEnabled: readEnv('GOOGLE_TRANSLATE_ENABLED') === '1',
    googleProjectId: readEnv('GOOGLE_PROJECT_ID'),
    googleLocation: readEnv('GOOGLE_LOCATION', 'global'),
    googleApplicationCredentials: readEnv('GOOGLE_APPLICATION_CREDENTIALS'),
    googleTranslateApiKey: readEnv('GOOGLE_TRANSLATE_API_KEY'),
    translationForceProvider: parseTranslationForceProvider(readEnv('TRANSLATION_FORCE_PROVIDER', 'auto')),
    translationAllowGroqFallback: readEnv('TRANSLATION_ALLOW_GROQ_FALLBACK') === '1',
    smtpHost: readEnv('SMTP_HOST'),
    smtpPort: readNumber('SMTP_PORT', 1025),
    smtpSecure: readEnv('SMTP_SECURE') === '1',
    smtpUser: readEnv('SMTP_USER'),
    smtpPass: readEnv('SMTP_PASS'),
    emailFrom: readEnv('EMAIL_FROM', 'Flowlary <noreply@flowlary.com>'),
    webOrigin: readEnv(
      'FLOWLARY_WEB_ORIGIN',
      env === 'production' ? 'https://flowlary.com' : 'https://flowlary.test',
    ).replace(/\/$/, ''),
    feedbackAdminEmails: readEnv('FLOWLARY_FEEDBACK_ADMIN_EMAILS')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    chromeWebStoreUrl: readEnv('CHROME_WEB_STORE_URL') || null,
    edgeAddonsUrl: readEnv('EDGE_ADDONS_URL') || null,
    publicStatsEnabled: readFlag('FLOWLARY_PUBLIC_STATS_ENABLED', true),
    showRegisteredUsers: readFlag('FLOWLARY_PUBLIC_SHOW_REGISTERED_USERS', true),
    showActiveUsers: readFlag('FLOWLARY_PUBLIC_SHOW_ACTIVE_USERS', true),
    showWritingChecks: readFlag('FLOWLARY_PUBLIC_SHOW_WRITING_CHECKS', true),
    showLinkedInstalls: readFlag('FLOWLARY_PUBLIC_SHOW_LINKED_INSTALLS', true),
    showInternalRating: readFlag('FLOWLARY_PUBLIC_SHOW_INTERNAL_RATING', true),
    showStoreRatings: readFlag('FLOWLARY_PUBLIC_SHOW_STORE_RATINGS', true),
    showTestimonials: readFlag('FLOWLARY_PUBLIC_SHOW_TESTIMONIALS', true),
    showFeatureRequests: readFlag('FLOWLARY_PUBLIC_SHOW_FEATURE_REQUESTS', true),
    showPlatforms: readFlag('FLOWLARY_PUBLIC_SHOW_PLATFORMS', true),
    showRoadmap: readFlag('FLOWLARY_PUBLIC_SHOW_ROADMAP', true),
    verifiedChromeRating: readOptionalNumber('CHROME_STORE_RATING'),
    verifiedChromeReviewCount: readOptionalNumber('CHROME_STORE_REVIEW_COUNT'),
    verifiedChromeRatingVerifiedAt: readOptionalNumber('CHROME_STORE_RATING_VERIFIED_AT'),
    verifiedEdgeRating: readOptionalNumber('EDGE_STORE_RATING'),
    verifiedEdgeReviewCount: readOptionalNumber('EDGE_STORE_REVIEW_COUNT'),
    verifiedEdgeRatingVerifiedAt: readOptionalNumber('EDGE_STORE_RATING_VERIFIED_AT'),
  }
}
