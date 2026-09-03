import { useEffect, useRef } from 'react'

/** Passive scroll listener coalesced to one callback per animation frame. */
export function useRafScroll(onScroll: () => void, enabled = true) {
  const onScrollRef = useRef(onScroll)
  onScrollRef.current = onScroll

  useEffect(() => {
    if (!enabled) return

    let frame = 0
    const handleScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        onScrollRef.current()
      })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [enabled])
}
