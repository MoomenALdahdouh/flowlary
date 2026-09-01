/**
 * Content-script account bootstrap — restores Phase 2 account context before features write.
 */

import { STORAGE_KEYS } from '@flowlary/shared'
import { activeAccountContext } from '../storage/activeAccountContext.ts'
import { parseAccountIdFromStorageKey } from '../storage/accountScopedStorage.ts'
import type { CorrectionModule } from '../features/correction/CorrectionFeature.ts'
import type { LayoutModule } from '../features/layout/LayoutFeature.ts'
import {
  DEFAULT_LAYOUT_PROFILE_STATE,
  normalizeLayoutProfileState,
} from '../features/layout/profile/index.ts'
import {
  detachActiveAccount,
  flowlaryStorage,
  getLayoutProfile,
  hydrateStateFromStorage,
  restoreActiveAccountFromSession,
  runStorageMigration,
} from '../storage/index.ts'
import { ensureHistoryInitialized } from '../storage/history/record.ts'
import { initializeFlowlaryCache } from '../storage/cache/index.ts'
import { readStoredString } from '../storage/schemas.ts'

export type ContentScriptBootstrapOptions = {
  layout?: LayoutModule
  correction?: CorrectionModule
}

let accountListenerInstalled = false

/** Policy keys that MUST rehydrate the content-script stateManager without reload. */
export const CONTENT_SCRIPT_POLICY_STORAGE_KEYS = [
  STORAGE_KEYS.settings,
  STORAGE_KEYS.correction,
  STORAGE_KEYS.translation,
  STORAGE_KEYS.layout,
  STORAGE_KEYS.layoutProfile,
] as const

function hasPolicyKeyChange(changes: Record<string, chrome.storage.StorageChange>): boolean {
  if (CONTENT_SCRIPT_POLICY_STORAGE_KEYS.some((key) => key in changes)) return true
  const accountId = activeAccountContext.getAccountId()
  if (!accountId) return false
  return Object.keys(changes).some((key) => {
    if (parseAccountIdFromStorageKey(key) !== accountId) return false
    return (
      key.endsWith('.correction') ||
      key.endsWith('.translation') ||
      key.endsWith('.layout') ||
      key.endsWith('.layout.profile')
    )
  })
}

export async function hydrateLayoutFeatureFromStorage(
  layout: LayoutModule | undefined,
): Promise<void> {
  if (!layout) return
  const profile = await getLayoutProfile(flowlaryStorage)
  layout.setProfileState(profile)
}

function resetLayoutFeatureProfile(layout: LayoutModule | undefined): void {
  layout?.setProfileState(normalizeLayoutProfileState(DEFAULT_LAYOUT_PROFILE_STATE))
}

async function applyAccountSessionToContentScript(
  options: ContentScriptBootstrapOptions,
): Promise<string | null> {
  const accountId = await restoreActiveAccountFromSession(flowlaryStorage)
  await hydrateStateFromStorage(flowlaryStorage)
  if (accountId) {
    await hydrateLayoutFeatureFromStorage(options.layout)
  } else {
    resetLayoutFeatureProfile(options.layout)
  }
  options.correction?.clearFieldStates()
  return accountId
}

async function handleAuthAccountIdStorageChange(
  change: chrome.storage.StorageChange,
  options: ContentScriptBootstrapOptions,
): Promise<void> {
  const nextRaw = change.newValue
  const nextId =
    nextRaw == null
      ? ''
      : readStoredString(
          typeof nextRaw === 'object' && nextRaw !== null && 'value' in nextRaw
            ? (nextRaw as { value: unknown }).value
            : nextRaw,
        ).trim()

  if (!nextId) {
    await detachActiveAccount(flowlaryStorage)
    resetLayoutFeatureProfile(options.layout)
    options.correction?.clearFieldStates()
    return
  }

  await applyAccountSessionToContentScript(options)
}

export function installContentScriptAccountListener(
  options: ContentScriptBootstrapOptions,
): void {
  if (accountListenerInstalled) return
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return
  accountListenerInstalled = true

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (STORAGE_KEYS.authAccountId in changes) {
      void handleAuthAccountIdStorageChange(changes[STORAGE_KEYS.authAccountId]!, options)
      return
    }
    if (hasPolicyKeyChange(changes)) {
      void (async () => {
        await hydrateStateFromStorage(flowlaryStorage)
        await hydrateLayoutFeatureFromStorage(options.layout)
      })()
    }
  })
}

/**
 * Restore account → hydrate state → layout profile before any feature writes.
 * Call before engine.start() / feature.start().
 */
export async function bootstrapContentScriptAccount(
  options: ContentScriptBootstrapOptions = {},
): Promise<string | null> {
  await runStorageMigration()
  const accountId = await applyAccountSessionToContentScript(options)
  await ensureHistoryInitialized()
  await initializeFlowlaryCache(flowlaryStorage)
  installContentScriptAccountListener(options)
  return accountId
}

/** Test helper — reset listener guard. */
export function resetContentScriptAccountListenerForTests(): void {
  accountListenerInstalled = false
}
