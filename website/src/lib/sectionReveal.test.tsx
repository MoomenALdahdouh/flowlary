import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Reveal } from '../components/Reveal.tsx'
import { isSectionAlreadyVisible, SECTION_REVEAL_CLASS, shouldObserveSection } from '../lib/sectionReveal.ts'

describe('section scroll motion', () => {
  it('marks reveal variants in markup', () => {
    expect(renderToStaticMarkup(<Reveal>Copy</Reveal>)).toContain('class="reveal"')
    expect(renderToStaticMarkup(<Reveal variant="clip">Title</Reveal>)).toContain('reveal-clip')
    expect(renderToStaticMarkup(<Reveal variant="start">Aside</Reveal>)).toContain('reveal-start')
    expect(renderToStaticMarkup(<Reveal variant="end" className="reveal-d2">Demo</Reveal>)).toContain(
      'reveal-end',
    )
    expect(renderToStaticMarkup(<Reveal variant="scale">Stage</Reveal>)).toContain('reveal-scale')
  })

  it('skips sections that already animate their own children', () => {
    const section = document.createElement('section')
    const inner = document.createElement('div')
    inner.className = 'reveal'
    section.append(inner)
    expect(shouldObserveSection(section)).toBe(false)
  })

  it('observes plain marketing sections until they have entered', () => {
    const section = document.createElement('section')
    section.innerHTML = '<div class="container-flow"><h2>Next</h2></div>'
    expect(shouldObserveSection(section)).toBe(true)
    section.classList.add(SECTION_REVEAL_CLASS)
    expect(shouldObserveSection(section)).toBe(true)
    section.classList.add('is-in')
    expect(shouldObserveSection(section)).toBe(false)
  })

  it('treats above-the-fold sections as already visible', () => {
    const onScreen = document.createElement('section')
    const offScreen = document.createElement('section')
    Object.defineProperty(onScreen, 'getBoundingClientRect', {
      value: () => ({ top: 40, bottom: 320, width: 800, height: 280 }),
    })
    Object.defineProperty(offScreen, 'getBoundingClientRect', {
      value: () => ({ top: 900, bottom: 1200, width: 800, height: 300 }),
    })
    expect(isSectionAlreadyVisible(onScreen, 800)).toBe(true)
    expect(isSectionAlreadyVisible(offScreen, 800)).toBe(false)
  })
})
