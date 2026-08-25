#!/usr/bin/env node
/**
 * Build release ZIP + SHA-256 from extension/dist (production release build).
 * Run: npm run build:release && npm run package:release
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'extension/dist')
const releaseDir = join(root, 'release')

function readVersion() {
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
  return manifest.version ?? '0.0.0'
}

function zipDist(version) {
  const zipName = `flowlary-v${version}.zip`
  const zipPath = join(releaseDir, zipName)
  rmSync(zipPath, { force: true })
  execSync(`cd "${dist}" && zip -r "${zipPath}" .`, { stdio: 'inherit' })
  return { zipName, zipPath }
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

mkdirSync(releaseDir, { recursive: true })

const version = readVersion()
const { zipName, zipPath } = zipDist(version)
const hash = sha256File(zipPath)
const hashFile = join(releaseDir, `${zipName}.sha256`)
writeFileSync(hashFile, `${hash}  ${zipName}\n`, 'utf8')

console.log(`Release package: release/${zipName}`)
console.log(`SHA-256: ${hash}`)

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

console.log('Package validation: OK (no localhost in host_permissions)')
