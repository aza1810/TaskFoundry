import { Capacitor } from '@capacitor/core'
import { Health } from '@capgo/capacitor-health'
import { useCallback, useEffect, useState } from 'react'

export type HealthStepsStatus =
  | 'web'
  | 'checking'
  | 'unavailable'
  | 'ready'
  | 'denied'
  | 'syncing'
  | 'error'

export interface HealthStepsApi {
  /** True only inside the Capacitor native shell (not the browser site). */
  isNative: boolean
  status: HealthStepsStatus
  platformLabel: string
  /** Latest total steps reported by Health for today (local day). */
  healthStepsToday: number | null
  lastError: string | null
  refreshAvailability: () => Promise<void>
  connect: () => Promise<boolean>
  /** Read today's health steps and return the count (null if unavailable). */
  readTodaySteps: () => Promise<number | null>
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function platformLabelFor(platform?: string): string {
  if (platform === 'ios') return 'Apple Health'
  if (platform === 'android') return 'Health Connect'
  return 'Health'
}

async function sumTodaySteps(): Promise<number> {
  const start = startOfLocalDay().toISOString()
  const end = new Date().toISOString()

  try {
    const aggregated = await Health.queryAggregated({
      dataType: 'steps',
      startDate: start,
      endDate: end,
      bucket: 'day',
      aggregation: 'sum',
    })
    const total = (aggregated.samples ?? []).reduce((sum, s) => sum + (s.value ?? 0), 0)
    if (total > 0 || (aggregated.samples?.length ?? 0) > 0) {
      return Math.floor(total)
    }
  } catch {
    // Fall through to sample sum — some devices only expose samples.
  }

  const { samples } = await Health.readSamples({
    dataType: 'steps',
    startDate: start,
    endDate: end,
    limit: 5000,
    ascending: true,
  })
  return Math.floor((samples ?? []).reduce((sum, s) => sum + (s.value ?? 0), 0))
}

/**
 * Native HealthKit / Health Connect step reader.
 * On the azztech.online website this stays inactive — browsers cannot access those APIs.
 */
export function useHealthSteps(): HealthStepsApi {
  const isNative = Capacitor.isNativePlatform()
  const [status, setStatus] = useState<HealthStepsStatus>(isNative ? 'checking' : 'web')
  const [platformLabel, setPlatformLabel] = useState(
    isNative ? platformLabelFor(Capacitor.getPlatform()) : 'Web',
  )
  const [healthStepsToday, setHealthStepsToday] = useState<number | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const refreshAvailability = useCallback(async () => {
    if (!isNative) {
      setStatus('web')
      return
    }
    setStatus('checking')
    setLastError(null)
    try {
      const availability = await Health.isAvailable()
      setPlatformLabel(platformLabelFor(availability.platform ?? Capacitor.getPlatform()))
      if (!availability.available) {
        setStatus('unavailable')
        setLastError(availability.reason ?? 'Health APIs unavailable on this device')
        return
      }
      const auth = await Health.checkAuthorization({ read: ['steps'] })
      if (auth.readAuthorized.includes('steps')) {
        setStatus('ready')
        const steps = await sumTodaySteps()
        setHealthStepsToday(steps)
      } else if (auth.readDenied.includes('steps')) {
        setStatus('denied')
      } else {
        setStatus('ready')
      }
    } catch (err) {
      setStatus('error')
      setLastError(err instanceof Error ? err.message : 'Could not check health access')
    }
  }, [isNative])

  useEffect(() => {
    void refreshAvailability()
  }, [refreshAvailability])

  const connect = useCallback(async () => {
    if (!isNative) return false
    setLastError(null)
    try {
      const availability = await Health.isAvailable()
      setPlatformLabel(platformLabelFor(availability.platform ?? Capacitor.getPlatform()))
      if (!availability.available) {
        setStatus('unavailable')
        setLastError(availability.reason ?? 'Install Health Connect to sync steps')
        return false
      }
      await Health.requestAuthorization({ read: ['steps'] })
      const auth = await Health.checkAuthorization({ read: ['steps'] })
      if (!auth.readAuthorized.includes('steps')) {
        setStatus('denied')
        setLastError('Step permission was not granted')
        return false
      }
      setStatus('ready')
      const steps = await sumTodaySteps()
      setHealthStepsToday(steps)
      return true
    } catch (err) {
      setStatus('error')
      setLastError(err instanceof Error ? err.message : 'Could not connect to health')
      return false
    }
  }, [isNative])

  const readTodaySteps = useCallback(async () => {
    if (!isNative) return null
    setStatus('syncing')
    setLastError(null)
    try {
      const availability = await Health.isAvailable()
      if (!availability.available) {
        setStatus('unavailable')
        setLastError(availability.reason ?? 'Health APIs unavailable')
        return null
      }
      let auth = await Health.checkAuthorization({ read: ['steps'] })
      if (!auth.readAuthorized.includes('steps')) {
        await Health.requestAuthorization({ read: ['steps'] })
        auth = await Health.checkAuthorization({ read: ['steps'] })
      }
      if (!auth.readAuthorized.includes('steps')) {
        setStatus('denied')
        setLastError('Step permission was not granted')
        return null
      }
      const steps = await sumTodaySteps()
      setHealthStepsToday(steps)
      setStatus('ready')
      return steps
    } catch (err) {
      setStatus('error')
      setLastError(err instanceof Error ? err.message : 'Could not read steps')
      return null
    }
  }, [isNative])

  return {
    isNative,
    status,
    platformLabel,
    healthStepsToday,
    lastError,
    refreshAvailability,
    connect,
    readTodaySteps,
  }
}
