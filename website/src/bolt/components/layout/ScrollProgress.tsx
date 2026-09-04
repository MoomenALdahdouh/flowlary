import { useEffect } from 'react'

/** Thin reading progress for marketing pages. */
export function ScrollProgress() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.fl-scroll-progress')
    if (!el) return
    if (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: scroll()')) return

    const onScroll = () => {
      const root = document.documentElement
      const max = root.scrollHeight - root.clientHeight
      el.style.transform = `scaleX(${max > 0 ? root.scrollTop / max : 0})`
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <div className="fl-scroll-progress" aria-hidden="true" />
}

