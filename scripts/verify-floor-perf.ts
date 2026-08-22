/**
 * Floor render hot path: reuse the power flood-fill, skip idle sim clones.
 */
import { idx } from '../src/game/data.ts'
import { createEntity } from '../src/game/grid.ts'
import { createInitialState } from '../src/game/logic.ts'
import { machineStatus, needsFloorStatus } from '../src/game/machineStatus.ts'
import { powerNet } from '../src/game/power.ts'
import { factoryHasSimWork, simTick } from '../src/game/sim.ts'
import type { Entity, GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

function clearCell(state: GameState, x: number, y: number): GameState {
  const id = state.tiles[idx(x, y)]?.entityId
  if (!id) return state
  const entities = { ...state.entities }
  delete entities[id]
  const tiles = state.tiles.map((t, i) =>
    i === idx(x, y) ? { ...t, entityId: null } : t,
  )
  return { ...state, entities, tiles }
}

function stamp(state: GameState, ent: Entity): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  tiles[idx(ent.x, ent.y)] = { ...tiles[idx(ent.x, ent.y)], entityId: ent.id }
  return { ...state, tiles, entities: { ...state.entities, [ent.id]: ent } }
}

function pave(state: GameState, x: number, y: number): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  tiles[idx(x, y)] = { ...tiles[idx(x, y)], foundation: true }
  return { ...state, tiles }
}

{
  const idle = createInitialState()
  assert(!factoryHasSimWork(idle), 'a fresh map of trees and rocks has no sim work')
  assert(simTick(idle, 0.2) === idle, 'idle sim must not clone the factory')
}

{
  let state = createInitialState()
  state = clearCell(state, 4, 4)
  state = clearCell(state, 5, 4)
  const gen = createEntity('generator', 4, 4, 'E')
  state = stamp(state, gen)
  state = pave(state, 5, 4)

  const first = powerNet(state)
  const clonedTiles = powerNet({ ...state, tiles: state.tiles.slice() })
  assert(first === clonedTiles, 'cloned tiles with the same floor must reuse the power net')

  const newEntities = powerNet({
    ...state,
    lastTick: state.lastTick + 1,
    entities: { ...state.entities },
  })
  assert(first === newEntities, 'a new entities object with the same generators reuses the net')

  state = pave(state, 8, 8)
  const afterPave = powerNet(state)
  assert(afterPave !== first, 'paving a new slab must recompute the power net')
  assert(!afterPave.floor[idx(8, 8)], 'an isolated slab stays unpowered')
  assert(afterPave.floor[idx(5, 4)], 'the slab next to the generator stays powered')
}

{
  let state = createInitialState()
  const tree = Object.values(state.entities).find((e) => e.kind === 'tree')
  assert(tree, 'fresh map has a tree')
  assert(!needsFloorStatus(tree), 'unmarked trees skip floor status work')
  const marked = { ...tree!, marked: true }
  assert(needsFloorStatus(marked), 'marked trees still show a waiting class')

  const belt = createEntity('belt', 2, 2, 'E')
  assert(!needsFloorStatus(belt), 'empty belts skip floor status work')
  const drill = createEntity('drill', 2, 3, 'E')
  assert(needsFloorStatus(drill), 'drills still need a status class')

  const net = powerNet(state)
  const status = machineStatus(drill, state.tiles[idx(2, 3)], state, net)
  assert(status.label.length > 0, 'shared power net still produces a drill status')
}

console.log('verify-floor-perf: ok')
