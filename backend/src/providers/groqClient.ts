import { GROQ_CHAT_COMPLETIONS_URL } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { logAiProviderUnavailable } from '../server/lifecycle.ts'

const GROQ_CONNECT_TIMEOUT_MS = 10_000

function mergeAbortSignals(primary?: AbortSignal, secondary?: AbortSignal): AbortSignal | undefined {
  if (!primary && !secondary) return undefined
  if (!primary) return secondary
  if (!secondary) return primary
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([primary, secondary])
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (primary.aborted || secondary.aborted) {
    controller.abort()
    return controller.signal
  }
  primary.addEventListener('abort', abort, { once: true })
  secondary.addEventListener('abort', abort, { once: true })
  return controller.signal
}

export type GroqChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type GroqUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export type GroqChatResult = {
  content: string
  model: string
  usage?: GroqUsage
}

/** Groq reasoning models need `include_reasoning: false`; classic models reject the field. */
export function groqModelSupportsIncludeReasoning(model: string): boolean {
  return model.includes('gpt-oss')
}

export async function callGroqChat(
  config: AppConfig,
  params: {
    model: string
    messages: GroqChatMessage[]
    temperature?: number
    maxTokens?: number
    responseFormat?: 'json_object' | 'text'
    signal?: AbortSignal
    _retried503?: boolean
    _retriedJson400?: boolean
  },
): Promise<GroqChatResult> {
  if (!config.groqApiKey) {
    throw new Error('groq_http_503')
  }

  const body: Record<string, unknown> = {
    model: params.model,
    temperature: params.temperature ?? 0.1,
    max_tokens: params.maxTokens ?? 400,
    messages: params.messages,
  }
  if (groqModelSupportsIncludeReasoning(params.model)) {
    // Reasoning models (gpt-oss) otherwise emit empty `content` or fail JSON validation.
    body.include_reasoning = false
  }
  if (params.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' }
  }

  const connectController = new AbortController()
  const connectTimer = setTimeout(() => connectController.abort(), GROQ_CONNECT_TIMEOUT_MS)
  const onExternalAbort = () => connectController.abort()
  params.signal?.addEventListener('abort', onExternalAbort, { once: true })

  let res: Response
  try {
    res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: mergeAbortSignals(params.signal, connectController.signal),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (params.signal?.aborted) throw err
      logAiProviderUnavailable('connect_timeout')
      throw new Error('groq_connect_timeout')
    }
    logAiProviderUnavailable('network_failure')
    throw new Error('groq_network_failure')
  } finally {
    clearTimeout(connectTimer)
    params.signal?.removeEventListener('abort', onExternalAbort)
  }

  if (!res.ok) {
    let groqErrorCode: string | undefined
    try {
      const errJson = (await res.json()) as { error?: { code?: string } }
      groqErrorCode = errJson.error?.code
    } catch {
      /* ignore parse failures */
    }
    if (
      res.status === 400 &&
      params.responseFormat === 'json_object' &&
      !params._retriedJson400 &&
      groqErrorCode === 'json_validate_failed'
    ) {
      return callGroqChat(config, { ...params, responseFormat: 'text', _retriedJson400: true })
    }
    if (res.status === 401 || res.status === 403) throw new Error('invalid_api_key')
    if (res.status === 429) throw new Error('rate_limited')
    if (res.status === 503 && !params._retried503) {
      await new Promise((r) => setTimeout(r, 600))
      return callGroqChat(config, { ...params, _retried503: true })
    }
    throw new Error(`groq_http_${res.status}`)
  }

  const json = (await res.json()) as {
    model?: string
    choices?: Array<{ message?: { content?: string | null } }>
    usage?: GroqUsage
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('invalid_response')
  return {
    content,
    model: json.model ?? params.model,
    usage: json.usage,
  }
}
