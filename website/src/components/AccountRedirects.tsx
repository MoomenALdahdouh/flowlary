import { Navigate, useLocation } from 'react-router-dom'

export function AccountSupportRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/dashboard/support${search}`} replace />
}

export function AccountDashboardRedirect() {
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  return <Navigate to={`/dashboard${hash}`} replace />
}
