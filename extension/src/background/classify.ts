import type { LayoutId } from '../features/layout/layouts/types.ts'
import {
  inferSourceLayout,
  localClassificationHint,
  mapLayout,
  normalizeProfile,
} from '../features/layout/layouts/index.ts'

import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import {
  buildFlowlaryApiHeaders,
  ensureInstallAuth,
  resolveEntitlementHeader,
} from '../config/auth.ts'
import { flowlaryStorage, getEntitlement, resolveEntitlementStatus } from '../storage/index.ts'

export type CheckWordRequest = {
  type: 'CHECK_WORD'
  word: string
  context?: string
  sourceLayout?: string
  candidateLayouts?: string[]
}

export type CheckWordResponse =
  | {
      type: 'CHECK_WORD_RESULT'
      result: { kind: 'VALID' | 'LAYOUT_MISMATCH'; targetLayout?: LayoutId }
      corrected?: string
      sourceLayout: LayoutId
    }
  | { type: 'CHECK_WORD_ERROR'; reason?: string }

export async function handleCheckWord(message: CheckWordRequest): Promise<CheckWordResponse> {
  const profile = normalizeProfile({
    sourceLayout: message.sourceLayout ?? 'en-US-qwerty',
    enabledLayouts: message.candidateLayouts ?? ['en-US-qwerty', 'ar-101'],
  })

  const word = message.word.trim()
  if (!word) {
    return { type: 'CHECK_WORD_ERROR', reason: 'empty' }
  }

  const hint = localClassificationHint(word, profile, message.context ?? '')
  const source = inferSourceLayout(word, profile) ?? profile.sourceLayout

  if (hint) {
    if (hint.kind === 'VALID') {
      return { type: 'CHECK_WORD_RESULT', result: { kind: 'VALID' }, sourceLayout: source }
    }
    const corrected = mapLayout(word, source, hint.targetLayout)
    return {
      type: 'CHECK_WORD_RESULT',
      result: { kind: 'LAYOUT_MISMATCH', targetLayout: hint.targetLayout },
      corrected: corrected ?? undefined,
      sourceLayout: source,
    }
  }

  try {
    const entitlement = resolveEntitlementStatus(await getEntitlement(flowlaryStorage))
    const auth = await ensureInstallAuth(flowlaryStorage)
    const response = await fetch(`${FLOWLARY_API_BASE}/api/ai/layout-classification`, {
      method: 'POST',
      headers: buildFlowlaryApiHeaders(auth, resolveEntitlementHeader(entitlement)),
      body: JSON.stringify({
        word,
        context: message.context,
        source_layout: source,
        candidate_layouts: profile.enabledLayouts.filter((id) => id !== source),
      }),
    })

    if (!response.ok) {
      return { type: 'CHECK_WORD_ERROR', reason: `http_${response.status}` }
    }

    const payload = (await response.json()) as {
      result?: { kind: 'VALID' | 'LAYOUT_MISMATCH'; target_layout?: string | null }
      ok?: boolean
    }

    const result = payload.result ?? (payload as { result: { kind: 'VALID' | 'LAYOUT_MISMATCH'; target_layout?: string | null } }).result
    if (!result) {
      return { type: 'CHECK_WORD_ERROR', reason: 'invalid_response' }
    }

    if (result.kind === 'VALID') {
      return { type: 'CHECK_WORD_RESULT', result: { kind: 'VALID' }, sourceLayout: source }
    }

    const targetLayout = result.target_layout as LayoutId
    const corrected = mapLayout(word, source, targetLayout)
    return {
      type: 'CHECK_WORD_RESULT',
      result: { kind: 'LAYOUT_MISMATCH', targetLayout },
      corrected: corrected ?? undefined,
      sourceLayout: source,
    }
  } catch {
    return { type: 'CHECK_WORD_ERROR', reason: 'network' }
  }
}
