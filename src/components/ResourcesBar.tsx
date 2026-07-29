import { RESOURCE_META, formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import type { ResourceId } from '../game/types'

const ORDER: ResourceId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'steel',
  'gear',
  'copperCable',
  'circuit',
  'redScience',
  'greenScience',
]

export function ResourcesBar() {
  const { state, rates } = useGame()

  return (
    <div className="resources" aria-label="Inventory">
      {ORDER.map((id) => {
        const meta = RESOURCE_META[id]
        const amount = state.resources[id]
        const rate = rates[id] ?? 0
        if (amount < 0.05 && rate <= 0 && !['ironOre', 'copperOre', 'coal', 'ironPlate'].includes(id)) {
          return null
        }
        return (
          <div key={id} className="resource" title={meta.label}>
            <span className="resource-swatch" style={{ background: meta.color }} />
            <div className="resource-text">
              <span className="resource-label">{meta.label}</span>
              <span className="resource-amount">{formatNum(amount)}</span>
              {rate > 0 && (
                <span className="resource-rate">+{formatNum(rate)}/s</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
