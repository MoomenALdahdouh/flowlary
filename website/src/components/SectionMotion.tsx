import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isSectionAlreadyVisible, SECTION_REVEAL_CLASS, shouldObserveSection } from '../lib/sectionReveal.ts'

const SKIP_PREFIXES = ['/dashboard', '/account', '/lab']

const OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: '0px 0px -14% 0px',
  threshold: 0.06,
}

export function SectionMotion() {
  const { pathname } = useLocation()
  const skip = SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  useLayoutEffect(() => {
    if (skip) return
    const root = document.getElementById('content')
    if (!root || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      }
    }, OBSERVER_OPTIONS)

    const bind = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      for (const section of root.querySelectorAll('section')) {
        if (!shouldObserveSection(section)) continue
        section.classList.add(SECTION_REVEAL_CLASS)
        if (isSectionAlreadyVisible(section, viewportHeight)) {
          section.classList.add('is-in')
          continue
        }
        observer.observe(section)
      }
    }

    bind()
    const mutations = new MutationObserver(bind)
    mutations.observe(root, { childList: true, subtree: true })
    return () => {
      mutations.disconnect()
      observer.disconnect()
    }
  }, [pathname, skip])

  return null
}
