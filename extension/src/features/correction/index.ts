export type { CorrectionFeature } from '@flowlary/shared'
export {
  createCorrectionFeature,
  type CorrectionModule,
} from './CorrectionFeature.ts'
export { mergeCorrectionIntoField, canMergeCorrection } from './mergeCorrection.ts'
export { extractWritingContext } from './segment.ts'
export { applyInstantSpelling } from './instantSpell.ts'
export {
  detectEnglish,
  isEligibleForCorrection,
  shouldShowEnglishAssistant,
} from './language.ts'
export {
  IntelligentDebouncer,
  getDebounceDelay,
  endsWithSentenceBoundary,
  endsWithWordBoundary,
} from './debounce.ts'
