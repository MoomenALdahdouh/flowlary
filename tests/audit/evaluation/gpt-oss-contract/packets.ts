/**
 * Isolated contract-audit packets. Not imported by production.
 * Same AdvisorPacket *shape* as production (snippet + hyps + allowed intents).
 * New cases — not the frozen 5500 holdout and not conversation examples.
 */

export const ALLOWED_INTENTS = [
  'write_as_is',
  'fix_layout',
  'fix_english',
  'translate',
  'preserve',
  'unknown',
  'user_override',
] as const

export type ContractPacket = {
  id: string
  family: string
  goldIntent: 'fix_layout' | 'preserve' | 'fix_english' | 'unknown'
  goldHypothesisId: string
  cycleId: string
  snippet: string
  allowedIntents: string[]
  hypotheses: Array<{
    id: string
    intent: string
    localScore: number
    risk: string
    needsLLM: boolean
    conflicts: string[]
    evidence: string[]
  }>
}

export const CONTRACT_PACKETS: ContractPacket[] = [
  {
    id: 'c-layout-1',
    family: 'layout',
    goldIntent: 'fix_layout',
    goldHypothesisId: 'h2',
    cycleId: 'contract-layout-1',
    snippet: 'hgsso please',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'preserve', localScore: 0.31, risk: 'medium', needsLLM: true, conflicts: ['h2'], evidence: ['as_is'] },
      { id: 'h2', intent: 'fix_layout', localScore: 0.62, risk: 'medium', needsLLM: true, conflicts: ['h1'], evidence: ['sequence_agreement'] },
      { id: 'h3', intent: 'unknown', localScore: 0.2, risk: 'high', needsLLM: true, conflicts: [], evidence: [] },
    ],
  },
  {
    id: 'c-layout-2',
    family: 'layout',
    goldIntent: 'fix_layout',
    goldHypothesisId: 'h1',
    cycleId: 'contract-layout-2',
    snippet: 'شكرا اليوم يعمل',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'fix_layout', localScore: 0.71, risk: 'low', needsLLM: true, conflicts: ['h2'], evidence: ['mapping_coverage'] },
      { id: 'h2', intent: 'write_as_is', localScore: 0.28, risk: 'medium', needsLLM: true, conflicts: ['h1'], evidence: ['arabic_script'] },
    ],
  },
  {
    id: 'c-mix-1',
    family: 'mixed',
    goldIntent: 'preserve',
    goldHypothesisId: 'h1',
    cycleId: 'contract-mix-1',
    snippet: 'سأراجع spanId بعد الاجتماع',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'preserve', localScore: 0.68, risk: 'low', needsLLM: true, conflicts: ['h2'], evidence: ['mixed_neighbor'] },
      { id: 'h2', intent: 'fix_layout', localScore: 0.41, risk: 'high', needsLLM: true, conflicts: ['h1'], evidence: ['possible_layout'] },
    ],
  },
  {
    id: 'c-mix-2',
    family: 'mixed',
    goldIntent: 'preserve',
    goldHypothesisId: 'h3',
    cycleId: 'contract-mix-2',
    snippet: 'أرسل https://status.example.org/live',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'fix_layout', localScore: 0.33, risk: 'high', needsLLM: true, conflicts: ['h3'], evidence: ['script_flip'] },
      { id: 'h3', intent: 'preserve', localScore: 0.77, risk: 'low', needsLLM: true, conflicts: ['h1'], evidence: ['url'] },
    ],
  },
  {
    id: 'c-spell-1',
    family: 'spelling',
    goldIntent: 'fix_english',
    goldHypothesisId: 'h2',
    cycleId: 'contract-spell-1',
    snippet: 'please saffrone later',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'preserve', localScore: 0.29, risk: 'medium', needsLLM: true, conflicts: ['h2'], evidence: ['unknown_latin'] },
      { id: 'h2', intent: 'fix_english', localScore: 0.55, risk: 'medium', needsLLM: true, conflicts: ['h1'], evidence: ['edit_distance'] },
      { id: 'h4', intent: 'fix_layout', localScore: 0.22, risk: 'high', needsLLM: true, conflicts: [], evidence: [] },
    ],
  },
  {
    id: 'c-tech-1',
    family: 'technical',
    goldIntent: 'preserve',
    goldHypothesisId: 'h1',
    cycleId: 'contract-tech-1',
    snippet: 'see go.mod',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'preserve', localScore: 0.8, risk: 'low', needsLLM: true, conflicts: ['h2'], evidence: ['file_ext'] },
      { id: 'h2', intent: 'fix_english', localScore: 0.18, risk: 'high', needsLLM: true, conflicts: ['h1'], evidence: [] },
    ],
  },
  {
    id: 'c-short-1',
    family: 'short',
    goldIntent: 'unknown',
    goldHypothesisId: 'h1',
    cycleId: 'contract-short-1',
    snippet: 'في',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'unknown', localScore: 0.4, risk: 'high', needsLLM: true, conflicts: ['h2'], evidence: ['short_token'] },
      { id: 'h2', intent: 'fix_layout', localScore: 0.25, risk: 'high', needsLLM: true, conflicts: ['h1'], evidence: ['short_map'] },
    ],
  },
  {
    id: 'c-punct-1',
    family: 'punctuation',
    goldIntent: 'preserve',
    goldHypothesisId: 'h1',
    cycleId: 'contract-punct-1',
    snippet: '!?',
    allowedIntents: [...ALLOWED_INTENTS],
    hypotheses: [
      { id: 'h1', intent: 'preserve', localScore: 0.7, risk: 'low', needsLLM: true, conflicts: [], evidence: ['punctuation_only'] },
      { id: 'h2', intent: 'unknown', localScore: 0.2, risk: 'high', needsLLM: true, conflicts: [], evidence: [] },
    ],
  },
]
