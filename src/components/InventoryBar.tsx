import { ITEM_META, PLACEABLE_META, formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import { ItemSprite, ToolIcon } from '../sprites/Sprites'
import type { ItemId, Placeable } from '../game/types'

const INV_ORDER: ItemId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'gear',
  'drill',
  'belt',
  'inserter',
  'furnace',
  'chest',
  'assembler',
]

const TOOLS: (Placeable | 'remove')[] = [
  'drill',
  'belt',
  'inserter',
  'furnace',
  'chest',
  'assembler',
  'remove',
]

const HOTKEYS: Record<string, string> = {
  drill: '1',
  belt: '2',
  inserter: '3',
  furnace: '4',
  chest: '5',
  assembler: '6',
  remove: 'Q',
}

export function InventoryBar() {
  const { state, selectTool, rotateDir, fuelDrills, selected, placeDir } = useGame()

  return (
    <div className="inv-wrap">
      <div className="resources" aria-label="Inventory">
        {INV_ORDER.map((id) => {
          const amount = state.inventory[id]
          if (
            amount <= 0 &&
            !['ironOre', 'coal', 'ironPlate', 'belt', 'drill', 'assembler'].includes(id)
          ) {
            return null
          }
          const meta = ITEM_META[id]
          return (
            <div key={id} className="resource resource-tex" title={meta.label}>
              <span className="resource-icon">
                <ItemSprite item={id} />
              </span>
              <div className="resource-text">
                <span className="resource-label">{meta.label}</span>
                <span className="resource-amount">{formatNum(amount)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="toolbar" role="toolbar" aria-label="Build tools">
        {TOOLS.map((tool) => {
          const label = tool === 'remove' ? 'Remove' : PLACEABLE_META[tool].label
          const count =
            tool === 'remove' ? null : state.inventory[PLACEABLE_META[tool].inventoryKey]
          return (
            <button
              key={tool}
              type="button"
              className={selected === tool ? 'tool is-active' : 'tool'}
              onClick={() => selectTool(tool)}
              title={tool === 'remove' ? 'Bulldoze' : PLACEABLE_META[tool].hint}
            >
              <ToolIcon kind={tool} />
              <span className="tool-text">
                <span className="tool-name">{label}</span>
                <span className="tool-meta">
                  [{HOTKEYS[tool]}]{count !== null ? ` · ${count}` : ''}
                </span>
              </span>
            </button>
          )
        })}
        <button type="button" className="tool" onClick={rotateDir}>
          <span className="tool-rotate-glyph">{placeDir}</span>
          <span className="tool-text">
            <span className="tool-name">Rotate</span>
            <span className="tool-meta">[R]</span>
          </span>
        </button>
        <button type="button" className="tool" onClick={fuelDrills}>
          <span className="resource-icon tool-fuel">
            <ItemSprite item="coal" />
          </span>
          <span className="tool-text">
            <span className="tool-name">Fuel drills</span>
            <span className="tool-meta">coal</span>
          </span>
        </button>
      </div>
    </div>
  )
}
