import { GoogleAuth } from 'google-auth-library'
import { isValidAiResponseLength } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'

export type GoogleTranslateInput = {
  text: string
  sourceLanguage: string
  targetLanguage: string
}

export type GoogleTranslateResult = {
  translation: string
  model: string
}

export const GOOGLE_TRANSLATE_MODEL = 'google-translate'

export function isGoogleTranslateConfigured(config: AppConfig): boolean {
  if (!config.googleTranslateEnabled) return false
  if (config.googleTranslateApiKey.trim()) return true
  if (config.googleApplicationCredentials.trim()) return true
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return true
  return false
}

export class GoogleTranslateError extends Error {
  readonly kind: 'auth' | 'rate_limit' | 'quota' | 'timeout' | 'invalid' | 'unavailable'

  constructor(kind: GoogleTranslateError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

function mapGoogleHttpStatus(status: number, detail = ''): GoogleTranslateError {
  if (status === 401 || status === 403) {
    if (/quota|billing|RESOURCE_EXHAUSTED|dailyLimit/i.test(detail)) {
      return new GoogleTranslateError('quota', 'google_quota')
    }
    return new GoogleTranslateError('auth', 'google_auth_failed')
  }
  if (status === 429) return new GoogleTranslateError('rate_limit', 'google_rate_limited')
  if (status === 400) return new GoogleTranslateError('invalid', 'google_invalid_request')
  if (status === 503 || status === 504) {
    return new GoogleTranslateError('unavailable', `google_http_${status}`)
  }
  return new GoogleTranslateError('unavailable', `google_http_${status}`)
}

async function translateWithApiKey(
  config: AppConfig,
  input: GoogleTranslateInput,
  signal?: AbortSignal,
): Promise<string> {
  const url = new URL('https://translation.googleapis.com/language/translate/v2')
  url.searchParams.set('key', config.googleTranslateApiKey)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: input.text,
      source: input.sourceLanguage,
      target: input.targetLanguage,
      format: 'text',
    }),
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await res.json())
    } catch {
      /* ignore */
    }
    throw mapGoogleHttpStatus(res.status, detail)
  }

  const json = (await res.json()) as {
    data?: { translations?: Array<{ translatedText?: string }> }
  }
  const translated = json.data?.translations?.[0]?.translatedText
  if (!translated?.trim()) {
    throw new GoogleTranslateError('invalid', 'google_invalid_response')
  }
  return translated
}

async function translateWithAdc(
  config: AppConfig,
  input: GoogleTranslateInput,
  signal?: AbortSignal,
): Promise<string> {
  if (config.googleApplicationCredentials.trim()) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = config.googleApplicationCredentials.trim()
  }
  const projectId = config.googleProjectId.trim()
  if (!projectId) {
    throw new GoogleTranslateError('auth', 'google_project_missing')
  }
  const location = config.googleLocation.trim() || 'global'
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-translation'],
  })
  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()
  const token = typeof accessToken === 'string' ? accessToken : accessToken?.token
  if (!token) {
    throw new GoogleTranslateError('auth', 'google_auth_failed')
  }

  const parent = `projects/${projectId}/locations/${location}`
  const endpoint = `https://translation.googleapis.com/v3/${parent}:translateText`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [input.text],
      mimeType: 'text/plain',
      sourceLanguageCode: input.sourceLanguage,
      targetLanguageCode: input.targetLanguage,
    }),
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await res.json())
    } catch {
      /* ignore */
    }
    throw mapGoogleHttpStatus(res.status, detail)
  }

  const json = (await res.json()) as {
    translations?: Array<{ translatedText?: string }>
  }
  const translated = json.translations?.[0]?.translatedText
  if (!translated?.trim()) {
    throw new GoogleTranslateError('invalid', 'google_invalid_response')
  }
  return translated
}

export async function runGoogleTranslate(
  config: AppConfig,
  input: GoogleTranslateInput,
  signal?: AbortSignal,
): Promise<GoogleTranslateResult> {
  const text = input.text.trim()
  if (!text) throw new GoogleTranslateError('invalid', 'invalid_request')
  if (!isGoogleTranslateConfigured(config)) {
    throw new GoogleTranslateError('unavailable', 'google_not_configured')
  }

  try {
    const translated = config.googleTranslateApiKey.trim()
      ? await translateWithApiKey(config, { ...input, text }, signal)
      : await translateWithAdc(config, { ...input, text }, signal)

    const translation = translated.trim()
    if (!isValidAiResponseLength(translation)) {
      throw new GoogleTranslateError('invalid', 'google_invalid_response')
    }
    return { translation, model: GOOGLE_TRANSLATE_MODEL }
  } catch (err) {
    if (err instanceof GoogleTranslateError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GoogleTranslateError('timeout', 'google_timeout')
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GoogleTranslateError('timeout', 'google_timeout')
    }
    throw new GoogleTranslateError('unavailable', 'google_unavailable')
  }
}
