import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion.ts'

/** Long scroll-driven sections are disabled on small screens and reduced motion. */
export function useScrollDriveEnabled() {
  const reduced = usePrefersReducedMotion()
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 768px)').matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setEnabled(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return enabled && !reduced
}
