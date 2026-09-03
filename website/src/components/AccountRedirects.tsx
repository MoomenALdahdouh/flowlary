import { Navigate } from 'react-router-dom'

export function AccountSupportRedirect() {
  return <Navigate to="/dashboard/support" replace />
}

export function AccountDashboardRedirect() {
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  return <Navigate to={`/dashboard${hash}`} replace />
}
