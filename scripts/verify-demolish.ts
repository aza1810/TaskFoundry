/**
 * Drones scrap marked buildings. Pack keeps one stack of each material so
 * demolishing the last chest cannot lock you out of crafting.
 */
import {
  BUILD_COST,
  PACK_STACK_SIZE,
  STARTER_PAD,
  idx,
} from '../src/game/data.ts'
import {
  canAcceptMaterial,
  canAffordStock,
  capWarehousePack,
  packRoom,
  stockOf,
} from '../src/game/chestInventory.ts'
import {
  createInitialState,
  placeEntity,
  tickDrones,
} from '../src/game/logic.ts'
import type { GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

function tick(state: GameState, seconds: number, step = 0.25): GameState {
  let next = state
  let t = 0
  while (t < seconds) {
    next = tickDrones(next, step)
    t += step
  }
  return next
}

function findEmpty(state: GameState): { x: number; y: number } {
  for (let y = STARTER_PAD.y; y < STARTER_PAD.y + STARTER_PAD.h; y++) {
    for (let x = STARTER_PAD.x; x < STARTER_PAD.x + STARTER_PAD.w; x++) {
      if (!state.tiles[idx(x, y)]?.entityId) return { x, y }
    }
  }
  fail('no empty tile on the starter pad')
}

const pack = capWarehousePack({
  ...createInitialState().inventory,
  ironOre: 250,
  ironPlate: 40,
})
assert(pack.ironOre === PACK_STACK_SIZE, 'pack iron ore caps at one stack')
assert(pack.ironPlate === 40, 'pack under the cap is unchanged')

let state = createInitialState()
assert(canAcceptMaterial(state, 'wood'), 'empty pack can take wood without a chest')
assert(packRoom(state, 'wood') === PACK_STACK_SIZE, 'fresh pack has a full wood stack of room')

const padX = STARTER_PAD.x + 1
const padY = STARTER_PAD.y + 1
state = { ...state, selected: 'roboport' }
state = placeEntity(state, padX, padY)
const robo = Object.values(state.entities).find((e) => e.kind === 'roboport')
if (!robo) fail('need a roboport')

const spot = findEmpty(state)
state = {
  ...state,
  selected: 'chest',
  inventory: { ...state.inventory, chest: 2, ironPlate: 0 },
}
state = placeEntity(state, spot.x, spot.y)
let chest = Object.values(state.entities).find((e) => e.kind === 'chest')
if (!chest) fail('chest ghost should place')
assert(chest.ghost === true, 'chest starts as a construction ghost')

state = tick(state, 6)
chest = Object.values(state.entities).find((e) => e.kind === 'chest')
if (!chest) fail('drone should finish the chest')
assert(!chest.ghost, 'chest should be built')

const entities = { ...state.entities }
entities[chest.id] = { ...chest, store: { ironPlate: 20 } }
state = { ...state, entities }
assert(stockOf(state, 'ironPlate') === 20, 'plates live in the chest')

state = { ...state, selected: 'remove' }
state = placeEntity(state, spot.x, spot.y)
chest = state.entities[chest.id]
if (!chest) fail('chest should still be on the floor after mark')
assert(chest.marked === true, 'demolish marks the chest for a drone')
assert(state.tiles[idx(spot.x, spot.y)].entityId === chest.id, 'chest is not deleted instantly')

state = tick(state, 6)
assert(!state.entities[chest.id], 'drone should have scrapped the chest')
assert(stockOf(state, 'ironPlate') === 20, 'plates move into the pack')
assert((state.inventory.chest ?? 0) >= 1, 'scrapped chest returns to the pack')
assert(
  canAffordStock(state, BUILD_COST.chest),
  'pack plates are enough to craft another chest',
)

const ghostSpot = findEmpty(state)
state = {
  ...state,
  selected: 'belt',
  inventory: { ...state.inventory, belt: 3 },
}
state = placeEntity(state, ghostSpot.x, ghostSpot.y)
const belt = Object.values(state.entities).find(
  (e) => e.kind === 'belt' && e.x === ghostSpot.x && e.y === ghostSpot.y,
)
if (!belt) fail('belt ghost missing')
assert(belt.ghost === true, 'belt is a ghost')
state = { ...state, selected: 'remove' }
state = placeEntity(state, ghostSpot.x, ghostSpot.y)
assert(!state.entities[belt.id], 'unbuilt ghosts cancel immediately')

console.log('verify-demolish: ok')
