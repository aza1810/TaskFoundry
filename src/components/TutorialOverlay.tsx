import { useEffect, useMemo } from 'react'
import { useGame } from '../game/GameContext'
import type { TabId } from '../game/types'

export type TutorialStepId =
  | 'welcome'
  | 'placeDrill'
  | 'logSteps'
  | 'belts'
  | 'tasks'
  | 'skills'
  | 'done'

const STEPS: {
  id: TutorialStepId
  title: string
  body: string
  tab?: TabId
  action?: string
}[] = [
  {
    id: 'welcome',
    title: 'Welcome to Task Foundry',
    body: 'Walk in the real world, check off daily tasks, and grow a Factorio-style factory. This quick tour gets your first line running.',
  },
  {
    id: 'placeDrill',
    title: 'Sink a burner drill',
    body: 'On the Floor tab, keep Drill selected and tap an iron ore patch (brown tiles). The drill must face a belt or chest later — for now just place it.',
    tab: 'factory',
    action: 'Place a burner drill on ore to continue',
  },
  {
    id: 'logSteps',
    title: 'Power the drills with steps',
    body: 'Every step is one mining cycle on every drill. Open Steps and tap +10, or start the live phone pedometer and walk.',
    tab: 'steps',
    action: 'Log at least 10 steps to continue',
  },
  {
    id: 'belts',
    title: 'Move the ore',
    body: 'Back on the Floor: place belts facing away from the drill, then an inserter and furnace when you can. Drag to paint belts quickly. Rotate with R. Check Inventory for stocks.',
    tab: 'factory',
  },
  {
    id: 'tasks',
    title: 'Daily tasks & contracts',
    body: 'Open Tasks for daily checklists and contracts. Completing them restocks materials and pays bonuses.',
    tab: 'habits',
  },
  {
    id: 'skills',
    title: 'Train operator skills',
    body: 'Walking trains Mining, Smelting, Logistics, Assembly, and Fieldwork based on what machines you placed. Focus up to two skills for bonus XP.',
    tab: 'skills',
  },
  {
    id: 'done',
    title: 'You’re on the clock',
    body: 'Use the bottom nav to jump between Floor, Inventory, Steps, Craft, Lab, Skills, and Tasks. Starter line on the Floor toolbar builds a quick smelting setup.',
  },
]

export const TUTORIAL_STEP_COUNT = STEPS.length

export function TutorialOverlay({
  onRequestTab,
}: {
  onRequestTab: (tab: TabId) => void
}) {
  const { state, advanceTutorial, skipTutorial } = useGame()
  const stepIndex = state.tutorialStep ?? 0
  const active = !state.tutorialComplete && state.tutorialStep !== null

  const drills = useMemo(
    () =>
      Object.values(state.entities).filter(
        (e) => e.kind === 'drill' || e.kind === 'electricDrill',
      ).length,
    [state.entities],
  )

  const step = STEPS[Math.min(Math.max(0, stepIndex), STEPS.length - 1)]
  const isLast = step.id === 'done'

  useEffect(() => {
    if (!active) return
    if (step.id === 'placeDrill' && drills >= 1) advanceTutorial()
    if (step.id === 'logSteps' && state.stepsLifetime >= 10) advanceTutorial()
  }, [active, step.id, drills, state.stepsLifetime, advanceTutorial])

  useEffect(() => {
    if (!active || !step.tab) return
    onRequestTab(step.tab)
  }, [active, step.id, step.tab, onRequestTab])

  if (!active) return null

  return (
    <div className="tutorial-root" role="dialog" aria-modal="true" aria-labelledby="tut-title">
      <div className="tutorial-scrim" />
      <div className="tutorial-card">
        <div className="tutorial-progress">
          Tour {Math.min(stepIndex + 1, STEPS.length)}/{STEPS.length}
        </div>
        <h2 id="tut-title">{step.title}</h2>
        <p>{step.body}</p>
        {step.action && <p className="tutorial-action">{step.action}</p>}
        <div className="tutorial-actions">
          <button type="button" className="ghost-btn" onClick={skipTutorial}>
            Skip tour
          </button>
          <button type="button" className="primary-btn" onClick={advanceTutorial}>
            {isLast ? 'Enter the foundry' : step.action ? 'I’ll do it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
