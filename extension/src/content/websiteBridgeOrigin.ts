/**
 * Origins allowed to talk to websiteBridge via window.postMessage.
 *
 * Do not gate local hosts on Vite `import.meta.env.DEV`. `vite build` for the
 * local API target still compiles DEV=false, but the script is injected on
 * flowlary.test and must accept that origin or sign-in never syncs.
 *
 * Production-API builds use the production manifest, which does not inject
 * this script on .test / localhost at all. Compare `import.meta.env` here so
 * the bundler can drop local-host string literals from the release artifact.
 */
export function isWebsiteBridgeOriginAllowed(
  origin: string,
  allowLocalDevHosts: boolean,
): boolean {
  try {
    const host = new URL(origin).hostname
    if (host === 'flowlary.com' || host.endsWith('.flowlary.com')) return true
    if (import.meta.env.VITE_FLOWLARY_API_TARGET === 'production') return false
    if (!allowLocalDevHosts) return false
    return (
      host === 'flowlary.test' ||
      host.endsWith('.flowlary.test') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    )
  } catch {
    return false
  }
}
