import {
  BELT_SPEED,
  DIR_DELTA,
  FURNACE_COAL_PER_SMELT,
  FURNACE_INPUT_ORES,
  FURNACE_SECONDS,
  INSERTER_COOLDOWN,
  OPPOSITE,
  SMELT_MAP,
  idx,
} from './data'
import { getTile } from './grid'
import type {
  Entity,
  GameState,
  ItemId,
  OreId,
} from './types'

const MACHINE_CAP: Record<string, number> = {
  drill: 5,
  furnace: 10,
  chest: 50,
}

function storeSum(
  store: Partial<Record<ItemId, number>>,
  except?: ItemId[],
): number {
  let sum = 0
  for (const [id, n] of Object.entries(store) as [ItemId, number][]) {
    if (except?.includes(id)) continue
    sum += n ?? 0
  }
  return sum
}

function addToStore(
  store: Partial<Record<ItemId, number>>,
  item: ItemId,
  n: number,
  cap: number,
  exceptFromCap?: ItemId[],
): number {
  const have = storeSum(store, exceptFromCap)
  const space = Math.max(0, cap - have)
  const put = Math.min(n, space)
  if (put <= 0) return 0
  store[item] = (store[item] ?? 0) + put
  return put
}

function takeFromStore(
  store: Partial<Record<ItemId, number>>,
  item: ItemId,
  n = 1,
): number {
  const have = store[item] ?? 0
  const take = Math.min(have, n)
  if (take <= 0) return 0
  store[item] = have - take
  if (store[item] === 0) delete store[item]
  return take
}

function takeAny(
  store: Partial<Record<ItemId, number>>,
  prefer?: ItemId[],
): ItemId | null {
  if (prefer) {
    for (const id of prefer) {
      if ((store[id] ?? 0) > 0) {
        takeFromStore(store, id, 1)
        return id
      }
    }
  }
  for (const [id, n] of Object.entries(store) as [ItemId, number][]) {
    if (n > 0) {
      takeFromStore(store, id, 1)
      return id
    }
  }
  return null
}

function neighbor(
  state: GameState,
  x: number,
  y: number,
  dir: Entity['dir'],
): { x: number; y: number; entity: Entity | null; tile: ReturnType<typeof getTile> } {
  const { dx, dy } = DIR_DELTA[dir]
  const nx = x + dx
  const ny = y + dy
  const tile = getTile(state.tiles, nx, ny)
  const entity = tile?.entityId ? state.entities[tile.entityId] ?? null : null
  return { x: nx, y: ny, entity, tile }
}

/** One mining cycle per drill — driven by player steps */
export function runMineCycles(state: GameState, cycles: number): GameState {
  if (cycles <= 0) return state
  const entities = { ...state.entities }
  const tiles = state.tiles.map((t) => ({ ...t }))
  let mined = 0

  for (let c = 0; c < cycles; c++) {
    for (const ent of Object.values(entities)) {
      if (ent.kind !== 'drill') continue
      const e = { ...ent, store: { ...ent.store } }
      const tile = tiles[idx(e.x, e.y)]
      if (!tile?.ore) {
        entities[e.id] = e
        continue
      }
      if (tile.amount !== null && tile.amount <= 0) {
        tile.ore = null
        entities[e.id] = e
        continue
      }

      // Burner drill sips coal from its own store, else from player? Require coal in drill.
      // Auto-feed: if drill has no coal, skip. Player/inserter must feed coal.
      // Starter QoL: drills can pull 1 coal from inventory once — keep strict: need coal in store.
      if ((e.store.coal ?? 0) < 0.25) {
        // Try sip from inventory automatically for burner convenience? User wants Factorio feel —
        // require coal in drill. But starter drills need fuel: allow consuming from inventory if empty.
        entities[e.id] = e
        continue
      }

      // Coal is fuel — don't let it fill the output buffer cap
      const put = addToStore(e.store, tile.ore, 1, MACHINE_CAP.drill, ['coal'])
      if (put <= 0) {
        entities[e.id] = e
        continue
      }

      // Consume fractional coal per cycle
      const coalUse = 0.25
      e.store.coal = (e.store.coal ?? 0) - coalUse
      if (e.store.coal <= 0.001) delete e.store.coal

      if (tile.amount !== null) {
        tile.amount -= 1
        if (tile.amount <= 0) {
          tile.amount = 0
          tile.ore = null
        }
      }
      mined += 1
      entities[e.id] = e
    }
  }

  return {
    ...state,
    entities,
    tiles,
    mineCycles: state.mineCycles + cycles,
    xp: state.xp + Math.floor(mined / 5),
  }
}

function tryAcceptItem(entity: Entity, item: ItemId): boolean {
  if (entity.kind === 'belt') {
    if (entity.cargo) return false
    entity.cargo = { item, progress: 0 }
    return true
  }
  if (entity.kind === 'chest' || entity.kind === 'drill') {
    return addToStore(entity.store, item, 1, MACHINE_CAP[entity.kind]) > 0
  }
  if (entity.kind === 'furnace') {
    // Accept ore or coal into input store
    if (
      item === 'coal' ||
      item === 'ironOre' ||
      item === 'copperOre'
    ) {
      return addToStore(entity.store, item, 1, MACHINE_CAP.furnace) > 0
    }
    return false
  }
  if (entity.kind === 'inserter') return false
  return false
}

function tryExtractItem(
  entity: Entity,
  prefer?: ItemId[],
): ItemId | null {
  if (entity.kind === 'belt') {
    if (!entity.cargo || entity.cargo.progress < 0.55) return null
    const item = entity.cargo.item
    entity.cargo = null
    return item
  }
  if (entity.kind === 'chest' || entity.kind === 'drill') {
    return takeAny(entity.store, prefer)
  }
  if (entity.kind === 'furnace') {
    // Output plates preferred
    return takeAny(entity.store, prefer ?? ['ironPlate', 'copperPlate'])
  }
  return null
}

function peekExtractable(entity: Entity): ItemId | null {
  if (entity.kind === 'belt') {
    if (!entity.cargo || entity.cargo.progress < 0.55) return null
    return entity.cargo.item
  }
  for (const [id, n] of Object.entries(entity.store) as [ItemId, number][]) {
    if (n > 0) return id
  }
  return null
}

/** Continuous factory simulation: belts, inserters, furnaces */
export function simTick(state: GameState, dt: number): GameState {
  if (dt <= 0) return state
  const entities: Record<string, Entity> = {}
  for (const [id, e] of Object.entries(state.entities)) {
    entities[id] = {
      ...e,
      store: { ...e.store },
      cargo: e.cargo ? { ...e.cargo } : null,
    }
  }

  // --- Furnaces ---
  for (const e of Object.values(entities)) {
    if (e.kind !== 'furnace') continue

    if (!e.smelting) {
      for (const ore of FURNACE_INPUT_ORES) {
        if ((e.store[ore] ?? 0) >= 1 && (e.store.coal ?? 0) >= FURNACE_COAL_PER_SMELT) {
          e.smelting = ore
          takeFromStore(e.store, ore, 1)
          takeFromStore(e.store, 'coal', FURNACE_COAL_PER_SMELT)
          e.progress = 0
          break
        }
      }
    }

    if (e.smelting) {
      e.progress += dt / FURNACE_SECONDS
      if (e.progress >= 1) {
        const out = SMELT_MAP[e.smelting as OreId]
        if (out !== 'coal') {
          addToStore(e.store, out, 1, MACHINE_CAP.furnace)
        }
        e.smelting = null
        e.progress = 0
      }
    }
  }

  // --- Belts: advance cargo, then try transfer ---
  const beltOrder = Object.values(entities).filter((e) => e.kind === 'belt')
  // Move from downstream first to avoid double-step: sort by direction
  beltOrder.sort((a, b) => b.x + b.y * 100 - (a.x + a.y * 100))

  for (const e of beltOrder) {
    if (!e.cargo) continue
    e.cargo.progress = Math.min(1, e.cargo.progress + BELT_SPEED * dt)
    if (e.cargo.progress < 1) continue

    const next = neighbor(state, e.x, e.y, e.dir)
    if (!next.entity) continue

    if (next.entity.kind === 'belt') {
      const dest = entities[next.entity.id]
      if (!dest.cargo) {
        dest.cargo = { item: e.cargo.item, progress: 0 }
        e.cargo = null
      }
    } else if (
      next.entity.kind === 'chest' ||
      next.entity.kind === 'furnace' ||
      next.entity.kind === 'drill'
    ) {
      const dest = entities[next.entity.id]
      if (tryAcceptItem(dest, e.cargo.item)) {
        e.cargo = null
      }
    }
  }

  // --- Inserters ---
  for (const e of Object.values(entities)) {
    if (e.kind !== 'inserter') continue
    // cooldown stored in progress field
    e.progress = Math.max(0, e.progress - dt)
    if (e.progress > 0) continue

    const behind = neighbor(state, e.x, e.y, OPPOSITE[e.dir])
    const front = neighbor(state, e.x, e.y, e.dir)
    if (!behind.entity || !front.entity) continue

    const src = entities[behind.entity.id]
    const dest = entities[front.entity.id]

    // Prefer feeding furnaces coal/ore; prefer pulling plates from furnaces
    let prefer: ItemId[] | undefined
    if (dest.kind === 'furnace') prefer = ['coal', 'ironOre', 'copperOre']
    if (src.kind === 'furnace') prefer = ['ironPlate', 'copperPlate']
    if (src.kind === 'drill') prefer = ['ironOre', 'copperOre', 'coal']

    if (!peekExtractable(src)) continue
    // Soft check dest capacity via try accept after extract — extract then rollback if needed
    const item = tryExtractItem(src, prefer)
    if (!item) continue
    if (!tryAcceptItem(dest, item)) {
      // put back
      tryAcceptItem(src, item)
      continue
    }
    e.progress = INSERTER_COOLDOWN
  }

  return { ...state, entities, lastTick: Date.now() }
}

export function fuelDrillsFromInventory(state: GameState): GameState {
  // Helper used when placing drill: put some coal in it from inventory
  return state
}

export { addToStore, takeFromStore, MACHINE_CAP }
