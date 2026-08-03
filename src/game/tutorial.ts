import type { TabId, ToolId } from './types'

export type TutorialStepId =
  | 'welcome'
  | 'placeDrill'
  | 'logSteps'
  | 'belts'
  | 'tasks'
  | 'done'

export type TutorialHighlight = 'ore' | 'drillTool' | 'beltTool' | 'manualSteps' | 'habit' | null

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
    body: 'Real-world steps power your factory. Walk (or tap +10), drills mine, belts move ore, furnaces smelt. Start with a drill - or plant a whole starter line in one tap.',
    mode: 'modal',
    unlockTabs: ['factory'],
  },
  {
    id: 'placeDrill',
    title: 'Sink a drill on iron',
    body: 'Build → Drill is selected. Tap a glowing brown iron-ore tile. Pinch to zoom; Hand mode pans the map.',
    mode: 'coach',
    tab: 'factory',
    action: 'Place a burner drill on iron ore',
    autoSelect: 'drill',
    highlight: 'ore',
    unlockTabs: ['factory', 'inventory'],
  },
  {
    id: 'logSteps',
    title: 'Feed the drills',
    body: 'Every step runs one mining cycle on every drill. Tap +10 below, sync Apple Health / Health Connect in the native app, or start the live pedometer.',
    mode: 'coach',
    tab: 'steps',
    action: 'Log at least 10 steps',
    highlight: 'manualSteps',
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'belts',
    title: 'Lay a short belt line',
    body: 'Open Belts, pick Belt, then hold on a tile and drag to paint a line from your drill (a short drag only pans). Use Edit → Rotate (or the yellow arrow) so the drill faces the belt.',
    mode: 'coach',
    tab: 'factory',
    action: 'Place 3 or more belts',
    autoSelect: 'belt',
    highlight: 'beltTool',
    unlockTabs: ['factory', 'inventory', 'steps'],
  },
  {
    id: 'tasks',
    title: 'Claim free parts',
    body: 'Daily tasks restock coal, belts, and machines. Check one off to keep the foundry supplied.',
    mode: 'coach',
    tab: 'habits',
    action: 'Complete 1 daily task',
    highlight: 'habit',
    unlockTabs: ['factory', 'inventory', 'steps', 'habits'],
  },
  {
    id: 'done',
    title: 'You’re on the clock',
    body: 'Craft, Lab, and Skills are unlocked. Keep the loop going: walk → mine → move → smelt → task rewards. Use ··· in the top bar for Settings, updates, and sign out.',
    mode: 'modal',
    unlockTabs: ['factory', 'inventory', 'steps', 'craft', 'research', 'skills', 'habits'],
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
