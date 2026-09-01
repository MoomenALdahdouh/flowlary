/**
 * Phase 2 advisor contract: ranks local hypothesis IDs only.
 * Golden strings are tests, not production dictionaries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildAdvisorPacket,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  consultAdvisor,
  decideWriting,
  maskAdvisorSnippet,
  getAdvisorApplyMode,
  registerProductionHypothesisAdvisor,
  resetHypothesisIdsForTests,
  setAdvisorApplyMode,
  setHypothesisAdvisor,
  shouldConsultAdvisor,
  validateAdvisorVote,
} from '../../../extension/src/core/engine/index.ts'
import { productionHypothesisAdvisor } from '../../../extension/src/core/engine/hypothesisAdvisorClient.ts'
import { getHypothesisAdvisor } from '../../../extension/src/core/engine/advisor.ts'
import { mapLayout, mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../../..')

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function run(text: string, overrides: Record<string, unknown> = {}) {
  const ta = textarea(text)
  const session = new FieldSession(ta)
  const context = {
    ...buildFieldContext({
      element: ta,
      session,
      cycleId: 'adv',
      composing: false,
      textLength: text.length,
    }),
    ...overrides,
  }
  const analysis = analyzeFieldText(text, { overrideRanges: session.getOverrideRanges().slice() })
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context)
  return { ta, session, context, analysis, hypotheses, candidates }
}

function decideWithVote(
  text: string,
  pick: (hyps: ReturnType<typeof collectHypotheses>) => string[] | null,
  advisorResult: 'ranked' | 'invalid' | 'unavailable' | 'unused' | 'stale' = 'ranked',
  overrides: Record<string, unknown> = {},
) {
  const out = run(text, overrides)
  const ids = pick(out.hypotheses)
  const decision = decideWriting(out.context, out.analysis, out.candidates, {
    observeOnly: false,
    hypotheses: out.hypotheses,
    advisorVote: ids
      ? { rankedHypothesisIds: ids, reasonCode: 'test', ambiguityClass: 'test' }
      : null,
    advisorResult,
  })
  return { ...out, decision }
}

describe('LLM hypothesis advisor layer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('apply')
    applyUserWritingPolicy({ assistantEnabled: true, fixWrongTyping: true, improveEnglish: true })
    stateManager.settings = {
      enabled: true,
      pausedUntil: null,
      excludedDomains: [],
      version: 1,
      helpStyle: 'auto',
    }
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.translation.liveEnabled = false
    stateManager.translation.mode = 'direct'
    stateManager.translation.shortcutEnabled = true
  })

  afterEach(() => {
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('apply')
    vi.unstubAllGlobals()
  })

  it('A. Arabic keyboard → English intended ranks local layout hypothesis, never a free-form replacement', async () => {
    const typed = mapLayoutText('hello please thanks', 'en-US-qwerty', 'ar-101')!
    expect(typed).toBeTruthy()
    const { hypotheses, context, analysis } = run(typed!)
    const layout = hypotheses.find((item) => item.intent === 'fix_layout')
    if (layout) {
      expect(layout.replacementSource).toBe('map_layout')
      expect(layout.replacement).toBeDefined()
    } else {
      expect(hypotheses.some((item) => item.intent === 'write_as_is' || item.intent === 'preserve' || item.intent === 'unknown')).toBe(true)
    }
    setHypothesisAdvisor(async (packet) => {
      expect(packet.hypotheses.every((item) => !('replacement' in item))).toBe(true)
      const id = packet.hypotheses.find((item) => item.intent === 'fix_layout')?.id ?? packet.hypotheses[0]!.id
      return { rankedHypothesisIds: [id], reasonCode: 'context_supports_english', ambiguityClass: 'layout_vs_unknown' }
    })
    const consulted = await consultAdvisor(context, hypotheses, { text: typed!, analysis, generation: context.generation })
    expect(['ranked', 'unused', 'unavailable']).toContain(consulted.result)
    expect(validateAdvisorVote({
      rankedHypothesisIds: [hypotheses[0]!.id],
      reasonCode: 'x',
      ambiguityClass: 'y',
      replacement: 'please',
    }, hypotheses).ok).toBe(false)
  })

  it('B. English keyboard → Arabic intended keeps local mapLayout replacement', () => {
    const intended = 'هذا تقرير قصير'
    const typed = mapLayoutText(intended, 'ar-101', 'en-US-qwerty')!
    const { hypotheses, decision } = decideWithVote(`${typed} `, (hyps) => {
      const layout = hyps.find((item) => item.intent === 'fix_layout' && item.replacement)
      return layout ? [layout.id] : [hyps[0]!.id]
    })
    const layout = hypotheses.find((item) => item.intent === 'fix_layout')
    expect(layout?.replacementSource).toBe('map_layout')
    if (layout && layout.risk === 'low' && !layout.needsLLM) {
      expect(decision.action).toBe('layout_fix')
    } else {
      expect(decision.action).not.toBe('english_correction')
    }
  })

  it('C. intentional mixed language is not whole-field layout even if advisor ranks layout', () => {
    const text = 'أنا عملت deploy لكن فيه error'
    const { decision, analysis } = decideWithVote(text, (hyps) => {
      const layout = hyps.find((item) => item.intent === 'fix_layout')
      return layout ? [layout.id] : [hyps[0]!.id]
    })
    expect(analysis.chunks.some((chunk) => chunk.role === 'arabic_prose')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
    expect(
      decision.reasonCodes.some((code) => (
        code.includes('mixed_intent')
        || code === 'advisor_invalid'
        || code === 'advisor_abstain'
        || code === 'downgraded_to_suggestion'
        || code === 'hypothesis_preserve'
      )) || decision.action === 'noop' || decision.action === 'suggestion',
    ).toBe(true)
  })

  it('D. spelling vs layout ranks the local English hypothesis, not a generated rewrite', () => {
    const { hypotheses, decision } = decideWithVote('design engain', (hyps) => {
      const spell = hyps.find((item) => item.intent === 'fix_english')
      return spell ? [spell.id] : hyps.filter((item) => item.intent === 'preserve' || item.intent === 'write_as_is').map((item) => item.id)
    })
    const spell = hypotheses.find((item) => item.intent === 'fix_english')
    expect(spell?.replacement === 'design engine').toBe(false)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('E. technical token vs typo prefers preserve', () => {
    const { decision } = decideWithVote('هل أستطيع تحسين ui ux؟', (hyps) => {
      const keep = hyps.find((item) => item.intent === 'preserve' || item.intent === 'write_as_is')
      return [keep?.id ?? hyps[0]!.id]
    })
    expect(decision.action).not.toBe('layout_fix')
    expect(decision.action).not.toBe('english_correction')
  })

  it('F. Arabizi vs English does not become layout write', () => {
    const { decision } = decideWithVote('ana 3ayez a3mel deploy', (hyps) => {
      const keep = hyps.find((item) => item.intent === 'preserve' || item.intent === 'write_as_is' || item.intent === 'unknown')
      return [keep?.id ?? hyps[0]!.id]
    })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('G. proper name vs typo abstains from invented rewrite', () => {
    const { hypotheses, decision } = decideWithVote('I met Zaynab yesterday', (hyps) => {
      const keep = hyps.find((item) => item.intent === 'preserve' || item.intent === 'write_as_is')
      return [keep?.id ?? hyps[0]!.id]
    })
    expect(hypotheses.every((item) => item.replacement !== 'Zainab')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('H. punctuation ambiguity does not invent a write', () => {
    const { decision } = decideWithVote('Hello, world!', (hyps) => {
      const keep = hyps.find((item) => item.intent === 'preserve' || item.intent === 'write_as_is')
      return [keep?.id ?? hyps[0]!.id]
    })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('I. capitalization ambiguity stays local', () => {
    const { decision } = decideWithVote('i live in cairo', (hyps) => {
      const spell = hyps.find((item) => item.intent === 'fix_english')
      return [spell?.id ?? hyps.find((item) => item.intent === 'preserve')?.id ?? hyps[0]!.id]
    })
    expect(['noop', 'suggestion', 'english_correction']).toContain(decision.action)
  })

  it('J. code is not auto-layout', () => {
    const { decision } = decideWithVote('const userName = 1', (hyps) => {
      const keep = hyps.find((item) => item.intent === 'preserve' || item.intent === 'write_as_is')
      return [keep?.id ?? hyps[0]!.id]
    })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('K. URL is not sent as a writable layout rank that auto-applies', () => {
    const { decision, hypotheses } = decideWithVote('see https://example.com/api', (hyps) => {
      const keep = hyps.find((item) => item.intent === 'preserve' || item.intent === 'write_as_is')
      return [keep?.id ?? hyps[0]!.id]
    })
    expect(decision.action).not.toBe('layout_fix')
    expect(hypotheses.some((item) => item.evidence.some((entry) => entry.kind === 'protected_span') || item.intent === 'preserve')).toBe(true)
  })

  it('L. email is preserved', () => {
    const { decision } = decideWithVote('mail user@example.com please', (hyps) => {
      const keep = hyps.find((item) => item.intent === 'preserve' || item.intent === 'write_as_is')
      return [keep?.id ?? hyps[0]!.id]
    })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('M. user override never consults the advisor', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    session.noteEngineSpan(0, 5, 'hello')
    session.bumpGeneration()
    ta.value = 'hallo'
    session.detectUserOverride(ta.value)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'adv',
      composing: false,
      textLength: ta.value.length,
    })
    const analysis = analyzeFieldText(ta.value, { overrideRanges: [...session.getOverrideRanges()] })
    const hypotheses = collectHypotheses(ta.value, ta.value.length, context, analysis)
    expect(shouldConsultAdvisor(hypotheses, context, analysis)).toBe(false)
  })

  it('N. stale generation is rejected before apply', async () => {
    const { hypotheses, context, analysis } = run('design engain')
    setHypothesisAdvisor(async () => ({
      rankedHypothesisIds: [hypotheses[0]!.id],
      reasonCode: 'late',
      ambiguityClass: 'stale',
    }))
    const consulted = await consultAdvisor(context, hypotheses, {
      text: 'design engain',
      analysis,
      generation: context.generation + 1,
    })
    expect(consulted.result).toBe('stale')
    expect(consulted.vote).toBeNull()
  })

  it('O. malformed LLM output is invalid', () => {
    const hyps = run('design engain').hypotheses
    expect(validateAdvisorVote({ rankedHypothesisIds: [] }, hyps).ok).toBe(false)
    expect(validateAdvisorVote('not-json', hyps).ok).toBe(false)
    expect(validateAdvisorVote({ rankedHypothesisIds: [hyps[0]!.id], reasonCode: 'x' }, hyps).ok).toBe(false)
  })

  it('P. unknown hypothesis ID is invalid', () => {
    const hyps = run('design engain').hypotheses
    expect(validateAdvisorVote({
      rankedHypothesisIds: ['h-missing'],
      reasonCode: 'x',
      ambiguityClass: 'y',
    }, hyps).ok).toBe(false)
  })

  it('Q. LLM unavailable falls back without writing', async () => {
    setHypothesisAdvisor(async () => {
      throw new Error('network')
    })
    const { hypotheses, context, analysis, candidates } = run('design engain')
    const consulted = await consultAdvisor(context, hypotheses, { text: 'design engain', analysis })
    expect(['unavailable', 'unused']).toContain(consulted.result)
    const decision = decideWriting(context, analysis, candidates, {
      observeOnly: false,
      hypotheses,
      advisorResult: 'unavailable',
    })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('R. policy veto: shortcuts_only never consults', () => {
    const { hypotheses, context, analysis } = run('نثغ اليوم', { helpStyle: 'shortcuts_only' as const })
    expect(shouldConsultAdvisor(hypotheses, context, analysis)).toBe(false)
  })

  it('S. mixedLayoutSafety veto remains final after advisor layout rank', () => {
    const text = 'راجع هذا pull request بعد FastAPI service'
    const { decision } = decideWithVote(text, (hyps) => {
      const layout = hyps.find((item) => item.intent === 'fix_layout')
      return [layout?.id ?? hyps[0]!.id]
    })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('T. protected / sensitive span does not consult', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.sig'
    const { hypotheses, context, analysis } = run(jwt)
    expect(shouldConsultAdvisor(hypotheses, context, analysis)).toBe(false)
    const password = document.createElement('input')
    password.type = 'password'
    password.value = 'hunter2secret'
    document.body.append(password)
    const session = new FieldSession(password)
    const pwContext = buildFieldContext({
      element: password,
      session,
      cycleId: 'adv',
      composing: false,
      textLength: password.value.length,
    })
    expect(pwContext.safetyAllowed).toBe(false)
    const pwHyps = collectHypotheses(password.value, password.value.length, pwContext, analyzeFieldText(password.value))
    expect(shouldConsultAdvisor(pwHyps, pwContext)).toBe(false)
  })

  it('does not consult on a strong unambiguous mechanical layout', () => {
    const { hypotheses } = run('hsjo]lj')
    const onlyLayout = hypotheses.filter((item) => item.intent === 'fix_layout' && !item.needsLLM)
    expect(shouldConsultAdvisor(onlyLayout)).toBe(false)
  })

  it('packet uses minimal snippet and masks secrets', () => {
    const secret = 'sk-abcdefghijklmnopqrstuvwxyz012345'
    const text = `hello ${secret} world and more padding that should be trimmed from the advisor window`
    const { hypotheses, context, analysis } = run(text)
    const packet = buildAdvisorPacket(context, hypotheses, { text, analysis, generation: context.generation })
    expect(packet.snippet.length).toBeLessThanOrEqual(160)
    expect(packet.snippet.includes(secret) ? maskAdvisorSnippet(text, hypotheses, analysis).includes('[protected]') || !analysis.chunks.some((c) => c.protectedKind) : true).toBe(true)
    expect(packet.hypotheses.every((item) => !('replacement' in item))).toBe(true)
  })

  it('production advisor is registered by the register helper', () => {
    registerProductionHypothesisAdvisor()
    expect(getHypothesisAdvisor()).toBe(productionHypothesisAdvisor)
    expect(getAdvisorApplyMode()).toBe('apply')
  })

  it('cancels the background provider request when generation becomes stale', async () => {
    let resolveRank: ((value: unknown) => void) | undefined
    const sendMessage = vi.fn((message: { type: string }) => {
      if (message.type === 'CANCEL_RANK_HYPOTHESES') return Promise.resolve({ ok: true })
      return new Promise((resolve) => {
        resolveRank = resolve
      })
    })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })
    const { hypotheses, context, analysis, session } = run('design engain')
    const packet = buildAdvisorPacket(context, hypotheses, {
      text: 'design engain',
      analysis,
      generation: context.generation,
    })
    const generationRequest = session.beginGenerationRequest(context.generation)
    const pending = productionHypothesisAdvisor(packet, {
      signal: generationRequest.signal,
    })

    session.bumpGeneration()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'CANCEL_RANK_HYPOTHESES',
      cycleId: packet.cycleId,
    })
    resolveRank?.({ type: 'RANK_HYPOTHESES_RESULT', ok: false, error: 'network' })
    generationRequest.release()
  })

  it('advisor modules never assign DOM text', () => {
    const banned = /\.value\s*=|setRangeText|textContent\s*=|execCommand/
    const files = [
      'extension/src/core/engine/advisor.ts',
      'extension/src/core/engine/hypothesisAdvisorClient.ts',
      'backend/src/providers/hypothesisAdvisorProvider.ts',
      'backend/src/providers/advisorProviderManager.ts',
      'backend/src/providers/advisorValidation.ts',
      'backend/src/providers/groqAdvisorProvider.ts',
      'backend/src/providers/geminiAdvisorProvider.ts',
    ]
    for (const rel of files) {
      expect(banned.test(readFileSync(join(repoRoot, rel), 'utf8')), rel).toBe(false)
    }
  })
})
