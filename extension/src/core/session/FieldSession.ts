import type { WriterTag } from '@flowlary/shared'
import { hashWritingSample } from '@flowlary/shared'
import type { FieldSnapshot } from '../dom/types.ts'
import { resolveEditableKind } from '../dom/read.ts'
import { BULK_PASTE_CHAR_LIMIT } from '../safety/index.ts'

let nextFieldCounter = 0

const fieldIds = new WeakMap<Element, string>()

export function fieldIdentity(element: Element): string {
  const existing = fieldIds.get(element)
  if (existing) return existing
  const id = `field-${++nextFieldCounter}-${element.tagName.toLowerCase()}`
  fieldIds.set(element, id)
  return id
}

export function toFieldRef(element: Element) {
  const kind = resolveEditableKind(element)
  return {
    id: fieldIdentity(element),
    tag: element.tagName,
    kind: kind === 'value'
      ? element instanceof HTMLTextAreaElement
        ? 'textarea' as const
        : 'text' as const
      : kind === 'contenteditable'
        ? 'contenteditable' as const
        : undefined,
  }
}

export type ActiveRequest = {
  operation: WriterTag
  requestId: number
  generation: number
  signal: AbortSignal
  controller: AbortController
}

export type AcquireResult =
  | { ok: true; requestId: number; generation: number; signal: AbortSignal }
  | { ok: false; reason: 'mutex-held' | 'composing' }

export type CommitVerdict =
  | { ok: true }
  | { ok: false; reason: 'stale-generation' | 'stale-request' | 'composing' | 'aborted' | 'mutex' }

export class FieldSession {
  readonly field: ReturnType<typeof toFieldRef>
  readonly element: Element

  private generation = 0
  private requestSequence = 0
  private activeRequest: ActiveRequest | null = null
  private readonly generationRequests = new Set<AbortController>()
  private lastCommittedSnapshot: FieldSnapshot | null = null
  private composing = false
  private lastWriter: WriterTag | null = null
  private lastInputAt = 0
  private cooldownUntil = 0
  private translationSessionId: string | null = null
  private translationPaused = false
  private translatedRanges: { start: number; end: number; hash: string }[] = []
  private correctedRanges: { start: number; end: number; hash: string }[] = []
  private lastPipelineTranslateKey: string | null = null
  private inputSource: 'typing' | 'paste' | 'drop' | 'programmatic' | 'unknown' = 'unknown'
  private lastInputInsertLength = 0
  private lastEngineSpan: { start: number; end: number; hash: string; generation: number } | null = null
  private overrideRanges: { start: number; end: number }[] = []
  private commitOpenToken = false
  private blurTranslationPass = false
  private translationFocusOutCompletion = false
  private pendingLayoutRun: {
    direction: 'en_on_ar' | 'ar_on_en'
    consecutiveCount: number
    end: number
  } | null = null
  private reviewHashes = new Set<string>()
  private lastReviewAt = 0
  private pauseReviewTimer: ReturnType<typeof setTimeout> | null = null

  constructor(element: Element) {
    this.element = element
    this.field = toFieldRef(element)
  }

  getGeneration(): number {
    return this.generation
  }

  bumpGeneration(): number {
    this.generation += 1
    this.abortActiveRequest()
    for (const controller of this.generationRequests) controller.abort()
    this.generationRequests.clear()
    this.clearCooldown()
    this.clearPausedReview()
    return this.generation
  }

  beginGenerationRequest(expectedGeneration: number): {
    signal: AbortSignal
    release: () => void
  } {
    const controller = new AbortController()
    if (expectedGeneration !== this.generation) {
      controller.abort()
    } else {
      this.generationRequests.add(controller)
    }
    return {
      signal: controller.signal,
      release: () => this.generationRequests.delete(controller),
    }
  }

  enterCooldown(ms: number): void {
    this.cooldownUntil = Date.now() + Math.max(0, ms)
  }

  clearCooldown(): void {
    this.cooldownUntil = 0
  }

  isInCooldown(now = Date.now()): boolean {
    return this.cooldownUntil > now
  }

  getCooldownUntil(): number {
    return this.cooldownUntil
  }

  getRequestSequence(): number {
    return this.requestSequence
  }

  nextRequestId(): number {
    this.requestSequence += 1
    return this.requestSequence
  }

  isStale(operationGeneration: number, requestId?: number): boolean {
    if (operationGeneration !== this.generation) return true
    if (requestId !== undefined && requestId < this.requestSequence) return true
    return false
  }

  getActiveRequest(): ActiveRequest | null {
    return this.activeRequest
  }

  tryAcquireWrite(operation: WriterTag): AcquireResult {
    if (this.composing) return { ok: false, reason: 'composing' }
    if (this.activeRequest !== null) return { ok: false, reason: 'mutex-held' }

    const requestId = this.nextRequestId()
    const generation = this.getGeneration()
    const controller = new AbortController()
    this.activeRequest = {
      operation,
      requestId,
      generation,
      signal: controller.signal,
      controller,
    }
    return { ok: true, requestId, generation, signal: controller.signal }
  }

  releaseWrite(operation: WriterTag, requestId: number): void {
    if (!this.activeRequest) return
    if (this.activeRequest.requestId !== requestId) return
    if (this.activeRequest.operation !== operation) return
    this.activeRequest = null
  }

  abortActiveRequest(): void {
    if (this.activeRequest) {
      this.activeRequest.controller.abort()
      this.nextRequestId()
      this.activeRequest = null
    }
  }

  /** @deprecated use abortActiveRequest */
  abortActive(): void {
    this.abortActiveRequest()
  }

  canCommit(operationGeneration: number, requestId: number): CommitVerdict {
    if (this.composing) return { ok: false, reason: 'composing' }
    const active = this.activeRequest
    if (active) {
      if (active.signal.aborted) return { ok: false, reason: 'aborted' }
      if (active.requestId !== requestId) return { ok: false, reason: 'mutex' }
    }
    if (this.isStale(operationGeneration, requestId)) {
      return {
        ok: false,
        reason: operationGeneration !== this.generation ? 'stale-generation' : 'stale-request',
      }
    }
    return { ok: true }
  }

  noteWrite(writer: WriterTag, requestId: number, snapshot?: FieldSnapshot): void {
    this.lastWriter = writer
    if (snapshot) this.lastCommittedSnapshot = snapshot
    this.releaseWrite(writer, requestId)
  }

  setComposing(value: boolean): void {
    this.composing = value
    if (value) this.abortActiveRequest()
  }

  isComposing(): boolean {
    return this.composing
  }

  noteInput(): void {
    this.lastInputAt = Date.now()
  }

  requestCommitOpenToken(): void {
    this.commitOpenToken = true
  }

  consumeCommitOpenToken(): boolean {
    const pending = this.commitOpenToken
    this.commitOpenToken = false
    return pending
  }

  noteBlurTranslationPass(): void {
    this.blurTranslationPass = true
  }

  consumeBlurTranslationPass(): boolean {
    const pending = this.blurTranslationPass
    this.blurTranslationPass = false
    if (pending) this.translationFocusOutCompletion = true
    return pending
  }

  /** Focus-out completion for live translation polish context (consumed once per request). */
  takeTranslationFocusOutCompletion(): boolean {
    const pending = this.translationFocusOutCompletion
    this.translationFocusOutCompletion = false
    return pending
  }

  noteLayoutRun(direction: 'en_on_ar' | 'ar_on_en', end: number, addedTokens: number): void {
    if (this.pendingLayoutRun?.direction === direction) {
      this.pendingLayoutRun.consecutiveCount += Math.max(1, addedTokens)
      this.pendingLayoutRun.end = end
      return
    }
    this.pendingLayoutRun = {
      direction,
      consecutiveCount: Math.max(1, addedTokens),
      end,
    }
  }

  getPendingLayoutRun(text: string, caret: number): { direction: 'en_on_ar' | 'ar_on_en'; consecutiveCount: number } | null {
    const pending = this.pendingLayoutRun
    if (!pending) return null
    if (pending.end > text.length || caret < pending.end) {
      this.pendingLayoutRun = null
      return null
    }
    const between = text.slice(pending.end, caret)
    if (!/^\s*\S*\s*$/.test(between)) {
      this.pendingLayoutRun = null
      return null
    }
    return { direction: pending.direction, consecutiveCount: pending.consecutiveCount }
  }

  clearPendingLayoutRun(): void {
    this.pendingLayoutRun = null
  }

  noteInputSource(
    source: 'typing' | 'paste' | 'drop' | 'programmatic' | 'unknown',
    insertLength = 0,
  ): void {
    this.inputSource = source
    this.lastInputInsertLength = Math.max(0, insertLength)
  }

  getInputSource(): 'typing' | 'paste' | 'drop' | 'programmatic' | 'unknown' {
    return this.inputSource
  }

  getLastInputInsertLength(): number {
    return this.lastInputInsertLength
  }

  isBulkPasteInput(): boolean {
    return (
      (this.inputSource === 'paste' || this.inputSource === 'drop')
      && this.lastInputInsertLength > BULK_PASTE_CHAR_LIMIT
    )
  }

  noteEngineSpan(start: number, end: number, text: string): void {
    if (end <= start) return
    this.lastEngineSpan = {
      start,
      end,
      hash: hashWritingSample(text),
      generation: this.generation,
    }
  }

  detectUserOverride(text: string): void {
    const last = this.lastEngineSpan
    if (!last) return
    if (this.generation <= last.generation) return
    if (last.end > text.length || last.start < 0) {
      this.lastEngineSpan = null
      return
    }
    const current = text.slice(last.start, last.end)
    if (hashWritingSample(current) !== last.hash) {
      this.overrideRanges.push({ start: last.start, end: last.end })
      this.pendingLayoutRun = null
    }
    this.lastEngineSpan = null
  }

  getOverrideRanges(): readonly { start: number; end: number }[] {
    return this.overrideRanges
  }

  noteUserOverride(start: number, end: number): void {
    if (end <= start) return
    this.overrideRanges.push({ start, end })
    this.pendingLayoutRun = null
    this.lastEngineSpan = null
  }

  pruneOverrideRanges(text: string): void {
    this.overrideRanges = this.overrideRanges.filter((range) => range.end <= text.length && range.start >= 0)
  }

  getLastInputAt(): number {
    return this.lastInputAt
  }

  getLastWriter(): WriterTag | null {
    return this.lastWriter
  }

  hasCachedReview(hash: string): boolean {
    return this.reviewHashes.has(hash)
  }

  cacheReview(hash: string): void {
    this.reviewHashes.add(hash)
    if (this.reviewHashes.size > 48) {
      const first = this.reviewHashes.values().next().value
      if (first) this.reviewHashes.delete(first)
    }
  }

  getLastReviewAt(): number {
    return this.lastReviewAt
  }

  noteReviewAttempt(): void {
    this.lastReviewAt = Date.now()
  }

  schedulePausedReview(fn: () => void, delayMs: number): void {
    this.clearPausedReview()
    this.pauseReviewTimer = setTimeout(() => {
      this.pauseReviewTimer = null
      fn()
    }, Math.max(0, delayMs))
  }

  clearPausedReview(): void {
    if (this.pauseReviewTimer) {
      clearTimeout(this.pauseReviewTimer)
      this.pauseReviewTimer = null
    }
  }

  pauseTranslationOnField(): void {
    this.translationPaused = true
    this.translationSessionId = null
  }

  resumeTranslationOnField(): void {
    this.translationPaused = false
  }

  isTranslationPaused(): boolean {
    return this.translationPaused
  }

  ensureTranslationSession(): string | null {
    if (this.translationPaused) return null
    if (!this.translationSessionId) {
      this.translationSessionId = `ts-${this.field.id}-${Date.now()}`
    }
    return this.translationSessionId
  }

  endTranslationSession(): void {
    this.translationSessionId = null
  }

  getTranslationSessionId(): string | null {
    return this.translationSessionId
  }

  tagTranslatedOutput(start: number, end: number, text = ''): void {
    if (end <= start) return
    this.translatedRanges.push({
      start,
      end,
      hash: text ? hashWritingSample(text) : '',
    })
  }

  pruneTranslatedTags(text: string): void {
    this.translatedRanges = this.translatedRanges.filter((range) => {
      if (range.end > text.length || range.start < 0) return false
      if (!range.hash) return true
      return hashWritingSample(text.slice(range.start, range.end)) === range.hash
    })
  }

  hasTranslatedOverlap(start: number, end: number): boolean {
    return this.translatedRanges.some((range) => range.start < end && range.end > start)
  }

  clearTranslatedTags(): void {
    this.translatedRanges = []
  }

  getTranslatedRanges(): readonly { start: number; end: number }[] {
    return this.translatedRanges.map(({ start, end }) => ({ start, end }))
  }

  tagCorrectedOutput(start: number, end: number, text = ''): void {
    if (end <= start) return
    this.correctedRanges.push({
      start,
      end,
      hash: text ? hashWritingSample(text) : '',
    })
  }

  pruneCorrectedTags(text: string): void {
    this.correctedRanges = this.correctedRanges.filter((range) => {
      if (range.end > text.length || range.start < 0) return false
      if (!range.hash) return true
      return hashWritingSample(text.slice(range.start, range.end)) === range.hash
    })
  }

  getCorrectedRanges(): readonly { start: number; end: number }[] {
    return this.correctedRanges.map(({ start, end }) => ({ start, end }))
  }

  notePipelineTranslateKey(key: string | null): void {
    this.lastPipelineTranslateKey = key
  }

  getLastPipelineTranslateKey(): string | null {
    return this.lastPipelineTranslateKey
  }

  getLastCommittedSnapshot(): FieldSnapshot | null {
    return this.lastCommittedSnapshot
  }

  /** Legacy API — prefer tryAcquireWrite */
  beginOperation(operation: WriterTag): AbortController {
    const acquired = this.tryAcquireWrite(operation)
    if (!acquired.ok) {
      const controller = new AbortController()
      controller.abort()
      return controller
    }
    return this.activeRequest!.controller
  }

  completeOperation(operation: WriterTag, snapshot?: FieldSnapshot): void {
    const active = this.activeRequest
    if (active && active.operation === operation) {
      this.noteWrite(operation, active.requestId, snapshot)
    }
  }
}

export class FieldSessionRegistry {
  private sessions = new WeakMap<Element, FieldSession>()
  private idToElement = new Map<string, Element>()

  getOrCreate(element: Element): FieldSession {
    let session = this.sessions.get(element)
    if (!session) {
      session = new FieldSession(element)
      this.sessions.set(element, session)
    }
    this.idToElement.set(session.field.id, element)
    return session
  }

  get(element: Element): FieldSession | undefined {
    return this.sessions.get(element)
  }

  resolveElement(fieldId: string): Element | undefined {
    const element = this.idToElement.get(fieldId)
    if (!element) return undefined
    if (!element.isConnected) {
      this.idToElement.delete(fieldId)
      return undefined
    }
    return element
  }

  delete(element: Element): void {
    const session = this.sessions.get(element)
    if (session) this.idToElement.delete(session.field.id)
    session?.abortActiveRequest()
    this.sessions.delete(element)
  }
}
