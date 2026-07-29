import { useState } from 'react'
import { FactoryPanel } from './components/FactoryPanel'
import { HabitsPanel } from './components/HabitsPanel'
import { HeroStatus } from './components/HeroStatus'
import { ResearchPanel } from './components/ResearchPanel'
import { ResourcesBar } from './components/ResourcesBar'
import { StepsPanel } from './components/StepsPanel'
import { YardPanel } from './components/YardPanel'
import { GameProvider, useGame } from './game/GameContext'
import type { TabId } from './game/types'
import './index.css'

const TABS: { id: TabId; label: string }[] = [
  { id: 'habits', label: 'Habits' },
  { id: 'steps', label: 'Steps' },
  { id: 'factory', label: 'Craft' },
  { id: 'yard', label: 'Yard' },
  { id: 'research', label: 'Research' },
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
  const [tab, setTab] = useState<TabId>('habits')

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden>
        <div className="belt-strip" />
        <div className="haze" />
        <div className="grid-floor" />
      </div>

      <div className="shell">
        <HeroStatus />
        <ResourcesBar />

        <nav className="tabs" aria-label="Factory stations">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'tab is-active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="main" key={tab}>
          {tab === 'habits' && <HabitsPanel />}
          {tab === 'steps' && <StepsPanel />}
          {tab === 'factory' && <FactoryPanel />}
          {tab === 'yard' && <YardPanel />}
          {tab === 'research' && <ResearchPanel />}
        </main>
      </div>

      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  )
}
