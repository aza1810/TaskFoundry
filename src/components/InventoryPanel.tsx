import { ITEM_META, formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import { ItemSprite } from '../sprites/Sprites'
import type { ItemId } from '../game/types'

const INV_ORDER: ItemId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'steel',
  'gear',
  'drill',
  'electricDrill',
  'belt',
  'fastBelt',
  'undergroundBelt',
  'inserter',
  'longInserter',
  'splitter',
  'furnace',
  'steelFurnace',
  'chest',
  'assembler',
]

export function InventoryPanel() {
  const { state } = useGame()
  const items = INV_ORDER.filter((id) => state.inventory[id] > 0)
  const empty = items.length === 0

  return (
    <section className="panel inventory-panel">
      <div className="panel-head">
        <h2>Inventory</h2>
        <p>Raw materials, plates, and buildings you can place on the floor.</p>
      </div>

      {empty ? (
        <p className="inv-empty">Empty — mine ore, complete tasks, or craft parts.</p>
      ) : (
        <div className="resources inv-grid" aria-label="Inventory">
          {items.map((id) => {
            const meta = ITEM_META[id]
            return (
              <div key={id} className="resource resource-tex" title={meta.label}>
                <span className="resource-icon">
                  <ItemSprite item={id} />
                </span>
                <div className="resource-text">
                  <span className="resource-label">{meta.label}</span>
                  <span className="resource-amount">{formatNum(state.inventory[id])}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
