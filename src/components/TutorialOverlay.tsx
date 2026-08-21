import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useGame } from '../game/GameContext'
import {
  getTutorialStep,
  TUTORIAL_STEP_COUNT,
  type TutorialStepId,
} from '../game/tutorial'
import {
  tutorialChecklist,
  tutorialCoachHint,
  tutorialRecommendedTool,
} from '../game/tutorialGuide'
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
    selectTool,
  } = useGame()
  const stepIndex = state.tutorialStep
  const active = !state.tutorialComplete && stepIndex !== null
  const step = active ? getTutorialStep(stepIndex) : null
  const checks = useMemo(
    () => tutorialChecklist(state, step),
    [state, step],
  )
  const recommended = tutorialRecommendedTool(checks, step?.autoSelect)
  const hint = tutorialCoachHint(state, step, checks)
  const allDone = checks.length > 0 && checks.every((c) => c.done)
  const advancedFor = useRef<string | null>(null)
  const progressPct = Math.round(
    ((Math.min(stepIndex ?? 0, TUTORIAL_STEP_COUNT - 1) + (allDone ? 1 : 0)) /
      TUTORIAL_STEP_COUNT) *
      100,
  )

  useEffect(() => {
    if (!active || !recommended) return
    selectTool(recommended)
  }, [active, step?.id, recommended, selectTool])

  useEffect(() => {
    if (!active || !step?.tab) return
    onRequestTab(step.tab)
  }, [active, step?.id, step?.tab, onRequestTab])

  useEffect(() => {
    if (!active || !step || step.mode !== 'coach') return
    if (checks.length > 0 && checks.every((c) => c.done)) {
      if (advancedFor.current === step.id) return
      advancedFor.current = step.id
      advanceTutorial()
    }
  }, [active, step, checks, advanceTutorial])

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
          {step.id === 'welcome' && (
            <div className="tutorial-loop" aria-hidden>
              <span>Walk</span>
              <i>→</i>
              <span>Mine</span>
              <i>→</i>
              <span>Store</span>
              <i>→</i>
              <span>Smelt</span>
            </div>
          )}
          <p>{step.body}</p>
          {step.id === 'welcome' ? (
            <div className="tutorial-actions tutorial-actions-stack">
              <button type="button" className="primary-btn" onClick={advanceTutorial}>
                Construct my first roboport
              </button>
              <button type="button" className="ghost-btn" onClick={skipTutorial}>
                Skip - I will explore
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
      <div
        className={`tutorial-coach${checks.length > 0 ? ' is-compact' : ''}`}
        key={step.id}
      >
        <div className="tutorial-coach-top">
          <span className="tutorial-progress">{progressLabel}</span>
          <button type="button" className="ghost-btn tutorial-skip" onClick={skipTutorial}>
            Skip tour
          </button>
        </div>
        <div
          className="tutorial-bar"
          aria-hidden
          style={{ '--tut-pct': `${progressPct}%` } as CSSProperties}
        />
        <h2 id="tut-title">{step.title}</h2>
        {checks.length > 0 && (
          <ul className="tutorial-checks">
            {checks.map((item) => (
              <li
                key={item.id}
                className={item.done ? 'is-done' : 'is-todo'}
              >
                <span aria-hidden>{item.done ? '✓' : '○'}</span>
                {item.label}
              </li>
            ))}
          </ul>
        )}
        {hint && <p className="tutorial-action">{hint}</p>}
        <div className="tutorial-coach-foot">
          <button type="button" className="ghost-btn" onClick={advanceTutorial}>
            Skip this step
          </button>
        </div>
      </div>
    </div>
  )
}
