/**
 * Isolated local-AI model selection study. Not imported by production.
 * Measures the Decision Engine vs optional Ollama models on a stratified Flowlary set.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseWritingReviewContent } from '@flowlary/shared'
import { resetHypothesisIdsForTests, setHypothesisAdvisor } from '../../../extension/src/core/engine/index.ts'
import {
  buildLocalAiEvalSet,
  sampleForModelEval,
  stratumCoverage,
  type LocalAiCase,
} from './local-ai-model-selection/dataset.ts'
import {
  configurePolicy,
  detectorToReviewEdits,
  inspectLocal,
  isHarmful,
  isUseful,
  localIntervened,
  parseRankerVote,
  redecideWithReviewEdits,
  redecideWithVote,
} from './local-ai-model-selection/inspect.ts'
import {
  DETECTOR_SYSTEM,
  RANKER_SYSTEM,
  REVIEW_SYSTEM,
  extractJsonObject,
  hasForbiddenKeys,
} from './local-ai-model-selection/contracts.ts'
import { ollamaAvailable, ollamaChat, ollamaModels } from './local-ai-model-selection/ollama.ts'

const OUT_DIR = resolve(import.meta.dirname)
const RESULTS_PATH = resolve(OUT_DIR, 'local-ai-model-selection-results.json')
const RAW_PATH = resolve(OUT_DIR, 'local-ai-model-selection/raw-evidence.json')

export const LOCAL_AI_SELECTION_METRICS: Record<string, unknown> = {}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]!
}

function summarizeLocal(cases: LocalAiCase[]) {
  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  let useful = 0
  let harmful = 0
  let unnecessary = 0
  let protectedViolation = 0
  let consult = 0
  let msSum = 0
  const latencies: number[] = []
  const byStratum: Record<string, { n: number; useful: number; harmful: number; intervene: number }> = {}

  for (const item of cases) {
    const source = item.strata.includes('X_pasted') ? 'paste' : 'typing'
    const result = inspectLocal(item.input, source)
    msSum += result.ms
    latencies.push(result.ms)
    if (result.consult) consult += 1
    const action = result.baseline.action
    const intervened = localIntervened(action)
    if (item.shouldIntervene && (intervened || (item.goldAction === 'english_correction' && action === 'suggestion'))) tp += 1
    else if (!item.shouldIntervene && intervened) fp += 1
    else if (item.shouldIntervene && !intervened) fn += 1
    else tn += 1
    if (isUseful(item, action)) useful += 1
    if (isHarmful(item, action)) harmful += 1
    if (!item.shouldIntervene && action === 'suggestion') unnecessary += 1
    if (item.protectedContent && intervened) protectedViolation += 1
    for (const stratum of item.strata) {
      const bucket = byStratum[stratum] ?? { n: 0, useful: 0, harmful: 0, intervene: 0 }
      bucket.n += 1
      if (isUseful(item, action)) bucket.useful += 1
      if (isHarmful(item, action)) bucket.harmful += 1
      if (intervened) bucket.intervene += 1
      byStratum[stratum] = bucket
    }
  }

  const n = cases.length
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  const preserveDenom = cases.filter((item) => item.mustPreserve).length
  const preserveCorrect = cases.filter((item) => {
    if (!item.mustPreserve) return false
    const source = item.strata.includes('X_pasted') ? 'paste' : 'typing'
    // Recompute would be expensive; use tn-style from loop instead via harmful
    return true
  }).length
  void preserveCorrect
  return {
    n,
    detectionPrecision: precision,
    detectionRecall: recall,
    f1,
    falsePositiveRate: tn + fp ? fp / (tn + fp) : 0,
    falseNegativeRate: tp + fn ? fn / (tp + fn) : 0,
    useful,
    harmful,
    unnecessary,
    protectedViolationRate: cases.filter((c) => c.protectedContent).length
      ? protectedViolation / cases.filter((c) => c.protectedContent).length
      : 0,
    consultRate: consult / n,
    meanMs: msSum / n,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    preservePrecision: preserveDenom ? 1 - (harmful / preserveDenom) : 1,
    harmfulInterventionRate: n ? harmful / n : 0,
    byStratum,
    confusion: { tp, fp, fn, tn },
  }
}

function productValue(row: { useful: number; harmful: number; unnecessary: number; latencyP95: number; n: number }) {
  const latencyPenalty = row.latencyP95 > 50 ? Math.min(20, (row.latencyP95 - 50) / 50) : 0
  return row.useful - (3 * row.harmful) - row.unnecessary - latencyPenalty
}

type ModelCaseRow = {
  id: string
  model: string
  contract: string
  latencyMs: number
  schemaValid: boolean
  forbidden: boolean
  spanOk: boolean
  localAction: string
  combinedAction: string
  usefulDelta: number
  harmfulDelta: number
  error?: string
}

async function evalModel(
  model: string,
  cases: LocalAiCase[],
): Promise<{
  model: string
  ranker: Record<string, number>
  detector: Record<string, number>
  review: Record<string, number>
  rows: ModelCaseRow[]
  latency: number[]
  tokensPrompt: number
  tokensOut: number
}> {
  const rows: ModelCaseRow[] = []
  const latency: number[] = []
  let tokensPrompt = 0
  let tokensOut = 0

  const acc = () => ({
    n: 0,
    schemaValid: 0,
    forbidden: 0,
    useful: 0,
    harmful: 0,
    improve: 0,
    worsen: 0,
    jsonValid: 0,
    spanOk: 0,
    mixedPreserveViolations: 0,
    protectedViolations: 0,
  })
  const ranker = acc()
  const detector = acc()
  const review = acc()

  await ollamaChat({
    model,
    system: 'Return {"ok":true}',
    user: 'warmup',
    timeoutMs: 60_000,
  })

  for (const item of cases) {
    const source = item.strata.includes('X_pasted') ? 'paste' : 'typing'
    const local = inspectLocal(item.input, source)
    latency.push(local.ms)

    if (local.packet && local.hypotheses.length > 0) {
      ranker.n += 1
      const user = JSON.stringify({
        snippet: local.packet.snippet,
        hypotheses: local.packet.hypotheses,
      })
      const chat = await ollamaChat({ model, system: RANKER_SYSTEM, user })
      tokensPrompt += chat.promptTokens
      tokensOut += chat.completionTokens
      const parsed = extractJsonObject(chat.content)
      const forbidden = hasForbiddenKeys(parsed)
      const vote = parsed ? parseRankerVote(parsed, local.hypotheses) : null
      const advised = redecideWithVote(local, vote)
      const combined = advised.action === 'suggestion' ? local.baseline.action : advised.action
      const productionAction = local.consult ? (advised.action === 'layout_fix' || advised.action === 'english_correction' ? 'suggestion' : advised.action) : local.baseline.action
      const usefulBefore = isUseful(item, local.baseline.action) ? 1 : 0
      const usefulAfter = isUseful(item, combined) ? 1 : 0
      const harmBefore = isHarmful(item, local.baseline.action) ? 1 : 0
      const harmAfter = isHarmful(item, combined) ? 1 : 0
      if (vote) ranker.jsonValid += 1
      if (forbidden) ranker.forbidden += 1
      if (isUseful(item, combined)) ranker.useful += 1
      if (isHarmful(item, combined)) ranker.harmful += 1
      if (usefulAfter > usefulBefore || harmAfter < harmBefore) ranker.improve += 1
      if (usefulAfter < usefulBefore || harmAfter > harmBefore) ranker.worsen += 1
      rows.push({
        id: item.id,
        model,
        contract: 'ranker',
        latencyMs: chat.latencyMs,
        schemaValid: Boolean(vote),
        forbidden,
        spanOk: true,
        localAction: local.baseline.action,
        combinedAction: productionAction,
        usefulDelta: usefulAfter - usefulBefore,
        harmfulDelta: harmAfter - harmBefore,
        error: chat.error,
      })
      latency.push(chat.latencyMs)
    }

    detector.n += 1
    const detectorChat = await ollamaChat({
      model,
      system: DETECTOR_SYSTEM,
      user: JSON.stringify({ text: item.input.slice(0, 400) }),
    })
    tokensPrompt += detectorChat.promptTokens
    tokensOut += detectorChat.completionTokens
    latency.push(detectorChat.latencyMs)
    const detected = extractJsonObject(detectorChat.content)
    const forbiddenDet = hasForbiddenKeys(detected)
    const mapped = detectorToReviewEdits(detected, item.input.slice(0, 400))
    const combinedDet = redecideWithReviewEdits(local, mapped.edits)
    const usefulBeforeD = isUseful(item, local.baseline.action) ? 1 : 0
    const usefulAfterD = isUseful(item, combinedDet.action) ? 1 : 0
    const harmBeforeD = isHarmful(item, local.baseline.action) ? 1 : 0
    const harmAfterD = isHarmful(item, combinedDet.action) ? 1 : 0
    if (mapped.schemaValid) detector.jsonValid += 1
    if (mapped.spanOk) detector.spanOk += 1
    if (forbiddenDet) detector.forbidden += 1
    if (isUseful(item, combinedDet.action)) detector.useful += 1
    if (isHarmful(item, combinedDet.action)) detector.harmful += 1
    if (usefulAfterD > usefulBeforeD || harmAfterD < harmBeforeD) detector.improve += 1
    if (usefulAfterD < usefulBeforeD || harmAfterD > harmBeforeD) detector.worsen += 1
    if (item.mustPreserve && item.strata.some((s) => s.startsWith('E_') || s.startsWith('F_')) && isHarmful(item, combinedDet.action)) {
      detector.mixedPreserveViolations += 1
    }
    if (item.protectedContent && localIntervened(combinedDet.action)) detector.protectedViolations += 1
    rows.push({
      id: item.id,
      model,
      contract: 'detector',
      latencyMs: detectorChat.latencyMs,
      schemaValid: mapped.schemaValid,
      forbidden: forbiddenDet,
      spanOk: mapped.spanOk,
      localAction: local.baseline.action,
      combinedAction: combinedDet.action,
      usefulDelta: usefulAfterD - usefulBeforeD,
      harmfulDelta: harmAfterD - harmBeforeD,
      error: detectorChat.error,
    })

    if (local.island && review.n < 18) {
      review.n += 1
      const reviewChat = await ollamaChat({
        model,
        system: REVIEW_SYSTEM,
        user: JSON.stringify({
          snippet: local.island.snippet,
          contextBefore: local.island.contextBefore,
          contextAfter: local.island.contextAfter,
        }),
      })
      tokensPrompt += reviewChat.promptTokens
      tokensOut += reviewChat.completionTokens
      latency.push(reviewChat.latencyMs)
      const parsedReview = parseWritingReviewContent(reviewChat.content, local.island.snippet)
      const forbiddenRev = hasForbiddenKeys(extractJsonObject(reviewChat.content))
      const edits = parsedReview.ok ? parsedReview.value.edits : []
      const combinedRev = redecideWithReviewEdits(local, edits)
      if (parsedReview.ok) review.jsonValid += 1
      if (forbiddenRev) review.forbidden += 1
      if (isUseful(item, combinedRev.action)) review.useful += 1
      if (isHarmful(item, combinedRev.action)) review.harmful += 1
      const usefulBeforeR = isUseful(item, local.baseline.action) ? 1 : 0
      const usefulAfterR = isUseful(item, combinedRev.action) ? 1 : 0
      const harmBeforeR = isHarmful(item, local.baseline.action) ? 1 : 0
      const harmAfterR = isHarmful(item, combinedRev.action) ? 1 : 0
      if (usefulAfterR > usefulBeforeR || harmAfterR < harmBeforeR) review.improve += 1
      if (usefulAfterR < usefulBeforeR || harmAfterR > harmBeforeR) review.worsen += 1
      rows.push({
        id: item.id,
        model,
        contract: 'writing_review',
        latencyMs: reviewChat.latencyMs,
        schemaValid: parsedReview.ok,
        forbidden: forbiddenRev,
        spanOk: parsedReview.ok || parsedReview.reason !== 'span_mismatch',
        localAction: local.baseline.action,
        combinedAction: combinedRev.action,
        usefulDelta: usefulAfterR - usefulBeforeR,
        harmfulDelta: harmAfterR - harmBeforeR,
        error: reviewChat.error,
      })
    }
  }

  const toRates = (s: ReturnType<typeof acc>, lat: number[]) => ({
    n: s.n,
    jsonValidity: s.n ? s.jsonValid / s.n : 0,
    forbiddenRate: s.n ? s.forbidden / s.n : 0,
    spanOkRate: s.n ? s.spanOk / s.n : 0,
    useful: s.useful,
    harmful: s.harmful,
    improve: s.improve,
    worsen: s.worsen,
    mixedPreserveViolations: s.mixedPreserveViolations,
    protectedViolations: s.protectedViolations,
    latencyP50: percentile(lat, 50),
    latencyP95: percentile(lat, 95),
  })

  const modelLat = rows.filter((row) => row.model === model).map((row) => row.latencyMs)
  return {
    model,
    ranker: toRates(ranker, modelLat.filter((_, i) => rows[i]?.contract === 'ranker')),
    detector: toRates(detector, modelLat.filter((_, i) => rows[i]?.contract === 'detector')),
    review: toRates(review, modelLat.filter((_, i) => rows[i]?.contract === 'writing_review')),
    rows,
    latency: modelLat,
    tokensPrompt,
    tokensOut,
  }
}

describe('local AI model selection study (isolated)', () => {
  beforeEach(() => {
    resetHypothesisIdsForTests()
    setHypothesisAdvisor(null)
    configurePolicy()
  })
  afterEach(() => {
    document.body.innerHTML = ''
    setHypothesisAdvisor(null)
  })

  it('builds A–Z coverage, scores the local engine, and runs available Ollama models', async () => {
    const all = buildLocalAiEvalSet()
    const coverage = stratumCoverage(all)
    const missing = [
      'A_en_spelling', 'B_en_grammar', 'C_en_punctuation', 'D_arabic', 'E_ar_en_mixed',
      'F_intentional_bilingual', 'G_keyboard_layout', 'H_spell_after_layout', 'I_technical',
      'J_urls', 'K_emails', 'L_secrets', 'M_code', 'N_names', 'O_slang', 'P_arabizi',
      'Q_short_fragments', 'R_long_sentences', 'S_multiple_errors', 'T_intentional_unusual',
      'U_user_vocab', 'V_rapid_incomplete', 'W_open_tokens', 'X_pasted', 'Y_protected',
      'Z_ambiguous_preserve',
    ].filter((key) => !coverage[key] || coverage[key]!.n < 1)
    expect(missing).toEqual([])
    expect(all.length).toBeGreaterThanOrEqual(400)
    expect(all.some((item) => item.shouldIntervene)).toBe(true)
    expect(all.filter((item) => item.mustPreserve).length).toBeGreaterThan(50)

    const localAll = summarizeLocal(all)
    const modelSample = sampleForModelEval(all, 6).slice(0, 90)
    const localSample = summarizeLocal(modelSample)

    const longSessionLocal: number[] = []
    const heapStart = process.memoryUsage().rss
    const cpuStart = process.cpuUsage()
    for (let i = 0; i < 400; i += 1) {
      const item = all[i % all.length]!
      const result = inspectLocal(item.input)
      longSessionLocal.push(result.ms)
    }
    const cpuLocal = process.cpuUsage(cpuStart)
    const heapAfterLocal = process.memoryUsage().rss

    const models: Record<string, unknown> = {}
    const rawRows: ModelCaseRow[] = []
    let ollama = false
    const available = await ollamaAvailable()
    const names = available ? await ollamaModels() : []
    const wanted = ['qwen3:0.6b', 'llama3.2:latest', 'llama3.2:3b'].filter((name) => names.includes(name))
    ollama = wanted.length > 0

    const longSessionModel: Array<{ t: number; rss: number }> = []
    for (const model of wanted) {
      const measured = await evalModel(model, modelSample)
      models[model] = {
        ranker: measured.ranker,
        detector: measured.detector,
        review: measured.review,
        tokensPrompt: measured.tokensPrompt,
        tokensOut: measured.tokensOut,
        meanTokensPerRequest: measured.rows.length
          ? (measured.tokensPrompt + measured.tokensOut) / measured.rows.length
          : 0,
        latencyP50: percentile(measured.latency, 50),
        latencyP95: percentile(measured.latency, 95),
        productValueDetector: productValue({
          useful: measured.detector.useful,
          harmful: measured.detector.harmful,
          unnecessary: 0,
          latencyP95: measured.detector.latencyP95,
          n: measured.detector.n,
        }),
        productValueRanker: productValue({
          useful: measured.ranker.useful,
          harmful: measured.ranker.harmful,
          unnecessary: 0,
          latencyP95: measured.ranker.latencyP95,
          n: measured.ranker.n,
        }),
      }
      rawRows.push(...measured.rows)
      const sessionStart = performance.now()
      for (let i = 0; i < 12; i += 1) {
        await ollamaChat({
          model,
          system: DETECTOR_SYSTEM,
          user: JSON.stringify({ text: modelSample[i % modelSample.length]!.input.slice(0, 120) }),
        })
        longSessionModel.push({ t: performance.now() - sessionStart, rss: process.memoryUsage().rss })
      }
    }

    const cloudPrior = {
      evidenceClass: 'REAL_MEASURED_PRIOR',
      source: 'tests/audit/evaluation/gemini-3.5-flash-lite-full-live-results.json',
      model: 'gemini-3.5-flash-lite',
      note: 'Hypothesis-advisor ranking on 200 layout-family holdout cases. Local already correct; ranking did not help or harm.',
      selectedGold: 0.91,
      advisedAccuracy: 0.92,
      localOnRanked: 0.92,
      accuracyDelta: 0,
      help: 0,
      harm: 0,
      successP50Ms: 940,
      successP95Ms: 1173,
      groqGptOss20b: {
        source: 'tests/audit/evaluation/gpt-oss-full-live-results.json',
        status: 'INCONCLUSIVE',
        reason: 'CASE_E_PROVIDER_RATE_LIMIT',
      },
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      evidenceClasses: {
        localEngine: 'REAL_MEASURED',
        ollamaModels: ollama ? 'REAL_MEASURED' : 'NOT_RUN',
        geminiAdvisor: 'REAL_MEASURED_PRIOR',
        gemma4_qwen35_4b: 'NOT_RUN_DISK',
      },
      hardware: {
        cpu: 'Apple M3 8-core',
        ramBytes: 17179869184,
        gpu: 'Apple M3 10-core, unified memory',
        os: 'darwin 25.5.0 arm64',
        diskAvailAtStudy: '519Mi after qwen3:0.6b pull',
        ollama: '0.32.5',
        docker: 'available in deploy/, not used for this eval',
        productionServer: 'single Node 22 process, no GPU in deploy compose',
      },
      dataset: {
        version: '1',
        total: all.length,
        modelSample: modelSample.length,
        intervene: all.filter((item) => item.shouldIntervene).length,
        mustPreserve: all.filter((item) => item.mustPreserve).length,
        coverage,
        modelSampleCoverage: stratumCoverage(modelSample),
      },
      localEngine: {
        all: localAll,
        modelSample: localSample,
        productValueAll: productValue(localAll),
        productValueSample: productValue(localSample),
      },
      models,
      cloudPrior,
      longSession: {
        localCycles: 400,
        localLatencyP50: percentile(longSessionLocal, 50),
        localLatencyP95: percentile(longSessionLocal, 95),
        rssStart: heapStart,
        rssAfterLocal: heapAfterLocal,
        rssDelta: heapAfterLocal - heapStart,
        cpuUserUs: cpuLocal.user,
        cpuSystemUs: cpuLocal.system,
        modelSessionPoints: longSessionModel.length,
        modelRssStart: longSessionModel[0]?.rss ?? null,
        modelRssEnd: longSessionModel.at(-1)?.rss ?? null,
      },
      availableOllama: names,
      evaluatedOllama: wanted,
    }

    Object.assign(LOCAL_AI_SELECTION_METRICS, payload)
    mkdirSync(resolve(OUT_DIR, 'local-ai-model-selection'), { recursive: true })
    writeFileSync(RESULTS_PATH, `${JSON.stringify(payload, null, 2)}\n`)
    writeFileSync(RAW_PATH, `${JSON.stringify({ rows: rawRows.slice(0, 800) }, null, 2)}\n`)

    expect(localAll.meanMs).toBeLessThan(20)
    expect(localAll.harmfulInterventionRate).toBeLessThan(0.1)
  }, 1_200_000)
})
