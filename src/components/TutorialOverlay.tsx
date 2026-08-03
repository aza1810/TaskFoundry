import { useEffect, useMemo } from 'react'
import { useGame } from '../game/GameContext'
import {
  getTutorialStep,
  TUTORIAL_STEP_COUNT,
  type TutorialStepId,
} from '../game/tutorial'
import type { TabId } from '../game/types'

export type { TutorialStepId }

export function TutorialOverlay({
  onRequestTab,
}: {
  onRequestTab: (tab: TabId) => void
}) {
  const {
    state,
    advanceTutorial,
    skipTutorial,
    quickStartTutorial,
    selectTool,
  } = useGame()
  const stepIndex = state.tutorialStep
  const active = !state.tutorialComplete && stepIndex !== null
  const step = active ? getTutorialStep(stepIndex) : null
  const habitsDoneToday = state.habits.filter((h) => h.completedToday).length

  const drills = useMemo(
    () =>
      Object.values(state.entities).filter(
        (e) => e.kind === 'drill' || e.kind === 'electricDrill',
      ).length,
    [state.entities],
  )

  const belts = useMemo(
    () =>
      Object.values(state.entities).filter(
        (e) => e.kind === 'belt' || e.kind === 'fastBelt',
      ).length,
    [state.entities],
  )

  // Auto-select recommended tool for the step
  useEffect(() => {
    if (!active || !step?.autoSelect) return
    if (state.selected !== step.autoSelect) selectTool(step.autoSelect)
  }, [active, step?.id, step?.autoSelect, selectTool, state.selected])

  // Switch to the step's tab
  useEffect(() => {
    if (!active || !step?.tab) return
    onRequestTab(step.tab)
  }, [active, step?.id, step?.tab, onRequestTab])

  // Auto-advance when the player does the thing
  useEffect(() => {
    if (!active || !step || step.mode !== 'coach') return
    if (step.id === 'placeDrill' && drills >= 1) advanceTutorial()
    if (step.id === 'logSteps' && (state.stepsLifetime >= 10 || state.mineCycles >= 10)) {
      advanceTutorial()
    }
    if (step.id === 'belts' && belts >= 3) advanceTutorial()
    if (step.id === 'tasks' && habitsDoneToday >= 1) advanceTutorial()
  }, [
    active,
    step,
    drills,
    belts,
    state.stepsLifetime,
    state.mineCycles,
    habitsDoneToday,
    advanceTutorial,
  ])

  if (!active || !step) return null

  const isLast = step.id === 'done'
  const progressLabel = `Step ${Math.min((stepIndex ?? 0) + 1, TUTORIAL_STEP_COUNT)}/${TUTORIAL_STEP_COUNT}`

  if (step.mode === 'modal') {
    return (
      <div className="tutorial-root is-modal" role="dialog" aria-modal="true" aria-labelledby="tut-title">
        <div className="tutorial-scrim" />
        <div className="tutorial-card">
          <div className="tutorial-progress">{progressLabel}</div>
          <h2 id="tut-title">{step.title}</h2>
          <p>{step.body}</p>
          {step.id === 'welcome' ? (
            <div className="tutorial-actions tutorial-actions-stack">
              <button type="button" className="primary-btn" onClick={advanceTutorial}>
                Start guided tour
              </button>
              <button type="button" className="primary-btn tutorial-quick" onClick={quickStartTutorial}>
                Plant starter line
              </button>
              <button type="button" className="ghost-btn" onClick={skipTutorial}>
                Skip - I’ll explore
              </button>
            </div>
          ) : (
            <div className="tutorial-actions">
              <span />
              <button type="button" className="primary-btn" onClick={advanceTutorial}>
                {isLast ? 'Enter the foundry' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="tutorial-root is-coach" role="status" aria-live="polite">
      <div className="tutorial-coach">
        <div className="tutorial-coach-top">
          <span className="tutorial-progress">{progressLabel}</span>
          <button type="button" className="ghost-btn tutorial-skip" onClick={skipTutorial}>
            Skip
          </button>
        </div>
        <h2 id="tut-title">{step.title}</h2>
        <p>{step.body}</p>
        {step.action && <p className="tutorial-action">{step.action}</p>}
        <div className="tutorial-coach-foot">
          <button type="button" className="ghost-btn" onClick={advanceTutorial}>
            Skip this step
          </button>
        </div>
      </div>
    </div>
  )
}
