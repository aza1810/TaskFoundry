import { TECHS, formatNum } from '../game/data'
import { isTechAvailable } from '../game/logic'
import { useGame } from '../game/GameContext'

export function ResearchPanel() {
  const { state, startResearch } = useGame()

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Research Tree</h2>
        <p>
          Stock science packs and start a project. You can hand-study slowly; labs
          accelerate progress and keep researching offline.
        </p>
        {state.activeResearch && (
          <p className="panel-stat">
            Active: {TECHS.find((t) => t.id === state.activeResearch)?.name} ·{' '}
            {formatNum(state.researchProgress[state.activeResearch] ?? 0)} packs sunk
          </p>
        )}
      </div>

      <ul className="tech-list">
        {TECHS.map((tech) => {
          const done = state.researched.includes(tech.id)
          const available = isTechAvailable(state, tech.id)
          const progress = state.researchProgress[tech.id] ?? 0
          const needed =
            (tech.cost.redScience ?? 0) + (tech.cost.greenScience ?? 0) || 1
          const pct = done ? 100 : Math.min(100, (progress / needed) * 100)
          const active = state.activeResearch === tech.id

          return (
            <li
              key={tech.id}
              className={`tech ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}
            >
              <div className="tech-main">
                <h3>{tech.name}</h3>
                <p>{tech.description}</p>
                <p className="tech-cost">
                  {tech.cost.redScience
                    ? `${tech.cost.redScience} red science`
                    : null}
                  {tech.cost.redScience && tech.cost.greenScience ? ' · ' : ''}
                  {tech.cost.greenScience
                    ? `${tech.cost.greenScience} green science`
                    : null}
                  {tech.requires?.length
                    ? ` · needs ${tech.requires.join(', ')}`
                    : ''}
                </p>
                <div className="tech-track">
                  <div className="tech-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <button
                type="button"
                className="primary-btn"
                disabled={done || !available}
                onClick={() => startResearch(tech.id)}
              >
                {done ? 'Done' : active ? 'Researching' : available ? 'Research' : 'Locked'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
