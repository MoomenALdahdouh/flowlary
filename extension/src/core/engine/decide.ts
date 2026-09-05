import type {
  AdvisorVote,
  CandidateAction,
  DecisionReasonCode,
  FieldContext,
  Hypothesis,
  LlmAdvisorResult,
  SharedAnalysis,
  WritingDecision,
  WritingIntent,
} from './types.ts'
import { layoutSpanConflictsWithMixedIntent, layoutReplacementIsCredible } from './mixedLayoutSafety.ts'

let nextDecision = 1

export type DecideOptions = {
  observeOnly?: boolean
  hypotheses?: Hypothesis[]
  advisorVote?: AdvisorVote | null
  advisorResult?: LlmAdvisorResult
}

function overlaps(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start < right.end && right.start < left.end
}

export function decideWriting(
  context: FieldContext,
  analysis: SharedAnalysis | null,
  candidates: CandidateAction[],
  options: DecideOptions = {},
): WritingDecision {
  const reasons: DecisionReasonCode[] = options.observeOnly === false ? [] : ['shadow_observe_only']
  const blocked: CandidateAction['capability'][] = []
  const origin = analysis?.dominantOrigin ?? 'unknown'
  const hypotheses = options.hypotheses ?? []
  const llmResult = options.advisorResult ?? 'unused'

  const finish = (
    action: WritingDecision['action'],
    extra: DecisionReasonCode[],
    winner: CandidateAction | null,
    extras: {
      confidence?: WritingDecision['confidence']
      intent?: WritingIntent | null
      hypothesisId?: string | null
      risk?: WritingDecision['risk']
    } = {},
  ): WritingDecision => ({
    decisionId: `dec-${nextDecision++}`,
    cycleId: context.cycleId,
    fieldId: context.fieldId,
    generation: context.generation,
    action,
    trigger: 'auto',
    winnerCandidateId: winner?.id ?? null,
    range: winner?.range ?? null,
    confidence: extras.confidence ?? winner?.confidence ?? { score: 1, class: 'high' },
    reasonCodes: [...reasons, ...extra],
    textOrigin: origin,
    blockedCandidateCapabilities: blocked,
    selectedIntent: extras.intent ?? null,
    winnerHypothesisId: extras.hypothesisId ?? winner?.id ?? null,
    risk: extras.risk ?? 'low',
    llmUsed: llmResult === 'ranked',
    llmResult,
  })

  if (!context.assistantEnabled) return finish('noop', ['policy_assistant_off'], null)
  if (context.helpStyle === 'shortcuts_only') return finish('noop', ['policy_shortcuts_only'], null)
  if (context.liveWholeFieldCorrection && candidates.some((item) => item.capability === 'english_correction')) {
    blocked.push('english_correction')
  }
  if (!context.safetyAllowed) return finish('noop', ['protected_context'], null)
  if (context.composing) return finish('noop', ['composing'], null)
  if (context.mutexHeld) return finish('noop', ['mutex_held'], null)
  if (context.cooldownActive) return finish('noop', ['cooldown'], null)
  if (
    context.editorTier > 2
    || (!context.capabilities.autoWrite && !context.capabilities.suggestion && !context.capabilities.manualShortcut)
  ) {
    return finish('noop', ['unsupported_editor'], null)
  }

  if (context.inputSource === 'paste' || context.inputSource === 'drop') {
    return finish('noop', ['paste_conservative'], null, { intent: 'preserve' })
  }

  if (hypotheses.some((item) => item.intent === 'user_override')) {
    const override = hypotheses.find((item) => item.intent === 'user_override')!
    const colliding = candidates.filter((item) => overlaps(item.range, override.span))
    for (const item of colliding) blocked.push(item.capability)
    if (colliding.length > 0) {
      return finish('noop', ['user_override'], null, { intent: 'user_override', hypothesisId: override.id })
    }
  }

  const byId = new Map(hypotheses.map((item) => [item.id, item]))
  const candidateFor = (hypothesis: Hypothesis) =>
    candidates.find((item) => item.id === hypothesis.id)
    ?? candidates.find((item) => item.capability === hypothesis.candidateAction && item.range.start === hypothesis.span.start)

  if (options.advisorVote) {
    for (const id of options.advisorVote.rankedHypothesisIds) {
      const picked = byId.get(id)
      if (!picked) continue
      if (
        picked.intent === 'fix_layout'
        && analysis
        && layoutSpanConflictsWithMixedIntent(picked.span, analysis.chunks)
      ) {
        blocked.push('layout_fix')
        continue
      }
      if (picked.intent === 'preserve' || picked.intent === 'write_as_is' || picked.intent === 'unknown' || picked.intent === 'user_override') {
        return finish('noop', ['advisor_abstain', 'hypothesis_preserve'], null, {
          intent: picked.intent,
          hypothesisId: picked.id,
        })
      }
      const winner = candidateFor(picked)
      if (!winner || !picked.candidateAction) continue
      if (
        context.liveWholeFieldCorrection
        && picked.candidateAction === 'english_correction'
      ) {
        blocked.push('english_correction')
        return finish('noop', ['deferred_to_whole_field'], winner, {
          intent: picked.intent,
          hypothesisId: picked.id,
          risk: picked.risk,
        })
      }
      if (picked.needsLLM || picked.risk !== 'low' || !winner.eligibleForAuto) {
        blocked.push(picked.candidateAction)
        return finish('suggestion', ['downgraded_to_suggestion', 'hypothesis_winner'], winner, {
          intent: picked.intent,
          hypothesisId: picked.id,
          risk: picked.risk,
        })
      }
      return finish(
        picked.candidateAction === 'layout_fix'
          ? 'layout_fix'
          : picked.candidateAction === 'translation'
            ? 'translation'
            : 'english_correction',
        ['hypothesis_winner'],
        winner,
        { intent: picked.intent, hypothesisId: picked.id, risk: picked.risk },
      )
    }
    if (blocked.includes('layout_fix')) {
      return finish('noop', ['mixed_intent_blocks_auto_layout'], null, { intent: 'preserve', risk: 'high' })
    }
    return finish('noop', ['advisor_invalid'], null)
  }

  if (llmResult === 'invalid') return finish('noop', ['advisor_invalid'], null, { intent: 'unknown' })
  if (llmResult === 'unavailable' && hypotheses.some((item) => item.needsLLM && item.conflicts.length > 0)) {
    return finish('noop', ['advisor_unavailable', 'hypothesis_conflict'], null, { intent: 'unknown', risk: 'medium' })
  }

  if (hypotheses.length === 0 && analysis?.hasArabizi) {
    const correction = candidates.find((item) => item.capability === 'english_correction')
    if (correction) blocked.push('english_correction')
    return finish('noop', ['arabizi'], correction ?? null)
  }
  if (hypotheses.length === 0 && analysis?.hasAmbiguousMixed) {
    const correction = candidates.find((item) => item.capability === 'english_correction')
    if (correction) blocked.push('english_correction')
    return finish('noop', ['ambiguous_mixed'], correction ?? null)
  }

  const layoutHyps = hypotheses.filter((item) => item.intent === 'fix_layout')
  const uniqueStrongLayout = layoutHyps.filter((item) => {
    if (!item.replacement || !layoutReplacementIsCredible(item.replacement)) {
      return false
    }
    if (analysis && layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks)) {
      return false
    }
    const rivalActions = hypotheses.filter(
      (other) =>
        other.id !== item.id
        && overlaps(other.span, item.span)
        && other.candidateAction
        && other.candidateAction !== 'layout_fix'
        && other.localScore >= 0.5,
    )
    if (analysis?.openToken && overlaps(item.span, analysis.openToken)) return false
    return item.risk === 'low' && item.localScore >= 0.7 && !item.needsLLM && rivalActions.length === 0
  }).sort((a, b) => b.localScore - a.localScore)[0]

  if (uniqueStrongLayout) {
    const winner = candidateFor(uniqueStrongLayout)
    if (winner?.eligibleForAuto) {
      blocked.push('english_correction')
      blocked.push('translation')
      if (context.helpStyle === 'suggestions') {
        return finish('suggestion', ['downgraded_to_suggestion', 'single_winner_layout'], winner, {
          intent: 'fix_layout',
          hypothesisId: uniqueStrongLayout.id,
          risk: uniqueStrongLayout.risk,
        })
      }
      return finish('layout_fix', ['single_winner_layout', 'hypothesis_winner'], winner, {
        intent: 'fix_layout',
        hypothesisId: uniqueStrongLayout.id,
        risk: uniqueStrongLayout.risk,
      })
    }
    if (winner && (winner.confidence.class === 'ambiguous' || uniqueStrongLayout.evidence.some((item) => item.kind === 'short_token'))) {
      blocked.push('layout_fix')
      return finish('noop', ['ambiguous_short_token'], winner, {
        intent: 'fix_layout',
        hypothesisId: uniqueStrongLayout.id,
        confidence: { score: winner.confidence.score, class: 'ambiguous' },
      })
    }
    if (winner?.replacement && context.capabilities.suggestion) {
      blocked.push('english_correction')
      blocked.push('translation')
      return finish('suggestion', ['downgraded_to_suggestion', 'single_winner_layout'], winner, {
        intent: 'fix_layout',
        hypothesisId: uniqueStrongLayout.id,
        risk: uniqueStrongLayout.risk,
      })
    }
  }

  if (
    !uniqueStrongLayout
    && analysis
    && layoutHyps.length > 0
    && layoutHyps.every((item) =>
      item.risk !== 'low'
      || item.needsLLM
      || layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks),
    )
  ) {
    const mixBlocked = layoutHyps.find((item) => layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks))
    if (mixBlocked) {
      blocked.push('layout_fix')
      const winner = candidateFor(mixBlocked)
      if (context.helpStyle === 'suggestions' && winner?.replacement) {
        return finish('suggestion', ['mixed_intent_blocks_auto_layout', 'downgraded_to_suggestion'], winner, {
          intent: 'fix_layout',
          hypothesisId: mixBlocked.id,
          risk: 'high',
        })
      }
      return finish('noop', ['mixed_intent_blocks_auto_layout'], winner ?? null, {
        intent: 'preserve',
        hypothesisId: mixBlocked.id,
        risk: 'high',
      })
    }
  }

  const conflictingActions = hypotheses.filter(
    (item) => item.candidateAction && item.conflicts.some((id) => byId.get(id)?.candidateAction),
  )
  if (conflictingActions.length >= 2 && conflictingActions.every((item) => item.needsLLM || item.risk !== 'low')) {
    return finish('noop', ['hypothesis_conflict'], null, { intent: 'unknown', risk: 'high' })
  }

  const translation = hypotheses.find((item) => item.intent === 'translate')
  if (translation) {
    const winner = candidateFor(translation)
    if (!context.translationSessionId || !context.arabicToEnglishMode) {
      blocked.push('translation')
      return finish('noop', ['session_missing'], winner ?? null, { intent: 'translate', hypothesisId: translation.id })
    }
    if (translation.risk === 'high' || translation.needsLLM || translation.localScore < 0.8) {
      blocked.push('translation')
      blocked.push('english_correction')
      return finish('noop', ['mixed_spans_no_blob_translate'], winner ?? null, {
        intent: 'translate',
        hypothesisId: translation.id,
        risk: translation.risk,
      })
    }
    if (
      context.helpStyle === 'suggestions'
      || (winner && (winner.confidence.class === 'low' || !winner.eligibleForAuto))
    ) {
      blocked.push('english_correction')
      return finish('suggestion', ['downgraded_to_suggestion', 'single_winner_translation'], winner ?? null, {
        intent: 'translate',
        hypothesisId: translation.id,
      })
    }
    blocked.push('english_correction')
    return finish('translation', ['single_winner_translation', 'hypothesis_winner'], winner ?? null, {
      intent: 'translate',
      hypothesisId: translation.id,
    })
  }

  const spelling = hypotheses
    .filter((item) => item.intent === 'fix_english' && item.replacement)
    .sort((a, b) => {
      const reviewRank = (item: typeof a) => (item.reviewKind && item.risk === 'low' ? 1 : 0)
      if (reviewRank(b) !== reviewRank(a)) return reviewRank(b) - reviewRank(a)
      return b.localScore - a.localScore
    })[0]
  const remoteEnglish = hypotheses.find(
    (item) => item.intent === 'fix_english' && !item.replacement && item.needsLLM,
  )
  const mixed = analysis?.hasAmbiguousMixed === true
  const layoutSuspicion = analysis?.hasLayoutSuspicion === true
  const layoutHypsPresent = layoutHyps.length > 0

  if (analysis?.hasArabizi) {
    blocked.push('english_correction')
  }
  const overlappingLayout = spelling
    ? layoutHyps.filter((item) => overlaps(item.span, spelling.span))
    : []
  const strongOverlappingLayout = overlappingLayout.some((item) => (
    item.risk === 'low' && item.evidence.some((entry) => entry.kind === 'sequence_agreement' && (entry.weight ?? 0) >= 2)
  ))
  if (strongOverlappingLayout) {
    blocked.push('english_correction')
  }

  if (spelling && !strongOverlappingLayout && !analysis?.hasArabizi) {
    const winner = candidateFor(spelling)
    if (origin === 'translated_en' && !context.polishAfterTranslate) {
      blocked.push('english_correction')
      return finish('noop', ['translated_output_blocks_grammar'], winner ?? null, { intent: 'preserve' })
    }
    if (mixed) {
      const scoped = (analysis?.chunks ?? []).filter((chunk) => overlaps(chunk.range, spelling.span))
      const englishOnly = scoped.length > 0 && scoped.every((chunk) =>
        chunk.scripts.arabic === 0
        && chunk.role !== 'arabizi'
        && (
          chunk.role === 'english_prose'
          || chunk.role === 'unknown'
          || chunk.role === 'possible_spelling_error'
          || (
            chunk.scripts.latin > 0
            && chunk.role !== 'technical_token'
            && chunk.role !== 'intentional_foreign_token'
          )
        ),
      )
      if (!englishOnly) {
        blocked.push('english_correction')
        return finish('noop', ['ambiguous_mixed'], winner ?? null, {
          intent: 'fix_english',
          hypothesisId: spelling.id,
          risk: 'medium',
        })
      }
    }
    if (context.liveWholeFieldCorrection && spelling.replacement) {
      blocked.push('english_correction')
      return finish('noop', ['deferred_to_whole_field'], winner ?? null, {
        intent: 'fix_english',
        hypothesisId: spelling.id,
        risk: spelling.risk,
      })
    }
    if (spelling.needsLLM || spelling.risk !== 'low' || context.helpStyle === 'suggestions') {
      return finish('suggestion', ['downgraded_to_suggestion', 'low_confidence'], winner ?? null, {
        intent: 'fix_english',
        hypothesisId: spelling.id,
        risk: spelling.risk,
      })
    }
    if (winner?.eligibleForAuto && context.helpStyle === 'auto') {
      return finish('english_correction', ['single_winner_correction', 'hypothesis_winner'], winner, {
        intent: 'fix_english',
        hypothesisId: spelling.id,
      })
    }
  }

  if (
    remoteEnglish
    && !layoutSuspicion
    && !layoutHypsPresent
    && !analysis?.hasArabizi
    && !mixed
    && !(origin === 'translated_en' && !context.polishAfterTranslate)
  ) {
    const winner = candidateFor(remoteEnglish)
    if (context.liveWholeFieldCorrection) {
      blocked.push('english_correction')
      return finish('noop', ['deferred_to_whole_field'], winner ?? null, {
        intent: 'fix_english',
        hypothesisId: remoteEnglish.id,
        risk: remoteEnglish.risk,
      })
    }
    return finish('suggestion', ['downgraded_to_suggestion', 'low_confidence'], winner ?? null, {
      intent: 'fix_english',
      hypothesisId: remoteEnglish.id,
      risk: remoteEnglish.risk,
    })
  }

  const legacyLayout = candidates
    .filter((item) => item.capability === 'layout_fix')
    .sort((a, b) => b.confidence.score - a.confidence.score)[0]
  if ((legacyLayout || layoutSuspicion) && hypotheses.length === 0) {
    blocked.push('english_correction')
  }
  if (legacyLayout && hypotheses.length === 0) {
    if (!legacyLayout.replacement || !layoutReplacementIsCredible(legacyLayout.replacement)) {
      blocked.push('layout_fix')
    } else if (legacyLayout.confidence.class === 'ambiguous' || legacyLayout.evidence.some((item) => item.kind === 'short_token')) {
      blocked.push('layout_fix')
      return finish('noop', ['ambiguous_short_token'], legacyLayout, {
        confidence: { score: legacyLayout.confidence.score, class: 'ambiguous' },
        intent: 'fix_layout',
      })
    } else if (legacyLayout.eligibleForAuto && legacyLayout.confidence.class === 'high') {
      blocked.push('english_correction')
      blocked.push('translation')
      if (context.helpStyle === 'suggestions') {
        return finish('suggestion', ['downgraded_to_suggestion', 'single_winner_layout'], legacyLayout, {
          intent: 'fix_layout',
        })
      }
      return finish('layout_fix', ['single_winner_layout'], legacyLayout, { intent: 'fix_layout' })
    }
  }

  if (context.helpStyle === 'suggestions' && context.capabilities.suggestion) {
    const leftoverLayout = layoutHyps
      .filter((item) => {
        if (!item.replacement || item.risk !== 'low' || item.needsLLM) return false
        if (!layoutReplacementIsCredible(item.replacement)) return false
        if (analysis?.openToken && overlaps(item.span, analysis.openToken)) return false
        if (analysis && layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks)) return false
        return !hypotheses.some((other) =>
          (other.intent === 'preserve' || other.intent === 'user_override')
          && overlaps(other.span, item.span),
        )
      })
      .sort((a, b) => b.localScore - a.localScore)[0]
    const winner = leftoverLayout ? candidateFor(leftoverLayout) : undefined
    if (leftoverLayout && winner?.replacement && leftoverLayout.localScore >= 0.55) {
      blocked.push('english_correction')
      blocked.push('translation')
      blocked.push('layout_fix')
      return finish('suggestion', ['downgraded_to_suggestion', 'no_unambiguous_winner'], winner, {
        intent: 'fix_layout',
        hypothesisId: leftoverLayout.id,
        risk: leftoverLayout.risk,
      })
    }
  }

  if (hypotheses.some((item) => item.intent === 'preserve' || item.intent === 'write_as_is')) {
    return finish('noop', ['hypothesis_preserve', 'no_unambiguous_winner'], null, { intent: 'preserve' })
  }

  if (candidates.length === 0 && hypotheses.length === 0) {
    return finish('noop', ['no_candidates'], null)
  }
  return finish('noop', ['no_unambiguous_winner'], null, { intent: 'unknown', risk: 'medium' })
}
