import type { Server } from 'node:http'
import { logError, logInfo, logWarn } from '../logging/logger.ts'

const SHUTDOWN_TIMEOUT_MS = 15_000

let shuttingDown = false
let activeServer: Server | null = null

export function registerActiveServer(server: Server): void {
  activeServer = server
}

export function isShuttingDown(): boolean {
  return shuttingDown
}

function shutdownSignalLabel(signal: NodeJS.Signals): string {
  return signal
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

export async function gracefulShutdown(reason: string, signal?: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logInfo('SERVICE_SHUTDOWN', {
    reason,
    signal: signal ? shutdownSignalLabel(signal) : undefined,
  })

  const server = activeServer
  if (!server) {
    process.exit(0)
    return
  }

  const forceTimer = setTimeout(() => {
    logError('SERVICE_SHUTDOWN', { phase: 'force_exit', reason: 'timeout' })
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  forceTimer.unref()

  try {
    await closeServer(server)
    clearTimeout(forceTimer)
    logInfo('SERVICE_SHUTDOWN', { phase: 'complete' })
    process.exit(0)
  } catch (err) {
    clearTimeout(forceTimer)
    logError('SERVICE_SHUTDOWN', {
      phase: 'failed',
      error: err instanceof Error ? err.message : 'unknown',
    })
    process.exit(1)
  }
}

export function installProcessHandlers(): void {
  process.on('SIGTERM', () => {
    void gracefulShutdown('signal', 'SIGTERM')
  })
  process.on('SIGINT', () => {
    void gracefulShutdown('signal', 'SIGINT')
  })

  process.on('uncaughtException', (err) => {
    logError('SERVICE_CRASH', {
      kind: 'uncaughtException',
      error: err.message,
      name: err.name,
    })
    void gracefulShutdown('uncaughtException').finally(() => process.exit(1))
  })

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    logError('SERVICE_CRASH', { kind: 'unhandledRejection', error: message })
  })
}

export function logDependencyUnavailable(name: string, detail?: string): void {
  logWarn('DEPENDENCY_UNAVAILABLE', { dependency: name, detail })
}

export function logAiProviderUnavailable(detail?: string): void {
  logWarn('AI_PROVIDER_UNAVAILABLE', { detail })
}
