const ARABIC_SCRIPT = /[\u0600-\u06FF]/

/** Colloquial/spoken markers — signals only, not substitution rules. */
const COLLOQUIAL_MARKER =
  /(?:^|[\s،,.!?])(?:اسمع|والله|يعني|ليش|مش|بس|شو|شو\s+في|عنجد|هلق)(?:[\s،,.!?]|$)/u
const SPOKEN_FILLER = /(?:^|[\s،,.!?])(?:اه|آه|إيه)(?:[\s،,.!?]|$)/u

export type NeedsTranslationPolishInput = {
  sourceText: string
  draftTranslation: string
  sourceLanguage: string
  targetLanguage: string
}

export type NeedsTranslationPolishResult = {
  needsPolish: boolean
  reason: string
}

export function needsTranslationPolish(input: NeedsTranslationPolishInput): NeedsTranslationPolishResult {
  const source = input.sourceText.trim()
  const draft = input.draftTranslation.trim()
  if (!source || !draft) {
    return { needsPolish: false, reason: 'empty_text' }
  }
  if (input.sourceLanguage === input.targetLanguage) {
    return { needsPolish: false, reason: 'same_language' }
  }

  const arabicSource =
    input.sourceLanguage === 'ar' || ARABIC_SCRIPT.test(source)
  if (!arabicSource) {
    return { needsPolish: false, reason: 'not_arabic_source' }
  }

  let score = 0
  const reasons: string[] = []

  if (COLLOQUIAL_MARKER.test(source)) {
    score += 2
    reasons.push('colloquial_marker')
  }
  if (SPOKEN_FILLER.test(source)) {
    score += 1
    reasons.push('spoken_filler')
  }

  const sourceLen = source.replace(/\s+/g, ' ').length
  const draftLen = draft.replace(/\s+/g, ' ').length
  if (sourceLen >= 12 && draftLen > 0 && draftLen / sourceLen < 0.55) {
    score += 2
    reasons.push('draft_shorter_than_source')
  }

  if (/والله/u.test(source) && /\b(i swear|by god|by allah|wallah)\b/i.test(draft)) {
    score += 2
    reasons.push('literal_oath_in_draft')
  }

  const sourceWords = source.split(/\s+/u).filter(Boolean)
  const draftWords = draft.split(/\s+/u).filter(Boolean)
  if (sourceWords.length >= 4 && draftWords.length < sourceWords.length - 1) {
    score += 1
    reasons.push('draft_word_count_drop')
  }

  if (score >= 2) {
    return { needsPolish: true, reason: reasons.join(',') || 'quality_signal' }
  }
  return {
    needsPolish: false,
    reason: reasons.length > 0 ? reasons.join(',') : 'natural_draft',
  }
}

export function liveTranslationPolishEligible(context?: {
  segment_complete?: boolean
  focus_out_completion?: boolean
}): boolean {
  if (!context) return false
  return context.segment_complete === true || context.focus_out_completion === true
}
