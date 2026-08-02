import { useCallback, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { saveKeyForAccount } from './auth/auth'
import { AuthScreen } from './components/AuthScreen'
import { CraftPanel } from './components/CraftPanel'
import { FactoryFloor } from './components/FactoryFloor'
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

function Shell() {
  const [tab, setTab] = useState<TabId>('factory')
  const { state, logSteps } = useGame()
  const pedometer = usePedometer(logSteps)
  const requestTab = useCallback((t: TabId) => setTab(t), [])
  const playing = tab === 'factory'

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

  const sheetLabel = TABS.find((t) => t.id === tab)?.label ?? ''

  return (
    <div
      className={[
        'app',
        'app-game',
        playing ? 'is-playing' : 'has-sheet',
        coaching ? 'is-coaching' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="atmosphere" aria-hidden>
        <div className="belt-strip" />
        <div className="haze" />
        <div className="grid-floor" />
      </div>

      {/* Floor stays mounted so the world keeps feeling alive under sheets */}
      <div className={`game-stage ${playing ? 'is-front' : 'is-back'}`}>
        <FactoryFloor
          highlight={highlight}
          pedometer={pedometer}
          onOpenTasks={() => setTabSafe('habits')}
          onOpenSteps={() => setTabSafe('steps')}
        />
      </div>

      {!playing && (
        <div className="game-sheet" role="dialog" aria-label={sheetLabel}>
          <header className="game-sheet-bar">
            <button
              type="button"
              className="game-sheet-back"
              onClick={() => setTabSafe('factory')}
            >
              ← Floor
            </button>
            <h2 className="game-sheet-title">{sheetLabel}</h2>
            <div className="game-sheet-status">
              <TopStatusBar />
            </div>
          </header>
          <main className="game-sheet-body" key={tab}>
            {tab === 'inventory' && <InventoryPanel />}
            {tab === 'steps' && (
              <StepsPanel
                pedometer={pedometer}
                highlightManual={highlight === 'manualSteps'}
              />
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
      )}

      <nav className="bottom-nav game-dock" aria-label="Game sections">
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
                t.id === 'factory' ? 'is-floor-btn' : '',
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
