import { useCallback, useEffect, useRef, useState } from 'react'

export type PedometerStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'denied'
  | 'unsupported'

type DeviceMotionPermission = {
  requestPermission?: () => Promise<'granted' | 'denied' | 'prompt'>
}

function getAccel(event: DeviceMotionEvent): { x: number; y: number; z: number } | null {
  const a = event.accelerationIncludingGravity ?? event.acceleration
  if (!a || a.x == null || a.y == null || a.z == null) return null
  return { x: a.x, y: a.y, z: a.z }
}

function supportsMotion(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
}

async function requestMotionPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!supportsMotion()) return 'unsupported'
  const DM = DeviceMotionEvent as unknown as DeviceMotionPermission
  if (typeof DM.requestPermission === 'function') {
    try {
      const result = await DM.requestPermission()
      return result === 'granted' ? 'granted' : 'denied'
    } catch {
      return 'denied'
    }
  }
  return 'granted'
}

export interface PedometerApi {
  status: PedometerStatus
  sessionSteps: number
  start: () => Promise<void>
  stop: () => void
  supported: boolean
}

/**
 * Phone pedometer via DeviceMotion accelerometer peaks.
 * Browsers cannot read Apple Health / Google Fit totals - this counts live steps
 * while Task Foundry is open on the phone.
 */
export function usePedometer(onSteps: (n: number) => void): PedometerApi {
  const [status, setStatus] = useState<PedometerStatus>('idle')
  const [sessionSteps, setSessionSteps] = useState(0)
  const onStepsRef = useRef(onSteps)
  const pendingRef = useRef(0)
  const lastStepAt = useRef(0)
  const lastMag = useRef(0)
  const wasHigh = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const listeningRef = useRef(false)

  useEffect(() => {
    onStepsRef.current = onSteps
  }, [onSteps])

  // Flush batched steps into the game every 400ms
  useEffect(() => {
    if (status !== 'listening') return
    const id = window.setInterval(() => {
      const n = pendingRef.current
      if (n <= 0) return
      pendingRef.current = 0
      onStepsRef.current(n)
    }, 400)
    return () => window.clearInterval(id)
  }, [status])

  const stop = useCallback(() => {
    listeningRef.current = false
    setStatus('idle')
    const leftover = pendingRef.current
    if (leftover > 0) {
      pendingRef.current = 0
      onStepsRef.current(leftover)
    }
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [])

  useEffect(() => {
    if (status !== 'listening') return

    const onMotion = (event: DeviceMotionEvent) => {
      if (!listeningRef.current) return
      const a = getAccel(event)
      if (!a) return

      // Magnitude in m/s² (~9.8 at rest with gravity)
      const mag = Math.hypot(a.x, a.y, a.z)
      const now = performance.now()
      const delta = mag - lastMag.current
      lastMag.current = mag

      // Peak: rising through threshold then falling (step heel strike)
      const THRESHOLD = 11.8 // slightly above 1g
      const MIN_INTERVAL_MS = 280
      const rising = delta > 0.35

      if (mag > THRESHOLD && rising && !wasHigh.current) {
        wasHigh.current = true
      } else if (wasHigh.current && mag < THRESHOLD - 0.8) {
        wasHigh.current = false
        if (now - lastStepAt.current >= MIN_INTERVAL_MS) {
          lastStepAt.current = now
          pendingRef.current += 1
          setSessionSteps((s) => s + 1)
        }
      }
    }

    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [status])

  // Release wake lock / flush on unmount
  useEffect(() => {
    return () => {
      listeningRef.current = false
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [])

  const start = useCallback(async () => {
    setStatus('starting')
    setSessionSteps(0)
    pendingRef.current = 0
    lastStepAt.current = 0
    wasHigh.current = false

    const perm = await requestMotionPermission()
    if (perm === 'unsupported') {
      setStatus('unsupported')
      return
    }
    if (perm === 'denied') {
      setStatus('denied')
      return
    }

    // Keep screen awake so the tab stays alive while walking
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null
        })
      }
    } catch {
      // optional
    }

    listeningRef.current = true
    setStatus('listening')
  }, [])

  // Re-acquire wake lock when returning to the tab
  useEffect(() => {
    if (status !== 'listening') return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (wakeLockRef.current) return
      if (!('wakeLock' in navigator)) return
      void navigator.wakeLock.request('screen').then((lock) => {
        wakeLockRef.current = lock
      }).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [status])

  return {
    status,
    sessionSteps,
    start,
    stop,
    supported: supportsMotion(),
  }
}
