import { BRAND } from '@flowlary/shared'

/** Authoritative stable extension version (matches package manifests / BRAND). */
export const STABLE_EXTENSION_VERSION = BRAND.version

/** Release ZIP name from `npm run package:release`. */
export const STABLE_EXTENSION_ZIP_NAME = `flowlary-v${STABLE_EXTENSION_VERSION}.zip`

/** Public static path served from `website/public/downloads/`. */
export const STABLE_EXTENSION_DOWNLOAD_PATH = `/downloads/${STABLE_EXTENSION_ZIP_NAME}`
