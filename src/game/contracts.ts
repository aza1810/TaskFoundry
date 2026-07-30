import { todayKey } from './data'
import type { ContractState, GameState, Inventory, SkillId } from './types'

export type ContractKind = ContractState['kind']

interface ContractDef {
  title: string
  detail: string
  kind: ContractKind
  amount: number
  reward: Partial<Inventory>
  rewardLabel: string
}

const POOL: ContractDef[] = [
  {
    title: 'Morning walk',
    detail: 'Log 500 steps today.',
    kind: 'stepsToday',
    amount: 500,
    reward: { coal: 12, belt: 4 },
    rewardLabel: '12 coal + 4 belts',
  },
  {
    title: 'Shift hike',
    detail: 'Log 2,000 steps today.',
    kind: 'stepsToday',
    amount: 2000,
    reward: { ironPlate: 12, inserter: 2 },
    rewardLabel: '12 plates + 2 inserters',
  },
  {
    title: 'Ore quota',
    detail: 'Mine 80 ore today (from now).',
    kind: 'oreMined',
    amount: 80,
    reward: { drill: 1, coal: 10 },
    rewardLabel: '1 drill + 10 coal',
  },
  {
    title: 'Plate run',
    detail: 'Smelt 40 plates today (from now).',
    kind: 'platesSmelted',
    amount: 40,
    reward: { furnace: 1, coal: 15 },
    rewardLabel: '1 furnace + 15 coal',
  },
  {
    title: 'Gear bench',
    detail: 'Produce 15 gears today (from now).',
    kind: 'gearsMade',
    amount: 15,
    reward: { assembler: 1, ironPlate: 8 },
    rewardLabel: '1 assembler + 8 plates',
  },
  {
    title: 'Task discipline',
    detail: 'Complete 2 daily tasks.',
    kind: 'habitsToday',
    amount: 2,
    reward: { gear: 3, copperPlate: 6 },
    rewardLabel: '3 gears + 6 copper plates',
  },
  {
    title: 'Drill overtime',
    detail: 'Run 300 mine cycles today (from now).',
    kind: 'mineCycles',
    amount: 300,
    reward: { undergroundBelt: 2, coal: 20 },
    rewardLabel: '2 UG belts + 20 coal',
  },
  {
    title: 'Foundry five-hundred',
    detail: 'Log 5,000 steps today.',
    kind: 'stepsToday',
    amount: 5000,
    reward: { steel: 3, fastBelt: 6, electricDrill: 1 },
    rewardLabel: '3 steel + 6 fast belts + electric drill',
  },
]

function hashDay(day: string): number {
  let h = 2166136261
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function baselineFor(state: GameState, kind: ContractKind): number {
  switch (kind) {
    case 'stepsToday':
      return state.stepsToday
    case 'oreMined':
      return state.stats.oreMined
    case 'platesSmelted':
      return state.stats.platesSmelted
    case 'gearsMade':
      return state.stats.gearsMade
    case 'habitsToday':
      return state.habits.filter((h) => h.completedToday).length
    case 'mineCycles':
      return state.mineCycles
  }
}

export function currentFor(state: GameState, kind: ContractKind): number {
  return baselineFor(state, kind)
}

export function contractProgress(state: GameState, c: ContractState): number {
  return Math.max(0, currentFor(state, c.kind) - c.baseline)
}

export function contractComplete(state: GameState, c: ContractState): boolean {
  return contractProgress(state, c) >= c.amount
}

export function generateDailyContracts(state: GameState, day = todayKey()): ContractState[] {
  const seed = hashDay(day)
  const picks: ContractState[] = []
  const used = new Set<number>()
  for (let i = 0; i < 3; i++) {
    let idx = (seed + i * 17) % POOL.length
    let guard = 0
    while (used.has(idx) && guard < POOL.length) {
      idx = (idx + 1) % POOL.length
      guard++
    }
    used.add(idx)
    const def = POOL[idx]
    picks.push({
      id: `${day}-${def.kind}-${idx}`,
      kind: def.kind,
      title: def.title,
      detail: def.detail,
      amount: def.amount,
      baseline: baselineFor(state, def.kind),
      reward: def.reward,
      rewardLabel: def.rewardLabel,
      claimed: false,
    })
  }
  return picks
}

export const MAX_FOCUS_SKILLS = 2
export const FOCUS_XP_MULT = 1.5

export function toggleFocusSkill(current: SkillId[], id: SkillId): SkillId[] {
  if (current.includes(id)) return current.filter((s) => s !== id)
  if (current.length >= MAX_FOCUS_SKILLS) return [...current.slice(1), id]
  return [...current, id]
}
