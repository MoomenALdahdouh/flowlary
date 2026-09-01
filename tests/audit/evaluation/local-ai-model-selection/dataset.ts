/**
 * Stratified Flowlary-specific eval set for local-model selection.
 * Evaluation-only. Not imported by production.
 */
import { GOLDEN_INTENT_CASES } from '../../../unit/writing-engine/golden-intent-cases.ts'
import {
  generateArchitectureCorpus,
  type ArchGold,
} from '../generate.ts'

export const LOCAL_AI_EVAL_SEED = 20260901
export const LOCAL_AI_EVAL_VERSION = '1'

export type LocalAiStratum =
  | 'A_en_spelling'
  | 'B_en_grammar'
  | 'C_en_punctuation'
  | 'D_arabic'
  | 'E_ar_en_mixed'
  | 'F_intentional_bilingual'
  | 'G_keyboard_layout'
  | 'H_spell_after_layout'
  | 'I_technical'
  | 'J_urls'
  | 'K_emails'
  | 'L_secrets'
  | 'M_code'
  | 'N_names'
  | 'O_slang'
  | 'P_arabizi'
  | 'Q_short_fragments'
  | 'R_long_sentences'
  | 'S_multiple_errors'
  | 'T_intentional_unusual'
  | 'U_user_vocab'
  | 'V_rapid_incomplete'
  | 'W_open_tokens'
  | 'X_pasted'
  | 'Y_protected'
  | 'Z_ambiguous_preserve'

export type LocalAiGoldAction = 'layout_fix' | 'english_correction' | 'preserve' | 'unknown'
export type LocalAiGoldKind = 'spelling' | 'grammar' | 'punctuation' | 'layout' | 'none'

export type LocalAiCase = {
  id: string
  source: 'arch_holdout' | 'golden' | 'hand'
  input: string
  strata: LocalAiStratum[]
  goldAction: LocalAiGoldAction
  goldKind: LocalAiGoldKind
  shouldIntervene: boolean
  mustPreserve: boolean
  protectedContent: boolean
  notes: string
}

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const HAND: Array<Omit<LocalAiCase, 'source'>> = [
  { id: 'hand-spell-1', input: 'I recieve the file today', strata: ['A_en_spelling'], goldAction: 'english_correction', goldKind: 'spelling', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'classic spelling' },
  { id: 'hand-spell-2', input: 'teh project is ready', strata: ['A_en_spelling'], goldAction: 'english_correction', goldKind: 'spelling', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'teh→the' },
  { id: 'hand-spell-3', input: 'Please seperate the lists', strata: ['A_en_spelling'], goldAction: 'english_correction', goldKind: 'spelling', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'seperate' },
  { id: 'hand-gram-1', input: 'He go to the meeting yesterday', strata: ['B_en_grammar'], goldAction: 'english_correction', goldKind: 'grammar', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'tense' },
  { id: 'hand-gram-2', input: 'She have two reports ready', strata: ['B_en_grammar'], goldAction: 'english_correction', goldKind: 'grammar', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'agreement' },
  { id: 'hand-gram-3', input: 'There is many issues in the log', strata: ['B_en_grammar'], goldAction: 'english_correction', goldKind: 'grammar', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'there is/are' },
  { id: 'hand-punct-1', input: 'Lets start the review', strata: ['C_en_punctuation'], goldAction: 'english_correction', goldKind: 'punctuation', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: "Let's" },
  { id: 'hand-punct-2', input: 'its ready for production', strata: ['C_en_punctuation'], goldAction: 'english_correction', goldKind: 'punctuation', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: "it's vs its — ambiguous preserve-leaning" },
  { id: 'hand-punct-3', input: 'Wait what happened', strata: ['C_en_punctuation', 'Z_ambiguous_preserve'], goldAction: 'preserve', goldKind: 'punctuation', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'missing ? is optional' },
  { id: 'hand-ar-1', input: 'أريد إرسال التقرير إلى الفريق اليوم', strata: ['D_arabic'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'correct MSA' },
  { id: 'hand-ar-2', input: 'هل يمكن مراجعة التصميم قبل الغد', strata: ['D_arabic'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'correct MSA' },
  { id: 'hand-mix-1', input: 'أنا عملت deploy لكن فيه error', strata: ['E_ar_en_mixed', 'F_intentional_bilingual'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'intentional mix' },
  { id: 'hand-mix-2', input: 'هذا التصميم جيد جدًا، but I need a small change', strata: ['E_ar_en_mixed', 'F_intentional_bilingual'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'clause mix' },
  { id: 'hand-mix-3', input: 'git push ثم راجع', strata: ['E_ar_en_mixed', 'F_intentional_bilingual', 'M_code'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'command + Arabic' },
  { id: 'hand-layout-1', input: 'hsjo]lj', strata: ['G_keyboard_layout'], goldAction: 'layout_fix', goldKind: 'layout', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'hello on ar-101' },
  { id: 'hand-layout-2', input: 'hello hsjo]lj', strata: ['G_keyboard_layout', 'E_ar_en_mixed'], goldAction: 'layout_fix', goldKind: 'layout', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'leftover wrong-keyboard token' },
  { id: 'hand-layout-3', input: 'نثغ', strata: ['G_keyboard_layout'], goldAction: 'layout_fix', goldKind: 'layout', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'arabic intended on english keys' },
  { id: 'hand-after-1', input: 'please recieve hsjo]lj later', strata: ['H_spell_after_layout', 'S_multiple_errors'], goldAction: 'layout_fix', goldKind: 'layout', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'layout token + spelling; layout first' },
  { id: 'hand-tech-1', input: 'FastAPI webhook_secret OIDC', strata: ['I_technical', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'identifiers' },
  { id: 'hand-tech-2', input: 'GraphQL protobuf avro', strata: ['I_technical'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'tech tokens' },
  { id: 'hand-url-1', input: 'see https://status.example.org/health please', strata: ['J_urls', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'url' },
  { id: 'hand-url-2', input: 'www.example.com/path?x=1', strata: ['J_urls', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'bare url' },
  { id: 'hand-email-1', input: 'ops+oncall@example.net', strata: ['K_emails', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'email' },
  { id: 'hand-email-2', input: 'send to user@example.com later', strata: ['K_emails', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'email in sentence' },
  { id: 'hand-secret-1', input: `Bearer ${JWT}`, strata: ['L_secrets', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'jwt' },
  { id: 'hand-secret-2', input: 'sk-abcdefghijklmnopqrstuv', strata: ['L_secrets', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'api key' },
  { id: 'hand-secret-3', input: 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG', strata: ['L_secrets', 'Y_protected'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'env secret' },
  { id: 'hand-code-1', input: 'const userName = 1', strata: ['M_code'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'js' },
  { id: 'hand-code-2', input: 'npm install && cargo test', strata: ['M_code'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'shell' },
  { id: 'hand-name-1', input: 'Ahmed', strata: ['N_names', 'Z_ambiguous_preserve'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'name' },
  { id: 'hand-name-2', input: 'Please ping Moomen after standup', strata: ['N_names', 'U_user_vocab'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'unseen name' },
  { id: 'hand-slang-1', input: 'gonna ship this tonight lol', strata: ['O_slang', 'T_intentional_unusual'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'informal' },
  { id: 'hand-slang-2', input: 'idk tbh ngl the api is fine', strata: ['O_slang', 'T_intentional_unusual'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'chat slang' },
  { id: 'hand-arabizi-1', input: 'mar7aba', strata: ['P_arabizi'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'digit arabizi' },
  { id: 'hand-arabizi-2', input: 'inshallah the deploy works', strata: ['P_arabizi', 'O_slang'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'loanword' },
  { id: 'hand-short-1', input: 'ok', strata: ['Q_short_fragments'], goldAction: 'unknown', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'short' },
  { id: 'hand-short-2', input: 'في', strata: ['Q_short_fragments', 'D_arabic'], goldAction: 'unknown', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'short ar' },
  { id: 'hand-long-1', input: 'please send the update after the meeting and make sure the English layout is ready for tomorrow because the project is working', strata: ['R_long_sentences'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'long correct EN' },
  { id: 'hand-long-2', input: 'أريد إرسال التقرير إلى الفريق اليوم هل يمكن مراجعة التصميم قبل الغد المستخدم يمكنه تحديث اللغة من الإعدادات', strata: ['R_long_sentences', 'D_arabic'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'long correct AR' },
  { id: 'hand-multi-1', input: 'He go to teh meeting recieve the file', strata: ['S_multiple_errors', 'A_en_spelling', 'B_en_grammar'], goldAction: 'english_correction', goldKind: 'spelling', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'several EN issues' },
  { id: 'hand-unusual-1', input: 'colorless green ideas sleep furiously', strata: ['T_intentional_unusual', 'Z_ambiguous_preserve'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'grammatical nonsense' },
  { id: 'hand-vocab-1', input: 'Flowlary will remap hsjo]lj', strata: ['U_user_vocab', 'G_keyboard_layout'], goldAction: 'layout_fix', goldKind: 'layout', shouldIntervene: true, mustPreserve: false, protectedContent: false, notes: 'product name + layout' },
  { id: 'hand-incomp-1', input: 'I am writ', strata: ['V_rapid_incomplete', 'W_open_tokens'], goldAction: 'unknown', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'open token' },
  { id: 'hand-incomp-2', input: 'https', strata: ['V_rapid_incomplete', 'W_open_tokens', 'J_urls'], goldAction: 'unknown', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'incomplete url' },
  { id: 'hand-incomp-3', input: 'eyJ', strata: ['V_rapid_incomplete', 'L_secrets', 'W_open_tokens'], goldAction: 'unknown', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'incomplete jwt' },
  { id: 'hand-paste-1', input: 'copied: FastAPI + https://example.com + user@x.com', strata: ['X_pasted', 'I_technical', 'J_urls', 'K_emails'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: true, notes: 'paste-like bundle' },
  { id: 'hand-ambig-1', input: 'ui ux', strata: ['Z_ambiguous_preserve', 'I_technical'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'short tech' },
  { id: 'hand-ambig-2', input: 'how i can make this api', strata: ['Z_ambiguous_preserve', 'B_en_grammar', 'T_intentional_unusual'], goldAction: 'preserve', goldKind: 'grammar', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'L2 English — preserve unless user asked to improve' },
  { id: 'hand-ambig-3', input: 'design engain', strata: ['Z_ambiguous_preserve', 'A_en_spelling', 'G_keyboard_layout'], goldAction: 'preserve', goldKind: 'none', shouldIntervene: false, mustPreserve: true, protectedContent: false, notes: 'golden: not layout' },
]

function strataForArch(family: string, gold: ArchGold, input: string): LocalAiStratum[] {
  const strata: LocalAiStratum[] = []
  if (family === 'layout' || gold === 'layout_fix') strata.push('G_keyboard_layout')
  if (family === 'spelling_layout' && gold === 'fix_english') strata.push('A_en_spelling')
  if (family === 'spelling_layout' && gold === 'layout_fix') strata.push('H_spell_after_layout', 'G_keyboard_layout')
  if (family === 'mixed') strata.push('E_ar_en_mixed', 'F_intentional_bilingual')
  if (family === 'technical') strata.push('I_technical')
  if (family === 'short') strata.push('Q_short_fragments')
  if (family === 'punctuation') strata.push('C_en_punctuation')
  if (family === 'contextual' && gold === 'preserve') strata.push('D_arabic', 'Z_ambiguous_preserve')
  if (family === 'contextual' && gold === 'layout_fix') strata.push('G_keyboard_layout', 'R_long_sentences')
  if (/https?:\/\//.test(input) || input.includes('www.')) strata.push('J_urls', 'Y_protected')
  if (/@/.test(input) && /\./.test(input)) strata.push('K_emails', 'Y_protected')
  if (/sk-|eyJ|Bearer |SECRET/i.test(input)) strata.push('L_secrets', 'Y_protected')
  if (/\.(ts|go|lock)\b|const |npm |cmd\//.test(input)) strata.push('M_code')
  if (input.length > 80) strata.push('R_long_sentences')
  return [...new Set(strata)]
}

function goldKindFor(gold: ArchGold, family: string): LocalAiGoldKind {
  if (gold === 'layout_fix') return 'layout'
  if (gold === 'fix_english') return 'spelling'
  if (family === 'punctuation') return 'punctuation'
  return 'none'
}

function fromGolden(): LocalAiCase[] {
  return GOLDEN_INTENT_CASES.map((item) => {
    const forbidden = item.expect.forbiddenAction
    const mustPreserve = Boolean(
      item.expect.protected
      || forbidden === 'layout_fix'
      || forbidden === 'english_correction'
      || forbidden === 'translation'
      || item.group === 'mixed'
      || item.group === 'technical'
      || item.group === 'protected'
      || item.group === 'arabizi'
      || item.group === 'names'
      || item.group === 'arabic'
      || item.group === 'english',
    )
    const shouldIntervene = item.expect.hasHypIntent === 'fix_layout' || item.expect.hasHypIntent === 'fix_english'
    const goldAction: LocalAiGoldAction = item.expect.hasHypIntent === 'fix_layout'
      ? 'layout_fix'
      : item.expect.hasHypIntent === 'fix_english'
        ? 'english_correction'
        : mustPreserve
          ? 'preserve'
          : 'unknown'
    const strata: LocalAiStratum[] = []
    if (item.group === 'spelling') strata.push('A_en_spelling')
    if (item.group === 'english') strata.push('T_intentional_unusual')
    if (item.group === 'arabic') strata.push('D_arabic')
    if (item.group === 'mixed') strata.push('E_ar_en_mixed', 'F_intentional_bilingual')
    if (item.group === 'layout') strata.push('G_keyboard_layout')
    if (item.group === 'technical') strata.push('I_technical')
    if (item.group === 'protected') strata.push('Y_protected')
    if (item.group === 'arabizi') strata.push('P_arabizi')
    if (item.group === 'names') strata.push('N_names')
    if (item.group === 'code') strata.push('M_code')
    if (item.id.startsWith('url') || item.expect.hasRole === 'url') strata.push('J_urls', 'Y_protected')
    if (item.expect.hasRole === 'email') strata.push('K_emails', 'Y_protected')
    if (item.input.startsWith('sk-') || item.input.includes('eyJ')) strata.push('L_secrets', 'Y_protected')
    if (strata.length === 0) strata.push('Z_ambiguous_preserve')
    return {
      id: `golden-${item.id}`,
      source: 'golden' as const,
      input: item.input,
      strata,
      goldAction,
      goldKind: goldAction === 'layout_fix' ? 'layout' : goldAction === 'english_correction' ? 'spelling' : 'none',
      shouldIntervene,
      mustPreserve: mustPreserve && !shouldIntervene,
      protectedContent: Boolean(item.expect.protected) || item.group === 'protected',
      notes: `golden ${item.group}`,
    }
  })
}

export function buildLocalAiEvalSet(): LocalAiCase[] {
  const holdout = generateArchitectureCorpus()
    .filter((item) => item.split === 'holdout')
    .map((item): LocalAiCase => ({
      id: `arch-${item.id}`,
      source: 'arch_holdout',
      input: item.input,
      strata: strataForArch(item.family, item.gold, item.input),
      goldAction: item.gold === 'fix_english' ? 'english_correction' : item.gold,
      goldKind: goldKindFor(item.gold, item.family),
      shouldIntervene: item.gold === 'layout_fix' || item.gold === 'fix_english',
      mustPreserve: item.gold === 'preserve' || item.gold === 'unknown',
      protectedContent: /https?:\/\/|@|sk-|eyJ/.test(item.input),
      notes: `arch ${item.family}`,
    }))
  const golden = fromGolden()
  const hand: LocalAiCase[] = HAND.map((item) => ({ ...item, source: 'hand' }))
  return [...holdout, ...golden, ...hand]
}

export function sampleForModelEval(all: LocalAiCase[], perStratum = 12): LocalAiCase[] {
  const picked = new Map<string, LocalAiCase>()
  for (const item of HAND.map((row) => ({ ...row, source: 'hand' as const }))) {
    picked.set(item.id, item)
  }
  const byStratum = new Map<LocalAiStratum, LocalAiCase[]>()
  for (const item of all) {
    for (const stratum of item.strata) {
      const list = byStratum.get(stratum) ?? []
      list.push(item)
      byStratum.set(stratum, list)
    }
  }
  for (const [stratum, list] of byStratum) {
    const intervene = list.filter((item) => item.shouldIntervene)
    const preserve = list.filter((item) => item.mustPreserve)
    const take = [...intervene.slice(0, Math.ceil(perStratum / 2)), ...preserve.slice(0, Math.floor(perStratum / 2))]
    for (const item of take) picked.set(item.id, item)
    void stratum
  }
  return [...picked.values()]
}

export function stratumCoverage(cases: LocalAiCase[]): Record<string, { n: number; intervene: number; preserve: number }> {
  const out: Record<string, { n: number; intervene: number; preserve: number }> = {}
  for (const item of cases) {
    for (const stratum of item.strata) {
      const bucket = out[stratum] ?? { n: 0, intervene: 0, preserve: 0 }
      bucket.n += 1
      if (item.shouldIntervene) bucket.intervene += 1
      if (item.mustPreserve) bucket.preserve += 1
      out[stratum] = bucket
    }
  }
  return out
}
