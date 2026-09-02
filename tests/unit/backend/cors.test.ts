import { afterEach, describe, expect, it } from 'vitest'
import { applyCors, readCorsOrigins } from '../../../backend/src/middleware/cors.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

function mockRes() {
  const headers: Record<string, string> = {}
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name] = value
    },
    end() {},
  }
  return { res, headers }
}

describe('CORS configuration', () => {
  const originalOrigins = process.env.FLOWLARY_CORS_ORIGINS
  const originalEnv = process.env.FLOWLARY_ENV

  afterEach(() => {
    if (originalOrigins === undefined) delete process.env.FLOWLARY_CORS_ORIGINS
    else process.env.FLOWLARY_CORS_ORIGINS = originalOrigins
    if (originalEnv === undefined) delete process.env.FLOWLARY_ENV
    else process.env.FLOWLARY_ENV = originalEnv
  })

  it('defaults to flowlary.com origins in production', () => {
    delete process.env.FLOWLARY_CORS_ORIGINS
    expect(readCorsOrigins('production')).toEqual(['https://flowlary.com', 'https://www.flowlary.com'])
    expect(readCorsOrigins('production')).not.toContain('*')
  })

  it('does not use a wildcard in development defaults', () => {
    delete process.env.FLOWLARY_CORS_ORIGINS
    expect(readCorsOrigins('development')).not.toContain('*')
    expect(readCorsOrigins('development')).toEqual(
      expect.arrayContaining([
        'https://flowlary.com',
        'https://www.flowlary.com',
        'http://localhost:5173',
        'http://flowlary.test:5173',
        'http://flowlary.test:4173',
        'https://flowlary.test',
      ]),
    )
  })

  it('parses custom origin list', () => {
    process.env.FLOWLARY_CORS_ORIGINS = 'https://flowlary.com,https://staging.flowlary.com'
    expect(readCorsOrigins('production')).toEqual(['https://flowlary.com', 'https://staging.flowlary.com'])
  })

  it.each(['https://flowlary.com', 'https://www.flowlary.com'] as const)(
    'allows OPTIONS preflight from %s',
    (origin) => {
      const { res, headers } = mockRes()
      const handled = applyCors(
        { method: 'OPTIONS', headers: { origin } } as IncomingMessage,
        res as unknown as ServerResponse,
        ['https://flowlary.com', 'https://www.flowlary.com'],
      )
      expect(handled).toBe(true)
      expect(res.statusCode).toBe(204)
      expect(headers['Access-Control-Allow-Origin']).toBe(origin)
      expect(headers['Access-Control-Allow-Origin']).not.toBe('*')
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined()
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, DELETE, OPTIONS')
      expect(headers['Access-Control-Allow-Headers']).toMatch(/Authorization/i)
      expect(headers['Access-Control-Allow-Headers']).toMatch(/Content-Type/i)
      expect(headers['Access-Control-Allow-Headers']).toMatch(/X-Flowlary-Install-Id/i)
      expect(headers['Access-Control-Allow-Headers']).toMatch(/X-Flowlary-Entitlement/i)
      expect(headers['Access-Control-Allow-Headers']).toMatch(/X-Flowlary-Client/i)
      expect(headers['Access-Control-Allow-Headers']).toMatch(/X-Flowlary-Surface/i)
    },
  )

  it('echoes allow headers on GET so Authorization credential requests can complete', () => {
    const { res, headers } = mockRes()
    const handled = applyCors(
      {
        method: 'GET',
        headers: {
          origin: 'https://flowlary.com',
          authorization: 'Bearer token',
        },
      } as IncomingMessage,
      res as unknown as ServerResponse,
      ['https://flowlary.com', 'https://www.flowlary.com'],
    )
    expect(handled).toBe(false)
    expect(headers['Access-Control-Allow-Origin']).toBe('https://flowlary.com')
    expect(headers['Access-Control-Allow-Headers']).toMatch(/Authorization/i)
    expect(headers['Access-Control-Allow-Headers']).toMatch(/X-Flowlary-Client/i)
    expect(headers['Access-Control-Allow-Headers']).toMatch(/X-Flowlary-Surface/i)
  })

  it('rejects OPTIONS preflight from unknown origins', () => {
    const { res, headers } = mockRes()
    const handled = applyCors(
      { method: 'OPTIONS', headers: { origin: 'https://evil.example' } } as IncomingMessage,
      res as unknown as ServerResponse,
      ['https://flowlary.com'],
    )
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(403)
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('does not grant CORS headers on GET from a disallowed origin', () => {
    const { res, headers } = mockRes()
    applyCors(
      { method: 'GET', headers: { origin: 'https://evil.example' } } as IncomingMessage,
      res as unknown as ServerResponse,
      ['https://flowlary.com', 'https://www.flowlary.com'],
    )
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
  })
})
