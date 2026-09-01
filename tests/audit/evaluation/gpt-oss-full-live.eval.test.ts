/**
 * Isolated full live shadow eval. Production maxTokens stays 180.
 * This harness only uses max_tokens=1024 for Groq ranking measurement.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
import {
  AI_MODELS,
  HYPOTHESIS_ADVISOR_MAX_SNIPPET,
  HYPOTHESIS_ADVISOR_SYSTEM_PROMPT,
} from '@flowlary/shared'
import { loadBackendEnvFile, loadConfig } from '../../../backend/src/config/env.ts'
import { callGroqChat } from '../../../backend/src/providers/groqClient.ts'
import { generateGptOssShadowCorpus, GPT_OSS_SHADOW_SEED, type OssCase, type OssGold } from '../../unit/writing-engine/gpt-oss-20b-shadow/generate.ts'
import type { AdvisorVote, Hypothesis } from '../../../extension/src/core/engine/types.ts'

const EVAL_MAX_TOKENS = 1024
const PACE_OK_MS = 3500
const PACE_429_MS = 20_000
const PACE_429_MAX_MS = 60_000
const TARGET_VALID = 200
const PERSISTENT_429 = 20

function inspect(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: `full-${Math.random().toString(36).slice(2, 10)}`,
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
  if (family === 'capitalization') return 'capitalization'
  if (family === 'arabizi') return 'Arabizi'
  if (gold === 'layout_fix' && (topIntent === 'preserve' || topIntent === 'write_as_is')) return 'preserve vs layout'
  if (gold === 'layout_fix') return 'other'
  return 'other'
}

function loadGroqKey(): string {
  loadBackendEnvFile()
  for (const path of [
    resolve(process.cwd(), '../backend/.env'),
    resolve(process.cwd(), 'backend/.env'),
    resolve(process.cwd(), '.env'),
  ]) {
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.startsWith('GROQ_API_KEY=')) continue
      const value = line.slice('GROQ_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
      if (value) process.env.GROQ_API_KEY = value
    }
  }
  return process.env.GROQ_API_KEY ?? ''
}

function parseVote(content: string, allowedIds: Set<string>): AdvisorVote {
  const parsed = JSON.parse(content) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid_response')
  if ('replacement' in parsed || 'text' in parsed || 'write' in parsed) throw new Error('invalid_response')
  if (!Array.isArray(parsed.rankedHypothesisIds) || parsed.rankedHypothesisIds.length === 0) {
    throw new Error('invalid_response')
  }
  const ids = parsed.rankedHypothesisIds.filter((id): id is string => typeof id === 'string')
  if (ids.length === 0 || ids.some((id) => !allowedIds.has(id))) throw new Error('unknown_id')
  if (typeof parsed.ambiguityClass !== 'string' || typeof parsed.reasonCode !== 'string') {
    throw new Error('invalid_response')
  }
  return {
    rankedHypothesisIds: ids,
    ambiguityClass: parsed.ambiguityClass.slice(0, 64),
    reasonCode: parsed.reasonCode.slice(0, 64),
  }
}

async function rankEvalOnly(
  config: ReturnType<typeof loadConfig>,
  packet: ReturnType<typeof buildAdvisorPacket>,
): Promise<{ vote: AdvisorVote | null; error: string | null; ms: number; model: string | null }> {
  const started = performance.now()
  const allowedIds = new Set(packet.hypotheses.map((item) => item.id))
  try {
    const result = await callGroqChat(config, {
      model: AI_MODELS.HYPOTHESIS_ADVISOR,
      temperature: 0,
      maxTokens: EVAL_MAX_TOKENS,
      responseFormat: 'json_object',
      messages: [
        { role: 'system', content: HYPOTHESIS_ADVISOR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
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
          }),
        },
      ],
    })
    const vote = parseVote(result.content, allowedIds)
    return { vote, error: null, ms: performance.now() - started, model: result.model }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    if (message === 'Unexpected end of JSON input' || message.startsWith('Unexpected token')) {
      return { vote: null, error: 'invalid_response', ms: performance.now() - started, model: null }
    }
    return { vote: null, error: message, ms: performance.now() - started, model: null }
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

describe('gpt-oss-20b full live shadow (eval-only 1024)', () => {
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

  it('production maxTokens remains the measured Groq JSON budget', () => {
    const src = readFileSync(resolve(process.cwd(), '../backend/src/config/env.ts'), 'utf8')
    expect(src).toContain("FLOWLARY_ADVISOR_MAX_TOKENS'")
    expect(src).toContain('512')
    expect(src).not.toContain('maxTokens: 1024')
    expect(AI_MODELS.HYPOTHESIS_ADVISOR).toBe('openai/gpt-oss-20b')
    expect(GPT_OSS_SHADOW_SEED).toBe(20261107)
  })

  it('computes frozen holdout local baseline without Groq', () => {
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
    writeFileSync(
      resolve(import.meta.dirname, 'gpt-oss-full-live-baseline.json'),
      `${JSON.stringify(baseline, null, 2)}\n`,
    )
    expect(layoutFp).toBe(0)
    expect(mixFp).toBe(0)
    expect(protectedFp).toBe(0)
  })

  it.skipIf(!process.env.FLOWLARY_GPT_OSS_FULL_LIVE)('scores holdout baseline and >=200 eval-only ranks', { timeout: 4_500_000 }, async () => {
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

    for (const item of holdout) {
      const out = inspect(item.input)
      if (goldHypExists(item.gold, out.hypotheses)) exist += 1
      if (actionOk(item.gold, out.baseline.action)) baselineOk += 1
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
      document.body.innerHTML = ''
    }

    const key = loadGroqKey()
    expect(Boolean(key)).toBe(true)
    const config = loadConfig()

    const live = {
      n: 0,
      ranked: 0,
      top1: 0,
      top2: 0,
      selectedGold: 0,
      advisedOk: 0,
      missing: 0,
      correctExistCorrectRank: 0,
      correctExistWrongRank: 0,
      errors: {} as Record<string, number>,
      taxonomy: {} as Record<string, number>,
      allLatencies: [] as number[],
      successLatencies: [] as number[],
      failLatencies: [] as number[],
      mixAdvisedWrite: 0,
      records: [] as Array<Record<string, unknown>>,
      returnedModel: null as string | null,
    }

    const pool = holdout.filter((item) => {
      const out = inspect(item.input)
      const ok = goldHypExists(item.gold, out.hypotheses) && out.hypotheses.length > 0
      document.body.innerHTML = ''
      return ok
    })

    await sleep(20_000)
    let consecutive429 = 0
    for (const item of pool) {
      if (live.ranked >= TARGET_VALID) break
      const out = inspect(item.input)
      const goldId = goldHypothesisId(item.gold, out.hypotheses)
      if (!goldId) {
        live.missing += 1
        live.records.push({
          caseId: item.id,
          family: item.family,
          goldAction: item.gold,
          goldHypothesisExists: false,
          baselineAction: out.baseline.action,
          requestStatus: 'MISSING_LOCAL_HYPOTHESIS',
        })
        document.body.innerHTML = ''
        continue
      }
      const packet = buildAdvisorPacket(out.context, out.hypotheses, {
        text: item.input,
        analysis: out.analysis,
      })
      expect(packet.snippet.length).toBeLessThanOrEqual(160)
      expect(packet.hypotheses.every((hyp) => !('replacement' in hyp))).toBe(true)
      const ranked = await rankEvalOnly(config, packet)
      live.n += 1
      live.allLatencies.push(ranked.ms)
      if (ranked.model) live.returnedModel = ranked.model
      if (ranked.error) {
        live.errors[ranked.error] = (live.errors[ranked.error] ?? 0) + 1
        live.failLatencies.push(ranked.ms)
        live.records.push({
          caseId: item.id,
          family: item.family,
          goldAction: item.gold,
          goldHypothesisId: goldId,
          goldHypothesisExists: true,
          localHypothesisIds: out.hypotheses.map((hyp) => hyp.id),
          baselineAction: out.baseline.action,
          groqRankedIds: [],
          latency: Math.round(ranked.ms),
          requestStatus: ranked.error,
        })
        document.body.innerHTML = ''
        if (ranked.error === 'rate_limited') {
          consecutive429 += 1
          if (consecutive429 >= PERSISTENT_429) break
          const wait = Math.min(PACE_429_MAX_MS, PACE_429_MS * 2 ** Math.min(consecutive429 - 1, 3))
          await sleep(wait)
        } else {
          consecutive429 = 0
          await sleep(PACE_OK_MS)
        }
        continue
      }
      consecutive429 = 0
      if (!ranked.vote) continue
      live.ranked += 1
      live.successLatencies.push(ranked.ms)
      const top = out.hypotheses.find((hyp) => hyp.id === ranked.vote!.rankedHypothesisIds[0])
      const top2hit = ranked.vote.rankedHypothesisIds.slice(0, 2).some((id) => (
        intentMatchesGold(item.gold, out.hypotheses.find((hyp) => hyp.id === id)?.intent)
      ))
      const selectedGold = ranked.vote.rankedHypothesisIds[0] === goldId
      const top1Intent = intentMatchesGold(item.gold, top?.intent)
      if (top1Intent) live.top1 += 1
      else {
        const cat = classifyRankError(item.gold, item.family, top?.intent)
        live.taxonomy[cat] = (live.taxonomy[cat] ?? 0) + 1
        live.correctExistWrongRank += 1
      }
      if (top1Intent) live.correctExistCorrectRank += 1
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
        advisorVote: ranked.vote,
        advisorResult: 'ranked',
      })
      if (actionOk(item.gold, advised.action)) live.advisedOk += 1
      if (item.family === 'mixed' && advised.action === 'layout_fix') live.mixAdvisedWrite += 1
      live.records.push({
        caseId: item.id,
        family: item.family,
        goldAction: item.gold,
        goldHypothesisId: goldId,
        goldHypothesisExists: true,
        localHypothesisIds: out.hypotheses.map((hyp) => hyp.id),
        baselineAction: out.baseline.action,
        groqRankedIds: ranked.vote.rankedHypothesisIds,
        groqTop1: ranked.vote.rankedHypothesisIds[0],
        groqSelectedGold: selectedGold,
        finalAdvisedAction: advised.action,
        policyResult: advised.reasonCodes,
        mixedLayoutSafety: mixUnsafe,
        latency: Math.round(ranked.ms),
        requestStatus: 'ranked',
      })
      document.body.innerHTML = ''
      if (live.ranked % 10 === 0) {
        // eslint-disable-next-line no-console
        console.log(`GPT_OSS_FULL_LIVE_PROGRESS ranked=${live.ranked} attempts=${live.n}`)
        writeFileSync(
          resolve(import.meta.dirname, 'gpt-oss-full-live-progress.json'),
          `${JSON.stringify({ ranked: live.ranked, attempts: live.n, errors: live.errors, top1: live.top1, top2: live.top2 }, null, 2)}\n`,
        )
      }
      await sleep(PACE_OK_MS)
    }

    const stabilityCases = pool.slice(0, 10)
    let stable = 0
    let compared = 0
    for (const item of stabilityCases) {
      const out = inspect(item.input)
      if (out.hypotheses.length === 0) continue
      const packet = buildAdvisorPacket(out.context, out.hypotheses, { text: item.input, analysis: out.analysis })
      const votes: string[] = []
      let aborted = false
      for (let i = 0; i < 3; i += 1) {
        const ranked = await rankEvalOnly(config, packet)
        if (ranked.error === 'rate_limited') {
          aborted = true
          break
        }
        if (!ranked.vote) break
        votes.push(ranked.vote.rankedHypothesisIds[0] ?? '')
        await sleep(PACE_OK_MS)
      }
      document.body.innerHTML = ''
      if (aborted || votes.length < 3) continue
      compared += 1
      if (votes[0] === votes[1] && votes[1] === votes[2]) stable += 1
    }

    const denom = holdout.length
    const metrics = {
      seed: GPT_OSS_SHADOW_SEED,
      evalMaxTokens: EVAL_MAX_TOKENS,
      productionMaxTokens: 180,
      model: AI_MODELS.HYPOTHESIS_ADVISOR,
      corpus: corpus.length,
      holdout: holdout.length,
      hypothesisExistence: exist / denom,
      localRecall: exist / denom,
      baselineAccuracy: baselineOk / denom,
      invocationRate: consult / denom,
      layoutRecall: layoutGold ? layoutTp / layoutGold : 0,
      layoutFp,
      layoutFn,
      mixFp,
      protectedFp,
      abstention: abstainGold ? abstainOk / abstainGold : 0,
      live: {
        returnedModel: live.returnedModel,
        attempts: live.n,
        ranked: live.ranked,
        missingLocal: live.missing,
        top1: live.ranked ? live.top1 / live.ranked : null,
        top1Counts: `${live.top1}/${live.ranked}`,
        top2: live.ranked ? live.top2 / live.ranked : null,
        top2Counts: `${live.top2}/${live.ranked}`,
        selectedGold: live.ranked ? live.selectedGold / live.ranked : null,
        advisedAccuracy: live.ranked ? live.advisedOk / live.ranked : null,
        advisedCounts: `${live.advisedOk}/${live.ranked}`,
        correctExistCorrectRank: live.correctExistCorrectRank,
        correctExistWrongRank: live.correctExistWrongRank,
        errors: live.errors,
        taxonomy: live.taxonomy,
        jsonSuccessRate: live.n ? live.ranked / live.n : null,
        rateLimited: live.errors.rate_limited ?? 0,
        mixAdvisedWrite: live.mixAdvisedWrite,
        successP50: percentile(live.successLatencies, 50),
        successP95: percentile(live.successLatencies, 95),
        successMax: live.successLatencies.length ? Math.round(Math.max(...live.successLatencies)) : null,
        allP50: percentile(live.allLatencies, 50),
        allP95: percentile(live.allLatencies, 95),
        allMax: live.allLatencies.length ? Math.round(Math.max(...live.allLatencies)) : null,
        stability: compared ? stable / compared : null,
        stabilityN: compared,
        insufficientValid: live.ranked < TARGET_VALID,
      },
    }
    writeFileSync(
      resolve(import.meta.dirname, 'gpt-oss-full-live-results.json'),
      `${JSON.stringify({ ...metrics, records: live.records }, null, 2)}\n`,
    )
    // eslint-disable-next-line no-console
    console.log('GPT_OSS_FULL_LIVE_METRICS', JSON.stringify(metrics, null, 2))
    expect(live.mixAdvisedWrite).toBe(0)
  })
})
