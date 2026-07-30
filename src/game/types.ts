export type ItemId =
  | 'ironOre'
  | 'copperOre'
  | 'coal'
  | 'ironPlate'
  | 'copperPlate'
  | 'gear'
  | 'steel'
  | 'belt'
  | 'fastBelt'
  | 'undergroundBelt'
  | 'inserter'
  | 'drill'
  | 'electricDrill'
  | 'furnace'
  | 'steelFurnace'
  | 'chest'
  | 'assembler'
  | 'splitter'

export type OreId = 'ironOre' | 'copperOre' | 'coal'

export type Dir = 'N' | 'E' | 'S' | 'W'

export type EntityKind =
  | 'drill'
  | 'electricDrill'
  | 'belt'
  | 'fastBelt'
  | 'undergroundBelt'
  | 'inserter'
  | 'furnace'
  | 'steelFurnace'
  | 'chest'
  | 'assembler'
  | 'splitter'

export type TechId =
  | 'logistics2'
  | 'electricMining'
  | 'splitters'
  | 'undergroundBelts'
  | 'steelProcessing'

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
  /** Splitter output toggle / UG belt: 0=entrance, 1=exit */
  toggle?: number
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
  steel: number
  belt: number
  fastBelt: number
  undergroundBelt: number
  inserter: number
  drill: number
  electricDrill: number
  furnace: number
  steelFurnace: number
  chest: number
  assembler: number
  splitter: number
}

export type Placeable = Extract<
  EntityKind,
  | 'drill'
  | 'electricDrill'
  | 'belt'
  | 'fastBelt'
  | 'undergroundBelt'
  | 'inserter'
  | 'furnace'
  | 'steelFurnace'
  | 'chest'
  | 'assembler'
  | 'splitter'
>

export type ToolId = Placeable | 'remove' | 'copy' | 'paste'

export interface BlueprintEntity {
  kind: Placeable
  dx: number
  dy: number
  dir: Dir
  toggle?: number
}

export interface CraftJob {
  id: string
  recipeId: string
  elapsed: number
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
  selected: ToolId | null
  placeDir: Dir
  lastTick: number
  totalHabitsCompleted: number
  unlockedToast: string | null
  stats: FactoryStats
  completedGoals: string[]
  tipIndex: number
  craftQueue: CraftJob[]
  researched: TechId[]
  blueprint: BlueprintEntity[] | null
  /** First corner while copying */
  copyCorner: { x: number; y: number } | null
}

export type TabId = 'factory' | 'habits' | 'steps' | 'craft' | 'research'
