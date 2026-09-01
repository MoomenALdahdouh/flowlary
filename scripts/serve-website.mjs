#!/usr/bin/env node
/**
 * Serve the built website on :5173 for https://flowlary.test without the Vite dev server.
 * Use when you want the site up without HMR (no 502 from Herd).
 */

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEBSITE = path.join(ROOT, 'website')
const DIST = path.join(WEBSITE, 'dist')
const PORT = 5173

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function log(message) {
  console.log(`[flowlary:web] ${message}`)
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  log('No build found — running npm run build:web first…')
  run('npm', ['run', 'build:web'], { cwd: ROOT })
}

log(`Serving ${DIST} on http://127.0.0.1:${PORT}`)
log('Open https://flowlary.test (Herd must proxy to this port).')
log('Stop with Ctrl+C.')

const child = spawn(
  'npx',
  ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { cwd: WEBSITE, stdio: 'inherit', env: process.env },
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
