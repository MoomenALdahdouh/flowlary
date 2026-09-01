/**
 * Phase 2 generated evaluation. Not imported by production.
 * Compares baseline decideWriting vs advisor-ranked decideWriting.
 * CI has no Groq: the "advisor" here is a label-free prompt-shaped ranker
 * plus an oracle upper bound. Real model holdout is not measured.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  resetHypothesisIdsForTests,
  setHypothesisAdvisor,
  shouldConsultAdvisor,
} from '../../../extension/src/core/engine/index.ts'
import { layoutSpanConflictsWithMixedIntent } from '../../../extension/src/core/engine/mixedLayoutSafety.ts'
import { isEnglishWord } from '../../../extension/src/features/layout/layouts/lexicons/en-words.ts'
import { isArabicWord } from '../../../extension/src/features/layout/layouts/lexicons/ar-words.ts'
import { mapLayout, mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'
import type { AdvisorVote, Hypothesis, SharedAnalysis } from '../../../extension/src/core/engine/types.ts'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

const UNSEEN_EN = `
architecture validation recommendation committee university hospital
calendar mountain river valley forest desert island ocean
bicycle motorcycle airplane railway station platform passenger
kitchen garden window curtain balcony basement attic garage
orange banana grape lemon cherry peach melon pumpkin onion
jacket sweater gloves scarf umbrella wallet suitcase passport
purple silver golden bronze crimson violet amber ivory
quietly suddenly rapidly slowly carefully honestly briefly
compute compile execute iterate encapsulate serialize deserialize
quantum neutrino photon electron molecule crystal lattice
thursday february september november wednesday saturday
`.trim().split(/\s+/).filter((w) => w.length >= 4 && !isEnglishWord(w))

const UNSEEN_AR = `
مدرسة كتاب جامعة مستشفى تقويم جبل نهر وادي غابة صحراء جزيرة محيط
دراجة مطبخ حديقة نافذة ستارة شرفة قبو مرآب برتقال موز عنب ليمون
سترة قفاز وشاح مظلة محفظة حقيبة جواز بنفسجي فضي ذهبي برونزي
بهدوء فجأة بسرعة ببطء بعناية بصدق الخميس فبراير سبتمبر نوفمبر
`.trim().split(/\s+/).filter((w) => w.length >= 3 && !isArabicWord(w))

const IN_LEX_EN = `
hello please thanks today tomorrow English Arabic keyboard layout
project working message meeting error ready update language
`.trim().split(/\s+/).filter((w) => isEnglishWord(w) && w.length >= 4)

const IN_LEX_AR = `
مرحبا شكرا اليوم المشروع يعمل اللغة التصميم المستخدم يمكن
`.trim().split(/\s+/).filter((w) => isArabicWord(w) && w.length >= 3)

const TECH_TOKENS = [
  'API', 'SDK', 'LLM', 'GraphQL', 'PostgreSQL',
  'userName', 'user_name', 'localhost:3000', 'v2.4.1', 'notes.md',
  'https://example.org/v2', 'ops@example.org',
  'npm', 'git', 'Python', 'Laravel',
  'OAuth', 'css', 'html', 'json', 'webpack.config.js',
  'deploy', 'error', 'tokenId', 'buildId',
]

const ARABIC_FRAMES = [
  'أنا استخدمت TOKEN اليوم',
  'هل يمكن إصلاح TOKEN؟',
  'هذا TOKEN جيد جدًا',
  'أريد TOKEN من النظام',
  'TOKEN يعمل الآن',
  'راجع TOKEN ثم أرسل',
]

function splitHoldout<T>(items: T[], seed: number) {
  const rng = mulberry32(seed)
  const shuffled = [...items].sort(() => rng() - 0.5)
  const n = shuffled.length
  return {
    development: shuffled.slice(0, Math.floor(n * 0.5)),
    validation: shuffled.slice(Math.floor(n * 0.5), Math.floor(n * 0.75)),
    holdout: shuffled.slice(Math.floor(n * 0.75)),
  }
}

type Expected = 'layout_fix' | 'preserve' | 'english_or_abstain'

type Case = { family: string; input: string; expected: Expected }

function decide(text: string, vote: AdvisorVote | null, advisorResult: 'unused' | 'ranked') {
  const ta = textarea(text)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'holdout',
    composing: false,
    textLength: text.length,
  })
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context)
  const decision = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
    advisorVote: vote,
    advisorResult,
  })
  return { context, analysis, hypotheses, candidates, decision }
}

function firstId(hyps: Hypothesis[], pred: (item: Hypothesis) => boolean): string | null {
  return hyps.filter(pred).sort((a, b) => b.localScore - a.localScore)[0]?.id ?? null
}

function oracleVote(hyps: Hypothesis[], analysis: SharedAnalysis, expected: Expected): AdvisorVote | null {
  let id: string | null = null
  if (expected === 'layout_fix') {
    id = firstId(hyps, (item) => (
      item.intent === 'fix_layout'
      && !item.needsLLM
      && item.risk === 'low'
      && !layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks)
    )) ?? firstId(hyps, (item) => (
      item.intent === 'fix_layout'
      && !layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks)
    ))
  } else if (expected === 'english_or_abstain') {
    id = firstId(hyps, (item) => item.intent === 'fix_english')
      ?? firstId(hyps, (item) => item.intent === 'preserve' || item.intent === 'write_as_is')
  } else {
    id = firstId(hyps, (item) => item.intent === 'preserve' || item.intent === 'write_as_is' || item.intent === 'unknown')
  }
  if (!id) return null
  return { rankedHypothesisIds: [id], reasonCode: 'oracle', ambiguityClass: 'eval' }
}

function heuristicVote(text: string, hyps: Hypothesis[], analysis: SharedAnalysis): AdvisorVote | null {
  const hasAr = /\p{Script=Arabic}/u.test(text)
  const hasLat = /[A-Za-z]{2,}/.test(text)
  const mixed = hasAr && hasLat
  const urlOrEmail = /https?:\/\/|\S+@\S+\.\S+/.test(text)
  const codeLike = /[_.=:{}\[\]<>]|localhost|\.js\b|\.ts\b|const\s|function\s/.test(text)
  const keep = firstId(hyps, (item) => item.intent === 'preserve' || item.intent === 'write_as_is')
  const layoutSafe = firstId(hyps, (item) => (
    item.intent === 'fix_layout'
    && !layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks)
  ))
  const spell = firstId(hyps, (item) => item.intent === 'fix_english')
  let id = keep
  if (mixed || urlOrEmail || codeLike) id = keep ?? id
  else if (spell && !hasAr) id = spell
  else if (layoutSafe && !mixed) id = layoutSafe
  if (!id) return null
  return { rankedHypothesisIds: [id], reasonCode: 'heuristic', ambiguityClass: 'eval' }
}

function actionOk(expected: Expected, action: string): boolean {
  if (expected === 'layout_fix') return action === 'layout_fix'
  if (expected === 'preserve') return action !== 'layout_fix'
  return action !== 'layout_fix'
}

function buildCases(rng: () => number): Case[] {
  const cases: Case[] = []
  for (let i = 0; i < 1000; i += 1) {
    if (i % 2 === 0) {
      const words = [pick(rng, UNSEEN_EN.length ? UNSEEN_EN : IN_LEX_EN), pick(rng, UNSEEN_EN.length ? UNSEEN_EN : IN_LEX_EN), pick(rng, IN_LEX_EN.length ? IN_LEX_EN : UNSEEN_EN)]
      const sentence = words.join(' ')
      const typed = mapLayoutText(sentence, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== sentence) {
        cases.push({ family: 'layout_en_on_ar', input: typed, expected: 'layout_fix' })
      }
    } else {
      const words = [pick(rng, UNSEEN_AR.length ? UNSEEN_AR : IN_LEX_AR), pick(rng, UNSEEN_AR.length ? UNSEEN_AR : IN_LEX_AR), pick(rng, IN_LEX_AR.length ? IN_LEX_AR : UNSEEN_AR)]
      const sentence = words.join(' ')
      const typed = mapLayoutText(sentence, 'ar-101', 'en-US-qwerty')
      if (typed && typed !== sentence) {
        cases.push({ family: 'layout_ar_on_en', input: typed, expected: 'layout_fix' })
      }
    }
  }
  while (cases.filter((item) => item.family.startsWith('layout_')).length < 1000) {
    const word = pick(rng, UNSEEN_EN.length ? UNSEEN_EN : IN_LEX_EN)
    const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
    if (typed && typed !== word) {
      cases.push({ family: 'layout_en_on_ar', input: `${typed} ${mapLayout(pick(rng, IN_LEX_EN.length ? IN_LEX_EN : UNSEEN_EN), 'en-US-qwerty', 'ar-101')}`, expected: 'layout_fix' })
    }
  }

  for (let i = 0; i < 500; i += 1) {
    const token = pick(rng, TECH_TOKENS)
    const frame = pick(rng, ARABIC_FRAMES).replace('TOKEN', token)
    cases.push({ family: 'mixed_language', input: frame, expected: 'preserve' })
  }

  for (let i = 0; i < 500; i += 1) {
    if (i % 2 === 0) {
      const word = pick(rng, UNSEEN_EN.length ? UNSEEN_EN : IN_LEX_EN)
      const mangled = word.slice(0, -1) + (word.endsWith('e') ? 'a' : 'e')
      cases.push({ family: 'spelling_vs_layout', input: `please ${mangled} this`, expected: 'english_or_abstain' })
    } else {
      const word = pick(rng, IN_LEX_EN.length ? IN_LEX_EN : UNSEEN_EN)
      const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (typed) {
        cases.push({ family: 'spelling_vs_layout', input: `please ${typed} this`, expected: 'layout_fix' })
      } else {
        cases.push({ family: 'spelling_vs_layout', input: `please ${word} this`, expected: 'preserve' })
      }
    }
  }

  for (let i = 0; i < 500; i += 1) {
    const token = pick(rng, TECH_TOKENS)
    if (i % 3 === 0) cases.push({ family: 'technical_symbol', input: `see ${token}`, expected: 'preserve' })
    else if (i % 3 === 1) cases.push({ family: 'technical_symbol', input: pick(rng, ARABIC_FRAMES).replace('TOKEN', token), expected: 'preserve' })
    else cases.push({ family: 'technical_symbol', input: token, expected: 'preserve' })
  }

  return cases
}

type Stats = {
  n: number
  baselineOk: number
  heuristicOk: number
  oracleOk: number
  baselineFp: number
  heuristicFp: number
  oracleFp: number
  baselineFn: number
  heuristicFn: number
  oracleFn: number
  consult: number
  mixedBaselineFp: number
  mixedHeuristicFp: number
}

function emptyStats(): Stats {
  return {
    n: 0, baselineOk: 0, heuristicOk: 0, oracleOk: 0,
    baselineFp: 0, heuristicFp: 0, oracleFp: 0,
    baselineFn: 0, heuristicFn: 0, oracleFn: 0,
    consult: 0, mixedBaselineFp: 0, mixedHeuristicFp: 0,
  }
}

function accumulate(stats: Stats, item: Case) {
  const base = decide(item.input, null, 'unused')
  const consult = shouldConsultAdvisor(base.hypotheses, base.context, base.analysis)
  const heuristic = heuristicVote(item.input, base.hypotheses, base.analysis)
  const oracle = oracleVote(base.hypotheses, base.analysis, item.expected)
  const advised = consult && heuristic
    ? decide(item.input, heuristic, 'ranked').decision
    : base.decision
  const oracled = consult && oracle
    ? decide(item.input, oracle, 'ranked').decision
    : base.decision

  stats.n += 1
  if (consult) stats.consult += 1
  if (actionOk(item.expected, base.decision.action)) stats.baselineOk += 1
  if (actionOk(item.expected, advised.action)) stats.heuristicOk += 1
  if (actionOk(item.expected, oracled.action)) stats.oracleOk += 1
  if (item.expected !== 'layout_fix' && base.decision.action === 'layout_fix') stats.baselineFp += 1
  if (item.expected !== 'layout_fix' && advised.action === 'layout_fix') stats.heuristicFp += 1
  if (item.expected !== 'layout_fix' && oracled.action === 'layout_fix') stats.oracleFp += 1
  if (item.expected === 'layout_fix' && base.decision.action !== 'layout_fix') stats.baselineFn += 1
  if (item.expected === 'layout_fix' && advised.action !== 'layout_fix') stats.heuristicFn += 1
  if (item.expected === 'layout_fix' && oracled.action !== 'layout_fix') stats.oracleFn += 1
  if (item.family === 'mixed_language' && base.decision.action === 'layout_fix') stats.mixedBaselineFp += 1
  if (item.family === 'mixed_language' && advised.action === 'layout_fix') stats.mixedHeuristicFp += 1
  document.body.innerHTML = ''
}

function pct(num: number, den: number): string {
  if (!den) return 'n/a'
  return `${((100 * num) / den).toFixed(2)}%`
}

export const ADVISOR_HOLDOUT_METRICS: Record<string, unknown> = {}

describe('advisor generated holdout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setHypothesisAdvisor(null)
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
    document.body.innerHTML = ''
  })

  it('scores development / validation / holdout without Groq', { timeout: 180_000 }, () => {
    const rng = mulberry32(20260831)
    const all = buildCases(rng)
    const layout = all.filter((item) => item.family.startsWith('layout_'))
    const mixed = all.filter((item) => item.family === 'mixed_language')
    const spelling = all.filter((item) => item.family === 'spelling_vs_layout')
    const technical = all.filter((item) => item.family === 'technical_symbol')
    expect(layout.length).toBeGreaterThanOrEqual(1000)
    expect(mixed.length).toBe(500)
    expect(spelling.length).toBeGreaterThanOrEqual(500)
    expect(technical.length).toBe(500)

    const splits = {
      layout: splitHoldout(layout, 11),
      mixed: splitHoldout(mixed, 22),
      spelling: splitHoldout(spelling, 33),
      technical: splitHoldout(technical, 44),
    }

    const bySplit: Record<string, Stats> = {
      development: emptyStats(),
      validation: emptyStats(),
      holdout: emptyStats(),
    }
    for (const key of ['development', 'validation', 'holdout'] as const) {
      for (const family of Object.values(splits)) {
        for (const item of family[key]) accumulate(bySplit[key]!, item)
      }
    }

    const holdout = bySplit.holdout!
    Object.assign(ADVISOR_HOLDOUT_METRICS, {
      counts: {
        layout: layout.length,
        mixed: mixed.length,
        spelling: spelling.length,
        technical: technical.length,
        holdoutN: holdout.n,
      },
      baselineAccuracy: pct(holdout.baselineOk, holdout.n),
      advisorHeuristicAccuracy: pct(holdout.heuristicOk, holdout.n),
      oracleAccuracy: pct(holdout.oracleOk, holdout.n),
      baselineFp: holdout.baselineFp,
      advisorFp: holdout.heuristicFp,
      fpChange: holdout.heuristicFp - holdout.baselineFp,
      baselineFn: holdout.baselineFn,
      advisorFn: holdout.heuristicFn,
      fnChange: holdout.heuristicFn - holdout.baselineFn,
      invocationRate: pct(holdout.consult, holdout.n),
      mixedBaselineFp: holdout.mixedBaselineFp,
      mixedAdvisorFp: holdout.mixedHeuristicFp,
      splits: Object.fromEntries(Object.entries(bySplit).map(([name, stats]) => [name, {
        n: stats.n,
        baseline: pct(stats.baselineOk, stats.n),
        heuristic: pct(stats.heuristicOk, stats.n),
        oracle: pct(stats.oracleOk, stats.n),
        consult: pct(stats.consult, stats.n),
        fp: stats.heuristicFp - stats.baselineFp,
        fn: stats.heuristicFn - stats.baselineFn,
      }])),
    })

    // eslint-disable-next-line no-console
    console.log('ADVISOR_HOLDOUT_METRICS', JSON.stringify(ADVISOR_HOLDOUT_METRICS, null, 2))

    expect(holdout.mixedHeuristicFp).toBeLessThanOrEqual(holdout.mixedBaselineFp)
    expect(holdout.heuristicFp).toBeLessThanOrEqual(holdout.baselineFp + Math.ceil(holdout.n * 0.02))
  })
})
