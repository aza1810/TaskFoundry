import { useState } from 'react'
import { titleForLevel, xpForLevel } from '../game/data'
import { useGame } from '../game/GameContext'

export function HeroStatus() {
  const { state, rename, reset } = useGame()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.playerName)
  const needed = xpForLevel(state.level)
  const pct = Math.min(100, (state.xp / needed) * 100)

  return (
    <header className="hero">
      <div className="hero-brand">
        <p className="brand">Habitworks</p>
        <p className="tagline">Walk. Check. Automate.</p>
      </div>

      <div className="hero-status">
        {editing ? (
          <form
            className="name-form"
            onSubmit={(e) => {
              e.preventDefault()
              rename(name)
              setEditing(false)
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-label="Operator name"
            />
            <button type="submit">Save</button>
          </form>
        ) : (
          <button type="button" className="name-btn" onClick={() => setEditing(true)}>
            <span className="operator">{state.playerName}</span>
            <span className="title">{titleForLevel(state.level)}</span>
          </button>
        )}

        <div className="xp-block">
          <div className="xp-meta">
            <span>Lv {state.level}</span>
            <span>
              {Math.floor(state.xp)} / {needed} XP
            </span>
          </div>
          <div className="xp-track" aria-hidden>
            <div className="xp-fill" style={{ width: `${pct}%` }} />
            <div className="belt-teeth" />
          </div>
        </div>

        <button type="button" className="ghost-btn" onClick={reset}>
          Scrap save
        </button>
      </div>
    </header>
  )
}
