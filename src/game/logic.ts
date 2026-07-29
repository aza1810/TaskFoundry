import {
  DEFAULT_HABITS,
  EMPTY_INVENTORY,
  GAME_VERSION,
  GRID_H,
  GRID_W,
  HABIT_REWARDS,
  HAND_RECIPES,
  PLACEABLE_META,
  SAVE_KEY,
  canAfford,
  gain,
  idx,
  inBounds,
  rotateDir,
  spend,
  todayKey,
  xpForLevel,
} from './data'
import { createEntity, createTiles, getTile } from './grid'
import { MACHINE_CAP, addToStore, runMineCycles, simTick, takeFromStore } from './sim'
import type {
  Dir,
  GameState,
  Habit,
  HabitCategory,
  Placeable,
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
    unlockedToast: 'Place a drill on iron ore. Every step mines once.',
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
      tiles: parsed.tiles?.length === GRID_W * GRID_H ? parsed.tiles : createTiles(),
      entities: parsed.entities ?? {},
      habits: parsed.habits?.length ? parsed.habits : DEFAULT_HABITS(),
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

export function tickState(state: GameState, now = Date.now()): GameState {
  let next = refreshDaily(state)
  const dt = Math.min(5, Math.max(0, (now - next.lastTick) / 1000))
  next = { ...next, lastTick: now }
  if (dt < 0.02) return next
  return simTick(next, dt)
}

export function selectTool(state: GameState, tool: GameState['selected']): GameState {
  return { ...state, selected: tool }
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

  const tiles = state.tiles.map((t) => ({ ...t }))
  const tile = tiles[idx(x, y)]

  if (tool === 'remove') {
    if (!tile.entityId) return state
    const ent = state.entities[tile.entityId]
    if (!ent) return state
    const entities = { ...state.entities }
    delete entities[ent.id]
    tile.entityId = null

    // Refund building + dump store into inventory
    const invKey = ent.kind as Placeable
    let inventory = gain(state.inventory, { [invKey]: 1 })
    inventory = gain(inventory, ent.store as Partial<typeof inventory>)
    if (ent.cargo) {
      inventory = gain(inventory, { [ent.cargo.item]: 1 } as Partial<typeof inventory>)
    }
    return { ...state, tiles, entities, inventory }
  }

  if (tile.entityId) return state
  const meta = PLACEABLE_META[tool]
  if ((state.inventory[meta.inventoryKey] ?? 0) < 1) {
    return { ...state, unlockedToast: `No ${meta.label} in inventory — craft one` }
  }

  if (tool === 'drill' && !tile.ore) {
    return { ...state, unlockedToast: 'Drills must be placed on an ore patch' }
  }

  let inventory = spend(state.inventory, { [meta.inventoryKey]: 1 })
  const ent = createEntity(tool, x, y, state.placeDir)

  // Auto-fuel new drills from inventory
  if (tool === 'drill') {
    const fuel = Math.min(5, inventory.coal)
    if (fuel > 0) {
      inventory = spend(inventory, { coal: fuel })
      ent.store.coal = fuel
    }
  }

  tile.entityId = ent.id
  return {
    ...state,
    tiles,
    entities: { ...state.entities, [ent.id]: ent },
    inventory,
  }
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

/** Feed coal from player inventory into all drills that are empty */
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

/**
 * Before mining, allow drills to sip 1 coal from player inventory if empty
 * so step cycles aren't soft-locked.
 */
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
  // Every step = one mining cycle for each drill
  next = runMineCycles(next, add)
  next = addXp(next, Math.floor(add / 400))
  return next
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
  return addXp(next, Math.round(reward.xp * streakMult))
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
  const recipe = HAND_RECIPES.find((r) => r.id === recipeId)
  if (!recipe) return state
  if (!canAfford(state.inventory, recipe.inputs)) return state
  let next = {
    ...state,
    inventory: gain(spend(state.inventory, recipe.inputs), recipe.outputs),
  }
  next = addXp(next, 2)
  return next
}

/** Pull all items from a chest into player inventory */
export function collectChest(state: GameState, x: number, y: number): GameState {
  const tile = getTile(state.tiles, x, y)
  if (!tile?.entityId) return state
  const ent = state.entities[tile.entityId]
  if (!ent || ent.kind !== 'chest') return state
  return {
    ...state,
    inventory: gain(state.inventory, ent.store as Partial<typeof state.inventory>),
    entities: {
      ...state.entities,
      [ent.id]: { ...ent, store: {} },
    },
    unlockedToast: 'Collected chest contents',
  }
}

/** Manually load coal into drills from inventory */
export function fuelAllDrills(state: GameState): GameState {
  const next = topUpDrillFuel(state)
  return { ...next, unlockedToast: 'Fueled burner drills from inventory' }
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

export { HAND_RECIPES, MACHINE_CAP, addToStore, takeFromStore }
