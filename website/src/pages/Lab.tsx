import { Navigate } from 'react-router-dom'

/** Writing Lab lives in the dashboard. Keep old /lab links working, including prerender. */
export function LabPage() {
  return (
    <main>
      <Navigate to="/dashboard#lab" replace />
      <h1>Writing Lab</h1>
      <p>
        The live lab is inside your account dashboard.
        {' '}
        <a href="/dashboard#lab">Open Writing Lab</a>
      </p>
    </main>
  )
}
