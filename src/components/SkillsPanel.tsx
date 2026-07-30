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

export function SkillsPanel() {
  const { state } = useGame()
  const active = countActiveLine(state.entities)
  const bonuses = skillBonuses(state.skills)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Operator Skills</h2>
        <p>
          Walking trains the skills your factory is using. Place drills to train Mining,
          light furnaces for Smelting, run belts for Logistics — every step also trains
          Fieldwork.
        </p>
      </div>

      <div className="skill-active">
        <p>
          This walk trains:{' '}
          <strong>Fieldwork</strong>
          {active.drills > 0 ? (
            <>
              {' '}
              · <strong>Mining</strong> ({active.drills} drills)
            </>
          ) : null}
          {active.furnaces > 0 ? (
            <>
              {' '}
              · <strong>Smelting</strong> ({active.furnaces} furnaces)
            </>
          ) : null}
          {active.logistics > 0 ? (
            <>
              {' '}
              · <strong>Logistics</strong> ({active.logistics} movers)
            </>
          ) : null}
        </p>
      </div>

      <ul className="skill-list">
        {SKILL_IDS.map((id) => {
          const def = SKILL_DEFS[id]
          const skill = state.skills[id]
          const maxed = skill.level >= MAX_SKILL_LEVEL
          const need = maxed ? 0 : skillXpForLevel(skill.level)
          const pct = maxed ? 100 : Math.min(100, (skill.xp / need) * 100)
          const next = nextPerkLabel(id, skill.level)
          return (
            <li key={id} className="skill-card">
              <div className="skill-card-head">
                <h3 style={{ color: def.color }}>{def.name}</h3>
                <span className="skill-level">
                  Lv {skill.level}/{MAX_SKILL_LEVEL}
                </span>
              </div>
              <p className="skill-detail">{def.detail}</p>
              <div className="skill-track" aria-hidden>
                <div
                  className="skill-fill"
                  style={{ width: `${pct}%`, background: def.color }}
                />
              </div>
              <p className="skill-xp">
                {maxed
                  ? 'Maxed'
                  : `${Math.floor(skill.xp)} / ${need} XP → next perk`}
              </p>
              {next && !maxed && (
                <p className="skill-next">Next: {next}</p>
              )}
              <ul className="skill-perks">
                {def.perks.map((perk) => (
                  <li
                    key={perk.level}
                    className={
                      skill.level >= perk.level ? 'perk is-owned' : 'perk is-locked'
                    }
                  >
                    <span className="perk-lv">Lv {perk.level}</span>
                    <span>{perk.label}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>

      <div className="skill-bonuses">
        <h3>Active bonuses</h3>
        <ul>
          <li>Ore yield ×{bonuses.mineYieldMult.toFixed(2)}</li>
          <li>Furnace speed ×{bonuses.furnaceSpeedMult.toFixed(2)}</li>
          <li>Belt speed ×{bonuses.beltSpeedMult.toFixed(2)}</li>
          <li>Inserter speed ×{bonuses.inserterSpeedMult.toFixed(2)}</li>
          <li>Habit rewards ×{bonuses.habitRewardMult.toFixed(2)}</li>
          <li>UG belt range {6 + bonuses.ugBonus}</li>
        </ul>
      </div>
    </section>
  )
}
