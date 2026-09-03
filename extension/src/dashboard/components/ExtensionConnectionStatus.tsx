import type { DomainState } from '../../ui/domainState.ts'
import { t } from '../../popup/i18n/index.ts'

export function ExtensionConnectionStatus({ domain }: { domain: DomainState }) {
  const extensionPaused = domain.extension === 'paused'
  const aiReady = domain.ai === 'available'

  return (
    <span
      className={`wd-connection${extensionPaused ? ' wd-connection-off' : ' wd-connection-ready'}`}
      role="status"
    >
      <span className="wd-connection-dot" aria-hidden="true" />
      {extensionPaused ? t('dashboard.connection.paused') : t('dashboard.connection.connected')}
      {aiReady ? (
        <span className="wd-connection-meta">{t('dashboard.connection.aiReady')}</span>
      ) : domain.ai === 'temporarily_unavailable' ? (
        <span className="wd-connection-meta">{t('dashboard.connection.aiUnavailable')}</span>
      ) : null}
    </span>
  )
}
