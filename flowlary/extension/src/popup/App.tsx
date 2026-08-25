import { useEffect, useState } from 'react'
import { BRAND } from '@flowlary/shared'
import type { ExtensionStatus } from '../messaging/types.ts'

export function App() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null)

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: 'GET_STATUS' }).then((response) => {
      setStatus(response as ExtensionStatus)
    })
  }, [])

  const active = status?.active ?? true
  const liveEnabled = status?.translation?.liveEnabled ?? false

  async function toggleLiveTranslation(): Promise<void> {
    const next = !liveEnabled
    const response = (await chrome.runtime.sendMessage({
      type: 'SET_TRANSLATION',
      patch: { liveEnabled: next },
    })) as ExtensionStatus
    setStatus(response)
  }

  return (
    <div className="fl-popup">
      <h1 className="fl-title">{BRAND.name}</h1>
      <p className="fl-tagline">{BRAND.tagline}</p>

      <div className="fl-status">
        <span className="fl-status-dot" aria-hidden />
        <span>
          Status: <strong>{active ? 'Active' : 'Paused'}</strong>
        </span>
      </div>

      <section className="fl-section">
        <h2>Features</h2>
        <ul className="fl-feature-list">
          <li>
            Writing
            <div className="fl-placeholder">Improve English — Phase 7</div>
          </li>
          <li>
            Translation
            <label className="fl-toggle">
              <span>Live Translation</span>
              <button type="button" onClick={() => void toggleLiveTranslation()}>
                {liveEnabled ? 'ON' : 'OFF'}
              </button>
            </label>
          </li>
          <li>
            Keyboard Layout
            <div className="fl-placeholder">Local-first fix — Phase 4</div>
          </li>
        </ul>
      </section>
    </div>
  )
}
