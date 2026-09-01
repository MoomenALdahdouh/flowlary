import { isEditableElement } from '../../core/dom/read.ts'
import type { InputEngine } from '../../core/input/InputEngine.ts'
import { resolveWritingPolicy } from '../../core/policy/writingPolicy.ts'
import { readUiLocale } from '../../popup/i18n/localeStorage.ts'
import { en } from '../../popup/i18n/en.ts'
import { ar } from '../../popup/i18n/ar.ts'

const HOST_ID = 'flowlary-translation-chip'

function chipCopy(paused: boolean): string {
  const locale = readUiLocale()
  const pack = locale === 'ar' ? ar.assistant : en.assistant
  return paused ? pack.resumeField : pack.pauseField
}

export function startTranslationSessionChip(engine: InputEngine): void {
  if (typeof document === 'undefined') return
  document.addEventListener('focusin', () => {
    renderChip(engine, document.activeElement)
  })
}

function renderChip(engine: InputEngine, active: Element | null): void {
  if (!active || !isEditableElement(active)) {
    hideChip()
    return
  }
  const policy = resolveWritingPolicy()
  if (!policy.arabicToEnglishMode) {
    hideChip()
    return
  }
  const session = engine.sessions.getOrCreate(active)
  showChip(engine, active, session.isTranslationPaused())
}

function hideChip(): void {
  document.getElementById(HOST_ID)?.remove()
}

function showChip(engine: InputEngine, element: Element, paused: boolean): void {
  hideChip()
  const host = document.createElement('button')
  host.id = HOST_ID
  host.type = 'button'
  host.setAttribute('aria-pressed', paused ? 'true' : 'false')
  host.textContent = chipCopy(paused)
  host.style.cssText =
    'position:fixed;z-index:2147483646;font:12px/1.3 system-ui,sans-serif;padding:6px 8px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:#111;color:#fff;cursor:pointer;'
  const rect = element.getBoundingClientRect()
  host.style.top = `${Math.max(8, rect.top - 32)}px`
  host.style.left = `${Math.max(8, rect.left)}px`
  host.addEventListener('mousedown', (event) => event.preventDefault())
  host.addEventListener('click', () => {
    const session = engine.sessions.getOrCreate(element)
    if (session.isTranslationPaused()) session.resumeTranslationOnField()
    else session.pauseTranslationOnField()
    showChip(engine, element, session.isTranslationPaused())
  })
  document.documentElement.append(host)
}
