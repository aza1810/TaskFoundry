/**
 * Foundations are floor tiles. Generators electrify 4-connected floor.
 * Drills can tap a generator or powered floor within 5 tiles (Chebyshev).
 */
import { DRILL_POWER_RANGE, footprintCells, idx } from '../src/game/data.ts'
import { createEntity } from '../src/game/grid.ts'
import { createInitialState, placeEntity } from '../src/game/logic.ts'
import {
  drillHasRemotePower,
  entityHasPower,
  entityOnPoweredFloor,
  powerDemand,
  powerNet,
} from '../src/game/power.ts'
import { runMineCycles, simTick } from '../src/game/sim.ts'
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

function pave(state: GameState, cells: { x: number; y: number }[]): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  for (const c of cells) tiles[idx(c.x, c.y)].foundation = true
  return { ...state, tiles }
}

function cell(x: number, y: number): { x: number; y: number } {
  return { x, y }
}

// --- Inventory + instant place ---------------------------------------------
{
  const state = createInitialState()
  assert(state.inventory.foundation === 48, 'new games start with 48 foundations')
  assert(
    state.tiles.every((t) => !t.foundation),
    'new maps should not be pre-paved',
  )
  assert(state.version >= 10, `GAME_VERSION should be 10+, got ${state.version}`)

  const next = placeEntity({ ...state, selected: 'foundation' }, 8, 8)
  assert(next.tiles[idx(8, 8)].foundation === true, 'foundation should paint instantly')
  assert(next.inventory.foundation === 47, 'placing a slab spends one from inventory')
  assert(!next.tiles[idx(8, 8)].entityId, 'foundation is a floor flag, not an entity')

  const stacked = placeEntity({ ...next, selected: 'foundation' }, 8, 8)
  assert(stacked.tiles[idx(8, 8)].foundation === true, 'already paved stays paved')
  assert(stacked.inventory.foundation === 47, 'stacking should not spend another slab')

  const picked = placeEntity({ ...next, selected: 'remove' }, 8, 8)
  assert(!picked.tiles[idx(8, 8)].foundation, 'demolish on empty floor picks up the slab')
  assert(picked.inventory.foundation === 48, 'picked-up slab returns to inventory')
}

// Place under an existing machine, demolish machine first
{
  let state = createInitialState()
  state = clearCells(state, [cell(8, 8)])
  const chest = createEntity('chest', 8, 8, 'E')
  state = stamp(state, chest, [cell(8, 8)])
  state = { ...state, selected: 'foundation', inventory: { ...state.inventory, foundation: 10 } }
  state = placeEntity(state, 8, 8)
  assert(state.tiles[idx(8, 8)].foundation === true, 'can pave under a machine')
  assert(state.entities[chest.id], 'machine stays when paving under it')

  state = { ...state, selected: 'remove' }
  const afterMachine = placeEntity(state, 8, 8)
  assert(!afterMachine.entities[chest.id], 'first demolish removes the machine')
  assert(afterMachine.tiles[idx(8, 8)].foundation === true, 'floor remains after scraping the machine')
  const afterFloor = placeEntity({ ...afterMachine, selected: 'remove' }, 8, 8)
  assert(!afterFloor.tiles[idx(8, 8)].foundation, 'second demolish picks up the floor')
}

// --- Power network ----------------------------------------------------------
{
  let state = createInitialState()
  state = clearCells(state, [cell(2, 2), cell(3, 2), cell(4, 2), cell(5, 2), cell(10, 2)])
  const gen = createEntity('generator', 2, 2, 'E')
  state = stamp(state, gen, [cell(2, 2)])
  state = pave(state, [cell(3, 2), cell(4, 2)])

  const net = powerNet(state)
  assert(net.floor[idx(3, 2)], 'foundation next to generator should be powered')
  assert(net.floor[idx(4, 2)], '4-connected foundation should flood-fill from the generator')
  assert(!net.floor[idx(5, 2)], 'unpaved neighbor is not powered')

  state = pave(state, [cell(10, 2)])
  const isolated = powerNet(state)
  assert(!isolated.floor[idx(10, 2)], 'isolated foundation far from a generator is unpowered')
}

// Belts only run on powered floor
{
  let state = createInitialState()
  state = clearCells(state, [cell(2, 4), cell(3, 4), cell(4, 4)])
  const gen = createEntity('generator', 2, 4, 'E')
  const beltOff = createEntity('belt', 5, 4, 'E')
  beltOff.cargo = { item: 'ironOre', progress: 0 }
  const beltOn = createEntity('belt', 3, 4, 'E')
  beltOn.cargo = { item: 'ironOre', progress: 0 }
  state = stamp(state, gen, [cell(2, 4)])
  state = stamp(state, beltOff, [cell(5, 4)])
  state = stamp(state, beltOn, [cell(3, 4)])
  state = pave(state, [cell(3, 4)])
  state = { ...state, power: 500 }

  assert(!entityHasPower(beltOff, state), 'belt on grass should be unpowered')
  assert(entityOnPoweredFloor(beltOn, state), 'belt on connected floor should be powered')

  const after = simTick(state, 0.5)
  const offProg = after.entities[beltOff.id]?.cargo?.progress ?? 0
  const onProg = after.entities[beltOn.id]?.cargo?.progress ?? 0
  assert(offProg === 0, `unpowered belt should freeze, got progress ${offProg}`)
  assert(onProg > 0, `powered belt should move cargo, got progress ${onProg}`)
  assert(powerDemand(state) > 0, 'HUD demand should count the connected belt')
}

// Assembler needs powered floor
{
  let state = createInitialState()
  state = clearCells(state, [cell(2, 8), cell(3, 8)])
  const gen = createEntity('generator', 2, 8, 'E')
  const asm = createEntity('assembler', 3, 8, 'E')
  asm.store = { ironPlate: 4 }
  state = stamp(state, gen, [cell(2, 8)])
  state = stamp(state, asm, [cell(3, 8)])
  state = { ...state, power: 500 }

  const idle = simTick(state, 3)
  assert(
    (idle.entities[asm.id]?.store.ironPlate ?? 0) === 4,
    'assembler on grass should not craft',
  )

  state = pave(state, [cell(3, 8)])
  const busy = simTick(state, 3)
  assert(
    (busy.entities[asm.id]?.store.gear ?? 0) >= 1,
    'assembler on powered floor should craft gears',
  )
}

// Drills: Chebyshev range 5 from generator or powered floor
{
  assert(DRILL_POWER_RANGE === 5, 'drill range should be 5 tiles')

  let state = createInitialState()
  const genPos = cell(1, 1)
  const nearPos = cell(6, 1) // distance 5
  const farPos = cell(7, 1) // distance 6
  state = clearCells(state, [
    genPos,
    ...footprintCells('drill', nearPos.x, nearPos.y),
    ...footprintCells('drill', farPos.x, farPos.y),
    cell(2, 1),
    cell(8, 1),
  ])
  const gen = createEntity('generator', genPos.x, genPos.y, 'E')
  const near = createEntity('drill', nearPos.x, nearPos.y, 'E')
  const far = createEntity('drill', farPos.x, farPos.y, 'E')
  near.store = {}
  far.store = {}
  state = stamp(state, gen, [genPos])
  state = stamp(state, near, footprintCells('drill', nearPos.x, nearPos.y))
  state = stamp(state, far, footprintCells('drill', farPos.x, farPos.y))
  state = { ...state, power: 500 }

  assert(drillHasRemotePower(near, state), 'drill 5 tiles from a generator should have power')
  assert(!drillHasRemotePower(far, state), 'drill 6 tiles from a generator should not have power')

  const minedNear = runMineCycles(state, 1)
  // Far drill must not mine; near drill may mine if its 3x3 has ore.
  const farAfter = minedNear.entities[far.id]?.store.ironOre ?? 0
  const farCopper = minedNear.entities[far.id]?.store.copperOre ?? 0
  const farCoal = minedNear.entities[far.id]?.store.coal ?? 0
  assert(
    farAfter + farCopper + farCoal === 0,
    'out-of-range drill should not mine',
  )

  // Isolated powered floor as the tap: generator at (1,1), pave (2,1),
  // drill whose nearest cell is 5 from that floor tile.
  let floorState = createInitialState()
  const floorTap = cell(2, 10)
  const drillOk = cell(7, 10) // distance 5 from (2,10)
  const drillNo = cell(8, 10) // distance 6
  floorState = clearCells(floorState, [
    cell(1, 10),
    floorTap,
    ...footprintCells('drill', drillOk.x, drillOk.y),
    ...footprintCells('drill', drillNo.x, drillNo.y),
  ])
  const gen2 = createEntity('generator', 1, 10, 'E')
  const dOk = createEntity('drill', drillOk.x, drillOk.y, 'E')
  const dNo = createEntity('drill', drillNo.x, drillNo.y, 'E')
  floorState = stamp(floorState, gen2, [cell(1, 10)])
  floorState = stamp(floorState, dOk, footprintCells('drill', drillOk.x, drillOk.y))
  floorState = stamp(floorState, dNo, footprintCells('drill', drillNo.x, drillNo.y))
  floorState = pave(floorState, [floorTap])

  assert(
    drillHasRemotePower(dOk, floorState),
    'drill 5 tiles from a powered foundation should have power',
  )
  assert(
    !drillHasRemotePower(dNo, floorState),
    'drill 6 tiles from a powered foundation should not have power',
  )
}

console.log('verify-foundations: ok')
