import { ITEM_META, formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import { ItemSprite } from '../sprites/Sprites'
import type { ItemId } from '../game/types'

const MATERIALS: ItemId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'steel',
  'gear',
]

const BUILDINGS: ItemId[] = [
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

function InvSection({
  title,
  ids,
  inventory,
}: {
  title: string
  ids: ItemId[]
  inventory: Record<ItemId, number>
}) {
  return (
    <div className="inv-section">
      <h3>{title}</h3>
      <div className="resources inv-grid" aria-label={title}>
        {ids.map((id) => {
          const meta = ITEM_META[id]
          const n = inventory[id] ?? 0
          return (
            <div
              key={id}
              className={`resource resource-tex${n <= 0 ? ' is-zero' : ''}`}
              title={meta.label}
            >
              <span className="resource-icon">
                <ItemSprite item={id} />
              </span>
              <div className="resource-text">
                <span className="resource-label">{meta.label}</span>
                <span className="resource-amount">{formatNum(n)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function InventoryPanel() {
  const { state } = useGame()
  const total = [...MATERIALS, ...BUILDINGS].reduce(
    (sum, id) => sum + (state.inventory[id] ?? 0),
    0,
  )

  return (
    <section className="panel inventory-panel">
      <div className="panel-head">
        <h2>Inventory</h2>
        <p>Materials and buildings ready to place. Zeros stay visible so you know what’s missing.</p>
        <p className="panel-stat">{formatNum(total)} items on hand</p>
      </div>

      {total <= 0 && (
        <p className="inv-empty">
          Empty — mine ore, complete Tasks for free parts, or Craft buildings.
        </p>
      )}

      <InvSection title="Materials" ids={MATERIALS} inventory={state.inventory} />
      <InvSection title="Buildings" ids={BUILDINGS} inventory={state.inventory} />
    </section>
  )
}
