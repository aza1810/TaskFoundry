import type {
  Dir,
  EntityKind,
  Habit,
  Inventory,
  ItemId,
  OreId,
  Placeable,
} from './types'

export const SAVE_KEY = 'task-foundry-v9'
export const GAME_VERSION = 9
export const APP_NAME = 'Task Foundry'
export const APP_TAGLINE = 'Walk. Task. Automate.'
/** Overridden per signed-in account at runtime */
export let ACTIVE_SAVE_KEY = SAVE_KEY

export function setActiveSaveKey(key: string): void {
  ACTIVE_SAVE_KEY = key
}
export const GRID_W = 24
export const GRID_H = 16
export const MAX_CRAFT_QUEUE = 8
/** Factory keeps running while away (seconds) - max 24 hours */
export const OFFLINE_CAP_SECONDS = 24 * 60 * 60
/** Show the away summary when the gap is longer than this */
export const OFFLINE_REPORT_SECONDS = 30
export const FAST_BELT_MULT = 2.2
export const ELECTRIC_DRILL_YIELD = 2
export const MAX_UNDERGROUND = 6
export const STEEL_FURNACE_MULT = 2

export const DIRS: Dir[] = ['N', 'E', 'S', 'W']

export const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
}

export const OPPOSITE: Record<Dir, Dir> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
}

export const ITEM_META: Record<
  ItemId,
  { label: string; short: string; color: string }
> = {
  ironOre: { label: 'Iron Ore', short: 'Fe', color: '#8B7355' },
  copperOre: { label: 'Copper Ore', short: 'Cu', color: '#C4783A' },
  coal: { label: 'Coal', short: 'C', color: '#2A2A2A' },
  ironPlate: { label: 'Iron Plate', short: 'Fe□', color: '#A8B0BC' },
  copperPlate: { label: 'Copper Plate', short: 'Cu□', color: '#E8913A' },
  gear: { label: 'Iron Gear', short: '⚙', color: '#9AA3AD' },
  steel: { label: 'Steel Plate', short: 'St', color: '#5C6B7A' },
  belt: { label: 'Transport Belt', short: '═', color: '#F0A020' },
  fastBelt: { label: 'Fast Belt', short: '≡', color: '#E05050' },
  undergroundBelt: { label: 'Underground Belt', short: '⊓', color: '#c4783a' },
  inserter: { label: 'Inserter', short: '↕', color: '#3D8BFD' },
  longInserter: { label: 'Long Inserter', short: '↕↕', color: '#e07040' },
  drill: { label: 'Burner Drill', short: '⛏', color: '#6B5535' },
  electricDrill: { label: 'Electric Drill', short: '⚡', color: '#3D9E5F' },
  furnace: { label: 'Stone Furnace', short: '▲', color: '#8A4B1A' },
  steelFurnace: { label: 'Steel Furnace', short: '▲▲', color: '#4a5560' },
  chest: { label: 'Iron Chest', short: '▣', color: '#5C6B7A' },
  assembler: { label: 'Assembling Machine', short: '⧉', color: '#4a6a8a' },
  splitter: { label: 'Splitter', short: '⇔', color: '#c4a035' },
}

export const PLACEABLE_META: Record<
  Placeable,
  { label: string; inventoryKey: Placeable; hint: string }
> = {
  drill: {
    label: 'Burner Drill',
    inventoryKey: 'drill',
    hint: 'Place on ore. Each step = one mine cycle. Needs coal.',
  },
  electricDrill: {
    label: 'Electric Drill',
    inventoryKey: 'electricDrill',
    hint: 'No coal. Mines 2 ore per step cycle.',
  },
  belt: {
    label: 'Transport Belt',
    inventoryKey: 'belt',
    hint: 'Moves items in the facing direction.',
  },
  fastBelt: {
    label: 'Fast Belt',
    inventoryKey: 'fastBelt',
    hint: 'About 2× yellow belt speed.',
  },
  undergroundBelt: {
    label: 'Underground Belt',
    inventoryKey: 'undergroundBelt',
    hint: 'Entrance tunnels to an exit up to 6 tiles ahead (same facing).',
  },
  inserter: {
    label: 'Inserter',
    inventoryKey: 'inserter',
    hint: 'Pulls from the dashed tile behind, drops on the solid tile in front.',
  },
  longInserter: {
    label: 'Long Inserter',
    inventoryKey: 'longInserter',
    hint: 'Reaches 2 tiles behind and 2 tiles ahead.',
  },
  furnace: {
    label: 'Stone Furnace',
    inventoryKey: 'furnace',
    hint: 'Smelts ore + coal into plates.',
  },
  steelFurnace: {
    label: 'Steel Furnace',
    inventoryKey: 'steelFurnace',
    hint: 'Twice as fast as stone furnaces.',
  },
  chest: {
    label: 'Iron Chest',
    inventoryKey: 'chest',
    hint: '4 slots, 100 per stack. Drills can dump in; belts need an inserter.',
  },
  assembler: {
    label: 'Assembling Machine',
    inventoryKey: 'assembler',
    hint: 'Crafts gears from iron plates automatically.',
  },
  splitter: {
    label: 'Splitter',
    inventoryKey: 'splitter',
    hint: 'Alternates items forward and to the right.',
  },
}

export const BUILD_COST: Record<Placeable, Partial<Inventory>> = {
  belt: { ironPlate: 1 },
  fastBelt: { ironPlate: 2, gear: 1 },
  undergroundBelt: { ironPlate: 4, gear: 2 },
  inserter: { ironPlate: 1, gear: 1 },
  longInserter: { ironPlate: 2, gear: 2, inserter: 1 },
  drill: { ironPlate: 3, gear: 2, coal: 2 },
  electricDrill: { ironPlate: 5, gear: 3, copperPlate: 4 },
  furnace: { ironPlate: 5 },
  steelFurnace: { steel: 6, ironPlate: 8, gear: 4 },
  chest: { ironPlate: 4 },
  assembler: { ironPlate: 6, gear: 4, copperPlate: 2 },
  splitter: { ironPlate: 4, gear: 4, copperPlate: 2 },
}

export type HandRecipe = {
  id: string
  name: string
  inputs: Partial<Inventory>
  outputs: Partial<Inventory>
  handSeconds: number
  machineSeconds?: number
  machineLabel?: string
  category: 'smelt' | 'part' | 'building'
  requiresTech?: import('./types').TechId
}

export const HAND_RECIPES: HandRecipe[] = [
  {
    id: 'smeltIron',
    name: 'Hand-smelt Iron Plate',
    inputs: { ironOre: 1, coal: 1 },
    outputs: { ironPlate: 1 },
    handSeconds: 8,
    machineSeconds: 2.4,
    machineLabel: 'Stone furnace',
    category: 'smelt',
  },
  {
    id: 'smeltCopper',
    name: 'Hand-smelt Copper Plate',
    inputs: { copperOre: 1, coal: 1 },
    outputs: { copperPlate: 1 },
    handSeconds: 8,
    machineSeconds: 2.4,
    machineLabel: 'Stone furnace',
    category: 'smelt',
  },
  {
    id: 'gear',
    name: 'Cut Iron Gear',
    inputs: { ironPlate: 2 },
    outputs: { gear: 1 },
    handSeconds: 5,
    machineSeconds: 1.6,
    machineLabel: 'Assembler',
    category: 'part',
  },
  {
    id: 'craftBelt',
    name: 'Craft Transport Belt',
    inputs: { ironPlate: 1 },
    outputs: { belt: 1 },
    handSeconds: 2.5,
    category: 'building',
  },
  {
    id: 'craftInserter',
    name: 'Craft Inserter',
    inputs: { ironPlate: 1, gear: 1 },
    outputs: { inserter: 1 },
    handSeconds: 4.5,
    category: 'building',
  },
  {
    id: 'craftDrill',
    name: 'Craft Burner Drill',
    inputs: { ironPlate: 3, gear: 2, coal: 2 },
    outputs: { drill: 1 },
    handSeconds: 12,
    category: 'building',
  },
  {
    id: 'craftFurnace',
    name: 'Craft Stone Furnace',
    inputs: { ironPlate: 5 },
    outputs: { furnace: 1 },
    handSeconds: 9,
    category: 'building',
  },
  {
    id: 'craftChest',
    name: 'Craft Iron Chest',
    inputs: { ironPlate: 4 },
    outputs: { chest: 1 },
    handSeconds: 6,
    category: 'building',
  },
  {
    id: 'craftAssembler',
    name: 'Craft Assembling Machine',
    inputs: { ironPlate: 6, gear: 4, copperPlate: 2 },
    outputs: { assembler: 1 },
    handSeconds: 16,
    category: 'building',
  },
  {
    id: 'craftFastBelt',
    name: 'Craft Fast Belt',
    inputs: { ironPlate: 2, gear: 1 },
    outputs: { fastBelt: 1 },
    handSeconds: 3.5,
    category: 'building',
    requiresTech: 'logistics2',
  },
  {
    id: 'craftElectricDrill',
    name: 'Craft Electric Drill',
    inputs: { ironPlate: 5, gear: 3, copperPlate: 4 },
    outputs: { electricDrill: 1 },
    handSeconds: 14,
    category: 'building',
    requiresTech: 'electricMining',
  },
  {
    id: 'craftSplitter',
    name: 'Craft Splitter',
    inputs: { ironPlate: 4, gear: 4, copperPlate: 2 },
    outputs: { splitter: 1 },
    handSeconds: 10,
    category: 'building',
    requiresTech: 'splitters',
  },
  {
    id: 'craftLongInserter',
    name: 'Craft Long Inserter',
    inputs: { ironPlate: 2, gear: 2, inserter: 1 },
    outputs: { longInserter: 1 },
    handSeconds: 6,
    category: 'building',
    requiresTech: 'longInserters',
  },
  {
    id: 'craftUgBelt',
    name: 'Craft Underground Belt',
    inputs: { ironPlate: 4, gear: 2 },
    outputs: { undergroundBelt: 2 },
    handSeconds: 5,
    category: 'building',
    requiresTech: 'undergroundBelts',
  },
  {
    id: 'craftSteel',
    name: 'Forge Steel Plate',
    inputs: { ironPlate: 5, coal: 2 },
    outputs: { steel: 1 },
    handSeconds: 12,
    category: 'smelt',
    requiresTech: 'steelProcessing',
  },
  {
    id: 'craftSteelFurnace',
    name: 'Craft Steel Furnace',
    inputs: { steel: 6, ironPlate: 8, gear: 4 },
    outputs: { steelFurnace: 1 },
    handSeconds: 14,
    machineSeconds: 1.2,
    machineLabel: 'Steel furnace smelt',
    category: 'building',
    requiresTech: 'steelProcessing',
  },
]

export const RECIPE_MAP = Object.fromEntries(
  HAND_RECIPES.map((r) => [r.id, r]),
) as Record<string, HandRecipe>

export const SMELT_MAP: Record<OreId, ItemId> = {
  ironOre: 'ironPlate',
  copperOre: 'copperPlate',
  coal: 'coal', // unused
}

export const FURNACE_INPUT_ORES: OreId[] = ['ironOre', 'copperOre']
export const FURNACE_COAL_PER_SMELT = 1
export const FURNACE_SECONDS = 2.4
export const STEEL_FURNACE_SECONDS = FURNACE_SECONDS / STEEL_FURNACE_MULT
/** Dedicated coal fuel buffer (separate from ore/plate slots). */
export const FURNACE_FUEL_CAP = 5
/** Ore input / plate output slot capacity per furnace. */
export const FURNACE_SLOT_CAP = 12
export const ASSEMBLER_SECONDS = 1.6
export const ASSEMBLER_PLATES_PER_GEAR = 2
/** Assembler iron-plate input / gear output capacity. */
export const ASSEMBLER_SLOT_CAP = 12
/** Distinct item types a chest can hold at once. */
export const CHEST_SLOT_COUNT = 4
/** Max count per item type in a chest slot. */
export const CHEST_STACK_SIZE = 100
/** Floor chests allowed before furnace unlock / storage research. */
export const BASE_MAX_CHESTS = 1
/** After placing a furnace (goal), you may place this many chests. */
export const FURNACE_UNLOCK_MAX_CHESTS = 2
export const BELT_SPEED = 1.8 // tiles per second
export const FAST_BELT_SPEED = BELT_SPEED * FAST_BELT_MULT
/** Seconds between inserter transfers at logistics 0. Slow enough to read the swing. */
export const INSERTER_COOLDOWN = 1.2

export function inserterCooldownFor(speedMult = 1): number {
  return INSERTER_COOLDOWN / Math.max(0.01, speedMult)
}

export const EMPTY_INVENTORY = (): Inventory => ({
  ironOre: 8,
  copperOre: 4,
  coal: 12,
  ironPlate: 10,
  copperPlate: 2,
  gear: 4,
  steel: 0,
  belt: 20,
  fastBelt: 0,
  undergroundBelt: 0,
  inserter: 8,
  longInserter: 0,
  drill: 2,
  electricDrill: 0,
  furnace: 2,
  steelFurnace: 0,
  chest: 2,
  assembler: 1,
  splitter: 0,
})

export const DEFAULT_HABITS = (): Habit[] => [
  {
    id: 'h-water',
    title: 'Drink water',
    category: 'logistics',
    streak: 0,
    completedToday: false,
    lastCompletedDate: null,
  },
  {
    id: 'h-move',
    title: 'Move for 10 minutes',
    category: 'mining',
    streak: 0,
    completedToday: false,
    lastCompletedDate: null,
  },
  {
    id: 'h-focus',
    title: 'One deep-focus block',
    category: 'assembly',
    streak: 0,
    completedToday: false,
    lastCompletedDate: null,
  },
  {
    id: 'h-stretch',
    title: 'Stretch / mobility',
    category: 'smelting',
    streak: 0,
    completedToday: false,
    lastCompletedDate: null,
  },
]

export const HABIT_REWARDS: Record<
  Habit['category'],
  { items: Partial<Inventory>; xp: number }
> = {
  mining: { items: { ironOre: 6, copperOre: 3, coal: 2 }, xp: 12 },
  smelting: { items: { coal: 5, ironOre: 2 }, xp: 14 },
  assembly: { items: { ironPlate: 2, gear: 1 }, xp: 18 },
  logistics: { items: { belt: 2, inserter: 1 }, xp: 10 },
}

export const XP_PER_LEVEL_BASE = 100

export function xpForLevel(level: number): number {
  return Math.floor(XP_PER_LEVEL_BASE * Math.pow(1.35, level - 1))
}

export function titleForLevel(level: number): string {
  if (level >= 20) return 'Foundry Magnate'
  if (level >= 15) return 'Chief Foundrywright'
  if (level >= 10) return 'Shift Superintendent'
  if (level >= 7) return 'Senior Line Boss'
  if (level >= 4) return 'Floor Operator'
  if (level >= 2) return 'Apprentice Smelter'
  return 'Greenhorn'
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function idx(x: number, y: number, w = GRID_W): number {
  return y * w + x
}

export function inBounds(x: number, y: number, w = GRID_W, h = GRID_H): boolean {
  return x >= 0 && y >= 0 && x < w && y < h
}

export function rotateDir(dir: Dir, cw = true): Dir {
  const i = DIRS.indexOf(dir)
  return DIRS[(i + (cw ? 1 : 3)) % 4]
}

/** Inventory / placeable counts are always whole items. */
export function asItemCount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n + 1e-9)
}

export function sanitizeInventory(inv: Inventory): Inventory {
  const next = { ...inv }
  for (const key of Object.keys(next) as (keyof Inventory)[]) {
    next[key] = asItemCount(next[key])
  }
  return next
}

export function canAfford(
  have: Inventory,
  cost: Partial<Inventory>,
): boolean {
  return (Object.entries(cost) as [keyof Inventory, number][]).every(
    ([k, n]) => asItemCount(have[k]) >= asItemCount(n),
  )
}

export function spend(have: Inventory, cost: Partial<Inventory>): Inventory {
  const next = { ...have }
  for (const [k, n] of Object.entries(cost) as [keyof Inventory, number][]) {
    next[k] = Math.max(0, asItemCount(next[k]) - asItemCount(n))
  }
  return next
}

export function gain(have: Inventory, add: Partial<Inventory>, mult = 1): Inventory {
  const next = { ...have }
  for (const [k, n] of Object.entries(add) as [keyof Inventory, number][]) {
    // Habit/skill multipliers must still yield whole items (round half-up via floor+0.5)
    const amount = asItemCount(Math.round(n * mult))
    next[k] = asItemCount(next[k]) + amount
  }
  return next
}

export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const whole = asItemCount(n)
  if (whole >= 10_000) return `${(whole / 1_000).toFixed(1)}k`
  return String(whole)
}

export function storeTotal(store: Partial<Record<ItemId, number>>): number {
  return Object.values(store).reduce((a, b) => a + (b ?? 0), 0)
}

export function entityGlyph(kind: EntityKind, dir: Dir): string {
  if (kind === 'belt' || kind === 'fastBelt') {
    return dir === 'N' || dir === 'S' ? '║' : '═'
  }
  if (kind === 'undergroundBelt') return '⊓'
  if (kind === 'inserter' || kind === 'longInserter') return '↕'
  if (kind === 'drill' || kind === 'electricDrill') return '⛏'
  if (kind === 'furnace' || kind === 'steelFurnace') return '▲'
  if (kind === 'assembler') return '⧉'
  if (kind === 'splitter') return '⇔'
  return '▣'
}

export function isBeltKind(kind: EntityKind): boolean {
  return kind === 'belt' || kind === 'fastBelt'
}

export function isFurnaceKind(kind: EntityKind): boolean {
  return kind === 'furnace' || kind === 'steelFurnace'
}

export function isInserterKind(kind: EntityKind): boolean {
  return kind === 'inserter' || kind === 'longInserter'
}

export function isDrillKind(kind: EntityKind): boolean {
  return kind === 'drill' || kind === 'electricDrill'
}

export function beltSpeedFor(kind: EntityKind): number {
  return kind === 'fastBelt' ? FAST_BELT_SPEED : BELT_SPEED
}

export function furnaceSecondsFor(kind: EntityKind): number {
  return kind === 'steelFurnace' ? STEEL_FURNACE_SECONDS : FURNACE_SECONDS
}
