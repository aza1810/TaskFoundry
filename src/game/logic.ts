import {
  BUILDING_MAP,
  BUILDINGS,
  DEFAULT_HABITS,
  EMPTY_RESOURCES,
  GAME_VERSION,
  HABIT_REWARDS,
  RECIPE_MAP,
  RECIPES,
  SAVE_KEY,
  STEPS_PER_COAL,
  STEPS_PER_COPPER,
  STEPS_PER_IRON,
  TECH_MAP,
  TECHS,
  canAfford,
  gain,
  spend,
  todayKey,
  xpForLevel,
} from './data'
import type {
  BuildingId,
  GameState,
  Habit,
  HabitCategory,
  RecipeId,
  ResourceId,
  Resources,
  TechId,
} from './types'

export function createInitialState(): GameState {
  return {
    version: GAME_VERSION,
    playerName: 'Operator',
    level: 1,
    xp: 0,
    resources: {
      ...EMPTY_RESOURCES(),
      ironOre: 12,
      copperOre: 8,
      coal: 10,
      ironPlate: 5,
    },
    buildings: {
      burnerDrill: 0,
      electricDrill: 0,
      stoneFurnace: 0,
      steelFurnace: 0,
      assembler1: 0,
      assembler2: 0,
      lab: 0,
    },
    researched: [],
    researchProgress: {},
    activeResearch: null,
    habits: DEFAULT_HABITS(),
    stepsToday: 0,
    stepsLifetime: 0,
    stepsDate: todayKey(),
    assemblerRecipe: null,
    furnaceRecipe: 'smeltIron',
    craftQueue: null,
    lastTick: Date.now(),
    totalHabitsCompleted: 0,
    unlockedToast: null,
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
      resources: { ...EMPTY_RESOURCES(), ...parsed.resources },
      buildings: { ...createInitialState().buildings, ...parsed.buildings },
      habits: parsed.habits?.length ? parsed.habits : DEFAULT_HABITS(),
    }
  } catch {
    return createInitialState()
  }
}

export function saveState(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

function hasTech(state: GameState, id?: TechId): boolean {
  if (!id) return true
  return state.researched.includes(id)
}

export function isRecipeUnlocked(state: GameState, recipeId: RecipeId): boolean {
  const r = RECIPE_MAP[recipeId]
  if (!r) return false
  if (r.unlockLevel && state.level < r.unlockLevel) return false
  return hasTech(state, r.unlockTech)
}

export function isBuildingUnlocked(state: GameState, id: BuildingId): boolean {
  const b = BUILDING_MAP[id]
  if (!b) return false
  if (b.unlockLevel && state.level < b.unlockLevel) return false
  return hasTech(state, b.unlockTech)
}

export function isTechAvailable(state: GameState, id: TechId): boolean {
  const t = TECH_MAP[id]
  if (!t) return false
  if (state.researched.includes(id)) return false
  if (t.unlockLevel && state.level < t.unlockLevel) return false
  return (t.requires ?? []).every((req) => state.researched.includes(req))
}

function addXp(state: GameState, amount: number): GameState {
  let { xp, level } = state
  let toast = state.unlockedToast
  xp += amount
  let needed = xpForLevel(level)
  while (xp >= needed) {
    xp -= needed
    level += 1
    toast = `Level ${level} — new clearance unlocked`
    needed = xpForLevel(level)
  }
  return { ...state, xp, level, unlockedToast: toast }
}

function refreshDaily(state: GameState): GameState {
  const today = todayKey()
  if (state.stepsDate === today) {
    // Still reset habit completed flags if date on habit is stale
    const habits = state.habits.map((h) => {
      if (h.lastCompletedDate === today) return { ...h, completedToday: true }
      return { ...h, completedToday: false }
    })
    return { ...state, habits }
  }

  const habits = state.habits.map((h) => {
    let streak = 0
    if (h.lastCompletedDate) {
      const last = new Date(h.lastCompletedDate + 'T12:00:00')
      const diff = Math.floor(
        (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24),
      )
      streak = diff <= 1 ? h.streak : 0
    }
    return {
      ...h,
      completedToday: false,
      streak,
    }
  })

  return {
    ...state,
    habits,
    stepsToday: 0,
    stepsDate: today,
  }
}

function tryConsumeFractional(
  resources: Resources,
  inputs: Partial<Resources>,
): Resources | null {
  if (!canAfford(resources, inputs)) return null
  return spend(resources, inputs)
}

function runAutoCraft(
  state: GameState,
  recipeId: RecipeId,
  speed: number,
  dt: number,
): GameState {
  if (!isRecipeUnlocked(state, recipeId)) return state
  const recipe = RECIPE_MAP[recipeId]
  if (!recipe || speed <= 0) return state

  const crafts = (dt * speed) / recipe.seconds
  if (crafts <= 0) return state

  // Craft as many whole+fractional as resources allow
  let resources = { ...state.resources }
  let crafted = 0
  const maxSteps = Math.min(Math.ceil(crafts), 200)
  const perCraft = crafts / Math.max(1, maxSteps)

  for (let i = 0; i < maxSteps; i++) {
    const portion = Math.min(perCraft, crafts - crafted)
    if (portion <= 0) break
    const scaledIn: Partial<Resources> = {}
    for (const [k, v] of Object.entries(recipe.inputs) as [ResourceId, number][]) {
      scaledIn[k] = v * portion
    }
    const next = tryConsumeFractional(resources, scaledIn)
    if (!next) break
    resources = gain(next, recipe.outputs, portion)
    crafted += portion
  }

  if (crafted <= 0) return state
  return { ...state, resources }
}

export function tickState(state: GameState, now = Date.now()): GameState {
  let next = refreshDaily(state)
  const dt = Math.min(60 * 60 * 8, Math.max(0, (now - next.lastTick) / 1000))
  next = { ...next, lastTick: now }
  if (dt < 0.05) return next

  // Mining buildings
  for (const b of BUILDINGS) {
    const count = next.buildings[b.id] ?? 0
    if (!count || !b.produces) continue
    const mult = count * dt
    // Burner drills consume a trickle of coal
    if (b.id === 'burnerDrill') {
      const coalNeed = 0.05 * mult
      if (next.resources.coal < coalNeed) continue
      next = {
        ...next,
        resources: spend(gain(next.resources, b.produces, mult), { coal: coalNeed }),
      }
    } else {
      next = { ...next, resources: gain(next.resources, b.produces, mult) }
    }
  }

  // Furnaces
  const furnaceSpeed =
    (next.buildings.stoneFurnace ?? 0) * BUILDING_MAP.stoneFurnace.craftSpeed +
    (next.buildings.steelFurnace ?? 0) * BUILDING_MAP.steelFurnace.craftSpeed
  if (furnaceSpeed > 0 && next.furnaceRecipe) {
    const recipe = RECIPE_MAP[next.furnaceRecipe]
    if (recipe && (!recipe.unlockTech || hasTech(next, recipe.unlockTech))) {
      if (recipe.id === 'smeltIron' || recipe.id === 'smeltCopper' || recipe.id === 'makeSteel') {
        next = runAutoCraft(next, recipe.id, furnaceSpeed, dt)
      }
    }
  }

  // Assemblers
  const assemblerSpeed =
    (next.buildings.assembler1 ?? 0) * BUILDING_MAP.assembler1.craftSpeed +
    (next.buildings.assembler2 ?? 0) * BUILDING_MAP.assembler2.craftSpeed
  if (assemblerSpeed > 0 && next.assemblerRecipe) {
    const recipe = RECIPE_MAP[next.assemblerRecipe]
    if (
      recipe &&
      recipe.id !== 'smeltIron' &&
      recipe.id !== 'smeltCopper' &&
      recipe.id !== 'makeSteel'
    ) {
      next = runAutoCraft(next, recipe.id, assemblerSpeed, dt)
    }
  }

  // Research: hand-study always crawls; labs accelerate
  const researching = next.activeResearch
  if (researching && !next.researched.includes(researching)) {
    const tech = TECH_MAP[researching]
    if (tech) {
      const labCount = next.buildings.lab ?? 0
      const progress = next.researchProgress[researching] ?? 0
      const redCost = tech.cost.redScience ?? 0
      const greenCost = tech.cost.greenScience ?? 0
      const totalNeeded = Math.max(1, redCost + greenCost)
      const resources = { ...next.resources }
      let gained = 0
      const rate = (0.08 + labCount * 0.15) * dt
      const redShare = redCost > 0 ? redCost / totalNeeded : 0
      const greenShare = greenCost > 0 ? greenCost / totalNeeded : 0

      if (redCost > 0) {
        const redUse = Math.min(resources.redScience, rate * (redShare || 1))
        resources.redScience -= redUse
        gained += redUse
      }
      if (greenCost > 0) {
        const greenUse = Math.min(resources.greenScience, rate * (greenShare || 1))
        resources.greenScience -= greenUse
        gained += greenUse
      }

      const researchProgress = { ...next.researchProgress }
      let researched = next.researched
      let activeResearch: TechId | null = researching
      let toast = next.unlockedToast
      const newProgress = progress + gained

      if (newProgress >= totalNeeded) {
        researched = [...researched, researching]
        delete researchProgress[researching]
        activeResearch = null
        toast = `Researched: ${tech.name}`
        next = addXp(
          {
            ...next,
            resources,
            researched,
            activeResearch,
            researchProgress,
            unlockedToast: toast,
          },
          40,
        )
      } else {
        researchProgress[researching] = newProgress
        next = {
          ...next,
          resources,
          researched,
          activeResearch,
          researchProgress,
          unlockedToast: toast,
        }
      }
    }
  }

  // Manual craft queue
  if (next.craftQueue) {
    const recipe = RECIPE_MAP[next.craftQueue.recipeId]
    if (recipe) {
      let progress = next.craftQueue.progress + dt
      if (progress >= recipe.seconds) {
        if (canAfford(next.resources, recipe.inputs)) {
          next = {
            ...next,
            resources: gain(spend(next.resources, recipe.inputs), recipe.outputs),
            craftQueue: null,
          }
          next = addXp(next, 3)
        } else {
          next = { ...next, craftQueue: null }
        }
      } else {
        next = { ...next, craftQueue: { ...next.craftQueue, progress } }
      }
    }
  }

  return next
}

export function completeHabit(state: GameState, habitId: string): GameState {
  let next = refreshDaily(state)
  const habit = next.habits.find((h) => h.id === habitId)
  if (!habit || habit.completedToday) return next

  const reward = HABIT_REWARDS[habit.category]
  const streak = habit.streak + 1
  const streakMult = 1 + Math.min(0.5, (streak - 1) * 0.05)
  const advanced = next.researched.includes('advancedMaterial') ? 1.25 : 1

  const habits = next.habits.map((h) =>
    h.id === habitId
      ? {
          ...h,
          completedToday: true,
          streak,
          lastCompletedDate: todayKey(),
        }
      : h,
  )

  next = {
    ...next,
    habits,
    resources: gain(next.resources, reward.resources, streakMult),
    totalHabitsCompleted: next.totalHabitsCompleted + 1,
  }
  next = addXp(next, Math.round(reward.xp * streakMult * advanced))
  return next
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

export function logSteps(state: GameState, amount: number): GameState {
  let next = refreshDaily(state)
  const add = Math.max(0, Math.floor(amount))
  if (add <= 0) return next

  const before = next.stepsToday
  const after = before + add
  const iron = Math.floor(after / STEPS_PER_IRON) - Math.floor(before / STEPS_PER_IRON)
  const copper =
    Math.floor(after / STEPS_PER_COPPER) - Math.floor(before / STEPS_PER_COPPER)
  const coal = Math.floor(after / STEPS_PER_COAL) - Math.floor(before / STEPS_PER_COAL)

  next = {
    ...next,
    stepsToday: after,
    stepsLifetime: next.stepsLifetime + add,
    resources: gain(next.resources, {
      ironOre: iron,
      copperOre: copper,
      coal,
    }),
  }
  next = addXp(next, Math.floor(add / 500) + (iron + copper + coal > 0 ? 2 : 0))
  return next
}

export function startManualCraft(state: GameState, recipeId: RecipeId): GameState {
  if (!isRecipeUnlocked(state, recipeId)) return state
  if (state.craftQueue) return state
  const recipe = RECIPE_MAP[recipeId]
  if (!recipe || !canAfford(state.resources, recipe.inputs)) return state
  return {
    ...state,
    craftQueue: { recipeId, progress: 0 },
  }
}

export function buyBuilding(state: GameState, id: BuildingId): GameState {
  if (!isBuildingUnlocked(state, id)) return state
  const def = BUILDING_MAP[id]
  if (!canAfford(state.resources, def.cost)) return state
  return {
    ...state,
    resources: spend(state.resources, def.cost),
    buildings: {
      ...state.buildings,
      [id]: (state.buildings[id] ?? 0) + 1,
    },
  }
}

export function setFurnaceRecipe(state: GameState, recipeId: RecipeId): GameState {
  return { ...state, furnaceRecipe: recipeId }
}

export function setAssemblerRecipe(state: GameState, recipeId: RecipeId | null): GameState {
  return { ...state, assemblerRecipe: recipeId }
}

export function startResearch(state: GameState, id: TechId): GameState {
  if (!isTechAvailable(state, id)) return state
  return { ...state, activeResearch: id }
}

export function clearToast(state: GameState): GameState {
  return { ...state, unlockedToast: null }
}

export function resetGame(): GameState {
  localStorage.removeItem(SAVE_KEY)
  return createInitialState()
}

export function productionRates(state: GameState): Partial<Resources> {
  const rates: Partial<Resources> = {}
  for (const b of BUILDINGS) {
    const count = state.buildings[b.id] ?? 0
    if (!count || !b.produces) continue
    for (const [k, v] of Object.entries(b.produces) as [ResourceId, number][]) {
      rates[k] = (rates[k] ?? 0) + v * count
    }
  }
  return rates
}

export { RECIPES, TECHS, BUILDINGS }
