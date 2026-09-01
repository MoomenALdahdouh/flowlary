/**
 * Phase 4 live Groq shadow evaluation. Not imported by production.
 * Groq ranks IDs only. Apply mode stays shadow — no field writes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
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
import { loadBackendEnvFile, loadConfig } from '../../../backend/src/config/env.ts'
import { runHypothesisAdvisorProvider } from '../../../backend/src/providers/hypothesisAdvisorProvider.ts'
import { createServer, request } from 'node:http'
import { handleHttpRequest } from '../../../backend/src/routes/http.ts'
import { generateLiveShadowCorpus, type LiveCase, type LiveGold } from './live-groq-shadow/generate.ts'
import type { AdvisorVote, Hypothesis } from '../../../extension/src/core/engine/types.ts'

function inspect(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: `live-${Math.random().toString(36).slice(2, 10)}`,
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

function goldHypExists(gold: LiveGold, hyps: Hypothesis[]): boolean {
  if (gold === 'layout_fix') return hyps.some((item) => item.intent === 'fix_layout')
  if (gold === 'fix_english') return hyps.some((item) => item.intent === 'fix_english')
  return hyps.some((item) => item.intent === 'preserve' || item.intent === 'write_as_is' || item.intent === 'unknown')
}

function actionOk(gold: LiveGold, action: string): boolean {
  if (gold === 'layout_fix') return action === 'layout_fix'
  if (gold === 'fix_english') return action === 'english_correction' || action === 'suggestion' || action === 'noop'
  return action === 'noop' || action === 'suggestion'
}

function intentMatchesGold(gold: LiveGold, intent: string | undefined): boolean {
  if (!intent) return false
  if (gold === 'layout_fix') return intent === 'fix_layout'
  if (gold === 'fix_english') return intent === 'fix_english'
  return intent === 'preserve' || intent === 'write_as_is' || intent === 'unknown'
}

function classifyFailure(gold: LiveGold, family: string, topIntent: string | undefined): string {
  if (!topIntent) return 'malformed output'
  if (family === 'mixed') return 'mixed-language confusion'
  if (family === 'technical') return 'technical token confusion'
  if (family === 'spelling') return 'spelling/layout confusion'
  if (family === 'short') return 'short-token ambiguity'
  if (family === 'punctuation') return 'punctuation interpretation'
  if (gold === 'layout_fix' && topIntent !== 'fix_layout') return 'wrong intent'
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

async function rankLive(
  config: ReturnType<typeof loadConfig>,
  packet: ReturnType<typeof buildAdvisorPacket>,
  snippetOverride?: string,
): Promise<{ vote: AdvisorVote | null; error: string | null; ms: number }> {
  const started = performance.now()
  let lastError = 'error'
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await runHypothesisAdvisorProvider(config, {
        cycleId: packet.cycleId,
        snippet: (snippetOverride ?? packet.snippet).slice(0, snippetOverride ? snippetOverride.length : 160),
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
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'error'
      if (lastError === 'rate_limited' && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)))
        continue
      }
      return { vote: null, error: lastError, ms: performance.now() - started }
    }
  }
  return { vote: null, error: lastError, ms: performance.now() - started }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round(sorted[index]!)
}

function pickStratified(cases: LiveCase[], perFamily: Record<string, number>): LiveCase[] {
  const out: LiveCase[] = []
  for (const [family, limit] of Object.entries(perFamily)) {
    out.push(...cases.filter((item) => item.family === family).slice(0, limit))
  }
  return out
}

export const LIVE_GROQ_METRICS: Record<string, unknown> = {}

describe('live Groq shadow evaluation', () => {
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

  it('builds a new unseen corpus and scores the local baseline', () => {
    const corpus = generateLiveShadowCorpus()
    expect(corpus.filter((item) => item.family === 'layout').length).toBeGreaterThanOrEqual(2000)
    expect(corpus.filter((item) => item.family === 'mixed').length).toBe(1000)
    expect(corpus.filter((item) => item.family === 'spelling').length).toBeGreaterThanOrEqual(1000)
    expect(corpus.filter((item) => item.family === 'technical').length).toBe(500)
    expect(corpus.filter((item) => item.family === 'punctuation').length).toBeGreaterThanOrEqual(400)
    expect(corpus.filter((item) => item.family === 'short').length).toBe(500)
    expect(corpus.length).toBeGreaterThanOrEqual(5500)
    expect(corpus.some((item) => item.split === 'holdout')).toBe(true)
  })

  it('scores baseline + optional live Groq holdout without writing', { timeout: 900_000 }, async () => {
    const corpus = generateLiveShadowCorpus()
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
    const live: {
      n: number
      ranked: number
      top1: number
      top2: number
      advisedOk: number
      missing: number
      errors: Record<string, number>
      latencies: number[]
      taxonomy: Record<string, number>
      httpOk: boolean
      stability: number | null
      contextGain: number | null
      mixAdvisedWrite: number
    } = {
      n: 0, ranked: 0, top1: 0, top2: 0, advisedOk: 0, missing: 0,
      errors: {}, latencies: [], taxonomy: {}, httpOk: false,
      stability: null, contextGain: null, mixAdvisedWrite: 0,
    }

    if (key) {
      const config = loadConfig()
      const sample = pickStratified(holdout, {
        layout: 24,
        mixed: 12,
        spelling: 12,
        technical: 8,
        punctuation: 8,
        short: 8,
      })

      try {
        const server = createServer((req, res) => {
          void handleHttpRequest(config, req, res)
        })
        await new Promise<void>((resolveReady) => {
          server.listen(0, '127.0.0.1', () => resolveReady())
        })
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 0
        const probe = inspect(sample[0]?.input ?? 'hello please thanks')
        const packet = buildAdvisorPacket(probe.context, probe.hypotheses, {
          text: sample[0]?.input ?? '',
          analysis: probe.analysis,
        })
        const payload = JSON.stringify({
          cycleId: packet.cycleId,
          snippet: packet.snippet,
          allowedIntents: packet.allowedIntents,
          hypotheses: packet.hypotheses,
        })
        live.httpOk = await new Promise<boolean>((resolveHttp) => {
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
            res.resume()
            resolveHttp((res.statusCode ?? 500) < 500)
          })
          req.on('error', () => resolveHttp(false))
          req.write(payload)
          req.end()
        })
        await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
      } catch {
        live.httpOk = false
      }

      const queue = [...sample]
      const workers = 1
      const runOne = async (item: LiveCase) => {
        const out = inspect(item.input)
        const exists = goldHypExists(item.gold, out.hypotheses)
        if (!exists) {
          live.missing += 1
          return
        }
        if (out.hypotheses.length === 0) return
        const packet = buildAdvisorPacket(out.context, out.hypotheses, {
          text: item.input,
          analysis: out.analysis,
        })
        const ranked = await rankLive(config, packet)
        live.n += 1
        live.latencies.push(ranked.ms)
        if (ranked.error) {
          live.errors[ranked.error] = (live.errors[ranked.error] ?? 0) + 1
          return
        }
        if (!ranked.vote) return
        live.ranked += 1
        const top = out.hypotheses.find((itemHyp) => itemHyp.id === ranked.vote!.rankedHypothesisIds[0])
        const top2 = ranked.vote.rankedHypothesisIds.slice(0, 2).some((id) => (
          intentMatchesGold(item.gold, out.hypotheses.find((hyp) => hyp.id === id)?.intent)
        ))
        if (intentMatchesGold(item.gold, top?.intent)) live.top1 += 1
        else live.taxonomy[classifyFailure(item.gold, item.family, top?.intent)] = (live.taxonomy[classifyFailure(item.gold, item.family, top?.intent)] ?? 0) + 1
        if (top2) live.top2 += 1
        const advised = decideWriting(out.context, out.analysis, out.candidates, {
          observeOnly: false,
          hypotheses: out.hypotheses,
          advisorVote: ranked.vote,
          advisorResult: 'ranked',
        })
        if (actionOk(item.gold, advised.action)) live.advisedOk += 1
        if (item.family === 'mixed' && advised.action === 'layout_fix') live.mixAdvisedWrite += 1
        document.body.innerHTML = ''
      }

      let cursor = 0
      await Promise.all(Array.from({ length: workers }, async () => {
        while (cursor < queue.length) {
          const index = cursor
          cursor += 1
          const item = queue[index]
          if (item) await runOne(item)
        }
      }))

      const repeats = sample.filter((item) => item.family === 'layout').slice(0, 4)
      let stable = 0
      let compared = 0
      for (const item of repeats) {
        const out = inspect(item.input)
        if (out.hypotheses.length === 0) continue
        const packet = buildAdvisorPacket(out.context, out.hypotheses, { text: item.input, analysis: out.analysis })
        const a = await rankLive(config, packet)
        const b = await rankLive(config, packet)
        const c = await rankLive(config, packet)
        if (!a.vote || !b.vote || !c.vote) continue
        compared += 1
        if (
          a.vote.rankedHypothesisIds[0] === b.vote.rankedHypothesisIds[0]
          && b.vote.rankedHypothesisIds[0] === c.vote.rankedHypothesisIds[0]
        ) stable += 1
      }
      live.stability = compared ? stable / compared : null

      const contextSample = sample.filter((item) => item.family === 'layout').slice(0, 6)
      let widerBetter = 0
      let contextN = 0
      for (const item of contextSample) {
        const out = inspect(item.input)
        if (!goldHypExists(item.gold, out.hypotheses)) continue
        const packet = buildAdvisorPacket(out.context, out.hypotheses, { text: item.input, analysis: out.analysis })
        const small = await rankLive(config, packet, packet.snippet.slice(0, 80))
        const full = await rankLive(config, packet)
        if (!small.vote || !full.vote) continue
        contextN += 1
        const smallHit = intentMatchesGold(item.gold, out.hypotheses.find((hyp) => hyp.id === small.vote!.rankedHypothesisIds[0])?.intent)
        const fullHit = intentMatchesGold(item.gold, out.hypotheses.find((hyp) => hyp.id === full.vote!.rankedHypothesisIds[0])?.intent)
        if (fullHit && !smallHit) widerBetter += 1
      }
      live.contextGain = contextN ? widerBetter / contextN : null
    }

    const denom = Math.max(1, holdout.length)
    Object.assign(LIVE_GROQ_METRICS, {
      corpus: corpus.length,
      holdout: holdout.length,
      hypothesisExistence: exist / denom,
      localRecall: exist / denom,
      baselineAccuracy: baselineOk / denom,
      invocationRate: consult / denom,
      layoutRecall: layoutGold ? layoutTp / layoutGold : 0,
      layoutPrecision: (layoutTp + layoutFp) ? layoutTp / (layoutTp + layoutFp) : 0,
      layoutFp,
      layoutFn,
      mixFp,
      protectedFp,
      abstention: abstainGold ? abstainOk / abstainGold : 0,
      live: {
        configured: Boolean(key),
        httpOk: live.httpOk,
        n: live.n,
        ranked: live.ranked,
        missingLocal: live.missing,
        top1: live.ranked ? live.top1 / live.ranked : null,
        top2: live.ranked ? live.top2 / live.ranked : null,
        advisedAccuracy: live.ranked ? live.advisedOk / live.ranked : null,
        errors: live.errors,
        p50: percentile(live.latencies, 50),
        p95: percentile(live.latencies, 95),
        max: live.latencies.length ? Math.round(Math.max(...live.latencies)) : 0,
        avg: live.latencies.length ? Math.round(live.latencies.reduce((a, b) => a + b, 0) / live.latencies.length) : 0,
        failureRate: live.n ? (live.n - live.ranked) / live.n : null,
        stability: live.stability,
        contextGain: live.contextGain,
        mixAdvisedWrite: live.mixAdvisedWrite,
        taxonomy: live.taxonomy,
      },
    })
    // eslint-disable-next-line no-console
    console.log('LIVE_GROQ_METRICS', JSON.stringify(LIVE_GROQ_METRICS, null, 2))

    expect(holdout.length).toBeGreaterThan(200)
    expect(live.mixAdvisedWrite).toBe(0)
    if (key) expect(live.n).toBeGreaterThan(0)
  })
})
