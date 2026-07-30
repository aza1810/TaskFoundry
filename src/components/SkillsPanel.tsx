import { useState } from 'react'
import {
  MAX_SKILL_LEVEL,
  SKILL_DEFS,
  SKILL_IDS,
  countActiveLine,
  nextPerkLabel,
  skillBonuses,
  skillXpForLevel,
} from '../game/skills'
import { useGame } from '../game/GameContext'
import { SkillIcon } from '../sprites/SkillIcons'
import type { SkillId } from '../game/types'

export function SkillsPanel() {
  const { state, toggleFocus } = useGame()
  const active = countActiveLine(state.entities)
  const bonuses = skillBonuses(state.skills)
  const [selected, setSelected] = useState<SkillId>('mining')
  const def = SKILL_DEFS[selected]
  const skill = state.skills[selected]
  const maxed = skill.level >= MAX_SKILL_LEVEL
  const need = maxed ? 0 : skillXpForLevel(skill.level)
  const pct = maxed ? 100 : Math.min(100, (skill.xp / need) * 100)
  const next = nextPerkLabel(selected, skill.level)
  const focused = state.focusSkills ?? []

  const training: SkillId[] = ['fieldwork']
  if (active.drills > 0) training.push('mining')
  if (active.furnaces > 0) training.push('smelting')
  if (active.logistics > 0) training.push('logistics')
  if (active.assemblers > 0 || state.craftQueue.length > 0) training.push('assembly')

  return (
    <section className="panel skills-panel">
      <div className="panel-head">
        <h2>Skills</h2>
        <p>
          Tap an icon for perks. Focus up to 2 skills for ×1.5 step XP. Walk to train
          whatever your floor is running.
        </p>
      </div>

      <div className="skill-focus-bar">
        Focus:{' '}
        {focused.length === 0 ? (
          <em>none — tap Focus on a skill</em>
        ) : (
          focused.map((id) => SKILL_DEFS[id].name).join(' · ')
        )}
      </div>

      <div className="skill-board">
        <ul className="skill-grid" role="list">
          {SKILL_IDS.map((id) => {
            const d = SKILL_DEFS[id]
            const s = state.skills[id]
            const isTraining = training.includes(id)
            const isSelected = selected === id
            const pulse = state.lastSkillGains?.[id] ?? 0
            const isFocus = focused.includes(id)
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`skill-tile ${isSelected ? 'is-selected' : ''} ${
                    isTraining ? 'is-training' : ''
                  } ${isFocus ? 'is-focus' : ''}`}
                  onClick={() => setSelected(id)}
                  aria-pressed={isSelected}
                  title={`${d.name} — level ${s.level}`}
                >
                  <SkillIcon id={id} level={s.level} lit={isTraining || pulse > 0} size="lg" />
                  <span className="skill-tile-name">{d.name}</span>
                  {isFocus && <span className="skill-tile-focus">Focus</span>}
                  {pulse > 0 && <span className="skill-tile-gain">+{pulse}</span>}
                  {isTraining && pulse <= 0 && !isFocus && (
                    <span className="skill-tile-pulse">Training</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="skill-inspect">
          <div className="skill-inspect-top">
            <SkillIcon
              id={selected}
              level={skill.level}
              lit={training.includes(selected)}
              size="lg"
            />
            <div className="skill-inspect-meta">
              <h3 style={{ color: def.color }}>{def.name}</h3>
              <p className="skill-inspect-lv">
                Level {skill.level}
                <span> / {MAX_SKILL_LEVEL}</span>
              </p>
              <p className="skill-detail">{def.detail}</p>
            </div>
          </div>

          <div className="skill-xp-block">
            <div className="skill-xp-meta">
              <span>{maxed ? 'Max level' : 'Experience'}</span>
              <span>{maxed ? '—' : `${Math.floor(skill.xp)} / ${need}`}</span>
            </div>
            <div className="skill-track" aria-hidden>
              <div
                className="skill-fill"
                style={{ width: `${pct}%`, background: def.color }}
              />
            </div>
            {next && !maxed && <p className="skill-next">Next unlock: {next}</p>}
          </div>

          <button
            type="button"
            className={`primary-btn focus-btn ${focused.includes(selected) ? 'is-on' : ''}`}
            onClick={() => toggleFocus(selected)}
          >
            {focused.includes(selected) ? 'Clear focus' : 'Focus this skill (×1.5 XP)'}
          </button>

          <ul className="skill-perks">
            {def.perks.map((perk) => (
              <li
                key={perk.level}
                className={skill.level >= perk.level ? 'perk is-owned' : 'perk is-locked'}
              >
                <span className="perk-lv">{perk.level}</span>
                <span>{perk.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="skill-active">
        <p>
          Currently training:{' '}
          {training.map((id, i) => (
            <span key={id}>
              {i > 0 ? ' · ' : ''}
              <strong>{SKILL_DEFS[id].name}</strong>
            </span>
          ))}
        </p>
      </div>

      <div className="skill-bonuses">
        <h3>Active bonuses</h3>
        <ul>
          <li>Ore yield ×{bonuses.mineYieldMult.toFixed(2)}</li>
          <li>Furnace speed ×{bonuses.furnaceSpeedMult.toFixed(2)}</li>
          <li>Belt speed ×{bonuses.beltSpeedMult.toFixed(2)}</li>
          <li>Assembler speed ×{bonuses.assemblerSpeedMult.toFixed(2)}</li>
          <li>Hand craft ×{bonuses.handCraftSpeedMult.toFixed(2)}</li>
          <li>Task rewards ×{bonuses.habitRewardMult.toFixed(2)}</li>
          <li>UG belt range {6 + bonuses.ugBonus}</li>
        </ul>
      </div>
    </section>
  )
}
