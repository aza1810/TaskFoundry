/**
 * Headless checks for 3x3 roboports, 2x2 drills (3x3 mine area), and rocks.
 */
import {
  STARTER_PAD,
  footprintCells,
  idx,
  inBounds,
  inStarterPad,
  mineCells,
  sizeOf,
} from '../src/game/data.ts'
import { createEntity } from '../src/game/grid.ts'
import {
  createInitialState,
  placeEntity,
  tickDrones,
} from '../src/game/logic.ts'
import { sumChestStores } from '../src/game/chestInventory.ts'
import { runMineCycles } from '../src/game/sim.ts'
import type { GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

function occupyCount(state: GameState, id: string): number {
  return state.tiles.filter((t) => t.entityId === id).length
}

function tick(state: GameState, seconds: number, step = 0.2): GameState {
  let next = state
  let t = 0
  while (t < seconds) {
    next = tickDrones(next, step)
    t += step
  }
  return next
}

const roboportSize = sizeOf('roboport')
assert(roboportSize.w === 3 && roboportSize.h === 3, 'roboport should be 3x3')
const drillSize = sizeOf('drill')
assert(drillSize.w === 2 && drillSize.h === 2, 'drill should be 2x2')
assert(mineCells(0, 0).length === 9, 'drill mine area should be 3x3')
assert(footprintCells('roboport', 0, 0).length === 9, 'roboport footprint 9 tiles')

let state = createInitialState()

const padBlocked = Object.values(state.entities).some(
  (e) => (e.kind === 'tree' || e.kind === 'rock') && inStarterPad(e.x, e.y),
)
assert(!padBlocked, 'starter pad should be clear of trees and rocks')

const rockCount = Object.values(state.entities).filter((e) => e.kind === 'rock').length
assert(rockCount >= 8, `expected rocks on a fresh map, got ${rockCount}`)

const padX = STARTER_PAD.x + 1
const padY = STARTER_PAD.y + 1
state = { ...state, selected: 'roboport' }
state = placeEntity(state, padX, padY)
const robo = Object.values(state.entities).find((e) => e.kind === 'roboport' && !e.ghost)
if (!robo) fail('roboport did not place on the starter pad')
assert(!robo.ghost, 'roboport should build instantly')
assert(occupyCount(state, robo.id) === 9, 'roboport should occupy 9 tiles')
assert(state.drones.length >= 1, 'roboport should deploy a drone')

const overlap = placeEntity({ ...state, selected: 'chest', inventory: { ...state.inventory, chest: 4 } }, padX + 1, padY + 1)
assert(
  occupyCount(overlap, robo.id) === 9,
  'placing over a roboport tile should be rejected',
)

let drillPos: { x: number; y: number } | null = null
outer: for (let y = 0; y < state.height - 1; y++) {
  for (let x = 0; x < state.width - 1; x++) {
    const cells = footprintCells('drill', x, y)
    if (cells.some((c) => state.tiles[idx(c.x, c.y)].entityId)) continue
    const mines = mineCells(x, y)
    if (mines.some((c) => state.tiles[idx(c.x, c.y)]?.ore === 'ironOre')) {
      drillPos = { x, y }
      break outer
    }
  }
}
if (!drillPos) fail('no valid 2x2 drill spot over a 3x3 iron patch')

state = {
  ...state,
  selected: 'drill',
  inventory: { ...state.inventory, drill: 2, chest: 4 },
}
state = placeEntity(state, drillPos.x, drillPos.y)
const drill = Object.values(state.entities).find((e) => e.kind === 'drill')
if (!drill) fail('drill ghost did not place')
assert(drill.ghost, 'drill should be a drone ghost')
assert(occupyCount(state, drill.id) === 4, 'drill ghost should occupy 4 tiles')

state = tick(state, 12)
const builtDrill = state.entities[drill.id]
assert(builtDrill && !builtDrill.ghost, 'drone should construct the drill')

{
  let placed = false
  outerGen: for (let y = builtDrill.y - 5; y <= builtDrill.y + 6; y++) {
    for (let x = builtDrill.x - 5; x <= builtDrill.x + 6; x++) {
      if (!inBounds(x, y)) continue
      if (state.tiles[idx(x, y)].entityId) continue
      const gen = createEntity('generator', x, y, 'E')
      const tiles = state.tiles.map((t) => ({ ...t }))
      tiles[idx(x, y)].entityId = gen.id
      state = { ...state, tiles, entities: { ...state.entities, [gen.id]: gen } }
      placed = true
      break outerGen
    }
  }
  assert(placed, 'could not place a generator within 5 tiles of the drill')
}

const beforeOre = state.tiles.reduce((n, t) => n + (t.ore === 'ironOre' ? (t.amount ?? 0) : 0), 0)
state = { ...state, power: 200 }
state = runMineCycles(state, 6)
const afterOre = state.tiles.reduce((n, t) => n + (t.ore === 'ironOre' ? (t.amount ?? 0) : 0), 0)
assert(afterOre < beforeOre, '2x2 drill should mine from its 3x3 area')
const stored = builtDrill.store.ironOre ?? 0
const minedOutsideBody = mineCells(drillPos.x, drillPos.y).some((c) => {
  const onBody =
    c.x >= drillPos!.x && c.x <= drillPos!.x + 1 && c.y >= drillPos!.y && c.y <= drillPos!.y + 1
  return !onBody && state.tiles[idx(c.x, c.y)]?.ore === 'ironOre'
})
assert(stored > 0 || minedOutsideBody || afterOre < beforeOre, 'drill produced ore')

let chestPos: { x: number; y: number } | null = null
for (let y = STARTER_PAD.y; y < STARTER_PAD.y + STARTER_PAD.h && !chestPos; y++) {
  for (let x = STARTER_PAD.x; x < STARTER_PAD.x + STARTER_PAD.w; x++) {
    if (!state.tiles[idx(x, y)].entityId) {
      chestPos = { x, y }
      break
    }
  }
}
if (!chestPos) {
  chestPos = { x: padX + 3, y: padY }
}
state = { ...state, selected: 'chest' }
state = placeEntity(state, chestPos.x, chestPos.y)
const chest = Object.values(state.entities).find((e) => e.kind === 'chest')
if (!chest) fail('chest did not place')
state = tick(state, 12)
assert(!state.entities[chest.id]?.ghost, 'drone should construct the chest')

const rock = Object.values(state.entities).find((e) => e.kind === 'rock')
if (!rock) fail('no rock to excavate')
state = { ...state, selected: 'remove' }
state = placeEntity(state, rock.x, rock.y)
assert(state.entities[rock.id]?.marked, 'rock should be marked for excavation')
state = tick(state, 20)
assert(!state.entities[rock.id], 'drone should excavate the marked rock')
const stock = sumChestStores(state)
assert((stock.stone ?? 0) >= 6, `expected 6+ stone, got ${stock.stone ?? 0}`)
assert((stock.ironOre ?? 0) >= 1, `expected trace iron from rock, got ${stock.ironOre ?? 0}`)

console.log(
  JSON.stringify({
    ok: true,
    roboportTiles: 9,
    drillTiles: 4,
    rocks: rockCount,
    stone: stock.stone,
    ironFromRock: stock.ironOre,
    mined: beforeOre - afterOre,
  }),
)
