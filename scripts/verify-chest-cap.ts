/**
 * New games may place two chests immediately (starter inventory is 2).
 */
import { idx } from '../src/game/data.ts'
import { createInitialState, placeEntity, selectTool } from '../src/game/logic.ts'
import { countPlacedChests, maxChestsFor } from '../src/game/research.ts'
import type { GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

assert(maxChestsFor([], []) === 2, 'starting chest cap should be 2')
assert(
  maxChestsFor([], ['place-furnace']) === 2,
  'furnace goal should not raise the cap above 2',
)
assert(maxChestsFor(['storage'], []) === 4, 'Factory storage raises the cap to 4')
assert(maxChestsFor(['storage', 'storage2'], []) === 6, 'Warehouse logistics raises the cap to 6')

function clearAt(state: GameState, x: number, y: number): GameState {
  const id = state.tiles[idx(x, y)]?.entityId
  if (!id) return state
  const entities = { ...state.entities }
  delete entities[id]
  const tiles = state.tiles.map((t) =>
    t.entityId === id ? { ...t, entityId: null } : t,
  )
  return { ...state, entities, tiles }
}

function emptyTiles(state: GameState, n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let y = 0; y < state.height && out.length < n; y++) {
    for (let x = 0; x < state.width && out.length < n; x++) {
      if (!state.tiles[idx(x, y)]?.entityId) out.push({ x, y })
    }
  }
  return out
}

let state = createInitialState()
const spots = emptyTiles(state, 3)
assert(spots.length === 3, 'need three empty tiles')
for (const c of spots) state = clearAt(state, c.x, c.y)
state = selectTool(state, 'chest')
state = placeEntity(state, spots[0].x, spots[0].y)
state = placeEntity(state, spots[1].x, spots[1].y)
assert(countPlacedChests(state.entities) === 2, 'should place two starter chests')
const blocked = placeEntity(state, spots[2].x, spots[2].y)
assert(
  countPlacedChests(blocked.entities) === 2,
  'third chest should be rejected at the starting cap',
)
assert(
  (blocked.unlockedToast ?? '').includes('Chest limit 2/2'),
  `third chest should toast the cap, got ${blocked.unlockedToast}`,
)

console.log('OK: starting chest cap is 2')
