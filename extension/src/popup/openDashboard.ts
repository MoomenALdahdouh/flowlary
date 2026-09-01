import { dashboardUrl, type DashboardSection } from '../config/dashboard.ts'

export type { DashboardSection }

/** Opens the full-page dashboard in a tab. The popup is the speed surface only. */
export function openDashboard(
  section: DashboardSection = 'overview',
  practiceTargetPatternId?: string,
): void {
  const url = dashboardUrl(section, practiceTargetPatternId)
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url })
    return
  }
  window.open(url, '_blank', 'noopener')
}

export { dashboardUrl }
