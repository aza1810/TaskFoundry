import {
  ASSEMBLER_PLATES_PER_GEAR,
  ASSEMBLER_SECONDS,
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
  FactoryStats,
  GameState,
  ItemId,
  OreId,
} from './types'

const MACHINE_CAP: Record<string, number> = {
  drill: 5,
  furnace: 12,
  chest: 50,
  assembler: 12,
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

function tryAcceptItem(entity: Entity, item: ItemId): boolean {
  if (entity.kind === 'belt') {
    if (entity.cargo) return false
    entity.cargo = { item, progress: 0 }
    return true
  }
  if (entity.kind === 'chest' || entity.kind === 'drill') {
    const except = entity.kind === 'drill' ? (['coal'] as ItemId[]) : undefined
    return addToStore(entity.store, item, 1, MACHINE_CAP[entity.kind], except) > 0
  }
  if (entity.kind === 'furnace') {
    if (item === 'coal' || item === 'ironOre' || item === 'copperOre') {
      return addToStore(entity.store, item, 1, MACHINE_CAP.furnace) > 0
    }
    return false
  }
  if (entity.kind === 'assembler') {
    if (item === 'ironPlate') {
      return addToStore(entity.store, item, 1, MACHINE_CAP.assembler, ['gear']) > 0
    }
    return false
  }
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
    return takeAny(entity.store, prefer ?? ['ironPlate', 'copperPlate'])
  }
  if (entity.kind === 'assembler') {
    return takeAny(entity.store, prefer ?? ['gear'])
  }
  return null
}

function peekExtractable(entity: Entity): boolean {
  if (entity.kind === 'belt') {
    return Boolean(entity.cargo && entity.cargo.progress >= 0.55)
  }
  return Object.values(entity.store).some((n) => (n ?? 0) > 0)
}

/** Factorio-style: drill drops output onto facing belt/chest/furnace */
function tryDrillEject(
  state: GameState,
  entities: Record<string, Entity>,
  drill: Entity,
): boolean {
  const front = neighbor(state, drill.x, drill.y, drill.dir)
  if (!front.entity) return false
  const dest = entities[front.entity.id]
  if (!dest) return false
  if (dest.kind !== 'belt' && dest.kind !== 'chest' && dest.kind !== 'furnace') {
    return false
  }
  const item = tryExtractItem(drill, ['ironOre', 'copperOre', 'coal'])
  if (!item) return false
  // Don't eject the last bits of fuel coal into the line unless mining coal
  if (item === 'coal' && (drill.store.coal ?? 0) < 1 && dest.kind !== 'furnace') {
    tryAcceptItem(drill, item)
    return false
  }
  if (!tryAcceptItem(dest, item)) {
    tryAcceptItem(drill, item)
    return false
  }
  return true
}

/** One mining cycle per drill — driven by player steps */
export function runMineCycles(state: GameState, cycles: number): GameState {
  if (cycles <= 0) return state
  const entities: Record<string, Entity> = {}
  for (const [id, e] of Object.entries(state.entities)) {
    entities[id] = { ...e, store: { ...e.store }, cargo: e.cargo ? { ...e.cargo } : null }
  }
  const tiles = state.tiles.map((t) => ({ ...t }))
  let mined = 0
  const stats: FactoryStats = { ...state.stats }
  const view = { ...state, entities }

  for (let c = 0; c < cycles; c++) {
    for (const id of Object.keys(entities)) {
      const e = entities[id]
      if (e.kind !== 'drill') continue

      const tile = tiles[idx(e.x, e.y)]
      if (!tile?.ore || (tile.amount !== null && tile.amount <= 0)) {
        if (tile && tile.amount !== null && tile.amount <= 0) tile.ore = null
        continue
      }
      if ((e.store.coal ?? 0) < 0.25) continue

      // Free buffer space by ejecting first
      tryDrillEject(view, entities, e)

      const put = addToStore(e.store, tile.ore, 1, MACHINE_CAP.drill, ['coal'])
      if (put <= 0) continue

      e.store.coal = (e.store.coal ?? 0) - 0.25
      if (e.store.coal <= 0.001) delete e.store.coal

      if (tile.amount !== null) {
        tile.amount -= 1
        if (tile.amount <= 0) {
          tile.amount = 0
          tile.ore = null
        }
      }
      mined += 1
      stats.oreMined += 1
      tryDrillEject(view, entities, e)
    }
  }

  return {
    ...state,
    entities,
    tiles,
    stats,
    mineCycles: state.mineCycles + cycles,
    xp: state.xp + Math.floor(mined / 5),
  }
}

/** Continuous factory simulation: belts, inserters, furnaces, assemblers, drill eject */
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
  const stats: FactoryStats = { ...state.stats }
  let moved = 0

  // --- Drill auto-eject ---
  for (const e of Object.values(entities)) {
    if (e.kind !== 'drill') continue
    if (tryDrillEject(state, entities, e)) moved += 1
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
          stats.platesSmelted += 1
        }
        e.smelting = null
        e.progress = 0
      }
    }
  }

  // --- Assemblers: 2 iron plate → 1 gear ---
  for (const e of Object.values(entities)) {
    if (e.kind !== 'assembler') continue
    const plates = e.store.ironPlate ?? 0
    if (!e.smelting && plates >= ASSEMBLER_PLATES_PER_GEAR) {
      // reuse smelting flag as "busy" with dummy ore mark via progress only
      takeFromStore(e.store, 'ironPlate', ASSEMBLER_PLATES_PER_GEAR)
      e.progress = 0
      e.smelting = 'ironOre' // busy marker
    }
    if (e.smelting) {
      e.progress += dt / ASSEMBLER_SECONDS
      if (e.progress >= 1) {
        addToStore(e.store, 'gear', 1, MACHINE_CAP.assembler, ['ironPlate'])
        stats.gearsMade += 1
        e.smelting = null
        e.progress = 0
      }
    }
  }

  // --- Belts ---
  const beltOrder = Object.values(entities).filter((e) => e.kind === 'belt')
  beltOrder.sort((a, b) => {
    // Downstream-first by direction
    const da = DIR_DELTA[a.dir]
    const db = DIR_DELTA[b.dir]
    return db.dx + db.dy * 50 + b.x + b.y * 100 - (da.dx + da.dy * 50 + a.x + a.y * 100)
  })

  for (const e of beltOrder) {
    if (!e.cargo) continue
    e.cargo.progress = Math.min(1, e.cargo.progress + BELT_SPEED * dt)
    if (e.cargo.progress < 1) continue

    const next = neighbor(state, e.x, e.y, e.dir)
    if (!next.entity) continue
    const dest = entities[next.entity.id]

    if (dest.kind === 'belt') {
      if (!dest.cargo) {
        dest.cargo = { item: e.cargo.item, progress: 0 }
        e.cargo = null
        moved += 1
      }
    } else if (
      dest.kind === 'chest' ||
      dest.kind === 'furnace' ||
      dest.kind === 'drill' ||
      dest.kind === 'assembler'
    ) {
      if (tryAcceptItem(dest, e.cargo.item)) {
        e.cargo = null
        moved += 1
      }
    }
  }

  // --- Inserters ---
  for (const e of Object.values(entities)) {
    if (e.kind !== 'inserter') continue
    e.progress = Math.max(0, e.progress - dt)
    if (e.progress > 0) continue

    const behind = neighbor(state, e.x, e.y, OPPOSITE[e.dir])
    const front = neighbor(state, e.x, e.y, e.dir)
    if (!behind.entity || !front.entity) continue

    const src = entities[behind.entity.id]
    const dest = entities[front.entity.id]

    let prefer: ItemId[] | undefined
    if (dest.kind === 'furnace') prefer = ['coal', 'ironOre', 'copperOre']
    if (dest.kind === 'assembler') prefer = ['ironPlate']
    if (src.kind === 'furnace') prefer = ['ironPlate', 'copperPlate']
    if (src.kind === 'assembler') prefer = ['gear']
    if (src.kind === 'drill') prefer = ['ironOre', 'copperOre', 'coal']

    if (!peekExtractable(src)) continue
    const item = tryExtractItem(src, prefer)
    if (!item) continue
    if (!tryAcceptItem(dest, item)) {
      tryAcceptItem(src, item)
      continue
    }
    e.progress = INSERTER_COOLDOWN
    moved += 1
  }

  stats.itemsMoved += moved

  return { ...state, entities, stats, lastTick: Date.now() }
}

export { addToStore, takeFromStore, MACHINE_CAP }
