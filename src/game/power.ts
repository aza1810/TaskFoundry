import {
  BASE_POWER_CAP,
  GEN_CAPACITY,
  POWER_DRAW,
  POWER_PER_STEP,
} from './data'
import type { EntityKind, GameState } from './types'

/** Built (non-ghost) generators on the floor. */
export function generatorCount(state: GameState): number {
  let n = 0
  for (const e of Object.values(state.entities)) {
    if (e.kind === 'generator' && !e.ghost) n += 1
  }
  return n
}

/** Battery capacity: base plus each generator. */
export function powerCapacity(state: GameState): number {
  return BASE_POWER_CAP + generatorCount(state) * GEN_CAPACITY
}

/** Stored power per step: more generators multiply the value of every step. */
export function powerPerStep(state: GameState): number {
  return POWER_PER_STEP * (1 + generatorCount(state))
}

export function machineDraw(kind: EntityKind): number {
  return POWER_DRAW[kind] ?? 0
}

/**
 * Rough steady-state draw (per second) of every electric machine on the floor.
 * Used for the HUD; the exact per-tick demand is computed inside the sim.
 */
export function powerDemand(state: GameState): number {
  let d = 0
  for (const e of Object.values(state.entities)) {
    if (e.ghost) continue
    d += POWER_DRAW[e.kind] ?? 0
  }
  return d
}

/** Fraction of the battery currently filled (0..1). */
export function powerFraction(state: GameState): number {
  const cap = powerCapacity(state)
  if (cap <= 0) return 0
  return Math.min(1, Math.max(0, state.power / cap))
}
