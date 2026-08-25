#!/usr/bin/env node
/**
 * Live API verification — run with GROQ_API_KEY in backend/.env
 * Usage: node scripts/verify-live-api.mjs
 * Never logs secrets or user text.
 */
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, 'backend/.env')

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return out
}

const envFile = loadEnvFile(envPath)
const base = process.env.FLOWLARY_API_BASE ?? 'http://127.0.0.1:8787'
const groqKey = process.env.GROQ_API_KEY ?? envFile.GROQ_API_KEY

const results = []

function record(name, status, detail) {
  results.push({ name, status, detail })
}

async function waitForHealth(maxMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return true
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

async function registerInstall() {
  const installId = crypto.randomUUID()
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ install_id: installId }),
  })
  if (!res.ok) throw new Error(`register_http_${res.status}`)
  const body = await res.json()
  return { installId, token: body.token }
}

async function postAi(path, auth, payload) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
      'X-Flowlary-Install-Id': auth.installId,
      'X-Flowlary-Entitlement': 'free',
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function main() {
  if (!groqKey) {
    record('credentials', 'NOT VERIFIED', 'GROQ_API_KEY missing in backend/.env')
    printReport()
    process.exit(0)
  }

  const server = spawn('node', ['--import', 'tsx', 'src/index.ts'], {
    cwd: resolve(root, 'backend'),
    env: {
      ...process.env,
      ...envFile,
      GROQ_API_KEY: groqKey,
      FLOWLARY_ENV: 'development',
      FLOWLARY_AUTH_DISABLED: '1',
      PORT: '8787',
    },
    stdio: 'ignore',
  })

  try {
    const healthy = await waitForHealth()
    if (!healthy) {
      record('server', 'BLOCKED', 'health check timeout')
      printReport()
      process.exit(1)
    }
    record('server', 'VERIFIED', 'health OK')

    const auth = await registerInstall()
    record('auth', 'VERIFIED', 'install registered')

    const correction = await postAi('/api/ai/correction', auth, {
      text: 'I dont know what to write today.',
    })
    if (correction.status === 200 && correction.body.ok) {
      record('correction', 'VERIFIED', `model=${correction.body.model ?? 'unknown'}`)
    } else {
      record('correction', 'NOT VERIFIED', `http_${correction.status}`)
    }

    const translation = await postAi('/api/ai/translation', auth, {
      text: 'Hello',
      source_language: 'en',
      target_language: 'ar',
    })
    if (translation.status === 200 && translation.body.ok && translation.body.translation) {
      record('translation', 'VERIFIED', `model=${translation.body.model ?? 'unknown'}`)
    } else {
      record('translation', 'NOT VERIFIED', `http_${translation.status}`)
    }

    const layout = await postAi('/api/ai/layout-classification', auth, {
      word: 'zzzzunknown',
      source_layout: 'en-US-qwerty',
      candidate_layouts: ['ar-101'],
    })
    if (layout.status === 200 && layout.body.ok) {
      record('layout', 'VERIFIED', `kind=${layout.body.result?.kind ?? 'unknown'}`)
    } else {
      record('layout', 'NOT VERIFIED', `http_${layout.status}`)
    }
  } catch (err) {
    record('runtime', 'BLOCKED', err instanceof Error ? err.message : 'unknown')
  } finally {
    server.kill('SIGTERM')
  }

  printReport()
}

function printReport() {
  console.log('Flowlary Live API Verification')
  console.log('------------------------------')
  for (const row of results) {
    console.log(`${row.status.padEnd(14)} ${row.name} — ${row.detail}`)
  }
}

main()
