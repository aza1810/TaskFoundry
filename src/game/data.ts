import type {
  Dir,
  EntityKind,
  Habit,
  Inventory,
  ItemId,
  OreId,
  Placeable,
} from './types'

export const SAVE_KEY = 'habitworks-grid-v2'
export const GAME_VERSION = 2
export const GRID_W = 18
export const GRID_H = 12

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
  belt: { label: 'Transport Belt', short: '═', color: '#F0A020' },
  inserter: { label: 'Inserter', short: '↕', color: '#3D8BFD' },
  drill: { label: 'Burner Drill', short: '⛏', color: '#6B5535' },
  furnace: { label: 'Stone Furnace', short: '▲', color: '#8A4B1A' },
  chest: { label: 'Iron Chest', short: '▣', color: '#5C6B7A' },
}

export const PLACEABLE_META: Record<
  Placeable,
  { label: string; inventoryKey: Placeable; hint: string }
> = {
  drill: {
    label: 'Burner Drill',
    inventoryKey: 'drill',
    hint: 'Place on ore. Each step = one mine cycle.',
  },
  belt: {
    label: 'Transport Belt',
    inventoryKey: 'belt',
    hint: 'Moves items in the facing direction.',
  },
  inserter: {
    label: 'Inserter',
    inventoryKey: 'inserter',
    hint: 'Pulls from behind, drops in front.',
  },
  furnace: {
    label: 'Stone Furnace',
    inventoryKey: 'furnace',
    hint: 'Smelts ore + coal into plates.',
  },
  chest: {
    label: 'Iron Chest',
    inventoryKey: 'chest',
    hint: 'Stores items. Inserters load/unload it.',
  },
}

export const BUILD_COST: Record<Placeable, Partial<Inventory>> = {
  belt: { ironPlate: 1 },
  inserter: { ironPlate: 1, gear: 1 },
  drill: { ironPlate: 3, gear: 2, coal: 2 },
  furnace: { ironPlate: 5 },
  chest: { ironPlate: 4 },
}

export const HAND_RECIPES: {
  id: string
  name: string
  inputs: Partial<Inventory>
  outputs: Partial<Inventory>
}[] = [
  {
    id: 'smeltIron',
    name: 'Hand-smelt Iron Plate',
    inputs: { ironOre: 1, coal: 1 },
    outputs: { ironPlate: 1 },
  },
  {
    id: 'smeltCopper',
    name: 'Hand-smelt Copper Plate',
    inputs: { copperOre: 1, coal: 1 },
    outputs: { copperPlate: 1 },
  },
  {
    id: 'gear',
    name: 'Cut Iron Gear',
    inputs: { ironPlate: 2 },
    outputs: { gear: 1 },
  },
  {
    id: 'craftBelt',
    name: 'Craft Transport Belt',
    inputs: { ironPlate: 1 },
    outputs: { belt: 1 },
  },
  {
    id: 'craftInserter',
    name: 'Craft Inserter',
    inputs: { ironPlate: 1, gear: 1 },
    outputs: { inserter: 1 },
  },
  {
    id: 'craftDrill',
    name: 'Craft Burner Drill',
    inputs: { ironPlate: 3, gear: 2, coal: 2 },
    outputs: { drill: 1 },
  },
  {
    id: 'craftFurnace',
    name: 'Craft Stone Furnace',
    inputs: { ironPlate: 5 },
    outputs: { furnace: 1 },
  },
  {
    id: 'craftChest',
    name: 'Craft Iron Chest',
    inputs: { ironPlate: 4 },
    outputs: { chest: 1 },
  },
]

export const SMELT_MAP: Record<OreId, ItemId> = {
  ironOre: 'ironPlate',
  copperOre: 'copperPlate',
  coal: 'coal', // unused
}

export const FURNACE_INPUT_ORES: OreId[] = ['ironOre', 'copperOre']
export const FURNACE_COAL_PER_SMELT = 1
export const FURNACE_SECONDS = 2.4
export const BELT_SPEED = 1.8 // tiles per second
export const INSERTER_COOLDOWN = 0.45

export const EMPTY_INVENTORY = (): Inventory => ({
  ironOre: 8,
  copperOre: 4,
  coal: 12,
  ironPlate: 10,
  copperPlate: 0,
  gear: 4,
  belt: 12,
  inserter: 4,
  drill: 1,
  furnace: 1,
  chest: 1,
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
  if (level >= 20) return 'Factory Magnate'
  if (level >= 15) return 'Chief Engineer'
  if (level >= 10) return 'Plant Supervisor'
  if (level >= 7) return 'Senior Technician'
  if (level >= 4) return 'Line Operator'
  if (level >= 2) return 'Apprentice Fitter'
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

export function canAfford(
  have: Inventory,
  cost: Partial<Inventory>,
): boolean {
  return (Object.entries(cost) as [keyof Inventory, number][]).every(
    ([k, n]) => (have[k] ?? 0) >= n,
  )
}

export function spend(have: Inventory, cost: Partial<Inventory>): Inventory {
  const next = { ...have }
  for (const [k, n] of Object.entries(cost) as [keyof Inventory, number][]) {
    next[k] = Math.max(0, (next[k] ?? 0) - n)
  }
  return next
}

export function gain(have: Inventory, add: Partial<Inventory>, mult = 1): Inventory {
  const next = { ...have }
  for (const [k, n] of Object.entries(add) as [keyof Inventory, number][]) {
    next[k] = (next[k] ?? 0) + n * mult
  }
  return next
}

export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

export function storeTotal(store: Partial<Record<ItemId, number>>): number {
  return Object.values(store).reduce((a, b) => a + (b ?? 0), 0)
}

export function entityGlyph(kind: EntityKind, dir: Dir): string {
  if (kind === 'belt') {
    return dir === 'N' || dir === 'S' ? '║' : '═'
  }
  if (kind === 'inserter') return '↕'
  if (kind === 'drill') return '⛏'
  if (kind === 'furnace') return '▲'
  return '▣'
}
