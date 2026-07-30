import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME, APP_TAGLINE, titleForLevel, xpForLevel } from '../game/data'
import { SKILL_IDS } from '../game/skills'
import { useGame } from '../game/GameContext'
import { SkillIcon } from '../sprites/SkillIcons'

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
            {session.isGuest ? 'Guest' : `@${session.username}`}
          </p>
        )}
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
