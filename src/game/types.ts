export type ResourceId =
  | 'ironOre'
  | 'copperOre'
  | 'coal'
  | 'ironPlate'
  | 'copperPlate'
  | 'steel'
  | 'gear'
  | 'copperCable'
  | 'circuit'
  | 'redScience'
  | 'greenScience'

export type RecipeId =
  | 'smeltIron'
  | 'smeltCopper'
  | 'makeSteel'
  | 'makeGear'
  | 'makeCable'
  | 'makeCircuit'
  | 'makeRedScience'
  | 'makeGreenScience'

export type BuildingId =
  | 'burnerDrill'
  | 'electricDrill'
  | 'stoneFurnace'
  | 'steelFurnace'
  | 'assembler1'
  | 'assembler2'
  | 'lab'

export type TechId =
  | 'automation'
  | 'logistics'
  | 'electronics'
  | 'steelProcessing'
  | 'advancedMaterial'
  | 'labEquipment'
  | 'massProduction'

export type HabitCategory = 'mining' | 'smelting' | 'assembly' | 'research' | 'logistics'

export interface Habit {
  id: string
  title: string
  category: HabitCategory
  streak: number
  completedToday: boolean
  lastCompletedDate: string | null
}

export interface Resources {
  ironOre: number
  copperOre: number
  coal: number
  ironPlate: number
  copperPlate: number
  steel: number
  gear: number
  copperCable: number
  circuit: number
  redScience: number
  greenScience: number
}

export interface Buildings {
  burnerDrill: number
  electricDrill: number
  stoneFurnace: number
  steelFurnace: number
  assembler1: number
  assembler2: number
  lab: number
}

export interface RecipeDef {
  id: RecipeId
  name: string
  inputs: Partial<Resources>
  outputs: Partial<Resources>
  seconds: number
  unlockTech?: TechId
  unlockLevel?: number
}

export interface BuildingDef {
  id: BuildingId
  name: string
  description: string
  cost: Partial<Resources>
  unlockTech?: TechId
  unlockLevel?: number
  /** Resources produced per second per building (idle mining) */
  produces?: Partial<Resources>
  /** If furnace/assembler, which recipes it can auto-run */
  autoKind?: 'smelt' | 'assemble' | 'research'
  craftSpeed: number
}

export interface TechDef {
  id: TechId
  name: string
  description: string
  cost: Partial<Pick<Resources, 'redScience' | 'greenScience'>>
  requires?: TechId[]
  unlockLevel?: number
}

export interface GameState {
  version: number
  playerName: string
  level: number
  xp: number
  resources: Resources
  buildings: Buildings
  researched: TechId[]
  researchProgress: Partial<Record<TechId, number>>
  activeResearch: TechId | null
  habits: Habit[]
  stepsToday: number
  stepsLifetime: number
  stepsDate: string
  assemblerRecipe: RecipeId | null
  furnaceRecipe: RecipeId | null
  craftQueue: { recipeId: RecipeId; progress: number } | null
  lastTick: number
  totalHabitsCompleted: number
  unlockedToast: string | null
}

export type TabId = 'habits' | 'steps' | 'factory' | 'research' | 'yard'
