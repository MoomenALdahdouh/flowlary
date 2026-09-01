/**
 * Small, human-authored trusted rule library.
 *
 * Sources: authoritative deterministic pairs from extension/src/features/correction/instantSpell.ts
 * Each rule matches ONLY explicit normalized pairs — never generalizes from category alone.
 */
import { createExactPairMatcher } from './matcher.ts'
import type { TrustedRuleDefinition, TrustedRuleLibrary } from './types.ts'

const receiveSpellingRule: TrustedRuleDefinition = {
  ruleId: 'english.spelling.receive_ie_ei',
  category: 'spelling',
  version: '1.0',
  title: 'Receive spelling',
  summary: "The verb 'receive' is written with 'ei' after the c, not 'ie'.",
  why: "This is a common English spelling pattern for 'receive' and related forms such as 'receiver'.",
  examples: [
    { incorrect: 'recieve', correct: 'receive' },
    { incorrect: 'recive', correct: 'receive' },
  ],
  pairs: [
    { incorrect: 'recieve', correct: 'receive' },
    { incorrect: 'recive', correct: 'receive' },
  ],
  match: createExactPairMatcher({
    category: 'spelling',
    pairs: [
      { incorrect: 'recieve', correct: 'receive' },
      { incorrect: 'recive', correct: 'receive' },
    ],
  }),
}

const definitelySpellingRule: TrustedRuleDefinition = {
  ruleId: 'english.spelling.definitely_not_a',
  category: 'spelling',
  version: '1.0',
  title: 'Definitely spelling',
  summary: "The adverb 'definitely' is written with 'itely', not 'ately'.",
  why: "The ending '-itely' is the standard written form in English for this word.",
  examples: [{ incorrect: 'definately', correct: 'definitely' }],
  pairs: [{ incorrect: 'definately', correct: 'definitely' }],
  match: createExactPairMatcher({
    category: 'spelling',
    pairs: [{ incorrect: 'definately', correct: 'definitely' }],
  }),
}

const separateSpellingRule: TrustedRuleDefinition = {
  ruleId: 'english.spelling.separate_not_er',
  category: 'spelling',
  version: '1.0',
  title: 'Separate spelling',
  summary: "The word 'separate' is written with 'para' in the middle, not 'pera'.",
  why: "This spelling is fixed in standard written English and is a frequent correction target.",
  examples: [{ incorrect: 'seperate', correct: 'separate' }],
  pairs: [{ incorrect: 'seperate', correct: 'separate' }],
  match: createExactPairMatcher({
    category: 'spelling',
    pairs: [{ incorrect: 'seperate', correct: 'separate' }],
  }),
}

const theirSpellingRule: TrustedRuleDefinition = {
  ruleId: 'english.spelling.their_not_ie',
  category: 'spelling',
  version: '1.0',
  title: 'Their spelling',
  summary: "The possessive determiner 'their' is written with 'ei', not 'ie'.",
  why: "English distinguishes 'their', 'there', and 'they're'; here the possessive form uses 'ei'.",
  examples: [{ incorrect: 'thier', correct: 'their' }],
  pairs: [{ incorrect: 'thier', correct: 'their' }],
  match: createExactPairMatcher({
    category: 'spelling',
    pairs: [{ incorrect: 'thier', correct: 'their' }],
  }),
}

export const TRUSTED_RULE_LIBRARY: TrustedRuleLibrary = [
  receiveSpellingRule,
  definitelySpellingRule,
  separateSpellingRule,
  theirSpellingRule,
]

export function getTrustedRuleById(ruleId: string): TrustedRuleDefinition | undefined {
  return TRUSTED_RULE_LIBRARY.find((rule) => rule.ruleId === ruleId)
}
