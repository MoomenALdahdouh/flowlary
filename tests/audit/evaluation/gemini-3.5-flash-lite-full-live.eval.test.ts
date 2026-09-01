/**
 * Isolated Gemini 3.5 Flash-Lite full live shadow eval.
 * Production GEMINI_ADVISOR_ENABLED, fallback, apply, Groq maxTokens, prompt, and packet stay unchanged.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetch as undiciFetch } from 'undici'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildAdvisorPacket,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  resetHypothesisIdsForTests,
  setAdvisorApplyMode,
  setHypothesisAdvisor,
  shouldConsultAdvisor,
} from '../../../extension/src/core/engine/index.ts'
import { layoutSpanConflictsWithMixedIntent } from '../../../extension/src/core/engine/mixedLayoutSafety.ts'
import { AI_MODELS, HYPOTHESIS_ADVISOR_MAX_SNIPPET } from '@flowlary/shared'
import { loadBackendEnvFile, loadConfig } from '../../../backend/src/config/env.ts'
import { ProviderHealthManager } from '../../../backend/src/health/providerHealth.ts'
import { GeminiAdvisorProvider } from '../../../backend/src/providers/geminiAdvisorProvider.ts'
import {
  ADVISOR_CONTRACT_VERSION,
  type AdvisorPacket,
  type AdvisorProviderErrorCategory,
} from '../../../backend/src/providers/advisorTypes.ts'
import {
  generateGptOssShadowCorpus,
  GPT_OSS_SHADOW_SEED,
  type OssGold,
} from '../../unit/writing-engine/gpt-oss-20b-shadow/generate.ts'
import type { AdvisorVote, Hypothesis } from '../../../extension/src/core/engine/types.ts'

const LIVE_ENABLED = process.env.FLOWLARY_GEMINI_FULL_LIVE === 'true'
const TARGET_VALID = 200
const EVAL_TIMEOUT_MS = 20_000
const PACE_OK_MS = 8_000
const PACE_429_MS = 30_000
const PACE_429_MAX_MS = 120_000
const PERSISTENT_429 = 8
const DIR = import.meta.dirname
const BASELINE_PATH = resolve(DIR, 'gemini-3.5-flash-lite-full-live-baseline.json')
const PROGRESS_PATH = resolve(DIR, 'gemini-3.5-flash-lite-full-live-progress.json')
const RESULTS_PATH = resolve(DIR, 'gemini-3.5-flash-lite-full-live-results.json')

type RankRecord = Record<string, unknown>

type ProgressState = {
  version: 1
  seed: number
  model: string
  attempts: number
  ranked: number
  missing: number
  top1: number
  top2: number
  selectedGold: number
  advisedOk: number
  localOkOnRanked: number
  help: number
  harm: number
  mixAdvisedWrite: number
  protectedAdvisedWrite: number
  unknownIds: number
  forbiddenWriteFields: number
  httpStatuses: Record<string, number>
  categories: Record<string, number>
  taxonomy: Record<string, number>
  family: Record<string, { n: number; top1: number; top2: number; advisedOk: number; localOk: number }>
  allLatencies: number[]
  successLatencies: number[]
  failLatencies: number[]
  rankedCaseIds: string[]
  terminalCaseIds: string[]
  records: RankRecord[]
  returnedModel: string | null
  stopReason: string | null
  tokenUsage: { n: number; input: number; output: number; total: number }
  stability: { compared: number; stable: number } | null
}

function inspect(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: `gem-${Math.random().toString(36).slice(2, 10)}`,
    composing: false,
    textLength: text.length,
  })
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context)
  const baseline = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
    advisorResult: 'unused',
  })
  return { context, analysis, hypotheses, candidates, baseline }
}

function goldHypExists(gold: OssGold, hyps: Hypothesis[]): boolean {
  if (gold === 'layout_fix') return hyps.some((item) => item.intent === 'fix_layout')
  if (gold === 'fix_english') return hyps.some((item) => item.intent === 'fix_english')
  return hyps.some((item) => item.intent === 'preserve' || item.intent === 'write_as_is' || item.intent === 'unknown')
}

function goldHypothesisId(gold: OssGold, hyps: Hypothesis[]): string | null {
  const match = hyps
    .filter((item) => {
      if (gold === 'layout_fix') return item.intent === 'fix_layout'
      if (gold === 'fix_english') return item.intent === 'fix_english'
      return item.intent === 'preserve' || item.intent === 'write_as_is' || item.intent === 'unknown'
    })
    .sort((a, b) => b.localScore - a.localScore)[0]
  return match?.id ?? null
}

function actionOk(gold: OssGold, action: string): boolean {
  if (gold === 'layout_fix') return action === 'layout_fix'
  if (gold === 'fix_english') return action === 'english_correction' || action === 'suggestion' || action === 'noop'
  return action === 'noop' || action === 'suggestion'
}

function intentMatchesGold(gold: OssGold, intent: string | undefined): boolean {
  if (!intent) return false
  if (gold === 'layout_fix') return intent === 'fix_layout'
  if (gold === 'fix_english') return intent === 'fix_english'
  return intent === 'preserve' || intent === 'write_as_is' || intent === 'unknown'
}

function classifyRankError(gold: OssGold, family: string, topIntent: string | undefined): string {
  if (!topIntent) return 'empty ranking'
  if (family === 'mixed') return 'mixed-language confusion'
  if (family === 'technical') return 'technical confusion'
  if (family === 'spelling') return 'layout vs spelling'
  if (family === 'short') return 'short-token ambiguity'
  if (family === 'punctuation') return 'punctuation'
  if (gold === 'layout_fix' && (topIntent === 'preserve' || topIntent === 'write_as_is')) return 'preserve vs layout'
  return 'other'
}

function toBackendPacket(packet: ReturnType<typeof buildAdvisorPacket>): AdvisorPacket {
  return {
    cycleId: packet.cycleId,
    snippet: packet.snippet.slice(0, HYPOTHESIS_ADVISOR_MAX_SNIPPET),
    allowedIntents: packet.allowedIntents,
    hypotheses: packet.hypotheses.map((item) => ({
      id: item.id,
      intent: item.intent,
      localScore: item.localScore,
      risk: item.risk,
      needsLLM: item.needsLLM,
      conflicts: item.conflicts,
      evidence: item.evidence,
    })),
  }
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function emptyProgress(model: string): ProgressState {
  return {
    version: 1,
    seed: GPT_OSS_SHADOW_SEED,
    model,
    attempts: 0,
    ranked: 0,
    missing: 0,
    top1: 0,
    top2: 0,
    selectedGold: 0,
    advisedOk: 0,
    localOkOnRanked: 0,
    help: 0,
    harm: 0,
    mixAdvisedWrite: 0,
    protectedAdvisedWrite: 0,
    unknownIds: 0,
    forbiddenWriteFields: 0,
    httpStatuses: {},
    categories: {},
    taxonomy: {},
    family: {},
    allLatencies: [],
    successLatencies: [],
    failLatencies: [],
    rankedCaseIds: [],
    terminalCaseIds: [],
    records: [],
    returnedModel: null,
    stopReason: null,
    tokenUsage: { n: 0, input: 0, output: 0, total: 0 },
    stability: null,
  }
}

function loadProgress(model: string): ProgressState {
  if (!existsSync(PROGRESS_PATH)) return emptyProgress(model)
  try {
    const parsed = JSON.parse(readFileSync(PROGRESS_PATH, 'utf8')) as ProgressState
    if (parsed.version !== 1 || parsed.seed !== GPT_OSS_SHADOW_SEED) return emptyProgress(model)
    return { ...emptyProgress(model), ...parsed, family: parsed.family ?? {} }
  } catch {
    return emptyProgress(model)
  }
}

function saveProgress(state: ProgressState) {
  writeFileSync(PROGRESS_PATH, `${JSON.stringify(state)}\n`)
}

function keyFingerprint(key: string) {
  return {
    prefix: key.slice(0, 3),
    length: key.length,
    sha256_12: createHash('sha256').update(key).digest('hex').slice(0, 12),
  }
}

function envFlag(name: string): string | null {
  const paths = [
    resolve(process.cwd(), '../backend/.env'),
    resolve(process.cwd(), 'backend/.env'),
    resolve(import.meta.dirname, '../../../backend/.env'),
  ]
  for (const path of paths) {
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.startsWith(`${name}=`)) continue
      return line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return process.env[name] ?? null
}

describe('gemini-3.5-flash-lite full live shadow (eval-only)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('shadow')
    stateManager.settings = {
      enabled: true,
      pausedUntil: null,
      excludedDomains: [],
      version: 1,
      helpStyle: 'auto',
    }
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
  })

  afterEach(() => {
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('shadow')
    document.body.innerHTML = ''
  })

  it('production flags and Groq maxTokens remain unchanged', () => {
    const repo = resolve(import.meta.dirname, '../../..')
    const envSrc = readFileSync(resolve(repo, 'backend/src/config/env.ts'), 'utf8')
    const geminiSrc = readFileSync(resolve(repo, 'backend/src/providers/geminiAdvisorProvider.ts'), 'utf8')
    expect(envSrc).toContain("'GROQ_ADVISOR_MAX_TOKENS'")
    expect(envSrc).toContain("readFlag('GEMINI_ADVISOR_ENABLED', false)")
    expect(envSrc).toContain("readEnv('GEMINI_ADVISOR_MODEL', 'gemini-3.5-flash-lite')")
    expect(envSrc).not.toContain('maxTokens: 1024')
    expect(geminiSrc).toContain('HYPOTHESIS_ADVISOR_SYSTEM_PROMPT')
    expect(AI_MODELS.HYPOTHESIS_ADVISOR).toBe('openai/gpt-oss-20b')
    expect(GPT_OSS_SHADOW_SEED).toBe(20261107)
    expect(envFlag('GEMINI_ADVISOR_ENABLED')).toMatch(/^(0|false)?$/i)
    expect(envFlag('FLOWLARY_ADVISOR_FALLBACK_ENABLED') ?? envFlag('ADVISOR_FALLBACK_ENABLED') ?? '0').toMatch(/^(0|false)?$/i)
    expect(envFlag('GROQ_ADVISOR_MAX_TOKENS') ?? '180').toBe('180')
    expect(envFlag('GEMINI_ADVISOR_MODEL') ?? 'gemini-3.5-flash-lite').toBe('gemini-3.5-flash-lite')
  })

  it('computes frozen holdout local baseline without Gemini', () => {
    const corpus = generateGptOssShadowCorpus()
    const holdout = corpus.filter((item) => item.split === 'holdout')
    expect(corpus.length).toBe(5500)
    expect(holdout.length).toBe(1326)
    let exist = 0
    let baselineOk = 0
    let consult = 0
    let layoutGold = 0
    let layoutTp = 0
    let layoutFn = 0
    let layoutFp = 0
    let mixFp = 0
    let protectedFp = 0
    let abstainOk = 0
    let abstainGold = 0
    const families: Record<string, { n: number; ok: number; exist: number }> = {}
    for (const item of holdout) {
      const out = inspect(item.input)
      const bucket = families[item.family] ?? { n: 0, ok: 0, exist: 0 }
      bucket.n += 1
      if (goldHypExists(item.gold, out.hypotheses)) {
        exist += 1
        bucket.exist += 1
      }
      if (actionOk(item.gold, out.baseline.action)) {
        baselineOk += 1
        bucket.ok += 1
      }
      if (shouldConsultAdvisor(out.hypotheses, out.context, out.analysis)) consult += 1
      if (item.gold === 'layout_fix') {
        layoutGold += 1
        if (out.baseline.action === 'layout_fix') layoutTp += 1
        else layoutFn += 1
      } else if (out.baseline.action === 'layout_fix') {
        layoutFp += 1
        if (item.family === 'mixed') mixFp += 1
        if (/https?:\/\/|@|sk-|eyJ/.test(item.input)) protectedFp += 1
      }
      if (item.gold === 'preserve' || item.gold === 'unknown') {
        abstainGold += 1
        if (out.baseline.action === 'noop' || out.baseline.action === 'suggestion') abstainOk += 1
      }
      families[item.family] = bucket
      document.body.innerHTML = ''
    }
    const denom = holdout.length
    const baseline = {
      seed: GPT_OSS_SHADOW_SEED,
      corpus: corpus.length,
      holdout: holdout.length,
      hypothesisExistence: exist / denom,
      hypothesisExistenceCounts: `${exist}/${denom}`,
      baselineAccuracy: baselineOk / denom,
      baselineAccuracyCounts: `${baselineOk}/${denom}`,
      invocationRate: consult / denom,
      layoutRecall: layoutGold ? layoutTp / layoutGold : 0,
      layoutTp,
      layoutFp,
      layoutFn,
      layoutGold,
      mixFp,
      protectedFp,
      abstention: abstainGold ? abstainOk / abstainGold : 0,
      abstentionCounts: `${abstainOk}/${abstainGold}`,
      families,
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`)
    expect(layoutFp).toBe(0)
    expect(mixFp).toBe(0)
    expect(protectedFp).toBe(0)
  })

  it.skipIf(!LIVE_ENABLED)('scores holdout with >=200 eval-only Gemini ranks', { timeout: 5_400_000 }, async () => {
    const corpus = generateGptOssShadowCorpus()
    const holdout = corpus.filter((item) => item.split === 'holdout')
    expect(corpus.length).toBe(5500)
    expect(holdout.length).toBe(1326)

    loadBackendEnvFile()
    const fileConfig = loadConfig()
    expect(fileConfig.groqAdvisorMaxTokens).toBe(512)
    expect(fileConfig.geminiAdvisorModel).toBe('gemini-3.5-flash-lite')
    expect(fileConfig.geminiApiKey.length).toBeGreaterThan(20)
    const fingerprint = keyFingerprint(fileConfig.geminiApiKey)

    const evalConfig = {
      ...fileConfig,
      advisorEnabled: true,
      geminiAdvisorEnabled: true,
      advisorFallbackEnabled: false,
    }
    expect(evalConfig.advisorFallbackEnabled).toBe(false)
    const health = new ProviderHealthManager()
    const provider = new GeminiAdvisorProvider(evalConfig, health)
    const live = loadProgress(evalConfig.geminiAdvisorModel)
    const skipped = new Set([...live.rankedCaseIds, ...live.terminalCaseIds])

    const httpStatuses: Record<string, number> = { ...live.httpStatuses }
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('generativelanguage.googleapis.com')) {
        return originalFetch(input, init)
      }
      const response = await undiciFetch(url, init as Parameters<typeof undiciFetch>[1])
      const status = String(response.status)
      httpStatuses[status] = (httpStatuses[status] ?? 0) + 1
      live.httpStatuses = { ...httpStatuses }
      return response as unknown as Response
    }) as typeof fetch

    const pool = holdout.filter((item) => {
      const out = inspect(item.input)
      const ok = goldHypExists(item.gold, out.hypotheses) && out.hypotheses.length > 0
      document.body.innerHTML = ''
      return ok
    })

    let consecutive429 = 0
    let stopReason: string | null = live.ranked >= TARGET_VALID ? 'target' : null

    for (const item of pool) {
      if (live.ranked >= TARGET_VALID) {
        stopReason = 'target'
        break
      }
      if (skipped.has(item.id)) continue
      const out = inspect(item.input)
      const goldId = goldHypothesisId(item.gold, out.hypotheses)
      if (!goldId) {
        live.missing += 1
        live.terminalCaseIds.push(item.id)
        skipped.add(item.id)
        live.records.push({
          caseId: item.id,
          family: item.family,
          goldAction: item.gold,
          goldHypothesisExists: false,
          baselineAction: out.baseline.action,
          requestStatus: 'MISSING_LOCAL_HYPOTHESIS',
        })
        document.body.innerHTML = ''
        saveProgress(live)
        continue
      }
      const built = buildAdvisorPacket(out.context, out.hypotheses, {
        text: item.input,
        analysis: out.analysis,
      })
      expect(built.snippet.length).toBeLessThanOrEqual(160)
      expect(built.hypotheses.every((hyp) => !('replacement' in hyp))).toBe(true)
      const packet = toBackendPacket(built)
      const timeoutMs = EVAL_TIMEOUT_MS
      const result = await provider.rankHypotheses(packet, {
        requestId: packet.cycleId,
        deadlineAt: Date.now() + timeoutMs,
        timeoutMs,
        maxTokens: evalConfig.geminiAdvisorMaxTokens,
        contractVersion: ADVISOR_CONTRACT_VERSION,
        requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
      })
      live.attempts += 1
      live.allLatencies.push(result.latencyMs)

      if (!result.ok) {
        live.failLatencies.push(result.latencyMs)
        live.categories[result.category] = (live.categories[result.category] ?? 0) + 1
        if (result.category === 'UNKNOWN_IDS') live.unknownIds += 1
        if (result.category === 'INVALID_SCHEMA') live.forbiddenWriteFields += 0
        live.records.push({
          caseId: item.id,
          family: item.family,
          goldAction: item.gold,
          goldHypothesisId: goldId,
          goldHypothesisExists: true,
          localHypothesisIds: out.hypotheses.map((hyp) => hyp.id),
          baselineAction: out.baseline.action,
          geminiRankedIds: [],
          latency: Math.round(result.latencyMs),
          requestStatus: result.category,
          provider: result.provider,
          model: result.model,
        })
        const retryable = result.category === 'RATE_LIMITED'
          || result.category === 'TIMEOUT'
          || result.category === 'SERVER_ERROR'
          || result.category === 'PROVIDER_UNAVAILABLE'
        if (!retryable) {
          live.terminalCaseIds.push(item.id)
          skipped.add(item.id)
        }
        document.body.innerHTML = ''
        saveProgress(live)
        if (result.category === 'AUTH_ERROR') {
          stopReason = 'auth'
          break
        }
        if (result.category === 'RATE_LIMITED') {
          consecutive429 += 1
          if (consecutive429 >= PERSISTENT_429) {
            stopReason = 'persistent_429'
            break
          }
          const wait = Math.min(
            PACE_429_MAX_MS,
            Math.max(result.cooldownMs ?? PACE_429_MS, PACE_429_MS * 2 ** Math.min(consecutive429 - 1, 3)),
          )
          await sleep(wait)
        } else {
          consecutive429 = 0
          await sleep(PACE_OK_MS)
        }
        continue
      }

      consecutive429 = 0
      const vote: AdvisorVote = {
        rankedHypothesisIds: result.rankedHypothesisIds,
        ambiguityClass: result.ambiguityClass,
        reasonCode: result.reasonCode,
      }
      live.ranked += 1
      live.rankedCaseIds.push(item.id)
      skipped.add(item.id)
      live.successLatencies.push(result.latencyMs)
      live.returnedModel = result.model
      if (result.usage) {
        live.tokenUsage.n += 1
        live.tokenUsage.input += result.usage.inputTokens ?? 0
        live.tokenUsage.output += result.usage.outputTokens ?? 0
        live.tokenUsage.total += result.usage.totalTokens ?? 0
      }
      const top = out.hypotheses.find((hyp) => hyp.id === vote.rankedHypothesisIds[0])
      const top2hit = vote.rankedHypothesisIds.slice(0, 2).some((id) => (
        intentMatchesGold(item.gold, out.hypotheses.find((hyp) => hyp.id === id)?.intent)
      ))
      const selectedGold = vote.rankedHypothesisIds[0] === goldId
      const top1Intent = intentMatchesGold(item.gold, top?.intent)
      if (top1Intent) live.top1 += 1
      else {
        const cat = classifyRankError(item.gold, item.family, top?.intent)
        live.taxonomy[cat] = (live.taxonomy[cat] ?? 0) + 1
      }
      if (top2hit) live.top2 += 1
      if (selectedGold) live.selectedGold += 1
      const mixUnsafe = Boolean(
        top
        && top.intent === 'fix_layout'
        && layoutSpanConflictsWithMixedIntent(top.span, out.analysis.chunks),
      )
      const advised = decideWriting(out.context, out.analysis, out.candidates, {
        observeOnly: false,
        hypotheses: out.hypotheses,
        advisorVote: vote,
        advisorResult: 'ranked',
      })
      const localOk = actionOk(item.gold, out.baseline.action)
      const advisedOk = actionOk(item.gold, advised.action)
      if (advisedOk) live.advisedOk += 1
      if (localOk) live.localOkOnRanked += 1
      if (!localOk && advisedOk) live.help += 1
      if (localOk && !advisedOk) live.harm += 1
      if (item.family === 'mixed' && advised.action === 'layout_fix') live.mixAdvisedWrite += 1
      if (advised.action === 'layout_fix' && /https?:\/\/|@|sk-|eyJ/.test(item.input)) {
        live.protectedAdvisedWrite += 1
      }
      const fam = live.family[item.family] ?? { n: 0, top1: 0, top2: 0, advisedOk: 0, localOk: 0 }
      fam.n += 1
      if (top1Intent) fam.top1 += 1
      if (top2hit) fam.top2 += 1
      if (advisedOk) fam.advisedOk += 1
      if (localOk) fam.localOk += 1
      live.family[item.family] = fam
      live.records.push({
        caseId: item.id,
        family: item.family,
        goldAction: item.gold,
        goldHypothesisId: goldId,
        goldHypothesisExists: true,
        localHypothesisIds: out.hypotheses.map((hyp) => hyp.id),
        baselineAction: out.baseline.action,
        geminiTop1: vote.rankedHypothesisIds[0],
        geminiTop2: vote.rankedHypothesisIds[1] ?? null,
        geminiRankedIds: vote.rankedHypothesisIds,
        geminiSelectedGold: selectedGold,
        top1MatchesGold: top1Intent,
        top2ContainsGold: top2hit,
        ambiguityClass: vote.ambiguityClass,
        reasonCode: vote.reasonCode,
        finalAdvisedAction: advised.action,
        policyResult: advised.reasonCodes,
        mixedLayoutSafety: mixUnsafe,
        localOk,
        advisedOk,
        help: !localOk && advisedOk,
        harm: localOk && !advisedOk,
        latency: Math.round(result.latencyMs),
        provider: result.provider,
        model: result.model,
        usage: result.usage ?? null,
        requestStatus: 'ranked',
      })
      document.body.innerHTML = ''
      saveProgress(live)
      if (live.ranked % 10 === 0) {
        // eslint-disable-next-line no-console
        console.log(`GEMINI_FULL_LIVE_PROGRESS ranked=${live.ranked} attempts=${live.attempts}`)
      }
      await sleep(PACE_OK_MS)
    }

    if (!stopReason) {
      stopReason = live.ranked >= TARGET_VALID ? 'target' : 'holdout_exhausted'
    }
    live.stopReason = stopReason

    if (live.ranked >= TARGET_VALID) {
      const byFamily = new Map<string, typeof pool>()
      for (const item of pool) {
        if (!live.rankedCaseIds.includes(item.id)) continue
        const list = byFamily.get(item.family) ?? []
        list.push(item)
        byFamily.set(item.family, list)
      }
      const stabilityCases = []
      const order = ['layout', 'mixed', 'spelling', 'technical', 'punctuation', 'short']
      for (const family of order) {
        const list = byFamily.get(family) ?? []
        stabilityCases.push(...list.slice(0, 2))
        if (stabilityCases.length >= 10) break
      }
      while (stabilityCases.length < 10) {
        const extra = pool.find((item) => live.rankedCaseIds.includes(item.id) && !stabilityCases.includes(item))
        if (!extra) break
        stabilityCases.push(extra)
      }
      let stable = 0
      let compared = 0
      let aborted = false
      for (const item of stabilityCases.slice(0, 10)) {
        const out = inspect(item.input)
        if (out.hypotheses.length === 0) continue
        const packet = toBackendPacket(buildAdvisorPacket(out.context, out.hypotheses, {
          text: item.input,
          analysis: out.analysis,
        }))
        const votes: string[] = []
        for (let i = 0; i < 3; i += 1) {
          const ranked = await provider.rankHypotheses(packet, {
            requestId: `${packet.cycleId}-stab-${i}`,
            deadlineAt: Date.now() + EVAL_TIMEOUT_MS,
            timeoutMs: EVAL_TIMEOUT_MS,
            maxTokens: evalConfig.geminiAdvisorMaxTokens,
            contractVersion: ADVISOR_CONTRACT_VERSION,
            requiredCapabilities: ['hypothesis_ranking', 'structured_json', 'id_only_output'],
          })
          live.attempts += 1
          if (!ranked.ok) {
            live.categories[ranked.category] = (live.categories[ranked.category] ?? 0) + 1
            if (ranked.category === 'RATE_LIMITED') aborted = true
            break
          }
          votes.push(`${ranked.rankedHypothesisIds[0] ?? ''}|${ranked.rankedHypothesisIds[1] ?? ''}`)
          await sleep(PACE_OK_MS)
        }
        document.body.innerHTML = ''
        if (aborted) break
        if (votes.length < 3) continue
        compared += 1
        if (votes[0] === votes[1] && votes[1] === votes[2]) stable += 1
      }
      live.stability = { compared, stable }
      saveProgress(live)
    }

    globalThis.fetch = originalFetch

    const invalidResponse = (live.categories.INVALID_JSON ?? 0)
      + (live.categories.INVALID_SCHEMA ?? 0)
      + (live.categories.EMPTY_RESPONSE ?? 0)
      + (live.categories.UNKNOWN_IDS ?? 0)
      + (live.categories.BUDGET_ERROR ?? 0)
    const rateLimited = live.categories.RATE_LIMITED ?? 0
    const metrics = {
      seed: GPT_OSS_SHADOW_SEED,
      production: {
        geminiAdvisorEnabled: fileConfig.geminiAdvisorEnabled,
        advisorFallbackEnabled: fileConfig.advisorFallbackEnabled,
        groqAdvisorMaxTokens: fileConfig.groqAdvisorMaxTokens,
        geminiAdvisorModel: fileConfig.geminiAdvisorModel,
        geminiAdvisorMaxTokens: fileConfig.geminiAdvisorMaxTokens,
      },
      evalOnly: {
        timeoutMs: EVAL_TIMEOUT_MS,
        maxTokens: evalConfig.geminiAdvisorMaxTokens,
        paceOkMs: PACE_OK_MS,
        inMemoryGeminiEnabled: true,
      },
      key: fingerprint,
      model: evalConfig.geminiAdvisorModel,
      returnedModel: live.returnedModel,
      corpus: corpus.length,
      holdout: holdout.length,
      pool: pool.length,
      target: TARGET_VALID,
      stopReason,
      attempts: live.attempts,
      ranked: live.ranked,
      missingLocal: live.missing,
      httpStatuses: live.httpStatuses,
      categories: live.categories,
      providerAvailability: live.attempts ? live.ranked / live.attempts : null,
      rateLimited,
      rateLimitedRate: live.attempts ? rateLimited / live.attempts : null,
      invalidResponse,
      invalidResponseRate: live.attempts ? invalidResponse / live.attempts : null,
      unknownIds: live.unknownIds,
      forbiddenWriteFields: live.forbiddenWriteFields,
      mixAdvisedWrite: live.mixAdvisedWrite,
      protectedAdvisedWrite: live.protectedAdvisedWrite,
      top1: live.ranked ? live.top1 / live.ranked : null,
      top1Counts: `${live.top1}/${live.ranked}`,
      top2: live.ranked ? live.top2 / live.ranked : null,
      top2Counts: `${live.top2}/${live.ranked}`,
      selectedGold: live.ranked ? live.selectedGold / live.ranked : null,
      selectedGoldCounts: `${live.selectedGold}/${live.ranked}`,
      advisedAccuracy: live.ranked ? live.advisedOk / live.ranked : null,
      advisedCounts: `${live.advisedOk}/${live.ranked}`,
      localOnRanked: live.ranked ? live.localOkOnRanked / live.ranked : null,
      localOnRankedCounts: `${live.localOkOnRanked}/${live.ranked}`,
      accuracyDelta: live.ranked ? (live.advisedOk - live.localOkOnRanked) / live.ranked : null,
      help: live.help,
      harm: live.harm,
      family: live.family,
      taxonomy: live.taxonomy,
      successP50: percentile(live.successLatencies, 50),
      successP95: percentile(live.successLatencies, 95),
      successMax: live.successLatencies.length ? Math.round(Math.max(...live.successLatencies)) : null,
      tokenUsage: live.tokenUsage,
      stability: live.stability,
      insufficientValid: live.ranked < TARGET_VALID,
      baselineFile: 'gemini-3.5-flash-lite-full-live-baseline.json',
    }
    writeFileSync(RESULTS_PATH, `${JSON.stringify({ ...metrics, records: live.records }, null, 2)}\n`)
    saveProgress(live)
    // eslint-disable-next-line no-console
    console.log('GEMINI_FULL_LIVE_METRICS', JSON.stringify(metrics, null, 2))
    expect(live.mixAdvisedWrite).toBe(0)
    expect(evalConfig.advisorFallbackEnabled).toBe(false)
  })
})
