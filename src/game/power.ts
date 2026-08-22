import {
  DIR_DELTA,
  DRILL_POWER_RANGE,
  BASE_POWER_CAP,
  GEN_CAPACITY,
  GRID_W,
  POWER_DRAW,
  POWER_PER_STEP,
  footprintCells,
  idx,
  inBounds,
  isDrillKind,
  machineIsLive,
} from './data'
import type { Entity, EntityKind, GameState } from './types'

export interface PowerNet {
  /** True for each tile index that is a Foundation connected to a generator. */
  floor: boolean[]
  floorCells: { x: number; y: number }[]
  genCells: { x: number; y: number }[]
}

/** Last flood-fill. Tiles are cloned on mine ticks, so do not key on array identity. */
let cachedTiles: GameState['tiles'] | null = null
let cachedFound = ''
let cachedGen = ''
let cachedNet: PowerNet | null = null

function generatorSig(state: GameState): string {
  let sig = ''
  for (const e of Object.values(state.entities)) {
    if (e.kind !== 'generator' || !machineIsLive(e)) continue
    sig += `${e.id}:${e.x},${e.y};`
  }
  return sig
}

/** Count + mix of foundation indexes. Cheap vs a 240x160 flood fill. */
function foundationSig(tiles: GameState['tiles']): string {
  if (tiles === cachedTiles && cachedFound) return cachedFound
  let n = 0
  let mix = 0
  for (let i = 0; i < tiles.length; i++) {
    if (!tiles[i].foundation) continue
    n += 1
    mix = (mix + (i + 1) * 2654435761) >>> 0
  }
  cachedTiles = tiles
  cachedFound = `${n}:${mix}`
  return cachedFound
}

/** Built (non-ghost) generators on the floor. */
export function generatorCount(state: GameState): number {
  let n = 0
  for (const e of Object.values(state.entities)) {
    if (e.kind === 'generator' && machineIsLive(e)) n += 1
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

/** Inserters, assemblers, and splitters must sit on a powered Foundation. Belts never draw power. */
export function needsFoundationPower(kind: EntityKind): boolean {
  return (POWER_DRAW[kind] ?? 0) > 0
}

function computePowerNet(state: GameState): PowerNet {
  const n = state.tiles.length
  const floor = new Array<boolean>(n).fill(false)
  const visited = new Array<boolean>(n).fill(false)
  const queue: number[] = []
  const powered: number[] = []
  const genCells: { x: number; y: number }[] = []

  const trySeed = (x: number, y: number) => {
    if (!inBounds(x, y)) return
    const i = idx(x, y)
    if (visited[i]) return
    if (!state.tiles[i].foundation) return
    visited[i] = true
    floor[i] = true
    queue.push(i)
    powered.push(i)
  }

  for (const e of Object.values(state.entities)) {
    if (e.kind !== 'generator' || !machineIsLive(e)) continue
    for (const c of footprintCells(e.kind, e.x, e.y)) {
      genCells.push(c)
      trySeed(c.x, c.y)
      for (const d of Object.values(DIR_DELTA)) {
        trySeed(c.x + d.dx, c.y + d.dy)
      }
    }
  }

  while (queue.length) {
    const i = queue.pop()!
    const x = i % GRID_W
    const y = Math.floor(i / GRID_W)
    for (const d of Object.values(DIR_DELTA)) {
      const nx = x + d.dx
      const ny = y + d.dy
      if (!inBounds(nx, ny)) continue
      const ni = idx(nx, ny)
      if (visited[ni]) continue
      if (!state.tiles[ni].foundation) continue
      visited[ni] = true
      floor[ni] = true
      queue.push(ni)
      powered.push(ni)
    }
  }

  const floorCells: { x: number; y: number }[] = []
  for (const i of powered) {
    floorCells.push({ x: i % GRID_W, y: Math.floor(i / GRID_W) })
  }

  return { floor, floorCells, genCells }
}

/** Flood-fill 4-connected Foundations that touch a generator (on or adjacent). */
export function powerNet(state: GameState): PowerNet {
  const gen = generatorSig(state)
  const found = foundationSig(state.tiles)
  if (cachedNet && cachedGen === gen && cachedFound === found) return cachedNet
  const net = computePowerNet(state)
  cachedTiles = state.tiles
  cachedGen = gen
  cachedFound = found
  cachedNet = net
  return net
}

export function tileIsPoweredFloor(
  state: GameState,
  x: number,
  y: number,
  net = powerNet(state),
): boolean {
  if (!inBounds(x, y)) return false
  return net.floor[idx(x, y)] === true
}

export function entityOnPoweredFloor(
  ent: Entity,
  state: GameState,
  net = powerNet(state),
): boolean {
  return footprintCells(ent.kind, ent.x, ent.y).some(
    (c) => inBounds(c.x, c.y) && net.floor[idx(c.x, c.y)],
  )
}

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

/**
 * Drills do not need to sit on Foundation. They are powered if any cell of
 * their footprint is within DRILL_POWER_RANGE (Chebyshev) of a generator
 * footprint cell or a powered Foundation tile.
 */
export function drillHasRemotePower(
  ent: Entity,
  state: GameState,
  net = powerNet(state),
): boolean {
  if (net.genCells.length === 0) return false
  const drillCells = footprintCells(ent.kind, ent.x, ent.y)
  for (const c of drillCells) {
    if (inBounds(c.x, c.y) && net.floor[idx(c.x, c.y)]) return true
  }
  for (const c of drillCells) {
    for (let dy = -DRILL_POWER_RANGE; dy <= DRILL_POWER_RANGE; dy++) {
      for (let dx = -DRILL_POWER_RANGE; dx <= DRILL_POWER_RANGE; dx++) {
        const x = c.x + dx
        const y = c.y + dy
        if (!inBounds(x, y)) continue
        if (net.floor[idx(x, y)]) return true
      }
    }
  }
  for (const g of net.genCells) {
    for (const c of drillCells) {
      if (chebyshev(c.x, c.y, g.x, g.y) <= DRILL_POWER_RANGE) return true
    }
  }
  return false
}

/**
 * Whether this built machine is connected to the power network.
 * Furnaces, chests, roboports, trees, rocks, and generators always pass.
 */
export function entityHasPower(
  ent: Entity,
  state: GameState,
  net = powerNet(state),
): boolean {
  if (!machineIsLive(ent)) return false
  if (isDrillKind(ent.kind)) return drillHasRemotePower(ent, state, net)
  if (needsFoundationPower(ent.kind)) return entityOnPoweredFloor(ent, state, net)
  return true
}

/**
 * Rough steady-state draw (per second) of every electric machine that is
 * actually connected to a powered Foundation.
 */
export function powerDemand(state: GameState): number {
  const net = powerNet(state)
  let d = 0
  for (const e of Object.values(state.entities)) {
    if (!machineIsLive(e)) continue
    const draw = POWER_DRAW[e.kind] ?? 0
    if (draw <= 0) continue
    if (!entityHasPower(e, state, net)) continue
    d += draw
  }
  return d
}

/** Fraction of the battery currently filled (0..1). */
export function powerFraction(state: GameState): number {
  const cap = powerCapacity(state)
  if (cap <= 0) return 0
  return Math.min(1, Math.max(0, state.power / cap))
}
