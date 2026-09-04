import { Navigate } from 'react-router-dom'

/** Writing Lab lives in the dashboard. Keep old /lab links working. */
export function LabPage() {
  return <Navigate to="/dashboard#lab" replace />
}
