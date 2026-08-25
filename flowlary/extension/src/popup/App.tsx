import { useEffect, useState } from 'react'
import { BRAND } from '@flowlary/shared'
import type { ExtensionStatus } from '../messaging/types.ts'

export function App() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null)
  const [groqKey, setGroqKey] = useState('')

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: 'GET_STATUS' }).then((response) => {
      setStatus(response as ExtensionStatus)
    })
  }, [])

  const active = status?.active ?? true
  const liveEnabled = status?.translation?.liveEnabled ?? false
  const correctionEnabled = status?.correction?.enabled ?? true
  const consentAccepted = status?.correction?.consentAccepted ?? false

  async function refreshStatus(response: ExtensionStatus): Promise<void> {
    setStatus(response)
  }

  async function toggleLiveTranslation(): Promise<void> {
    const response = (await chrome.runtime.sendMessage({
      type: 'SET_TRANSLATION',
      patch: { liveEnabled: !liveEnabled },
    })) as ExtensionStatus
    await refreshStatus(response)
  }

  async function toggleCorrection(): Promise<void> {
    const response = (await chrome.runtime.sendMessage({
      type: 'SET_CORRECTION',
      patch: { enabled: !correctionEnabled },
    })) as ExtensionStatus
    await refreshStatus(response)
  }

  async function saveGroqKey(): Promise<void> {
    const response = (await chrome.runtime.sendMessage({
      type: 'SET_CORRECTION',
      patch: { groqApiKey: groqKey, consentAccepted: true },
    })) as ExtensionStatus
    await refreshStatus(response)
    setGroqKey('')
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
            <label className="fl-toggle">
              <span>English correction</span>
              <button type="button" onClick={() => void toggleCorrection()}>
                {correctionEnabled ? 'ON' : 'OFF'}
              </button>
            </label>
            <label className="fl-toggle">
              <span>Groq API key (BYOK)</span>
              <input
                type="password"
                value={groqKey}
                placeholder={status?.correction?.hasGroqKey ? '••••••••' : 'Paste key'}
                onChange={(e) => setGroqKey(e.target.value)}
              />
              <button type="button" onClick={() => void saveGroqKey()}>
                Save
              </button>
            </label>
            <div className="fl-placeholder">
              Consent: {consentAccepted ? 'Accepted' : 'Required on save'}
            </div>
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
