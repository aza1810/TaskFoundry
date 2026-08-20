import { ITEM_META, formatNum } from '../game/data'
import { warehouseHudAmount } from '../game/chestInventory'
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
  'wood',
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
  amounts,
}: {
  title: string
  ids: ItemId[]
  amounts: Partial<Record<ItemId, number>>
}) {
  return (
    <div className="inv-section">
      <h3>{title}</h3>
      <div className="resources inv-grid" aria-label={title}>
        {ids.map((id) => {
          const meta = ITEM_META[id]
          const n = amounts[id] ?? 0
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
  const materials = Object.fromEntries(
    MATERIALS.map((id) => [id, warehouseHudAmount(state, id)]),
  ) as Record<ItemId, number>
  const buildings = Object.fromEntries(
    BUILDINGS.map((id) => [id, state.inventory[id] ?? 0]),
  ) as Record<ItemId, number>
  const matTotal = MATERIALS.reduce((sum, id) => sum + (materials[id] ?? 0), 0)
  const buildTotal = BUILDINGS.reduce((sum, id) => sum + (buildings[id] ?? 0), 0)
  const chestCount = Object.values(state.entities).filter((e) => e.kind === 'chest').length

  return (
    <section className="panel inventory-panel">
      <div className="panel-head">
        <h2>Warehouse</h2>
        <p>
          Materials live in floor chests ({chestCount} placed). Totals below are summed
          across every chest. Buildings stay in your pack ready to place.
        </p>
        <p className="panel-stat">
          {formatNum(matTotal)} across chests · {formatNum(buildTotal)} buildings
        </p>
      </div>

      {matTotal <= 0 && buildTotal <= 0 && (
        <p className="inv-empty">
          Empty - route production into a chest, complete Tasks, or Craft buildings.
        </p>
      )}

      <InvSection title="Resources (all chests)" ids={MATERIALS} amounts={materials} />
      <InvSection title="Buildings (pack)" ids={BUILDINGS} amounts={buildings} />
    </section>
  )
}
