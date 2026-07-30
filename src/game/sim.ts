import {
  ASSEMBLER_PLATES_PER_GEAR,
  ASSEMBLER_SECONDS,
  DIR_DELTA,
  ELECTRIC_DRILL_YIELD,
  FURNACE_COAL_PER_SMELT,
  FURNACE_INPUT_ORES,
  INSERTER_COOLDOWN,
  MAX_UNDERGROUND,
  OPPOSITE,
  SMELT_MAP,
  beltSpeedFor,
  furnaceSecondsFor,
  idx,
  inBounds,
  isBeltKind,
  isDrillKind,
  isFurnaceKind,
  rotateDir,
} from './data'
import { getTile } from './grid'
import { skillBonuses } from './skills'
import type {
  Dir,
  Entity,
  FactoryStats,
  GameState,
  ItemId,
  OreId,
} from './types'

const MACHINE_CAP: Record<string, number> = {
  drill: 5,
  electricDrill: 8,
  furnace: 12,
  steelFurnace: 12,
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
    return null
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

/** Find matching UG partner (entrance↔exit) along facing axis. */
export function findUgPartner(
  state: GameState,
  entities: Record<string, Entity>,
  ug: Entity,
  maxRange = MAX_UNDERGROUND,
): Entity | null {
  const isEntrance = (ug.toggle ?? 0) === 0
  const lookingFor = isEntrance ? 1 : 0
  const sign = isEntrance ? 1 : -1
  const { dx, dy } = DIR_DELTA[ug.dir]
  const range = Math.max(1, maxRange)
  for (let d = 1; d <= range; d++) {
    const x = ug.x + dx * d * sign
    const y = ug.y + dy * d * sign
    if (!inBounds(x, y, state.width, state.height)) break
    const tile = getTile(state.tiles, x, y)
    if (!tile?.entityId) continue
    const e = entities[tile.entityId]
    if (
      e &&
      e.kind === 'undergroundBelt' &&
      e.dir === ug.dir &&
      (e.toggle ?? 0) === lookingFor
    ) {
      return e
    }
  }
  return null
}

function tryAcceptItem(entity: Entity, item: ItemId): boolean {
  if (isBeltKind(entity.kind) || entity.kind === 'splitter') {
    if (entity.cargo) return false
    entity.cargo = { item, progress: 0 }
    return true
  }
  if (entity.kind === 'undergroundBelt') {
    // Only entrances accept from the surface; exits receive via teleport
    if ((entity.toggle ?? 0) !== 0) return false
    if (entity.cargo) return false
    entity.cargo = { item, progress: 0 }
    return true
  }
  if (isDrillKind(entity.kind)) {
    return addToStore(entity.store, item, 1, MACHINE_CAP[entity.kind], ['coal']) > 0
  }
  if (entity.kind === 'chest') {
    return addToStore(entity.store, item, 1, MACHINE_CAP.chest) > 0
  }
  if (isFurnaceKind(entity.kind)) {
    if (item === 'coal' || item === 'ironOre' || item === 'copperOre') {
      return addToStore(entity.store, item, 1, MACHINE_CAP[entity.kind] ?? 12) > 0
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
  if (
    isBeltKind(entity.kind) ||
    entity.kind === 'splitter' ||
    entity.kind === 'undergroundBelt'
  ) {
    if (!entity.cargo || entity.cargo.progress < 0.55) return null
    const item = entity.cargo.item
    entity.cargo = null
    return item
  }
  if (isDrillKind(entity.kind) || entity.kind === 'chest') {
    return takeAny(entity.store, prefer)
  }
  if (isFurnaceKind(entity.kind)) {
    return takeAny(entity.store, prefer ?? ['ironPlate', 'copperPlate'])
  }
  if (entity.kind === 'assembler') {
    return takeAny(entity.store, prefer ?? ['gear'])
  }
  return null
}

function peekExtractable(entity: Entity): boolean {
  if (
    isBeltKind(entity.kind) ||
    entity.kind === 'splitter' ||
    entity.kind === 'undergroundBelt'
  ) {
    return Boolean(entity.cargo && entity.cargo.progress >= 0.55)
  }
  return Object.values(entity.store).some((n) => (n ?? 0) > 0)
}

/** Factorio-style: drill drops mined ore onto facing belt/chest/furnace */
function tryDrillEject(
  state: GameState,
  entities: Record<string, Entity>,
  drill: Entity,
): boolean {
  const front = neighbor(state, drill.x, drill.y, drill.dir)
  if (!front.entity) return false
  const dest = entities[front.entity.id]
  if (!dest) return false
  if (
    !isBeltKind(dest.kind) &&
    dest.kind !== 'chest' &&
    !isFurnaceKind(dest.kind) &&
    dest.kind !== 'splitter' &&
    dest.kind !== 'undergroundBelt'
  ) {
    return false
  }

  const tile = getTile(state.tiles, drill.x, drill.y)
  // Never dump burner fuel — only eject the resource being mined
  const prefer: ItemId[] =
    tile?.ore === 'coal' ? ['coal'] : ['ironOre', 'copperOre']

  const item = tryExtractItem(drill, prefer)
  if (!item) return false
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
  const bonuses = skillBonuses(state.skills)
  const coalCost = 0.25 * (1 - bonuses.drillCoalSave)

  for (let c = 0; c < cycles; c++) {
    for (const id of Object.keys(entities)) {
      const e = entities[id]
      if (!isDrillKind(e.kind)) continue

      const tile = tiles[idx(e.x, e.y)]
      if (!tile?.ore || (tile.amount !== null && tile.amount <= 0)) {
        if (tile && tile.amount !== null && tile.amount <= 0) tile.ore = null
        continue
      }

      const electric = e.kind === 'electricDrill'
      if (!electric && (e.store.coal ?? 0) < coalCost) continue

      tryDrillEject(view, entities, e)

      const base = (electric ? ELECTRIC_DRILL_YIELD : 1) + (electric ? bonuses.electricYieldBonus : 0)
      const raw = base * bonuses.mineYieldMult
      const whole = Math.floor(raw)
      const frac = raw - whole
      const yieldAmt = Math.max(1, whole + (Math.random() < frac ? 1 : 0))

      const put = addToStore(
        e.store,
        tile.ore,
        yieldAmt,
        MACHINE_CAP[e.kind] ?? 5,
        ['coal'],
      )
      if (put <= 0) continue

      if (!electric) {
        e.store.coal = (e.store.coal ?? 0) - coalCost
        if (e.store.coal <= 0.001) delete e.store.coal
      }

      if (tile.amount !== null) {
        tile.amount -= put
        if (tile.amount <= 0) {
          tile.amount = 0
          tile.ore = null
        }
      }
      mined += put
      stats.oreMined += put
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
  const bonuses = skillBonuses(state.skills)
  const ugRange = MAX_UNDERGROUND + bonuses.ugBonus
  const inserterCd = INSERTER_COOLDOWN / bonuses.inserterSpeedMult

  // --- Drill auto-eject ---
  for (const e of Object.values(entities)) {
    if (!isDrillKind(e.kind)) continue
    if (tryDrillEject(state, entities, e)) moved += 1
  }

  // --- Furnaces (stone + steel) ---
  for (const e of Object.values(entities)) {
    if (!isFurnaceKind(e.kind)) continue
    const cap = MACHINE_CAP[e.kind] ?? 12
    const seconds = furnaceSecondsFor(e.kind) / bonuses.furnaceSpeedMult
    const coalNeed = Math.max(
      0.25,
      FURNACE_COAL_PER_SMELT * (1 - bonuses.furnaceCoalSave),
    )

    if (!e.smelting) {
      for (const ore of FURNACE_INPUT_ORES) {
        if ((e.store[ore] ?? 0) >= 1 && (e.store.coal ?? 0) >= coalNeed) {
          e.smelting = ore
          takeFromStore(e.store, ore, 1)
          takeFromStore(e.store, 'coal', coalNeed)
          e.progress = 0
          break
        }
      }
    }

    if (e.smelting) {
      e.progress += dt / seconds
      if (e.progress >= 1) {
        const out = SMELT_MAP[e.smelting as OreId]
        if (out !== 'coal') {
          addToStore(e.store, out, 1, cap)
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
  const beltOrder = Object.values(entities).filter((e) => isBeltKind(e.kind))
  beltOrder.sort((a, b) => {
    const da = DIR_DELTA[a.dir]
    const db = DIR_DELTA[b.dir]
    return db.dx + db.dy * 50 + b.x + b.y * 100 - (da.dx + da.dy * 50 + a.x + a.y * 100)
  })

  for (const e of beltOrder) {
    if (!e.cargo) continue
    e.cargo.progress = Math.min(
      1,
      e.cargo.progress + beltSpeedFor(e.kind) * bonuses.beltSpeedMult * dt,
    )
    if (e.cargo.progress < 1) continue

    const next = neighbor(state, e.x, e.y, e.dir)
    if (!next.entity) continue
    const dest = entities[next.entity.id]

    if (tryAcceptItem(dest, e.cargo.item)) {
      e.cargo = null
      moved += 1
    }
  }

  // --- Underground belts: entrance teleports to exit, exit ejects forward ---
  for (const e of Object.values(entities)) {
    if (e.kind !== 'undergroundBelt' || !e.cargo) continue
    e.cargo.progress = Math.min(
      1,
      e.cargo.progress + beltSpeedFor('belt') * bonuses.beltSpeedMult * dt,
    )
    if (e.cargo.progress < 1) continue

    if ((e.toggle ?? 0) === 0) {
      const partner = findUgPartner(state, entities, e, ugRange)
      if (!partner || partner.cargo) continue
      partner.cargo = { item: e.cargo.item, progress: 0 }
      e.cargo = null
      moved += 1
    } else {
      const next = neighbor(state, e.x, e.y, e.dir)
      if (!next.entity) continue
      if (tryAcceptItem(entities[next.entity.id], e.cargo.item)) {
        e.cargo = null
        moved += 1
      }
    }
  }

  // Splitters: alternate forward vs right output
  for (const e of Object.values(entities)) {
    if (e.kind !== 'splitter' || !e.cargo) continue
    e.cargo.progress = Math.min(
      1,
      e.cargo.progress + beltSpeedFor('belt') * bonuses.beltSpeedMult * dt,
    )
    if (e.cargo.progress < 1) continue

    const toggle = e.toggle ?? 0
    const outDir: Dir = toggle === 0 ? e.dir : rotateDir(e.dir, true)
    const next = neighbor(state, e.x, e.y, outDir)
    if (!next.entity) {
      const alt: Dir = toggle === 0 ? rotateDir(e.dir, true) : e.dir
      const altN = neighbor(state, e.x, e.y, alt)
      if (altN.entity && tryAcceptItem(entities[altN.entity.id], e.cargo.item)) {
        e.cargo = null
        e.toggle = 1 - toggle
        moved += 1
      }
      continue
    }
    if (tryAcceptItem(entities[next.entity.id], e.cargo.item)) {
      e.cargo = null
      e.toggle = 1 - toggle
      moved += 1
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
    if (isFurnaceKind(dest.kind)) prefer = ['coal', 'ironOre', 'copperOre']
    if (dest.kind === 'assembler') prefer = ['ironPlate']
    if (isFurnaceKind(src.kind)) prefer = ['ironPlate', 'copperPlate']
    if (src.kind === 'assembler') prefer = ['gear']
    if (isDrillKind(src.kind)) prefer = ['ironOre', 'copperOre', 'coal']

    if (!peekExtractable(src)) continue
    const item = tryExtractItem(src, prefer)
    if (!item) continue
    if (!tryAcceptItem(dest, item)) {
      tryAcceptItem(src, item)
      continue
    }
    e.progress = inserterCd
    moved += 1
  }

  stats.itemsMoved += moved

  return { ...state, entities, stats, lastTick: Date.now() }
}

export { addToStore, takeFromStore, MACHINE_CAP }
