import { GROQ_CHAT_COMPLETIONS_URL } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'

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

export async function callGroqChat(
  config: AppConfig,
  params: {
    model: string
    messages: GroqChatMessage[]
    temperature?: number
    maxTokens?: number
    responseFormat?: 'json_object' | 'text'
    signal?: AbortSignal
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
  if (params.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: params.signal,
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('invalid_api_key')
    if (res.status === 429) throw new Error('rate_limited')
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
