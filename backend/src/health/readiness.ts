import { accessSync, constants, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AppConfig } from '../config/env.ts'
import { ensureLoaded } from '../db/store.ts'

export type ReadinessCheck = {
  name: string
  ok: boolean
  detail?: string
}

export type ReadinessReport = {
  ready: boolean
  checks: ReadinessCheck[]
}

function checkRequiredSecrets(config: AppConfig): ReadinessCheck {
  if (config.env !== 'production') {
    return { name: 'secrets', ok: true, detail: 'skipped_in_non_production' }
  }
  const missing: string[] = []
  if (!config.groqApiKey) missing.push('GROQ_API_KEY')
  if (!config.jwtSecret || config.jwtSecret === 'dev-only-change-me') missing.push('FLOWLARY_JWT_SECRET')
  if (!config.authSecret || config.authSecret === 'dev-only-change-me') {
    missing.push('FLOWLARY_EXTENSION_AUTH_SECRET')
  }
  if (config.corsOrigins.length === 0) missing.push('FLOWLARY_CORS_ORIGINS')
  if (!config.webOrigin) missing.push('FLOWLARY_WEB_ORIGIN')
  return missing.length === 0
    ? { name: 'secrets', ok: true }
    : { name: 'secrets', ok: false, detail: `missing:${missing.join(',')}` }
}

function checkDataStore(config: AppConfig): ReadinessCheck {
  if (config.dataPath === ':memory:') {
    return { name: 'store', ok: true, detail: 'memory' }
  }
  try {
    ensureLoaded()
    const dir = dirname(config.dataPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    accessSync(dir, constants.W_OK)
    const probe = `${config.dataPath}.ready-probe`
    writeFileSync(probe, 'ok', 'utf8')
    unlinkSync(probe)
    return { name: 'store', ok: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'store_unavailable'
    return { name: 'store', ok: false, detail }
  }
}

function checkAdvisorProviders(config: AppConfig): ReadinessCheck {
  if (config.env !== 'production') {
    return { name: 'advisor_providers', ok: true, detail: 'skipped_in_non_production' }
  }
  if (!config.advisorEnabled) {
    return { name: 'advisor_providers', ok: true, detail: 'advisor_disabled' }
  }
  const missing: string[] = []
  if (config.groqAdvisorEnabled && !config.groqApiKey) missing.push('GROQ_API_KEY')
  if (config.advisorFallbackEnabled) {
    if (config.geminiAdvisorEnabled && !config.geminiApiKey) missing.push('GEMINI_API_KEY')
    if (config.openRouterAdvisorEnabled) {
      if (!config.openRouterApiKey) missing.push('OPENROUTER_API_KEY')
      if (!config.openRouterAdvisorModel) missing.push('OPENROUTER_ADVISOR_MODEL')
    }
  }
  return missing.length === 0
    ? { name: 'advisor_providers', ok: true }
    : { name: 'advisor_providers', ok: false, detail: `missing:${missing.join(',')}` }
}

/** Application readiness — required dependencies for serving traffic. Does not probe live AI APIs. */
export function evaluateReadiness(config: AppConfig): ReadinessReport {
  const checks = [
    checkRequiredSecrets(config),
    checkDataStore(config),
    checkAdvisorProviders(config),
  ]
  return {
    ready: checks.every((check) => check.ok),
    checks,
  }
}
