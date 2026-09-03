import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion.ts'

/** Reveal text character-by-character when active. */
export function useTypingReveal(text: string, active: boolean, charMs = 85) {
  const reduced = usePrefersReducedMotion()
  const [length, setLength] = useState(0)

  useEffect(() => {
    if (!active) {
      setLength(0)
      return
    }

    if (reduced) {
      setLength(text.length)
      return
    }

    setLength(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setLength(i)
      if (i >= text.length) window.clearInterval(id)
    }, charMs)

    return () => window.clearInterval(id)
  }, [active, charMs, reduced, text])

  return text.slice(0, length)
}
