/**
 * TEST-ONLY corpus generator. Must never be imported by production code.
 */
import { mapLayoutText } from '../../../../extension/src/features/layout/layouts/registry.ts'
import { englishLexiconCandidates } from '../../../../extension/src/features/layout/layouts/lexicons/en-words.ts'

export type GeneratedSplit = 'dev' | 'validation' | 'holdout'
export type GeneratedFamily =
  | 'layout'
  | 'mixed'
  | 'ambiguity'
  | 'punctuation'
  | 'spelling_vs_layout'
  | 'adversarial'

export type GeneratedCase = {
  id: string
  split: GeneratedSplit
  family: GeneratedFamily
  observed: string
  intended: string
  expect: 'layout_fix' | 'noop' | 'english_correction' | 'preserve'
}

const AR_SUBJECT = [
  'المستخدم', 'الفريق', 'المشروع', 'الملف', 'التقرير', 'الكتاب',
  'الرسالة', 'الصفحة', 'الاجتماع', 'الطالب', 'البرنامج', 'الخدمة',
]
const AR_VERB = [
  'يحتاج', 'يريد', 'يفتح', 'يحفظ', 'يرسل', 'يقرأ', 'يكتب', 'يراجع',
  'يستخدم', 'يبدأ',
]
const AR_OBJECT = [
  'اليوم', 'غدا', 'الآن', 'هنا', 'هناك', 'بسرعة', 'لاحقا', 'جيدا',
]
const AR_SENT = [
  'هذا العمل مهم جدا',
  'من فضلك افتح الملف الآن',
  'هل يمكن إرسال التقرير غدا',
  'كانت النتيجة واضحة للجميع',
  'أريد مراجعة النص قبل الإرسال',
  'الكتاب على الطاولة قرب النافذة',
  'شكرا جزيلا على المساعدة اليوم',
  'أين يوجد المكتب الجديد',
  'متى يبدأ الاجتماع الصباحي',
  'لم أجد الرسالة في الصندوق',
]
const EN_SUBJECT = [
  'the team', 'this file', 'the report', 'our page',
  'the test', 'the user', 'the meeting', 'the project',
]
const EN_VERB = [
  'needs', 'wants', 'opens', 'saves', 'sends', 'reads', 'writes', 'starts',
]
const EN_TAIL = [
  'today', 'now', 'later', 'again', 'here', 'there', 'soon', 'please',
]
const EN_SENT = [
  'please send the file today',
  'the team wants a small change',
  'this report looks good now',
  'can you open the page later',
  'we need to start the test',
  'save the work before you leave',
  'thanks for the help today',
  'the meeting starts after lunch',
]

function hash32(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function assignSplit(id: string): GeneratedSplit {
  const bucket = hash32(id) % 10
  if (bucket === 0) return 'holdout'
  if (bucket === 1) return 'validation'
  return 'dev'
}

function toLatinFromArabic(text: string): string {
  return mapLayoutText(text, 'ar-101', 'en-US-qwerty') ?? text
}

function toArabicFromEnglish(text: string): string {
  return mapLayoutText(text, 'en-US-qwerty', 'ar-101') ?? text
}

function push(
  out: GeneratedCase[],
  family: GeneratedFamily,
  observed: string,
  intended: string,
  expect: GeneratedCase['expect'],
  tag: string,
): void {
  const id = `${family}:${tag}:${hash32(`${observed}|${intended}`).toString(16)}`
  out.push({ id, split: assignSplit(id), family, observed, intended, expect })
}

function transpose(word: string): string | null {
  if (word.length < 4) return null
  const chars = [...word]
  const i = 1
  const tmp = chars[i]!
  chars[i] = chars[i + 1]!
  chars[i + 1] = tmp
  const next = chars.join('')
  return next === word ? null : next
}

export function generateGeneralizationCorpus(): GeneratedCase[] {
  const out: GeneratedCase[] = []

  for (const subject of AR_SUBJECT) {
    for (const verb of AR_VERB) {
      for (const object of AR_OBJECT) {
        const intended = `${subject} ${verb} ${object}`
        push(out, 'layout', toLatinFromArabic(intended), intended, 'layout_fix', 'ar-en-triple')
      }
    }
  }

  for (const [index, sentence] of AR_SENT.entries()) {
    push(out, 'layout', toLatinFromArabic(sentence), sentence, 'layout_fix', `ar-sent-${index}`)
    push(out, 'punctuation', `${toLatinFromArabic(sentence)}?`, `${sentence}?`, 'layout_fix', `ar-q-${index}`)
    push(out, 'punctuation', `${toLatinFromArabic(sentence)}.`, `${sentence}.`, 'layout_fix', `ar-dot-${index}`)
    push(out, 'punctuation', toLatinFromArabic(`${sentence}،`), `${sentence}،`, 'layout_fix', `ar-comma-${index}`)
  }

  for (const subject of EN_SUBJECT) {
    for (const verb of EN_VERB) {
      for (const tail of EN_TAIL) {
        const intended = `${subject} ${verb} ${tail}`
        push(out, 'layout', toArabicFromEnglish(intended), intended, 'layout_fix', 'en-ar-triple')
      }
    }
  }

  for (const [index, sentence] of EN_SENT.entries()) {
    push(out, 'layout', toArabicFromEnglish(sentence), sentence, 'layout_fix', `en-sent-${index}`)
    push(out, 'punctuation', `${toArabicFromEnglish(sentence)}!`, `${sentence}!`, 'layout_fix', `en-bang-${index}`)
    push(out, 'punctuation', toArabicFromEnglish(sentence.toUpperCase()), sentence.toUpperCase(), 'layout_fix', `en-caps-${index}`)
  }

  let mix = 0
  for (const subject of AR_SUBJECT) {
    for (const object of AR_OBJECT) {
      const ident = `Tool${(mix % 26) + 1}`
      const intended = `${subject} ${ident} ${object}`
      push(out, 'mixed', intended, intended, 'preserve', `mix-ident-${mix}`)
      const url = `https://ex${mix % 9}.test/x`
      push(out, 'mixed', `${subject} ${url} ${object}`, `${subject} ${url} ${object}`, 'preserve', `mix-url-${mix}`)
      push(out, 'mixed', `${subject} 42 ${object}`, `${subject} 42 ${object}`, 'preserve', `mix-num-${mix}`)
      const latinClause = EN_TAIL[mix % EN_TAIL.length]!
      push(out, 'mixed', `${subject} ${latinClause} ${object}`, `${subject} ${latinClause} ${object}`, 'preserve', `mix-en-${mix}`)
      const oneWrong = `${subject} ${toLatinFromArabic(object)}`
      push(out, 'mixed', oneWrong, `${subject} ${object}`, 'layout_fix', `mix-one-${mix}`)
      mix += 1
    }
  }

  const punctMarks = ['!', '?', '.', '،', '؟', ':', '...', '"', ')']
  for (const subject of AR_SUBJECT) {
    for (const object of AR_OBJECT) {
      for (const mark of punctMarks) {
        const intended = `${subject} ${object}${mark}`
        push(out, 'punctuation', toLatinFromArabic(intended), intended, 'layout_fix', `ar-punct-${mark}`)
      }
    }
  }
  for (const subject of EN_SUBJECT) {
    for (const tail of EN_TAIL) {
      for (const mark of ['!', '?', '.', ',', ':']) {
        const intended = `${subject} ${tail}${mark}`
        push(out, 'punctuation', toArabicFromEnglish(intended), intended, 'layout_fix', `en-punct-${mark}`)
      }
    }
  }
  const symbolOnly = ['+++', '***', '===', '---', '(((', ')))', '@@@', '###']
  for (const [index, observed] of symbolOnly.entries()) {
    push(out, 'punctuation', observed, observed, 'noop', `sym-only-${index}`)
  }

  let amb = 0
  for (const word of englishLexiconCandidates()) {
    if (word.length < 4 || word.length > 8) continue
    if (amb >= 250) break
    push(out, 'ambiguity', word, word, 'noop', `en-known-${amb}`)
    amb += 1
  }
  for (const word of AR_SUBJECT) {
    push(out, 'ambiguity', word, word, 'noop', `ar-known-${word}`)
  }
  for (let extra = 0; extra < 220; extra += 1) {
    const intended = `${EN_SUBJECT[extra % EN_SUBJECT.length]} ${EN_TAIL[extra % EN_TAIL.length]}`
    push(out, 'ambiguity', intended, intended, 'noop', `en-phrase-${extra}`)
  }
  const names = ['Ahmed', 'Sara', 'Omar', 'Lina', 'Nour', 'Yara', 'Hadi', 'Mona']
  for (const name of names) {
    push(out, 'ambiguity', name, name, 'noop', `name-${name}`)
    push(out, 'ambiguity', `${name} ${AR_OBJECT[0]}`, `${name} ${AR_OBJECT[0]}`, 'preserve', `name-mix-${name}`)
  }
  const codes = ['userName', 'GET /v1', 'const x', 'file_id', 'v2.0.1', 'OK']
  for (const code of codes) {
    push(out, 'ambiguity', code, code, 'preserve', `code-${code}`)
  }

  let spell = 0
  for (const word of englishLexiconCandidates()) {
    if (word.length < 5) continue
    const noisy = transpose(word)
    if (!noisy) continue
    push(out, 'spelling_vs_layout', `${word.slice(0, 0)}please ${noisy}`, `please ${word}`, 'english_correction', `spell-${spell}`)
    push(out, 'spelling_vs_layout', toArabicFromEnglish(word), word, 'layout_fix', `spell-layout-${spell}`)
    spell += 1
    if (spell >= 260) break
  }

  const rand = (seed: number) => {
    let s = seed
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s
    }
  }
  const next = rand(20260831)
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  for (let i = 0; i < 180; i += 1) {
    const len = 5 + (next() % 4)
    let token = ''
    for (let j = 0; j < len; j += 1) token += alphabet[next() % alphabet.length]
    push(out, 'adversarial', token, token, 'noop', `rand-en-${i}`)
  }
  const arLetters = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
  for (let i = 0; i < 120; i += 1) {
    const len = 4 + (next() % 4)
    let token = ''
    for (let j = 0; j < len; j += 1) token += arLetters[next() % arLetters.length]
    push(out, 'adversarial', token, token, 'noop', `rand-ar-${i}`)
  }
  const arabiziNoise = ['7abib', '3alam', '5abr', '9alb', 'yalla7', 'kee3']
  for (const token of arabiziNoise) {
    push(out, 'adversarial', token, token, 'noop', `arabizi-${token}`)
  }

  return out
}

export function corpusStats(cases: GeneratedCase[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of cases) {
    counts[`family:${item.family}`] = (counts[`family:${item.family}`] ?? 0) + 1
    counts[`split:${item.split}`] = (counts[`split:${item.split}`] ?? 0) + 1
    counts[`expect:${item.expect}`] = (counts[`expect:${item.expect}`] ?? 0) + 1
  }
  counts.total = cases.length
  return counts
}
