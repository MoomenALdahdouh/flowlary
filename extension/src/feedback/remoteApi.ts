import { BRAND } from '@flowlary/shared'
import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import { readAccountSession, type AccountSession } from '../config/accountAuth.ts'
import type { FlowlaryStorage } from '../storage/index.ts'

async function authedFetch(
  storage: FlowlaryStorage,
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const session = await readAccountSession(storage)
  if (!session) return null
  try {
    return await fetch(`${FLOWLARY_API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'X-Flowlary-Client': 'extension',
        ...(init.headers ?? {}),
      },
    })
  } catch {
    return null
  }
}

export async function recordFeedbackMeaningfulUse(
  storage: FlowlaryStorage,
  feature: string | null,
): Promise<void> {
  const response = await authedFetch(storage, '/api/feedback/meaningful-use', {
    method: 'POST',
    body: JSON.stringify({ feature }),
  })
  if (!response?.ok) return
}

export async function fetchFeedbackEligibility(storage: FlowlaryStorage): Promise<{
  eligiblePrompts: string[]
} | null> {
  const response = await authedFetch(storage, '/api/feedback/eligibility')
  if (!response?.ok) return null
  const body = (await response.json().catch(() => ({}))) as { eligiblePrompts?: string[] }
  return { eligiblePrompts: body.eligiblePrompts ?? [] }
}

export async function submitExtensionFeedback(
  storage: FlowlaryStorage,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const response = await authedFetch(storage, '/api/feedback', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      source: 'extension',
      metadata: { extensionVersion: BRAND.version, userAgent: navigator.userAgent.slice(0, 300) },
    }),
  })
  return Boolean(response?.ok)
}

export async function dismissExtensionFeedbackPrompt(
  storage: FlowlaryStorage,
  promptId: string,
  action: 'not_now' | 'dont_ask_again',
): Promise<boolean> {
  const response = await authedFetch(storage, '/api/feedback/dismiss', {
    method: 'POST',
    body: JSON.stringify({ promptId, action }),
  })
  return Boolean(response?.ok)
}

export async function markExtensionPromptShown(storage: FlowlaryStorage, promptId: string): Promise<void> {
  await authedFetch(storage, '/api/feedback/prompt-shown', {
    method: 'POST',
    body: JSON.stringify({ promptId }),
  })
}

export async function markFirstWinCompletedRemote(storage: FlowlaryStorage): Promise<void> {
  await authedFetch(storage, '/api/feedback/first-win', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function featureForCommand(operation: string): string | null {
  switch (operation) {
    case 'CORRECT':
      return 'correction'
    case 'TRANSLATE':
      return 'translation'
    case 'FIX_LAYOUT':
      return 'layout'
    default:
      return null
  }
}

export type { AccountSession }
