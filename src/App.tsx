import { useCallback, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { saveKeyForAccount } from './auth/auth'
import { AuthScreen } from './components/AuthScreen'
import { CraftPanel } from './components/CraftPanel'
import { FactoryGrid } from './components/FactoryGrid'
import { GoalsBar } from './components/GoalsBar'
import { HabitsPanel } from './components/HabitsPanel'
import { HeroStatus } from './components/HeroStatus'
import { InventoryBar } from './components/InventoryBar'
import { ResearchPanel } from './components/ResearchPanel'
import { SkillsPanel } from './components/SkillsPanel'
import { StepsPanel } from './components/StepsPanel'
import { TutorialOverlay } from './components/TutorialOverlay'
import { GameProvider, useGame } from './game/GameContext'
import { usePedometer } from './hooks/usePedometer'
import type { TabId } from './game/types'
import './index.css'

const TABS: { id: TabId; label: string }[] = [
  { id: 'factory', label: 'Foundry' },
  { id: 'steps', label: 'Steps' },
  { id: 'skills', label: 'Skills' },
  { id: 'craft', label: 'Craft' },
  { id: 'research', label: 'Research' },
  { id: 'habits', label: 'Tasks' },
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

function Shell() {
  const [tab, setTab] = useState<TabId>('factory')
  const { logSteps } = useGame()
  const pedometer = usePedometer(logSteps)
  const requestTab = useCallback((t: TabId) => setTab(t), [])

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden>
        <div className="belt-strip" />
        <div className="haze" />
        <div className="grid-floor" />
      </div>

      <div className="shell">
        <HeroStatus />
        <GoalsBar />
        <InventoryBar />

        <nav className="tabs" aria-label="Factory stations">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'tab is-active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'steps' && pedometer.status === 'listening' ? ' · live' : ''}
            </button>
          ))}
        </nav>

        <main className="main" key={tab}>
          {tab === 'factory' && <FactoryGrid />}
          {tab === 'steps' && <StepsPanel pedometer={pedometer} />}
          {tab === 'skills' && <SkillsPanel />}
          {tab === 'craft' && <CraftPanel />}
          {tab === 'research' && <ResearchPanel />}
          {tab === 'habits' && <HabitsPanel />}
        </main>
      </div>

      {pedometer.status === 'listening' && tab !== 'steps' && (
        <PedometerChip
          sessionSteps={pedometer.sessionSteps}
          onStop={pedometer.stop}
          onOpen={() => setTab('steps')}
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
