import styles from './speedBox.css?raw'
import { copyText } from './copyText.ts'
import {
  convertManualText,
  allConverterLayouts,
  resolveConverterPair,
  swapConverterPair,
  getLayout,
  type ConverterPair,
} from './layouts/index.ts'
import type { LayoutId, UserLayoutProfile } from './layouts/types.ts'
import { setNativeValue } from '../../core/dom/write.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
import { FieldSession } from '../../core/session/FieldSession.ts'
import type { WriterTag } from '@flowlary/shared'
import { requestTranslationRemote } from '../translation/client.ts'
import { requestCorrectionRemote } from '../correction/client.ts'
import { buildHighlightedTokens } from '../correction/diff/tokenDiff.ts'
import type { CorrectionChange } from '@flowlary/shared'
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  type LanguageOption,
} from '../translation/languages.ts'
import type { LanguageCode } from '../translation/types.ts'
import { resolveTheme, THEME_STORAGE_KEY } from '@flowlary/shared/theme'
import { isLocalDevApi } from '../../config/apiHealth.ts'

export const SPEED_BOX_HOST_ID = 'flowlary-speed-box'

let speedBoxThemeCleanup: (() => void) | null = null

function syncSpeedBoxTheme(host: HTMLElement): void {
  host.setAttribute('data-theme', resolveTheme())
}

function ensureSpeedBoxTheme(host: HTMLElement): void {
  syncSpeedBoxTheme(host)
  if (speedBoxThemeCleanup) return

  const refreshTheme = () => {
    const node = document.getElementById(SPEED_BOX_HOST_ID)
    if (node) syncSpeedBoxTheme(node)
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) refreshTheme()
  }
  window.addEventListener('storage', onStorage)

  let media: MediaQueryList | null = null
  const onSchemeChange = () => {
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return
    } catch {
      /* private mode */
    }
    refreshTheme()
  }
  if (typeof window.matchMedia === 'function') {
    media = window.matchMedia('(prefers-color-scheme: light)')
    media.addEventListener('change', onSchemeChange)
  }

  speedBoxThemeCleanup = () => {
    window.removeEventListener('storage', onStorage)
    if (media) media.removeEventListener('change', onSchemeChange)
    speedBoxThemeCleanup = null
  }
}

export type SpeedBoxMode = 'layout' | 'translate' | 'fix'

export type SpeedBoxProfile = UserLayoutProfile & {
  manualConversionEnabled: boolean
  sourceLanguage?: string
  targetLanguage?: string
  correctionEnabled?: boolean
  correctionConsentAccepted?: boolean
  correctionHighlights?: boolean
  correctionMode?: 'box' | 'direct'
  translationMode?: 'box' | 'direct'
  layoutMode?: 'box' | 'direct'
  translationEnabled?: boolean
}

export type SpeedBox = {
  isOpen(): boolean
  ownsEvent(event: Event): boolean
  open(): boolean
  close(): void
  toggle(): boolean
  handleEscape(): void
  destroy(): void
}

const MODES: readonly SpeedBoxMode[] = ['layout', 'translate', 'fix']
const MAX_PREFILL_CHARS = 4_000
const AI_DEBOUNCE_MS = 420
const MIN_AI_CHARS = 2

let lastMode: SpeedBoxMode = 'layout'
let lastLangPair: { source: LanguageCode; target: LanguageCode } | null = null

function optionLabel(id: LayoutId): string {
  const layout = getLayout(id)
  if (!layout) return id
  return `${layout.language.toUpperCase()} · ${layout.name}`
}

function languageOptionLabel(item: LanguageOption): string {
  return item.native === item.name ? item.name : `${item.native} · ${item.name}`
}

function asLayoutId(value: string): LayoutId {
  return value as LayoutId
}

function languageDirection(code: string): 'ltr' | 'rtl' {
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.direction ?? 'ltr'
}

function layoutDirection(id: string): 'ltr' | 'rtl' {
  return getLayout(id)?.metadata.direction ?? 'ltr'
}

function speedError(code: string): string {
  switch (code) {
    case 'usage_exhausted':
    case 'entitlement_denied':
    case 'AI_ENTITLEMENT_DENIED':
      return "Today's AI checks are used up."
    case 'account_required':
      return 'Sign in to use AI.'
    case 'auth_failed':
      return 'Sign in again in Flowlary.'
    case 'consent_required':
      return 'Enable Flowlary AI in settings.'
    case 'disabled':
      return 'Turn this on in Flowlary settings.'
    case 'same-language':
      return 'Pick two different languages.'
    case 'extension_disconnected':
      return 'Reload the extension, then try again.'
    case 'too-long':
    case 'empty':
      return 'Add some text.'
    case 'translation_unavailable':
    case 'network':
    case 'upstream':
      return isLocalDevApi()
        ? 'Local API not running.'
        : 'Flowlary AI unavailable. Try again.'
    case 'AI_UNAVAILABLE':
    case 'AI_PROVIDER_ERROR':
    case 'AI_TIMEOUT':
      return 'AI unavailable. Try again.'
    case 'rate_limited':
    case 'AI_RATE_LIMITED':
    case 'rate-limited':
      return 'Too many requests. Wait a moment.'
    default:
      return 'Something went wrong.'
  }
}

export function speedBoxShortcutHint(platform = navigator.platform): string {
  return /mac/i.test(platform) ? '⌘⇧L' : 'Ctrl+Shift+L'
}

export function createSpeedBox(options: {
  getProfile: () => SpeedBoxProfile
  getSession?: (element: Element) => FieldSession
  translate?: (
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    signal?: AbortSignal,
  ) => ReturnType<typeof requestTranslationRemote>
  correct?: (
    requestId: string,
    text: string,
    signal?: AbortSignal,
  ) => ReturnType<typeof requestCorrectionRemote>
}): SpeedBox {
  let host: HTMLElement | null = null
  let shadow: ShadowRoot | null = null
  let open = false
  let mode: SpeedBoxMode = lastMode
  let pair: ConverterPair | null = null
  let langSource: LanguageCode = DEFAULT_SOURCE_LANGUAGE
  let langTarget: LanguageCode = DEFAULT_TARGET_LANGUAGE
  let busy = false
  let runToken = 0
  let abort: AbortController | null = null
  let aiTimer: ReturnType<typeof setTimeout> | null = null
  let restored: {
    element: HTMLElement
    start: number | null
    end: number | null
  } | null = null
  let boxSuggestion: string | null = null

  function isFixBoxMode(): boolean {
    return mode === 'fix' && profile().correctionMode === 'box'
  }

  function isTranslateBoxMode(): boolean {
    return mode === 'translate' && profile().translationMode === 'box'
  }

  function isLayoutBoxMode(): boolean {
    return mode === 'layout' && profile().layoutMode === 'box'
  }

  function profile(): SpeedBoxProfile {
    return options.getProfile()
  }

  function layoutProfile(): UserLayoutProfile {
    const current = profile()
    return {
      sourceLayout: current.sourceLayout,
      enabledLayouts: current.enabledLayouts,
    }
  }

  function resolvedLayoutPair(): ConverterPair {
    return resolveConverterPair(layoutProfile(), pair ?? undefined)
  }

  function activeTranslationPair(): { source: LanguageCode; target: LanguageCode } {
    return { source: langSource, target: langTarget }
  }

  function defaultTranslationPair(): { source: LanguageCode; target: LanguageCode } {
    const current = profile()
    const source = normalizeLanguage(current.sourceLanguage, DEFAULT_SOURCE_LANGUAGE)
    let target = normalizeLanguage(current.targetLanguage, DEFAULT_TARGET_LANGUAGE)
    if (source === target) {
      target = source === DEFAULT_TARGET_LANGUAGE ? DEFAULT_SOURCE_LANGUAGE : DEFAULT_TARGET_LANGUAGE
    }
    return { source, target }
  }

  function q<T extends Element>(selector: string): T | null {
    return shadow?.querySelector<T>(selector) ?? null
  }

  function inputEl(): HTMLTextAreaElement | null {
    return q('[data-flowlary="speed-input"]')
  }

  function resultEl(): HTMLButtonElement | null {
    return q('[data-flowlary="speed-result"]')
  }

  function outputTextEl(): HTMLElement | null {
    return q('[data-flowlary="speed-result-text"]')
  }

  function resultHintEl(): HTMLElement | null {
    return q('[data-flowlary="speed-result-hint"]')
  }

  function applyEl(): HTMLButtonElement | null {
    return q('[data-flowlary="speed-apply"]')
  }

  function statusEl(): HTMLElement | null {
    return q('[data-flowlary="speed-status"]')
  }

  function pairLayoutEl(): HTMLElement | null {
    return q('[data-flowlary="speed-pair-layout"]')
  }

  function pairTranslateEl(): HTMLElement | null {
    return q('[data-flowlary="speed-pair-translate"]')
  }

  function sourceEl(): HTMLSelectElement | null {
    return q('[data-flowlary="speed-source"]')
  }

  function targetEl(): HTMLSelectElement | null {
    return q('[data-flowlary="speed-target"]')
  }

  function langSourceEl(): HTMLSelectElement | null {
    return q('[data-flowlary="speed-lang-source"]')
  }

  function langTargetEl(): HTMLSelectElement | null {
    return q('[data-flowlary="speed-lang-target"]')
  }

  function panelEl(): HTMLElement | null {
    return q('[data-flowlary="speed-panel"]')
  }

  function canInsert(): boolean {
    return (
      restored != null &&
      restored.element.isConnected &&
      (restored.element instanceof HTMLInputElement ||
        restored.element instanceof HTMLTextAreaElement)
    )
  }

  function captureFocus() {
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || active === host) return null
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      return { element: active, start: active.selectionStart, end: active.selectionEnd }
    }
    return { element: active, start: null, end: null }
  }

  function restoreFocus(): void {
    const saved = restored
    restored = null
    if (!saved || !saved.element.isConnected) return
    saved.element.focus()
    if (
      saved.start != null &&
      saved.end != null &&
      (saved.element instanceof HTMLInputElement ||
        saved.element instanceof HTMLTextAreaElement)
    ) {
      try {
        saved.element.setSelectionRange(saved.start, saved.end)
      } catch {
        /* some input types reject ranges */
      }
    }
  }

  function prefillFromField(): string {
    if (!restored) return ''
    const el = restored.element
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return ''
    const start = restored.start
    const end = restored.end
    const selected =
      start != null && end != null && start !== end ? el.value.slice(start, end) : el.value
    const text = selected.trim().length > 0 ? selected : el.value
    return text.length > MAX_PREFILL_CHARS ? text.slice(0, MAX_PREFILL_CHARS) : text
  }

  function resultHintText(hasResult: boolean): string {
    if (busy) return '…'
    if (!hasResult) return ''
    if (mode === 'fix' && isFixBoxMode()) return 'Apply'
    if (mode === 'translate' && isTranslateBoxMode()) return 'Apply'
    if (mode === 'layout' && isLayoutBoxMode()) return 'Apply'
    if (canInsert()) return 'Enter to insert'
    return 'Click to copy'
  }

  function writeInput(value: string): void {
    const input = inputEl()
    if (!input) return
    input.value = value
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }))
  }

  function applyBoxSuggestion(): void {
    if (!boxSuggestion) return
    writeInput(boxSuggestion)
    boxSuggestion = null
    applyEl()?.setAttribute('hidden', '')
    clearResult()
    setStatus('Applied.', 'info')
    queueMicrotask(() => inputEl()?.focus())
  }

  function setStatus(text: string, tone: 'error' | 'info' = 'error'): void {
    const node = statusEl()
    if (!node) return
    node.textContent = text
    node.hidden = !text
    node.dataset.tone = text ? tone : ''
  }

  function setResult(text: string, dir: 'ltr' | 'rtl' | 'auto' = 'auto'): void {
    const button = resultEl()
    const textEl = outputTextEl()
    const hint = resultHintEl()
    if (!button || !textEl || !hint) return
    textEl.textContent = text
    textEl.dir = dir
    button.hidden = text.length === 0 && !busy
    hint.textContent = resultHintText(text.length > 0)
  }

  function setResultDiff(
    original: string,
    corrected: string,
    changes: CorrectionChange[],
    dir: 'ltr' | 'rtl' | 'auto' = 'auto',
  ): void {
    const button = resultEl()
    const textEl = outputTextEl()
    const hint = resultHintEl()
    if (!button || !textEl || !hint) return
    textEl.dir = dir
    const useHighlights = profile().correctionHighlights !== false && changes.length > 0
    if (useHighlights) {
      textEl.replaceChildren()
      const tokens = buildHighlightedTokens(original, corrected, changes)
      for (const token of tokens) {
        if (token.type === 'equal' || !token.changeType) {
          textEl.appendChild(document.createTextNode(token.value))
        } else {
          const span = document.createElement('span')
          span.className = `mark ${token.changeType}`
          span.textContent = token.value
          textEl.appendChild(span)
        }
      }
    } else {
      textEl.textContent = corrected
    }
    button.hidden = corrected.length === 0 && !busy
    hint.textContent = resultHintText(corrected.length > 0)
  }

  function clearResult(): void {
    boxSuggestion = null
    applyEl()?.setAttribute('hidden', '')
    setResult('')
    setStatus('')
  }

  function setBusy(next: boolean): void {
    busy = next
    panelEl()?.classList.toggle('is-busy', busy)
    panelEl()?.setAttribute('aria-busy', busy ? 'true' : 'false')
    const hint = resultHintEl()
    if (hint) hint.textContent = resultHintText(Boolean(outputTextEl()?.textContent))
    if (busy && !outputTextEl()?.textContent) {
      resultEl()?.removeAttribute('hidden')
    }
  }

  function fillSelect(select: HTMLSelectElement | null, selected: LayoutId): void {
    if (!select) return
    const choices = allConverterLayouts()
    select.replaceChildren()
    for (const id of choices) {
      const option = document.createElement('option')
      option.value = id
      option.textContent = optionLabel(id)
      select.append(option)
    }
    select.value = choices.includes(selected) ? selected : (choices[0] ?? '')
  }

  function fillLanguageSelect(select: HTMLSelectElement | null, selected: LanguageCode): void {
    if (!select) return
    select.replaceChildren()
    for (const item of SUPPORTED_LANGUAGES) {
      const option = document.createElement('option')
      option.value = item.code
      option.textContent = languageOptionLabel(item)
      select.append(option)
    }
    select.value = SUPPORTED_LANGUAGES.some((item) => item.code === selected)
      ? selected
      : DEFAULT_SOURCE_LANGUAGE
  }

  function syncPairControls(): void {
    const layout = resolvedLayoutPair()
    pair = layout
    fillSelect(sourceEl(), layout.sourceLayout)
    fillSelect(targetEl(), layout.targetLayout)
    fillLanguageSelect(langSourceEl(), langSource)
    fillLanguageSelect(langTargetEl(), langTarget)
  }

  function applyModeChrome(): void {
    const panel = panelEl()
    if (panel) panel.dataset.mode = mode
    if (pairLayoutEl()) pairLayoutEl()!.hidden = mode !== 'layout'
    if (pairTranslateEl()) pairTranslateEl()!.hidden = mode !== 'translate'
    shadow?.querySelectorAll<HTMLButtonElement>('[data-flowlary="speed-mode"]').forEach((btn) => {
      const active = btn.dataset.mode === mode
      btn.classList.toggle('is-active', active)
      btn.setAttribute('aria-selected', active ? 'true' : 'false')
      btn.tabIndex = active ? 0 : -1
    })
    lastMode = mode
  }

  function clearAiTimer(): void {
    if (aiTimer) {
      clearTimeout(aiTimer)
      aiTimer = null
    }
  }

  function abortPending(): void {
    runToken += 1
    abort?.abort()
    abort = null
    clearAiTimer()
    busy = false
  }

  function setMode(next: SpeedBoxMode): void {
    if (mode === next) return
    abortPending()
    mode = next
    applyModeChrome()
    if (mode === 'layout') refreshOutput()
    else scheduleAiRun(0)
    queueMicrotask(() => inputEl()?.focus())
  }

  async function copyCurrentResult(): Promise<void> {
    const text = outputTextEl()?.textContent ?? ''
    if (!text) return
    const ok = await copyText(text)
    if (!ok) return
    const hint = resultHintEl()
    if (hint) hint.textContent = 'Copied'
    window.setTimeout(() => {
      if (resultHintEl()?.textContent === 'Copied') {
        resultHintEl()!.textContent = resultHintText(true)
      }
    }, 1500)
  }

  function insertResult(): void {
    const text = outputTextEl()?.textContent ?? ''
    if (!text || !canInsert() || !restored) return
    const element = restored.element
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return
    const value = element.value
    const start = restored.start
    const end = restored.end
    const hasRange = start != null && end != null && start !== end
    const from = hasRange ? start : 0
    const to = hasRange ? end : value.length
    const origin: WriterTag =
      mode === 'translate' ? 'TRANSLATE' : mode === 'fix' ? 'CORRECT' : 'FIX_LAYOUT'
    const capability =
      mode === 'translate' ? 'translation' : mode === 'fix' ? 'correction' : 'layout'
    const session = options.getSession?.(element) ?? new FieldSession(element)
    const acquired = session.tryAcquireWrite(origin)
    if (!acquired.ok) return
    const write = commitWriteTransaction(element, from, to, text, {
      origin,
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      placeCaretAfter: true,
      allowActiveEdit: true,
      auto: false,
      capability,
      trigger: 'manual_box',
      tagTranslated: mode === 'translate',
      action:
        mode === 'translate'
          ? 'translation'
          : mode === 'fix'
            ? 'english_correction'
            : 'layout_fix',
    })
    session.releaseWrite(origin, acquired.requestId)
    if (write.verdict !== 'written') return
    const caret = from + text.length
    restored = { element, start: caret, end: caret }
    close()
  }

  function refreshOutput(): void {
    if (mode !== 'layout') return
    const input = inputEl()
    if (!input) return
    const current = resolvedLayoutPair()
    const result = convertManualText(input.value, current.sourceLayout, current.targetLayout)
    if (!result.ok) {
      setResult('')
      setStatus('Conversion unavailable for this layout pair.')
      return
    }
    const converted = result.text
    const show = input.value.trim().length > 0 && converted.length > 0
    if (show && isLayoutBoxMode()) {
      boxSuggestion = converted
      setResult(converted, layoutDirection(current.targetLayout))
      applyEl()?.removeAttribute('hidden')
      return
    }
    if (show && !isLayoutBoxMode()) {
      const input = inputEl()
      if (input && input.value !== converted) {
        input.value = converted
      }
      setResult('')
      setStatus('Converted.', 'info')
      return
    }
    setResult(show ? converted : '', layoutDirection(current.targetLayout))
    if (show) setStatus('')
  }

  function refresh(): void {
    syncPairControls()
    applyModeChrome()
    if (mode === 'layout') refreshOutput()
  }

  function scheduleAiRun(delay = AI_DEBOUNCE_MS): void {
    if (mode === 'layout') return
    clearAiTimer()
    const text = inputEl()?.value.trim() ?? ''
    if (text.length < MIN_AI_CHARS) {
      clearResult()
      return
    }
    aiTimer = setTimeout(() => {
      aiTimer = null
      void runActive()
    }, delay)
  }

  async function runActive(): Promise<void> {
    if (mode === 'layout') {
      refreshOutput()
      return
    }

    const text = inputEl()?.value.trim() ?? ''
    if (!text || busy) return
    const current = profile()

    if (mode === 'fix') {
      if (current.correctionEnabled === false) {
        setStatus(speedError('disabled'))
        return
      }
      if (current.correctionConsentAccepted === false) {
        setStatus(speedError('consent_required'))
        return
      }
    }

    const { source, target } = activeTranslationPair()
    if (mode === 'translate') {
      if (current.translationEnabled === false) {
        setStatus(speedError('disabled'))
        return
      }
      if (source === target) {
        setStatus(speedError('same-language'))
        return
      }
    }

    abort?.abort()
    const token = ++runToken
    abort = new AbortController()
    setBusy(true)
    setStatus('')

    try {
      if (mode === 'translate') {
        const translate = options.translate ?? requestTranslationRemote
        const response = await translate(text, source, target, abort.signal)
        if (token !== runToken) return
        if (!response.ok) {
          setResult('')
          setStatus(speedError(response.code))
          return
        }
        if (isTranslateBoxMode()) {
          boxSuggestion = response.translation
          setResult(response.translation, languageDirection(target))
          applyEl()?.removeAttribute('hidden')
          return
        }
        writeInput(response.translation)
        setResult('')
        setStatus('Translated.', 'info')
        return
      }

      const requestId = crypto.randomUUID()
      const correct =
        options.correct ??
        ((id, value, signal) => requestCorrectionRemote(id, value, 'textarea', undefined, signal))
      const response = await correct(requestId, text, abort.signal)
      if (token !== runToken) return
      if (!response.ok) {
        setResult('')
        setStatus(speedError(response.error))
        return
      }
      const corrected = response.data.correctedText
      if (corrected === text || response.data.changes.length === 0) {
        boxSuggestion = null
        applyEl()?.setAttribute('hidden', '')
        setResult('')
        setStatus('Looks good.', 'info')
        return
      }
      if (isFixBoxMode()) {
        boxSuggestion = corrected
        setResultDiff(text, corrected, response.data.changes, 'ltr')
        applyEl()?.removeAttribute('hidden')
        setStatus('')
        return
      }
      writeInput(corrected)
      boxSuggestion = null
      applyEl()?.setAttribute('hidden', '')
      setResult('')
      setStatus('Fixed.', 'info')
    } catch {
      if (token !== runToken) return
      setResult('')
      setStatus(speedError('network'))
    } finally {
      if (token === runToken) {
        setBusy(false)
        abort = null
      }
    }
  }

  function onInput(): void {
    if (mode === 'layout') {
      refreshOutput()
      return
    }
    setStatus('')
    scheduleAiRun()
  }

  function onPanelKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }

    const digit = event.key
    if ((event.metaKey || event.ctrlKey) && digit >= '1' && digit <= '3') {
      event.preventDefault()
      const next = MODES[Number(digit) - 1]
      if (next) setMode(next)
      return
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const target = event.target
      if (target instanceof HTMLButtonElement && target.dataset.flowlary === 'speed-mode') {
        event.preventDefault()
        const index = MODES.indexOf(mode)
        const delta = event.key === 'ArrowRight' ? 1 : -1
        const next = MODES[(index + delta + MODES.length) % MODES.length]
        if (next) {
          setMode(next)
          shadow
            ?.querySelector<HTMLButtonElement>(`[data-flowlary="speed-mode"][data-mode="${next}"]`)
            ?.focus()
        }
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && event.target === inputEl()) {
      if (boxSuggestion && (isFixBoxMode() || isTranslateBoxMode() || isLayoutBoxMode())) {
        event.preventDefault()
        applyBoxSuggestion()
        return
      }
      if (mode === 'layout' && !isLayoutBoxMode() && canInsert()) {
        const value = inputEl()?.value ?? ''
        if (value.trim()) {
          event.preventDefault()
          const textEl = outputTextEl()
          if (textEl) textEl.textContent = value
          insertResult()
          return
        }
      }
      const result = outputTextEl()?.textContent ?? ''
      if (result && canInsert()) {
        event.preventDefault()
        insertResult()
        return
      }
      if (mode !== 'layout') {
        event.preventDefault()
        clearAiTimer()
        void runActive()
      }
    }
  }

  function ensureHost(): ShadowRoot {
    if (host && shadow && host.isConnected) return shadow
    host = document.createElement('div')
    host.id = SPEED_BOX_HOST_ID
    host.setAttribute('data-flowlary-speed-box', '')
    ensureSpeedBoxTheme(host)
    shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `<style>${styles}</style>
      <div class="backdrop" data-flowlary="speed-backdrop"></div>
      <div class="panel" data-flowlary="speed-panel" role="dialog" aria-modal="true" aria-labelledby="fl-speed-title" data-mode="layout">
        <div class="header">
          <p class="title" id="fl-speed-title">Speed Box</p>
          <p class="shortcut">${speedBoxShortcutHint()} · Esc</p>
        </div>
        <div class="modes" role="tablist" aria-label="Mode">
          <button type="button" class="mode is-active" role="tab" data-flowlary="speed-mode" data-mode="layout" aria-selected="true">Layout</button>
          <button type="button" class="mode" role="tab" data-flowlary="speed-mode" data-mode="translate" aria-selected="false">Translate</button>
          <button type="button" class="mode" role="tab" data-flowlary="speed-mode" data-mode="fix" aria-selected="false">Fix</button>
        </div>
        <div class="pair" data-flowlary="speed-pair-layout">
          <select data-flowlary="speed-source" aria-label="Source keyboard layout"></select>
          <button type="button" class="swap" data-flowlary="speed-swap" aria-label="Swap layouts">⇄</button>
          <select data-flowlary="speed-target" aria-label="Target keyboard layout"></select>
        </div>
        <div class="pair" data-flowlary="speed-pair-translate" hidden>
          <select data-flowlary="speed-lang-source" aria-label="Source language"></select>
          <button type="button" class="swap" data-flowlary="speed-swap-lang" aria-label="Swap languages">⇄</button>
          <select data-flowlary="speed-lang-target" aria-label="Target language"></select>
        </div>
        <textarea data-flowlary="speed-input" rows="3" spellcheck="false" autocomplete="off" dir="auto" placeholder="Type or paste…"></textarea>
        <div class="fix-actions" data-flowlary="speed-fix-actions">
          <button type="button" class="result" data-flowlary="speed-result" hidden>
            <span class="result-text" data-flowlary="speed-result-text" dir="auto"></span>
            <span class="result-hint" data-flowlary="speed-result-hint"></span>
          </button>
          <button type="button" class="apply" data-flowlary="speed-apply" hidden>Apply</button>
        </div>
        <p class="status" data-flowlary="speed-status" hidden></p>
      </div>`

    shadow.addEventListener('keydown', (event) => {
      onPanelKeyDown(event as KeyboardEvent)
    })
    shadow.querySelector('[data-flowlary="speed-backdrop"]')?.addEventListener('pointerdown', () => {
      close()
    })
    shadow.querySelectorAll<HTMLButtonElement>('[data-flowlary="speed-mode"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.mode
        if (next === 'layout' || next === 'translate' || next === 'fix') setMode(next)
      })
    })
    sourceEl()?.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value
      pair = resolveConverterPair(layoutProfile(), {
        ...resolvedLayoutPair(),
        sourceLayout: asLayoutId(value),
      })
      refreshOutput()
    })
    targetEl()?.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value
      pair = resolveConverterPair(layoutProfile(), {
        ...resolvedLayoutPair(),
        targetLayout: asLayoutId(value),
      })
      refreshOutput()
    })
    shadow.querySelector('[data-flowlary="speed-swap"]')?.addEventListener('click', () => {
      pair = swapConverterPair(resolvedLayoutPair())
      fillSelect(sourceEl(), pair.sourceLayout)
      fillSelect(targetEl(), pair.targetLayout)
      refreshOutput()
    })
    langSourceEl()?.addEventListener('change', (event) => {
      langSource = normalizeLanguage((event.target as HTMLSelectElement).value, langSource)
      lastLangPair = { source: langSource, target: langTarget }
      scheduleAiRun(0)
    })
    langTargetEl()?.addEventListener('change', (event) => {
      langTarget = normalizeLanguage((event.target as HTMLSelectElement).value, langTarget)
      lastLangPair = { source: langSource, target: langTarget }
      scheduleAiRun(0)
    })
    shadow.querySelector('[data-flowlary="speed-swap-lang"]')?.addEventListener('click', () => {
      const nextSource = langTarget
      langTarget = langSource
      langSource = nextSource
      lastLangPair = { source: langSource, target: langTarget }
      fillLanguageSelect(langSourceEl(), langSource)
      fillLanguageSelect(langTargetEl(), langTarget)
      scheduleAiRun(0)
    })
    inputEl()?.addEventListener('input', onInput)
    resultEl()?.addEventListener('click', () => {
      if (boxSuggestion && (isFixBoxMode() || isTranslateBoxMode() || isLayoutBoxMode())) {
        applyBoxSuggestion()
        return
      }
      void copyCurrentResult()
    })
    applyEl()?.addEventListener('click', () => {
      applyBoxSuggestion()
    })
    ;(document.body ?? document.documentElement).append(host)
    return shadow
  }

  function openBox(): boolean {
    if (!profile().manualConversionEnabled) return false
    if (!open) restored = captureFocus()
    ensureHost()
    if (host) syncSpeedBoxTheme(host)
    if (!open) {
      pair = resolveConverterPair(layoutProfile())
      const defaults = defaultTranslationPair()
      langSource = lastLangPair?.source ?? defaults.source
      langTarget = lastLangPair?.target ?? defaults.target
      lastLangPair = { source: langSource, target: langTarget }
      mode = lastMode
      const input = inputEl()
      if (input) input.value = prefillFromField()
      clearResult()
      refresh()
      host!.hidden = false
      open = true
      if (mode !== 'layout') scheduleAiRun(input?.value.trim().length ? 0 : AI_DEBOUNCE_MS)
    } else {
      refresh()
    }
    queueMicrotask(() => inputEl()?.focus())
    return true
  }

  function close(): void {
    if (!open) return
    abortPending()
    open = false
    const input = inputEl()
    if (input) input.value = ''
    clearResult()
    pair = null
    if (host) host.hidden = true
    restoreFocus()
  }

  function toggle(): boolean {
    if (open) {
      close()
      return false
    }
    return openBox()
  }

  return {
    isOpen: () => open,
    ownsEvent(event: Event) {
      return host != null && event.composedPath().includes(host)
    },
    open: openBox,
    close,
    toggle,
    handleEscape() {
      if (open) close()
    },
    destroy() {
      close()
      lastMode = 'layout'
      lastLangPair = null
      speedBoxThemeCleanup?.()
      host?.remove()
      host = null
      shadow = null
    },
  }
}
