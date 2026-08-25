/** Legacy storage keys — read-only during migration; never delete in Phase 10. */

export const LEGACY_EWA = {
  settings: 'ewa_settings',
  groqApiKey: 'ewa_groq_api_key',
  history: 'ewa_history',
} as const

export const LEGACY_LINGO = {
  profile: 'lingoProfile',
  usage: 'lingoUsage',
  licenseCache: 'lingoLicenseCache',
  licenseKey: 'lingoLicenseKey',
  firstActivatedAt: 'lingoFirstActivatedAt',
} as const

export const LEGACY_LAYFIX = {
  profile: 'autofixProfile',
  events: 'autofixEvents',
  history: 'autofixHistory',
  wordCache: 'wordCacheV2',
  usage: 'autofixUsage',
  licenseCache: 'autofixLicenseCache',
  firstActivatedAt: 'autofixFirstActivatedAt',
  licenseKey: 'licenseKey',
  /** Legacy sync mirror keys (Layfix background.ts). */
  syncEnabled: 'enabled',
  syncLayoutProfile: 'layoutProfile',
  syncExcludedDomains: 'excludedDomains',
} as const

export const ALL_LEGACY_KEYS = [
  ...Object.values(LEGACY_EWA),
  ...Object.values(LEGACY_LINGO),
  ...Object.values(LEGACY_LAYFIX),
] as const
