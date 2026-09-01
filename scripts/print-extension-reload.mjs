#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const dist = join(resolve(import.meta.dirname, '..'), 'extension/dist')

function collectServiceWorkerChunks() {
  const loaderPath = join(dist, 'service-worker-loader.js')
  if (!existsSync(loaderPath)) return []

  const loader = readFileSync(loaderPath, 'utf8')
  const importMatch = loader.match(/import\s+['"](.+?)['"]/)
  if (!importMatch) return []

  const visited = new Set()
  const queue = [join(dist, importMatch[1].replace(/^\.\//, ''))]
  const files = []

  while (queue.length > 0) {
    const file = queue.shift()
    if (!file || visited.has(file) || !existsSync(file)) continue
    visited.add(file)
    files.push(file)

    const content = readFileSync(file, 'utf8')
    for (const match of content.matchAll(/(?:from|import)\s+['"](\.\/[^'"]+)['"]/g)) {
      queue.push(join(dirname(file), match[1]))
    }
  }

  return files
}

function assertServiceWorkerSafe() {
  const chunks = collectServiceWorkerChunks()
  for (const file of chunks) {
    const content = readFileSync(file, 'utf8')
    if (/\bdocument\s*[.[]/.test(content)) {
      console.error('')
      console.error('Build failed: service worker bundle references `document`:')
      console.error(`  ${file}`)
      console.error('')
      process.exit(1)
    }
  }
}

const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
const isReleaseBuild = process.env.FLOWLARY_RELEASE === '1'
const hostPermissions = manifest.host_permissions ?? []
const hasLocalhostApi = hostPermissions.some((entry) =>
  /127\.0\.0\.1:8787|localhost:8787|writing-api\.test/.test(entry),
)
if (!isReleaseBuild && !hasLocalhostApi) {
  console.error('')
  console.error('Build failed: dev extension manifest is missing local API host_permissions.')
  console.error('Expected writing-api.test and/or 127.0.0.1:8787 in host_permissions.')
  console.error('')
  process.exit(1)
}
if (isReleaseBuild && hasLocalhostApi) {
  console.error('')
  console.error('Build failed: release extension manifest must not include local API host_permissions.')
  console.error('')
  process.exit(1)
}
assertServiceWorkerSafe()

const version = manifest.version ?? '?'
const versionName = manifest.version_name ?? version

console.log('')
console.log('Flowlary extension built successfully.')
console.log(`Version: ${version} (${versionName})`)
console.log('')
console.log('To see changes in Chrome:')
console.log('  1. Open chrome://extensions')
console.log('  2. Enable Developer mode')
console.log('  3. Load unpacked → select this folder:')
console.log(`     ${dist}`)
console.log('  4. If already loaded, click the Reload (↻) button on the Flowlary card')
console.log('  5. Close any open popup and click the toolbar icon again')
console.log('')
console.log('Do NOT load the extension/ source folder — only extension/dist/')
console.log('')
