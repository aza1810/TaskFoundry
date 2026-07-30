import {
  DEFAULT_HABITS,
  DIR_DELTA,
  EMPTY_INVENTORY,
  GAME_VERSION,
  GRID_H,
  GRID_W,
  HABIT_REWARDS,
  HAND_RECIPES,
  MAX_CRAFT_QUEUE,
  MAX_UNDERGROUND,
  OFFLINE_CAP_SECONDS,
  PLACEABLE_META,
  RECIPE_MAP,
  SAVE_KEY,
  canAfford,
  gain,
  idx,
  inBounds,
  isBeltKind,
  isDrillKind,
  rotateDir,
  spend,
  todayKey,
  xpForLevel,
} from './data'
import { GOALS, TIPS, emptyStats } from './goals'
import { createEntity, createTiles, getTile } from './grid'
import { TECHS } from './research'
import { findUgPartner, runMineCycles, simTick } from './sim'
import type {
  BlueprintEntity,
  CraftJob,
  Dir,
  GameState,
  Habit,
  HabitCategory,
  Placeable,
  TechId,
} from './types'

export function createInitialState(): GameState {
  return {
    version: GAME_VERSION,
    playerName: 'Operator',
    level: 1,
    xp: 0,
    width: GRID_W,
    height: GRID_H,
    tiles: createTiles(),
    entities: {},
    inventory: EMPTY_INVENTORY(),
    habits: DEFAULT_HABITS(),
    stepsToday: 0,
    stepsLifetime: 0,
    stepsDate: todayKey(),
    mineCycles: 0,
    selected: 'drill',
    placeDir: 'E',
    lastTick: Date.now(),
    totalHabitsCompleted: 0,
    unlockedToast: 'Goal: place a burner drill on iron ore. Steps power every drill.',
    stats: emptyStats(),
    completedGoals: [],
    tipIndex: 0,
    craftQueue: [],
    researched: [],
    blueprint: null,
    copyCorner: null,
  }
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as GameState
    if (!parsed || parsed.version !== GAME_VERSION) return createInitialState()
    return {
      ...createInitialState(),
      ...parsed,
      inventory: { ...EMPTY_INVENTORY(), ...parsed.inventory },
      stats: { ...emptyStats(), ...parsed.stats },
      tiles: parsed.tiles?.length === GRID_W * GRID_H ? parsed.tiles : createTiles(),
      entities: parsed.entities ?? {},
      habits: parsed.habits?.length ? parsed.habits : DEFAULT_HABITS(),
      completedGoals: parsed.completedGoals ?? [],
      craftQueue: parsed.craftQueue ?? [],
      researched: parsed.researched ?? [],
      blueprint: parsed.blueprint ?? null,
      copyCorner: parsed.copyCorner ?? null,
    }
  } catch {
    return createInitialState()
  }
}

export function saveState(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

function addXp(state: GameState, amount: number): GameState {
  let { xp, level } = state
  let toast = state.unlockedToast
  xp += amount
  let needed = xpForLevel(level)
  while (xp >= needed) {
    xp -= needed
    level += 1
    toast = `Level ${level} — clearance upgraded`
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
    return { ...state, habits }
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

  return { ...state, habits, stepsToday: 0, stepsDate: today }
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
      inventory: gain(next.inventory, goal.reward),
      unlockedToast: `Objective complete: ${goal.title} — ${goal.rewardLabel}`,
      tipIndex: (next.tipIndex + 1) % TIPS.length,
    }
    next = addXp(next, 25)
  }
  return next
}

function applyCraftOutputs(state: GameState, recipeId: string): GameState {
  const recipe = RECIPE_MAP[recipeId]
  if (!recipe) return state
  let next = {
    ...state,
    inventory: gain(state.inventory, recipe.outputs),
  }
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

export function tickState(state: GameState, now = Date.now()): GameState {
  let next = refreshDaily(state)
  const rawDt = Math.max(0, (now - next.lastTick) / 1000)
  const dt = Math.min(OFFLINE_CAP_SECONDS, rawDt)
  next = { ...next, lastTick: now }
  if (dt < 0.02) return claimGoals(next)

  // Chunk large offline catches so belts don't skip weirdly
  let left = dt
  while (left > 0) {
    const step = Math.min(0.5, left)
    next = simTick(next, step)
    next = tickHandCraft(next, step)
    left -= step
  }

  if (rawDt > 30) {
    const mins = Math.floor(Math.min(rawDt, OFFLINE_CAP_SECONDS) / 60)
    next = {
      ...next,
      unlockedToast: `Factory ran ~${mins || '<1'} min while you were away`,
    }
  }
  return claimGoals(next)
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

  const tiles = state.tiles.map((t) => ({ ...t }))
  const tile = tiles[idx(x, y)]

  if (tool === 'remove') {
    if (!tile.entityId) return state
    const ent = state.entities[tile.entityId]
    if (!ent) return state
    const entities = { ...state.entities }
    delete entities[ent.id]
    tile.entityId = null

    const invKey = ent.kind as Placeable
    let inventory = gain(state.inventory, { [invKey]: 1 })
    inventory = gain(inventory, ent.store as Partial<typeof inventory>)
    if (ent.cargo) {
      inventory = gain(inventory, { [ent.cargo.item]: 1 } as Partial<typeof inventory>)
    }
    return claimGoals({ ...state, tiles, entities, inventory })
  }

  if (tile.entityId) return state
  const meta = PLACEABLE_META[tool]
  if ((state.inventory[meta.inventoryKey] ?? 0) < 1) {
    return { ...state, unlockedToast: `No ${meta.label} in inventory — craft one` }
  }

  if ((tool === 'drill' || tool === 'electricDrill') && !tile.ore) {
    return { ...state, unlockedToast: 'Drills must be placed on an ore patch' }
  }

  let placeDir = state.placeDir
  // Belts inherit direction from a neighbor pointing into this cell
  if (isBeltKind(tool)) {
    for (const dir of ['N', 'E', 'S', 'W'] as Dir[]) {
      const { dx, dy } = DIR_DELTA[dir]
      const nx = x - dx
      const ny = y - dy
      if (!inBounds(nx, ny)) continue
      const nTile = state.tiles[idx(nx, ny)]
      const nEnt = nTile.entityId ? state.entities[nTile.entityId] : null
      if (nEnt && isBeltKind(nEnt.kind) && nEnt.dir === dir) {
        placeDir = dir
        break
      }
    }
  }

  let inventory = spend(state.inventory, { [meta.inventoryKey]: 1 })
  const ent = createEntity(tool, x, y, placeDir)

  if (tool === 'drill') {
    const fuel = Math.min(5, inventory.coal)
    if (fuel > 0) {
      inventory = spend(inventory, { coal: fuel })
      ent.store.coal = fuel
    }
  }
  if (tool === 'splitter') {
    ent.toggle = 0
  }
  if (tool === 'undergroundBelt') {
    ent.toggle = resolveUgToggle(state, x, y, placeDir)
  }

  tile.entityId = ent.id
  return claimGoals({
    ...state,
    tiles,
    entities: { ...state.entities, [ent.id]: ent },
    inventory,
    placeDir,
  })
}

function resolveUgToggle(
  state: GameState,
  x: number,
  y: number,
  dir: Dir,
): number {
  const { dx, dy } = DIR_DELTA[dir]
  // Look behind for an unpaired entrance → place exit
  for (let d = 1; d <= MAX_UNDERGROUND; d++) {
    const nx = x - dx * d
    const ny = y - dy * d
    if (!inBounds(nx, ny)) break
    const tile = state.tiles[idx(nx, ny)]
    const e = tile.entityId ? state.entities[tile.entityId] : null
    if (
      e?.kind === 'undergroundBelt' &&
      e.dir === dir &&
      (e.toggle ?? 0) === 0 &&
      !findUgPartner(state, state.entities, e)
    ) {
      return 1
    }
  }
  // Look ahead for an unpaired exit → place entrance
  for (let d = 1; d <= MAX_UNDERGROUND; d++) {
    const nx = x + dx * d
    const ny = y + dy * d
    if (!inBounds(nx, ny)) break
    const tile = state.tiles[idx(nx, ny)]
    const e = tile.entityId ? state.entities[tile.entityId] : null
    if (
      e?.kind === 'undergroundBelt' &&
      e.dir === dir &&
      (e.toggle ?? 0) === 1 &&
      !findUgPartner(state, state.entities, e)
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
      unlockedToast: 'Copy: click the opposite corner of the selection',
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
      if (!ent) continue
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
    unlockedToast: `Copied ${blueprint.length} buildings — click to paste`,
  }
}

function pasteBlueprint(state: GameState, ox: number, oy: number): GameState {
  const bp = state.blueprint
  if (!bp || bp.length === 0) {
    return { ...state, unlockedToast: 'No blueprint — use Copy first' }
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
      return { ...state, unlockedToast: 'Paste area is blocked — clear tiles first' }
    }
    if (isDrillKind(piece.kind) && !tile.ore) {
      return {
        ...state,
        unlockedToast: 'Paste needs ore under every drill in the blueprint',
      }
    }
  }

  let inventory = { ...state.inventory }
  const tiles = state.tiles.map((t) => ({ ...t }))
  const entities = { ...state.entities }

  for (const piece of bp) {
    const x = ox + piece.dx
    const y = oy + piece.dy
    inventory = spend(inventory, { [piece.kind]: 1 })
    const ent = createEntity(piece.kind, x, y, piece.dir)
    if (piece.toggle !== undefined) ent.toggle = piece.toggle
    if (piece.kind === 'splitter' && ent.toggle === undefined) ent.toggle = 0
    if (piece.kind === 'drill') {
      const fuel = Math.min(5, inventory.coal)
      if (fuel > 0) {
        inventory = spend(inventory, { coal: fuel })
        ent.store.coal = fuel
      }
    }
    tiles[idx(x, y)].entityId = ent.id
    entities[ent.id] = ent
  }

  return claimGoals({
    ...state,
    inventory,
    tiles,
    entities,
    unlockedToast: `Pasted ${bp.length} buildings`,
  })
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
  let inventory = { ...state.inventory }
  const entities = { ...state.entities }
  for (const ent of Object.values(state.entities)) {
    if (ent.kind !== 'drill') continue
    const have = ent.store.coal ?? 0
    if (have >= 2) continue
    const need = Math.min(5 - Math.floor(have), inventory.coal)
    if (need <= 0) continue
    inventory.coal -= need
    entities[ent.id] = {
      ...ent,
      store: { ...ent.store, coal: have + need },
    }
  }
  return { ...state, inventory, entities }
}

function ensureDrillFuel(state: GameState): GameState {
  let inventory = { ...state.inventory }
  const entities: typeof state.entities = { ...state.entities }
  for (const ent of Object.values(state.entities)) {
    if (ent.kind !== 'drill') continue
    if ((ent.store.coal ?? 0) >= 0.25) continue
    if (inventory.coal < 1) continue
    inventory.coal -= 1
    entities[ent.id] = {
      ...ent,
      store: { ...ent.store, coal: (ent.store.coal ?? 0) + 1 },
    }
  }
  return { ...state, inventory, entities }
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
  next = addXp(next, Math.floor(add / 400))
  return claimGoals(next)
}

export function completeHabit(state: GameState, habitId: string): GameState {
  let next = refreshDaily(state)
  const habit = next.habits.find((h) => h.id === habitId)
  if (!habit || habit.completedToday) return next

  const reward = HABIT_REWARDS[habit.category]
  const streak = habit.streak + 1
  const streakMult = 1 + Math.min(0.5, (streak - 1) * 0.05)

  const habits = next.habits.map((h) =>
    h.id === habitId
      ? { ...h, completedToday: true, streak, lastCompletedDate: todayKey() }
      : h,
  )

  next = {
    ...next,
    habits,
    inventory: gain(next.inventory, reward.items, streakMult),
    totalHabitsCompleted: next.totalHabitsCompleted + 1,
  }
  // Track hand-crafted gears from habit rewards
  if (reward.items.gear) {
    next = {
      ...next,
      stats: {
        ...next.stats,
        gearsMade: next.stats.gearsMade + Math.floor((reward.items.gear ?? 0) * streakMult),
      },
    }
  }
  next = addXp(next, Math.round(reward.xp * streakMult))
  return claimGoals(next)
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
      unlockedToast: `Craft queue full (${MAX_CRAFT_QUEUE}) — wait for the bench`,
    }
  }
  if (!canAfford(state.inventory, recipe.inputs)) return state

  const job: CraftJob = {
    id: `craft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    recipeId: recipe.id,
    elapsed: 0,
    duration: recipe.handSeconds,
  }

  return {
    ...state,
    inventory: spend(state.inventory, recipe.inputs),
    craftQueue: [...state.craftQueue, job],
    unlockedToast:
      state.craftQueue.length === 0
        ? `Hand-crafting ${recipe.name} (${recipe.handSeconds}s)`
        : `Queued ${recipe.name} (#${state.craftQueue.length + 1})`,
  }
}

export function cancelCraft(state: GameState, jobId: string): GameState {
  const idxJob = state.craftQueue.findIndex((j) => j.id === jobId)
  if (idxJob < 0) return state
  const job = state.craftQueue[idxJob]
  const recipe = RECIPE_MAP[job.recipeId]
  const queue = state.craftQueue.filter((j) => j.id !== jobId)
  // Refund inputs fully (simple Factorio hand-craft cancel)
  let inventory = state.inventory
  if (recipe) inventory = gain(inventory, recipe.inputs)
  return {
    ...state,
    craftQueue: queue,
    inventory,
    unlockedToast: `Cancelled ${recipe?.name ?? 'craft'} — materials returned`,
  }
}

export function collectChest(state: GameState, x: number, y: number): GameState {
  const tile = getTile(state.tiles, x, y)
  if (!tile?.entityId) return state
  const ent = state.entities[tile.entityId]
  if (!ent || ent.kind !== 'chest') return state
  return claimGoals({
    ...state,
    inventory: gain(state.inventory, ent.store as Partial<typeof state.inventory>),
    entities: {
      ...state.entities,
      [ent.id]: { ...ent, store: {} },
    },
    unlockedToast: 'Collected chest contents',
  })
}

export function fuelAllDrills(state: GameState): GameState {
  const next = topUpDrillFuel(state)
  return { ...next, unlockedToast: 'Fueled burner drills from inventory' }
}

export function cycleTip(state: GameState): GameState {
  return { ...state, tipIndex: (state.tipIndex + 1) % TIPS.length }
}

export function clearToast(state: GameState): GameState {
  return { ...state, unlockedToast: null }
}

export function resetGame(): GameState {
  localStorage.removeItem(SAVE_KEY)
  return createInitialState()
}

export function renamePlayer(state: GameState, name: string): GameState {
  return { ...state, playerName: name.slice(0, 24) || state.playerName }
}

export function researchTech(state: GameState, techId: TechId): GameState {
  const tech = TECHS.find((t) => t.id === techId)
  if (!tech) return state
  if (state.researched.includes(techId)) {
    return { ...state, unlockedToast: `${tech.name} already researched` }
  }
  if (!canAfford(state.inventory, tech.cost)) {
    return { ...state, unlockedToast: `Need more materials for ${tech.name}` }
  }
  return addXp(
    {
      ...state,
      inventory: spend(state.inventory, tech.cost),
      researched: [...state.researched, techId],
      unlockedToast: `Researched ${tech.name} — ${tech.unlocks}`,
    },
    35,
  )
}

/** Drop a small starter smelting line near the first clear iron patch */
export function buildStarterLine(state: GameState): GameState {
  // Layout facing east:
  // [drill>][belt>][belt>][inserter>][furnace]
  //                              [inserter v]
  //                              [chest]
  let origin: { x: number; y: number } | null = null
  for (let y = 0; y < state.height - 2 && !origin; y++) {
    for (let x = 0; x < state.width - 4; x++) {
      if (state.tiles[idx(x, y)].ore !== 'ironOre') continue
      const cells = [
        [x, y],
        [x + 1, y],
        [x + 2, y],
        [x + 3, y],
        [x + 4, y],
        [x + 4, y + 1],
        [x + 4, y + 2],
      ]
      if (cells.every(([cx, cy]) => !state.tiles[idx(cx, cy)].entityId)) {
        origin = { x, y }
        break
      }
    }
  }
  if (!origin) {
    return { ...state, unlockedToast: 'No clear iron patch for a starter line' }
  }

  const need = { drill: 1, belt: 2, inserter: 2, furnace: 1, chest: 1, coal: 5 }
  if (!canAfford(state.inventory, need)) {
    return {
      ...state,
      unlockedToast: 'Need 1 drill, 2 belts, 2 inserters, 1 furnace, 1 chest, 5 coal',
    }
  }

  let inventory = { ...state.inventory }
  const tiles = state.tiles.map((t) => ({ ...t }))
  const entities = { ...state.entities }

  const put = (kind: Placeable, x: number, y: number, dir: Dir) => {
    inventory = spend(inventory, { [kind]: 1 })
    const ent = createEntity(kind, x, y, dir)
    if (kind === 'drill') {
      const fuel = Math.min(5, inventory.coal)
      if (fuel > 0) {
        inventory = spend(inventory, { coal: fuel })
        ent.store.coal = fuel
      }
    }
    tiles[idx(x, y)].entityId = ent.id
    entities[ent.id] = ent
  }

  const { x, y } = origin
  put('drill', x, y, 'E')
  put('belt', x + 1, y, 'E')
  put('belt', x + 2, y, 'E')
  put('inserter', x + 3, y, 'E') // behind belt, front furnace
  put('furnace', x + 4, y, 'E')
  put('inserter', x + 4, y + 1, 'S') // behind furnace, front chest
  put('chest', x + 4, y + 2, 'S')

  return claimGoals({
    ...state,
    inventory,
    tiles,
    entities,
    placeDir: 'E',
    selected: 'belt',
    unlockedToast: 'Starter smelting line planted — log steps to feed it',
  })
}

export { HAND_RECIPES }
