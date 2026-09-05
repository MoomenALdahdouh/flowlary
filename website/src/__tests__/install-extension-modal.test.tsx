/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App.tsx'
import { I18nProvider } from '../i18n/index.tsx'
import { AddToChromeButton } from '../components/install/AddToChromeButton.tsx'
import { InstallExtensionModal } from '../components/install/InstallExtensionModal.tsx'
import {
  STABLE_EXTENSION_DOWNLOAD_PATH,
  STABLE_EXTENSION_VERSION,
  STABLE_EXTENSION_ZIP_NAME,
} from '../components/install/extensionRelease.ts'
import { BRAND } from '@flowlary/shared'
import { existsSync, readFileSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const repoRoot = resolve(import.meta.dirname, '../../..')
const publicZip = resolve(repoRoot, 'website/public/downloads', STABLE_EXTENSION_ZIP_NAME)
const releaseZip = resolve(repoRoot, 'release', STABLE_EXTENSION_ZIP_NAME)

let root: Root | null = null
let host: HTMLDivElement | null = null

function mount(node: ReactNode) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => {
    root!.render(node)
  })
  return host
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  root = null
  host?.remove()
  host = null
  document.body.style.overflow = ''
})

describe('Add to Chrome install modal', () => {
  it('opens a modal without navigating away', () => {
    const el = mount(
      <MemoryRouter initialEntries={['/']}>
        <I18nProvider>
          <AddToChromeButton className="fl-nav-cta" />
        </I18nProvider>
      </MemoryRouter>,
    )

    const button = el.querySelector('button.fl-nav-cta') as HTMLButtonElement
    expect(button).toBeTruthy()
    expect(button.textContent).toMatch(/Add to Chrome/i)
    expect(el.querySelector('a.fl-nav-cta')).toBeNull()

    act(() => {
      button.click()
    })

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toMatch(/Install Flowlary for Chrome/i)
    expect(dialog.textContent).toMatch(/Download Flowlary/i)
    expect(dialog.textContent).toMatch(/Extract the downloaded ZIP/i)
    expect(dialog.textContent).toMatch(/Developer mode/i)
    expect(dialog.textContent).toMatch(/Load unpacked/i)
    expect(dialog.textContent).toContain(STABLE_EXTENSION_VERSION)
    expect(dialog.querySelectorAll('.fl-install-step-icon').length).toBe(5)
    expect(dialog.querySelector(`a[href="${STABLE_EXTENSION_DOWNLOAD_PATH}"]`)).toBeTruthy()
    expect(window.location.pathname).toBe('/')
  })

  it('closes with Escape and the Close button', () => {
    const el = mount(
      <MemoryRouter>
        <I18nProvider>
          <AddToChromeButton className="test-cta" />
        </I18nProvider>
      </MemoryRouter>,
    )
    const button = el.querySelector('button.test-cta') as HTMLButtonElement

    act(() => {
      button.click()
    })
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    act(() => {
      button.click()
    })
    const close = [...document.body.querySelectorAll('button')].find((node) =>
      /Close/i.test(node.textContent ?? ''),
    )
    expect(close).toBeTruthy()
    act(() => {
      close!.click()
    })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('uses the authoritative stable version for the download path', () => {
    expect(STABLE_EXTENSION_VERSION).toBe(BRAND.version)
    expect(STABLE_EXTENSION_ZIP_NAME).toBe(`flowlary-v${BRAND.version}.zip`)
    expect(STABLE_EXTENSION_DOWNLOAD_PATH).toBe(`/downloads/flowlary-v${BRAND.version}.zip`)
  })

  it('keeps the home page Add to Chrome CTA as a button (no page navigation)', () => {
    const el = mount(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    const ctas = [...el.querySelectorAll('button')].filter((node) =>
      /Add to Chrome/i.test(node.textContent ?? ''),
    )
    expect(ctas.length).toBeGreaterThan(0)
    expect(el.innerHTML).not.toMatch(/href="\/guide"[^>]*>[\s\S]*Add to Chrome/)
  })
})

describe('stable extension ZIP artifact', () => {
  const zipPath = existsSync(publicZip) ? publicZip : releaseZip

  it('exists for the stable version', () => {
    expect(existsSync(zipPath), `missing ${STABLE_EXTENSION_ZIP_NAME} in public/downloads or release/`).toBe(
      true,
    )
  })

  it('has manifest.json at ZIP root with matching version and no secrets/localhost endpoints', () => {
    if (!existsSync(zipPath)) return

    const tmp = mkdtempSync(join(tmpdir(), 'flowlary-zip-'))
    try {
      execSync(`unzip -q "${zipPath}" -d "${tmp}"`)
      const manifestPath = join(tmp, 'manifest.json')
      expect(existsSync(manifestPath)).toBe(true)
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        version: string
        host_permissions?: string[]
      }
      expect(manifest.version).toBe(STABLE_EXTENSION_VERSION)

      const hosts = (manifest.host_permissions ?? []).join(' ')
      expect(hosts).toContain('https://api.flowlary.com')
      expect(hosts).not.toMatch(/localhost|127\.0\.0\.1/)

      const listing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf8' })
      expect(listing).not.toMatch(/(^|\s)\.env(\s|$)/)
      expect(listing.toLowerCase()).not.toMatch(/credentials\.json/)

      const forbidden = [
        /gsk_[a-zA-Z0-9]+/,
        /GROQ_API_KEY/,
        /FLOWLARY_JWT_SECRET/,
        /PADDLE_API_KEY/,
        /127\.0\.0\.1/,
        /https?:\/\/localhost(?::\d+)?\b/,
        /localhost:8787/,
      ]
      const textFiles = walk(tmp).filter(
        (file) => /\.(js|json|html|css)$/.test(file) && !file.endsWith('.map'),
      )
      const hits: string[] = []
      for (const pattern of forbidden) {
        for (const file of textFiles) {
          if (pattern.test(readFileSync(file, 'utf8'))) hits.push(`${file}: ${pattern}`)
        }
      }
      expect(hits).toEqual([])
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('InstallExtensionModal download link', () => {
  it('points at the stable production ZIP path', () => {
    mount(
      <MemoryRouter>
        <I18nProvider>
          <InstallExtensionModal open onClose={() => {}} />
        </I18nProvider>
      </MemoryRouter>,
    )
    const download = document.body.querySelector(
      `a[href="${STABLE_EXTENSION_DOWNLOAD_PATH}"]`,
    ) as HTMLAnchorElement
    expect(download).toBeTruthy()
    expect(download.getAttribute('download')).toBe(STABLE_EXTENSION_ZIP_NAME)
    expect(download.textContent).toMatch(/Download Flowlary/i)
  })
})
