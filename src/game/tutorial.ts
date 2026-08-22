import type { TabId, ToolId } from './types'

export type TutorialStepId =
  | 'welcome'
  | 'placeRoboport'
  | 'placeDrill'
  | 'oreToChest'
  | 'logSteps'
  | 'chestToFurnace'
  | 'plateChest'
  | 'done'

export type TutorialHighlight =
  | 'ore'
  | 'roboportTool'
  | 'drillTool'
  | 'beltTool'
  | 'inserterTool'
  | 'chestTool'
  | 'furnaceTool'
  | 'walkSteps'
  | 'habit'
  | null

export interface TutorialCheckDef {
  id: string
  label: string
  tool?: ToolId
}

export interface TutorialStepDef {
  id: TutorialStepId
  title: string
  body: string
  /** Blocking card (welcome / finish). Action steps use a non-blocking coach. */
  mode: 'modal' | 'coach'
  tab?: TabId
  action?: string
  autoSelect?: ToolId
  highlight?: TutorialHighlight
  checks?: TutorialCheckDef[]
  /** Tabs available during this step (plus always-on ones handled in App). */
  unlockTabs: TabId[]
}

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'welcome',
    title: 'Welcome to Task Foundry',
    body: 'You start with nothing and build up from scratch. Drones do the work: place a Roboport and its drones build every blueprint you lay down, chop any tree you mark into wood, and excavate rocks for stone (with a little iron and rare coal). Paint Foundation under inserters, assemblers, and splitters so a generator can power them. Belts run without power. Drills can tap a generator or powered floor within 5 tiles. Your real-world steps charge the grid.',
    mode: 'modal',
    unlockTabs: ['factory'],
  },
  {
    id: 'placeRoboport',
    title: 'Deploy a roboport first',
    body: 'Everything starts with the roboport. Open Production, pick Roboport, and place the 3x3 hub on the clear grass near the iron patch - it deploys a construction drone. That drone builds every blueprint you place, chops marked trees for wood, and excavates marked rocks for stone. Nothing gets built without a roboport.',
    mode: 'coach',
    tab: 'factory',
    action: 'Place a roboport on open ground',
    autoSelect: 'roboport',
    highlight: 'roboportTool',
    checks: [{ id: 'roboport', label: 'Place a roboport', tool: 'roboport' }],
    unlockTabs: ['factory'],
  },
  {
    id: 'placeDrill',
    title: 'Blueprint a mining drill',
    body: 'Pick Drill and tap a glowing brown iron tile. The drill is 2x2 and mines a 3x3 patch around its top-left. It drops as a blueprint and your drone flies over to build it. Face the orange port toward empty ground: ore dumps onto one belt square in front of that port (the top square by default). Rotate to turn the drill, Flip to pick the other square. Place a generator within 5 tiles, or pave Foundation toward one, so the drill can run.',
    mode: 'coach',
    tab: 'factory',
    action: 'Tap a glowing iron-ore tile',
    autoSelect: 'drill',
    highlight: 'ore',
    checks: [{ id: 'drill', label: 'Drill on iron', tool: 'drill' }],
    unlockTabs: ['factory', 'inventory'],
  },
  {
    id: 'oreToChest',
    title: 'Belt ore into a chest',
    body: 'Follow the glowing ghosts. Belts carry ore and do not need power. An inserter pulls off the belt into your first chest. That chest is the warehouse. Paint Foundation under the inserter, then put a generator next to that floor (or within 5 tiles of the drill).',
    mode: 'coach',
    tab: 'factory',
    action: 'Belt, chest, then inserter into the chest',
    autoSelect: 'belt',
    highlight: 'beltTool',
    checks: [
      { id: 'belt', label: 'Belt from the drill', tool: 'belt' },
      { id: 'chest1', label: 'Ore chest', tool: 'chest' },
      { id: 'inserter1', label: 'Inserter into the chest', tool: 'inserter' },
    ],
    unlockTabs: ['factory', 'inventory'],
  },
  {
    id: 'logSteps',
    title: 'Walk to power the drill',
    body: 'Every step charges your power grid. A powered drill spends that stored power to mine while you watch, and each step adds extra cycles. Sync Health / Health Connect, or start the pedometer and take a short walk so the battery stays up and ore keeps reaching the chest.',
    mode: 'coach',
    tab: 'steps',
    action: 'Sync health or walk at least 10 steps',
    highlight: 'walkSteps',
    checks: [{ id: 'steps', label: '10 steps or mine cycles' }],
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'chestToFurnace',
    title: 'Feed a furnace from the chest',
    body: 'Pull ore out of the chest onto a belt, then into a furnace. You start with two chest slots, so you can plant a plate buffer whenever you are ready.',
    mode: 'coach',
    tab: 'factory',
    action: 'Furnace fed from the ore chest',
    autoSelect: 'furnace',
    highlight: 'furnaceTool',
    checks: [
      { id: 'furnace', label: 'Place a furnace', tool: 'furnace' },
      { id: 'belt2', label: 'Belt toward the furnace', tool: 'belt' },
      { id: 'inserter2', label: 'Inserters: chest → furnace', tool: 'inserter' },
    ],
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'plateChest',
    title: 'Catch the plates',
    body: 'Place a second chest and pull iron plates out of the furnace with an inserter. That is your plate stockpile.',
    mode: 'coach',
    tab: 'factory',
    action: 'Inserter from furnace into chest #2',
    autoSelect: 'chest',
    highlight: 'chestTool',
    checks: [
      { id: 'chest2', label: 'Second chest', tool: 'chest' },
      { id: 'inserter3', label: 'Inserter: furnace → chest', tool: 'inserter' },
    ],
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'done',
    title: 'Leave the line running',
    body: 'When you go offline, your steps keep charging power and the drills keep mining. Ore fills the first chest, plates fill the second. Come back to the away report to see what you gathered. Need fuel? Mark a tree with Demolish and a drone chops it into wood to burn. Craft, Lab, and Skills are now unlocked.',
    mode: 'modal',
    unlockTabs: [
      'factory',
      'inventory',
      'steps',
      'craft',
      'research',
      'skills',
      'habits',
    ],
  },
]

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length

export const ALL_TABS: TabId[] = [
  'factory',
  'inventory',
  'steps',
  'craft',
  'research',
  'skills',
  'habits',
]

export function getTutorialStep(index: number | null): TutorialStepDef | null {
  if (index === null || index < 0) return null
  return TUTORIAL_STEPS[Math.min(index, TUTORIAL_STEPS.length - 1)] ?? null
}

export function tutorialStepIndex(id: TutorialStepId): number {
  return TUTORIAL_STEPS.findIndex((s) => s.id === id)
}

export function unlockedTabsFor(
  tutorialStep: number | null,
  tutorialComplete: boolean,
): TabId[] {
  if (tutorialComplete || tutorialStep === null) return ALL_TABS
  const step = getTutorialStep(tutorialStep)
  return step?.unlockTabs ?? ['factory']
}
