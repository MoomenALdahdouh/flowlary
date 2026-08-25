/** Minimal correction suggestion card — Phase 7 scaffolding (full UX in Phase 8). */

export type CorrectionCardOptions = {
  onApply: (correctedText: string, originalText: string) => void
}

const HOST_ATTR = 'data-flowlary-correction-host'

export class CorrectionCard {
  private host: HTMLElement
  private shadow: ShadowRoot
  private contentEl: HTMLElement
  private applyBtn: HTMLButtonElement
  private correctedText = ''
  private originalText = ''
  private target: HTMLElement | null = null

  constructor(private readonly options: CorrectionCardOptions) {
    this.host = document.createElement('div')
    this.host.setAttribute(HOST_ATTR, 'true')
    this.host.setAttribute('aria-live', 'polite')
    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `
      <style>
        :host { all: initial; display: none; }
        .row {
          display: flex; gap: 8px; align-items: flex-start;
          padding: 6px 8px; background: #fafafa; color: #111;
          border: 1px solid #e5e7eb; border-radius: 6px;
          font: 13px/1.4 system-ui, sans-serif; max-width: 100%;
        }
        .content { flex: 1; white-space: pre-wrap; word-break: break-word; }
        button { cursor: pointer; font: inherit; padding: 2px 8px; }
      </style>
      <div class="row">
        <div class="content"></div>
        <button type="button">Apply</button>
      </div>
    `
    this.contentEl = this.shadow.querySelector('.content')!
    this.applyBtn = this.shadow.querySelector('button')!
    this.applyBtn.addEventListener('click', () => {
      if (this.correctedText) this.options.onApply(this.correctedText, this.originalText)
    })
  }

  attach(target: HTMLElement): void {
    this.target = target
    if (!this.host.isConnected) {
      target.insertAdjacentElement('afterend', this.host)
    }
  }

  hide(): void {
    this.host.style.display = 'none'
  }

  setAnalyzing(): void {
    this.attachTarget()
    this.host.style.display = 'block'
    this.contentEl.textContent = 'Checking…'
    this.applyBtn.style.display = 'none'
  }

  setReady(correctedText: string, originalText: string, onApply?: () => void): void {
    this.correctedText = correctedText
    this.originalText = originalText
    this.attachTarget()
    this.host.style.display = 'block'
    this.contentEl.textContent = correctedText
    this.applyBtn.style.display = 'inline-block'
    if (onApply) {
      this.applyBtn.onclick = () => onApply()
    }
  }

  setError(message: string): void {
    this.attachTarget()
    this.host.style.display = 'block'
    this.contentEl.textContent = message
    this.applyBtn.style.display = 'none'
  }

  destroy(): void {
    this.host.remove()
    this.target = null
  }

  private attachTarget(): void {
    if (this.target) this.attach(this.target)
  }
}

export function isCorrectionHost(element: Element | null): boolean {
  return element?.closest?.(`[${HOST_ATTR}]`) != null
}
