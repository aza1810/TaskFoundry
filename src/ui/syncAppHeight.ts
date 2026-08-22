/**
 * iOS WebViews can freeze innerHeight / 100dvh at about half the screen after
 * backgrounding. Prefer the live viewport, reject half-height stale reads, and
 * write the result onto the shell so CSS inset bugs cannot shrink the app.
 */
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

let lastApplied = 0
let lastInnerWidth = 0

/** Screen axis that matches the current orientation. */
export function screenAxisHeight(
  screenW: number,
  screenH: number,
  innerW: number,
  innerH: number,
): number {
  const shortSide = Math.min(screenW || 0, screenH || 0)
  const longSide = Math.max(screenW || 0, screenH || 0)
  if (shortSide <= 0 || longSide <= 0) return 0
  return innerW > innerH ? shortSide : longSide
}

/**
 * inner / client / visual are the live viewport. screenH is the oriented
 * device screen. prev is the last height we trusted.
 * A read under 65% of the screen (or 75% of the last good height) is treated
 * as the iOS half-screen freeze and discarded.
 */
export function pickAppHeight(
  inner: number,
  client: number,
  visual: number,
  screenH = 0,
  prev = 0,
): number {
  const live = Math.max(1, inner || 0, client || 0, visual || 0)
  if (screenH > 0 && live < screenH * 0.65) {
    return Math.max(screenH, prev || 0, live)
  }
  if (prev > 0 && live < prev * 0.75) return prev
  return live
}

export function measureAppHeight(): number {
  const vv = window.visualViewport
  const screenH = screenAxisHeight(
    window.screen?.width ?? 0,
    window.screen?.height ?? 0,
    window.innerWidth || 0,
    window.innerHeight || 0,
  )
  const widthChanged =
    lastInnerWidth > 0 &&
    Math.abs((window.innerWidth || 0) - lastInnerWidth) > 80
  return pickAppHeight(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    vv?.height ?? 0,
    screenH,
    widthChanged ? 0 : lastApplied,
  )
}

let lastPx = ''

export function applyAppHeight(h: number): void {
  const px = `${Math.max(1, Math.round(h))}px`
  if (px === lastPx) return
  lastPx = px
  const root = document.documentElement
  root.style.setProperty('--app-height', px)
  root.style.height = px
  root.style.minHeight = px
  if (document.body) {
    document.body.style.height = px
    document.body.style.minHeight = px
  }
  const mount = document.getElementById('root')
  if (mount) {
    mount.style.height = px
    mount.style.minHeight = px
  }
}

export function syncAppHeight(): number {
  const h = Math.round(measureAppHeight())
  const width = window.innerWidth || lastInnerWidth
  if (h === lastApplied && width === lastInnerWidth && lastPx) return h
  lastApplied = h
  lastInnerWidth = width
  applyAppHeight(h)
  return h
}

function bump(): void {
  const before = lastApplied
  const h = syncAppHeight()
  if (h === before) return
  requestAnimationFrame(() => {
    syncAppHeight()
  })
}

function bumpLater(): void {
  bump()
  window.setTimeout(syncAppHeight, 50)
  window.setTimeout(syncAppHeight, 320)
  window.setTimeout(syncAppHeight, 800)
  window.setTimeout(syncAppHeight, 1600)
}

/** Bind resize / resume listeners. Call once at boot. */
export function initAppHeight(): () => void {
  bumpLater()
  const onResize = () => bump()
  const onVisible = () => {
    if (document.visibilityState === 'hidden') return
    bumpLater()
  }

  const onFocus = () => bump()

  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  window.addEventListener('pageshow', onVisible)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisible)
  window.visualViewport?.addEventListener('resize', onResize)

  let removeNative: (() => void) | undefined
  if (Capacitor.isNativePlatform()) {
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      bumpLater()
    }).then((handle) => {
      removeNative = () => {
        void handle.remove()
      }
    })
  }

  return () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
    window.removeEventListener('pageshow', onVisible)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisible)
    window.visualViewport?.removeEventListener('resize', onResize)
    removeNative?.()
  }
}
