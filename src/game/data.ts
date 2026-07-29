import type {
  BuildingDef,
  BuildingId,
  Habit,
  RecipeDef,
  ResourceId,
  Resources,
  TechDef,
  TechId,
} from './types'

export const SAVE_KEY = 'habitworks-save-v1'
export const GAME_VERSION = 1

export const RESOURCE_META: Record<
  ResourceId,
  { label: string; short: string; color: string }
> = {
  ironOre: { label: 'Iron Ore', short: 'Fe', color: '#8B7355' },
  copperOre: { label: 'Copper Ore', short: 'Cu', color: '#C4783A' },
  coal: { label: 'Coal', short: 'C', color: '#2A2A2A' },
  ironPlate: { label: 'Iron Plate', short: 'Fe□', color: '#A8B0BC' },
  copperPlate: { label: 'Copper Plate', short: 'Cu□', color: '#E8913A' },
  steel: { label: 'Steel Plate', short: 'St', color: '#5C6B7A' },
  gear: { label: 'Iron Gear', short: '⚙', color: '#9AA3AD' },
  copperCable: { label: 'Copper Cable', short: '≈', color: '#F0A020' },
  circuit: { label: 'Green Circuit', short: '◈', color: '#3D9E5F' },
  redScience: { label: 'Red Science', short: '◆', color: '#D64545' },
  greenScience: { label: 'Green Science', short: '◇', color: '#3D9E5F' },
}

export const EMPTY_RESOURCES = (): Resources => ({
  ironOre: 0,
  copperOre: 0,
  coal: 0,
  ironPlate: 0,
  copperPlate: 0,
  steel: 0,
  gear: 0,
  copperCable: 0,
  circuit: 0,
  redScience: 0,
  greenScience: 0,
})

export const RECIPES: RecipeDef[] = [
  {
    id: 'smeltIron',
    name: 'Smelt Iron Plate',
    inputs: { ironOre: 1, coal: 0.5 },
    outputs: { ironPlate: 1 },
    seconds: 3.2,
  },
  {
    id: 'smeltCopper',
    name: 'Smelt Copper Plate',
    inputs: { copperOre: 1, coal: 0.5 },
    outputs: { copperPlate: 1 },
    seconds: 3.2,
  },
  {
    id: 'makeSteel',
    name: 'Forge Steel',
    inputs: { ironPlate: 5, coal: 2 },
    outputs: { steel: 1 },
    seconds: 16,
    unlockTech: 'steelProcessing',
  },
  {
    id: 'makeGear',
    name: 'Cut Iron Gear',
    inputs: { ironPlate: 2 },
    outputs: { gear: 1 },
    seconds: 0.5,
  },
  {
    id: 'makeCable',
    name: 'Draw Copper Cable',
    inputs: { copperPlate: 1 },
    outputs: { copperCable: 2 },
    seconds: 0.5,
    unlockTech: 'electronics',
  },
  {
    id: 'makeCircuit',
    name: 'Assemble Green Circuit',
    inputs: { ironPlate: 1, copperCable: 3 },
    outputs: { circuit: 1 },
    seconds: 0.5,
    unlockTech: 'electronics',
  },
  {
    id: 'makeRedScience',
    name: 'Pack Red Science',
    inputs: { copperPlate: 1, gear: 1 },
    outputs: { redScience: 1 },
    seconds: 5,
    unlockLevel: 2,
  },
  {
    id: 'makeGreenScience',
    name: 'Pack Green Science',
    inputs: { circuit: 1, gear: 1 },
    outputs: { greenScience: 1 },
    seconds: 6,
    unlockTech: 'labEquipment',
  },
]

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'burnerDrill',
    name: 'Burner Mining Drill',
    description: 'Chews ore from the ground. Slow, thirsty for coal.',
    cost: { ironPlate: 9, gear: 3, coal: 5 },
    produces: { ironOre: 0.25, copperOre: 0.1 },
    craftSpeed: 1,
    unlockLevel: 1,
  },
  {
    id: 'electricDrill',
    name: 'Electric Mining Drill',
    description: 'Cleaner throughput. The belt starts humming.',
    cost: { ironPlate: 20, gear: 5, circuit: 3 },
    produces: { ironOre: 0.5, copperOre: 0.25, coal: 0.1 },
    craftSpeed: 1,
    unlockTech: 'logistics',
  },
  {
    id: 'stoneFurnace',
    name: 'Stone Furnace',
    description: 'Idle smelting when coal and ore are stocked.',
    cost: { ironPlate: 5 },
    autoKind: 'smelt',
    craftSpeed: 1,
  },
  {
    id: 'steelFurnace',
    name: 'Steel Furnace',
    description: 'Twice the heat. Twice the plates.',
    cost: { steel: 6, ironPlate: 10 },
    autoKind: 'smelt',
    craftSpeed: 2,
    unlockTech: 'steelProcessing',
  },
  {
    id: 'assembler1',
    name: 'Assembling Machine 1',
    description: 'Runs your selected assembly recipe on the belt.',
    cost: { ironPlate: 9, gear: 5, circuit: 3 },
    autoKind: 'assemble',
    craftSpeed: 0.5,
    unlockTech: 'automation',
  },
  {
    id: 'assembler2',
    name: 'Assembling Machine 2',
    description: 'Faster hands. More modules of habit.',
    cost: { steel: 4, gear: 8, circuit: 6 },
    autoKind: 'assemble',
    craftSpeed: 0.75,
    unlockTech: 'massProduction',
  },
  {
    id: 'lab',
    name: 'Research Lab',
    description: 'Burns science packs into tech progress while you sleep.',
    cost: { ironPlate: 10, gear: 10, circuit: 5 },
    autoKind: 'research',
    craftSpeed: 1,
    unlockTech: 'labEquipment',
  },
]

// Fix steel furnace cost - I accidentally used stone. Let me fix in a patch.
export const BUILDING_MAP = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
) as Record<BuildingId, BuildingDef>

export const RECIPE_MAP = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
) as Record<string, RecipeDef>

export const TECHS: TechDef[] = [
  {
    id: 'automation',
    name: 'Automation',
    description: 'Unlock gears and assembling machines.',
    cost: { redScience: 10 },
    unlockLevel: 2,
  },
  {
    id: 'logistics',
    name: 'Logistics',
    description: 'Electric drills and better ore flow.',
    cost: { redScience: 20 },
    requires: ['automation'],
  },
  {
    id: 'electronics',
    name: 'Electronics',
    description: 'Copper cable and green circuits.',
    cost: { redScience: 30 },
    requires: ['automation'],
  },
  {
    id: 'steelProcessing',
    name: 'Steel Processing',
    description: 'Steel plates and steel furnaces.',
    cost: { redScience: 40 },
    requires: ['logistics'],
  },
  {
    id: 'labEquipment',
    name: 'Lab Equipment',
    description: 'Research labs and green science packs.',
    cost: { redScience: 50 },
    requires: ['electronics'],
  },
  {
    id: 'advancedMaterial',
    name: 'Advanced Material',
    description: 'Green science recipes amplify XP from habits.',
    cost: { redScience: 40, greenScience: 20 },
    requires: ['labEquipment', 'steelProcessing'],
  },
  {
    id: 'massProduction',
    name: 'Mass Production',
    description: 'Assembling Machine 2 and faster idle ticks.',
    cost: { redScience: 60, greenScience: 40 },
    requires: ['advancedMaterial'],
  },
]

export const TECH_MAP = Object.fromEntries(TECHS.map((t) => [t.id, t])) as Record<
  TechId,
  TechDef
>

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
  {
    id: 'h-learn',
    title: 'Learn something new',
    category: 'research',
    streak: 0,
    completedToday: false,
    lastCompletedDate: null,
  },
]

export const HABIT_REWARDS: Record<
  Habit['category'],
  { resources: Partial<Resources>; xp: number }
> = {
  mining: { resources: { ironOre: 8, copperOre: 4, coal: 2 }, xp: 12 },
  smelting: { resources: { coal: 6, ironOre: 3 }, xp: 14 },
  assembly: { resources: { ironPlate: 2, copperPlate: 1 }, xp: 18 },
  research: { resources: { redScience: 1 }, xp: 22 },
  logistics: { resources: { copperCable: 2, gear: 1 }, xp: 10 },
}

export const STEPS_PER_IRON = 80
export const STEPS_PER_COPPER = 120
export const STEPS_PER_COAL = 200
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

export function canAfford(have: Resources, cost: Partial<Resources>): boolean {
  return (Object.entries(cost) as [ResourceId, number][]).every(
    ([id, amount]) => (have[id] ?? 0) + 1e-9 >= amount,
  )
}

export function spend(have: Resources, cost: Partial<Resources>): Resources {
  const next = { ...have }
  for (const [id, amount] of Object.entries(cost) as [ResourceId, number][]) {
    next[id] = Math.max(0, (next[id] ?? 0) - amount)
  }
  return next
}

export function gain(have: Resources, add: Partial<Resources>, mult = 1): Resources {
  const next = { ...have }
  for (const [id, amount] of Object.entries(add) as [ResourceId, number][]) {
    next[id] = (next[id] ?? 0) + amount * mult
  }
  return next
}

export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}
