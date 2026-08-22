import {
  ASSEMBLER_PLATES_PER_GEAR,
  ASSEMBLER_SECONDS,
  ASSEMBLER_SLOT_CAP,
  CHEST_SLOT_COUNT,
  CHEST_STACK_SIZE,
  DIR_DELTA,
  DRILL_CYCLE_SECONDS,
  DRILL_POWER_PER_CYCLE,
  ELECTRIC_DRILL_POWER_PER_CYCLE,
  ELECTRIC_DRILL_YIELD,
  FUEL_VALUE,
  FURNACE_COAL_PER_SMELT,
  FURNACE_FUEL_CAP,
  FURNACE_INPUT_ORES,
  FURNACE_SLOT_CAP,
  fuelUnits,
  inserterCooldownFor,
  MAX_UNDERGROUND,
  OPPOSITE,
  POWER_DRAW,
  SMELT_MAP,
  beltSpeedFor,
  drillDropCells,
  furnaceSecondsFor,
  idx,
  inBounds,
  mineCells,
  isBeltKind,
  isDrillKind,
  sizeOf,
  isFurnaceKind,
  isInserterKind,
  machineIsLive,
  rotateDir,
} from './data'
import { isWarehouseItem } from './chestInventory'
import { getTile } from './grid'
import { entityHasPower, powerNet } from './power'
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
  furnace: FURNACE_SLOT_CAP,
  steelFurnace: FURNACE_SLOT_CAP,
  assembler: ASSEMBLER_SLOT_CAP,
}

/** Chests: materials only, up to CHEST_SLOT_COUNT types, CHEST_STACK_SIZE each. */
function tryAcceptChest(
  store: Partial<Record<ItemId, number>>,
  item: ItemId,
): boolean {
  // Buildings / placeables never belong in the warehouse.
  if (!isWarehouseItem(item)) return false
  const have = store[item] ?? 0
  if (have > 0) {
    if (have >= CHEST_STACK_SIZE) return false
    store[item] = have + 1
    return true
  }
  const usedSlots = Object.values(store).filter((n) => (n ?? 0) > 0).length
  if (usedSlots >= CHEST_SLOT_COUNT) return false
  store[item] = 1
  return true
}

const FURNACE_OUTPUT_ITEMS: ItemId[] = ['ironPlate', 'copperPlate', 'steel']
const FURNACE_ORE_ITEMS: ItemId[] = ['ironOre', 'copperOre']

/** Burn `units` (coal-equivalent) of fuel from a store, wood first then coal. */
function drawFuel(store: Partial<Record<ItemId, number>>, units: number): void {
  let need = units
  const wood = store.wood ?? 0
  if (need > 0 && wood > 0) {
    const use = Math.min(need, wood * FUEL_VALUE.wood)
    const left = wood - use / FUEL_VALUE.wood
    if (left <= 1e-9) delete store.wood
    else store.wood = left
    need -= use
  }
  if (need > 0) {
    const coal = store.coal ?? 0
    const use = Math.min(need, coal * FUEL_VALUE.coal)
    const left = coal - use / FUEL_VALUE.coal
    if (left <= 1e-9) delete store.coal
    else store.coal = left
    need -= use
  }
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

function neighborAt(
  state: GameState,
  x: number,
  y: number,
  dir: Entity['dir'],
  dist: number,
): { x: number; y: number; entity: Entity | null; tile: ReturnType<typeof getTile> } {
  const { dx, dy } = DIR_DELTA[dir]
  const nx = x + dx * dist
  const ny = y + dy * dist
  const tile = getTile(state.tiles, nx, ny)
  const found = tile?.entityId ? state.entities[tile.entityId] ?? null : null
  // Unbuilt construction sites are inert - never a valid source/sink.
  const entity = found && !machineIsLive(found) ? null : found
  return { x: nx, y: ny, entity, tile }
}

function neighbor(
  state: GameState,
  x: number,
  y: number,
  dir: Entity['dir'],
): { x: number; y: number; entity: Entity | null; tile: ReturnType<typeof getTile> } {
  return neighborAt(state, x, y, dir, 1)
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
      machineIsLive(e) &&
      e.kind === 'undergroundBelt' &&
      e.dir === ug.dir &&
      (e.toggle ?? 0) === lookingFor
    ) {
      return e
    }
  }
  return null
}

/** Resolve the machine on a tile. Prefer entityId, then a footprint scan if the link is stale. */
function entityAtCell(
  state: GameState,
  entities: Record<string, Entity>,
  x: number,
  y: number,
): Entity | null {
  const tile = getTile(state.tiles, x, y)
  if (tile?.entityId) {
    const hit = entities[tile.entityId]
    if (hit) return hit
  }
  for (const e of Object.values(entities)) {
    if (e.kind === 'tree' || e.kind === 'rock') continue
    const { w, h } = sizeOf(e.kind)
    if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) return e
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
    // Coal and wood are fuel - excluded from the ore-holding cap.
    return addToStore(entity.store, item, 1, MACHINE_CAP[entity.kind], ['coal', 'wood']) > 0
  }
  if (entity.kind === 'chest') {
    return tryAcceptChest(entity.store, item)
  }
  if (isFurnaceKind(entity.kind)) {
    if (item === 'coal' || item === 'wood') {
      // Fuel cap counts fuel only - ore/plates must not block fuel intake.
      return (
        addToStore(entity.store, item, 1, FURNACE_FUEL_CAP, [
          ...FURNACE_ORE_ITEMS,
          ...FURNACE_OUTPUT_ITEMS,
        ]) > 0
      )
    }
    if (item === 'ironOre' || item === 'copperOre') {
      return (
        addToStore(entity.store, item, 1, MACHINE_CAP[entity.kind] ?? 12, [
          'coal',
          ...FURNACE_OUTPUT_ITEMS,
        ]) > 0
      )
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

/** Belts / splitters / UG exits cannot dump into chests - need an inserter. */
function tryBeltHandoff(dest: Entity, item: ItemId): boolean {
  if (dest.kind === 'chest') return false
  return tryAcceptItem(dest, item)
}

/** Factorio-style: drill drops mined ore onto facing belt/chest/furnace. */
function tryDrillEject(
  state: GameState,
  entities: Record<string, Entity>,
  drill: Entity,
): boolean {
  let dest: Entity | null = null
  for (const o of drillDropCells(drill.kind, drill.x, drill.y, drill.dir, drill.flip === true)) {
    if (!inBounds(o.x, o.y)) continue
    const cand = entityAtCell(state, entities, o.x, o.y)
    if (!cand || !machineIsLive(cand)) continue
    if (cand.id === drill.id) continue
    if (
      isBeltKind(cand.kind) ||
      cand.kind === 'chest' ||
      isFurnaceKind(cand.kind) ||
      cand.kind === 'splitter' ||
      cand.kind === 'undergroundBelt'
    ) {
      dest = cand
      break
    }
  }
  if (!dest) return false

  // Drills only hold mined ore (fuel lives elsewhere), so eject any ore present.
  const prefer: ItemId[] = ['ironOre', 'copperOre', 'coal']
  const item = tryExtractItem(drill, prefer)
  if (!item) return false
  if (!tryAcceptItem(dest, item)) {
    tryAcceptItem(drill, item)
    return false
  }
  return true
}

function cloneSimEntities(src: GameState['entities']): Record<string, Entity> {
  const entities: Record<string, Entity> = {}
  for (const id in src) {
    const e = src[id]
    // Trees and rocks are static unless a drone marks them. Reuse the
    // same object so the floor can skip re-rendering thousands of sprites.
    if (e.kind === 'tree' || e.kind === 'rock') {
      entities[id] = e
      continue
    }
    entities[id] = {
      ...e,
      store: { ...e.store },
      cargo: e.cargo ? { ...e.cargo } : null,
    }
  }
  return entities
}

/**
 * Drills also mine while you watch, as long as the battery has charge.
 * Steps still add extra cycles on top of this.
 */
export function tickBatteryMining(state: GameState, dt: number): GameState {
  if (dt <= 0 || state.power <= 0) return state
  let acc = (state.drillMineAcc ?? 0) + dt
  let next = state
  let cycles = 0
  while (acc >= DRILL_CYCLE_SECONDS) {
    acc -= DRILL_CYCLE_SECONDS
    const after = runMineCycles(next, 1)
    if (after.mineCycles === next.mineCycles) break
    next = after
    cycles += 1
    if (cycles > 8) break
  }
  if (next === state && acc === (state.drillMineAcc ?? 0)) return state
  return { ...next, drillMineAcc: acc }
}

/** One mining cycle per drill per step - each cycle spends stored power. */
export function runMineCycles(state: GameState, cycles: number): GameState {
  if (cycles <= 0) return state
  const entities = cloneSimEntities(state.entities)
  let tiles = state.tiles
  let tilesCopied = false
  const touchTile = (i: number) => {
    if (!tilesCopied) {
      tiles = tiles.slice()
      tilesCopied = true
    }
    const cur = tiles[i]
    if (cur === state.tiles[i]) tiles[i] = { ...cur }
    return tiles[i]
  }
  let mined = 0
  let cyclesRun = 0
  let power = state.power
  const stats: FactoryStats = { ...state.stats }
  const view = { ...state, entities }
  const bonuses = skillBonuses(state.skills)
  const save = 1 - bonuses.drillCoalSave
  const net = powerNet(state)

  for (let c = 0; c < cycles; c++) {
    for (const id of Object.keys(entities)) {
      const e = entities[id]
      if (!machineIsLive(e)) continue
      if (!isDrillKind(e.kind)) continue
      if (!entityHasPower(e, state, net)) continue

      // A 2x2 drill can pull ore from anywhere in its 3x3 dig area.
      let tileI = -1
      let ore: OreId | null = null
      for (const c of mineCells(e.x, e.y)) {
        if (!inBounds(c.x, c.y)) continue
        const i = idx(c.x, c.y)
        const t = tiles[i]
        if (t.ore && (t.amount === null || t.amount > 0)) {
          tileI = i
          ore = t.ore
          break
        }
      }
      if (tileI < 0 || !ore) continue

      const electric = e.kind === 'electricDrill'
      const cost =
        (electric ? ELECTRIC_DRILL_POWER_PER_CYCLE : DRILL_POWER_PER_CYCLE) * save
      if (power < cost) continue

      tryDrillEject(view, entities, e)

      const base = (electric ? ELECTRIC_DRILL_YIELD : 1) + (electric ? bonuses.electricYieldBonus : 0)
      const raw = base * bonuses.mineYieldMult
      const whole = Math.floor(raw)
      const frac = raw - whole
      const yieldAmt = Math.max(1, whole + (Math.random() < frac ? 1 : 0))

      const put = addToStore(e.store, ore, yieldAmt, MACHINE_CAP[e.kind] ?? 5, ['coal'])
      if (put <= 0) continue

      power -= cost

      const tile = tiles[tileI]
      if (tile.amount !== null) {
        const next = touchTile(tileI)
        next.amount = (next.amount ?? 0) - put
        if (next.amount <= 0) {
          next.amount = 0
          next.ore = null
        }
      }
      mined += put
      cyclesRun += 1
      stats.oreMined += put
      tryDrillEject(view, entities, e)
    }
  }

  return {
    ...state,
    entities,
    tiles,
    stats,
    power: Math.max(0, power),
    mineCycles: state.mineCycles + cyclesRun,
    xp: state.xp + Math.floor(mined / 5),
  }
}

/** Continuous factory simulation: belts, inserters, furnaces, assemblers, drill eject */
export function simTick(state: GameState, dt: number): GameState {
  if (dt <= 0) return state
  const entities = cloneSimEntities(state.entities)
  const stats: FactoryStats = { ...state.stats }
  let moved = 0
  const bonuses = skillBonuses(state.skills)
  const ugRange = MAX_UNDERGROUND + bonuses.ugBonus
  const inserterCd = inserterCooldownFor(bonuses.inserterSpeedMult)
  const net = powerNet(state)

  // --- Power grid: electric machines draw from the battery; a brownout
  //     (not enough stored power) slows every electric machine this tick.
  //     Unconnected machines (no powered Foundation) do not draw or run.
  //     Belts never draw and keep moving even when the battery is empty. ---
  let demand = 0
  for (const e of Object.values(entities)) {
    if (!machineIsLive(e)) continue
    const draw = POWER_DRAW[e.kind] ?? 0
    if (draw <= 0) continue
    if (!entityHasPower(e, state, net)) continue
    if (isBeltKind(e.kind) || e.kind === 'undergroundBelt' || e.kind === 'splitter') {
      if (e.cargo) demand += draw
    } else if (isInserterKind(e.kind)) {
      demand += draw
    } else if (e.kind === 'assembler') {
      if (e.smelting || (e.store.ironPlate ?? 0) >= ASSEMBLER_PLATES_PER_GEAR) {
        demand += draw
      }
    } else {
      demand += draw
    }
  }
  const need = demand * dt
  const powerRatio = need > 0 ? Math.min(1, state.power / need) : 1
  const powerLeft = Math.max(0, state.power - need * powerRatio)

  // --- Drill auto-eject ---
  for (const e of Object.values(entities)) {
    if (!machineIsLive(e)) continue
    if (!isDrillKind(e.kind)) continue
    if (tryDrillEject(state, entities, e)) moved += 1
  }

  // --- Furnaces (stone + steel) ---
  for (const e of Object.values(entities)) {
    if (!machineIsLive(e)) continue
    if (!isFurnaceKind(e.kind)) continue
    const cap = MACHINE_CAP[e.kind] ?? 12
    const seconds = furnaceSecondsFor(e.kind) / bonuses.furnaceSpeedMult
    const coalNeed = Math.max(
      0.25,
      FURNACE_COAL_PER_SMELT * (1 - bonuses.furnaceCoalSave),
    )

    let timeLeft = dt
    while (timeLeft > 0) {
      if (!e.smelting) {
        let started = false
        for (const ore of FURNACE_INPUT_ORES) {
          if ((e.store[ore] ?? 0) >= 1 && fuelUnits(e.store) >= coalNeed) {
            e.smelting = ore
            takeFromStore(e.store, ore, 1)
            drawFuel(e.store, coalNeed)
            e.progress = 0
            started = true
            break
          }
        }
        if (!started) break
      }

      const need = (1 - e.progress) * seconds
      if (timeLeft < need) {
        e.progress += timeLeft / seconds
        timeLeft = 0
        break
      }
      timeLeft -= need
      const out = SMELT_MAP[e.smelting as OreId]
      if (out !== 'coal') {
        addToStore(e.store, out, 1, cap, ['coal', ...FURNACE_ORE_ITEMS])
        stats.platesSmelted += 1
      }
      e.smelting = null
      e.progress = 0
    }
  }

  // --- Assemblers: 2 iron plate → 1 gear ---
  for (const e of Object.values(entities)) {
    if (!machineIsLive(e)) continue
    if (e.kind !== 'assembler') continue
    if (!entityHasPower(e, state, net)) continue
    const seconds = ASSEMBLER_SECONDS / bonuses.assemblerSpeedMult
    let timeLeft = dt * powerRatio
    while (timeLeft > 0) {
      const plates = e.store.ironPlate ?? 0
      if (!e.smelting) {
        if (plates < ASSEMBLER_PLATES_PER_GEAR) break
        takeFromStore(e.store, 'ironPlate', ASSEMBLER_PLATES_PER_GEAR)
        e.progress = 0
        e.smelting = 'ironOre' // busy marker
      }
      const need = (1 - e.progress) * seconds
      if (timeLeft < need) {
        e.progress += timeLeft / seconds
        timeLeft = 0
        break
      }
      timeLeft -= need
      addToStore(e.store, 'gear', 1, MACHINE_CAP.assembler, ['ironPlate'])
      stats.gearsMade += 1
      e.smelting = null
      e.progress = 0
    }
  }

  // --- Belts ---
  const beltOrder = Object.values(entities).filter(
    (e) => machineIsLive(e) && isBeltKind(e.kind),
  )
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

    if (tryBeltHandoff(dest, e.cargo.item)) {
      e.cargo = null
      moved += 1
    }
  }

  // --- Underground belts: entrance teleports to exit, exit ejects forward ---
  for (const e of Object.values(entities)) {
    if (!machineIsLive(e)) continue
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
      if (tryBeltHandoff(entities[next.entity.id], e.cargo.item)) {
        e.cargo = null
        moved += 1
      }
    }
  }

  // Splitters: alternate forward vs right output
  for (const e of Object.values(entities)) {
    if (!machineIsLive(e)) continue
    if (e.kind !== 'splitter' || !e.cargo) continue
    if (!entityHasPower(e, state, net)) continue
    e.cargo.progress = Math.min(
      1,
      e.cargo.progress + beltSpeedFor('belt') * bonuses.beltSpeedMult * dt * powerRatio,
    )
    if (e.cargo.progress < 1) continue

    const toggle = e.toggle ?? 0
    const outDir: Dir = toggle === 0 ? e.dir : rotateDir(e.dir, true)
    const next = neighbor(state, e.x, e.y, outDir)
    if (!next.entity) {
      const alt: Dir = toggle === 0 ? rotateDir(e.dir, true) : e.dir
      const altN = neighbor(state, e.x, e.y, alt)
      if (altN.entity && tryBeltHandoff(entities[altN.entity.id], e.cargo.item)) {
        e.cargo = null
        e.toggle = 1 - toggle
        moved += 1
      }
      continue
    }
    if (tryBeltHandoff(entities[next.entity.id], e.cargo.item)) {
      e.cargo = null
      e.toggle = 1 - toggle
      moved += 1
    }
  }

  // --- Inserters ---
  for (const e of Object.values(entities)) {
    if (!machineIsLive(e)) continue
    if (!isInserterKind(e.kind)) continue
    if (!entityHasPower(e, state, net)) continue
    if (powerRatio <= 0) continue
    e.progress = Math.max(0, e.progress - dt * powerRatio)
    if (e.progress > 0) continue

    const reach = e.kind === 'longInserter' ? 2 : 1
    const behind = neighborAt(state, e.x, e.y, OPPOSITE[e.dir], reach)
    const front = neighborAt(state, e.x, e.y, e.dir, reach)
    if (!behind.entity || !front.entity) continue

    const src = entities[behind.entity.id]
    const dest = entities[front.entity.id]

    let prefer: ItemId[] | undefined
    if (isFurnaceKind(dest.kind)) prefer = ['coal', 'wood', 'ironOre', 'copperOre']
    if (isDrillKind(dest.kind)) prefer = ['coal', 'wood']
    if (dest.kind === 'assembler') prefer = ['ironPlate']
    if (isFurnaceKind(src.kind)) prefer = ['ironPlate', 'copperPlate']
    if (src.kind === 'assembler') prefer = ['gear']
    if (isDrillKind(src.kind)) prefer = ['ironOre', 'copperOre']

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

  return { ...state, entities, stats, power: powerLeft, lastTick: Date.now() }
}

export { addToStore, takeFromStore, MACHINE_CAP }
