import { BUILDINGS, RESOURCE_META, canAfford, formatNum } from '../game/data'
import { isBuildingUnlocked } from '../game/logic'
import { useGame } from '../game/GameContext'
import type { ResourceId } from '../game/types'

export function YardPanel() {
  const { state, buyBuilding } = useGame()

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Factory Yard</h2>
        <p>
          Place machines. They keep mining, smelting, assembling, and researching while
          you are away — Factorio-style idle lines.
        </p>
      </div>

      <ul className="building-list">
        {BUILDINGS.map((b) => {
          const unlocked = isBuildingUnlocked(state, b.id)
          const owned = state.buildings[b.id] ?? 0
          const affordable = canAfford(state.resources, b.cost)
          return (
            <li key={b.id} className={`building ${unlocked ? '' : 'is-locked'}`}>
              <div className="building-main">
                <div className="building-title-row">
                  <h3>{b.name}</h3>
                  <span className="owned">×{owned}</span>
                </div>
                <p>{b.description}</p>
                {b.produces && (
                  <p className="building-prod">
                    Idle:{' '}
                    {(Object.entries(b.produces) as [ResourceId, number][])
                      .map(
                        ([id, n]) =>
                          `+${formatNum(n)}/s ${RESOURCE_META[id].label}`,
                      )
                      .join(' · ')}
                  </p>
                )}
                {b.autoKind && (
                  <p className="building-prod">
                    Auto-{b.autoKind} · speed ×{b.craftSpeed}
                  </p>
                )}
                <p className="building-cost">
                  Cost:{' '}
                  {(Object.entries(b.cost) as [ResourceId, number][])
                    .map(([id, n]) => `${formatNum(n)} ${RESOURCE_META[id].label}`)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                className="primary-btn"
                disabled={!unlocked || !affordable}
                onClick={() => buyBuilding(b.id)}
              >
                {!unlocked ? 'Locked' : 'Build'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
