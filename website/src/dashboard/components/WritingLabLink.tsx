import { Button, FidelityBadge } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function WritingLabLink({ className }: { className?: string }) {
  const copy = useMessages().dashboard.overview
  return (
    <div className={`wd-lab-link${className ? ` ${className}` : ''}`}>
      <Button to="/lab">{copy.startWriting}</Button>
      <FidelityBadge mode="live" />
      <p className="wd-muted">{copy.writingLabBody}</p>
    </div>
  )
}
