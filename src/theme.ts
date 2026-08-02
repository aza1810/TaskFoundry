export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'task-foundry-theme'

type Listener = (state: {
  preference: ThemePreference
  resolved: ResolvedTheme
}) => void

const listeners = new Set<Listener>()

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

export function getThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* ignore */
  }
  return 'system'
}

export function resolveTheme(preference: ThemePreference = getThemePreference()): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference
}

export function applyTheme(preference: ThemePreference = getThemePreference()): ResolvedTheme {
  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#e8dfd2' : '#0e100c')
  }

  const payload = { preference, resolved }
  for (const listener of listeners) listener(payload)
  return resolved
}

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* ignore */
  }
  return applyTheme(preference)
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener)
  listener({
    preference: getThemePreference(),
    resolved: resolveTheme(),
  })
  return () => listeners.delete(listener)
}

/** Apply stored theme and follow OS changes when preference is system. */
export function initTheme(): void {
  applyTheme()
  if (!window.matchMedia) return
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const onChange = () => {
    if (getThemePreference() === 'system') applyTheme('system')
  }
  mq.addEventListener?.('change', onChange)
}
