/**
 * 2x2 drills dump onto exactly one facing-edge tile (the orange port).
 * Default is the primary / "top" square; flip picks the other square.
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
import type { Dir, Entity, GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

function sameCell(
  a: { x: number; y: number },
  x: number,
  y: number,
): boolean {
  return a.x === x && a.y === y
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

const at = (x: number, y: number, dir: Dir, flip = false) =>
  drillOutputCells('drill', x, y, dir, flip)

const eDefault = at(2, 4, 'E')
assert(eDefault.length === 1, 'E dump is a single tile')
assert(sameCell(eDefault[0], 4, 4), 'E default dumps the top cell (4,4)')
assert(
  sameCell(at(2, 4, 'E', true)[0], 4, 5),
  'E flipped dumps the bottom cell (4,5)',
)
assert(
  !drillDropCells('drill', 2, 4, 'E').some((c) => c.x === 3 && c.y === 4),
  'interior neighbor is not a dump tile',
)

assert(sameCell(at(2, 4, 'S')[0], 3, 6), 'S default dumps the east cell')
assert(sameCell(at(2, 4, 'S', true)[0], 2, 6), 'S flipped dumps the west cell')
assert(sameCell(at(2, 4, 'W')[0], 1, 5), 'W default dumps the south cell')
assert(sameCell(at(2, 4, 'W', true)[0], 1, 4), 'W flipped dumps the north cell')
assert(sameCell(at(2, 4, 'N')[0], 2, 3), 'N default dumps the west cell')
assert(sameCell(at(2, 4, 'N', true)[0], 3, 3), 'N flipped dumps the east cell')

function ejectCase(
  label: string,
  beltPos: { x: number; y: number },
  flip = false,
): void {
  const drillCells = footprintCells('drill', 2, 4)
  let state = createInitialState()
  state = clearCells(state, [
    ...drillCells,
    beltPos,
    { x: beltPos.x + 1, y: beltPos.y },
  ])
  const drill = createEntity('drill', 2, 4, 'E')
  drill.store = { ironOre: 3 }
  if (flip) drill.flip = true
  const belt = createEntity('belt', beltPos.x, beltPos.y, 'E')
  state = stamp(state, drill, drillCells)
  state = stamp(state, belt, [beltPos])
  state = simTick(state, 0.2)
  const cargo = state.entities[belt.id]?.cargo
  assert(cargo?.item === 'ironOre', `${label}: belt should receive iron ore, got ${cargo?.item}`)
  const left = state.entities[drill.id]?.store.ironOre ?? 0
  assert(left === 2, `${label}: drill should have 2 ore left, got ${left}`)
}

ejectCase('2x2 default dumps onto the top east belt', { x: 4, y: 4 })
ejectCase('2x2 flipped dumps onto the bottom east belt', { x: 4, y: 5 }, true)

{
  const drillCells = footprintCells('drill', 2, 4)
  let state = createInitialState()
  state = clearCells(state, [...drillCells, { x: 4, y: 5 }])
  const drill = createEntity('drill', 2, 4, 'E')
  drill.store = { ironOre: 3 }
  const belt = createEntity('belt', 4, 5, 'E')
  state = stamp(state, drill, drillCells)
  state = stamp(state, belt, [{ x: 4, y: 5 }])
  state = simTick(state, 0.2)
  assert(
    !state.entities[belt.id]?.cargo,
    'unflipped drill must not dump onto the other facing square',
  )
}

console.log('OK: drills dump onto one rotatable / flippable belt square')
