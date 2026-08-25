import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AppConfig } from '../config/env.ts'
import { authenticateRequest, createInstallToken } from '../middleware/auth.ts'
import { GatewayError } from '../gateway/errors.ts'
import { createGateway, createRequestMeta } from '../gateway/index.ts'
import { checkRateLimit, resetRateLimitsForTests } from '../middleware/rateLimit.ts'

type JsonRecord = Record<string, unknown>

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<JsonRecord> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      throw new GatewayError('AI_INVALID_REQUEST', 'Request body too large', 413, 'body')
    }
    chunks.push(buf)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid')
    }
    return parsed as JsonRecord
  } catch {
    throw new GatewayError('AI_INVALID_REQUEST', 'Invalid JSON body', 400, 'body')
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function headerMap(req: IncomingMessage): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    map[key.toLowerCase()] = Array.isArray(value) ? value[0] : value
  }
  return map
}

function errorResponse(err: GatewayError) {
  return {
    ok: false,
    error: {
      code: err.code,
      message: err.message,
      requestId: err.requestId,
    },
  }
}

export async function handleHttpRequest(
  config: AppConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const method = req.method ?? 'GET'
  const headers = headerMap(req)

  if (method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'flowlary-ai-gateway' })
    return
  }

  if (method === 'POST' && url.pathname === '/api/auth/register') {
    try {
      const body = await readJsonBody(req, config.maxBodyBytes)
      const installId = typeof body.install_id === 'string' ? body.install_id.trim() : ''
      if (!/^[a-f0-9-]{16,128}$/i.test(installId)) {
        sendJson(
          res,
          400,
          errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid install id', 400, 'register')),
        )
        return
      }
      const token = createInstallToken(installId, config)
      sendJson(res, 200, { ok: true, install_id: installId, token })
    } catch (err) {
      const mapped =
        err instanceof GatewayError
          ? err
          : new GatewayError('AI_INVALID_REQUEST', 'Registration failed', 400, 'register')
      sendJson(res, mapped.status, errorResponse(mapped))
    }
    return
  }

  if (method !== 'POST') {
    sendJson(res, 405, errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Method not allowed', 405, 'route')))
    return
  }

  let auth
  try {
    auth = authenticateRequest(config, headers)
  } catch (err) {
    const mapped = err instanceof GatewayError ? err : new GatewayError('AI_AUTH_FAILED', 'Authentication failed', 401, 'auth')
    sendJson(res, mapped.status, errorResponse(mapped))
    return
  }

  const gateway = createGateway(config)
  const meta = createRequestMeta(auth)

  try {
    const body = await readJsonBody(req, config.maxBodyBytes)

    if (url.pathname === '/api/ai/correction') {
      const text = typeof body.text === 'string' ? body.text : ''
      const result = await gateway.correction(meta, {
        text,
        fieldType: typeof body.fieldType === 'string' ? body.fieldType : undefined,
        previousText: typeof body.previousText === 'string' ? body.previousText : undefined,
      })
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/translation' || url.pathname === '/api/translate') {
      const text = typeof body.text === 'string' ? body.text : ''
      const sourceLanguage =
        typeof body.source_language === 'string'
          ? body.source_language
          : typeof body.sourceLanguage === 'string'
            ? body.sourceLanguage
            : ''
      const targetLanguage =
        typeof body.target_language === 'string'
          ? body.target_language
          : typeof body.targetLanguage === 'string'
            ? body.targetLanguage
            : ''
      const mode =
        typeof body.context === 'object' &&
        body.context !== null &&
        typeof (body.context as JsonRecord).mode === 'string'
          ? ((body.context as JsonRecord).mode as string)
          : typeof body.mode === 'string'
            ? body.mode
            : 'shortcut'

      const result = await gateway.translation(meta, {
        text,
        sourceLanguage,
        targetLanguage,
        mode,
      })

      if (url.pathname === '/api/translate') {
        sendJson(res, 200, { translation: result.translation })
        return
      }
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/api/ai/layout-classification' || url.pathname === '/api/analyze-word') {
      const word = typeof body.word === 'string' ? body.word : ''
      const sourceLayout =
        typeof body.source_layout === 'string'
          ? body.source_layout
          : typeof body.sourceLayout === 'string'
            ? body.sourceLayout
            : ''
      const candidateLayouts = Array.isArray(body.candidate_layouts)
        ? body.candidate_layouts.filter((item): item is string => typeof item === 'string')
        : Array.isArray(body.candidateLayouts)
          ? body.candidateLayouts.filter((item): item is string => typeof item === 'string')
          : []

      const result = await gateway.layoutClassification(meta, {
        word,
        context: typeof body.context === 'string' ? body.context : undefined,
        sourceLayout,
        candidateLayouts,
      })

      if (url.pathname === '/api/analyze-word') {
        sendJson(res, 200, { result: result.result })
        return
      }
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 404, errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Not found', 404, meta.requestId)))
  } catch (err) {
    if (err instanceof Error && err.message === 'rate_limited') {
      sendJson(
        res,
        429,
        errorResponse(new GatewayError('AI_RATE_LIMITED', 'Rate limit exceeded', 429, meta.requestId)),
      )
      return
    }
    if (err instanceof Error && err.message === 'invalid_request') {
      sendJson(
        res,
        400,
        errorResponse(new GatewayError('AI_INVALID_REQUEST', 'Invalid request', 400, meta.requestId)),
      )
      return
    }
    const mapped = err instanceof GatewayError ? err : new GatewayError('AI_UNAVAILABLE', 'Service unavailable', 503, meta.requestId)
    sendJson(res, mapped.status, errorResponse(mapped))
  }
}

export function resetRoutesForTests(): void {
  resetRateLimitsForTests()
}
