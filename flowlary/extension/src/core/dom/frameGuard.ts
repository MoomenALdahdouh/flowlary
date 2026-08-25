/**
 * iframe policy (Phase 1 decision — see docs/architecture/FLOWLARY_ARCHITECTURE.md):
 *
 * Manifest declares `all_frames: true` (EWA audit recommendation) so same-origin
 * embedded editors (e.g. Gmail compose iframes) can be assisted.
 *
 * Cross-origin frames are skipped — we cannot safely probe or write DOM there.
 */
export function shouldProcessFrame(windowRef: Window = window): boolean {
  if (windowRef === windowRef.top) return true

  try {
    // Same-origin iframes: accessing frameElement does not throw.
    const frame = windowRef.frameElement
    if (!frame) return false
    void windowRef.top?.location.href
    return true
  } catch {
    return false
  }
}

export function markPageActive(marker: string): void {
  if (!shouldProcessFrame()) return
  document.documentElement.dataset[marker] = 'active'
}
