import type { LayoutId, UserLayoutProfile } from '../layouts/types.ts'
import {
  canCommitMismatch,
  inferSourceLayout,
  localClassificationHint,
  mapLayout,
} from '../layouts/index.ts'
import type { LayoutCache } from '../cache/LayoutCache.ts'
import { toCacheRecord } from '../cache/records.ts'
import type { LayoutMetrics } from '../metrics.ts'
import { createCoalescer } from '../cache/coalesce.ts'
import { runWithPhysicalHttp } from '../../../core/runtime/physicalHttp.ts'
import type { Operation } from '../../../core/runtime/types.ts'

export type ClassifierVerdict = {
  kind: 'VALID' | 'LAYOUT_MISMATCH'
  targetLayout?: LayoutId
  corrected?: string
  sourceLayout: LayoutId
}

export type ClassifierResult =
  | { ok: true; verdict: ClassifierVerdict }
  | { ok: false; reason: 'network' | 'aborted' | 'error' }

const coalesce = createCoalescer<ClassifierResult>()

export type LayoutClassifierOptions = {
  cache: LayoutCache
  metrics: LayoutMetrics
  classifyRemote?: (
    word: string,
    profile: UserLayoutProfile,
    context?: string,
  ) => Promise<ClassifierResult>
}

export class LayoutClassifier {
  readonly cache: LayoutCache
  readonly metrics: LayoutMetrics
  private classifyRemote: LayoutClassifierOptions['classifyRemote']

  constructor(options: LayoutClassifierOptions) {
    this.cache = options.cache
    this.metrics = options.metrics
    this.classifyRemote = options.classifyRemote
  }

  localHint(word: string, profile: UserLayoutProfile, context = '') {
    return localClassificationHint(word, profile, context)
  }

  private verdictFromRecord(
    record: NonNullable<ReturnType<LayoutCache['get']>>,
    source: LayoutId,
  ): ClassifierVerdict {
    if (record.result.kind === 'VALID') {
      return { kind: 'VALID', sourceLayout: source }
    }
    return {
      kind: 'LAYOUT_MISMATCH',
      targetLayout: record.targetLayout ?? source,
      corrected: record.corrected,
      sourceLayout: source,
    }
  }

  decideFromCache(
    word: string,
    profile: UserLayoutProfile,
    context?: string,
  ): ClassifierVerdict | null {
    const source = inferSourceLayout(word, profile) ?? profile.sourceLayout
    const key = this.cache.flowKeyFor(word, profile, source, context)
    const hot = this.cache.decide(key)
    if (hot.kind === 'miss') return null
    this.metrics.layout_cache_hits += 1
    if (hot.kind === 'valid') {
      return { kind: 'VALID', sourceLayout: source }
    }
    const target = hot.record.targetLayout ?? source
    return {
      kind: 'LAYOUT_MISMATCH',
      targetLayout: target,
      corrected: hot.corrected,
      sourceLayout: source,
    }
  }

  remember(word: string, profile: UserLayoutProfile, verdict: ClassifierVerdict, context?: string) {
    const source = verdict.sourceLayout
    if (verdict.kind === 'VALID') {
      this.cache.set(word, profile, source, toCacheRecord({ kind: 'VALID' }), context)
      return
    }
    this.cache.set(
      word,
      profile,
      source,
      toCacheRecord(
        { kind: 'LAYOUT_MISMATCH', targetLayout: verdict.targetLayout! },
        { corrected: verdict.corrected },
      ),
      context,
    )
  }

  async classify(
    word: string,
    profile: UserLayoutProfile,
    context = '',
    signal?: AbortSignal,
    physical?: { fieldId: string; operation?: Operation; isCurrent?: () => boolean },
  ): Promise<ClassifierResult> {
    const local = this.localHint(word, profile, context)
    if (local) {
      this.metrics.layout_local_hits += 1
      const source = inferSourceLayout(word, profile) ?? profile.sourceLayout
      if (local.kind === 'VALID') {
        const verdict: ClassifierVerdict = { kind: 'VALID', sourceLayout: source }
        this.remember(word, profile, verdict, context)
        return { ok: true, verdict }
      }
      const corrected = mapLayout(word, source, local.targetLayout)
      const verdict: ClassifierVerdict = {
        kind: 'LAYOUT_MISMATCH',
        targetLayout: local.targetLayout,
        corrected: corrected ?? undefined,
        sourceLayout: source,
      }
      this.remember(word, profile, verdict, context)
      return { ok: true, verdict }
    }

    const cached = this.decideFromCache(word, profile, context)
    if (cached) return { ok: true, verdict: cached }

    const source = inferSourceLayout(word, profile) ?? profile.sourceLayout
    const persisted = await this.cache.getWithL2(word, profile, source, context)
    if (persisted) {
      this.metrics.layout_cache_hits += 1
      return { ok: true, verdict: this.verdictFromRecord(persisted, source) }
    }

    if (!this.classifyRemote) {
      return { ok: false, reason: 'error' }
    }

    const key = this.cache.flowKeyFor(word, profile, source, context)
    this.metrics.layout_classifier_calls += 1

    return coalesce.run(key, async () => {
      if (signal?.aborted) return { ok: false, reason: 'aborted' }
      const fieldId = physical?.fieldId
      const dispatch = () => this.classifyRemote!(word, profile, context)
      const remote = fieldId
        ? await runWithPhysicalHttp(
          {
            fieldId,
            feature: 'layout',
            isCurrent: () => {
              if (signal?.aborted) return false
              if (physical?.operation && (
                physical.operation.state === 'superseded'
                || physical.operation.state === 'aborted'
                || physical.operation.state === 'failed'
              )) {
                return false
              }
              return physical?.isCurrent ? physical.isCurrent() : true
            },
          },
          dispatch,
        )
        : { dispatched: true as const, value: await dispatch() }
      if (!remote.dispatched) return { ok: false, reason: 'aborted' }
      if (remote.value.ok) this.remember(word, profile, remote.value.verdict, context)
      return remote.value
    })
  }

  canApply(
    profile: UserLayoutProfile,
    word: string,
    target: LayoutId,
    corrected: string | undefined,
    context = '',
  ): boolean {
    return canCommitMismatch(profile, word, target, corrected, context)
  }
}

export async function defaultRemoteClassifier(
  word: string,
  profile: UserLayoutProfile,
  context?: string,
): Promise<ClassifierResult> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { ok: false, reason: 'network' }
  }
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'CHECK_WORD',
      word,
      context,
      sourceLayout: inferSourceLayout(word, profile) ?? profile.sourceLayout,
      candidateLayouts: profile.enabledLayouts,
    })) as
      | {
          type: 'CHECK_WORD_RESULT'
          result: { kind: 'VALID' | 'LAYOUT_MISMATCH'; targetLayout?: LayoutId }
          corrected?: string
          sourceLayout: LayoutId
        }
      | { type: 'CHECK_WORD_ERROR'; reason?: string }
      | undefined

    if (!response || response.type === 'CHECK_WORD_ERROR') {
      return { ok: false, reason: 'network' }
    }
    return {
      ok: true,
      verdict: {
        kind: response.result.kind,
        targetLayout: response.result.targetLayout,
        corrected: response.corrected,
        sourceLayout: response.sourceLayout,
      },
    }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
