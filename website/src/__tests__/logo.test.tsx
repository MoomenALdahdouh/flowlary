import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FLOWLARY_MARK, FLOWLARY_MARK_COLORS } from '@flowlary/shared'
import { Logo } from '../components/Logo.tsx'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '../../public')

describe('Flowlary mark', () => {
  it('keeps the website logo, favicon, and OG mark on the same glyph', () => {
    const logo = renderToStaticMarkup(<Logo />)
    const favicon = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8')
    const og = readFileSync(join(PUBLIC, 'og.svg'), 'utf8')

    expect(logo).toContain(FLOWLARY_MARK.f)
    expect(favicon).toContain(FLOWLARY_MARK.f)
    expect(og).toContain(FLOWLARY_MARK.f)
    expect(favicon).toContain(`rx="${FLOWLARY_MARK.radius}"`)
    expect(favicon).toContain(FLOWLARY_MARK_COLORS.accent)
    expect(favicon).toContain(FLOWLARY_MARK_COLORS.light.accent)
    expect(favicon).toContain(FLOWLARY_MARK_COLORS.light.onAccent)
    expect(og).toContain(FLOWLARY_MARK_COLORS.accent)
    expect(logo).not.toContain('M9.2 9.4h10.1')

    const websiteTokens = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../styles/tokens.css'),
      'utf8',
    )
    const popupTokens = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../extension/src/popup/tokens.css'),
      'utf8',
    )
    expect(websiteTokens).toContain("@flowlary/shared/tokens.css")
    expect(popupTokens).toContain("@flowlary/shared/tokens.css")

    const popup = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../extension/src/popup/components.tsx'),
      'utf8',
    )
    expect(popup).toContain('FLOWLARY_MARK')
    expect(popup).toContain("@flowlary/shared")
  })
})
