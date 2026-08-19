import {
  DEFAULT_HABITS,
  DIR_DELTA,
  DRONE_BUILD_SECONDS,
  DRONE_SPEED,
  DRONES_PER_ROBOPORT,
  EMPTY_INVENTORY,
  GAME_VERSION,
  GRID_H,
  GRID_W,
  TREE_COUNT,
  TREE_CUT_SECONDS,
  WOOD_PER_TREE,
  HABIT_REWARDS,
  HAND_RECIPES,
  ITEM_META,
  MAX_CRAFT_QUEUE,
  MAX_UNDERGROUND,
  OFFLINE_CAP_SECONDS,
  OFFLINE_REPORT_SECONDS,
  PLACEABLE_META,
  RECIPE_MAP,
  SAVE_KEY,
  ACTIVE_SAVE_KEY,
  setActiveSaveKey,
  asItemCount,
  canAfford,
  gain,
  idx,
  inBounds,
  isDrillKind,
  rotateDir,
  sanitizeInventory,
  spend,
  todayKey,
  xpForLevel,
} from './data'
import { GOALS, TIPS, emptyStats } from './goals'
import { createEntity, createTiles, getTile } from './grid'
import {
  canAffordStock,
  canChestsAccept,
  depositStock,
  depositToChests,
  isWarehouseItem,
  scrubChestsToWarehouse,
  spendStock,
  stockOf,
} from './chestInventory'
import { TECH_MAP, TECHS, countPlacedChests, maxChestsFor, prereqsMet, withImpliedResearched } from './research'
import {
  emptySkills,
  formatSkillGains,
  grantSkillXp,
  normalizeSkills,
  skillBonuses,
  stepSkillGains,
  SKILL_DEFS,
} from './skills'
import { TUTORIAL_STEP_COUNT, tutorialStepIndex } from './tutorial'
import { suggestPlaceDir } from './tutorialGuide'
import {
  generateDailyContracts,
  toggleFocusSkill,
  contractComplete,
} from './contracts'
import { findUgPartner, runMineCycles, simTick } from './sim'
import type {
  BlueprintEntity,
  CraftJob,
  Dir,
  Drone,
  Entity,
  GameState,
  Habit,
  HabitCategory,
  Inventory,
  ItemId,
  OfflineReport,
  Placeable,
  SkillId,
  TechId,
} from './types'

/** Scatter natural trees on empty (non-ore) tiles in loose clusters. */
export function scatterTrees(state: GameState, count = TREE_COUNT): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  const entities = { ...state.entities }
  const free = (x: number, y: number) => {
    if (!inBounds(x, y)) return false
    const t = tiles[idx(x, y)]
    return !t.entityId && !t.ore
  }
  const clusters = Math.max(1, Math.round(count / 4))
  const centers = Array.from({ length: clusters }, () => ({
    x: Math.floor(Math.random() * GRID_W),
    y: Math.floor(Math.random() * GRID_H),
  }))
  let placed = 0
  let attempts = 0
  while (placed < count && attempts < count * 40) {
    attempts++
    const c = centers[Math.floor(Math.random() * centers.length)]
    const x = c.x + Math.round((Math.random() - 0.5) * 6)
    const y = c.y + Math.round((Math.random() - 0.5) * 6)
    if (!free(x, y)) continue
    const ent = createEntity('tree', x, y, 'N')
    tiles[idx(x, y)].entityId = ent.id
    entities[ent.id] = ent
    placed++
  }
  return { ...state, tiles, entities, treesSeeded: true }
}

export function createInitialState(): GameState {
  const base: GameState = {
    version: GAME_VERSION,
    playerName: 'Operator',
    level: 1,
    xp: 0,
    width: GRID_W,
    height: GRID_H,
    tiles: createTiles(),
    entities: {},
    drones: [],
    inventory: EMPTY_INVENTORY(),
    habits: DEFAULT_HABITS(),
    stepsToday: 0,
    stepsLifetime: 0,
    stepsDate: todayKey(),
    healthImportedToday: 0,
    healthImportDate: todayKey(),
    mineCycles: 0,
    selected: null,
    placeDir: 'E',
    lastTick: Date.now(),
    totalHabitsCompleted: 0,
    unlockedToast:
      'Welcome - drop a Roboport to deploy a construction drone, then place a drill on iron ore. Steps power every drill.',
    offlineReport: null,
    stats: emptyStats(),
    completedGoals: [],
    tipIndex: 0,
    craftQueue: [],
    researched: [],
    blueprint: null,
    copyCorner: null,
    skills: emptySkills(),
    lastSkillGains: null,
    focusSkills: [],
    contractsDate: todayKey(),
    contracts: [],
    tutorialStep: 0,
    tutorialComplete: false,
    treesSeeded: false,
  }
  return scatterTrees(base)
}

export function loadState(accountSaveKey?: string): GameState {
  if (accountSaveKey) setActiveSaveKey(accountSaveKey)
  try {
    const raw =
      localStorage.getItem(ACTIVE_SAVE_KEY) ??
      (ACTIVE_SAVE_KEY === SAVE_KEY
        ? localStorage.getItem('task-foundry-v8') ??
          localStorage.getItem('habitworks-grid-v7') ??
          localStorage.getItem('habitworks-grid-v6')
        : null)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as GameState & { version?: number }
    if (!parsed || typeof parsed.version !== 'number' || parsed.version < 6) {
      return createInitialState()
    }
    let next: GameState = {
      ...createInitialState(),
      ...parsed,
      version: GAME_VERSION,
      inventory: sanitizeInventory({ ...EMPTY_INVENTORY(), ...parsed.inventory }),
      stats: { ...emptyStats(), ...parsed.stats },
      tiles: parsed.tiles?.length === GRID_W * GRID_H ? parsed.tiles : createTiles(),
      entities: parsed.entities ?? {},
      drones: Array.isArray(parsed.drones) ? parsed.drones : [],
      habits: parsed.habits?.length ? parsed.habits : DEFAULT_HABITS(),
      completedGoals: parsed.completedGoals ?? [],
      craftQueue: parsed.craftQueue ?? [],
      researched: withImpliedResearched(
        (parsed.researched ?? []) as TechId[],
      ),
      blueprint: parsed.blueprint ?? null,
      copyCorner: parsed.copyCorner ?? null,
      skills: normalizeSkills(parsed.skills),
      lastSkillGains: null,
      focusSkills: (parsed.focusSkills ?? []).slice(0, 2),
      offlineReport: null,
      contractsDate: parsed.contractsDate ?? '',
      contracts: parsed.contracts ?? [],
      healthImportedToday: parsed.healthImportedToday ?? 0,
      healthImportDate: parsed.healthImportDate ?? parsed.stepsDate ?? todayKey(),
      tutorialStep:
        parsed.tutorialComplete === true
          ? null
          : typeof parsed.tutorialStep === 'number'
            ? parsed.tutorialStep >= TUTORIAL_STEP_COUNT
              ? null
              : parsed.tutorialStep
            : 0,
      tutorialComplete:
        parsed.tutorialComplete === true ||
        (typeof parsed.tutorialStep === 'number' &&
          parsed.tutorialStep >= TUTORIAL_STEP_COUNT),
      treesSeeded: parsed.treesSeeded === true,
    }
    next = { ...next, inventory: sanitizeInventory(next.inventory) }
    next = scrubChestsToWarehouse(next)
    if (!next.treesSeeded) next = scatterTrees(next)
    next = reconcileDrones(next)
    // Existing saves with a furnace already placed keep the 2nd chest unlock.
    const hasFurnace = Object.values(next.entities).some(
      (e) => e.kind === 'furnace' || e.kind === 'steelFurnace',
    )
    if (hasFurnace && !next.completedGoals.includes('place-furnace')) {
      next = {
        ...next,
        completedGoals: [...next.completedGoals, 'place-furnace'],
      }
    }
    next = ensureContracts(next)
    localStorage.setItem(ACTIVE_SAVE_KEY, JSON.stringify(next))
    return next
  } catch {
    return createInitialState()
  }
}

function ensureContracts(state: GameState): GameState {
  const day = todayKey()
  if (state.contractsDate === day && state.contracts.length > 0) return state
  return {
    ...state,
    contractsDate: day,
    contracts: generateDailyContracts(state, day),
  }
}

export function saveState(state: GameState): void {
  const { offlineReport: _omit, ...persisted } = state
  localStorage.setItem(ACTIVE_SAVE_KEY, JSON.stringify(persisted))
}

function addXp(state: GameState, amount: number): GameState {
  let { xp, level } = state
  let toast = state.unlockedToast
  xp += amount
  let needed = xpForLevel(level)
  while (xp >= needed) {
    xp -= needed
    level += 1
    toast = `Level ${level} - clearance upgraded`
    needed = xpForLevel(level)
  }
  return { ...state, xp, level, unlockedToast: toast }
}

function refreshDaily(state: GameState): GameState {
  const today = todayKey()
  if (state.stepsDate === today) {
    const habits = state.habits.map((h) => ({
      ...h,
      completedToday: h.lastCompletedDate === today,
    }))
    return ensureContracts({ ...state, habits })
  }

  const habits = state.habits.map((h) => {
    let streak = 0
    if (h.lastCompletedDate) {
      const last = new Date(h.lastCompletedDate + 'T12:00:00')
      const diff = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
      streak = diff <= 1 ? h.streak : 0
    }
    return { ...h, completedToday: false, streak }
  })

  return ensureContracts({
    ...state,
    habits,
    stepsToday: 0,
    stepsDate: today,
    healthImportedToday: 0,
    healthImportDate: today,
    contractsDate: '',
    contracts: [],
  })
}

/** Claim any newly completed goals and grant rewards */
export function claimGoals(state: GameState): GameState {
  let next = state
  for (const goal of GOALS) {
    if (next.completedGoals.includes(goal.id)) continue
    if (!goal.check(next)) continue
    next = {
      ...next,
      completedGoals: [...next.completedGoals, goal.id],
      unlockedToast:
        goal.id === 'place-furnace'
          ? `Achievement: ${goal.title} - 2nd chest unlocked!`
          : `Objective complete: ${goal.title} - ${goal.rewardLabel}`,
      tipIndex: (next.tipIndex + 1) % TIPS.length,
    }
    next = depositStock(next, goal.reward)
    next = addXp(next, 25)
  }
  return next
}

function applyCraftOutputs(state: GameState, recipeId: string): GameState {
  const recipe = RECIPE_MAP[recipeId]
  if (!recipe) return state
  let next = depositStock(state, recipe.outputs)
  if (recipe.outputs.gear) {
    next = {
      ...next,
      stats: {
        ...next.stats,
        gearsMade: next.stats.gearsMade + (recipe.outputs.gear ?? 0),
      },
    }
  }
  if (recipe.outputs.ironPlate || recipe.outputs.copperPlate) {
    next = {
      ...next,
      stats: {
        ...next.stats,
        platesSmelted:
          next.stats.platesSmelted +
          (recipe.outputs.ironPlate ?? 0) +
          (recipe.outputs.copperPlate ?? 0),
      },
    }
  }
  next = addXp(next, 2)
  next = {
    ...next,
    unlockedToast: `Finished: ${recipe.name}`,
  }
  return next
}

/** Advance hand-crafting bench queue */
export function tickHandCraft(state: GameState, dt: number): GameState {
  if (dt <= 0 || state.craftQueue.length === 0) return state
  let queue = state.craftQueue.map((j) => ({ ...j }))
  let next: GameState = { ...state, craftQueue: queue }

  let remaining = dt
  while (remaining > 0 && queue.length > 0) {
    const job = queue[0]
    const left = job.duration - job.elapsed
    if (remaining >= left) {
      remaining -= left
      queue = queue.slice(1)
      next = { ...next, craftQueue: queue }
      next = applyCraftOutputs(next, job.recipeId)
      queue = next.craftQueue.map((j) => ({ ...j }))
    } else {
      job.elapsed += remaining
      remaining = 0
      next = { ...next, craftQueue: queue }
    }
  }
  return next
}

/** Only chest contents - offline haul credits what output buffers gathered. */
function snapshotChestItems(state: GameState): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {}
  for (const e of Object.values(state.entities)) {
    if (e.kind !== 'chest') continue
    for (const [key, value] of Object.entries(e.store)) {
      const n = value ?? 0
      if (n <= 0) continue
      const id = key as ItemId
      if (!isWarehouseItem(id)) continue
      out[id] = (out[id] ?? 0) + n
    }
  }
  return out
}

/** Away haul never includes buildings / placeables. */
function warehouseGainsOnly(
  gains: Partial<Record<ItemId, number>>,
): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {}
  for (const [key, value] of Object.entries(gains)) {
    const id = key as ItemId
    const n = value ?? 0
    if (n <= 0 || !isWarehouseItem(id)) continue
    out[id] = n
  }
  return out
}

function itemGains(
  before: Partial<Record<ItemId, number>>,
  after: Partial<Record<ItemId, number>>,
): Partial<Record<ItemId, number>> {
  const gains: Partial<Record<ItemId, number>> = {}
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]) as Set<ItemId>
  for (const id of keys) {
    const delta = (after[id] ?? 0) - (before[id] ?? 0)
    if (delta > 0) gains[id] = delta
  }
  return gains
}

function mergeItemGains(
  a: Partial<Record<ItemId, number>>,
  b: Partial<Record<ItemId, number>>,
): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = { ...a }
  for (const [key, value] of Object.entries(b)) {
    const n = value ?? 0
    if (n <= 0) continue
    const id = key as ItemId
    out[id] = (out[id] ?? 0) + n
  }
  return out
}

export function tickState(state: GameState, now = Date.now()): GameState {
  let next = refreshDaily(state)
  const rawDt = Math.max(0, (now - next.lastTick) / 1000)
  const dt = Math.min(OFFLINE_CAP_SECONDS, rawDt)
  next = { ...next, lastTick: now }
  if (dt < 0.02) return claimGoals(next)

  const reportAway = rawDt > OFFLINE_REPORT_SECONDS
  const beforeStats = reportAway ? { ...next.stats } : null
  const beforeCrafts = reportAway ? next.craftQueue.length : 0
  const beforeChests = reportAway ? snapshotChestItems(next) : null
  // Keep Health step gains if auto-sync already created/updated a report.
  const priorReport = reportAway ? next.offlineReport : null

  // Adaptive chunks: keep short absences precise; bound work for long ones.
  // Furnaces/assemblers multi-cycle within a step, so larger steps stay accurate.
  const targetChunks = reportAway ? 2400 : Math.ceil(dt / 0.5)
  const stepSize = Math.min(2, Math.max(0.5, dt / Math.max(1, targetChunks)))

  let left = dt
  while (left > 0) {
    const step = Math.min(stepSize, left)
    next = simTick(next, step)
    next = tickHandCraft(next, step)
    next = tickDrones(next, step)
    left -= step
  }

  if (reportAway && beforeStats && beforeChests) {
    const simulatedSeconds = dt
    const report: OfflineReport = {
      awaySeconds: Math.max(rawDt, priorReport?.awaySeconds ?? 0),
      simulatedSeconds,
      capped: rawDt > OFFLINE_CAP_SECONDS || Boolean(priorReport?.capped),
      platesSmelted:
        Math.max(0, next.stats.platesSmelted - beforeStats.platesSmelted) +
        (priorReport?.platesSmelted ?? 0),
      gearsMade:
        Math.max(0, next.stats.gearsMade - beforeStats.gearsMade) +
        (priorReport?.gearsMade ?? 0),
      itemsMoved:
        Math.max(0, next.stats.itemsMoved - beforeStats.itemsMoved) +
        (priorReport?.itemsMoved ?? 0),
      craftsFinished:
        Math.max(0, beforeCrafts - next.craftQueue.length) +
        (priorReport?.craftsFinished ?? 0),
      stepsSynced: priorReport?.stepsSynced ?? 0,
      // Only credit warehouse materials that landed in chests.
      itemGains: warehouseGainsOnly(
        mergeItemGains(
          priorReport?.itemGains ?? {},
          itemGains(beforeChests, snapshotChestItems(next)),
        ),
      ),
    }
    next = { ...next, offlineReport: report, unlockedToast: null }
  }
  return claimGoals(next)
}

export function clearOfflineReport(state: GameState): GameState {
  if (!state.offlineReport) return state
  return { ...state, offlineReport: null }
}

export function selectTool(state: GameState, tool: GameState['selected']): GameState {
  return { ...state, selected: tool, copyCorner: null }
}

export function rotatePlaceDir(state: GameState): GameState {
  return { ...state, placeDir: rotateDir(state.placeDir) }
}

export function setPlaceDir(state: GameState, dir: Dir): GameState {
  return { ...state, placeDir: dir }
}

/** A built (non-ghost) roboport exists, so new placements become drone jobs. */
function hasActiveRoboport(state: GameState): boolean {
  return Object.values(state.entities).some(
    (e) => e.kind === 'roboport' && !e.ghost,
  )
}

function makeDrone(roboport: Entity, seq: number): Drone {
  return {
    id: `drone-${roboport.id}-${seq}-${Math.random().toString(36).slice(2, 6)}`,
    homeId: roboport.id,
    x: roboport.x,
    y: roboport.y,
    state: 'idle',
    targetId: null,
    buildProgress: 0,
  }
}

/** Keep one drone per built roboport; drop drones whose roboport is gone. */
function reconcileDrones(state: GameState): GameState {
  const roboports = Object.values(state.entities).filter(
    (e) => e.kind === 'roboport' && !e.ghost,
  )
  const roboIds = new Set(roboports.map((r) => r.id))
  let drones = state.drones.filter((d) => roboIds.has(d.homeId))
  const countByHome: Record<string, number> = {}
  for (const d of drones) countByHome[d.homeId] = (countByHome[d.homeId] ?? 0) + 1

  let added = false
  for (const r of roboports) {
    const have = countByHome[r.id] ?? 0
    for (let i = have; i < DRONES_PER_ROBOPORT; i++) {
      drones = [...drones, makeDrone(r, i)]
      added = true
    }
  }
  if (!added && drones.length === state.drones.length) return state
  return { ...state, drones }
}

/** Load a freshly built burner drill with coal from the warehouse. */
function fuelDrillEntity(state: GameState, id: string): GameState {
  const e = state.entities[id]
  if (!e || e.kind !== 'drill') return state
  const fuel = Math.min(5, stockOf(state, 'coal'))
  if (fuel <= 0) return state
  const next = spendStock(state, { coal: fuel })
  const ent = next.entities[id]
  return {
    ...next,
    entities: {
      ...next.entities,
      [id]: { ...ent, store: { ...ent.store, coal: (ent.store.coal ?? 0) + fuel } },
    },
  }
}

/** Turn a construction ghost into a working entity + run post-build setup. */
function finishGhost(state: GameState, id: string): GameState {
  const ghost = state.entities[id]
  if (!ghost) return state
  const built: Entity = { ...ghost }
  delete built.ghost
  delete built.buildProgress
  let next: GameState = {
    ...state,
    entities: { ...state.entities, [id]: built },
  }
  if (built.kind === 'drill') next = fuelDrillEntity(next, id)
  if (built.kind === 'roboport') next = reconcileDrones(next)
  return next
}

/** A drone finished chopping a tree: clear the tile and stack wood in a chest. */
function fellTree(state: GameState, id: string): GameState {
  const tree = state.entities[id]
  if (!tree || tree.kind !== 'tree') return state
  // Requires a chest with space - otherwise leave the tree standing to retry.
  if (!canChestsAccept(state, 'wood')) return state
  const entities = { ...state.entities }
  delete entities[id]
  const tiles = state.tiles.map((t) => ({ ...t }))
  tiles[idx(tree.x, tree.y)].entityId = null
  return depositToChests({ ...state, entities, tiles }, 'wood', WOOD_PER_TREE)
}

/** A ghost to build, or a marked tree a drone can chop (needs chest space). */
function isDroneJob(ent: Entity | undefined, woodOk: boolean): boolean {
  if (!ent) return false
  if (ent.ghost) return true
  return ent.kind === 'tree' && Boolean(ent.marked) && woodOk
}

/** Advance construction drones: assign ghosts, fly, build, return home. */
export function tickDrones(state: GameState, dt: number): GameState {
  if (dt <= 0 || state.drones.length === 0) return state

  const woodOk = canChestsAccept(state, 'wood')
  const jobs = Object.values(state.entities).filter((e) =>
    isDroneJob(e, woodOk),
  )
  const drones = state.drones.map((d) => ({ ...d }))
  // Jobs already claimed by a still-valid drone.
  const claimed = new Set<string>()
  for (const d of drones) {
    if (d.targetId && isDroneJob(state.entities[d.targetId], woodOk)) {
      claimed.add(d.targetId)
    }
  }

  const moveToward = (d: Drone, tx: number, ty: number): boolean => {
    const dx = tx - d.x
    const dy = ty - d.y
    const dist = Math.hypot(dx, dy)
    const step = DRONE_SPEED * dt
    if (dist <= step || dist < 1e-4) {
      d.x = tx
      d.y = ty
      return true
    }
    d.x += (dx / dist) * step
    d.y += (dy / dist) * step
    return false
  }

  let next = state
  const completed: string[] = []

  for (const d of drones) {
    // Drop targets that were finished, demolished, or lost their chest space.
    if (d.targetId && !isDroneJob(state.entities[d.targetId], woodOk)) {
      claimed.delete(d.targetId)
      d.targetId = null
      d.buildProgress = 0
      if (d.state === 'toSite' || d.state === 'building') d.state = 'returning'
    }

    // Idle / free drone looks for the nearest unclaimed job.
    if (!d.targetId && (d.state === 'idle' || d.state === 'returning')) {
      let best: Entity | null = null
      let bestD = Infinity
      for (const g of jobs) {
        if (claimed.has(g.id)) continue
        const dd = (g.x - d.x) ** 2 + (g.y - d.y) ** 2
        if (dd < bestD) {
          bestD = dd
          best = g
        }
      }
      if (best) {
        d.targetId = best.id
        claimed.add(best.id)
        d.state = 'toSite'
        d.buildProgress = 0
      }
    }

    if (d.state === 'toSite' && d.targetId) {
      const g = state.entities[d.targetId]
      if (g && moveToward(d, g.x, g.y)) d.state = 'building'
    } else if (d.state === 'building' && d.targetId) {
      const job = state.entities[d.targetId]
      const dur = job?.kind === 'tree' ? TREE_CUT_SECONDS : DRONE_BUILD_SECONDS
      d.buildProgress += dt / dur
      if (d.buildProgress >= 1) {
        completed.push(d.targetId)
        claimed.delete(d.targetId)
        d.targetId = null
        d.buildProgress = 0
        d.state = 'returning'
      }
    } else if (d.state === 'returning') {
      const home = state.entities[d.homeId]
      if (home) {
        if (moveToward(d, home.x, home.y)) d.state = 'idle'
      } else {
        d.state = 'idle'
      }
    } else if (d.state === 'idle') {
      const home = state.entities[d.homeId]
      if (home) {
        d.x = home.x
        d.y = home.y
      }
    }
  }

  // Mirror in-progress build fill onto the ghost entities for rendering.
  if (completed.length > 0 || drones.some((d) => d.state === 'building')) {
    const entities = { ...state.entities }
    for (const d of drones) {
      if (d.state === 'building' && d.targetId && entities[d.targetId]) {
        entities[d.targetId] = {
          ...entities[d.targetId],
          buildProgress: Math.min(0.999, d.buildProgress),
        }
      }
    }
    next = { ...state, entities, drones }
  } else {
    next = { ...state, drones }
  }

  let lastLabel: string | null = null
  for (const id of completed) {
    const done = next.entities[id]
    if (done?.kind === 'tree') {
      next = fellTree(next, id)
      lastLabel = 'a tree'
    } else {
      next = finishGhost(next, id)
      lastLabel = PLACEABLE_META[done?.kind as Placeable]?.label ?? 'building'
    }
  }
  if (lastLabel) {
    next = {
      ...next,
      unlockedToast:
        completed.length > 1
          ? `Drones finished ${completed.length} jobs`
          : lastLabel === 'a tree'
            ? 'Drone chopped a tree (+wood)'
            : `Drone finished ${lastLabel}`,
    }
  }
  return next
}

export function placeEntity(state: GameState, x: number, y: number): GameState {
  if (!inBounds(x, y)) return state
  const tool = state.selected
  if (!tool) return state

  if (tool === 'copy') {
    return handleCopyClick(state, x, y)
  }
  if (tool === 'paste') {
    return pasteBlueprint(state, x, y)
  }
  if (tool === 'rotate') {
    const tile = getTile(state.tiles, x, y)
    if (!tile?.entityId) return state
    return rotateEntityAt(state, x, y)
  }

  const tiles = state.tiles.map((t) => ({ ...t }))
  const tile = tiles[idx(x, y)]

  if (tool === 'remove') {
    if (!tile.entityId) return state
    const ent = state.entities[tile.entityId]
    if (!ent) return state

    // Trees are chopped by drones, not the player. Demolish toggles a cut order.
    if (ent.kind === 'tree') {
      const entities = { ...state.entities }
      if (ent.marked) {
        entities[ent.id] = { ...ent, marked: false, buildProgress: 0 }
        const drones = state.drones.map((d) =>
          d.targetId === ent.id
            ? { ...d, targetId: null, buildProgress: 0, state: 'returning' as const }
            : d,
        )
        return { ...state, entities, drones, unlockedToast: 'Cut order cancelled' }
      }
      if (!canChestsAccept(state, 'wood')) {
        return {
          ...state,
          unlockedToast: 'Place a chest with a free slot so drones can stack the wood',
        }
      }
      entities[ent.id] = { ...ent, marked: true }
      return {
        ...state,
        entities,
        unlockedToast: hasActiveRoboport(state)
          ? 'Tree marked - a drone will chop it'
          : 'Tree marked - build a roboport so a drone can chop it',
      }
    }

    const entities = { ...state.entities }
    delete entities[ent.id]
    tile.entityId = null

    const invKey = ent.kind as Placeable
    let inventory = gain(state.inventory, { [invKey]: 1 })
    inventory = gain(inventory, ent.store as Partial<typeof inventory>)
    if (ent.cargo) {
      inventory = gain(inventory, { [ent.cargo.item]: 1 } as Partial<typeof inventory>)
    }

    // Release any drone building this tile so it does not get stranded.
    const drones = state.drones.map((d) =>
      d.targetId === ent.id
        ? { ...d, targetId: null, buildProgress: 0, state: 'returning' as const }
        : d,
    )
    let next: GameState = { ...state, tiles, entities, inventory, drones }
    // Removing a roboport retires its drones.
    if (ent.kind === 'roboport') next = reconcileDrones(next)
    return claimGoals(next)
  }

  if (tile.entityId) return state
  const meta = PLACEABLE_META[tool]
  if (asItemCount(state.inventory[meta.inventoryKey]) < 1) {
    return { ...state, unlockedToast: `No ${meta.label} in inventory - craft one` }
  }

  if ((tool === 'drill' || tool === 'electricDrill') && !tile.ore) {
    return { ...state, unlockedToast: 'Drills must be placed on an ore patch' }
  }

  if (tool === 'chest') {
    const placed = countPlacedChests(state.entities)
    const max = maxChestsFor(state.researched, state.completedGoals)
    if (placed >= max) {
      return {
        ...state,
        unlockedToast:
          max < 2
            ? `Chest limit ${placed}/${max} - place a furnace to unlock a 2nd chest`
            : max < 6
              ? `Chest limit ${placed}/${max} - research Factory storage to raise it`
              : `Chest limit reached (${max} on the floor)`,
      }
    }
  }

  const placeDir = suggestPlaceDir(state, tool, x, y)

  const inventory = spend(state.inventory, { [meta.inventoryKey]: 1 })
  const ent = createEntity(tool, x, y, placeDir)

  if (tool === 'splitter') {
    ent.toggle = 0
  }
  if (tool === 'undergroundBelt') {
    ent.toggle = resolveUgToggle(state, x, y, placeDir)
  }

  // Roboports are the drone hub, so they are always built by hand.
  // Everything else becomes a construction ghost once a roboport is online.
  const useGhost = tool !== 'roboport' && hasActiveRoboport(state)
  if (useGhost) {
    ent.ghost = true
    ent.buildProgress = 0
  }

  tile.entityId = ent.id
  let next: GameState = {
    ...state,
    tiles,
    entities: { ...state.entities, [ent.id]: ent },
    inventory,
    placeDir,
  }

  if (useGhost) {
    return claimGoals({
      ...next,
      unlockedToast: `${meta.label} queued - drone dispatched`,
    })
  }

  if (tool === 'drill') next = fuelDrillEntity(next, ent.id)
  if (tool === 'roboport') {
    next = reconcileDrones(next)
    next = { ...next, unlockedToast: 'Roboport online - construction drone deployed' }
  }

  return claimGoals(next)
}

function resolveUgToggle(
  state: GameState,
  x: number,
  y: number,
  dir: Dir,
): number {
  const { dx, dy } = DIR_DELTA[dir]
  const range = MAX_UNDERGROUND + skillBonuses(state.skills).ugBonus
  // Look behind for an unpaired entrance → place exit
  for (let d = 1; d <= range; d++) {
    const nx = x - dx * d
    const ny = y - dy * d
    if (!inBounds(nx, ny)) break
    const tile = state.tiles[idx(nx, ny)]
    const e = tile.entityId ? state.entities[tile.entityId] : null
    if (
      e?.kind === 'undergroundBelt' &&
      e.dir === dir &&
      (e.toggle ?? 0) === 0 &&
      !findUgPartner(state, state.entities, e, range)
    ) {
      return 1
    }
  }
  // Look ahead for an unpaired exit → place entrance
  for (let d = 1; d <= range; d++) {
    const nx = x + dx * d
    const ny = y + dy * d
    if (!inBounds(nx, ny)) break
    const tile = state.tiles[idx(nx, ny)]
    const e = tile.entityId ? state.entities[tile.entityId] : null
    if (
      e?.kind === 'undergroundBelt' &&
      e.dir === dir &&
      (e.toggle ?? 0) === 1 &&
      !findUgPartner(state, state.entities, e, range)
    ) {
      return 0
    }
  }
  return 0
}

function handleCopyClick(state: GameState, x: number, y: number): GameState {
  if (!state.copyCorner) {
    return {
      ...state,
      copyCorner: { x, y },
      unlockedToast: 'Copy: tap the opposite corner of the selection',
    }
  }

  const x0 = Math.min(state.copyCorner.x, x)
  const y0 = Math.min(state.copyCorner.y, y)
  const x1 = Math.max(state.copyCorner.x, x)
  const y1 = Math.max(state.copyCorner.y, y)

  const blueprint: BlueprintEntity[] = []
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const tile = state.tiles[idx(cx, cy)]
      const ent = tile.entityId ? state.entities[tile.entityId] : null
      if (!ent || ent.kind === 'tree') continue
      blueprint.push({
        kind: ent.kind as Placeable,
        dx: cx - x0,
        dy: cy - y0,
        dir: ent.dir,
        toggle: ent.toggle,
      })
    }
  }

  if (blueprint.length === 0) {
    return {
      ...state,
      copyCorner: null,
      unlockedToast: 'Nothing to copy in that area',
    }
  }

  return {
    ...state,
    blueprint,
    copyCorner: null,
    selected: 'paste',
    unlockedToast: `Copied ${blueprint.length} buildings - tap to paste`,
  }
}

function pasteBlueprint(state: GameState, ox: number, oy: number): GameState {
  const bp = state.blueprint
  if (!bp || bp.length === 0) {
    return { ...state, unlockedToast: 'No blueprint - use Copy first' }
  }

  const need: Partial<Record<Placeable, number>> = {}
  for (const piece of bp) {
    need[piece.kind] = (need[piece.kind] ?? 0) + 1
  }
  if (!canAfford(state.inventory, need)) {
    const missing = (Object.entries(need) as [Placeable, number][])
      .filter(([k, n]) => (state.inventory[k] ?? 0) < n)
      .map(([k]) => PLACEABLE_META[k].label)
      .join(', ')
    return {
      ...state,
      unlockedToast: `Need more buildings to paste: ${missing}`,
    }
  }

  for (const piece of bp) {
    const x = ox + piece.dx
    const y = oy + piece.dy
    if (!inBounds(x, y)) {
      return { ...state, unlockedToast: 'Blueprint does not fit on the map' }
    }
    const tile = state.tiles[idx(x, y)]
    if (tile.entityId) {
      return { ...state, unlockedToast: 'Paste area is blocked - clear tiles first' }
    }
    if (isDrillKind(piece.kind) && !tile.ore) {
      return {
        ...state,
        unlockedToast: 'Paste needs ore under every drill in the blueprint',
      }
    }
  }

  const pasteChests = bp.filter((p) => p.kind === 'chest').length
  if (pasteChests > 0) {
    const placed = countPlacedChests(state.entities)
    const max = maxChestsFor(state.researched, state.completedGoals)
    if (placed + pasteChests > max) {
      return {
        ...state,
        unlockedToast: `Chest limit ${placed}/${max} - paste needs ${pasteChests} more`,
      }
    }
  }

  let inventory = { ...state.inventory }
  const tiles = state.tiles.map((t) => ({ ...t }))
  const entities = { ...state.entities }
  const drillFuels: { id: string; fuel: number }[] = []
  const useGhost = hasActiveRoboport(state)

  for (const piece of bp) {
    const x = ox + piece.dx
    const y = oy + piece.dy
    inventory = spend(inventory, { [piece.kind]: 1 })
    const ent = createEntity(piece.kind, x, y, piece.dir)
    if (piece.toggle !== undefined) ent.toggle = piece.toggle
    if (piece.kind === 'splitter' && ent.toggle === undefined) ent.toggle = 0
    if (useGhost) {
      ent.ghost = true
      ent.buildProgress = 0
    }
    tiles[idx(x, y)].entityId = ent.id
    entities[ent.id] = ent
    if (!useGhost && piece.kind === 'drill') drillFuels.push({ id: ent.id, fuel: 5 })
  }

  if (useGhost) {
    return claimGoals({
      ...state,
      inventory,
      tiles,
      entities,
      unlockedToast: `${bp.length} buildings queued for drones`,
    })
  }

  let next: GameState = {
    ...state,
    inventory,
    tiles,
    entities,
    unlockedToast: `Pasted ${bp.length} buildings`,
  }
  for (const { id, fuel: maxFuel } of drillFuels) {
    const fuel = Math.min(maxFuel, stockOf(next, 'coal'))
    if (fuel <= 0) continue
    next = spendStock(next, { coal: fuel })
    const e = next.entities[id]
    next = {
      ...next,
      entities: {
        ...next.entities,
        [id]: { ...e, store: { ...e.store, coal: fuel } },
      },
    }
  }

  return claimGoals(next)
}

export function rotateEntityAt(state: GameState, x: number, y: number): GameState {
  const tile = getTile(state.tiles, x, y)
  if (!tile?.entityId) return rotatePlaceDir(state)
  const ent = state.entities[tile.entityId]
  if (!ent) return state
  return {
    ...state,
    entities: {
      ...state.entities,
      [ent.id]: { ...ent, dir: rotateDir(ent.dir) },
    },
  }
}

export function topUpDrillFuel(state: GameState): GameState {
  let next = state
  for (const id of Object.keys(state.entities)) {
    const ent = next.entities[id]
    if (!ent || ent.kind !== 'drill') continue
    const have = ent.store.coal ?? 0
    if (have >= 2) continue
    const need = Math.min(5 - Math.floor(have), stockOf(next, 'coal'))
    if (need <= 0) continue
    next = spendStock(next, { coal: need })
    const e = next.entities[id]
    next = {
      ...next,
      entities: {
        ...next.entities,
        [id]: {
          ...e,
          store: { ...e.store, coal: have + need },
        },
      },
    }
  }
  return next
}

function ensureDrillFuel(state: GameState): GameState {
  let next = state
  const coalNeed = 0.25 * (1 - skillBonuses(state.skills).drillCoalSave)
  for (const id of Object.keys(state.entities)) {
    const ent = next.entities[id]
    if (!ent || ent.kind !== 'drill') continue
    if ((ent.store.coal ?? 0) >= coalNeed) continue
    if (stockOf(next, 'coal') < 1) continue
    next = spendStock(next, { coal: 1 })
    const e = next.entities[id]
    next = {
      ...next,
      entities: {
        ...next.entities,
        [id]: {
          ...e,
          store: { ...e.store, coal: (e.store.coal ?? 0) + 1 },
        },
      },
    }
  }
  return next
}

export function logSteps(state: GameState, amount: number): GameState {
  let next = refreshDaily(state)
  const add = Math.max(0, Math.floor(amount))
  if (add <= 0) return next

  next = {
    ...next,
    stepsToday: next.stepsToday + add,
    stepsLifetime: next.stepsLifetime + add,
  }
  next = ensureDrillFuel(next)
  next = runMineCycles(next, add)

  const bonuses = skillBonuses(next.skills)
  const gains = stepSkillGains(next, add)
  const { skills, leveled } = grantSkillXp(next.skills, gains)
  next = { ...next, skills, lastSkillGains: gains }

  const opXp = Math.floor((add / 400) * bonuses.stepOperatorXpMult)
  next = addXp(next, opXp)

  if (leveled.length > 0) {
    const last = leveled[leveled.length - 1]
    const def = SKILL_DEFS[last]
    const lvl = next.skills[last].level
    const perk = def.perks.find((p) => p.level === lvl)
    next = {
      ...next,
      unlockedToast: `${def.name} → Lv ${lvl}${perk ? ` - ${perk.label}` : ''}`,
    }
  } else {
    const summary = formatSkillGains(gains)
    if (summary && add >= 10) {
      next = { ...next, unlockedToast: summary }
    }
  }

  return claimGoals(next)
}

/**
 * Import today's Apple Health / Health Connect total into the game.
 * Only the delta since the last import is applied, so manual logs stay separate
 * and re-syncing does not double-count.
 *
 * When returning from a long absence, mining is delivered briefly into chests;
 * the away recap only credits chest haul (not drill buffers).
 */
export function importHealthSteps(
  state: GameState,
  healthStepsToday: number,
  options?: { quiet?: boolean },
): GameState {
  const quiet = Boolean(options?.quiet)
  let next = refreshDaily(state)
  const today = todayKey()
  const imported =
    next.healthImportDate === today ? (next.healthImportedToday ?? 0) : 0
  const total = Math.max(0, Math.floor(healthStepsToday))
  const delta = Math.max(0, total - imported)
  if (delta <= 0) {
    return {
      ...next,
      healthImportedToday: Math.max(imported, total),
      healthImportDate: today,
      unlockedToast: quiet
        ? next.unlockedToast
        : total > 0
          ? `Health already synced (${total.toLocaleString()} steps today)`
          : 'No new health steps yet today',
    }
  }

  const beforeChests = snapshotChestItems(next)
  const beforeStats = { ...next.stats }
  next = logSteps(next, delta)

  // Push freshly mined ore along belts/inserters into chests before the recap.
  let deliver = Math.min(60, 8 + delta * 0.015)
  while (deliver > 0) {
    const step = Math.min(0.5, deliver)
    next = simTick(next, step)
    deliver -= step
  }
  const chestGains = itemGains(beforeChests, snapshotChestItems(next))

  next = {
    ...next,
    healthImportedToday: total,
    healthImportDate: today,
    unlockedToast: quiet
      ? null
      : `Synced +${delta.toLocaleString()} steps from health`,
  }

  const awaySeconds = Math.max(
    0,
    (Date.now() - state.lastTick) / 1000,
    next.offlineReport?.awaySeconds ?? 0,
  )
  const shouldReport =
    Boolean(next.offlineReport) || awaySeconds > OFFLINE_REPORT_SECONDS
  if (!shouldReport) return next

  const prior = next.offlineReport
  const report: OfflineReport = {
    awaySeconds: Math.max(awaySeconds, prior?.awaySeconds ?? 0),
    simulatedSeconds: prior?.simulatedSeconds ?? 0,
    capped: Boolean(prior?.capped),
    platesSmelted:
      (prior?.platesSmelted ?? 0) +
      Math.max(0, next.stats.platesSmelted - beforeStats.platesSmelted),
    gearsMade:
      (prior?.gearsMade ?? 0) +
      Math.max(0, next.stats.gearsMade - beforeStats.gearsMade),
    itemsMoved:
      (prior?.itemsMoved ?? 0) +
      Math.max(0, next.stats.itemsMoved - beforeStats.itemsMoved),
    craftsFinished: prior?.craftsFinished ?? 0,
    stepsSynced: (prior?.stepsSynced ?? 0) + delta,
    itemGains: warehouseGainsOnly(
      mergeItemGains(prior?.itemGains ?? {}, chestGains),
    ),
  }
  return { ...next, offlineReport: report }
}

export function completeHabit(state: GameState, habitId: string): GameState {
  let next = refreshDaily(state)
  const habit = next.habits.find((h) => h.id === habitId)
  if (!habit || habit.completedToday) return next

  const reward = HABIT_REWARDS[habit.category]
  const streak = habit.streak + 1
  const streakMult = 1 + Math.min(0.5, (streak - 1) * 0.05)
  const fieldMult = skillBonuses(next.skills).habitRewardMult
  const rewardMult = streakMult * fieldMult

  const habits = next.habits.map((h) =>
    h.id === habitId
      ? { ...h, completedToday: true, streak, lastCompletedDate: todayKey() }
      : h,
  )

  next = {
    ...next,
    habits,
    totalHabitsCompleted: next.totalHabitsCompleted + 1,
  }
  next = depositStock(next, reward.items, rewardMult)
  // Track hand-crafted gears from habit rewards
  if (reward.items.gear) {
    next = {
      ...next,
      stats: {
        ...next.stats,
        gearsMade:
          next.stats.gearsMade + Math.floor((reward.items.gear ?? 0) * rewardMult),
      },
    }
  }
  next = addXp(next, Math.round(reward.xp * rewardMult))
  const afterXpToast =
    next.unlockedToast && next.unlockedToast !== state.unlockedToast
      ? next.unlockedToast
      : null
  next = { ...next, unlockedToast: null }
  next = claimGoals(next)
  if (next.unlockedToast) return next
  const loot = rewardLabel(reward.items, rewardMult)
  return {
    ...next,
    unlockedToast:
      afterXpToast ??
      (loot ? `Task stamped: ${loot}` : `Task stamped: ${habit.title}`),
  }
}

function rewardLabel(
  items: Partial<Inventory>,
  mult = 1,
): string {
  return (Object.entries(items) as [ItemId, number][])
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([id, n]) => `+${Math.floor((n ?? 0) * mult)} ${ITEM_META[id].short}`)
    .join(' · ')
}

export function addHabit(
  state: GameState,
  title: string,
  category: HabitCategory,
): GameState {
  const habit: Habit = {
    id: `h-${Date.now()}`,
    title: title.trim().slice(0, 48),
    category,
    streak: 0,
    completedToday: false,
    lastCompletedDate: null,
  }
  if (!habit.title) return state
  return { ...state, habits: [...state.habits, habit] }
}

export function removeHabit(state: GameState, habitId: string): GameState {
  return { ...state, habits: state.habits.filter((h) => h.id !== habitId) }
}

export function craftRecipe(state: GameState, recipeId: string): GameState {
  const recipe = RECIPE_MAP[recipeId]
  if (!recipe) return state
  if (recipe.requiresTech && !state.researched.includes(recipe.requiresTech)) {
    return {
      ...state,
      unlockedToast: `Research required before crafting ${recipe.name}`,
    }
  }
  if (state.craftQueue.length >= MAX_CRAFT_QUEUE) {
    return {
      ...state,
      unlockedToast: `Craft queue full (${MAX_CRAFT_QUEUE}) - wait for the bench`,
    }
  }
  if (!canAffordStock(state, recipe.inputs)) {
    const missing = (Object.entries(recipe.inputs) as [ItemId, number][])
      .filter(([id, n]) => stockOf(state, id) < n)
      .map(([id, n]) => {
        const have = stockOf(state, id)
        return `${n - have} more ${ITEM_META[id].label}`
      })
      .slice(0, 2)
      .join(', ')
    return {
      ...state,
      unlockedToast: missing
        ? `Need ${missing} for ${recipe.name}`
        : `Need more materials for ${recipe.name}`,
    }
  }

  const craftMult = skillBonuses(state.skills).handCraftSpeedMult
  const duration = Math.max(0.8, recipe.handSeconds / craftMult)
  const job: CraftJob = {
    id: `craft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    recipeId: recipe.id,
    elapsed: 0,
    duration,
  }

  const spent = spendStock(state, recipe.inputs)
  return {
    ...spent,
    craftQueue: [...spent.craftQueue, job],
    unlockedToast:
      spent.craftQueue.length === 0
        ? `Hand-crafting ${recipe.name} (${duration.toFixed(1)}s)`
        : `Queued ${recipe.name} (#${spent.craftQueue.length + 1})`,
  }
}

export function cancelCraft(state: GameState, jobId: string): GameState {
  const idxJob = state.craftQueue.findIndex((j) => j.id === jobId)
  if (idxJob < 0) return state
  const job = state.craftQueue[idxJob]
  const recipe = RECIPE_MAP[job.recipeId]
  const queue = state.craftQueue.filter((j) => j.id !== jobId)
  // Refund inputs fully (simple Factorio hand-craft cancel)
  let next: GameState = { ...state, craftQueue: queue }
  if (recipe) next = depositStock(next, recipe.inputs)
  return {
    ...next,
    unlockedToast: `Cancelled ${recipe?.name ?? 'craft'} - materials returned`,
  }
}

export function collectChest(state: GameState, x: number, y: number): GameState {
  const tile = getTile(state.tiles, x, y)
  if (!tile?.entityId) return state
  const ent = state.entities[tile.entityId]
  if (!ent || ent.kind !== 'chest') return state
  const held = Object.values(ent.store).reduce((s, n) => s + (n ?? 0), 0)
  if (held <= 0) {
    return { ...state, unlockedToast: 'Chest empty' }
  }
  // Withdraw frees chest slots; materials move to hand stock (still spendable).
  return claimGoals({
    ...state,
    inventory: gain(state.inventory, ent.store as Partial<typeof state.inventory>),
    entities: {
      ...state.entities,
      [ent.id]: { ...ent, store: {} },
    },
    unlockedToast: 'Withdrew chest to hand stock (HUD shows floor chests)',
  })
}

export function fuelAllDrills(state: GameState): GameState {
  const beforeCoal = stockOf(state, 'coal')
  const drills = Object.values(state.entities).filter((e) => e.kind === 'drill')
  if (drills.length === 0) {
    return { ...state, unlockedToast: 'No burner drills on the floor' }
  }
  const next = topUpDrillFuel(state)
  const used = beforeCoal - stockOf(next, 'coal')
  if (used <= 0) {
    const anyHungry = drills.some((e) => (e.store.coal ?? 0) < 2)
    return {
      ...state,
      unlockedToast: anyHungry
        ? 'Need coal in a chest to fuel drills'
        : 'All burner drills already fueled',
    }
  }
  return {
    ...next,
    unlockedToast: `Fueled drills (−${used} coal)`,
  }
}

/** Top up a single burner drill from warehouse coal. */
export function fuelDrillAt(state: GameState, x: number, y: number): GameState {
  const tile = state.tiles[idx(x, y)]
  if (!tile?.entityId) return state
  const ent = state.entities[tile.entityId]
  if (!ent || ent.kind !== 'drill') return state
  const have = ent.store.coal ?? 0
  if (have >= 5) {
    return { ...state, unlockedToast: 'Drill already fueled' }
  }
  const need = Math.min(5 - Math.floor(have), stockOf(state, 'coal'))
  if (need <= 0) {
    return { ...state, unlockedToast: 'Need coal in a chest' }
  }
  const spent = spendStock(state, { coal: need })
  return {
    ...spent,
    entities: {
      ...spent.entities,
      [ent.id]: {
        ...spent.entities[ent.id],
        store: { ...spent.entities[ent.id].store, coal: have + need },
      },
    },
    unlockedToast: `Fueled drill (+${need} coal)`,
  }
}

export function cycleTip(state: GameState): GameState {
  return { ...state, tipIndex: (state.tipIndex + 1) % TIPS.length }
}

export function clearToast(state: GameState): GameState {
  return { ...state, unlockedToast: null }
}

export function clearSkillGains(state: GameState): GameState {
  if (!state.lastSkillGains) return state
  return { ...state, lastSkillGains: null }
}

export function resetGame(): GameState {
  localStorage.removeItem(ACTIVE_SAVE_KEY)
  return createInitialState()
}

export function advanceTutorial(state: GameState): GameState {
  if (state.tutorialComplete || state.tutorialStep === null) return state
  const next = state.tutorialStep + 1
  if (next >= TUTORIAL_STEP_COUNT) {
    return {
      ...state,
      tutorialStep: null,
      tutorialComplete: true,
      unlockedToast: 'Tour complete - walk the line, operator',
    }
  }
  return { ...state, tutorialStep: next }
}

export function skipTutorial(state: GameState): GameState {
  return {
    ...state,
    tutorialStep: null,
    tutorialComplete: true,
    unlockedToast: 'Tour skipped - explore Factory, Steps, and Tasks at your pace',
  }
}

export function replayTutorial(state: GameState): GameState {
  return {
    ...state,
    tutorialStep: 0,
    tutorialComplete: false,
    selected: null,
    unlockedToast: 'Tour restarted - follow the glowing tiles',
  }
}

/** One-tap: plant starter line and jump to the walk/mine coach. */
export function quickStartTutorial(state: GameState): GameState {
  const planted = buildStarterLine(state)
  const logIdx = tutorialStepIndex('logSteps')
  const ok = (planted.unlockedToast ?? '').toLowerCase().includes('starter')
  if (!ok) {
    return {
      ...planted,
      tutorialStep: tutorialStepIndex('placeDrill'),
    }
  }
  return {
    ...planted,
    tutorialStep: logIdx >= 0 ? logIdx : planted.tutorialStep,
    unlockedToast:
      'Starter line planted - sync steps so chests stockpile ore and plates',
  }
}

export function renamePlayer(state: GameState, name: string): GameState {
  const next = name.trim().slice(0, 24)
  if (!next || next === state.playerName) return state
  return {
    ...state,
    playerName: next,
    unlockedToast: `Operator name saved: ${next}`,
  }
}

export function setFocusSkill(state: GameState, id: SkillId): GameState {
  const prev = state.focusSkills ?? []
  const focusSkills = toggleFocusSkill(prev, id)
  const names = focusSkills.map((s) => SKILL_DEFS[s].name).join(' + ')
  let unlockedToast: string
  if (focusSkills.length === 0) {
    unlockedToast = 'Skill focus cleared'
  } else if (prev.length >= 2 && !prev.includes(id) && focusSkills.includes(id)) {
    const dropped = SKILL_DEFS[prev[0]].name
    unlockedToast = `Focus: ${names} (dropped ${dropped})`
  } else {
    unlockedToast = `Focus: ${names} (×${1.5} step XP)`
  }
  return {
    ...state,
    focusSkills,
    unlockedToast,
  }
}

export function claimContract(state: GameState, contractId: string): GameState {
  let next = ensureContracts(refreshDaily(state))
  const c = next.contracts.find((x) => x.id === contractId)
  if (!c || c.claimed) return next
  if (!contractComplete(next, c)) {
    return { ...next, unlockedToast: 'Contract not finished yet' }
  }
  next = {
    ...next,
    contracts: next.contracts.map((x) =>
      x.id === contractId ? { ...x, claimed: true } : x,
    ),
    unlockedToast: `Contract complete: ${c.title} - ${c.rewardLabel}`,
  }
  next = depositStock(next, c.reward)
  return addXp(claimGoals(next), 20)
}

export function researchTech(state: GameState, techId: TechId): GameState {
  const tech = TECH_MAP[techId] ?? TECHS.find((t) => t.id === techId)
  if (!tech) return state
  if (state.researched.includes(techId)) {
    return { ...state, unlockedToast: `${tech.name} already researched` }
  }
  if (!prereqsMet(tech, state.researched)) {
    const missing = tech.prerequisites
      .filter((id) => !state.researched.includes(id))
      .map((id) => TECH_MAP[id]?.name ?? id)
      .join(', ')
    return {
      ...state,
      unlockedToast: `Research ${missing} first`,
    }
  }
  if (!canAffordStock(state, tech.cost)) {
    return { ...state, unlockedToast: `Need more materials for ${tech.name}` }
  }
  const spent = spendStock(state, tech.cost)
  return addXp(
    {
      ...spent,
      researched: [...spent.researched, techId],
      unlockedToast: `Researched ${tech.name} - ${tech.unlocks}`,
    },
    35,
  )
}

/** Drop a starter line: drill → chest (ore) → furnace → chest (plates). */
export function buildStarterLine(state: GameState): GameState {
  // Layout facing east (9 tiles):
  // [drill>][belt>][inserter>][chest][inserter>][belt>][inserter>][furnace][inserter>][chest]
  let origin: { x: number; y: number } | null = null
  for (let y = 0; y < state.height && !origin; y++) {
    for (let x = 0; x < state.width - 9; x++) {
      if (state.tiles[idx(x, y)].ore !== 'ironOre') continue
      const cells = Array.from({ length: 10 }, (_, i) => [x + i, y] as const)
      if (cells.every(([cx, cy]) => !state.tiles[idx(cx, cy)].entityId)) {
        origin = { x, y }
        break
      }
    }
  }
  if (!origin) {
    return { ...state, unlockedToast: 'No clear iron patch for a starter line' }
  }

  const need = {
    drill: 1,
    belt: 2,
    inserter: 4,
    furnace: 1,
    chest: 2,
    coal: 5,
  }
  if (!canAffordStock(state, need)) {
    return {
      ...state,
      unlockedToast:
        'Need 1 drill, 2 belts, 4 inserters, 1 furnace, 2 chests, 5 coal',
    }
  }

  let inventory = { ...state.inventory }
  const tiles = state.tiles.map((t) => ({ ...t }))
  const entities = { ...state.entities }
  let drillId: string | null = null
  let furnaceId: string | null = null

  const put = (kind: Placeable, px: number, py: number, dir: Dir) => {
    inventory = spend(inventory, { [kind]: 1 })
    const ent = createEntity(kind, px, py, dir)
    tiles[idx(px, py)].entityId = ent.id
    entities[ent.id] = ent
    if (kind === 'drill') drillId = ent.id
    if (kind === 'furnace' || kind === 'steelFurnace') furnaceId = ent.id
  }

  const { x, y } = origin
  // Ore buffer
  put('drill', x, y, 'E')
  put('belt', x + 1, y, 'E')
  put('inserter', x + 2, y, 'E') // belt → ore chest
  put('chest', x + 3, y, 'E')
  // Into furnace
  put('inserter', x + 4, y, 'E') // ore chest → belt
  put('belt', x + 5, y, 'E')
  put('inserter', x + 6, y, 'E') // belt → furnace
  put('furnace', x + 7, y, 'E')

  let next: GameState = {
    ...state,
    inventory,
    tiles,
    entities,
    placeDir: 'E',
    selected: null,
  }
  if (drillId) {
    const fuel = Math.min(5, stockOf(next, 'coal'))
    if (fuel > 0) {
      next = spendStock(next, { coal: fuel })
      const e = next.entities[drillId]
      next = {
        ...next,
        entities: {
          ...next.entities,
          [drillId]: { ...e, store: { ...e.store, coal: fuel } },
        },
      }
    }
  }
  if (furnaceId) {
    const fuel = Math.min(5, stockOf(next, 'coal'))
    if (fuel > 0) {
      next = spendStock(next, { coal: fuel })
      const e = next.entities[furnaceId]
      next = {
        ...next,
        entities: {
          ...next.entities,
          [furnaceId]: { ...e, store: { ...e.store, coal: fuel } },
        },
      }
    }
  }

  // Unlock 2nd chest via place-furnace goal, then finish the plate buffer.
  next = claimGoals(next)
  inventory = { ...next.inventory }
  const tiles2 = next.tiles.map((t) => ({ ...t }))
  const entities2 = { ...next.entities }

  const put2 = (kind: Placeable, px: number, py: number, dir: Dir) => {
    inventory = spend(inventory, { [kind]: 1 })
    const ent = createEntity(kind, px, py, dir)
    tiles2[idx(px, py)].entityId = ent.id
    entities2[ent.id] = ent
  }

  put2('inserter', x + 8, y, 'E') // furnace → plate chest
  put2('chest', x + 9, y, 'E')

  next = {
    ...next,
    inventory,
    tiles: tiles2,
    entities: entities2,
    unlockedToast: 'Starter line planted - walk to stockpile ore and plates',
  }
  return claimGoals(next)
}

export { HAND_RECIPES }
