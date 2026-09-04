import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FREE_DAILY_CREDITS,
  PRO_DAILY_CREDITS,
  PRO_MONTHLY_PRICE_CENTS,
  PRO_MONTHLY_SOFT_CAP,
  PRO_YEARLY_PRICE_CENTS,
  TRIAL_DAILY_CREDITS,
} from '@flowlary/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { Alert, Badge, Button, Card, Input } from '../components/Ui.tsx'

const root = dirname(fileURLToPath(import.meta.url))
const tokens = readFileSync(join(root, '../../../packages/shared/src/tokens.css'), 'utf8')
const globalCss = readFileSync(join(root, '../styles/global.css'), 'utf8')

describe('Phase 1C design foundation', () => {
  it('keeps brand accent and canvas colors', () => {
    expect(tokens).toContain('--fl-accent: #14d4ea')
    expect(tokens).toContain('--fl-accent: #0891b2')
    expect(tokens).toContain('--fl-bg: #0b1120')
    expect(tokens).toContain('--fl-bg: #f7fafc')
    expect(tokens).toContain('--fl-text: #f1f5f9')
    expect(tokens).toContain('--fl-text: #0f172a')
    expect(tokens).toContain('--fl-on-accent: #061018')
    expect(tokens).toContain('--fl-on-accent: #ffffff')
  })

  it('adds semantic foundation tokens without renaming brand tokens', () => {
    expect(tokens).toContain('--fl-text-disabled:')
    expect(tokens).toContain('--fl-info:')
    expect(tokens).toContain('--fl-ai-ready:')
    expect(tokens).toContain('--fl-ai-working:')
    expect(tokens).toContain('--fl-ai-success:')
    expect(tokens).toContain('--fl-ai-unavailable:')
    expect(tokens).toContain('--fl-ai-exhausted:')
    expect(tokens).toContain('--fl-learn-discovered:')
    expect(tokens).toContain('--fl-learn-practicing:')
    expect(tokens).toContain('--fl-learn-improving:')
    expect(tokens).toContain('--fl-learn-completed:')
    expect(tokens).toContain('--fl-radius-pill: 999px')
    expect(tokens).toContain('--fl-bp-lg: 1024px')
    expect(tokens).toContain('--fl-text-display: clamp(2.6rem, 7vw, 4.4rem)')
    expect(tokens).toContain('--fl-text-h4: 1rem')
    expect(tokens).toContain('--fl-font-arabic:')
  })

  it('uses solid primary buttons and solid cards in global CSS', () => {
    expect(globalCss).toContain('background: var(--fl-accent)')
    expect(globalCss).not.toMatch(/\.btn-primary[^{]*\{[^}]*border-radius:\s*999px/)
    expect(globalCss).toContain('.fl-alert')
    expect(globalCss).toContain('.fl-input')
    expect(globalCss).toContain('.fl-surface-1')
  })

  it('exposes compatible primitives', () => {
    expect(renderToStaticMarkup(<Button>Go</Button>)).toContain('btn btn-primary')
    expect(renderToStaticMarkup(<Button variant="tertiary">Quiet</Button>)).toContain('btn-tertiary')
    expect(renderToStaticMarkup(<Button variant="danger">Delete</Button>)).toContain('btn-danger')
    expect(renderToStaticMarkup(<Card>Panel</Card>)).toContain('class="card"')
    expect(renderToStaticMarkup(<Badge>New</Badge>)).toContain('class="badge"')
    expect(renderToStaticMarkup(<Alert title="Note">Body</Alert>)).toContain('fl-alert-info')
    expect(renderToStaticMarkup(<Input id="email" label="Email" />)).toContain('fl-input')
  })

  it('does not alter commercial constants', () => {
    expect(FREE_DAILY_CREDITS).toBe(500)
    expect(PRO_DAILY_CREDITS).toBe(1000)
    expect(TRIAL_DAILY_CREDITS).toBe(1000)
    expect(PRO_MONTHLY_SOFT_CAP).toBe(30_000)
    expect(PRO_MONTHLY_PRICE_CENTS).toBe(499)
    expect(PRO_YEARLY_PRICE_CENTS).toBe(3900)
  })
})
