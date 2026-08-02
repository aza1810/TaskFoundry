import { useEffect, useRef, useState } from 'react'
import type { FactoryStats } from '../game/types'

export type ProductionRates = {
  ore: number
  plates: number
  gears: number
  moved: number
}

/** EMA of factory throughput from rolling stats deltas. */
export function useProductionRates(stats: FactoryStats): ProductionRates {
  const prev = useRef(stats)
  const prevAt = useRef(Date.now())
  const ema = useRef<ProductionRates>({ ore: 0, plates: 0, gears: 0, moved: 0 })
  const [rates, setRates] = useState<ProductionRates>(ema.current)

  useEffect(() => {
    const now = Date.now()
    const dt = Math.max(0.25, (now - prevAt.current) / 1000)
    const instant = {
      ore: Math.max(0, (stats.oreMined - prev.current.oreMined) / dt),
      plates: Math.max(0, (stats.platesSmelted - prev.current.platesSmelted) / dt),
      gears: Math.max(0, (stats.gearsMade - prev.current.gearsMade) / dt),
      moved: Math.max(0, (stats.itemsMoved - prev.current.itemsMoved) / dt),
    }
    const a = 0.35
    ema.current = {
      ore: ema.current.ore * (1 - a) + instant.ore * a,
      plates: ema.current.plates * (1 - a) + instant.plates * a,
      gears: ema.current.gears * (1 - a) + instant.gears * a,
      moved: ema.current.moved * (1 - a) + instant.moved * a,
    }
    setRates({ ...ema.current })
    prev.current = stats
    prevAt.current = now
  }, [stats])

  return rates
}
