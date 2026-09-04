/**
 * API endpoint configuration.
 *
 * Hosts are chosen at build time (`FLOWLARY_API_TARGET=local|production`).
 * Vite always injects these values from `apiTargets.ts`.
 * `extension/.env.local` cannot override them.
 *
 * Auth, session refresh, and entitlement all use `FLOWLARY_API_BASE`.
 */

/** True for production-API builds (`build:ext:production` / `build:release`). */
export const isProductionApiTarget = import.meta.env.VITE_FLOWLARY_API_TARGET === 'production'

/** Unified Flowlary API — correction, translation, layout, auth, entitlement. */
export const FLOWLARY_API_BASE = String(import.meta.env.VITE_FLOWLARY_API_URL ?? '')

export const FLOWLARY_SITE_URL = String(import.meta.env.VITE_FLOWLARY_SITE_URL ?? '')

/** Alias of the selected API (local in tests and `build:ext:local`). */
export const LOCAL_DEV_API_BASE = FLOWLARY_API_BASE

/** @deprecated Use FLOWLARY_API_BASE. Kept for transitional tests. */
export const TRANSLATION_API_BASE = FLOWLARY_API_BASE

/** @deprecated Use FLOWLARY_API_BASE. Kept for transitional tests. */
export const LAYOUT_API_BASE = FLOWLARY_API_BASE
