import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { App } from '@capacitor/app'
import pkg from '../../package.json' with { type: 'json' }

export const APP_VERSION = pkg.version
// PHP wrapper adds CORS so the Capacitor WebView (https://localhost) can read it.
export const OTA_LATEST_URL = 'https://azztech.online/apps/tf/ota/latest.php'
export const APK_DOWNLOAD_URL = 'https://azztech.online/apps/tf/TaskFoundry-debug.apk'

export type LatestManifest = {
  version: string
  url: string
  checksum?: string
  builtAt?: string
}

export type OtaPhase =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'applying'
  | 'error'

export type OtaState = {
  phase: OtaPhase
  platform: 'native' | 'web'
  appVersion: string
  bundleVersion: string
  remoteVersion: string | null
  remoteBuiltAt: string | null
  message: string
}

type Listener = (state: OtaState) => void

const listeners = new Set<Listener>()

let state: OtaState = {
  phase: 'idle',
  platform: Capacitor.isNativePlatform() ? 'native' : 'web',
  appVersion: APP_VERSION,
  bundleVersion: APP_VERSION,
  remoteVersion: null,
  remoteBuiltAt: null,
  message:
    Capacitor.isNativePlatform()
      ? 'Tap Check for update to look for a newer build.'
      : 'Web build - refresh the page for the latest version. OTA applies to the Android APK.',
}

function emit(patch: Partial<OtaState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
}

export function getOtaState(): OtaState {
  return state
}

export function subscribeOta(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

function parseVersion(v: string): number[] {
  if (!v || /^builtin$/i.test(v) || /^default$/i.test(v)) return [0, 0, 0]
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part.replace(/\D/g, ''), 10) || 0)
}

export function isNewer(remote: string, local: string): boolean {
  const a = parseVersion(remote)
  const b = parseVersion(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

async function refreshBundleVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    emit({ bundleVersion: APP_VERSION })
    return APP_VERSION
  }
  try {
    const current = await CapacitorUpdater.current()
    const version = current.bundle.version || APP_VERSION
    emit({ bundleVersion: version })
    return version
  } catch {
    emit({ bundleVersion: APP_VERSION })
    return APP_VERSION
  }
}

export async function fetchLatestManifest(): Promise<LatestManifest> {
  const res = await fetch(`${OTA_LATEST_URL}?t=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Update server HTTP ${res.status}`)
  const latest = (await res.json()) as LatestManifest
  if (!latest?.version || !latest?.url) {
    throw new Error('Update manifest is missing version/url')
  }
  return latest
}

async function downloadBundle(latest: LatestManifest) {
  try {
    return await CapacitorUpdater.download({
      url: latest.url,
      version: latest.version,
      ...(latest.checksum ? { checksum: latest.checksum } : {}),
    })
  } catch (first) {
    // Retry without checksum - some hosts alter ETag/bytes in transit.
    if (!latest.checksum) throw first
    console.warn('[ota] download with checksum failed, retrying bare', first)
    return CapacitorUpdater.download({
      url: latest.url,
      version: latest.version,
    })
  }
}

/**
 * Check for a newer OTA bundle.
 * @param apply when true, download + reload immediately if an update exists
 */
export async function checkForUpdate(apply = false): Promise<OtaState> {
  if (!Capacitor.isNativePlatform()) {
    emit({
      phase: 'idle',
      platform: 'web',
      message:
        'This is the website. On Android, open Settings → Check for update after installing the APK.',
    })
    return state
  }

  emit({ phase: 'checking', message: 'Checking azztech for a newer build…' })
  try {
    await CapacitorUpdater.notifyAppReady()
  } catch {
    /* still try the check */
  }

  try {
    const localVersion = await refreshBundleVersion()
    const latest = await fetchLatestManifest()
    emit({
      remoteVersion: latest.version,
      remoteBuiltAt: latest.builtAt ?? null,
    })

    if (!isNewer(latest.version, localVersion)) {
      emit({
        phase: 'upToDate',
        message: `You're on ${localVersion}. Latest is ${latest.version}.`,
      })
      return state
    }

    if (!apply) {
      emit({
        phase: 'available',
        message: `Update ${latest.version} is available (you have ${localVersion}).`,
      })
      return state
    }

    emit({
      phase: 'downloading',
      message: `Downloading ${latest.version}…`,
    })
    const bundle = await downloadBundle(latest)
    emit({
      phase: 'applying',
      message: `Installing ${latest.version}…`,
    })
    // Terminal: reloads the WebView onto the new bundle.
    await CapacitorUpdater.set({ id: bundle.id })
    return state
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Update check failed'
    console.warn('[ota]', error)
    emit({
      phase: 'error',
      message,
    })
    return state
  }
}

/** Quiet launch/resume check - applies updates when found. */
export async function initNativeOta(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await CapacitorUpdater.notifyAppReady()
  } catch (error) {
    console.warn('[ota] notifyAppReady failed', error)
  }

  await refreshBundleVersion()

  const run = () => {
    void checkForUpdate(true)
  }
  // Defer so first paint isn't blocked.
  window.setTimeout(run, 1200)
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) window.setTimeout(run, 800)
  })
}
