import { describe, expect, it } from 'vitest'
import { buildStatus, handleMessage } from '../../extension/src/background/index.ts'

describe('Messaging', () => {
  it('responds to GET_STATUS', async () => {
    const status = await buildStatus()
    expect(status.brand.name).toBe('Flowlary')
    expect(status.active).toBe(true)
    expect(status.features).toHaveProperty('correction')
    expect(status.entitlement).toHaveProperty('status')

    const response = await handleMessage({ type: 'GET_STATUS' })
    expect(response).toMatchObject({ brand: { name: 'Flowlary' } })
  })
})
