export type ItemId =
  | 'ironOre'
  | 'copperOre'
  | 'coal'
  | 'ironPlate'
  | 'copperPlate'
  | 'gear'
  | 'belt'
  | 'inserter'
  | 'drill'
  | 'furnace'
  | 'chest'
  | 'assembler'

export type OreId = 'ironOre' | 'copperOre' | 'coal'

export type Dir = 'N' | 'E' | 'S' | 'W'

export type EntityKind =
  | 'drill'
  | 'belt'
  | 'inserter'
  | 'furnace'
  | 'chest'
  | 'assembler'

export type HabitCategory = 'mining' | 'smelting' | 'assembly' | 'logistics'

export interface Habit {
  id: string
  title: string
  category: HabitCategory
  streak: number
  completedToday: boolean
  lastCompletedDate: string | null
}

export interface BeltCargo {
  item: ItemId
  progress: number
}

export interface Entity {
  id: string
  kind: EntityKind
  x: number
  y: number
  dir: Dir
  store: Partial<Record<ItemId, number>>
  progress: number
  smelting: OreId | null
  cargo: BeltCargo | null
}

export interface Tile {
  ore: OreId | null
  amount: number | null
  entityId: string | null
}

export interface Inventory {
  ironOre: number
  copperOre: number
  coal: number
  ironPlate: number
  copperPlate: number
  gear: number
  belt: number
  inserter: number
  drill: number
  furnace: number
  chest: number
  assembler: number
}

export type Placeable = Extract<
  EntityKind,
  'drill' | 'belt' | 'inserter' | 'furnace' | 'chest' | 'assembler'
>

export interface CraftJob {
  id: string
  recipeId: string
  /** Elapsed seconds */
  elapsed: number
  /** Total seconds required */
  duration: number
}

export interface FactoryStats {
  oreMined: number
  platesSmelted: number
  gearsMade: number
  itemsMoved: number
}

export interface GameState {
  version: number
  playerName: string
  level: number
  xp: number
  width: number
  height: number
  tiles: Tile[]
  entities: Record<string, Entity>
  inventory: Inventory
  habits: Habit[]
  stepsToday: number
  stepsLifetime: number
  stepsDate: string
  mineCycles: number
  selected: Placeable | 'remove' | null
  placeDir: Dir
  lastTick: number
  totalHabitsCompleted: number
  unlockedToast: string | null
  stats: FactoryStats
  completedGoals: string[]
  tipIndex: number
  /** Hand-crafting bench queue (inputs already spent) */
  craftQueue: CraftJob[]
}

export type TabId = 'factory' | 'habits' | 'steps' | 'craft'
