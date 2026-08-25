import { createServer } from 'node:http'
import { loadConfig } from './config/env.ts'
import { handleHttpRequest } from './routes/http.ts'
import { logInfo } from './logging/logger.ts'

export function createFlowlaryServer(config = loadConfig()) {
  return createServer((req, res) => {
    void handleHttpRequest(config, req, res).catch(() => {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'Internal error' } }))
    })
  })
}

export function startServer(config = loadConfig()): ReturnType<typeof createServer> {
  const server = createFlowlaryServer(config)
  server.listen(config.port, () => {
    logInfo('server.start', {
      port: config.port,
      env: config.env,
      authDisabled: config.authDisabled,
      groqConfigured: Boolean(config.groqApiKey),
    })
  })
  return server
}

const isDirectRun = process.argv[1]?.includes('/backend/src/index')

if (isDirectRun) {
  startServer()
}
