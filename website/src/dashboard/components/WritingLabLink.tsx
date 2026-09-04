import { Button, FidelityBadge } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'

function openDashboardLab(onOpen?: () => void) {
  if (onOpen) {
    onOpen()
    return
  }
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path === '/dashboard') {
    window.location.hash = '#lab'
    return
  }
  window.location.assign('/dashboard#lab')
}

export function WritingLabLink({
  className,
  compact = false,
  onOpen,
}: {
  className?: string
  compact?: boolean
  onOpen?: () => void
}) {
  const copy = useMessages().dashboard.overview
  const cta = (
    <Button type="button" onClick={() => openDashboardLab(onOpen)}>
      {copy.startWriting}
    </Button>
  )
  if (compact) {
    return <div className={`wd-lab-link${className ? ` ${className}` : ''}`}>{cta}</div>
  }
  return (
    <article className={`wd-card wd-lab-cta${className ? ` ${className}` : ''}`}>
      <div>
        <h3>{copy.writingLab}</h3>
        <p className="wd-muted">{copy.writingLabBody}</p>
      </div>
      <div className="wd-actions">
        {cta}
        <FidelityBadge mode="live" />
      </div>
    </article>
  )
}
