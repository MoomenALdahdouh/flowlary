import { useMessages } from '../../i18n/index.tsx'

export function ConnectionStatus({ connected }: { connected: boolean | null }) {
  const copy = useMessages().dashboard.connection
  if (connected == null) {
    return (
      <span className="wd-connection wd-connection-unknown" role="status">
        {copy.checking}
      </span>
    )
  }
  if (connected) {
    return (
      <span className="wd-connection wd-connection-ready" role="status">
        <span className="wd-connection-dot" aria-hidden="true" />
        {copy.connected}
      </span>
    )
  }
  return (
    <span className="wd-connection wd-connection-off" role="status">
      <span className="wd-connection-dot" aria-hidden="true" />
      {copy.disconnected}
    </span>
  )
}
