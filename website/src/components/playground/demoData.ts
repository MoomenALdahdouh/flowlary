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

export const LAYOUT_EXAMPLES: LayoutExample[] = [
  {
    id: 'greeting',
    wrong: 'jkhg ;d hgl,kh',
    detected: 'Typed as English (US)',
    corrected: 'سلام يا صديقي',
  },
  {
    id: 'hello',
    wrong: 'lvpfh',
    detected: 'Typed as English (US)',
    corrected: 'مرحبا',
  },
  {
    id: 'thanks',
    wrong: 'hguvhr',
    detected: 'Typed as English (US)',
    corrected: 'أشكرك',
  },
]

export const SPEEDBOX_EXAMPLES: SpeedBoxExample[] = [
  { id: 'hello', input: 'hgld', from: 'en', to: 'ar', output: 'مرحبا' },
  { id: 'thanks', input: 'hguvhr', from: 'en', to: 'ar', output: 'أشكرك' },
  { id: 'friend', input: 'hgl,kh', from: 'en', to: 'ar', output: 'صديقي' },
]

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
  return LAYOUT_EXAMPLES.find((ex) => ex.wrong.trim() === normalized)
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
