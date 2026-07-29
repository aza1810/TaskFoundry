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

export type OreId = 'ironOre' | 'copperOre' | 'coal'

export type Dir = 'N' | 'E' | 'S' | 'W'

export type EntityKind = 'drill' | 'belt' | 'inserter' | 'furnace' | 'chest'

export type HabitCategory = 'mining' | 'smelting' | 'assembly' | 'logistics'

export interface Habit {
  id: string
  title: string
  category: HabitCategory
  streak: number
  completedToday: boolean
  lastCompletedDate: string | null
}

/** Items sitting on a belt tile */
export interface BeltCargo {
  item: ItemId
  /** 0..1 progress toward the next tile */
  progress: number
}

export interface Entity {
  id: string
  kind: EntityKind
  x: number
  y: number
  /** Output / facing direction */
  dir: Dir
  /** Shared storage for chests, drill output, furnace slots */
  store: Partial<Record<ItemId, number>>
  /** Furnace smelt progress 0..1 */
  progress: number
  /** Current furnace recipe target ore */
  smelting: OreId | null
  cargo: BeltCargo | null
}

export interface Tile {
  ore: OreId | null
  /** Remaining ore; null = infinite patch */
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
}

export type Placeable = Extract<
  EntityKind,
  'drill' | 'belt' | 'inserter' | 'furnace' | 'chest'
>

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
}

export type TabId = 'factory' | 'habits' | 'steps' | 'craft'
