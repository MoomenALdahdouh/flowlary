import { Navigate, useLocation } from 'react-router-dom'

const HASH_TARGETS: Record<string, string> = {
  '#writing-lab': '/dashboard#lab',
  '#try-flowlary': '/try',
}

export function LegacyHashRedirect() {
  const { pathname, hash } = useLocation()
  if (pathname !== '/') return null
  const target = HASH_TARGETS[hash]
  if (!target) return null
  return <Navigate to={target} replace />
}
