import type { FactoryStats, GameState, Inventory } from './types'

export interface GoalDef {
  id: string
  title: string
  detail: string
  reward: Partial<Inventory>
  rewardLabel: string
  check: (s: GameState) => boolean
  /** Optional numeric progress for the HUD chip */
  progress?: (s: GameState) => { cur: number; max: number }
}

function countDrills(s: GameState): number {
  return Object.values(s.entities).filter(
    (e) => e.kind === 'drill' || e.kind === 'electricDrill',
  ).length
}

function countBelts(s: GameState): number {
  return Object.values(s.entities).filter(
    (e) => e.kind === 'belt' || e.kind === 'fastBelt',
  ).length
}

function countFurnaces(s: GameState): number {
  return Object.values(s.entities).filter(
    (e) => e.kind === 'furnace' || e.kind === 'steelFurnace',
  ).length
}

function countChests(s: GameState): number {
  return Object.values(s.entities).filter((e) => e.kind === 'chest').length
}

function chestItems(s: GameState): number {
  return Object.values(s.entities)
    .filter((e) => e.kind === 'chest')
    .reduce(
      (sum, e) => sum + Object.values(e.store).reduce((a, b) => a + (b ?? 0), 0),
      0,
    )
}

export const GOALS: GoalDef[] = [
  {
    id: 'place-drill',
    title: 'Sink the first drill',
    detail: 'Place a burner drill on an ore patch.',
    reward: { belt: 6, coal: 8 },
    rewardLabel: '6 belts + 8 coal',
    check: (s) => countDrills(s) >= 1,
    progress: (s) => ({ cur: Math.min(1, countDrills(s)), max: 1 }),
  },
  {
    id: 'place-furnace',
    title: 'Light a furnace',
    detail: 'Place a stone furnace on the floor.',
    reward: { inserter: 2, belt: 4 },
    rewardLabel: '2 inserters + 4 belts',
    check: (s) => countFurnaces(s) >= 1,
    progress: (s) => ({ cur: Math.min(1, countFurnaces(s)), max: 1 }),
  },
  {
    id: 'mine-cycles',
    title: 'Walk the line',
    detail: 'Log steps until you reach 40 mine cycles.',
    reward: { inserter: 2, belt: 4 },
    rewardLabel: '2 inserters + 4 belts',
    check: (s) => s.mineCycles >= 40,
    progress: (s) => ({ cur: Math.min(40, s.mineCycles), max: 40 }),
  },
  {
    id: 'belt-line',
    title: 'Lay the belt',
    detail: 'Place at least 5 transport belts.',
    reward: { furnace: 1, coal: 10 },
    rewardLabel: '1 furnace + 10 coal',
    check: (s) => countBelts(s) >= 5,
    progress: (s) => ({ cur: Math.min(5, countBelts(s)), max: 5 }),
  },
  {
    id: 'smelt-ten',
    title: 'First plates',
    detail: 'Smelt 10 plates in stone furnaces.',
    reward: { assembler: 1, gear: 3 },
    rewardLabel: '1 assembler + 3 gears',
    check: (s) => s.stats.platesSmelted >= 10,
    progress: (s) => ({
      cur: Math.min(10, s.stats.platesSmelted),
      max: 10,
    }),
  },
  {
    id: 'gear-up',
    title: 'Cut gears',
    detail: 'Produce 5 gears (hand craft or assembler).',
    reward: { drill: 1, inserter: 2 },
    rewardLabel: '1 drill + 2 inserters',
    check: (s) => s.stats.gearsMade >= 5,
    progress: (s) => ({ cur: Math.min(5, s.stats.gearsMade), max: 5 }),
  },
  {
    id: 'chest-stock',
    title: 'Stock the chest',
    detail: 'Have 15+ items sitting in chests (4 slots × 100 each).',
    reward: { chest: 1, belt: 8 },
    rewardLabel: '1 chest + 8 belts',
    check: (s) => chestItems(s) >= 15,
    progress: (s) => ({ cur: Math.min(15, chestItems(s)), max: 15 }),
  },
  {
    id: 'two-chests',
    title: 'Twin buffers',
    detail: 'Have two chests on the floor - ore in, plates out.',
    reward: { coal: 10, belt: 6 },
    rewardLabel: '10 coal + 6 belts',
    check: (s) => countChests(s) >= 2,
    progress: (s) => ({ cur: Math.min(2, countChests(s)), max: 2 }),
  },
  {
    id: 'habit-duo',
    title: 'Operator discipline',
    detail: 'Complete 2 habits today.',
    reward: { ironPlate: 6, coal: 6 },
    rewardLabel: '6 plates + 6 coal',
    check: (s) => s.habits.filter((h) => h.completedToday).length >= 2,
    progress: (s) => ({
      cur: Math.min(2, s.habits.filter((h) => h.completedToday).length),
      max: 2,
    }),
  },
  {
    id: 'walk-thousand',
    title: 'Kilometer crew',
    detail: 'Reach 1,000 lifetime steps.',
    reward: { drill: 1, assembler: 1, furnace: 1 },
    rewardLabel: 'drill + assembler + furnace',
    check: (s) => s.stepsLifetime >= 1000,
    progress: (s) => ({
      cur: Math.min(1000, s.stepsLifetime),
      max: 1000,
    }),
  },
  {
    id: 'first-research',
    title: 'Open the lab',
    detail: 'Research Automation to open the tech tree.',
    reward: { ironPlate: 20, gear: 10 },
    rewardLabel: '20 plates + 10 gears',
    check: (s) => s.researched.length >= 1,
    progress: (s) => ({
      cur: Math.min(1, s.researched.length),
      max: 1,
    }),
  },
  {
    id: 'skill-mining-1',
    title: 'Trained miner',
    detail: 'Reach Mining skill level 1 by walking with drills placed.',
    reward: { coal: 15, belt: 4 },
    rewardLabel: '15 coal + 4 belts',
    check: (s) => (s.skills?.mining?.level ?? 0) >= 1,
    progress: (s) => ({
      cur: Math.min(1, s.skills?.mining?.level ?? 0),
      max: 1,
    }),
  },
  {
    id: 'skill-assembly-1',
    title: 'Bench hand',
    detail: 'Reach Assembly skill level 1 (walk with assemblers or while crafting).',
    reward: { ironPlate: 10, gear: 4 },
    rewardLabel: '10 plates + 4 gears',
    check: (s) => (s.skills?.assembly?.level ?? 0) >= 1,
    progress: (s) => ({
      cur: Math.min(1, s.skills?.assembly?.level ?? 0),
      max: 1,
    }),
  },
  {
    id: 'walk-five-k',
    title: 'Foundry five-k',
    detail: 'Reach 5,000 lifetime steps.',
    reward: { electricDrill: 1, fastBelt: 8, steel: 2 },
    rewardLabel: 'electric drill + 8 fast belts + 2 steel',
    check: (s) => s.stepsLifetime >= 5000,
    progress: (s) => ({
      cur: Math.min(5000, s.stepsLifetime),
      max: 5000,
    }),
  },
]

export const TIPS = [
  'Drills can dump straight into a chest they face - belts still need an inserter.',
  'Hold on a tile, then drag to paint belts. Edit → Demolish marks buildings for a drone to scrap.',
  'Inserters pull from behind and push forward - green arrow shows drop direction.',
  'Route drill → chest for ore, or drill → belt → inserter → chest for longer lines.',
  'Belts never dump into chests - always bridge with an inserter.',
  'You can place two chests from the start: ore in, plates out.',
  'Chests hold 4 stacks of 100. Your pack also keeps one stack of each material.',
  'When you leave, steps keep drills running - come back to stockpiled chests.',
  'Research Factory storage to place more than two chests.',
  'Assemblers turn iron plates into gears while you walk.',
  'Research fast belts, electric drills, and splitters when you have plates to spare.',
  'Starter line auto-builds a basic drill → chest → furnace → plate chest setup.',
  'Daily tasks restock belts and fuel so the factory keeps growing.',
  'Skills level from steps: drills train Mining, furnaces Smelting, belts Logistics.',
  'Assemblers and the craft bench train Assembly while you walk.',
  'Task Foundry: check daily tasks, walk to mine, automate the rest.',
  'Daily contracts refresh each day - claim them for mats.',
  'Focus up to two skills on the Skills tab for ×1.5 step XP.',
  '··· opens Settings for theme, updates, and account.',
]

export function emptyStats(): FactoryStats {
  return { oreMined: 0, platesSmelted: 0, gearsMade: 0, itemsMoved: 0 }
}

export function activeGoal(state: GameState): GoalDef | null {
  return GOALS.find((g) => !state.completedGoals.includes(g.id)) ?? null
}
