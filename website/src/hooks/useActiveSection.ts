import { useEffect, useState } from 'react'
import { resolveActiveSectionId } from '../lib/activeSection.ts'
import { readHashId } from '../lib/scroll.ts'

const HEADER_OFFSET_PX = 112

function initialId(ids: readonly string[]): string {
  if (typeof window === 'undefined') return ids[0] ?? ''
  const hashId = readHashId(window.location.hash)
  if (hashId && ids.includes(hashId)) return hashId
  return ids[0] ?? ''
}

export function useActiveSection(ids: readonly string[], offsetPx = HEADER_OFFSET_PX) {
  const idsKey = ids.join('\0')
  const [spyId, setSpyId] = useState(() => initialId(ids))
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  useEffect(() => {
    const list = idsKey ? idsKey.split('\0') : []
    if (typeof window === 'undefined' || list.length === 0) return

    let frame = 0
    const measure = () => {
      const next = resolveActiveSectionId(
        list,
        (id) => {
          const node = document.getElementById(id)
          return node ? node.getBoundingClientRect().top : null
        },
        offsetPx,
      )
      if (next) setSpyId(next)
    }

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.addEventListener('hashchange', measure)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('hashchange', measure)
    }
  }, [idsKey, offsetPx])

  useEffect(() => {
    if (pinnedId && spyId === pinnedId) setPinnedId(null)
  }, [pinnedId, spyId])

  return {
    activeId: pinnedId ?? spyId,
    activate: setPinnedId,
  }
}
