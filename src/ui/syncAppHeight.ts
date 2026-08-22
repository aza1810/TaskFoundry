/**
 * iOS/Android WebViews can freeze 100dvh at about half the screen after
 * backgrounding. Drive the shell from the live viewport instead.
 */
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export function pickAppHeight(inner: number, client: number, visual: number): number {
  return Math.max(1, inner || 0, client || 0, visual || 0)
}

export function measureAppHeight(): number {
  const vv = window.visualViewport
  return pickAppHeight(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    vv?.height ?? 0,
  )
}

export function syncAppHeight(): number {
  const h = Math.round(measureAppHeight())
  document.documentElement.style.setProperty('--app-height', `${h}px`)
  return h
}

function bump(): void {
  syncAppHeight()
  requestAnimationFrame(() => {
    syncAppHeight()
  })
}

/** Bind resize / resume listeners. Call once at boot. */
export function initAppHeight(): () => void {
  bump()
  const onResize = () => bump()
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    bump()
    window.setTimeout(syncAppHeight, 50)
    window.setTimeout(syncAppHeight, 320)
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  window.addEventListener('pageshow', onResize)
  document.addEventListener('visibilitychange', onVisible)
  window.visualViewport?.addEventListener('resize', onResize)
  window.visualViewport?.addEventListener('scroll', onResize)

  let removeNative: (() => void) | undefined
  if (Capacitor.isNativePlatform()) {
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      onVisible()
    }).then((handle) => {
      removeNative = () => {
        void handle.remove()
      }
    })
  }

  return () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
    window.removeEventListener('pageshow', onResize)
    document.removeEventListener('visibilitychange', onVisible)
    window.visualViewport?.removeEventListener('resize', onResize)
    window.visualViewport?.removeEventListener('scroll', onResize)
    removeNative?.()
  }
}
