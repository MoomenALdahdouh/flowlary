import { CORRECTION_DEFAULTS } from '@flowlary/shared'

export type DebounceOptions = {
  defaultMs?: number
  wordBoundaryMs?: number
  sentenceBoundaryMs?: number
}

export function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?]["')\]]?\s*$/.test(text) || /\n\s*$/.test(text)
}

export function endsWithWordBoundary(text: string): boolean {
  return /[ \t]$/.test(text)
}

export function getDebounceDelay(text: string, options: DebounceOptions = {}): number {
  const defaultMs = options.defaultMs ?? CORRECTION_DEFAULTS.DEBOUNCE_MS
  const wordMs = options.wordBoundaryMs ?? CORRECTION_DEFAULTS.WORD_BOUNDARY_DEBOUNCE_MS
  const sentenceMs = options.sentenceBoundaryMs ?? CORRECTION_DEFAULTS.SENTENCE_BOUNDARY_DEBOUNCE_MS
  if (endsWithSentenceBoundary(text)) return sentenceMs
  if (endsWithWordBoundary(text)) return wordMs
  return defaultMs
}

export class IntelligentDebouncer {
  private timer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  private options: DebounceOptions

  constructor(
    private readonly run: (text: string, generation: number) => void,
    options: DebounceOptions = {},
  ) {
    this.options = options
  }

  setOptions(options: DebounceOptions): void {
    this.options = { ...this.options, ...options }
  }

  schedule(text: string): number {
    this.cancel()
    const gen = ++this.generation
    const delay = getDebounceDelay(text, this.options)
    this.timer = setTimeout(() => {
      this.timer = null
      this.run(text, gen)
    }, delay)
    return gen
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  currentGeneration(): number {
    return this.generation
  }

  bump(): number {
    this.cancel()
    return ++this.generation
  }
}

export function debounceOptionsForMode(mode: 'box' | 'direct'): DebounceOptions {
  if (mode === 'direct') {
    return {
      defaultMs: CORRECTION_DEFAULTS.LIVE_DIRECT_DEBOUNCE_MS,
      wordBoundaryMs: CORRECTION_DEFAULTS.LIVE_DIRECT_WORD_BOUNDARY_DEBOUNCE_MS,
      sentenceBoundaryMs: CORRECTION_DEFAULTS.LIVE_DIRECT_SENTENCE_BOUNDARY_DEBOUNCE_MS,
    }
  }
  return {
    defaultMs: CORRECTION_DEFAULTS.DEBOUNCE_MS,
    wordBoundaryMs: CORRECTION_DEFAULTS.WORD_BOUNDARY_DEBOUNCE_MS,
    sentenceBoundaryMs: CORRECTION_DEFAULTS.SENTENCE_BOUNDARY_DEBOUNCE_MS,
  }
}
