/**
 * Phase 5 live Groq gpt-oss-20b shadow evaluation. Not imported by production.
 * Ranks IDs only. Apply mode stays shadow — no field writes.
 * No 429 retries (recorded, not hidden).
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
import { AI_MODELS } from '@flowlary/shared'
import { loadBackendEnvFile, loadConfig } from '../../../backend/src/config/env.ts'
import { runHypothesisAdvisorProvider } from '../../../backend/src/providers/hypothesisAdvisorProvider.ts'
import { createServer, request } from 'node:http'
import { handleHttpRequest } from '../../../backend/src/routes/http.ts'
import { generateGptOssShadowCorpus, type OssCase, type OssGold } from './gpt-oss-20b-shadow/generate.ts'
import type { AdvisorVote, Hypothesis } from '../../../extension/src/core/engine/types.ts'

export const GPT_OSS_LIVE_METRICS: Record<string, unknown> = {}

function inspect(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: `oss-${Math.random().toString(36).slice(2, 10)}`,
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

function classifyFailure(gold: OssGold, family: string, topIntent: string | undefined, error: string | null): string {
  if (error === 'rate_limited') return 'rate limit'
  if (error === 'groq_connect_timeout' || error === 'AbortError') return 'timeout'
  if (error === 'invalid_response') return 'malformed JSON'
  if (error?.startsWith('groq_http_')) return 'provider error'
  if (error === 'groq_network_failure') return 'network failure'
  if (!topIntent) return 'empty ranking'
  if (family === 'mixed') return 'mixed-language confusion'
  if (family === 'technical') return 'technical-token confusion'
  if (family === 'spelling') return 'spelling vs layout confusion'
  if (family === 'short') return 'short-token ambiguity'
  if (family === 'punctuation') return 'punctuation interpretation'
  if (gold === 'layout_fix' && topIntent === 'preserve') return 'layout vs preserve confusion'
  if (gold === 'layout_fix') return 'wrong intent'
  return 'other'
}

function loadGroqKey(): string {
  loadBackendEnvFile()
  const extra = [
    resolve(process.cwd(), '../backend/.env'),
    resolve(process.cwd(), 'backend/.env'),
    resolve(process.cwd(), '.env'),
  ]
  for (const path of extra) {
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    const line = text.split('\n').find((row) => row.startsWith('GROQ_API_KEY='))
    if (line) {
      const value = line.slice('GROQ_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
      if (value && !process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = value
    }
  }
  return process.env.GROQ_API_KEY ?? ''
}

async function rankOnce(
  config: ReturnType<typeof loadConfig>,
  packet: ReturnType<typeof buildAdvisorPacket>,
): Promise<{ vote: AdvisorVote | null; error: string | null; ms: number; model: string | null }> {
  const started = performance.now()
  try {
    const result = await runHypothesisAdvisorProvider(config, {
      cycleId: packet.cycleId,
      snippet: packet.snippet,
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
    })
    return {
      vote: {
        rankedHypothesisIds: result.rankedHypothesisIds,
        ambiguityClass: result.ambiguityClass,
        reasonCode: result.reasonCode,
      },
      error: null,
      ms: performance.now() - started,
      model: result.model,
    }
  } catch (err) {
    return {
      vote: null,
      error: err instanceof Error ? err.message : 'error',
      ms: performance.now() - started,
      model: null,
    }
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round(sorted[index]!)
}

function pickStratified(cases: OssCase[], perFamily: Record<string, number>): OssCase[] {
  const out: OssCase[] = []
  for (const [family, limit] of Object.entries(perFamily)) {
    out.push(...cases.filter((item) => item.family === family).slice(0, limit))
  }
  return out
}

describe('gpt-oss-20b live Groq shadow evaluation', () => {
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

  it('uses gpt-oss-20b only for the advisor', () => {
    expect(AI_MODELS.HYPOTHESIS_ADVISOR).toBe('openai/gpt-oss-20b')
    expect(AI_MODELS.LAYOUT_CLASSIFIER).toBe('allam-2-7b')
    expect(AI_MODELS.CORRECTION).toBe('openai/gpt-oss-20b')
    expect(AI_MODELS.TRANSLATION).toBe('openai/gpt-oss-120b')
  })

  it('scores baseline + live gpt-oss-20b holdout without writing', { timeout: 1_200_000 }, async () => {
    const corpus = generateGptOssShadowCorpus()
    const holdout = corpus.filter((item) => item.split === 'holdout')
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
    const live = {
      n: 0,
      ranked: 0,
      top1: 0,
      top2: 0,
      selectedGold: 0,
      advisedOk: 0,
      missing: 0,
      errors: {} as Record<string, number>,
      latencies: [] as number[],
      taxonomy: {} as Record<string, number>,
      httpOk: false,
      httpModel: null as string | null,
      returnedModel: null as string | null,
      stability: null as number | null,
      mixAdvisedWrite: 0,
      mixSafetyVeto: 0,
      records: [] as Array<Record<string, unknown>>,
    }

    if (key) {
      const config = loadConfig()
      expect(AI_MODELS.HYPOTHESIS_ADVISOR).toBe('openai/gpt-oss-20b')

      try {
        const server = createServer((req, res) => {
          void handleHttpRequest(config, req, res)
        })
        await new Promise<void>((resolveReady) => {
          server.listen(0, '127.0.0.1', () => resolveReady())
        })
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 0
        const probe = inspect('hello please thanks')
        const packet = buildAdvisorPacket(probe.context, probe.hypotheses, {
          text: 'hello please thanks',
          analysis: probe.analysis,
        })
        const payload = JSON.stringify({
          cycleId: packet.cycleId,
          snippet: packet.snippet,
          allowedIntents: packet.allowedIntents,
          hypotheses: packet.hypotheses,
        })
        const httpBody = await new Promise<{ status: number; body: string }>((resolveHttp) => {
          const req = request({
            hostname: '127.0.0.1',
            port,
            path: '/api/ai/hypothesis-advisor',
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            },
          }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk) => chunks.push(chunk as Buffer))
            res.on('end', () => resolveHttp({
              status: res.statusCode ?? 500,
              body: Buffer.concat(chunks).toString('utf8'),
            }))
          })
          req.on('error', () => resolveHttp({ status: 0, body: '' }))
          req.write(payload)
          req.end()
        })
        live.httpOk = httpBody.status > 0 && httpBody.status < 500
        try {
          const parsed = JSON.parse(httpBody.body) as { model?: string }
          live.httpModel = parsed.model ?? null
        } catch {
          live.httpModel = null
        }
        await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
      } catch {
        live.httpOk = false
      }

      const sample = pickStratified(holdout, {
        layout: 120,
        mixed: 50,
        spelling: 50,
        technical: 30,
        punctuation: 30,
        short: 20,
      })

      for (const item of sample) {
        if (live.ranked >= 200) break
        const out = inspect(item.input)
        const goldId = goldHypothesisId(item.gold, out.hypotheses)
        const exists = Boolean(goldId)
        if (!exists) {
          live.missing += 1
          live.records.push({
            caseId: item.id,
            family: item.family,
            goldAction: item.gold,
            goldHypothesisId: null,
            localHypothesisIds: out.hypotheses.map((hyp) => hyp.id),
            goldHypothesisExists: false,
            baselineAction: out.baseline.action,
            groqRankedIds: [],
            groqTop1: null,
            groqTop2: [],
            groqSelectedGold: false,
            finalAdvisedAction: out.baseline.action,
            policyResult: out.baseline.reasonCodes,
            mixedLayoutSafety: false,
            latency: 0,
            requestStatus: 'MISSING_LOCAL_HYPOTHESIS',
            failureCategory: 'bad hypothesis set',
          })
          document.body.innerHTML = ''
          continue
        }
        if (out.hypotheses.length === 0) continue
        const packet = buildAdvisorPacket(out.context, out.hypotheses, {
          text: item.input,
          analysis: out.analysis,
        })
        const ranked = await rankOnce(config, packet)
        live.n += 1
        live.latencies.push(ranked.ms)
        if (ranked.model) live.returnedModel = ranked.model
        if (ranked.error) {
          live.errors[ranked.error] = (live.errors[ranked.error] ?? 0) + 1
          live.taxonomy[classifyFailure(item.gold, item.family, undefined, ranked.error)] =
            (live.taxonomy[classifyFailure(item.gold, item.family, undefined, ranked.error)] ?? 0) + 1
          live.records.push({
            caseId: item.id,
            family: item.family,
            goldAction: item.gold,
            goldHypothesisId: goldId,
            localHypothesisIds: out.hypotheses.map((hyp) => hyp.id),
            goldHypothesisExists: true,
            baselineAction: out.baseline.action,
            groqRankedIds: [],
            groqTop1: null,
            groqTop2: [],
            groqSelectedGold: false,
            finalAdvisedAction: out.baseline.action,
            policyResult: out.baseline.reasonCodes,
            mixedLayoutSafety: false,
            latency: Math.round(ranked.ms),
            requestStatus: ranked.error,
            failureCategory: classifyFailure(item.gold, item.family, undefined, ranked.error),
          })
          await new Promise((resolve) => setTimeout(resolve, ranked.error === 'rate_limited' ? 1500 : 80))
          document.body.innerHTML = ''
          continue
        }
        if (!ranked.vote) continue
        live.ranked += 1
        const top = out.hypotheses.find((hyp) => hyp.id === ranked.vote!.rankedHypothesisIds[0])
        const top2hit = ranked.vote.rankedHypothesisIds.slice(0, 2).some((id) => (
          intentMatchesGold(item.gold, out.hypotheses.find((hyp) => hyp.id === id)?.intent)
        ))
        const selectedGold = ranked.vote.rankedHypothesisIds[0] === goldId
        if (intentMatchesGold(item.gold, top?.intent)) live.top1 += 1
        else {
          const cat = classifyFailure(item.gold, item.family, top?.intent, null)
          live.taxonomy[cat] = (live.taxonomy[cat] ?? 0) + 1
        }
        if (top2hit) live.top2 += 1
        if (selectedGold) live.selectedGold += 1
        const mixUnsafe = Boolean(
          top
          && top.intent === 'fix_layout'
          && layoutSpanConflictsWithMixedIntent(top.span, out.analysis.chunks),
        )
        if (mixUnsafe) live.mixSafetyVeto += 1
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
          localHypothesisIds: out.hypotheses.map((hyp) => hyp.id),
          goldHypothesisExists: true,
          baselineAction: out.baseline.action,
          groqRankedIds: ranked.vote.rankedHypothesisIds,
          groqTop1: ranked.vote.rankedHypothesisIds[0] ?? null,
          groqTop2: ranked.vote.rankedHypothesisIds.slice(0, 2),
          groqSelectedGold: selectedGold,
          finalAdvisedAction: advised.action,
          policyResult: advised.reasonCodes,
          mixedLayoutSafety: mixUnsafe,
          latency: Math.round(ranked.ms),
          requestStatus: 'ranked',
          failureCategory: selectedGold || intentMatchesGold(item.gold, top?.intent) ? null : classifyFailure(item.gold, item.family, top?.intent, null),
        })
        await new Promise((resolve) => setTimeout(resolve, 80))
        document.body.innerHTML = ''
      }

      const repeats = sample.filter((item) => item.family === 'layout').slice(0, 8)
      let stable = 0
      let compared = 0
      for (const item of repeats) {
        const out = inspect(item.input)
        if (out.hypotheses.length === 0) continue
        const packet = buildAdvisorPacket(out.context, out.hypotheses, { text: item.input, analysis: out.analysis })
        const a = await rankOnce(config, packet)
        const b = await rankOnce(config, packet)
        const c = await rankOnce(config, packet)
        if (!a.vote || !b.vote || !c.vote) continue
        compared += 1
        if (
          a.vote.rankedHypothesisIds[0] === b.vote.rankedHypothesisIds[0]
          && b.vote.rankedHypothesisIds[0] === c.vote.rankedHypothesisIds[0]
        ) stable += 1
        await new Promise((resolve) => setTimeout(resolve, 80))
      }
      live.stability = compared ? stable / compared : null
    }

    const denom = Math.max(1, holdout.length)
    const metrics = {
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
        configured: Boolean(key),
        httpOk: live.httpOk,
        httpModel: live.httpModel,
        returnedModel: live.returnedModel,
        n: live.n,
        ranked: live.ranked,
        missingLocal: live.missing,
        top1: live.ranked ? live.top1 / live.ranked : null,
        top2: live.ranked ? live.top2 / live.ranked : null,
        selectedGold: live.ranked ? live.selectedGold / live.ranked : null,
        advisedAccuracy: live.ranked ? live.advisedOk / live.ranked : null,
        errors: live.errors,
        p50: percentile(live.latencies, 50),
        p95: percentile(live.latencies, 95),
        max: live.latencies.length ? Math.round(Math.max(...live.latencies)) : 0,
        avg: live.latencies.length ? Math.round(live.latencies.reduce((a, b) => a + b, 0) / live.latencies.length) : 0,
        failureRate: live.n ? (live.n - live.ranked) / live.n : null,
        jsonSuccessRate: live.n ? live.ranked / live.n : null,
        stability: live.stability,
        mixAdvisedWrite: live.mixAdvisedWrite,
        mixSafetyVeto: live.mixSafetyVeto,
        taxonomy: live.taxonomy,
        insufficientValid: live.ranked < 200,
      },
    }
    Object.assign(GPT_OSS_LIVE_METRICS, metrics)
    writeFileSync(
      resolve(import.meta.dirname, 'gpt-oss-20b-shadow/live-results.json'),
      `${JSON.stringify({ ...metrics, records: live.records }, null, 2)}\n`,
    )
    // eslint-disable-next-line no-console
    console.log('GPT_OSS_LIVE_METRICS', JSON.stringify(metrics, null, 2))

    expect(holdout.length).toBeGreaterThan(200)
    expect(live.mixAdvisedWrite).toBe(0)
    if (key) expect(live.n).toBeGreaterThan(0)
  })
})
