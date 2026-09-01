const TOUR_STORAGE_KEY = 'flowlary.ui.dashboardTour'
export const DASHBOARD_TOUR_VERSION = 1

export type DashboardTourState = {
  version: number
  completed: boolean
  /** Set when setup finishes so the tour can start once the modal closes. */
  pending: boolean
}

const DEFAULT_STATE: DashboardTourState = {
  version: DASHBOARD_TOUR_VERSION,
  completed: false,
  pending: false,
}

function readLocal(): DashboardTourState | null {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DashboardTourState>
    return {
      version: typeof parsed.version === 'number' ? parsed.version : DASHBOARD_TOUR_VERSION,
      completed: parsed.completed === true,
      pending: parsed.pending === true,
    }
  } catch {
    return null
  }
}

function writeLocal(state: DashboardTourState) {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

async function readChrome(): Promise<DashboardTourState | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null
  try {
    const result = await chrome.storage.local.get(TOUR_STORAGE_KEY)
    const parsed = result[TOUR_STORAGE_KEY] as Partial<DashboardTourState> | undefined
    if (!parsed || typeof parsed !== 'object') return null
    return {
      version: typeof parsed.version === 'number' ? parsed.version : DASHBOARD_TOUR_VERSION,
      completed: parsed.completed === true,
      pending: parsed.pending === true,
    }
  } catch {
    return null
  }
}

async function writeChrome(state: DashboardTourState) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  try {
    await chrome.storage.local.set({ [TOUR_STORAGE_KEY]: state })
  } catch {
    /* ignore */
  }
}

export async function loadDashboardTourState(): Promise<DashboardTourState> {
  const fromChrome = await readChrome()
  if (fromChrome) return fromChrome
  return readLocal() ?? { ...DEFAULT_STATE }
}

export async function saveDashboardTourState(patch: Partial<DashboardTourState>): Promise<DashboardTourState> {
  const current = await loadDashboardTourState()
  const next: DashboardTourState = {
    version: DASHBOARD_TOUR_VERSION,
    completed: patch.completed ?? current.completed,
    pending: patch.pending ?? current.pending,
  }
  writeLocal(next)
  await writeChrome(next)
  return next
}

export async function markDashboardTourPending(): Promise<void> {
  await saveDashboardTourState({ pending: true, completed: false })
}

export async function markDashboardTourCompleted(): Promise<void> {
  await saveDashboardTourState({ pending: false, completed: true })
}

export async function resetDashboardTour(): Promise<void> {
  await saveDashboardTourState({ pending: true, completed: false })
}
