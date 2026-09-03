import { buildLayoutExamples, repairLayoutText } from '../../lib/layoutDemo.ts'

export type FeatureMode = 'correction' | 'translation' | 'live' | 'layout' | 'speedbox'

export type CorrectionExample = {
  id: string
  input: string
  output: string
  /** Substrings to highlight as errors before fix / as corrections after */
  changes: { wrong: string; fixed: string }[]
}

export type TranslationExample = {
  id: string
  from: 'ar' | 'en'
  to: 'ar' | 'en'
  input: string
  output: string
}

export type LayoutExample = {
  id: string
  wrong: string
  detected: string
  corrected: string
}

export type SpeedBoxExample = {
  id: string
  input: string
  from: 'ar' | 'en'
  to: 'ar' | 'en'
  output: string
}

export const CORRECTION_EXAMPLES: CorrectionExample[] = [
  {
    id: 'grammar',
    input: 'I want send the invoice today.',
    output: 'I want to send the invoice today.',
    changes: [{ wrong: 'send', fixed: 'to send' }],
  },
  {
    id: 'project',
    input:
      'I has been working on this project for three month and I dont know if its ready yet.',
    output:
      "I have been working on this project for three months, and I don't know if it's ready yet.",
    changes: [
      { wrong: 'has', fixed: 'have' },
      { wrong: 'month', fixed: 'months,' },
      { wrong: 'dont', fixed: "don't" },
      { wrong: 'its', fixed: "it's" },
    ],
  },
  {
    id: 'message',
    input: 'I recieved the mesage yesterday',
    output: 'I received the message yesterday.',
    changes: [
      { wrong: 'recieved', fixed: 'received' },
      { wrong: 'mesage', fixed: 'message' },
    ],
  },
  {
    id: 'meeting',
    input: 'We was planning to send the report tomorow',
    output: 'We were planning to send the report tomorrow.',
    changes: [
      { wrong: 'was', fixed: 'were' },
      { wrong: 'tomorow', fixed: 'tomorrow.' },
    ],
  },
]

export const TRANSLATION_EXAMPLES: TranslationExample[] = [
  {
    id: 'invoice-ar-en',
    from: 'ar',
    to: 'en',
    input: 'أريد إرسال الفاتورة اليوم.',
    output: 'I want to send the invoice today.',
  },
  {
    id: 'updates-ar-en',
    from: 'ar',
    to: 'en',
    input: 'مرحباً، أعمل على مشروع جديد وأريد أن أشارككم التحديثات قريباً.',
    output: "Hello, I'm working on a new project and I want to share the updates with you soon.",
  },
  {
    id: 'greeting-ar-en',
    from: 'ar',
    to: 'en',
    input: 'كيف حالك اليوم؟',
    output: 'How are you today?',
  },
  {
    id: 'document-en-ar',
    from: 'en',
    to: 'ar',
    input: 'Can you send me the document tomorrow?',
    output: 'هل يمكنك إرسال المستند غداً؟',
  },
]

export const LIVE_EXAMPLE = {
  input: 'Can you send me the document tomorrow?',
  output: 'هل يمكنك إرسال المستند غداً؟',
}

/** Layout examples derived from the real extension keyboard engine. */
export const LAYOUT_EXAMPLES: LayoutExample[] = buildLayoutExamples().map((ex) => ({
  id: ex.id,
  wrong: ex.typed,
  detected: ex.detectedLayout,
  corrected: ex.intended,
}))

export const SPEEDBOX_EXAMPLES: SpeedBoxExample[] = LAYOUT_EXAMPLES.slice(0, 4).map((ex) => ({
  id: ex.id,
  input: ex.wrong,
  from: 'en' as const,
  to: 'ar' as const,
  output: ex.corrected,
}))

export function findCorrectionExample(text: string): CorrectionExample | undefined {
  const normalized = text.trim()
  return CORRECTION_EXAMPLES.find((ex) => ex.input.trim() === normalized)
}

export function findTranslationExample(
  text: string,
  from: 'ar' | 'en',
  to: 'ar' | 'en',
): TranslationExample | undefined {
  const normalized = text.trim()
  return TRANSLATION_EXAMPLES.find(
    (ex) => ex.input.trim() === normalized && ex.from === from && ex.to === to,
  )
}

export function findLayoutExample(text: string): LayoutExample | undefined {
  const normalized = text.trim()
  const known = LAYOUT_EXAMPLES.find((ex) => ex.wrong.trim() === normalized)
  if (known) return known

  const repaired = repairLayoutText(normalized)
  if (repaired !== normalized) {
    return {
      id: 'dynamic',
      wrong: normalized,
      detected: 'English keyboard layout',
      corrected: repaired,
    }
  }
  return undefined
}

export function findSpeedBoxExample(
  text: string,
  from: 'ar' | 'en',
  to: 'ar' | 'en',
): SpeedBoxExample | undefined {
  const normalized = text.trim()
  return SPEEDBOX_EXAMPLES.find(
    (ex) => ex.input.trim() === normalized && ex.from === from && ex.to === to,
  )
}

/** Progressive live translation: reveal output chars as input grows */
export function liveTranslationProgress(input: string, source: string, target: string): string {
  if (!input) return ''
  const ratio = Math.min(1, input.length / source.length)
  const len = Math.floor(target.length * ratio)
  return target.slice(0, len)
}
