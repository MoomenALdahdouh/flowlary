/**
 * CORS for Flowlary web origins.
 * Chrome extension service workers use manifest host_permissions (not browser CORS).
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FlowlaryEnv } from '../config/env.ts'

const PRODUCTION_ORIGINS = ['https://flowlary.com', 'https://www.flowlary.com']

const DEVELOPMENT_ORIGINS = [
  ...PRODUCTION_ORIGINS,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://flowlary.test',
  'http://flowlary.test:5173',
  'http://flowlary.test:4173',
  'https://flowlary.test',
  'https://www.flowlary.test',
  'http://www.flowlary.test',
  'http://www.flowlary.test:5173',
  'http://www.flowlary.test:4173',
]

export function readCorsOrigins(env?: FlowlaryEnv): string[] {
  const raw = process.env.FLOWLARY_CORS_ORIGINS?.trim()
  if (raw) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const resolved = env ?? parseEnvName(process.env.FLOWLARY_ENV)
  if (resolved === 'production' || resolved === 'staging') {
    return [...PRODUCTION_ORIGINS]
  }
  return [...DEVELOPMENT_ORIGINS]
}

function parseEnvName(raw: string | undefined): FlowlaryEnv {
  if (raw === 'production' || raw === 'staging') return raw
  return 'development'
}

export function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  origins?: string[],
): boolean {
  const origin = req.headers.origin
  const allowed = origins ?? readCorsOrigins()

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-Flowlary-Install-Id, X-Flowlary-Entitlement',
    )
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = origin && allowed.includes(origin) ? 204 : 403
    res.end()
    return true
  }

  return false
}
