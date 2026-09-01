/**
 * Evaluation-only corpus for LLM provider architecture audit.
 * Not imported by production. Seed 20261015 — disjoint from prior holdouts.
 */
import { isEnglishWord } from '../../../extension/src/features/layout/layouts/lexicons/en-words.ts'
import { isArabicWord } from '../../../extension/src/features/layout/layouts/lexicons/ar-words.ts'
import { mapLayout, mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'

export type ArchGold = 'layout_fix' | 'preserve' | 'fix_english' | 'unknown'
export type ArchFamily =
  | 'layout'
  | 'spelling_layout'
  | 'mixed'
  | 'technical'
  | 'short'
  | 'punctuation'
  | 'contextual'
export type ArchSplit = 'development' | 'validation' | 'holdout'

export type ArchCase = {
  id: string
  family: ArchFamily
  split: ArchSplit
  input: string
  gold: ArchGold
}

export const ARCH_EVAL_SEED = 20261015

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

function splitOf(rng: () => number): ArchSplit {
  const n = rng()
  if (n < 0.5) return 'development'
  if (n < 0.75) return 'validation'
  return 'holdout'
}

/** Unseen vs prior seeds (architecture/notebook/مظلة families). */
const UNSEEN_EN = `
willow fennel paprika turmeric saffron basil oregano thyme
kiln anvil lathe pulley gasket turbine impeller stator
fjord tundra prairie chaparral mangrove estuary lagoon
satchel parasol lanyard visor goggles earmuff gaiter
sonar radar lidar sonar buoy beacon compass sextant
quorum caucus ledger payroll stipend bursary stipend
`.trim().split(/\s+/).filter((w) => w.length >= 4 && !isEnglishWord(w))

const UNSEEN_AR = `
صفصاف شمر كركم زعفران ريحان زعتر
سندان بكرة حشية توربين دفاعة ساكن
فيورد تندرا براري مستنقع مصب بحيرة
حقيبة مظلة حبل واقي نظارة سداد
سونار رادار عوامة منارة بوصلة
نصاب لجنة دفتر رواتب منحة
`.trim().split(/\s+/).filter((w) => w.length >= 3 && !isArabicWord(w))

const LEX_EN = `
hello please thanks today tomorrow project working message
meeting ready update language keyboard layout English
`.trim().split(/\s+/).filter((w) => isEnglishWord(w) && w.length >= 4)

const LEX_AR = `
مرحبا شكرا اليوم المشروع يعمل اللغة التصميم المستخدم يمكن
`.trim().split(/\s+/).filter((w) => isArabicWord(w) && w.length >= 3)

const TECH = [
  'ingressId', 'chartRev', 'svc.probe', 'v0.9.12', 'route.ts',
  'https://status.example.org/health', 'ops+oncall@example.net',
  'OIDC', 'protobuf', 'avro', 'Cargo.lock', 'cmd/main.go',
  'FastAPI', 'webhook_secret', 'X-Request-Id',
]

const MIX_FRAMES = [
  'سأراجع TOKEN بعد الاجتماع',
  'هل TOKEN جاهز للتجربة؟',
  'استخدمنا TOKEN في البناء',
  'TOKEN موجود في السجلات',
  'أرسل TOKEN إلى الزملاء',
  'أحتاج TOKEN قبل الدمج',
]

const CONTEXT_AR_FRAMES = [
  'أريد إرسال التقرير إلى الفريق اليوم',
  'هل يمكن مراجعة التصميم قبل الغد',
  'المستخدم يمكنه تحديث اللغة من الإعدادات',
]

const CONTEXT_EN_FRAMES = [
  'please send the update after the meeting',
  'the project is ready for tomorrow',
  'working on the English layout today',
]

export function generateArchitectureCorpus(seed = ARCH_EVAL_SEED): ArchCase[] {
  const rng = mulberry32(seed)
  const en = UNSEEN_EN.length ? UNSEEN_EN : LEX_EN
  const ar = UNSEEN_AR.length ? UNSEEN_AR : LEX_AR
  const enLex = LEX_EN.length ? LEX_EN : en
  const arLex = LEX_AR.length ? LEX_AR : ar
  const out: ArchCase[] = []
  let n = 0
  const push = (family: ArchFamily, input: string, gold: ArchGold) => {
    out.push({ id: `${family}-${n++}`, family, split: splitOf(rng), input, gold })
  }

  while (out.filter((item) => item.family === 'layout').length < 1000) {
    if (rng() < 0.5) {
      const intended = `${pick(rng, en)} ${pick(rng, en)} ${pick(rng, enLex)}`
      const typed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== intended) push('layout', typed, 'layout_fix')
    } else {
      const intended = `${pick(rng, ar)} ${pick(rng, ar)} ${pick(rng, arLex)}`
      const typed = mapLayoutText(intended, 'ar-101', 'en-US-qwerty')
      if (typed && typed !== intended) push('layout', typed, 'layout_fix')
    }
  }

  while (out.filter((item) => item.family === 'spelling_layout').length < 750) {
    if (rng() < 0.5) {
      const word = pick(rng, en)
      const noisy = word.slice(0, -1) + (word.endsWith('y') ? 'i' : 'e')
      push('spelling_layout', `please ${noisy} later`, 'fix_english')
    } else {
      const word = pick(rng, enLex)
      const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== word) push('spelling_layout', `please ${typed} later`, 'layout_fix')
    }
  }

  while (out.filter((item) => item.family === 'mixed').length < 750) {
    push('mixed', pick(rng, MIX_FRAMES).replace('TOKEN', pick(rng, TECH)), 'preserve')
  }

  while (out.filter((item) => item.family === 'technical').length < 500) {
    const token = pick(rng, TECH)
    if (rng() < 0.5) push('technical', `see ${token}`, 'preserve')
    else push('technical', pick(rng, MIX_FRAMES).replace('TOKEN', token), 'preserve')
  }

  const shorts = ['go', 'to', 'in', 'ok', 'id', 'من', 'يا', 'في', 'لا', 'hi']
  while (out.filter((item) => item.family === 'short').length < 500) {
    push('short', pick(rng, shorts), 'unknown')
  }

  const marks = ['!', '?', '.', ',', ':', '...', ';']
  while (out.filter((item) => item.family === 'punctuation').length < 500) {
    if (rng() < 0.2) push('punctuation', `${pick(rng, marks)}${pick(rng, marks)}`, 'preserve')
    else {
      const intended = `${pick(rng, enLex)} ${pick(rng, enLex)}${pick(rng, marks)}`
      const typed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== intended) push('punctuation', typed, 'layout_fix')
    }
  }

  while (out.filter((item) => item.family === 'contextual').length < 500) {
    if (rng() < 0.34) {
      push('contextual', pick(rng, CONTEXT_AR_FRAMES), 'preserve')
    } else if (rng() < 0.5) {
      const intended = pick(rng, CONTEXT_EN_FRAMES)
      const typed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== intended) push('contextual', typed, 'layout_fix')
    } else {
      const ar = pick(rng, CONTEXT_AR_FRAMES)
      const token = pick(rng, TECH)
      push('contextual', `${ar} ${token}`, 'preserve')
    }
  }

  return out
}
