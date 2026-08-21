/**
 * 2x2 drills must dump ore onto belts in front of the orange port,
 * including old 1-tile lines left over from 1x1 drills.
 */
import {
  drillDropCells,
  drillOutputCells,
  footprintCells,
  idx,
} from '../src/game/data.ts'
import { createEntity } from '../src/game/grid.ts'
import { createInitialState } from '../src/game/logic.ts'
import { simTick } from '../src/game/sim.ts'
import type { Entity, GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

function clearCells(state: GameState, cells: { x: number; y: number }[]): GameState {
  const remove = new Set<string>()
  for (const c of cells) {
    const id = state.tiles[idx(c.x, c.y)]?.entityId
    if (id) remove.add(id)
  }
  if (remove.size === 0) return state
  const entities = { ...state.entities }
  for (const id of remove) delete entities[id]
  const tiles = state.tiles.map((t) =>
    t.entityId && remove.has(t.entityId) ? { ...t, entityId: null } : t,
  )
  return { ...state, entities, tiles }
}

function stamp(state: GameState, ent: Entity, cells: { x: number; y: number }[]): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  for (const c of cells) tiles[idx(c.x, c.y)].entityId = ent.id
  return { ...state, tiles, entities: { ...state.entities, [ent.id]: ent } }
}

const outs = drillOutputCells('drill', 2, 4, 'E')
assert(
  outs.some((c) => c.x === 4 && c.y === 4),
  'E-facing 2x2 drill should drop onto (4,4)',
)
assert(
  drillDropCells('drill', 2, 4, 'E').some((c) => c.x === 3 && c.y === 4),
  'legacy drop cell (3,4) should still be accepted',
)

function ejectCase(
  label: string,
  drillCells: { x: number; y: number }[],
  beltPos: { x: number; y: number },
): void {
  let state = createInitialState()
  state = clearCells(state, [
    ...drillCells,
    beltPos,
    { x: beltPos.x + 1, y: beltPos.y },
  ])
  const drill = createEntity('drill', drillCells[0].x, drillCells[0].y, 'E')
  drill.store = { ironOre: 3 }
  const belt = createEntity('belt', beltPos.x, beltPos.y, 'E')
  state = stamp(state, drill, drillCells)
  state = stamp(state, belt, [beltPos])
  state = simTick(state, 0.2)
  const cargo = state.entities[belt.id]?.cargo
  assert(cargo?.item === 'ironOre', `${label}: belt should receive iron ore, got ${cargo?.item}`)
  const left = state.entities[drill.id]?.store.ironOre ?? 0
  assert(left === 2, `${label}: drill should have 2 ore left, got ${left}`)
}

ejectCase(
  '2x2 facing belt on output edge',
  footprintCells('drill', 2, 4),
  { x: 4, y: 4 },
)

ejectCase(
  'legacy 1x1 occupancy with belt one tile in front',
  [{ x: 2, y: 4 }],
  { x: 3, y: 4 },
)

console.log('OK: 2x2 and legacy drills eject onto belts')
