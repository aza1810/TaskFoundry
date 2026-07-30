import { useCallback, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { saveKeyForAccount } from './auth/auth'
import { AuthScreen } from './components/AuthScreen'
import { BuildToolbar } from './components/BuildToolbar'
import { CraftPanel } from './components/CraftPanel'
import { FactoryGrid } from './components/FactoryGrid'
import { GoalsBar } from './components/GoalsBar'
import { HabitsPanel } from './components/HabitsPanel'
import { InventoryPanel } from './components/InventoryPanel'
import { ResearchPanel } from './components/ResearchPanel'
import { SkillsPanel } from './components/SkillsPanel'
import { StepsPanel } from './components/StepsPanel'
import { TopStatusBar } from './components/TopStatusBar'
import { TutorialOverlay } from './components/TutorialOverlay'
import { GameProvider, useGame } from './game/GameContext'
import { usePedometer } from './hooks/usePedometer'
import { activeGoal } from './game/goals'
import { getTutorialStep, unlockedTabsFor } from './game/tutorial'
import type { TabId } from './game/types'
import './index.css'

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: 'factory', label: 'Floor', short: 'Floor' },
  { id: 'inventory', label: 'Inventory', short: 'Inv' },
  { id: 'steps', label: 'Steps', short: 'Steps' },
  { id: 'craft', label: 'Craft', short: 'Craft' },
  { id: 'research', label: 'Research', short: 'Lab' },
  { id: 'skills', label: 'Skills', short: 'Skills' },
  { id: 'habits', label: 'Tasks', short: 'Tasks' },
]

function Toast() {
  const { state, clearToast } = useGame()
  if (!state.unlockedToast) return null
  return (
    <div className="toast" role="status">
      <span>{state.unlockedToast}</span>
      <button type="button" onClick={clearToast} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}

function PedometerChip({
  sessionSteps,
  onStop,
  onOpen,
}: {
  sessionSteps: number
  onStop: () => void
  onOpen: () => void
}) {
  return (
    <div className="pedo-chip" role="status">
      <button type="button" className="pedo-chip-main" onClick={onOpen}>
        <span className="pedo-chip-dot" aria-hidden />
        Pedometer · {sessionSteps} this walk
      </button>
      <button type="button" className="pedo-chip-stop" onClick={onStop}>
        Stop
      </button>
    </div>
  )
}

function ObjectiveChip({ onOpenTasks }: { onOpenTasks: () => void }) {
  const { state } = useGame()
  const goal = activeGoal(state)
  if (!goal) return null
  return (
    <button type="button" className="objective-chip" onClick={onOpenTasks}>
      <span className="objective-chip-label">Objective</span>
      <span className="objective-chip-title">{goal.title}</span>
    </button>
  )
}

function Shell() {
  const [tab, setTab] = useState<TabId>('factory')
  const { state, logSteps } = useGame()
  const pedometer = usePedometer(logSteps)
  const requestTab = useCallback((t: TabId) => setTab(t), [])

  const tutorialStep = getTutorialStep(
    state.tutorialComplete ? null : state.tutorialStep,
  )
  const unlocked = useMemo(
    () => unlockedTabsFor(state.tutorialStep, state.tutorialComplete),
    [state.tutorialStep, state.tutorialComplete],
  )
  const highlight = tutorialStep?.highlight ?? null
  const coaching = Boolean(tutorialStep && tutorialStep.mode === 'coach')

  const setTabSafe = useCallback(
    (t: TabId) => {
      if (!unlocked.includes(t)) return
      setTab(t)
    },
    [unlocked],
  )

  return (
    <div className={`app app-sections ${coaching ? 'is-coaching' : ''}`}>
      <div className="atmosphere" aria-hidden>
        <div className="belt-strip" />
        <div className="haze" />
        <div className="grid-floor" />
      </div>

      <div className="shell">
        <TopStatusBar />

        <main className="main" key={tab}>
          {tab === 'factory' && (
            <div className="section-floor">
              <ObjectiveChip onOpenTasks={() => setTabSafe('habits')} />
              <BuildToolbar highlight={highlight} />
              <FactoryGrid highlightOre={highlight === 'ore'} />
            </div>
          )}
          {tab === 'inventory' && <InventoryPanel />}
          {tab === 'steps' && (
            <StepsPanel pedometer={pedometer} highlightManual={highlight === 'manualSteps'} />
          )}
          {tab === 'skills' && <SkillsPanel />}
          {tab === 'craft' && <CraftPanel />}
          {tab === 'research' && <ResearchPanel />}
          {tab === 'habits' && (
            <div className="section-tasks">
              <GoalsBar />
              <HabitsPanel highlightHabit={highlight === 'habit'} />
            </div>
          )}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Sections">
        {TABS.map((t) => {
          const locked = !unlocked.includes(t.id)
          const focus = tutorialStep?.tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={[
                'bottom-nav-btn',
                tab === t.id ? 'is-active' : '',
                locked ? 'is-locked' : '',
                focus ? 'is-tour-focus' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setTabSafe(t.id)}
              disabled={locked}
              title={locked ? 'Finish the tour to unlock' : t.label}
            >
              <span className="bottom-nav-label">{t.short}</span>
              {t.id === 'steps' && pedometer.status === 'listening' && (
                <span className="bottom-nav-live">live</span>
              )}
            </button>
          )
        })}
      </nav>

      {pedometer.status === 'listening' && tab !== 'steps' && (
        <PedometerChip
          sessionSteps={pedometer.sessionSteps}
          onStop={pedometer.stop}
          onOpen={() => setTabSafe('steps')}
        />
      )}

      <TutorialOverlay onRequestTab={requestTab} />
      <Toast />
    </div>
  )
}

function AuthenticatedApp() {
  const { session } = useAuth()
  if (!session) return <AuthScreen />

  return (
    <GameProvider
      key={session.accountId}
      saveKey={saveKeyForAccount(session.accountId)}
      displayName={session.displayName}
    >
      <Shell />
    </GameProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}
