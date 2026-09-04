import { readHostSurface } from '../correction/ui/hostStyleAdapter.ts'
import { resolveCardActionStrings } from './cardStrings.ts'
import type { ChangeType } from '@flowlary/shared'

export type InlineSuggestionBinding = {
  element: HTMLElement
  start: number
  end: number
  suggestion: string
}

export type InlineSuggestionCardOptions = {
  label: string
  onApply: (binding: InlineSuggestionBinding) => void
  onDismiss: () => void
  extraHostAttribute?: string
}

type CardVisualState = 'hidden' | 'loading' | 'ready' | 'applied'

const HOST_ATTR = 'data-flowlary-suggestion-host'
const GAP_PX = 10
const MAX_WIDTH_PX = 420

export class InlineSuggestionCard {
  private host: HTMLElement
  private shadow: ShadowRoot
  private cardEl: HTMLElement
  private labelEl: HTMLElement
  private hintEl: HTMLElement
  private contentEl: HTMLElement
  private legendEl: HTMLElement
  private target: HTMLElement | null = null
  private binding: InlineSuggestionBinding | null = null
  private visualState: CardVisualState = 'hidden'
  private resizeObserver: ResizeObserver | null = null
  private onWindowResize: (() => void) | null = null
  private onScroll: (() => void) | null = null
  private scrollTargets: EventTarget[] = []
  private appliedTimer: ReturnType<typeof setTimeout> | null = null
  private readonly cardStrings = resolveCardActionStrings()
  private label: string

  constructor(private readonly options: InlineSuggestionCardOptions) {
    this.label = options.label
    this.host = document.createElement('div')
    this.host.setAttribute(HOST_ATTR, 'true')
    if (options.extraHostAttribute) this.host.setAttribute(options.extraHostAttribute, 'true')
    this.host.setAttribute('aria-live', 'polite')
    this.applyHostBaseStyle()
    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `
      <style>
        :host { all: initial; display: block; }
        * { box-sizing: border-box; }
        .card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          margin: 0;
          padding: 12px 14px;
          pointer-events: auto;
          border-radius: 14px;
          border: 1px solid var(--flowlary-border, rgba(17, 24, 39, 0.1));
          background: var(--flowlary-bg, #ffffff);
          color: var(--flowlary-fg, #111827);
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.04),
            0 8px 24px rgba(15, 23, 42, 0.1),
            0 24px 48px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transform: translateY(0) scale(1);
          opacity: 1;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease,
            border-color 160ms ease;
          outline: none;
          cursor: default;
          overflow: hidden;
          position: relative;
        }
        .card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          opacity: 0;
          background: linear-gradient(
            110deg,
            transparent 0%,
            rgba(255, 255, 255, 0.45) 45%,
            transparent 90%
          );
          transform: translateX(-120%);
        }
        .card.entering::before {
          opacity: 1;
          animation: flowlary-card-shimmer 900ms ease-out;
        }
        .card.ready {
          cursor: pointer;
        }
        .card.ready:hover {
          transform: translateY(-1px);
          box-shadow:
            0 2px 4px rgba(15, 23, 42, 0.05),
            0 12px 28px rgba(15, 23, 42, 0.12),
            0 28px 56px rgba(15, 23, 42, 0.08);
          border-color: var(--flowlary-border-hover, rgba(17, 24, 39, 0.16));
          background: var(--flowlary-bg-hover, #ffffff);
        }
        .card.ready:active {
          transform: translateY(0) scale(0.995);
          background: var(--flowlary-bg-active, #f8fafc);
        }
        .card.error {
          cursor: default;
        }
        .card.error .content {
          color: #b42318;
          font-size: 0.92em;
        }
        .card:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--flowlary-fg, #111827) 35%, transparent);
          outline-offset: 2px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-width: 0;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 999px;
          font: 600 11px/1.2 system-ui, -apple-system, sans-serif;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.62));
          background: var(--flowlary-badge-bg, rgba(17, 24, 39, 0.06));
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--flowlary-accent, #2563eb);
          opacity: 0.85;
        }
        .card.loading .badge-dot {
          animation: flowlary-pulse 1.2s ease-in-out infinite;
        }
        .hint {
          font: 500 11px/1.2 system-ui, -apple-system, sans-serif;
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.55));
          white-space: nowrap;
        }
        .card.loading .hint,
        .card.applied .hint {
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.55));
        }
        .body {
          position: relative;
          min-height: 20px;
        }
        .mark {
          border-radius: 2px;
          padding: 0;
          font-weight: 650;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
        .spelling {
          color: var(--fl-teach-spelling, #be123c);
          background: var(--fl-teach-spelling-soft, rgba(244, 63, 94, 0.12));
        }
        .grammar {
          color: var(--fl-teach-grammar, #a16207);
          background: var(--fl-teach-grammar-soft, rgba(202, 138, 4, 0.16));
        }
        .wording {
          color: var(--fl-teach-wording, #3730a3);
          background: var(--fl-teach-wording-soft, rgba(99, 102, 241, 0.12));
        }
        .layout {
          color: var(--fl-teach-layout, #b8860b);
          background: var(--fl-teach-layout-soft, rgba(184, 134, 11, 0.12));
        }
        .card.loading .content,
        .card.loading .legend {
          visibility: hidden;
        }
        .legend {
          display: none;
          flex-wrap: wrap;
          gap: 6px;
          margin: 0;
          padding: 0;
        }
        .legend.visible {
          display: flex;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 7px;
          border-radius: 999px;
          font: 600 10px/1.2 system-ui, -apple-system, sans-serif;
          letter-spacing: 0.02em;
        }
        .chip::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
        }
        .chip.spelling {
          color: var(--fl-teach-spelling, #be123c);
          background: var(--fl-teach-spelling-soft, rgba(244, 63, 94, 0.12));
        }
        .chip.grammar {
          color: var(--fl-teach-grammar, #a16207);
          background: var(--fl-teach-grammar-soft, rgba(202, 138, 4, 0.16));
        }
        .chip.wording {
          color: var(--fl-teach-wording, #3730a3);
          background: var(--fl-teach-wording-soft, rgba(99, 102, 241, 0.12));
        }
        .chip.layout {
          color: var(--fl-teach-layout, #b8860b);
          background: var(--fl-teach-layout-soft, rgba(184, 134, 11, 0.12));
        }
        .shimmer {
          display: none;
          flex-direction: column;
          gap: 8px;
        }
        .card.loading .shimmer {
          display: flex;
        }
        .shimmer-line {
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            var(--flowlary-shimmer-base, rgba(17, 24, 39, 0.08)) 0%,
            var(--flowlary-shimmer-highlight, rgba(17, 24, 39, 0.14)) 50%,
            var(--flowlary-shimmer-base, rgba(17, 24, 39, 0.08)) 100%
          );
          background-size: 200% 100%;
          animation: flowlary-shimmer 1.25s ease-in-out infinite;
        }
        .shimmer-line.short { width: 62%; }
        .shimmer-line.medium { width: 84%; }
        @keyframes flowlary-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes flowlary-card-shimmer {
          0% { transform: translateX(-120%); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes flowlary-pulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .card,
          .card.ready:hover,
          .card.ready:active {
            transition: none;
            transform: none;
          }
          .card.entering::before,
          .shimmer-line,
          .badge-dot {
            animation: none;
          }
        }
      </style>
      <div class="card" role="button" tabindex="0" hidden aria-label="Writing suggestion">
        <div class="header">
          <span class="badge"><span class="badge-dot" aria-hidden="true"></span><span class="label"></span></span>
          <span class="hint"></span>
        </div>
        <div class="body">
          <div class="content"></div>
          <div class="shimmer" aria-hidden="true">
            <div class="shimmer-line medium"></div>
            <div class="shimmer-line"></div>
            <div class="shimmer-line short"></div>
          </div>
          <div class="legend" hidden></div>
        </div>
      </div>
    `
    this.cardEl = this.shadow.querySelector('.card') as HTMLElement
    this.labelEl = this.shadow.querySelector('.label') as HTMLElement
    this.hintEl = this.shadow.querySelector('.hint') as HTMLElement
    this.contentEl = this.shadow.querySelector('.content') as HTMLElement
    this.legendEl = this.shadow.querySelector('.legend') as HTMLElement
    this.labelEl.textContent = this.label
    this.hintEl.textContent = this.cardStrings.clickToAccept

    this.cardEl.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    this.cardEl.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.applyIfReady()
    })
    this.cardEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        this.applyIfReady()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        this.dismiss()
      }
    })
  }

  attach(target: HTMLElement): void {
    this.target = target
    if (this.visualState !== 'hidden') {
      this.ensureMounted()
      this.bindLayoutListeners()
      this.syncLayout()
    }
  }

  setLabel(label: string): void {
    this.label = label
    this.labelEl.textContent = label
  }

  contains(node: EventTarget | null): boolean {
    if (!(node instanceof Node)) return false
    if (this.host === node || this.host.contains(node)) return true
    return this.shadow.contains(node)
  }

  isVisible(): boolean {
    return this.visualState !== 'hidden' && this.host.isConnected
  }

  refresh(): void {
    if (this.visualState === 'hidden' || !this.target) return
    this.ensureMounted()
    this.syncLayout()
  }

  showLoading(target: HTMLElement, dir: 'ltr' | 'rtl' | 'auto' = 'auto'): void {
    this.binding = null
    this.target = target
    this.contentEl.textContent = ''
    this.setTeachLegend([])
    this.contentEl.dir = dir
    this.setVisualState('loading')
    this.hintEl.textContent = this.cardStrings.analyzing
    this.ensureMounted()
    this.syncLayout()
    this.bindLayoutListeners()
  }

  show(
    binding: InlineSuggestionBinding,
    dir: 'ltr' | 'rtl' | 'auto' = 'auto',
    content?: Node,
    teachTypes: ChangeType[] = [],
  ): void {
    this.binding = binding
    this.target = binding.element
    this.contentEl.replaceChildren()
    if (content) this.contentEl.appendChild(content)
    else this.contentEl.textContent = binding.suggestion
    this.contentEl.dir = dir
    this.hintEl.textContent = this.cardStrings.clickToAccept
    this.cardEl.style.cursor = ''
    this.cardEl.classList.remove('error')
    this.setTeachLegend(teachTypes)
    this.setVisualState('ready')
    this.playEnterAnimation()
    this.ensureMounted()
    this.syncLayout()
    this.bindLayoutListeners()
  }

  showError(target: HTMLElement, message: string): void {
    this.binding = null
    this.target = target
    this.contentEl.textContent = message
    this.hintEl.textContent = ''
    this.setVisualState('ready')
    this.cardEl.classList.remove('ready')
    this.cardEl.classList.add('error')
    this.cardEl.style.cursor = 'default'
    this.ensureMounted()
    this.syncLayout()
    this.bindLayoutListeners()
  }

  hide(): void {
    if (this.appliedTimer) {
      clearTimeout(this.appliedTimer)
      this.appliedTimer = null
    }
    this.binding = null
    this.target = null
    this.visualState = 'hidden'
    this.cardEl.hidden = true
    this.cardEl.classList.remove('entering', 'loading', 'ready', 'applied', 'error')
    this.setTeachLegend([])
    this.host.style.display = 'none'
    this.host.style.pointerEvents = 'none'
    this.host.remove()
    this.unbindLayoutListeners()
  }

  setTeachLegend(types: ChangeType[]): void {
    const unique = [...new Set(types.filter((type) => type === 'spelling' || type === 'grammar' || type === 'wording' || type === 'layout'))]
    this.legendEl.replaceChildren()
    if (unique.length === 0) {
      this.legendEl.hidden = true
      this.legendEl.classList.remove('visible')
      return
    }
    this.legendEl.hidden = false
    this.legendEl.classList.add('visible')
    for (const type of unique) {
      const chip = document.createElement('span')
      chip.className = `chip ${type}`
      chip.textContent = this.cardStrings[type]
      this.legendEl.appendChild(chip)
    }
  }

  private applyIfReady(): void {
    if (this.cardEl.classList.contains('error')) return
    if (this.visualState !== 'ready' || !this.binding) return
    this.options.onApply(this.binding)
    this.markApplied()
  }

  private dismiss(): void {
    this.hide()
    this.options.onDismiss()
  }

  markApplied(): void {
    this.setVisualState('applied')
    this.hintEl.textContent = this.cardStrings.applied
    if (this.appliedTimer) clearTimeout(this.appliedTimer)
    this.appliedTimer = setTimeout(() => {
      this.appliedTimer = null
      if (this.visualState !== 'applied') return
      this.hintEl.textContent = this.cardStrings.clickToAccept
      this.setVisualState('ready')
    }, 700)
  }

  private setVisualState(state: Exclude<CardVisualState, 'hidden'>): void {
    this.visualState = state
    this.cardEl.hidden = false
    this.host.style.display = 'block'
    this.host.style.pointerEvents = 'auto'
    this.cardEl.classList.remove('loading', 'ready', 'applied', 'error')
    this.cardEl.classList.add(state)
    this.cardEl.style.cursor = state === 'ready' ? '' : ''
    this.cardEl.setAttribute(
      'aria-label',
      state === 'loading'
        ? `${this.label} suggestion loading`
        : `${this.label} suggestion`,
    )
  }

  private playEnterAnimation(): void {
    this.cardEl.classList.remove('entering')
    void this.cardEl.offsetWidth
    this.cardEl.classList.add('entering')
  }

  private applyHostBaseStyle(): void {
    this.host.style.display = 'none'
    this.host.style.boxSizing = 'border-box'
    this.host.style.position = 'fixed'
    this.host.style.margin = '0'
    this.host.style.padding = '0'
    this.host.style.border = '0'
    this.host.style.pointerEvents = 'none'
    this.host.style.zIndex = '2147483000'
  }

  private ensureMounted(): void {
    if (!this.host.isConnected) {
      document.documentElement.appendChild(this.host)
    }
  }

  private syncLayout(): void {
    if (!this.target || this.visualState === 'hidden') {
      this.host.style.display = 'none'
      return
    }

    this.adaptTheme(this.target)
    const rect = this.target.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const width = Math.min(Math.max(rect.width, 220), MAX_WIDTH_PX, viewportW - 16)
    const cardHeight = this.cardEl.offsetHeight || 96
    const belowTop = rect.bottom + GAP_PX
    const aboveTop = rect.top - GAP_PX - cardHeight
    const preferBelow = belowTop + cardHeight <= viewportH - 8
    const top = preferBelow ? belowTop : Math.max(8, aboveTop)
    const left = Math.min(Math.max(8, rect.left), viewportW - width - 8)

    this.host.style.display = 'block'
    this.host.style.top = `${Math.round(top)}px`
    this.host.style.left = `${Math.round(left)}px`
    this.host.style.width = `${Math.round(width)}px`
    this.host.style.maxWidth = `min(${MAX_WIDTH_PX}px, calc(100vw - 16px))`
  }

  private adaptTheme(target: HTMLElement): void {
    const surface = readHostSurface(target)
    this.cardEl.style.fontFamily = surface.fontFamily
    this.cardEl.style.fontSize = surface.fontSize
    this.cardEl.style.fontWeight = surface.fontWeight
    this.cardEl.style.lineHeight = surface.lineHeight
    this.cardEl.style.letterSpacing = surface.letterSpacing
    this.cardEl.style.color = surface.color
    this.cardEl.style.background = surface.background
    this.cardEl.style.setProperty('--flowlary-bg', surface.background)
    this.cardEl.style.setProperty('--flowlary-bg-hover', surface.backgroundHover)
    this.cardEl.style.setProperty('--flowlary-bg-active', surface.backgroundActive)
    this.cardEl.style.setProperty('--flowlary-fg', surface.color)
    this.cardEl.style.setProperty('--flowlary-muted', surface.muted)
    this.cardEl.style.setProperty('--flowlary-border', fadeColor(surface.color, 0.12))
    this.cardEl.style.setProperty('--flowlary-border-hover', fadeColor(surface.color, 0.18))
    this.cardEl.style.setProperty('--flowlary-badge-bg', fadeColor(surface.color, 0.08))
    this.cardEl.style.setProperty('--flowlary-shimmer-base', fadeColor(surface.color, 0.08))
    this.cardEl.style.setProperty('--flowlary-shimmer-highlight', fadeColor(surface.color, 0.14))
    this.cardEl.style.setProperty('--flowlary-success-border', 'rgba(22, 163, 74, 0.35)')
    this.cardEl.style.setProperty('--flowlary-success-bg', 'rgba(240, 253, 244, 0.96)')
  }

  private bindLayoutListeners(): void {
    if (!this.target) return

    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => this.syncLayout())
    this.resizeObserver.observe(this.target)

    if (!this.onWindowResize) {
      this.onWindowResize = () => this.syncLayout()
      window.addEventListener('resize', this.onWindowResize)
    }

    if (this.onScroll) return
    this.onScroll = () => this.syncLayout()
    this.scrollTargets = [window]
    let node: Element | null = this.target
    while (node) {
      this.scrollTargets.push(node)
      node = node.parentElement
    }
    for (const target of this.scrollTargets) {
      target.addEventListener('scroll', this.onScroll, { passive: true, capture: target === window })
    }
  }

  private unbindLayoutListeners(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.onWindowResize) {
      window.removeEventListener('resize', this.onWindowResize)
      this.onWindowResize = null
    }
    if (!this.onScroll) return
    for (const target of this.scrollTargets) {
      target.removeEventListener('scroll', this.onScroll, target === window)
    }
    this.scrollTargets = []
    this.onScroll = null
  }
}

function fadeColor(color: string, alpha: number): string {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!match) return color
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`
}

export function isSuggestionHost(node: Node | null): boolean {
  return node instanceof HTMLElement && node.hasAttribute(HOST_ATTR)
}
