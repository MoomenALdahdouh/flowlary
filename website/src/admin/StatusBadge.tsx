export function StatusBadge({
  value,
  tone = 'neutral',
}: {
  value: string
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info'
}) {
  return <span className={`ad-badge ad-badge-${tone}`}>{value}</span>
}

export function planTone(plan: string): 'neutral' | 'ok' | 'warn' | 'info' {
  if (plan === 'pro') return 'ok'
  if (plan === 'trial') return 'info'
  return 'neutral'
}

export function statusTone(status: string): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  const value = status.toLowerCase()
  if (value === 'active' || value === 'resolved' || value === 'closed' || value === 'configured') return 'ok'
  if (value === 'open' || value === 'suspended' || value === 'past_due' || value === 'failure') return 'danger'
  if (value === 'trialing' || value === 'paused' || value === 'pending' || value === 'investigating') return 'warn'
  if (value === 'in progress' || value === 'waiting_for_user') return 'info'
  return 'neutral'
}
