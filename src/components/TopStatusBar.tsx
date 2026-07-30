import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME, titleForLevel, xpForLevel } from '../game/data'
import { useGame } from '../game/GameContext'

function formatSteps(n: number): string {
  return Math.floor(n).toLocaleString()
}

/** Compact sticky operator status — Name / Level / Steps. */
export function TopStatusBar() {
  const { state, rename, reset } = useGame()
  const { session, signOut } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.playerName)
  const [menuOpen, setMenuOpen] = useState(false)
  const needed = xpForLevel(state.level)
  const pct = Math.min(100, (state.xp / needed) * 100)

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <p className="topbar-title">{APP_NAME}</p>
        {session && (
          <p className="topbar-account">
            {session.isGuest
              ? 'Guest'
              : session.provider === 'google'
                ? session.displayName
                : `@${session.username}`}
          </p>
        )}
      </div>

      <dl className="topbar-stats" aria-label="Operator status">
        <div className="topbar-stat">
          <dt>Name</dt>
          <dd>
            {editing ? (
              <form
                className="topbar-name-form"
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
              </form>
            ) : (
              <button
                type="button"
                className="topbar-name"
                onClick={() => {
                  setName(state.playerName)
                  setEditing(true)
                }}
              >
                {state.playerName}
              </button>
            )}
          </dd>
        </div>
        <div className="topbar-stat">
          <dt>Level</dt>
          <dd>
            <span className="topbar-value">{state.level}</span>
            <span className="topbar-sub" title={titleForLevel(state.level)}>
              {titleForLevel(state.level)}
            </span>
          </dd>
        </div>
        <div className="topbar-stat">
          <dt>Steps</dt>
          <dd>
            <span className="topbar-value">{formatSteps(state.stepsToday)}</span>
            <span className="topbar-sub">today</span>
          </dd>
        </div>
      </dl>

      <div className="topbar-xp" aria-hidden>
        <div className="topbar-xp-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="topbar-menu">
        <button
          type="button"
          className="topbar-menu-btn"
          aria-expanded={menuOpen}
          aria-label="Account menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          ···
        </button>
        {menuOpen && (
          <div className="topbar-menu-pop">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                signOut()
              }}
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                reset()
              }}
            >
              Scrap save
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
