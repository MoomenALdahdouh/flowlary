/**
 * Evaluation-only Groq probe. Does not import production write paths.
 * Mirrors the production advisor payload, but records full HTTP metadata.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GROQ_CHAT_COMPLETIONS_URL, HYPOTHESIS_ADVISOR_SYSTEM_PROMPT } from '@flowlary/shared'
import { loadBackendEnvFile } from '../../../../backend/src/config/env.ts'
import type { ContractPacket } from './packets.ts'

export function loadGroqKey(): string {
  loadBackendEnvFile()
  for (const path of [
    resolve(process.cwd(), '../backend/.env'),
    resolve(process.cwd(), 'backend/.env'),
    resolve(process.cwd(), '.env'),
  ]) {
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.startsWith('GROQ_API_KEY=')) continue
      const value = line.slice('GROQ_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
      if (value) process.env.GROQ_API_KEY = value
    }
  }
  return process.env.GROQ_API_KEY ?? ''
}

export type FormatMode = 'json_object' | 'json_schema'

export type ProbeClass =
  | 'VALID'
  | 'INVALID_JSON'
  | 'EMPTY_CONTENT'
  | 'SCHEMA_FAILURE'
  | 'RATE_LIMIT'
  | 'AUTH_FAILURE'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'OTHER'

export type ProbeRecord = {
  packetId: string
  family: string
  goldHypothesisId: string
  config: string
  maxTokens: number
  format: FormatMode
  httpStatus: number | null
  groqErrorCode: string | null
  model: string | null
  latencyMs: number
  finishReason: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  reasoningTokens: number | null
  contentPresent: boolean
  contentLength: number
  validJson: boolean
  schemaValid: boolean
  unknownIds: boolean
  extraWriteFields: boolean
  rankedIds: string[]
  top1: string | null
  top1IsGold: boolean | null
  class: ProbeClass
}

const ADVISOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rankedHypothesisIds', 'ambiguityClass', 'reasonCode'],
  properties: {
    rankedHypothesisIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
    ambiguityClass: { type: 'string' },
    reasonCode: { type: 'string' },
  },
}

function classifyHttp(status: number | null, groqCode: string | null, timedOut: boolean): ProbeClass | null {
  if (timedOut) return 'TIMEOUT'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 401 || status === 403) return 'AUTH_FAILURE'
  if (status === 408) return 'TIMEOUT'
  if (status === 500 || status === 503) return 'SERVER_ERROR'
  if (status != null && status >= 500) return 'SERVER_ERROR'
  if (status === 400 && groqCode === 'json_validate_failed') return 'SCHEMA_FAILURE'
  return null
}

function validateContent(content: string, allowedIds: Set<string>): {
  validJson: boolean
  schemaValid: boolean
  unknownIds: boolean
  extraWriteFields: boolean
  rankedIds: string[]
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { validJson: false, schemaValid: false, unknownIds: false, extraWriteFields: false, rankedIds: [] }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { validJson: true, schemaValid: false, unknownIds: false, extraWriteFields: false, rankedIds: [] }
  }
  const value = parsed as Record<string, unknown>
  const extraWriteFields = 'replacement' in value || 'text' in value || 'write' in value
  if (!Array.isArray(value.rankedHypothesisIds) || value.rankedHypothesisIds.length === 0) {
    return { validJson: true, schemaValid: false, unknownIds: false, extraWriteFields, rankedIds: [] }
  }
  const ids = value.rankedHypothesisIds.filter((id): id is string => typeof id === 'string')
  const unknownIds = ids.length === 0 || ids.some((id) => !allowedIds.has(id))
  const schemaValid = (
    !extraWriteFields
    && ids.length > 0
    && !unknownIds
    && typeof value.ambiguityClass === 'string'
    && typeof value.reasonCode === 'string'
  )
  return { validJson: true, schemaValid, unknownIds, extraWriteFields, rankedIds: ids }
}

export async function probeAdvisor(
  packet: ContractPacket,
  options: { maxTokens: number; format: FormatMode; config: string },
): Promise<ProbeRecord> {
  const key = loadGroqKey()
  const allowedIds = new Set(packet.hypotheses.map((item) => item.id))
  const body: Record<string, unknown> = {
    model: 'openai/gpt-oss-20b',
    temperature: 0,
    max_tokens: options.maxTokens,
    include_reasoning: false,
    messages: [
      { role: 'system', content: HYPOTHESIS_ADVISOR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          cycleId: packet.cycleId,
          snippet: packet.snippet,
          allowedIntents: packet.allowedIntents,
          hypotheses: packet.hypotheses,
        }),
      },
    ],
  }
  if (options.format === 'json_object') {
    body.response_format = { type: 'json_object' }
  } else {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'advisor_vote', strict: true, schema: ADVISOR_SCHEMA },
    }
  }

  const started = Date.now()
  let status: number | null = null
  let groqErrorCode: string | null = null
  let timedOut = false
  let json: Record<string, unknown> | null = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    status = res.status
    const raw = (await res.json()) as Record<string, unknown>
    json = raw
    const err = raw.error as { code?: string } | undefined
    groqErrorCode = err?.code ?? null
  } catch (err) {
    timedOut = err instanceof DOMException && err.name === 'AbortError'
    if (!timedOut) {
      return {
        packetId: packet.id,
        family: packet.family,
        goldHypothesisId: packet.goldHypothesisId,
        config: options.config,
        maxTokens: options.maxTokens,
        format: options.format,
        httpStatus: status,
        groqErrorCode,
        model: null,
        latencyMs: Date.now() - started,
        finishReason: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        reasoningTokens: null,
        contentPresent: false,
        contentLength: 0,
        validJson: false,
        schemaValid: false,
        unknownIds: false,
        extraWriteFields: false,
        rankedIds: [],
        top1: null,
        top1IsGold: null,
        class: timedOut ? 'TIMEOUT' : 'OTHER',
      }
    }
  }

  const latencyMs = Date.now() - started
  const httpClass = classifyHttp(status, groqErrorCode, timedOut)
  const choice = (json?.choices as Array<Record<string, unknown>> | undefined)?.[0]
  const message = choice?.message as Record<string, unknown> | undefined
  const content = typeof message?.content === 'string' ? message.content : ''
  const usage = json?.usage as Record<string, unknown> | undefined
  const details = usage?.completion_tokens_details as Record<string, unknown> | undefined
  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : null
  const model = typeof json?.model === 'string' ? json.model : null

  if (httpClass && httpClass !== 'SCHEMA_FAILURE') {
    return {
      packetId: packet.id,
      family: packet.family,
      goldHypothesisId: packet.goldHypothesisId,
      config: options.config,
      maxTokens: options.maxTokens,
      format: options.format,
      httpStatus: status,
      groqErrorCode,
      model,
      latencyMs,
      finishReason,
      promptTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
      completionTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
      totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
      reasoningTokens: typeof details?.reasoning_tokens === 'number' ? details.reasoning_tokens : null,
      contentPresent: Boolean(content),
      contentLength: content.length,
      validJson: false,
      schemaValid: false,
      unknownIds: false,
      extraWriteFields: false,
      rankedIds: [],
      top1: null,
      top1IsGold: null,
      class: httpClass,
    }
  }

  if (!content) {
    return {
      packetId: packet.id,
      family: packet.family,
      goldHypothesisId: packet.goldHypothesisId,
      config: options.config,
      maxTokens: options.maxTokens,
      format: options.format,
      httpStatus: status,
      groqErrorCode,
      model,
      latencyMs,
      finishReason,
      promptTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
      completionTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
      totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
      reasoningTokens: typeof details?.reasoning_tokens === 'number' ? details.reasoning_tokens : null,
      contentPresent: false,
      contentLength: 0,
      validJson: false,
      schemaValid: false,
      unknownIds: false,
      extraWriteFields: false,
      rankedIds: [],
      top1: null,
      top1IsGold: null,
      class: httpClass === 'SCHEMA_FAILURE' ? 'SCHEMA_FAILURE' : 'EMPTY_CONTENT',
    }
  }

  const checked = validateContent(content, allowedIds)
  let klass: ProbeClass = 'OTHER'
  if (httpClass === 'SCHEMA_FAILURE') klass = 'SCHEMA_FAILURE'
  else if (!checked.validJson) klass = 'INVALID_JSON'
  else if (!checked.schemaValid) klass = 'SCHEMA_FAILURE'
  else klass = 'VALID'

  return {
    packetId: packet.id,
    family: packet.family,
    goldHypothesisId: packet.goldHypothesisId,
    config: options.config,
    maxTokens: options.maxTokens,
    format: options.format,
    httpStatus: status,
    groqErrorCode,
    model,
    latencyMs,
    finishReason,
    promptTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    completionTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
    totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
    reasoningTokens: typeof details?.reasoning_tokens === 'number' ? details.reasoning_tokens : null,
    contentPresent: true,
    contentLength: content.length,
    validJson: checked.validJson,
    schemaValid: checked.schemaValid,
    unknownIds: checked.unknownIds,
    extraWriteFields: checked.extraWriteFields,
    rankedIds: checked.rankedIds,
    top1: checked.rankedIds[0] ?? null,
    top1IsGold: checked.schemaValid ? checked.rankedIds[0] === packet.goldHypothesisId : null,
    class: klass,
  }
}

export function summarize(records: ProbeRecord[]) {
  const count = (klass: ProbeClass) => records.filter((item) => item.class === klass).length
  const non429 = records.filter((item) => item.class !== 'RATE_LIMIT')
  const valid = records.filter((item) => item.class === 'VALID')
  const byConfig: Record<string, { n: number; valid: number; rateLimit: number; schema: number; empty: number; invalidJson: number }> = {}
  for (const item of records) {
    const bucket = byConfig[item.config] ?? { n: 0, valid: 0, rateLimit: 0, schema: 0, empty: 0, invalidJson: 0 }
    bucket.n += 1
    if (item.class === 'VALID') bucket.valid += 1
    if (item.class === 'RATE_LIMIT') bucket.rateLimit += 1
    if (item.class === 'SCHEMA_FAILURE') bucket.schema += 1
    if (item.class === 'EMPTY_CONTENT') bucket.empty += 1
    if (item.class === 'INVALID_JSON') bucket.invalidJson += 1
    byConfig[item.config] = bucket
  }
  const lats = valid.map((item) => item.latencyMs).sort((a, b) => a - b)
  const pct = (p: number) => {
    if (!lats.length) return null
    return lats[Math.min(lats.length - 1, Math.max(0, Math.ceil((p / 100) * lats.length) - 1))]
  }
  return {
    total: records.length,
    valid: valid.length,
    rateLimit: count('RATE_LIMIT'),
    schemaFailure: count('SCHEMA_FAILURE'),
    empty: count('EMPTY_CONTENT'),
    invalidJson: count('INVALID_JSON'),
    auth: count('AUTH_FAILURE'),
    server: count('SERVER_ERROR'),
    timeout: count('TIMEOUT'),
    other: count('OTHER'),
    non429: non429.length,
    contractSuccessAmongNon429: non429.length ? valid.length / non429.length : null,
    goldTop1AmongValid: valid.length ? valid.filter((item) => item.top1IsGold).length / valid.length : null,
    byConfig,
    successLatency: {
      n: lats.length,
      p50: pct(50),
      p95: pct(95),
      max: lats.length ? lats[lats.length - 1] : null,
    },
  }
}
