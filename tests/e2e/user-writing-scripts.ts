/**
 * Realistic user scripts (chat, email, mixed bilingual). Typed glyphs for
 * layout cases match en-US-qwerty ↔ ar-101 the way a wrong OS keyboard looks.
 */

export const CHAT_LAYOUT_EN_ON_AR = {
  typed: 'اثممخ حمثشسث ',
  expected: /hello please/i,
}

export const CHAT_ENGLISH_TYPOS = {
  typed: 'hell hwo are yuo ',
  expected: /hello,? how are you/i,
}

/** Screenshot-class learner chat: typos + homophone + stacked questions. */
export const CHAT_NATIVE_ENGLISH = {
  typed: 'hell hwo are yuo are yuo comming or not let me now',
  expected: 'Hello, how are you? Are you coming or not? Let me know.',
}

export const CHAT_LET_ME_NOW = {
  typed: 'Let me now',
  expected: 'Let me know.',
}

export const CHAT_RIGHT_NOW = {
  typed: 'See you right now',
  expected: 'See you right now.',
}

export const MANUAL_TESTING_TYPOS = {
  typed: 'manul testng setp guid',
  expected: 'Manual testing setup guide.',
}

export const OFFICE_ENGLISH_TYPO = {
  typed: 'Please recieve the files ',
  expected: /receive/i,
}

export const EMAIL_ARABIC_TO_EN = {
  typed: 'أحتاج التقرير النهائي قبل الظهر. ',
  expected: /report|need|noon|final/i,
}

export const CHAT_DIALECT_ARABIC_TO_EN = {
  typed: 'اذا كنت راح تيجي خبرني قبل ما تيجي لاني راح استناك قبل ما اطلع ',
  expected: /coming|know|wait|leave/i,
  forbidden: /ofvkd|TYPING/i,
}

export const MIXED_LAYOUT_IN_ENGLISH = {
  typed: 'hello hkh rh]l hghk thanks ',
  expected: /انا قادم الان/,
}

export const PROTECTED_PROSE =
  'Ship to https://status.example.net and ping ops@contoso.test. '
