import { startTransition, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: '0px 0px 8% 0px',
  threshold: 0,
}

function isNodeVisible(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  const vh = window.innerHeight || document.documentElement.clientHeight
  return rect.bottom > 0 && rect.top < vh
}

export function useInView<T extends HTMLElement>(once = true): {
  ref: RefObject<T | null>
  inView: boolean
} {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    if (isNodeVisible(node)) {
      setInView(true)
      if (once) return
    }

    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (frame) window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(() => {
          frame = 0
          startTransition(() => setInView(true))
        })
        if (once) observer.disconnect()
      } else if (!once) {
        startTransition(() => setInView(false))
      }
    }, OBSERVER_OPTIONS)

    observer.observe(node)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [once])

  return { ref, inView }
}
