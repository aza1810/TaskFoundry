import type { TabId, ToolId } from './types'

export type TutorialStepId =
  | 'welcome'
  | 'placeDrill'
  | 'oreToChest'
  | 'logSteps'
  | 'chestToFurnace'
  | 'plateChest'
  | 'done'

export type TutorialHighlight =
  | 'ore'
  | 'drillTool'
  | 'beltTool'
  | 'inserterTool'
  | 'chestTool'
  | 'furnaceTool'
  | 'walkSteps'
  | 'habit'
  | null

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
  /** Tabs available during this step (plus always-on ones handled in App). */
  unlockTabs: TabId[]
}

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'welcome',
    title: 'Welcome to Task Foundry',
    body: 'Real steps power your drills. Route ore into floor chests - those chests are your warehouse. When you leave, the line keeps running on your steps, and you come back to stockpiled ore and plates.',
    mode: 'modal',
    unlockTabs: ['factory'],
  },
  {
    id: 'placeDrill',
    title: 'Plant a mining drill',
    body: 'Open Build, pick Drill, and tap a glowing brown iron-ore tile. Aim the yellow arrow toward where your belts will go.',
    mode: 'coach',
    tab: 'factory',
    action: 'Place a burner drill on iron ore',
    autoSelect: 'drill',
    highlight: 'ore',
    unlockTabs: ['factory', 'inventory'],
  },
  {
    id: 'oreToChest',
    title: 'Belt ore into a chest',
    body: 'Lay belts from the drill, then an inserter that pulls off the belt into your first chest. You only get one chest slot for now - that chest is your warehouse.',
    mode: 'coach',
    tab: 'factory',
    action: 'Place belts, an inserter, and 1 chest (drill → belt → inserter → chest)',
    autoSelect: 'belt',
    highlight: 'beltTool',
    unlockTabs: ['factory', 'inventory'],
  },
  {
    id: 'logSteps',
    title: 'Walk to mine',
    body: 'Steps run mining cycles on every drill. Sync Health / Health Connect, or start the pedometer and take a short walk so ore reaches the chest.',
    mode: 'coach',
    tab: 'steps',
    action: 'Sync health or walk at least 10 steps',
    highlight: 'walkSteps',
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'chestToFurnace',
    title: 'Feed a furnace from the chest',
    body: 'Pull out of the ore chest with an inserter onto a belt, then another inserter into a furnace. Place the furnace - that unlocks your second chest.',
    mode: 'coach',
    tab: 'factory',
    action: 'Place a furnace fed from the chest (inserter → belt → inserter → furnace)',
    autoSelect: 'furnace',
    highlight: 'furnaceTool',
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'plateChest',
    title: 'Catch the plates',
    body: 'You unlocked a second chest. Pull iron plates out of the furnace with an inserter into chest #2. That is your plate stockpile.',
    mode: 'coach',
    tab: 'factory',
    action: 'Place a 2nd chest and an inserter from furnace → chest',
    autoSelect: 'chest',
    highlight: 'chestTool',
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'done',
    title: 'Leave the line running',
    body: 'When you go offline, your steps keep powering drills. Ore fills the first chest, plates fill the second. Come back to the away report to see what your chests gathered. Craft, Lab, and Skills are unlocked - keep the loop going.',
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
