/**
 * EXPERIMENT ONLY — not production, not a product test, not imported by the app.
 * Architecture audit holdout: 2026-08-31
 *
 * Evaluates the CURRENT Decision Engine on generated/unseen cases.
 * Does not modify extension/src.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { buildFieldContext } from '../../../extension/src/core/engine/context.ts'
import { collectHypotheses, resetHypothesisIdsForTests } from '../../../extension/src/core/engine/hypotheses.ts'
import { decideWriting } from '../../../extension/src/core/engine/decide.ts'
import { candidatesFromHypotheses } from '../../../extension/src/core/engine/candidates.ts'
import { shouldConsultAdvisor } from '../../../extension/src/core/engine/advisor.ts'
import { inferLayoutSpans } from '../../../extension/src/core/engine/layoutSequence.ts'
import { isEnglishWord } from '../../../extension/src/features/layout/layouts/lexicons/en-words.ts'
import { isArabicWord } from '../../../extension/src/features/layout/layouts/lexicons/ar-words.ts'
import { mapLayout, mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'
import { analyzeFieldText } from './analyzeShim.ts'
import { writeFileSync } from 'node:fs'

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

function decide(text: string, overrides: Record<string, unknown> = {}) {
  const ta = textarea(text)
  const session = new FieldSession(ta)
  if (overrides.translationSession) session.ensureTranslationSession()
  const context = {
    ...buildFieldContext({
      element: ta,
      session,
      cycleId: 'audit',
      composing: false,
      textLength: text.length,
    }),
    ...overrides,
  }
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context)
  const decision = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
  })
  const layoutHyp = hypotheses.find((h) => h.intent === 'fix_layout' && h.replacement)
  const spellHyp = hypotheses.find((h) => h.intent === 'fix_english' && h.replacement)
  return { analysis, hypotheses, candidates, decision, layoutHyp, spellHyp, context }
}

/** English words intentionally outside the closed Flowlary lexicon. */
const UNSEEN_EN = `
architecture validation recommendation committee university hospital
calendar mountain river valley forest desert island ocean valley
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
  'API', 'UI', 'UX', 'SDK', 'LLM', 'GraphQL', 'FastAPI', 'PostgreSQL',
  'userName', 'user_name', 'localhost:3000', 'v1.2.3', 'file.txt',
  'https://example.com/api/v1', 'user@example.com', 'sk-abcdefghijklmnopqrstuv',
  'npm', 'git', 'deploy', 'error', 'Python', 'Laravel', 'chrome',
  'OAuth', 'JWT', 'css', 'html', 'json', 'webpack.config.js',
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

type Row = {
  split: string
  family: string
  input: string
  expected: string
  action: string
  replacement: string | null
  reasons: string[]
  consultAdvisor: boolean
  layoutScore: number | null
  deadSequenceWouldFix: boolean
}

const rows: Row[] = []

function record(
  split: string,
  family: string,
  input: string,
  expected: 'layout_fix' | 'english_correction' | 'noop' | 'preserve' | 'translation',
  extra: Record<string, unknown> = {},
) {
  const out = decide(input, extra)
  const replacement = out.decision.action === 'layout_fix' || out.decision.action === 'english_correction'
    ? out.candidates.find((c) => c.id === out.decision.winnerCandidateId)?.replacement ?? null
    : null
  const seq = inferLayoutSpans(input)
  rows.push({
    split,
    family,
    input,
    expected,
    action: out.decision.action,
    replacement,
    reasons: out.decision.reasonCodes,
    consultAdvisor: shouldConsultAdvisor(out.hypotheses),
    layoutScore: out.layoutHyp?.localScore ?? null,
    deadSequenceWouldFix: seq.some((s) => s.risk === 'low'),
  })
  return out
}

describe('EXPERIMENT architecture holdout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
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
    stateManager.translation.liveEnabled = false
    stateManager.translation.mode = 'direct'
    stateManager.translation.shortcutEnabled = true
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('generates and scores holdout families', () => {
    expect(UNSEEN_EN.length).toBeGreaterThan(20)
    expect(UNSEEN_AR.length).toBeGreaterThan(15)

    const layoutCases: Array<{ input: string; expected: 'layout_fix' | 'noop'; family: string }> = []
    const rng = mulberry32(20260831)

    for (const word of IN_LEX_EN) {
      const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== word) {
        layoutCases.push({ input: typed, expected: 'layout_fix', family: 'layout_en_on_ar_inlex' })
      }
    }
    for (const word of IN_LEX_AR) {
      const typed = mapLayout(word, 'ar-101', 'en-US-qwerty')
      if (typed && typed !== word) {
        layoutCases.push({ input: typed, expected: 'layout_fix', family: 'layout_ar_on_en_inlex' })
      }
    }
    for (const word of UNSEEN_EN) {
      const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== word) {
        layoutCases.push({ input: typed, expected: 'layout_fix', family: 'layout_en_on_ar_unseen' })
      }
    }
    for (const word of UNSEEN_AR) {
      const typed = mapLayout(word, 'ar-101', 'en-US-qwerty')
      if (typed && typed !== word) {
        layoutCases.push({ input: typed, expected: 'layout_fix', family: 'layout_ar_on_en_unseen' })
      }
    }

    const enSentences = [
      'please send this file today',
      'the meeting starts tomorrow morning',
      'this project needs another update',
      'can you check the error again',
      'hello how are you today',
    ]
    const arSentences = [
      'مرحبا كيف حالك اليوم',
      'أريد إرسال هذا المشروع غدا',
      'التصميم يعمل مع المستخدم',
      'هل يمكن استخدام اللغة اليوم',
    ]
    const unseenEnSentences = [
      'the committee postponed the university calendar',
      'a bicycle crossed the mountain railway',
      'serialize the quantum lattice quietly',
      'thursday february remains unusually cloudy',
      'the passenger forgot a purple suitcase',
    ]
    const unseenArSentences = [
      'ذهبت إلى المدرسة بعد الجامعة',
      'اشتريت برتقال وموز من السوق',
      'النافذة تطل على الحديقة',
      'الحقيبة فيها جواز السفر',
    ]

    for (const sentence of [...enSentences, ...unseenEnSentences]) {
      const typed = mapLayoutText(sentence, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== sentence) {
        layoutCases.push({
          input: typed,
          expected: 'layout_fix',
          family: enSentences.includes(sentence) ? 'layout_en_sentence_inlex' : 'layout_en_sentence_unseen',
        })
      }
    }
    for (const sentence of [...arSentences, ...unseenArSentences]) {
      const typed = mapLayoutText(sentence, 'ar-101', 'en-US-qwerty')
      if (typed && typed !== sentence) {
        layoutCases.push({
          input: typed,
          expected: 'layout_fix',
          family: arSentences.includes(sentence) ? 'layout_ar_sentence_inlex' : 'layout_ar_sentence_unseen',
        })
      }
    }

    while (layoutCases.filter((c) => c.family.startsWith('layout_')).length < 1100) {
      const useEn = rng() < 0.5
      if (useEn) {
        const a = pick(rng, UNSEEN_EN)
        const b = pick(rng, UNSEEN_EN)
        const c = pick(rng, IN_LEX_EN.length ? IN_LEX_EN : UNSEEN_EN)
        const sentence = `${a} ${b} ${c}`
        const typed = mapLayoutText(sentence, 'en-US-qwerty', 'ar-101')
        if (typed && typed !== sentence) {
          layoutCases.push({ input: typed, expected: 'layout_fix', family: 'layout_en_generated_unseen' })
        }
      } else {
        const a = pick(rng, UNSEEN_AR)
        const b = pick(rng, UNSEEN_AR)
        const sentence = `${a} ${b}`
        const typed = mapLayoutText(sentence, 'ar-101', 'en-US-qwerty')
        if (typed && typed !== sentence) {
          layoutCases.push({ input: typed, expected: 'layout_fix', family: 'layout_ar_generated_unseen' })
        }
      }
    }

    const falseLayout = [
      ...UNSEEN_EN.map((w) => ({ input: w, expected: 'noop' as const, family: 'layout_false_unseen_en' })),
      ...IN_LEX_EN.map((w) => ({ input: w, expected: 'noop' as const, family: 'layout_false_inlex_en' })),
      ...UNSEEN_AR.map((w) => ({ input: w, expected: 'noop' as const, family: 'layout_false_unseen_ar' })),
      ...IN_LEX_AR.map((w) => ({ input: w, expected: 'noop' as const, family: 'layout_false_inlex_ar' })),
      { input: 'hello world', expected: 'noop' as const, family: 'layout_false_en_sentence' },
      { input: 'مرحبا كيف حالك', expected: 'noop' as const, family: 'layout_false_ar_sentence' },
    ]
    layoutCases.push(...falseLayout)

    const mixedCases: Array<{ input: string; expected: 'noop' | 'preserve'; family: string }> = []
    for (const frame of ARABIC_FRAMES) {
      for (const token of TECH_TOKENS) {
        mixedCases.push({
          input: frame.replace('TOKEN', token),
          expected: 'noop',
          family: 'mixed_ar_plus_tech',
        })
      }
    }
    const extraMix = [
      'this design جيد جدا',
      'please راجع the file',
      'ok شكرا',
      'error في السيرفر',
      'يعني اريد تحسين ui ux',
      'Python و Laravel معا',
      'chrome جيد',
      'git push ثم راجع',
      'I need مساعدة tomorrow',
      'send الملف اليوم',
      'the جامعة is closed',
      'نحتاج deploy الآن',
      'fix الـ API please',
      'مرحبا، this is API.',
      'how i can make this api اليوم',
    ]
    for (const input of extraMix) {
      mixedCases.push({ input, expected: 'noop', family: 'mixed_natural' })
    }
    while (mixedCases.length < 520) {
      const frame = pick(rng, ARABIC_FRAMES)
      const token = pick(rng, [...TECH_TOKENS, ...UNSEEN_EN.slice(0, 20)])
      mixedCases.push({
        input: `${pick(rng, UNSEEN_AR)} ${frame.replace('TOKEN', token)}`,
        expected: 'noop',
        family: 'mixed_generated',
      })
    }

    const ambiguityCases: Array<{ input: string; expected: 'english_correction' | 'layout_fix' | 'noop'; family: string }> = []
    const knownTypos = ['hwo', 'teh', 'adn', 'taht', 'becuase', 'seperate', 'definately', 'freind', 'wierd', 'recieve']
    for (const typo of knownTypos) {
      ambiguityCases.push({ input: `please ${typo} this`, expected: 'english_correction', family: 'spell_known' })
    }
    const unseenTypos = ['architecure', 'recomendation', 'universety', 'calender', 'passanger', 'bicyle', 'thurdsay', 'compille', 'serialise', 'quantom']
    for (const typo of unseenTypos) {
      ambiguityCases.push({ input: `the ${typo} failed`, expected: 'english_correction', family: 'spell_unseen_should_fix_or_abstain' })
    }
    for (const word of UNSEEN_EN.slice(0, 40)) {
      const mapped = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (mapped) {
        ambiguityCases.push({
          input: `hello ${mapped}`,
          expected: 'layout_fix',
          family: 'ambig_one_wrong_layout_in_english',
        })
      }
    }
    for (const word of IN_LEX_EN.slice(0, 20)) {
      const mapped = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (mapped) {
        ambiguityCases.push({
          input: `مرحبا ${mapped}`,
          expected: 'layout_fix',
          family: 'ambig_one_wrong_layout_in_arabic',
        })
      }
    }
    for (const typo of ['teh', 'hwo', 'adn']) {
      ambiguityCases.push({
        input: `أنا أرسل ${typo} غدا`,
        expected: 'noop',
        family: 'ambig_english_typo_in_arabic',
      })
    }
    while (ambiguityCases.length < 520) {
      const word = pick(rng, UNSEEN_EN)
      const garbled = word.slice(0, 2) + word[3] + word[2] + word.slice(4)
      ambiguityCases.push({
        input: `${pick(rng, ['the', 'this', 'please'])} ${garbled}`,
        expected: 'english_correction',
        family: 'ambig_generated_swap',
      })
    }

    const techCases: Array<{ input: string; expected: 'noop'; family: string }> = []
    for (const token of TECH_TOKENS) {
      techCases.push({ input: token, expected: 'noop', family: 'tech_alone' })
      techCases.push({ input: `please use ${token} today`, expected: 'noop', family: 'tech_in_english' })
      techCases.push({ input: `أريد ${token} الآن`, expected: 'noop', family: 'tech_in_arabic' })
    }
    const extras = [
      'https://flowlary.app/docs?x=1',
      'mailto:test@flowlary.app',
      'C:\\Users\\name\\file.ts',
      'const userId = 12',
      'OAuth2',
      'k8s',
      'i18n',
      'e2e',
      'CI/CD',
      'OK',
      'ID',
      'Ahmed',
      'محمد',
      '12345',
      '$99.00',
      '100%',
      'UI/UX',
      'API-key',
      'v2.0.1-beta',
      'webpack.config.js',
      'fooBarBaz',
      'snake_case_name',
      'SELECT * FROM users',
    ]
    for (const input of extras) techCases.push({ input, expected: 'noop', family: 'tech_protected_or_name' })
    while (techCases.length < 520) {
      const token = pick(rng, TECH_TOKENS)
      techCases.push({
        input: `${pick(rng, UNSEEN_EN)} ${token} ${pick(rng, UNSEEN_AR)}`,
        expected: 'noop',
        family: 'tech_generated_mixed',
      })
    }

    const layoutSplit = splitHoldout(layoutCases, 11)
    const mixedSplit = splitHoldout(mixedCases, 22)
    const ambigSplit = splitHoldout(ambiguityCases, 33)
    const techSplit = splitHoldout(techCases, 44)

    for (const [split, list] of Object.entries(layoutSplit) as Array<[string, typeof layoutCases]>) {
      for (const item of list) record(split, item.family, item.input, item.expected)
    }
    for (const [split, list] of Object.entries(mixedSplit) as Array<[string, typeof mixedCases]>) {
      for (const item of list) record(split, item.family, item.input, item.expected)
    }
    for (const [split, list] of Object.entries(ambigSplit) as Array<[string, typeof ambiguityCases]>) {
      for (const item of list) record(split, item.family, item.input, item.expected)
    }
    for (const [split, list] of Object.entries(techSplit) as Array<[string, typeof techCases]>) {
      for (const item of list) record(split, item.family, item.input, item.expected)
    }

    const critical = [
      { input: mapLayoutText('I will send the report tomorrow', 'en-US-qwerty', 'ar-101')!, expected: 'layout_fix', family: 'critical_en_sentence_on_ar' },
      { input: mapLayoutText('الطقس جميل هذا المساء', 'ar-101', 'en-US-qwerty')!, expected: 'layout_fix', family: 'critical_ar_sentence_on_en' },
      { input: 'أحتاج مراجعة الـ pull request قبل الدمج', expected: 'noop', family: 'critical_ar_intentional_en' },
      { input: 'رفعنا الـ FastAPI service على localhost:8080', expected: 'noop', family: 'critical_ar_technical_en' },
      { input: 'The كلمة العربية is intentional', expected: 'noop', family: 'critical_en_intentional_ar' },
      { input: `please ${mapLayout('report', 'en-US-qwerty', 'ar-101')} this`, expected: 'layout_fix', family: 'critical_one_wrong_word' },
      { input: 'أرسل teh ملف', expected: 'noop', family: 'critical_en_typo_in_ar' },
      { input: 'we use FlowlaryX nightly', expected: 'noop', family: 'critical_unknown_product' },
      { input: mapLayoutText('Hello, world!', 'en-US-qwerty', 'ar-101')!, expected: 'layout_fix', family: 'critical_punct_layout' },
      { input: 'UI ux', expected: 'noop', family: 'critical_caps' },
      { input: 'hello?', expected: 'noop', family: 'critical_shift_symbol' },
    ]
    for (const item of critical) {
      if (item.input) record('holdout', item.family, item.input, item.expected as 'layout_fix' | 'noop')
    }

    const holdout = rows.filter((r) => r.split === 'holdout')
    const summarize = (list: Row[]) => {
      const byFamily: Record<string, { n: number; match: number; fpLayout: number; missLayout: number; fpEnglish: number; autoWrite: number; noop: number }> = {}
      for (const row of list) {
        const bucket = byFamily[row.family] ?? { n: 0, match: 0, fpLayout: 0, missLayout: 0, fpEnglish: 0, autoWrite: 0, noop: 0 }
        bucket.n += 1
        const expectedAction = row.expected === 'preserve' ? 'noop' : row.expected
        if (row.action === expectedAction || (expectedAction === 'noop' && row.action === 'suggestion')) bucket.match += 1
        if (row.action === 'layout_fix' && row.expected !== 'layout_fix') bucket.fpLayout += 1
        if (row.expected === 'layout_fix' && row.action !== 'layout_fix') bucket.missLayout += 1
        if (row.action === 'english_correction' && row.expected !== 'english_correction') bucket.fpEnglish += 1
        if (row.action === 'layout_fix' || row.action === 'english_correction' || row.action === 'translation') bucket.autoWrite += 1
        if (row.action === 'noop') bucket.noop += 1
        byFamily[row.family] = bucket
      }
      return byFamily
    }

    const report = {
      totals: {
        all: rows.length,
        development: rows.filter((r) => r.split === 'development').length,
        validation: rows.filter((r) => r.split === 'validation').length,
        holdout: holdout.length,
        layoutFamily: rows.filter((r) => r.family.startsWith('layout_')).length,
        mixedFamily: rows.filter((r) => r.family.startsWith('mixed_')).length,
        ambigFamily: rows.filter((r) => r.family.startsWith('ambig_') || r.family.startsWith('spell_')).length,
        techFamily: rows.filter((r) => r.family.startsWith('tech_')).length,
      },
      holdoutByFamily: summarize(holdout),
      allByFamily: summarize(rows),
      advisorConsultRate: rows.filter((r) => r.consultAdvisor).length / rows.length,
      deadSequenceLowRiskWhenMissed: holdout.filter((r) => r.expected === 'layout_fix' && r.action !== 'layout_fix' && r.deadSequenceWouldFix).length,
      missedLayoutHoldout: holdout.filter((r) => r.expected === 'layout_fix' && r.action !== 'layout_fix').length,
      falseLayoutHoldout: holdout.filter((r) => r.action === 'layout_fix' && r.expected !== 'layout_fix').length,
      falseEnglishHoldout: holdout.filter((r) => r.action === 'english_correction' && r.expected !== 'english_correction').length,
      critical: rows.filter((r) => r.family.startsWith('critical_')).map((r) => ({
        family: r.family,
        input: r.input,
        expected: r.expected,
        action: r.action,
        replacement: r.replacement,
        reasons: r.reasons,
      })),
      sampleMisses: holdout.filter((r) => r.expected === 'layout_fix' && r.action !== 'layout_fix').slice(0, 12),
    }

    writeFileSync(
      '/Users/moomen/Projects/flowlary/docs/audit/_experiments/holdout-results.json',
      JSON.stringify(report, null, 2),
    )
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report.totals))
    console.log(JSON.stringify({
      missedLayoutHoldout: report.missedLayoutHoldout,
      falseLayoutHoldout: report.falseLayoutHoldout,
      falseEnglishHoldout: report.falseEnglishHoldout,
      advisorConsultRate: report.advisorConsultRate,
      deadSequenceLowRiskWhenMissed: report.deadSequenceLowRiskWhenMissed,
    }))
    console.log(JSON.stringify(report.holdoutByFamily, null, 2))
    console.log(JSON.stringify(report.critical, null, 2))

    expect(report.totals.layoutFamily).toBeGreaterThanOrEqual(1000)
    expect(report.totals.mixedFamily).toBeGreaterThanOrEqual(500)
    expect(report.totals.ambigFamily).toBeGreaterThanOrEqual(500)
    expect(report.totals.techFamily).toBeGreaterThanOrEqual(500)
    expect(report.totals.holdout).toBeGreaterThan(400)
  })
})
