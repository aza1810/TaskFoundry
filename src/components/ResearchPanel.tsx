import { ITEM_META, canAfford } from '../game/data'
import { TECHS } from '../game/research'
import { useGame } from '../game/GameContext'
import type { ItemId, TechId } from '../game/types'

export function ResearchPanel() {
  const { state, research } = useGame()

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Research Lab</h2>
        <p>
          Spend plates and gears to unlock faster belts, electric drills, and splitters.
          Hand crafting of unlocked items appears on the Craft tab.
        </p>
      </div>

      <ul className="tech-list">
        {TECHS.map((tech) => {
          const done = state.researched.includes(tech.id)
          const affordable = canAfford(state.inventory, tech.cost)
          return (
            <li key={tech.id} className={`tech ${done ? 'is-done' : ''}`}>
              <div className="tech-main">
                <h3>{tech.name}</h3>
                <p>{tech.detail}</p>
                <p className="tech-cost">
                  {(Object.entries(tech.cost) as [ItemId, number][])
                    .map(([id, n]) => `${n} ${ITEM_META[id].label}`)
                    .join(' · ')}
                </p>
                <p className="tech-cost">Unlocks: {tech.unlocks}</p>
              </div>
              <button
                type="button"
                className="primary-btn"
                disabled={done || !affordable}
                onClick={() => research(tech.id as TechId)}
              >
                {done ? 'Done' : affordable ? 'Research' : 'Need mats'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
