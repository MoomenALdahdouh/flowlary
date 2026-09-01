/**
 * TEST-ONLY Phase 5 gpt-oss-20b shadow corpus. Not imported by production.
 * Seed 20261107 — disjoint from Allam live-eval (20260901) and architecture audit (20261015).
 */
import { mapLayout, mapLayoutText } from '../../../../extension/src/features/layout/layouts/registry.ts'
import { isEnglishWord } from '../../../../extension/src/features/layout/layouts/lexicons/en-words.ts'
import { isArabicWord } from '../../../../extension/src/features/layout/layouts/lexicons/ar-words.ts'

export type OssGold = 'layout_fix' | 'preserve' | 'fix_english' | 'unknown'
export type OssFamily =
  | 'layout'
  | 'mixed'
  | 'spelling'
  | 'technical'
  | 'punctuation'
  | 'short'
export type OssSplit = 'development' | 'validation' | 'holdout'

export type OssCase = {
  id: string
  family: OssFamily
  split: OssSplit
  input: string
  gold: OssGold
}

export const GPT_OSS_SHADOW_SEED = 20261107

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

function splitOf(rng: () => number): OssSplit {
  const n = rng()
  if (n < 0.5) return 'development'
  if (n < 0.75) return 'validation'
  return 'holdout'
}

const UNSEEN_EN = `
anvil bellows kiln forge slag ingot crucible tuyere
fjord skerry islet atoll cay reef shoal lagoon
satchel knapsack rucksack valise trunk duffel satchel
quorum caucus roster payroll bursary stipend ledger
sonar lidar radar buoy beacon sextant compass gyro
paprika turmeric saffron fennel oregano thyme basil
`.trim().split(/\s+/).filter((w) => w.length >= 4 && !isEnglishWord(w))

const UNSEEN_AR = `
سندان كير فرن خبث سبيكة بوتقة
فيورد جزيرة شعاب بحيرة عوامة
حقيبة حقيبتان رواتب منحة دفتر
سونار رادار منارة بوصلة جيروسكوب
كركم زعفران شمر ريحان زعتر
`.trim().split(/\s+/).filter((w) => w.length >= 3 && !isArabicWord(w))

const LEX_EN = `
hello please thanks today tomorrow project working message
meeting ready update language keyboard layout English
`.trim().split(/\s+/).filter((w) => isEnglishWord(w) && w.length >= 4)

const LEX_AR = `
مرحبا شكرا اليوم المشروع يعمل اللغة التصميم المستخدم يمكن
`.trim().split(/\s+/).filter((w) => isArabicWord(w) && w.length >= 3)

const TECH = [
  'spanId', 'traceParent', 'svc.ready', 'v1.8.0', 'healthz.ts',
  'https://status.example.org/live', 'sre+page@example.net',
  'OIDC', 'protobuf', 'avro', 'go.mod', 'cmd/root.go',
]

const FRAMES = [
  'سأراجع TOKEN بعد الاجتماع',
  'هل TOKEN جاهز للتجربة؟',
  'استخدمنا TOKEN في البناء',
  'TOKEN موجود في السجلات',
  'أرسل TOKEN إلى الزملاء',
]

export function generateGptOssShadowCorpus(seed = GPT_OSS_SHADOW_SEED): OssCase[] {
  const rng = mulberry32(seed)
  const en = UNSEEN_EN.length ? UNSEEN_EN : LEX_EN
  const ar = UNSEEN_AR.length ? UNSEEN_AR : LEX_AR
  const enLex = LEX_EN.length ? LEX_EN : en
  const arLex = LEX_AR.length ? LEX_AR : ar
  const out: OssCase[] = []
  let n = 0
  const push = (family: OssFamily, input: string, gold: OssGold) => {
    out.push({ id: `${family}-${n++}`, family, split: splitOf(rng), input, gold })
  }

  while (out.filter((item) => item.family === 'layout').length < 2000) {
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

  while (out.filter((item) => item.family === 'mixed').length < 1000) {
    push('mixed', pick(rng, FRAMES).replace('TOKEN', pick(rng, TECH)), 'preserve')
  }

  while (out.filter((item) => item.family === 'spelling').length < 1000) {
    if (rng() < 0.5) {
      const word = pick(rng, en)
      const noisy = word.slice(0, -1) + (word.endsWith('y') ? 'i' : 'e')
      push('spelling', `please ${noisy} later`, 'fix_english')
    } else {
      const word = pick(rng, enLex)
      const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== word) push('spelling', `please ${typed} later`, 'layout_fix')
    }
  }

  while (out.filter((item) => item.family === 'technical').length < 500) {
    const token = pick(rng, TECH)
    if (rng() < 0.5) push('technical', `see ${token}`, 'preserve')
    else push('technical', pick(rng, FRAMES).replace('TOKEN', token), 'preserve')
  }

  const marks = ['!', '?', '.', ',', ':', '...']
  while (out.filter((item) => item.family === 'punctuation').length < 500) {
    if (rng() < 0.2) push('punctuation', `${pick(rng, marks)}${pick(rng, marks)}`, 'preserve')
    else {
      const intended = `${pick(rng, enLex)} ${pick(rng, enLex)}${pick(rng, marks)}`
      const typed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== intended) push('punctuation', typed, 'layout_fix')
    }
  }

  const shorts = ['go', 'to', 'in', 'ok', 'id', 'من', 'يا', 'في']
  while (out.filter((item) => item.family === 'short').length < 500) {
    push('short', pick(rng, shorts), 'unknown')
  }

  return out
}
