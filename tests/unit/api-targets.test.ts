import { describe, expect, it } from 'vitest'
import {
  FLOWLARY_API_TARGETS,
  InvalidApiTargetError,
  resolveFlowlaryApiTarget,
} from '../../extension/src/config/apiTargets.ts'

describe('resolveFlowlaryApiTarget', () => {
  it('defaults to the local Node gateway', () => {
    expect(resolveFlowlaryApiTarget({})).toEqual({
      id: 'local',
      apiUrl: 'http://127.0.0.1:8787',
      siteUrl: 'https://flowlary.test',
      useProductionManifest: false,
    })
  })

  it('selects production hosts without a release flag', () => {
    expect(resolveFlowlaryApiTarget({ FLOWLARY_API_TARGET: 'production' })).toEqual({
      id: 'production',
      apiUrl: 'https://api.flowlary.com',
      siteUrl: 'https://flowlary.com',
      useProductionManifest: true,
    })
  })

  it('forces production when FLOWLARY_RELEASE=1', () => {
    const resolved = resolveFlowlaryApiTarget({ FLOWLARY_RELEASE: '1' })
    expect(resolved.id).toBe('production')
    expect(resolved.apiUrl).toBe(FLOWLARY_API_TARGETS.production.apiUrl)
    expect(resolved.useProductionManifest).toBe(true)
  })

  it('rejects mixing a release build with the local target', () => {
    expect(() =>
      resolveFlowlaryApiTarget({ FLOWLARY_RELEASE: '1', FLOWLARY_API_TARGET: 'local' }),
    ).toThrow(InvalidApiTargetError)
  })

  it('rejects unknown targets', () => {
    expect(() => resolveFlowlaryApiTarget({ FLOWLARY_API_TARGET: 'staging' })).toThrow(
      /Invalid FLOWLARY_API_TARGET/,
    )
  })
})
