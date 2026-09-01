/**
 * Phase 3 candidate-generation evaluation. Not imported by production.
 * Measures hypothesis existence, not only final write actions.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  collectHypotheses,
  inferLayoutSpans,
  resetHypothesisIdsForTests,
  setHypothesisAdvisor,
} from '../../../extension/src/core/engine/index.ts'
import { layoutSpanConflictsWithMixedIntent } from '../../../extension/src/core/engine/mixedLayoutSafety.ts'
import { isEnglishWord } from '../../../extension/src/features/layout/layouts/lexicons/en-words.ts'
import { isArabicWord } from '../../../extension/src/features/layout/layouts/lexicons/ar-words.ts'
import { mapLayout, mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'

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

const TECH = [
  'API', 'SDK', 'LLM', 'GraphQL', 'PostgreSQL', 'userName', 'user_name',
  'localhost:3000', 'v2.4.1', 'notes.md', 'https://example.org/v2',
  'ops@example.org', 'npm', 'git', 'OAuth', 'css', 'html', 'json',
  'webpack.config.js', 'deploy', 'tokenId', 'buildId',
]

const AR_FRAMES = [
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

type Family = 'layout' | 'mixed' | 'spelling' | 'technical' | 'adversarial'
type Gold = 'layout' | 'preserve' | 'spelling_or_preserve'

type Case = { family: Family; input: string; intended?: string; gold: Gold }

function inspect(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'hg2',
    composing: false,
    textLength: text.length,
  })
  const started = performance.now()
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const ms = performance.now() - started
  document.body.innerHTML = ''
  const layoutHyps = hypotheses.filter((item) => item.intent === 'fix_layout' && item.replacement)
  const mixUnsafe = layoutHyps.some((item) => layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks))
  const protectedLayout = hypotheses.some((item) => (
    item.intent === 'fix_layout'
    && item.sourceChunkIds.some((id) => analysis.chunks.find((chunk) => chunk.id === id)?.protectedKind)
  ))
  return { analysis, hypotheses, layoutHyps, mixUnsafe, protectedLayout, ms, hypCount: hypotheses.length }
}

function buildCases(rng: () => number): Case[] {
  const cases: Case[] = []
  const enPool = UNSEEN_EN.length ? UNSEEN_EN : IN_LEX_EN
  const arPool = UNSEEN_AR.length ? UNSEEN_AR : IN_LEX_AR
  const enLex = IN_LEX_EN.length ? IN_LEX_EN : enPool
  const arLex = IN_LEX_AR.length ? IN_LEX_AR : arPool

  for (let i = 0; i < 2000; i += 1) {
    if (i % 2 === 0) {
      const words = [pick(rng, enPool), pick(rng, enPool), pick(rng, enLex)]
      const intended = words.join(' ')
      const typed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== intended) cases.push({ family: 'layout', input: typed, intended, gold: 'layout' })
    } else {
      const words = [pick(rng, arPool), pick(rng, arPool), pick(rng, arLex)]
      const intended = words.join(' ')
      const typed = mapLayoutText(intended, 'ar-101', 'en-US-qwerty')
      if (typed && typed !== intended) cases.push({ family: 'layout', input: typed, intended, gold: 'layout' })
    }
  }
  while (cases.filter((item) => item.family === 'layout').length < 2000) {
    const word = pick(rng, enPool)
    const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
    const extra = mapLayout(pick(rng, enLex), 'en-US-qwerty', 'ar-101')
    if (typed && extra) cases.push({ family: 'layout', input: `${typed} ${extra}`, intended: `${word} ${extra}`, gold: 'layout' })
  }

  for (let i = 0; i < 1000; i += 1) {
    const token = pick(rng, TECH)
    const frame = pick(rng, AR_FRAMES).replace('TOKEN', token)
    cases.push({ family: 'mixed', input: frame, gold: 'preserve' })
  }

  for (let i = 0; i < 1000; i += 1) {
    if (i % 2 === 0) {
      const word = pick(rng, enPool)
      const mangled = word.slice(0, -1) + (word.endsWith('e') ? 'a' : 'e')
      cases.push({ family: 'spelling', input: `please ${mangled} this`, gold: 'spelling_or_preserve' })
    } else {
      const word = pick(rng, enLex)
      const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (typed) cases.push({ family: 'spelling', input: `please ${typed} this`, gold: 'layout' })
    }
  }

  for (let i = 0; i < 1000; i += 1) {
    const token = pick(rng, TECH)
    if (i % 4 === 0) cases.push({ family: 'technical', input: `see ${token}`, gold: 'preserve' })
    else if (i % 4 === 1) cases.push({ family: 'technical', input: pick(rng, AR_FRAMES).replace('TOKEN', token), gold: 'preserve' })
    else if (i % 4 === 2) cases.push({ family: 'technical', input: token, gold: 'preserve' })
    else cases.push({ family: 'technical', input: `${pick(rng, arLex)} ${token}`, gold: 'preserve' })
  }

  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const arLetters = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
  for (let i = 0; i < 200; i += 1) {
    let latin = ''
    let arabic = ''
    const len = 5 + Math.floor(rng() * 4)
    for (let j = 0; j < len; j += 1) latin += alphabet[Math.floor(rng() * alphabet.length)]!
    for (let j = 0; j < len; j += 1) arabic += arLetters[Math.floor(rng() * arLetters.length)]!
    cases.push({ family: 'adversarial', input: latin, gold: 'preserve' })
    cases.push({ family: 'adversarial', input: arabic, gold: 'preserve' })
  }

  return cases
}

type Stats = {
  n: number
  layoutGold: number
  layoutRecallHits: number
  preserveGold: number
  falseLayout: number
  mixUnsafeWrites: number
  protectedHits: number
  hypSum: number
  timeMs: number
}

function empty(): Stats {
  return {
    n: 0, layoutGold: 0, layoutRecallHits: 0, preserveGold: 0, falseLayout: 0,
    mixUnsafeWrites: 0, protectedHits: 0, hypSum: 0, timeMs: 0,
  }
}

function accumulate(stats: Stats, item: Case) {
  const out = inspect(item.input)
  stats.n += 1
  stats.hypSum += out.hypCount
  stats.timeMs += out.ms
  const hasLayout = out.layoutHyps.length > 0 || inferLayoutSpans(item.input).length > 0
  if (item.gold === 'layout') {
    stats.layoutGold += 1
    if (hasLayout) stats.layoutRecallHits += 1
  } else {
    stats.preserveGold += 1
    if (item.family !== 'spelling' && hasLayout && !out.mixUnsafe) stats.falseLayout += 1
  }
  if (item.family === 'mixed' && out.layoutHyps.some((hyp) => !layoutSpanConflictsWithMixedIntent(hyp.span, out.analysis.chunks) && hyp.risk === 'low' && !hyp.needsLLM)) {
    stats.mixUnsafeWrites += 1
  }
  if (out.protectedLayout) stats.protectedHits += 1
}

function pct(num: number, den: number): string {
  if (!den) return 'n/a'
  return `${((100 * num) / den).toFixed(2)}%`
}

export const HG2_METRICS: Record<string, unknown> = {}

describe('hypothesis generation v2 holdout', () => {
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
    document.body.innerHTML = ''
  })

  it('scores candidate recall/precision on generated unseen splits', { timeout: 180_000 }, () => {
    const rng = mulberry32(20260831)
    const all = buildCases(rng)
    const layout = all.filter((item) => item.family === 'layout')
    const mixed = all.filter((item) => item.family === 'mixed')
    const spelling = all.filter((item) => item.family === 'spelling')
    const technical = all.filter((item) => item.family === 'technical')
    const adversarial = all.filter((item) => item.family === 'adversarial')
    expect(layout.length).toBeGreaterThanOrEqual(2000)
    expect(mixed.length).toBe(1000)
    expect(spelling.length).toBeGreaterThanOrEqual(1000)
    expect(technical.length).toBe(1000)
    expect(all.length).toBeGreaterThanOrEqual(5000)

    const splits = {
      layout: splitHoldout(layout, 101),
      mixed: splitHoldout(mixed, 202),
      spelling: splitHoldout(spelling, 303),
      technical: splitHoldout(technical, 404),
      adversarial: splitHoldout(adversarial, 505),
    }

    const bySplit: Record<string, Stats> = {
      development: empty(),
      validation: empty(),
      holdout: empty(),
    }
    for (const key of ['development', 'validation', 'holdout'] as const) {
      for (const family of Object.values(splits)) {
        for (const item of family[key]) accumulate(bySplit[key]!, item)
      }
    }

    const holdout = bySplit.holdout!
    const recall = holdout.layoutRecallHits / Math.max(1, holdout.layoutGold)
    const precisionDenom = holdout.layoutRecallHits + holdout.falseLayout
    const precision = holdout.layoutRecallHits / Math.max(1, precisionDenom)
    Object.assign(HG2_METRICS, {
      counts: {
        total: all.length,
        layout: layout.length,
        mixed: mixed.length,
        spelling: spelling.length,
        technical: technical.length,
        adversarial: adversarial.length,
        holdoutN: holdout.n,
      },
      holdout: {
        layoutRecall: pct(holdout.layoutRecallHits, holdout.layoutGold),
        candidatePrecision: pct(holdout.layoutRecallHits, precisionDenom),
        falseLayoutOnPreserve: holdout.falseLayout,
        mixAutoWriteRisk: holdout.mixUnsafeWrites,
        protectedLayoutHyps: holdout.protectedHits,
        avgHypotheses: Number((holdout.hypSum / holdout.n).toFixed(2)),
        avgMs: Number((holdout.timeMs / holdout.n).toFixed(3)),
      },
      splits: Object.fromEntries(Object.entries(bySplit).map(([name, stats]) => [name, {
        n: stats.n,
        layoutRecall: pct(stats.layoutRecallHits, stats.layoutGold),
        precision: pct(stats.layoutRecallHits, stats.layoutRecallHits + stats.falseLayout),
        avgHyps: Number((stats.hypSum / stats.n).toFixed(2)),
      }])),
    })
    // eslint-disable-next-line no-console
    console.log('HG2_METRICS', JSON.stringify(HG2_METRICS, null, 2))

    expect(recall).toBeGreaterThan(0.55)
    expect(precision).toBeGreaterThan(0.55)
    expect(holdout.mixUnsafeWrites).toBe(0)
    expect(holdout.timeMs / holdout.n).toBeLessThan(25)
  })
})
