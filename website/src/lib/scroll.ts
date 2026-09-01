/** Hash fragment without the leading `#`. */
export function readHashId(hash: string): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, '')).trim()
  return id || null
}

export function scrollToHash(hash: string, doc: Pick<Document, 'getElementById'> = document): boolean {
  const id = readHashId(hash)
  if (!id) return false
  const node = doc.getElementById(id)
  if (!node || typeof node.scrollIntoView !== 'function') return false
  node.scrollIntoView({ block: 'start', behavior: 'auto' })
  return true
}

export function scrollToTop(): void {
  window.scrollTo(0, 0)
}
