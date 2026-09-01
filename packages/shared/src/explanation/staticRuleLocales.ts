import type { UiLocaleCode } from '../uiLocales.ts'
import type { RuleExplanation } from './index.ts'
import { applyLocalizedPresentation, type LocalizedPresentationFields } from './localizePresentation.ts'

/** Deterministic trusted-rule presentation copy — no Groq. */
export const STATIC_TRUSTED_RULE_LOCALES: Record<
  string,
  Partial<Record<UiLocaleCode, LocalizedPresentationFields>>
> = {
  'english.spelling.receive_ie_ei': {
    ar: {
      ruleTitle: 'تهجئة receive',
      summary: "الفعل 'receive' يُكتب بحرفي 'ei' بعد حرف c، وليس 'ie'.",
      why: 'هذا نمط إملائي شائع في الإنجليزية لكلمة receive و derivatives مثل receiver.',
    },
    tr: {
      ruleTitle: 'Receive yazımı',
      summary: "'Receive' fiili c harfinden sonra 'ie' değil 'ei' ile yazılır.",
      why: "Bu, 'receive' ve 'receiver' gibi kelimeler için yaygın bir İngilizce yazım kalıbıdır.",
    },
  },
  'english.spelling.definitely_not_a': {
    ar: {
      ruleTitle: 'تهجئة definitely',
      summary: "الظرف 'definitely' يُكتب بـ 'itely' وليس 'ately'.",
      why: "الصيغة '-itely' هي الشكل المعياري في الإنجليزية الكتابية لهذه الكلمة.",
    },
    tr: {
      ruleTitle: 'Definitely yazımı',
      summary: "'Definitely' zarfı 'ately' değil 'itely' ile yazılır.",
      why: "İngilizcede bu kelime için standart yazılı biçim '-itely' sonekidir.",
    },
  },
  'english.spelling.separate_not_er': {
    ar: {
      ruleTitle: 'تهجئة separate',
      summary: "كلمة 'separate' تُكتب بـ 'para' في الوسط وليس 'pera'.",
      why: 'هذا الإملاء ثابت في الإنجليزية الكتابية المعيارية.',
    },
    tr: {
      ruleTitle: 'Separate yazımı',
      summary: "'Separate' kelimesi ortada 'pera' değil 'para' ile yazılır.",
      why: 'Bu yazım standart yazılı İngilizcede sabittir.',
    },
  },
  'english.spelling.their_not_ie': {
    ar: {
      ruleTitle: 'تهجئة their',
      summary: "أداة الملكية 'their' تُكتب بـ 'ei' وليس 'ie'.",
      why: "الإنجليزية تميّز بين their و there و they're؛ هنا الصيغة الملكية تستخدم 'ei'.",
    },
    tr: {
      ruleTitle: 'Their yazımı',
      summary: "İyelik sıfatı 'their' 'ie' değil 'ei' ile yazılır.",
      why: "İngilizce their, there ve they're ayrımında iyelik biçimi 'ei' kullanır.",
    },
  },
}

export function getStaticTrustedRulePresentation(
  ruleId: string | undefined,
  locale: UiLocaleCode,
): LocalizedPresentationFields | null {
  if (!ruleId || locale === 'en') return null
  const entry = STATIC_TRUSTED_RULE_LOCALES[ruleId]?.[locale]
  if (!entry) return null
  return entry
}

export function resolveLocalizedPresentation(
  explanation: RuleExplanation,
  locale: UiLocaleCode,
): RuleExplanation {
  if (locale === 'en') return explanation
  const staticCopy = getStaticTrustedRulePresentation(explanation.ruleId, locale)
  if (staticCopy) return applyLocalizedPresentation(explanation, staticCopy)
  return explanation
}
