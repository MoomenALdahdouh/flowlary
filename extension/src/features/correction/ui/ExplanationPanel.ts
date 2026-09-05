import type { RuleExplanation } from '@flowlary/shared'
import { uiLocaleDirection } from '@flowlary/shared'
import type { CorrectionSuggestionBinding } from './types.ts'
import {
  getAlignedExplanations,
  shouldShowPracticeLink,
  shouldShowTrustedRuleTitle,
} from './explanationMapping.ts'
import {
  getCorrectionExplainStrings,
  loadCorrectionExplainStrings,
  type CorrectionExplainStrings,
} from './explanationStrings.ts'
import { readUiLocale } from '../../../popup/i18n/localeStorage.ts'
import {
  mergeLocalizedFields,
  needsAiExplanationLocalization,
  presentExplanationForLocale,
  requestExplanationLocalization,
} from '../explainLocalizeClient.ts'
import { openDashboard } from '../../../popup/openDashboard.ts'

const PANEL_HOST_ATTR = 'data-flowlary-explanation-panel'

export class ExplanationPanel {
  private host: HTMLElement
  private shadow: ShadowRoot
  private titleEl: HTMLElement
  private bodyEl: HTMLElement
  private closeBtn: HTMLButtonElement
  private strings: CorrectionExplainStrings
  private binding: CorrectionSuggestionBinding | null = null
  private explainTrigger: HTMLElement | null = null
  private onClose: (() => void) | null = null
  private renderGeneration = 0
  private panelEl: HTMLElement
  private boundFocusTrap: ((event: KeyboardEvent) => void) | null = null

  constructor() {
    this.strings = getCorrectionExplainStrings()
    this.host = document.createElement('div')
    this.host.setAttribute(PANEL_HOST_ATTR, 'true')
    this.applyHostStyle()
    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.18);
          z-index: 2147483646;
          display: none;
        }
        :host([data-open="true"]) .backdrop { display: block; }
        .panel {
          position: fixed;
          top: 0;
          right: 0;
          width: min(360px, 92vw);
          height: 100dvh;
          max-height: 100vh;
          overflow: auto;
          background: var(--flowlary-bg, #fafafa);
          color: var(--flowlary-fg, #111827);
          border-left: 1px solid color-mix(in srgb, var(--flowlary-fg, #111827) 12%, transparent);
          box-shadow: -8px 0 24px rgba(15, 23, 42, 0.08);
          z-index: 2147483647;
          transform: translateX(104%);
          transition: transform 160ms ease;
          padding: 16px;
          font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
          pointer-events: auto;
        }
        :host([data-open="true"]) .panel { transform: translateX(0); }
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 650;
          line-height: 1.3;
        }
        .close {
          margin: 0;
          padding: 6px 10px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.55));
          font: inherit;
          font-size: 0.92em;
          cursor: pointer;
        }
        .close:hover { background: color-mix(in srgb, var(--flowlary-fg, #111827) 6%, transparent); }
        .close:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--flowlary-fg, #111827) 35%, transparent);
          outline-offset: 2px;
        }
        .body { display: grid; gap: 14px; }
        .item {
          padding: 12px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--flowlary-fg, #111827) 4%, transparent);
        }
        .item-title {
          margin: 0 0 8px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.62));
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .pair {
          display: grid;
          gap: 6px;
          margin: 0 0 8px;
        }
        .label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.62));
        }
        .value {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .summary, .why {
          margin: 8px 0 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .rule {
          margin: 8px 0 0;
          font-weight: 600;
        }
        .practice {
          margin-top: 10px;
          padding: 8px 12px;
          border: 0;
          border-radius: 8px;
          background: color-mix(in srgb, var(--flowlary-fg, #111827) 8%, transparent);
          color: var(--flowlary-fg, #111827);
          font: inherit;
          font-size: 0.92em;
          font-weight: 600;
          cursor: pointer;
        }
        .practice:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--flowlary-fg, #111827) 35%, transparent);
          outline-offset: 2px;
        }
        .unavailable {
          margin: 0;
          color: var(--flowlary-muted, rgba(17, 24, 39, 0.62));
        }
        @media (max-width: 640px) {
          .panel {
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: min(72dvh, 560px);
            max-height: 85vh;
            border-left: 0;
            border-top: 1px solid color-mix(in srgb, var(--flowlary-fg, #111827) 12%, transparent);
            transform: translateY(104%);
            border-radius: 16px 16px 0 0;
          }
          :host([data-open="true"]) .panel { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .panel { transition: none; }
        }
      </style>
      <div class="backdrop" part="backdrop"></div>
      <aside class="panel" role="dialog" aria-modal="true" aria-labelledby="flowlary-explain-title" aria-describedby="flowlary-explain-body">
        <div class="header">
          <h2 class="title" id="flowlary-explain-title"></h2>
          <button class="close" type="button"></button>
        </div>
        <div class="body" id="flowlary-explain-body"></div>
      </aside>
    `
    this.titleEl = this.shadow.querySelector('.title') as HTMLElement
    this.bodyEl = this.shadow.querySelector('.body') as HTMLElement
    this.panelEl = this.shadow.querySelector('.panel') as HTMLElement
    this.closeBtn = this.shadow.querySelector('.close') as HTMLButtonElement
    this.closeBtn.textContent = this.strings.close
    this.closeBtn.setAttribute('aria-label', this.strings.closeAria)

    this.closeBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.hide()
    })
    this.shadow.querySelector('.backdrop')?.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.hide()
    })
    this.shadow.querySelector('.panel')?.addEventListener('keydown', (e: Event) => {
      if (!(e instanceof KeyboardEvent)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this.hide()
      }
    })
    this.boundFocusTrap = (event) => this.handleFocusTrap(event)
  }

  private focusableElements(): HTMLElement[] {
    const root = this.panelEl
    if (!root) return []
    const nodes = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    return Array.from(nodes).filter((node) => node.offsetParent !== null || node === this.closeBtn)
  }

  private handleFocusTrap(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.isOpen()) return
    const focusable = this.focusableElements()
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = this.shadow.activeElement
    if (event.shiftKey) {
      if (active === first || !this.panelEl.contains(active)) {
        event.preventDefault()
        last.focus()
      }
      return
    }
    if (active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  private setPanelBusy(busy: boolean): void {
    if (busy) this.panelEl.setAttribute('aria-busy', 'true')
    else this.panelEl.removeAttribute('aria-busy')
  }

  private attachFocusTrap(): void {
    if (!this.boundFocusTrap) return
    this.panelEl.addEventListener('keydown', this.boundFocusTrap)
  }

  private detachFocusTrap(): void {
    if (!this.boundFocusTrap) return
    this.panelEl.removeEventListener('keydown', this.boundFocusTrap)
  }

  isOpen(): boolean {
    return this.host.dataset.open === 'true'
  }

  contains(node: EventTarget | null): boolean {
    if (!(node instanceof Node)) return false
    return this.host === node || this.host.contains(node) || this.shadow.contains(node)
  }

  show(binding: CorrectionSuggestionBinding, trigger?: HTMLElement | null): void {
    void this.open(binding, trigger)
  }

  private async open(binding: CorrectionSuggestionBinding, trigger?: HTMLElement | null): Promise<void> {
    this.binding = binding
    this.explainTrigger = trigger ?? null
    const generation = ++this.renderGeneration

    this.strings = await loadCorrectionExplainStrings()
    const locale = await readUiLocale()
    this.host.dir = uiLocaleDirection(locale)
    this.titleEl.textContent = this.strings.whyTitle
    this.closeBtn.textContent = this.strings.close
    this.closeBtn.setAttribute('aria-label', this.strings.closeAria)

    this.render(binding, locale)
    if (!this.host.isConnected) document.body.appendChild(this.host)
    this.host.dataset.open = 'true'
    this.host.style.pointerEvents = 'auto'
    this.attachFocusTrap()
    this.closeBtn.focus()

    void this.enhanceWithAiIfNeeded(binding, locale, generation)
  }

  hide(): void {
    this.renderGeneration += 1
    this.detachFocusTrap()
    this.setPanelBusy(false)
    this.host.dataset.open = 'false'
    this.host.style.pointerEvents = 'none'
    this.host.remove()
    this.binding = null
    const trigger = this.explainTrigger
    this.explainTrigger = null
    trigger?.focus()
    this.onClose?.()
  }

  setOnClose(handler: (() => void) | null): void {
    this.onClose = handler
  }

  clear(): void {
    if (this.isOpen()) this.hide()
    this.binding = null
    this.explainTrigger = null
  }

  private render(binding: CorrectionSuggestionBinding, locale: import('@flowlary/shared').UiLocaleCode): void {
    this.bodyEl.replaceChildren()
    const aligned = getAlignedExplanations(binding.response.changes, binding.response.explanations)
    if (!aligned) {
      const msg = document.createElement('p')
      msg.className = 'unavailable'
      msg.textContent = this.strings.unavailable
      this.bodyEl.appendChild(msg)
      return
    }

    binding.response.changes.forEach((change, index) => {
      const explanation = aligned[index]
      if (!explanation) return
      const presented = presentExplanationForLocale(explanation, locale)
      this.bodyEl.appendChild(
        this.renderItem(
          change.original,
          change.corrected,
          presented,
          index,
          aligned.length,
          `explain-item-${index}`,
        ),
      )
    })
  }

  private async enhanceWithAiIfNeeded(
    binding: CorrectionSuggestionBinding,
    locale: import('@flowlary/shared').UiLocaleCode,
    generation: number,
  ): Promise<void> {
    const aligned = getAlignedExplanations(binding.response.changes, binding.response.explanations)
    if (!aligned) return

    const needsEnhancement = aligned.some(
      (explanation) => explanation && needsAiExplanationLocalization(explanation, locale),
    )
    if (needsEnhancement) this.setPanelBusy(true)

    for (let index = 0; index < aligned.length; index += 1) {
      const explanation = aligned[index]
      if (!explanation || !needsAiExplanationLocalization(explanation, locale)) continue

      const fields = await requestExplanationLocalization(explanation, locale)
      if (
        !fields ||
        generation !== this.renderGeneration ||
        !this.isOpen() ||
        this.binding !== binding
      ) {
        continue
      }

      const enhanced = mergeLocalizedFields(presentExplanationForLocale(explanation, locale), fields)
      const item = this.bodyEl.querySelector(`#explain-item-${index}`)
      if (!item) continue

      const change = binding.response.changes[index]
      if (!change) continue

      const replacement = this.renderItem(
        change.original,
        change.corrected,
        enhanced,
        index,
        aligned.length,
        `explain-item-${index}`,
      )
      item.replaceWith(replacement)
    }

    if (generation === this.renderGeneration && this.isOpen()) {
      this.setPanelBusy(false)
    }
  }

  private renderItem(
    original: string,
    corrected: string,
    explanation: RuleExplanation,
    index: number,
    total: number,
    itemId: string,
  ): HTMLElement {
    const item = document.createElement('section')
    item.className = 'item'
    item.id = itemId

    if (total > 1) {
      const heading = document.createElement('h3')
      heading.className = 'item-title'
      heading.textContent = `${this.strings.changeLabel} ${index + 1}`
      item.appendChild(heading)
    }

    item.appendChild(this.renderPair(this.strings.youWrote, explanation.incorrectExample || original))
    item.appendChild(this.renderPair(this.strings.suggested, explanation.correctExample || corrected))

    if (shouldShowTrustedRuleTitle(explanation)) {
      const rule = document.createElement('p')
      rule.className = 'rule'
      const label = document.createElement('span')
      label.textContent = `${this.strings.rule}: `
      rule.appendChild(label)
      rule.appendChild(document.createTextNode(explanation.ruleTitle!))
      item.appendChild(rule)
    }

    const summary = document.createElement('p')
    summary.className = 'summary'
    summary.textContent = explanation.summary
    item.appendChild(summary)

    if (explanation.why?.trim()) {
      const whyBlock = document.createElement('div')
      const whyLabel = document.createElement('div')
      whyLabel.className = 'label'
      whyLabel.textContent = this.strings.why
      const whyText = document.createElement('p')
      whyText.className = 'why'
      whyText.textContent = explanation.why
      whyBlock.appendChild(whyLabel)
      whyBlock.appendChild(whyText)
      item.appendChild(whyBlock)
    }

    const example = document.createElement('div')
    const exampleLabel = document.createElement('div')
    exampleLabel.className = 'label'
    exampleLabel.textContent = this.strings.example
    const exampleText = document.createElement('p')
    exampleText.className = 'value'
    exampleText.textContent = `${explanation.incorrectExample} → ${explanation.correctExample}`
    example.appendChild(exampleLabel)
    example.appendChild(exampleText)
    item.appendChild(example)

    if (shouldShowPracticeLink(explanation)) {
      const practiceBtn = document.createElement('button')
      practiceBtn.type = 'button'
      practiceBtn.className = 'practice'
      practiceBtn.textContent = this.strings.practiceThis
      practiceBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openDashboard('practice', explanation.practiceTargetId ?? undefined)
      })
      item.appendChild(practiceBtn)
    }

    return item
  }

  private renderPair(label: string, value: string): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'pair'
    const labelEl = document.createElement('div')
    labelEl.className = 'label'
    labelEl.textContent = label
    const valueEl = document.createElement('p')
    valueEl.className = 'value'
    valueEl.textContent = value
    wrap.appendChild(labelEl)
    wrap.appendChild(valueEl)
    return wrap
  }

  private applyHostStyle(): void {
    this.host.style.all = 'initial'
    this.host.style.position = 'fixed'
    this.host.style.inset = '0'
    this.host.style.pointerEvents = 'none'
    this.host.style.zIndex = '2147483646'
    this.host.dataset.open = 'false'
  }
}

export function isExplanationPanelHost(element: Element | null): boolean {
  return element?.closest?.(`[${PANEL_HOST_ATTR}]`) != null
}
