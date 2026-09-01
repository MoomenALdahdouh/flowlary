import { createServer } from 'node:http'
import { loadConfig, loadBackendEnvFile } from './config/env.ts'
import { configureStorePath } from './db/store.ts'
import { evaluateReadiness } from './health/readiness.ts'
import { handleHttpRequest } from './routes/http.ts'
import { logError, logInfo, logWarn } from './logging/logger.ts'
import {
  installProcessHandlers,
  isShuttingDown,
  registerActiveServer,
} from './server/lifecycle.ts'

export function createFlowlaryServer(config = loadConfig()) {
  return createServer((req, res) => {
    if (isShuttingDown()) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Connection', 'close')
      res.end(JSON.stringify({ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'Shutting down' } }))
      return
    }
    void handleHttpRequest(config, req, res).catch((err) => {
      logError('request.unhandled', {
        error: err instanceof Error ? err.message : 'unknown',
        path: req.url,
      })
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'Internal error' } }))
      }
    })
  })
}

export function startServer(config = loadConfig()): ReturnType<typeof createServer> {
  configureStorePath(config.dataPath)
  const readiness = evaluateReadiness(config)
  const host = process.env.HOST?.trim() || '0.0.0.0'

  const server = createFlowlaryServer(config)
  registerActiveServer(server)

  server.on('error', (err: NodeJS.ErrnoException) => {
    logError('SERVICE_CRASH', { kind: 'listen_error', error: err.message, code: err.code })
    process.exit(1)
  })

  server.listen(config.port, host, () => {
    logInfo('SERVICE_STARTED', {
      port: config.port,
      host,
      env: config.env,
      authDisabled: config.authDisabled,
      groqConfigured: Boolean(config.groqApiKey),
      advisorEnabled: config.advisorEnabled,
      writingReviewEnabled: config.writingReviewEnabled,
      writingReviewFallbackEnabled: config.writingReviewFallbackEnabled,
      writingReviewTimeoutMs: config.writingReviewTimeoutMs,
      advisorFallbackEnabled: config.advisorFallbackEnabled,
      advisorProviderOrder: config.advisorProviderOrder.join(','),
      groqAdvisorEnabled: config.groqAdvisorEnabled,
      geminiAdvisorEnabled: config.geminiAdvisorEnabled,
      openRouterAdvisorEnabled: config.openRouterAdvisorEnabled,
      openRouterAdvisorConfigured: Boolean(config.openRouterApiKey && config.openRouterAdvisorModel),
      paddleEnvironment: config.paddleEnvironment,
      billingConfigured: Boolean(config.paddleWebhookSecret || (config.paddleApiKey && config.paddlePriceIdPro)),
    })

    if (readiness.ready) {
      logInfo('SERVICE_READY', { checks: readiness.checks.map((c) => c.name).join(',') })
    } else {
      logWarn('SERVICE_NOT_READY', {
        failed: readiness.checks.filter((c) => !c.ok).map((c) => `${c.name}:${c.detail ?? 'failed'}`).join(','),
      })
    }
  })

  return server
}

const isDirectRun = process.argv[1]?.includes('/backend/src/index')

if (isDirectRun) {
  loadBackendEnvFile()
  installProcessHandlers()
  startServer()
}
