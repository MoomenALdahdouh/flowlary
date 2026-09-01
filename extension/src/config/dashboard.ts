/** Dashboard routes — safe for service worker (no DOM APIs). */

export type DashboardSection =
  | 'overview'
  | 'progress'
  | 'practice'
  | 'report'
  | 'settings'
  | 'activity'
  | 'privacy'
  | 'account'

const DASHBOARD_PAGE = 'src/dashboard/index.html'

export function dashboardUrl(
  section: DashboardSection = 'overview',
  practiceTargetPatternId?: string,
): string {
  let hash = section === 'overview' ? 'overview' : section
  if (section === 'practice' && practiceTargetPatternId?.trim()) {
    hash = `practice?target=${encodeURIComponent(practiceTargetPatternId.trim())}`
  }
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return `${chrome.runtime.getURL(DASHBOARD_PAGE)}#${hash}`
  }
  return `#${hash}`
}
