import type { Inventory, TechId } from './types'

export interface TechDef {
  id: TechId
  name: string
  detail: string
  cost: Partial<Inventory>
  unlocks: string
}

export const TECHS: TechDef[] = [
  {
    id: 'logistics2',
    name: 'Logistics 2',
    detail: 'Unlock fast transport belts (about 2× belt speed).',
    cost: { ironPlate: 30, gear: 15 },
    unlocks: 'Fast transport belt crafting',
  },
  {
    id: 'electricMining',
    name: 'Electric mining',
    detail: 'Unlock electric drills — no coal, 2 ore per step cycle.',
    cost: { copperPlate: 25, gear: 20, ironPlate: 20 },
    unlocks: 'Electric mining drill crafting',
  },
  {
    id: 'splitters',
    name: 'Belt splitters',
    detail: 'Unlock splitters that alternate items onto two outputs.',
    cost: { ironPlate: 20, gear: 12, copperPlate: 10 },
    unlocks: 'Splitter crafting',
  },
  {
    id: 'undergroundBelts',
    name: 'Underground belts',
    detail: 'Tunnel belts under obstacles for up to 6 tiles.',
    cost: { ironPlate: 40, gear: 20 },
    unlocks: 'Underground belt crafting',
  },
  {
    id: 'steelProcessing',
    name: 'Steel processing',
    detail: 'Smelt steel plates and unlock steel furnaces (2× smelt speed).',
    cost: { ironPlate: 50, gear: 25, coal: 30 },
    unlocks: 'Steel + steel furnace crafting',
  },
]
