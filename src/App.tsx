import { useState } from 'react'
import { CraftPanel } from './components/CraftPanel'
import { FactoryGrid } from './components/FactoryGrid'
import { HabitsPanel } from './components/HabitsPanel'
import { HeroStatus } from './components/HeroStatus'
import { InventoryBar } from './components/InventoryBar'
import { StepsPanel } from './components/StepsPanel'
import { GameProvider, useGame } from './game/GameContext'
import type { TabId } from './game/types'
import './index.css'

const TABS: { id: TabId; label: string }[] = [
  { id: 'factory', label: 'Factory' },
  { id: 'steps', label: 'Steps' },
  { id: 'craft', label: 'Craft' },
  { id: 'habits', label: 'Habits' },
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

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden>
        <div className="belt-strip" />
        <div className="haze" />
        <div className="grid-floor" />
      </div>

      <div className="shell">
        <HeroStatus />
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
            </button>
          ))}
        </nav>

        <main className="main" key={tab}>
          {tab === 'factory' && <FactoryGrid />}
          {tab === 'steps' && <StepsPanel />}
          {tab === 'craft' && <CraftPanel />}
          {tab === 'habits' && <HabitsPanel />}
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
