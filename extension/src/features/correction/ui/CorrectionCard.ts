import type { CorrectionResponse } from '@flowlary/shared'
import { buildHighlightedTokens } from '../diff/tokenDiff.ts'
import { applyHostSurface, readHostSurface } from './hostStyleAdapter.ts'
import { ExplanationPanel } from './ExplanationPanel.ts'
import { getCorrectionExplainStrings } from './explanationStrings.ts'
import { resolveCardActionStrings } from '../../shared/cardStrings.ts'
import type { CardState, CorrectionSuggestionBinding } from './types.ts'

export type CorrectionCardOptions = {
  onApply: (binding: CorrectionSuggestionBinding) => void
  onDismiss: (binding: CorrectionSuggestionBinding | null) => void
  highlights: boolean
}

export const HOST_ATTR = 'data-flowlary-correction-host'
const DEFAULT_GAP_PX = 8

export class CorrectionCard {
  private host: HTMLElement
  private shadow: ShadowRoot
  private root: HTMLElement
  private contentEl: HTMLElement
  private applyEl: HTMLButtonElement
  private explainEl: HTMLButtonElement
  private dismissEl: HTMLButtonElement
  private explanationPanel: ExplanationPanel
  private state: CardState = 'hidden'
  private binding: CorrectionSuggestionBinding | null = null
  private displayedText = ''
  private highlights: boolean
  private resizeObserver: ResizeObserver | null = null
  private target: HTMLElement | null = null
  private onWindowResize: (() => void) | null = null
  private onFieldChromeChange: (() => void) | null = null
  private onScroll: (() => void) | null = null
  private scrollTargets: EventTarget[] = []
  private appliedTimer: ReturnType<typeof setTimeout> | null = null
  private gapPx = DEFAULT_GAP_PX
  private readonly cardStrings = resolveCardActionStrings()

  constructor(private readonly options: CorrectionCardOptions) {
    this.highlights = options.highlights
    this.explanationPanel = new ExplanationPanel()
    const strings = getCorrectionExplainStrings()
    this.host = document.createElement('div')
    this.host.setAttribute(HOST_ATTR, 'true')
    this.host.setAttribute('aria-live', 'polite')
    this.applyHostBaseStyle()
    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `
      <style>
        :host { all: initial; display: block; }
        * { box-sizing: border-box; }
        .row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          width: 100%;
          min-height: 0;
          max-height: 120px;
          margin: 0;
          pointer-events: auto;
          background: var(--flowlary-bg, #fafafa);
          color: var(--flowlary-fg, #111827);
          box-shadow: none;
          overflow: auto;
          cursor: default;
          outline: none;
        }
        .row.ready { cursor: pointer; }
        .row.ready:hover { background: var(--flowlary-bg-hover, #f5f5f5); }
        .row.ready:active { background: var(--flowlary-bg-active, #f0f0f0); }
        .row.error { cursor: default; }
        .row:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--flowlary-fg, #111827) 35%, transparent);
          outline-offset: 2px;
        }
        .content {
          flex: 1 1 auto;
          min-width: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding-top: 0.1em;
        }
        .status { display: none; }
        .row.analyzing .status { display: inline-flex; }
        .apply, .explain, .dismiss {
          display: none;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.55));
          font: inherit;
          font-size: 0.85em;
          font-weight: 500;
          line-height: 1;
          letter-spacing: inherit;
          cursor: pointer;
          user-select: none;
          opacity: 1;
          white-space: nowrap;
        }
        .row.ready .apply,
        .row.ready .explain,
        .row.ready .dismiss,
        .row.ready.analyzing .apply { display: inline-flex; }
        .apply:hover, .explain:hover, .dismiss:hover { color: var(--flowlary-fg, #111827); }
        .row.applied .apply { opacity: 0.7; }
        .dots {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          height: 10px;
        }
        .dots i {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--flowlary-muted, #9ca3af);
          opacity: 0.5;
          animation: flowlary-dot 1s ease-in-out infinite;
        }
        .dots i:nth-child(2) { animation-delay: 0.16s; }
        .dots i:nth-child(3) { animation-delay: 0.32s; }
        @keyframes flowlary-dot {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 0.75; transform: translateY(-1px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dots i { animation: none; opacity: 0.45; }
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
        .error-label {
          font-size: 0.92em;
          color: #b42318;
        }
      </style>
      <div class="row" role="group" tabindex="0" aria-label="English correction suggestion" hidden>
        <div class="content"></div>
        <div class="actions">
          <span class="status" aria-hidden="true">
            <span class="dots" aria-label="Checking"><i></i><i></i><i></i></span>
          </span>
          <button class="explain" type="button"></button>
          <button class="apply" type="button" aria-label="Accept correction">Apply</button>
          <button class="dismiss" type="button" aria-label="Dismiss correction">Dismiss</button>
        </div>
      </div>
    `
    this.root = this.shadow.querySelector('.row') as HTMLElement
    this.contentEl = this.shadow.querySelector('.content') as HTMLElement
    this.applyEl = this.shadow.querySelector('.apply') as HTMLButtonElement
    this.explainEl = this.shadow.querySelector('.explain') as HTMLButtonElement
    this.dismissEl = this.shadow.querySelector('.dismiss') as HTMLButtonElement
    this.explainEl.textContent = strings.explain
    this.explainEl.setAttribute('aria-label', strings.explainAria)
    this.applyEl.textContent = this.cardStrings.apply
    this.applyEl.setAttribute('aria-label', this.cardStrings.apply)
    this.dismissEl.textContent = this.cardStrings.dismiss
    this.dismissEl.setAttribute('aria-label', this.cardStrings.dismiss)

    this.root.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    this.root.addEventListener('click', (e) => {
      if (e.target === this.dismissEl || e.target === this.explainEl) return
      e.preventDefault()
      e.stopPropagation()
      this.applyIfReady()
    })
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (this.explanationPanel.isOpen()) {
          this.explanationPanel.hide()
          return
        }
        this.dismiss()
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        this.applyIfReady()
      }
    })
    this.applyEl.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.applyIfReady()
    })
    this.dismissEl.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.dismiss()
    })
    this.explainEl.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openExplanation()
    })
  }

  mount(target: HTMLElement): void {
    this.target = target
    this.adaptTheme(target)
    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => this.syncLayout())
    this.resizeObserver.observe(target)
    this.onWindowResize = () => this.syncLayout()
    window.addEventListener('resize', this.onWindowResize)
    this.onFieldChromeChange = () => {
      if (this.target && this.state !== 'hidden') this.adaptTheme(this.target)
    }
    target.addEventListener('focus', this.onFieldChromeChange)
    target.addEventListener('blur', this.onFieldChromeChange)
    this.attachScrollListeners(target)
  }

  unmount(): void {
    if (this.target && this.onFieldChromeChange) {
      this.target.removeEventListener('focus', this.onFieldChromeChange)
      this.target.removeEventListener('blur', this.onFieldChromeChange)
    }
    this.onFieldChromeChange = null
    this.detachScrollListeners()
    this.hide()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.onWindowResize) {
      window.removeEventListener('resize', this.onWindowResize)
      this.onWindowResize = null
    }
    this.host.remove()
    this.target = null
  }

  destroy(): void {
    this.explanationPanel.clear()
    this.unmount()
  }

  setHighlights(on: boolean): void {
    this.highlights = on
  }

  getBinding(): CorrectionSuggestionBinding | null {
    return this.binding
  }

  contains(node: EventTarget | null): boolean {
    if (!(node instanceof Node)) return false
    if (this.host === node || this.host.contains(node)) return true
    return this.shadow.contains(node)
  }

  isVisible(): boolean {
    return this.state !== 'hidden' && this.host.isConnected
  }

  reattach(): void {
    if (this.state === 'hidden' || !this.target) return
    this.attachInline()
    this.syncLayout()
  }

  hasReadyCorrection(): boolean {
    return !!this.binding && (this.state === 'ready' || this.root.classList.contains('ready'))
  }

  private applyIfReady(): void {
    if (!this.binding) return
    this.options.onApply(this.binding)
    this.markApplied()
  }

  private dismiss(): void {
    const binding = this.binding
    this.explanationPanel.clear()
    this.options.onDismiss(binding)
    this.hide()
  }

  private openExplanation(): void {
    if (!this.binding) return
    this.explanationPanel.show(this.binding, this.explainEl)
  }

  markApplied(): void {
    if (!this.binding) return
    this.root.classList.add('applied')
    this.applyEl.textContent = 'Applied'
    if (this.appliedTimer) clearTimeout(this.appliedTimer)
    this.appliedTimer = setTimeout(() => {
      this.appliedTimer = null
      if (!this.binding) return
      this.applyEl.textContent = this.cardStrings.apply
      this.root.classList.remove('applied')
    }, 900)
  }

  ensureVisible(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) {
      this.hide()
      return
    }
    if (this.hasReadyCorrection() || (this.state === 'analyzing' && this.displayedText)) {
      this.attachInline()
      this.syncLayout()
      return
    }
    this.showPlain(text)
  }

  showPlain(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) {
      this.hide()
      return
    }
    this.state = 'idle'
    this.binding = null
    this.displayedText = text
    this.contentEl.textContent = text
    this.showRow('idle')
  }

  setAnalyzing(): void {
    if (this.hasReadyCorrection()) {
      this.root.classList.add('analyzing')
      this.attachInline()
      this.syncLayout()
      return
    }
    if (!this.displayedText && this.state === 'hidden') {
      this.contentEl.replaceChildren()
    }
    this.state = 'analyzing'
    this.showRow('analyzing')
  }

  setReady(binding: CorrectionSuggestionBinding): void {
    this.explanationPanel.clear()
    const response = binding.response
    if (response.correctedText === response.originalText) {
      this.showPlain(response.originalText)
      return
    }
    this.state = 'ready'
    this.binding = binding
    this.displayedText = response.correctedText
    this.applyEl.textContent = this.cardStrings.apply
    this.root.classList.remove('applied')
    this.renderDiff(response.originalText, response.correctedText, response.changes)
    this.showRow('ready')
  }

  setError(message?: string): void {
    if (this.hasReadyCorrection()) {
      this.root.classList.remove('analyzing')
      return
    }
    this.state = 'error'
    this.binding = null
    this.contentEl.replaceChildren()
    const label = document.createElement('span')
    label.className = 'error-label'
    label.textContent = message ?? 'Correction unavailable'
    this.contentEl.appendChild(label)
    this.showRow('error')
  }

  hide(): void {
    if (this.appliedTimer) {
      clearTimeout(this.appliedTimer)
      this.appliedTimer = null
    }
    this.explanationPanel.clear()
    this.state = 'hidden'
    this.binding = null
    this.displayedText = ''
    this.applyEl.textContent = this.cardStrings.apply
    this.contentEl.replaceChildren()
    this.root.classList.remove('analyzing', 'error', 'ready', 'idle', 'applied')
    this.root.hidden = true
    this.host.style.display = 'none'
    this.host.remove()
  }

  getState(): CardState {
    return this.state
  }

  private showRow(state: Exclude<CardState, 'hidden'>): void {
    this.root.hidden = false
    this.root.classList.remove('idle', 'analyzing', 'ready', 'error')
    this.root.classList.add(state)
    this.attachInline()
    this.syncLayout()
  }

  private applyHostBaseStyle(): void {
    this.host.style.display = 'none'
    this.host.style.boxSizing = 'border-box'
    this.host.style.position = 'relative'
    this.host.style.margin = `${DEFAULT_GAP_PX}px 0 0 0`
    this.host.style.padding = '0'
    this.host.style.border = '0'
    this.host.style.maxWidth = '100%'
    this.host.style.zIndex = '2147483000'
  }

  private attachInline(): void {
    if (!this.target) return
    if (this.host.isConnected && this.host.previousElementSibling === this.target) {
      return
    }
    this.target.insertAdjacentElement('afterend', this.host)
  }

  private syncLayout(): void {
    if (!this.target || this.state === 'hidden') {
      this.host.style.display = 'none'
      return
    }
    this.adaptTheme(this.target)
    const width = Math.max(this.target.offsetWidth, 80)
    this.host.style.display = 'block'
    this.host.style.width = `${width}px`
    this.host.style.maxWidth = '100%'
    this.host.style.height = 'auto'
    this.host.style.minHeight = '0'
    this.host.style.marginTop = `${this.gapPx}px`

    const parent = this.target.parentElement
    if (parent) {
      const styles = window.getComputedStyle(parent)
      const rowFlex =
        (styles.display === 'flex' || styles.display === 'inline-flex') &&
        (styles.flexDirection === 'row' || styles.flexDirection === 'row-reverse')
      if (rowFlex) {
        this.host.style.flex = '1 0 100%'
        this.host.style.alignSelf = 'flex-start'
      } else {
        this.host.style.flex = ''
        this.host.style.alignSelf = ''
      }
    }
  }

  private renderDiff(
    original: string,
    corrected: string,
    changes: CorrectionResponse['changes'],
  ): void {
    this.contentEl.replaceChildren()
    if (!this.highlights) {
      this.contentEl.textContent = corrected
      return
    }
    const tokens = buildHighlightedTokens(original, corrected, changes)
    const frag = document.createDocumentFragment()
    for (const token of tokens) {
      if (token.type === 'equal' || !token.changeType) {
        frag.appendChild(document.createTextNode(token.value))
      } else {
        const span = document.createElement('span')
        span.className = `mark ${token.changeType}`
        span.textContent = token.value
        frag.appendChild(span)
      }
    }
    this.contentEl.appendChild(frag)
  }

  private adaptTheme(target: HTMLElement): void {
    const surface = readHostSurface(target)
    this.gapPx = surface.gapPx || DEFAULT_GAP_PX
    applyHostSurface(this.root, surface)
  }

  private attachScrollListeners(target: HTMLElement): void {
    this.detachScrollListeners()
    this.onScroll = () => this.syncLayout()
    const seen = new Set<EventTarget>()
    let node: HTMLElement | null = target
    while (node && node !== document.documentElement) {
      const style = window.getComputedStyle(node)
      const scrollable =
        /auto|scroll|overlay/.test(style.overflowY) ||
        /auto|scroll|overlay/.test(style.overflowX)
      if (scrollable && !seen.has(node)) {
        seen.add(node)
        node.addEventListener('scroll', this.onScroll!, { passive: true })
        this.scrollTargets.push(node)
      }
      node = node.parentElement
    }
    if (!seen.has(window)) {
      window.addEventListener('scroll', this.onScroll!, { passive: true, capture: true })
      this.scrollTargets.push(window)
    }
  }

  private detachScrollListeners(): void {
    if (!this.onScroll) return
    for (const target of this.scrollTargets) {
      target.removeEventListener('scroll', this.onScroll)
    }
    this.scrollTargets = []
    this.onScroll = null
  }
}

export function isCorrectionHost(element: Element | null): boolean {
  return element?.closest?.(`[${HOST_ATTR}]`) != null
}
