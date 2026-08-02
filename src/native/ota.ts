import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { App } from '@capacitor/app'

const OTA_LATEST_URL = 'https://azztech.online/apps/tf/ota/latest.json'

type LatestManifest = {
  version: string
  url: string
  checksum?: string
}

function isNewer(remote: string, local: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part.replace(/\D/g, ''), 10) || 0)
  const a = parse(remote)
  const b = parse(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/**
 * Capgo self-hosted OTA:
 * 1. Tell the native updater the JS bundle loaded (required after any apply).
 * 2. Fetch latest.json from azztech; if newer, download zip and reload.
 * Updates are cached on device so the new build works offline after first download.
 */
export async function initNativeOta(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await CapacitorUpdater.notifyAppReady()
  } catch (error) {
    console.warn('[ota] notifyAppReady failed', error)
  }

  const check = async () => {
    try {
      const res = await fetch(`${OTA_LATEST_URL}?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const latest = (await res.json()) as LatestManifest
      if (!latest?.version || !latest?.url) return

      const current = await CapacitorUpdater.current()
      const localVersion = current.bundle.version || '0.0.0'
      if (!isNewer(latest.version, localVersion)) {
        console.info('[ota] up to date', localVersion)
        return
      }

      console.info('[ota] downloading', latest.version, 'from', latest.url)
      const bundle = await CapacitorUpdater.download({
        url: latest.url,
        version: latest.version,
        ...(latest.checksum ? { checksum: latest.checksum } : {}),
      })
      // Applies bundle and reloads the WebView.
      await CapacitorUpdater.set({ id: bundle.id })
    } catch (error) {
      console.warn('[ota] update check failed', error)
    }
  }

  void check()
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void check()
  })
}
