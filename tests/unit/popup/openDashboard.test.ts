import { describe, expect, it } from 'vitest'
import { dashboardUrl } from '../../../extension/src/popup/openDashboard.ts'

describe('dashboardUrl', () => {
  it('includes practice target query in hash', () => {
    const url = dashboardUrl('practice', 'spelling:recieved')
    expect(url).toContain('#practice?target=spelling%3Arecieved')
  })

  it('uses plain section hash without target', () => {
    const url = dashboardUrl('overview')
    expect(url.endsWith('#overview') || url === '#overview').toBe(true)
  })
})
