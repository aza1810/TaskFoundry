import type { Inventory, ItemId, TechId } from './types'
import { BASE_MAX_CHESTS } from './data'

export interface TechDef {
  id: TechId
  name: string
  detail: string
  cost: Partial<Inventory>
  unlocks: string
  /** Must all be researched before this node can be bought. */
  prerequisites: TechId[]
  /** Item icon shown on the tree node. */
  icon: ItemId
  /** Grid placement for the research tree (column = progression). */
  col: number
  row: number
}

export const TECHS: TechDef[] = [
  {
    id: 'automation',
    name: 'Automation',
    detail: 'Boot the lab. Opens the rest of the research tree.',
    cost: { ironPlate: 10, gear: 5 },
    unlocks: 'Research tree branches',
    prerequisites: [],
    icon: 'gear',
    col: 0,
    row: 1,
  },
  {
    id: 'logistics',
    name: 'Logistics',
    detail: 'Study belt routing and item flow - gateway to faster logistics.',
    cost: { ironPlate: 15, gear: 8, belt: 4 },
    unlocks: 'Logistics 2 research',
    prerequisites: ['automation'],
    icon: 'belt',
    col: 1,
    row: 0,
  },
  {
    id: 'electricMining',
    name: 'Electric mining',
    detail: 'Unlock electric drills - no coal, 2 ore per step cycle.',
    cost: { copperPlate: 25, gear: 20, ironPlate: 20 },
    unlocks: 'Electric mining drill crafting',
    prerequisites: ['automation'],
    icon: 'electricDrill',
    col: 1,
    row: 1,
  },
  {
    id: 'steelProcessing',
    name: 'Steel processing',
    detail: 'Smelt steel plates and unlock steel furnaces (2× smelt speed).',
    cost: { ironPlate: 50, gear: 25, coal: 30 },
    unlocks: 'Steel + steel furnace crafting',
    prerequisites: ['automation'],
    icon: 'steel',
    col: 1,
    row: 2,
  },
  {
    id: 'logistics2',
    name: 'Logistics 2',
    detail: 'Unlock fast transport belts (about 2× belt speed).',
    cost: { ironPlate: 30, gear: 15 },
    unlocks: 'Fast transport belt crafting',
    prerequisites: ['logistics'],
    icon: 'fastBelt',
    col: 2,
    row: 0,
  },
  {
    id: 'longInserters',
    name: 'Long inserters',
    detail: 'Unlock inserters that reach two tiles for bridging gaps.',
    cost: { ironPlate: 25, gear: 20, inserter: 2 },
    unlocks: 'Long inserter crafting',
    prerequisites: ['electricMining'],
    icon: 'longInserter',
    col: 2,
    row: 1,
  },
  {
    id: 'splitters',
    name: 'Belt splitters',
    detail: 'Unlock splitters that alternate items onto two outputs.',
    cost: { ironPlate: 20, gear: 12, copperPlate: 10 },
    unlocks: 'Splitter crafting',
    prerequisites: ['logistics2'],
    icon: 'splitter',
    col: 3,
    row: 0,
  },
  {
    id: 'undergroundBelts',
    name: 'Underground belts',
    detail: 'Tunnel belts under obstacles for up to 6 tiles.',
    cost: { ironPlate: 40, gear: 20 },
    unlocks: 'Underground belt crafting',
    prerequisites: ['logistics2'],
    icon: 'undergroundBelt',
    col: 3,
    row: 1,
  },
  {
    id: 'storage',
    name: 'Factory storage',
    detail: 'Expand floor logistics. Raise the chest placement cap to 4.',
    cost: { ironPlate: 20, gear: 10, chest: 1 },
    unlocks: 'Max 4 chests on the floor',
    prerequisites: ['logistics'],
    icon: 'chest',
    col: 2,
    row: 2,
  },
  {
    id: 'storage2',
    name: 'Warehouse logistics',
    detail: 'More output buffers. Raise the chest placement cap to 6.',
    cost: { ironPlate: 40, gear: 20, steel: 10 },
    unlocks: 'Max 6 chests on the floor',
    prerequisites: ['storage', 'steelProcessing'],
    icon: 'chest',
    col: 3,
    row: 2,
  },
]

export const TECH_MAP: Record<TechId, TechDef> = Object.fromEntries(
  TECHS.map((t) => [t.id, t]),
) as Record<TechId, TechDef>

export const TECH_TREE_COLS = 4
export const TECH_TREE_ROWS = 3

/** How many chests may be placed on the floor given researched storage techs. */
export function maxChestsFor(researched: readonly string[]): number {
  if (researched.includes('storage2')) return 6
  if (researched.includes('storage')) return 4
  return BASE_MAX_CHESTS
}

export function countPlacedChests(entities: Record<string, { kind: string }>): number {
  let n = 0
  for (const e of Object.values(entities)) {
    if (e.kind === 'chest') n += 1
  }
  return n
}

export function prereqsMet(tech: TechDef, researched: readonly string[]): boolean {
  return tech.prerequisites.every((id) => researched.includes(id))
}

/** If a save has mid-tree techs, backfill ancestors so nothing is soft-locked. */
export function withImpliedResearched(researched: TechId[]): TechId[] {
  const set = new Set<TechId>(researched)
  let changed = true
  while (changed) {
    changed = false
    for (const id of [...set]) {
      const tech = TECH_MAP[id]
      if (!tech) continue
      for (const pre of tech.prerequisites) {
        if (!set.has(pre)) {
          set.add(pre)
          changed = true
        }
      }
    }
  }
  return TECHS.map((t) => t.id).filter((id) => set.has(id))
}
