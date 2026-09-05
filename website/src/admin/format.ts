export function formatAdminDate(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatAdminDateTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatCents(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
}

export function formatDelta(deltaPct: number | null | undefined): string | null {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return null
  const rounded = Math.round(deltaPct)
  if (rounded === 0) return '0%'
  return `${rounded > 0 ? '↑' : '↓'} ${Math.abs(rounded)}%`
}

export function deltaTone(deltaPct: number | null | undefined): 'up' | 'down' | 'flat' {
  if (deltaPct == null || !Number.isFinite(deltaPct) || Math.round(deltaPct) === 0) return 'flat'
  return deltaPct > 0 ? 'up' : 'down'
}

export function barWidth(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.max(4, Math.round((value / max) * 100))
}

export function fillCopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}
