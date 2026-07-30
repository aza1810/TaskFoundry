import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME, APP_TAGLINE, titleForLevel, xpForLevel } from '../game/data'
import { SKILL_IDS } from '../game/skills'
import { useGame } from '../game/GameContext'
import { SkillIcon } from '../sprites/SkillIcons'

function formatSteps(n: number): string {
  return Math.floor(n).toLocaleString()
}

export function HeroStatus() {
  const { state, rename, reset } = useGame()
  const { session, signOut } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.playerName)
  const needed = xpForLevel(state.level)
  const pct = Math.min(100, (state.xp / needed) * 100)

  return (
    <header className="hero">
      <div className="hero-brand">
        <p className="brand">{APP_NAME}</p>
        <p className="tagline">{APP_TAGLINE}</p>
        {session && (
          <p className="auth-session">
            {session.isGuest
              ? 'Guest'
              : session.provider === 'google'
                ? `Google · ${session.displayName}`
                : `@${session.username}`}
          </p>
        )}
      </div>

      <div className="hero-status">
        <dl className="status-strip" aria-label="Operator status">
          <div className="status-cell">
            <dt>Name</dt>
            <dd>
              {editing ? (
                <form
                  className="name-form status-name-form"
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
                <button
                  type="button"
                  className="status-name-btn"
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

          <div className="status-cell">
            <dt>Level</dt>
            <dd>
              <span className="status-value">{state.level}</span>
              <span className="status-sub">{titleForLevel(state.level)}</span>
            </dd>
          </div>

          <div className="status-cell status-steps">
            <dt>Steps</dt>
            <dd>
              <span className="status-value">{formatSteps(state.stepsToday)}</span>
              <span className="status-sub">
                today · {formatSteps(state.stepsLifetime)} life
              </span>
            </dd>
          </div>
        </dl>

        <div className="xp-block">
          <div className="xp-meta">
            <span>XP to Lv {state.level + 1}</span>
            <span>
              {Math.floor(state.xp)} / {needed}
            </span>
          </div>
          <div className="xp-track" aria-hidden>
            <div className="xp-fill" style={{ width: `${pct}%` }} />
            <div className="belt-teeth" />
          </div>
        </div>

        <div className="hero-skills" aria-label="Skill levels">
          {SKILL_IDS.map((id) => (
            <SkillIcon
              key={id}
              id={id}
              level={state.skills[id].level}
              size="sm"
              lit={(state.lastSkillGains?.[id] ?? 0) > 0}
            />
          ))}
        </div>

        <div className="hero-actions">
          <button type="button" className="ghost-btn" onClick={signOut}>
            Sign out
          </button>
          <button type="button" className="ghost-btn" onClick={reset}>
            Scrap save
          </button>
        </div>
      </div>
    </header>
  )
}
