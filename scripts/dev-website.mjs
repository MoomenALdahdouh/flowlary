#!/usr/bin/env node
/**
 * Start the Flowlary marketing website for https://flowlary.test (Laravel Herd).
 * Herd proxies TLS → Vite on :5173. Without Vite running, nginx returns 502.
 */

import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEBSITE = path.join(ROOT, 'website')
const PORT = 5173
const HOST = 'flowlary.test'
const UPSTREAM = `http://127.0.0.1:${PORT}`

function log(message) {
  console.log(`[flowlary:web] ${message}`)
}

function warn(message) {
  console.warn(`[flowlary:web] ${message}`)
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.setTimeout(400, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function herdProxies() {
  const result = spawnSync('herd', ['proxies'], { encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout
}

function ensureHerdProxy() {
  const listing = herdProxies()
  if (listing == null) {
    warn('Could not read Herd proxies. Install Laravel Herd or run:')
    warn(`  herd proxy ${HOST} ${UPSTREAM} --secure`)
    return
  }

  if (listing.includes(HOST) && listing.includes(String(PORT))) {
    log(`Herd proxy OK: https://${HOST} → ${UPSTREAM}`)
    return
  }

  warn(`Herd proxy for ${HOST} is missing or points elsewhere.`)
  warn('Fix it once with:')
  warn(`  herd unlink flowlary 2>/dev/null; herd proxy ${HOST} ${UPSTREAM} --secure`)
}

async function main() {
  if (await portOpen(PORT)) {
    log(`Port ${PORT} is already in use — Vite may already be running.`)
    log(`Open https://${HOST}`)
    process.exit(0)
  }

  ensureHerdProxy()

  log(`Starting Vite on ${UPSTREAM}…`)
  log(`Then open https://${HOST} (leave this process running).`)
  log('Direct URL: http://127.0.0.1:5173')
  log('Stop with Ctrl+C.')

  const child = spawn('npm', ['run', 'dev'], {
    cwd: WEBSITE,
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 1)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
