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
  | 'longInserter'
  | 'drill'
  | 'electricDrill'
  | 'furnace'
  | 'steelFurnace'
  | 'chest'
  | 'assembler'
  | 'splitter'
  | 'roboport'
  | 'wood'
  | 'generator'
  | 'stone'
  | 'foundation'

export type OreId = 'ironOre' | 'copperOre' | 'coal'

export type Dir = 'N' | 'E' | 'S' | 'W'

export type TreeVariantId = 'pine' | 'oak' | 'birch' | 'deadwood'
export type RockVariantId =
  | 'stone'
  | 'boulder'
  | 'ironVein'
  | 'copperVein'
  | 'coalSeam'
  | 'pebble'

export type EntityKind =
  | 'drill'
  | 'electricDrill'
  | 'belt'
  | 'fastBelt'
  | 'undergroundBelt'
  | 'inserter'
  | 'longInserter'
  | 'furnace'
  | 'steelFurnace'
  | 'chest'
  | 'assembler'
  | 'splitter'
  | 'roboport'
  | 'tree'
  | 'rock'
  | 'generator'

export type TechId =
  | 'automation'
  | 'logistics'
  | 'logistics2'
  | 'electricMining'
  | 'splitters'
  | 'undergroundBelts'
  | 'steelProcessing'
  | 'longInserters'
  | 'storage'
  | 'storage2'

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
  /** 2x2 drills: which facing-edge tile dumps ore (false = primary / "top"). */
  flip?: boolean
  /** True while this is an unbuilt construction site awaiting a drone. */
  ghost?: boolean
  /** Drone build progress 0..1 while a ghost is being assembled (or a tree cut). */
  buildProgress?: number
  /** Tree/rock: flagged for a drone to chop down / excavate. */
  marked?: boolean
  /** Tree or rock variety. Missing means pine / stone (legacy saves). */
  variant?: TreeVariantId | RockVariantId
}

export type DroneState = 'idle' | 'toSite' | 'building' | 'returning'

/** A construction drone that flies out from a roboport to build ghosts. */
export interface Drone {
  id: string
  /** Roboport entity id this drone returns to. */
  homeId: string
  /** Current position in tile coordinates (floats for smooth flight). */
  x: number
  y: number
  state: DroneState
  /** Ghost entity id currently assigned, if any. */
  targetId: string | null
  /** Progress 0..1 while assembling the current ghost. */
  buildProgress: number
}

export interface Tile {
  ore: OreId | null
  amount: number | null
  entityId: string | null
  /** Concrete floor. Machines (except drills) need this connected to a generator. */
  foundation?: boolean
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
  longInserter: number
  drill: number
  electricDrill: number
  furnace: number
  steelFurnace: number
  chest: number
  assembler: number
  splitter: number
  roboport: number
  wood: number
  generator: number
  stone: number
  foundation: number
}

/** Buildings that occupy tiles as entities. Foundation is a floor flag, not an entity. */
export type EntityPlaceable = Extract<
  EntityKind,
  | 'drill'
  | 'electricDrill'
  | 'belt'
  | 'fastBelt'
  | 'undergroundBelt'
  | 'inserter'
  | 'longInserter'
  | 'furnace'
  | 'steelFurnace'
  | 'chest'
  | 'assembler'
  | 'splitter'
  | 'roboport'
  | 'generator'
>

export type Placeable = EntityPlaceable | 'foundation'

export type ToolId = Placeable | 'remove' | 'copy' | 'paste' | 'rotate' | 'flip'

export interface BlueprintEntity {
  kind: EntityPlaceable
  dx: number
  dy: number
  dir: Dir
  toggle?: number
  flip?: boolean
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

/** Shown once after returning from a long absence (not persisted). */
export interface OfflineReport {
  awaySeconds: number
  simulatedSeconds: number
  capped: boolean
  platesSmelted: number
  gearsMade: number
  itemsMoved: number
  craftsFinished: number
  /** Steps applied from Health during this return (drills mine on these). */
  stepsSynced: number
  /** Net item gains across inventory + machine stores + belt cargo */
  itemGains: Partial<Record<ItemId, number>>
}

export type SkillId =
  | 'mining'
  | 'smelting'
  | 'logistics'
  | 'assembly'
  | 'fieldwork'

export interface SkillState {
  xp: number
  level: number
}

export type SkillsState = Record<SkillId, SkillState>

export interface ContractState {
  id: string
  kind:
    | 'stepsToday'
    | 'oreMined'
    | 'platesSmelted'
    | 'gearsMade'
    | 'habitsToday'
    | 'mineCycles'
  title: string
  detail: string
  amount: number
  baseline: number
  reward: Partial<Inventory>
  rewardLabel: string
  claimed: boolean
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
  /** Construction drones tied to placed roboports. */
  drones: Drone[]
  inventory: Inventory
  habits: Habit[]
  stepsToday: number
  stepsLifetime: number
  stepsDate: string
  /** Watermark: health/Fit steps already imported into the game today */
  healthImportedToday: number
  healthImportDate: string
  mineCycles: number
  selected: ToolId | null
  placeDir: Dir
  /** Drill output lane while placing (false = primary / top of the facing edge). */
  placeFlip: boolean
  lastTick: number
  totalHabitsCompleted: number
  unlockedToast: string | null
  /** Ephemeral - set after offline catch-up, cleared by the player, not saved */
  offlineReport: OfflineReport | null
  stats: FactoryStats
  completedGoals: string[]
  tipIndex: number
  craftQueue: CraftJob[]
  researched: TechId[]
  blueprint: BlueprintEntity[] | null
  /** First corner while copying */
  copyCorner: { x: number; y: number } | null
  skills: SkillsState
  /** Latest skill XP from a step batch (UI pulse) */
  lastSkillGains: Partial<Record<SkillId, number>> | null
  /** Up to 2 skills getting bonus step XP */
  focusSkills: SkillId[]
  contractsDate: string
  contracts: ContractState[]
  /** null = finished or not started after complete; 0+ = active step index */
  tutorialStep: number | null
  tutorialComplete: boolean
  /** One-time flag so map trees are scattered once (and not respawned each load). */
  treesSeeded: boolean
  /** One-time flag so map rocks are scattered once (and not respawned each load). */
  rocksSeeded: boolean
  /** Stored electrical energy. Steps charge it; electric machines drain it. */
  power: number
}

export type TabId =
  | 'factory'
  | 'inventory'
  | 'habits'
  | 'steps'
  | 'craft'
  | 'research'
  | 'skills'
  | 'settings'
