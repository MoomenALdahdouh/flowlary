#!/usr/bin/env node
/**
 * Build release ZIP + SHA-256 from extension/dist (production release build).
 * Also publishes the ZIP to website/public/downloads for the temporary manual-install CTA.
 * Run: npm run build:release && npm run package:release
 *
 * Creates the ZIP without requiring a system `zip` binary (Python zipfile fallback).
 */
import { createHash } from 'node:crypto'
import { copyFileSync, createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'extension/dist')
const releaseDir = join(root, 'release')
const publicDownloads = join(root, 'website/public/downloads')
const require = createRequire(import.meta.url)

function readVersion() {
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
  return manifest.version ?? '0.0.0'
}

async function zipDist(version) {
  const zipName = `flowlary-v${version}.zip`
  const zipPath = join(releaseDir, zipName)
  rmSync(zipPath, { force: true })

  let archiver
  try {
    archiver = require('archiver')
  } catch {
    archiver = null
  }

  if (archiver) {
    await new Promise((resolvePromise, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })
      output.on('close', resolvePromise)
      archive.on('error', reject)
      archive.pipe(output)
      archive.directory(dist, false)
      void archive.finalize()
    })
    return { zipName, zipPath }
  }

  // Fallback: Python zipfile (available on Flowlary VPS; no system `zip` needed)
  const py = `
import os, zipfile
root = ${JSON.stringify(dist)}
out = ${JSON.stringify(zipPath)}
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            full = os.path.join(dirpath, name)
            zf.write(full, os.path.relpath(full, root))
`
  execSync('python3 -', { input: py, stdio: ['pipe', 'inherit', 'inherit'] })
  return { zipName, zipPath }
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function validateZip(zipPath) {
  const validateDir = join(releaseDir, '.validate-tmp')
  rmSync(validateDir, { recursive: true, force: true })
  mkdirSync(validateDir, { recursive: true })
  execSync(`unzip -q "${zipPath}" -d "${validateDir}"`)
  const builtManifest = JSON.parse(readFileSync(join(validateDir, 'manifest.json'), 'utf8'))
  const hosts = builtManifest.host_permissions ?? []
  if (hosts.some((h) => h.includes('localhost') || h.includes('127.0.0.1'))) {
    console.error('ERROR: release manifest still contains localhost host permissions')
    process.exit(1)
  }
  rmSync(validateDir, { recursive: true, force: true })
}

mkdirSync(releaseDir, { recursive: true })

const version = readVersion()
const { zipName, zipPath } = await zipDist(version)
const hash = sha256File(zipPath)
writeFileSync(join(releaseDir, `${zipName}.sha256`), `${hash}  ${zipName}\n`, 'utf8')

mkdirSync(publicDownloads, { recursive: true })
copyFileSync(zipPath, join(publicDownloads, zipName))
writeFileSync(join(publicDownloads, `${zipName}.sha256`), `${hash}  ${zipName}\n`, 'utf8')

console.log(`Release package: release/${zipName}`)
console.log(`Website download: website/public/downloads/${zipName}`)
console.log(`SHA-256: ${hash}`)

validateZip(zipPath)
console.log('Package validation: OK (no localhost in host_permissions)')
