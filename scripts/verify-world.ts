/**
 * Headless checks for the 240x160 world, tree/rock variants, and save expand.
 */
import {
  GAME_VERSION,
  GRID_H,
  GRID_W,
  LEGACY_GRID_H,
  LEGACY_GRID_W,
  ROCK_COUNT,
  ROCK_VARIANTS,
  STARTER_PAD,
  TREE_COUNT,
  TREE_VARIANTS,
  idx,
  inBounds,
  inStarterPad,
  rockVariant,
  treeVariant,
} from '../src/game/data.ts'
import {
  createEntity,
  createTiles,
  expandLegacyTiles,
  packTiles,
  unpackTiles,
} from '../src/game/grid.ts'
import {
  createInitialState,
  persistableState,
  placeEntity,
  tickDrones,
} from '../src/game/logic.ts'
import { sumChestStores } from '../src/game/chestInventory.ts'
import type { GameState, Tile } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
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

function plant(
  state: GameState,
  kind: 'tree' | 'rock',
  variant: string,
  nearX: number,
  nearY: number,
): { state: GameState; id: string } {
  let spot: { x: number; y: number } | null = null
  outer: for (let y = nearY - 3; y <= nearY + 3; y++) {
    for (let x = nearX - 3; x <= nearX + 3; x++) {
      if (!inBounds(x, y)) continue
      if (state.tiles[idx(x, y)].entityId) continue
      spot = { x, y }
      break outer
    }
  }
  if (!spot) fail(`no tile to plant ${kind}`)
  const ent = createEntity(kind, spot.x, spot.y, 'N')
  ent.variant = variant as typeof ent.variant
  const tiles = state.tiles.map((t) => ({ ...t }))
  tiles[idx(spot.x, spot.y)].entityId = ent.id
  return {
    state: { ...state, tiles, entities: { ...state.entities, [ent.id]: ent } },
    id: ent.id,
  }
}

assert(GRID_W === 240 && GRID_H === 160, `expected 240x160, got ${GRID_W}x${GRID_H}`)
assert(GRID_W === LEGACY_GRID_W * 10, 'width should be 10x the original map')
assert(GRID_H === LEGACY_GRID_H * 10, 'height should be 10x the original map')
assert(GAME_VERSION >= 11, 'save version should bump for the world expand')

const tiles = createTiles()
assert(tiles.length === GRID_W * GRID_H, `tile count ${tiles.length}`)
const starterIron = tiles[idx(4, 3)]
assert(starterIron.ore === 'ironOre', 'starter iron patch should still sit at 4,3')
assert((starterIron.amount ?? 0) >= 400, 'starter iron should keep a large reserve')
const starterCopper = tiles[idx(18, 5)]
assert(starterCopper.ore === 'copperOre', 'starter copper patch should still sit at 18,5')
const starterCoal = tiles[idx(5, 12)]
assert(starterCoal.ore === 'coal', 'starter coal patch should still sit at 5,12')

let wildernessOre = 0
for (let y = LEGACY_GRID_H + 8; y < GRID_H; y++) {
  for (let x = 0; x < GRID_W; x++) {
    if (tiles[idx(x, y)].ore) wildernessOre++
  }
}
assert(wildernessOre > 80, `expected wilderness ore patches, got ${wildernessOre} ore tiles south of the old map`)

let state = createInitialState()
assert(state.width === GRID_W && state.height === GRID_H, 'fresh save should use the large map')
assert(state.tiles.length === GRID_W * GRID_H, 'fresh tiles should fill the large map')

const padBlocked = Object.values(state.entities).some(
  (e) => (e.kind === 'tree' || e.kind === 'rock') && inStarterPad(e.x, e.y),
)
assert(!padBlocked, 'starter pad should be clear of trees and rocks')

const trees = Object.values(state.entities).filter((e) => e.kind === 'tree')
const rocks = Object.values(state.entities).filter((e) => e.kind === 'rock')
assert(trees.length >= Math.floor(TREE_COUNT * 0.5), `expected many trees, got ${trees.length}`)
assert(rocks.length >= Math.floor(ROCK_COUNT * 0.5), `expected many rocks, got ${rocks.length}`)

const treeKinds = new Set(trees.map((t) => treeVariant(t.variant).id))
const rockKinds = new Set(rocks.map((r) => rockVariant(r.variant).id))
assert(treeKinds.size >= 3, `expected several tree varieties, got ${[...treeKinds].join(',')}`)
assert(rockKinds.size >= 4, `expected several rock varieties, got ${[...rockKinds].join(',')}`)

assert(treeVariant('oak').wood === 7 && treeVariant('oak').cutSeconds === 3.5, 'oak yields')
assert(treeVariant('birch').wood === 3 && treeVariant('birch').cutSeconds === 1.5, 'birch yields')
assert(treeVariant('deadwood').wood === 2, 'deadwood yields')
assert(rockVariant('ironVein').primary === 'ironOre', 'iron vein primary')
assert(rockVariant('copperVein').primary === 'copperOre', 'copper vein primary')
assert(rockVariant('coalSeam').primary === 'coal', 'coal seam primary')
assert(rockVariant('boulder').mineSeconds === 5.5, 'boulder work time')
assert(TREE_VARIANTS.pine.wood === 4, 'pine remains the default tree')
assert(ROCK_VARIANTS.stone.drops[0]?.amount === 6, 'stone rock still drops 6 stone')

const old: Tile[] = Array.from({ length: LEGACY_GRID_W * LEGACY_GRID_H }, () => ({
  ore: null,
  amount: null,
  entityId: null,
  foundation: false,
}))
old[3 * LEGACY_GRID_W + 2] = {
  ore: null,
  amount: null,
  entityId: 'chest-keep',
  foundation: true,
}
const expanded = expandLegacyTiles(old)
assert(expanded.length === GRID_W * GRID_H, 'expanded tiles fill the new map')
assert(expanded[idx(2, 3)].entityId === 'chest-keep', 'old factory tiles blit into the top-left')
assert(expanded[idx(2, 3)].foundation === true, 'old foundation should copy over')
assert(expanded[idx(4, 3)].ore === 'ironOre' || expanded[idx(2, 3)].entityId === 'chest-keep', 'expand keeps starter region')
const far = expanded[idx(120, 80)]
assert(far.entityId !== 'chest-keep', 'old entities should not appear in the new wilderness')

const padX = STARTER_PAD.x + 1
const padY = STARTER_PAD.y + 1
state = { ...state, selected: 'roboport' }
state = placeEntity(state, padX, padY)
const robo = Object.values(state.entities).find((e) => e.kind === 'roboport' && !e.ghost)
if (!robo) fail('roboport did not place on the starter pad')

let chestPos: { x: number; y: number } | null = null
outerChest: for (let y = padY - 1; y <= padY + 4; y++) {
  for (let x = padX + 3; x <= padX + 6; x++) {
    if (!inBounds(x, y)) continue
    if (state.tiles[idx(x, y)].entityId) continue
    chestPos = { x, y }
    break outerChest
  }
}
if (!chestPos) fail('no tile for a chest')
state = {
  ...state,
  selected: 'chest',
  inventory: { ...state.inventory, chest: 4 },
}
state = placeEntity(state, chestPos.x, chestPos.y)
const chest = Object.values(state.entities).find((e) => e.kind === 'chest')
if (!chest) fail('chest did not place')
state = tick(state, 12)
assert(!state.entities[chest.id]?.ghost, 'drone should construct the chest')

const oakPlant = plant(state, 'tree', 'oak', chest.x, chest.y)
state = oakPlant.state
state = { ...state, selected: 'remove' }
state = placeEntity(state, state.entities[oakPlant.id].x, state.entities[oakPlant.id].y)
assert(state.entities[oakPlant.id]?.marked, 'oak should be marked')
state = tick(state, 12)
assert(!state.entities[oakPlant.id], 'drone should chop the oak')
let stock = sumChestStores(state)
assert((stock.wood ?? 0) >= 7, `oak should drop 7 wood, got ${stock.wood ?? 0}`)

const veinPlant = plant(state, 'rock', 'ironVein', chest.x, chest.y)
state = veinPlant.state
state = { ...state, selected: 'remove' }
state = placeEntity(state, state.entities[veinPlant.id].x, state.entities[veinPlant.id].y)
assert(state.entities[veinPlant.id]?.marked, 'iron vein should be marked')
state = tick(state, 12)
assert(!state.entities[veinPlant.id], 'drone should excavate the iron vein')
stock = sumChestStores(state)
assert((stock.ironOre ?? 0) >= 4, `iron vein should drop 4 iron, got ${stock.ironOre ?? 0}`)
assert((stock.stone ?? 0) >= 3, `iron vein should drop stone, got ${stock.stone ?? 0}`)

const packed = packTiles(state.tiles)
const unpacked = unpackTiles(packed)
if (!unpacked) fail('unpackTiles returned null')
assert(unpacked.length === GRID_W * GRID_H, 'packed tiles unpack to the full map')
assert(unpacked[idx(4, 3)].ore === 'ironOre', 'packed starter iron survives a round trip')
const fat = JSON.stringify(state.tiles).length
const slim = JSON.stringify(packed).length
assert(slim < fat * 0.55, `packed save should be much smaller (${slim} vs ${fat})`)
const persisted = persistableState(state)
assert(packTiles(persisted.tiles).n === GRID_W * GRID_H, 'persistableState packs tiles')

console.log(
  JSON.stringify({
    ok: true,
    grid: `${GRID_W}x${GRID_H}`,
    tiles: state.tiles.length,
    trees: trees.length,
    rocks: rocks.length,
    treeKinds: [...treeKinds],
    rockKinds: [...rockKinds],
    wildernessOre,
    oakWood: stock.wood,
    veinIron: stock.ironOre,
    saveBytes: slim,
    fullTileBytes: fat,
  }),
)
