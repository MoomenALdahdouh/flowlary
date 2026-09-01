import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollToHash, scrollToTop } from '../lib/scroll.ts'

/**
 * React Router updates the URL without native hash scrolling, and it keeps
 * the previous scroll position when the path changes. Restore both.
 */
export function ScrollManager() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (!hash) {
      scrollToTop()
      return
    }

    let cancelled = false
    const attempt = (remaining: number) => {
      if (cancelled) return
      if (scrollToHash(hash) || remaining <= 0) return
      window.requestAnimationFrame(() => attempt(remaining - 1))
    }
    attempt(12)
    return () => {
      cancelled = true
    }
  }, [pathname, hash])

  return null
}
