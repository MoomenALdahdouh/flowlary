import type { CorrectionResponse } from '@flowlary/shared'
import { buildHighlightedTokens } from '../diff/tokenDiff.ts'
import { InlineSuggestionCard } from '../../shared/InlineSuggestionCard.ts'
import type { CardState, CorrectionSuggestionBinding } from './types.ts'

export type CorrectionCardOptions = {
  onApply: (binding: CorrectionSuggestionBinding) => void
  onDismiss: (binding: CorrectionSuggestionBinding | null) => void
  highlights: boolean
}

export const HOST_ATTR = 'data-flowlary-correction-host'

export class CorrectionCard {
  private inner: InlineSuggestionCard
  private state: CardState = 'hidden'
  private binding: CorrectionSuggestionBinding | null = null
  private displayedText = ''
  private highlights: boolean
  private target: HTMLElement | null = null

  constructor(private readonly options: CorrectionCardOptions) {
    this.highlights = options.highlights
    this.inner = new InlineSuggestionCard({
      label: 'English',
      extraHostAttribute: HOST_ATTR,
      onApply: () => {
        if (this.binding) this.options.onApply(this.binding)
      },
      onDismiss: () => {
        this.state = 'hidden'
        this.displayedText = ''
        this.options.onDismiss(this.binding)
        this.binding = null
      },
    })
  }

  mount(target: HTMLElement): void {
    this.target = target
    this.inner.attach(target)
  }

  unmount(): void {
    this.hide()
    this.target = null
  }

  destroy(): void {
    this.unmount()
  }

  setHighlights(on: boolean): void {
    this.highlights = on
  }

  getBinding(): CorrectionSuggestionBinding | null {
    return this.binding
  }

  contains(node: EventTarget | null): boolean {
    return this.inner.contains(node)
  }

  isVisible(): boolean {
    return this.state !== 'hidden' && this.inner.isVisible()
  }

  reattach(): void {
    if (this.state === 'hidden' || !this.target) return
    this.inner.attach(this.target)
    this.inner.refresh()
  }

  hasReadyCorrection(): boolean {
    return !!this.binding && this.state === 'ready'
  }

  markApplied(): void {
    this.inner.markApplied()
  }

  retainAfterApply(mergedFullText: string, fieldGeneration: number): void {
    if (!this.binding) return
    this.binding = {
      ...this.binding,
      requestedFullText: mergedFullText,
      fieldGeneration,
    }
    this.inner.markApplied()
    this.inner.refresh()
  }

  ensureVisible(text: string): void {
    if (!text.trim()) {
      this.hide()
      return
    }
    if (this.hasReadyCorrection() || this.state === 'analyzing') {
      this.reattach()
    }
  }

  showPlain(_text: string): void {
    if (this.hasReadyCorrection() || this.state === 'analyzing') {
      this.reattach()
      return
    }
    this.hide()
  }

  setAnalyzing(): void {
    if (!this.target) return
    if (this.hasReadyCorrection()) {
      this.inner.refresh()
      return
    }
    this.state = 'analyzing'
    this.inner.showLoading(this.target)
  }

  setReady(binding: CorrectionSuggestionBinding): void {
    if (!this.target) return
    const response = binding.response
    if (response.correctedText === response.originalText) {
      this.showPlain(response.originalText)
      return
    }
    this.state = 'ready'
    this.binding = binding
    this.displayedText = response.correctedText
    this.inner.show(
      {
        element: this.target,
        start: 0,
        end: binding.requestedFullText.length,
        suggestion: response.correctedText,
      },
      'ltr',
      this.renderDiff(response.originalText, response.correctedText, response.changes),
      [...new Set(response.changes.map((change) => change.type))],
    )
  }

  setError(message?: string): void {
    if (!this.target) return
    if (this.hasReadyCorrection()) {
      this.inner.refresh()
      return
    }
    this.state = 'error'
    this.binding = null
    this.inner.showError(this.target, message ?? 'Correction unavailable')
  }

  hide(): void {
    this.state = 'hidden'
    this.binding = null
    this.displayedText = ''
    this.inner.hide()
  }

  getState(): CardState {
    return this.state
  }

  private renderDiff(
    original: string,
    corrected: string,
    changes: CorrectionResponse['changes'],
  ): DocumentFragment {
    const frag = document.createDocumentFragment()
    if (!this.highlights) {
      frag.appendChild(document.createTextNode(corrected))
      return frag
    }
    const tokens = buildHighlightedTokens(original, corrected, changes)
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
    return frag
  }
}

export function isCorrectionHost(element: Element | null): boolean {
  return (
    element?.closest?.(`[${HOST_ATTR}]`) != null ||
    element?.closest?.('[data-flowlary-suggestion-host]') != null
  )
}
