/**
 * TEST-ONLY unseen live-eval corpus. Not imported by production.
 * Different seed and vocab from Hypothesis Generation V2 / advisor holdouts.
 */
import { mapLayout, mapLayoutText } from '../../../../extension/src/features/layout/layouts/registry.ts'
import { isEnglishWord } from '../../../../extension/src/features/layout/layouts/lexicons/en-words.ts'
import { isArabicWord } from '../../../../extension/src/features/layout/layouts/lexicons/ar-words.ts'

export type LiveGold = 'layout_fix' | 'preserve' | 'fix_english' | 'unknown'
export type LiveFamily =
  | 'layout'
  | 'mixed'
  | 'spelling'
  | 'technical'
  | 'punctuation'
  | 'short'
export type LiveSplit = 'development' | 'validation' | 'holdout'

export type LiveCase = {
  id: string
  family: LiveFamily
  split: LiveSplit
  input: string
  gold: LiveGold
}

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

function splitOf(rng: () => number): LiveSplit {
  const n = rng()
  if (n < 0.5) return 'development'
  if (n < 0.75) return 'validation'
  return 'holdout'
}

const UNSEEN_EN = `
notebook lantern harvest meadow canyon glacier harbor orchard
pottery lanterns thunder blossom canyon terrace vineyard harvest
velvet marble copper nickel cobalt quartz granite marble
gently firmly loosely tightly rarely seldom always never
forecast rainfall thunder lightning sunrise sunset twilight
semester faculty campus lecture seminar workshop thesis
`.trim().split(/\s+/).filter((w) => w.length >= 4 && !isEnglishWord(w))

const UNSEEN_AR = `
مظلة حديقة شرفة نافذة ستارة مرآب مطبخ دراجة
برتقال مانجو خوخ مشمش رمان تين سفرجل
خريف شتاء ربيع صيف صباح مساء فجر غروب
محاضرة كلية حرم ورشة أطروحة فصل دراسي
`.trim().split(/\s+/).filter((w) => w.length >= 3 && !isArabicWord(w))

const LEX_EN = `
hello please thanks today tomorrow project working message
meeting ready update language keyboard layout English
`.trim().split(/\s+/).filter((w) => isEnglishWord(w) && w.length >= 4)

const LEX_AR = `
مرحبا شكرا اليوم المشروع يعمل اللغة التصميم المستخدم يمكن
`.trim().split(/\s+/).filter((w) => isArabicWord(w) && w.length >= 3)

const TECH = [
  'webhookId', 'buildSha', 'repo.clone', 'v3.1.4', 'index.html',
  'https://docs.example.net/ref', 'ops+qa@example.net',
  'OAuth2', 'yaml', 'toml', 'cargo.toml', 'src/main.rs',
]

const FRAMES = [
  'سأراجع TOKEN بعد الظهر',
  'هل TOKEN جاهز للنشر؟',
  'استخدمنا TOKEN في التجربة',
  'TOKEN موجود في السجل',
  'أرسل TOKEN إلى الفريق',
]

export function generateLiveShadowCorpus(seed = 20260901): LiveCase[] {
  const rng = mulberry32(seed)
  const en = UNSEEN_EN.length ? UNSEEN_EN : LEX_EN
  const ar = UNSEEN_AR.length ? UNSEEN_AR : LEX_AR
  const enLex = LEX_EN.length ? LEX_EN : en
  const arLex = LEX_AR.length ? LEX_AR : ar
  const out: LiveCase[] = []
  let n = 0
  const push = (family: LiveFamily, input: string, gold: LiveGold) => {
    out.push({ id: `${family}-${n++}`, family, split: splitOf(rng), input, gold })
  }

  for (let i = 0; i < 2000; i += 1) {
    if (i % 2 === 0) {
      const intended = `${pick(rng, en)} ${pick(rng, en)} ${pick(rng, enLex)}`
      const typed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')
      if (typed && typed !== intended) push('layout', typed, 'layout_fix')
    } else {
      const intended = `${pick(rng, ar)} ${pick(rng, ar)} ${pick(rng, arLex)}`
      const typed = mapLayoutText(intended, 'ar-101', 'en-US-qwerty')
      if (typed && typed !== intended) push('layout', typed, 'layout_fix')
    }
  }
  while (out.filter((item) => item.family === 'layout').length < 2000) {
    const word = pick(rng, en)
    const extra = pick(rng, enLex)
    const typed = `${mapLayout(word, 'en-US-qwerty', 'ar-101') ?? word} ${mapLayout(extra, 'en-US-qwerty', 'ar-101') ?? extra}`
    push('layout', typed, 'layout_fix')
  }

  for (let i = 0; i < 1000; i += 1) {
    push('mixed', pick(rng, FRAMES).replace('TOKEN', pick(rng, TECH)), 'preserve')
  }

  for (let i = 0; i < 1000; i += 1) {
    if (i % 2 === 0) {
      const word = pick(rng, en)
      const noisy = word.slice(0, -1) + (word.endsWith('y') ? 'i' : 'y')
      push('spelling', `please ${noisy} later`, 'fix_english')
    } else {
      const word = pick(rng, enLex)
      const typed = mapLayout(word, 'en-US-qwerty', 'ar-101')
      if (typed) push('spelling', `please ${typed} later`, 'layout_fix')
    }
  }

  for (let i = 0; i < 500; i += 1) {
    const token = pick(rng, TECH)
    if (i % 2 === 0) push('technical', `see ${token}`, 'preserve')
    else push('technical', pick(rng, FRAMES).replace('TOKEN', token), 'preserve')
  }

  const marks = ['!', '?', '.', ',', ':', '...']
  for (let i = 0; i < 500; i += 1) {
    if (i % 5 === 0) push('punctuation', `${pick(rng, marks)} ${pick(rng, marks)}`, 'preserve')
    else {
      const intended = `${pick(rng, enLex)} ${pick(rng, enLex)}${pick(rng, marks)}`
      const typed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')
      if (typed) push('punctuation', typed, 'layout_fix')
    }
  }

  const shorts = ['go', 'to', 'in', 'a', 'من', 'يا', 'في', 'ok']
  for (let i = 0; i < 500; i += 1) {
    push('short', pick(rng, shorts), 'unknown')
  }

  return out
}
