/**
 * Drills must mine from stored power while you watch (not only on steps).
 * Reconstructs the starter line from Aaron's save.
 */
import { footprintCells, idx } from '../src/game/data.ts'
import { createEntity } from '../src/game/grid.ts'
import { createInitialState, tickState } from '../src/game/logic.ts'
import { simTick } from '../src/game/sim.ts'
import type { Entity, GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

function stamp(state: GameState, ent: Entity): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  for (const c of footprintCells(ent.kind, ent.x, ent.y)) {
    tiles[idx(c.x, c.y)].entityId = ent.id
  }
  return { ...state, tiles, entities: { ...state.entities, [ent.id]: ent } }
}

function pave(state: GameState, cells: { x: number; y: number }[]): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  for (const c of cells) tiles[idx(c.x, c.y)].foundation = true
  return { ...state, tiles }
}

function buildLine(): GameState {
  let state = createInitialState()
  const drill = createEntity('drill', 10, 4, 'E')
  const belt = createEntity('belt', 12, 4, 'E')
  const inserter = createEntity('inserter', 13, 4, 'E')
  const chest = createEntity('chest', 14, 4, 'E')
  chest.store = { ironOre: 76 }
  const gen = createEntity('generator', 14, 5, 'E')
  for (const e of [drill, belt, inserter, chest, gen]) state = stamp(state, e)
  state = pave(state, [
    { x: 13, y: 4 },
    { x: 14, y: 4 },
    { x: 13, y: 5 },
    { x: 14, y: 5 },
  ])
  return { ...state, power: 80, lastTick: 1_000_000 }
}

{
  const idle = buildLine()
  const afterSim = simTick(idle, 3)
  const chestId = Object.keys(idle.entities).find((id) => idle.entities[id].kind === 'chest')!
  assert(
    (afterSim.entities[chestId].store.ironOre ?? 0) === 76,
    'simTick alone should not mine (no steps, no battery mining)',
  )
}

{
  const line = buildLine()
  const chestId = Object.keys(line.entities).find((id) => line.entities[id].kind === 'chest')!
  const after = tickState(line, 1_000_000 + 4000)
  const iron = after.entities[chestId].store.ironOre ?? 0
  assert(iron > 76, `watching for 4s should move ore into the chest, got ${iron}`)
  assert((after.stats.itemsMoved ?? 0) > 0, 'inserter should have transferred at least one item')
  const belt = Object.values(after.entities).find((e) => e.kind === 'belt')
  const drill = Object.values(after.entities).find((e) => e.kind === 'drill')
  const moving =
    (belt?.cargo?.item === 'ironOre') ||
    (drill?.store.ironOre ?? 0) > 0 ||
    iron > 76
  assert(moving, 'ore should be on the belt, in the drill, or already in the chest')
}

console.log('verify-idle-mine: ok')
