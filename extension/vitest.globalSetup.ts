import { ensureTestApiServer, stopTestApiServer } from '../tests/helpers/testApiServer.ts'

export default async function globalSetup(): Promise<() => Promise<void>> {
  process.env.FLOWLARY_EXTENSION_TEST_API = '1'
  const { started } = await ensureTestApiServer()
  process.env.FLOWLARY_TEST_API_STARTED = started ? '1' : '0'
  return async () => {
    if (process.env.FLOWLARY_TEST_API_STARTED === '1') {
      await stopTestApiServer()
    }
  }
}
