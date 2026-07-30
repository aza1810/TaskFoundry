import { PLACEABLE_META } from '../game/data'
import { useGame } from '../game/GameContext'
import { ItemSprite, ToolIcon } from '../sprites/Sprites'
import type { Placeable, ToolId } from '../game/types'

const TOOLS: ToolId[] = [
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
  'remove',
  'copy',
  'paste',
]

const HOTKEYS: Partial<Record<ToolId, string>> = {
  drill: '1',
  belt: '2',
  inserter: '3',
  furnace: '4',
  chest: '5',
  assembler: '6',
  remove: 'Q',
  copy: 'C',
  paste: 'V',
}

function isUnlocked(tool: ToolId, researched: string[]): boolean {
  if (
    tool === 'remove' ||
    tool === 'copy' ||
    tool === 'paste' ||
    tool === 'drill' ||
    tool === 'belt' ||
    tool === 'inserter' ||
    tool === 'furnace' ||
    tool === 'chest' ||
    tool === 'assembler'
  ) {
    return true
  }
  if (tool === 'fastBelt') return researched.includes('logistics2')
  if (tool === 'electricDrill') return researched.includes('electricMining')
  if (tool === 'splitter') return researched.includes('splitters')
  if (tool === 'undergroundBelt') return researched.includes('undergroundBelts')
  if (tool === 'steelFurnace') return researched.includes('steelProcessing')
  if (tool === 'longInserter') return researched.includes('longInserters')
  return false
}

/** Compact build tools — shown only on the factory floor. */
export function BuildToolbar() {
  const { state, selectTool, rotateDir, fuelDrills, buildStarter, selected, placeDir } =
    useGame()

  return (
    <div className="build-dock" role="toolbar" aria-label="Build tools">
      {TOOLS.map((tool) => {
        const unlocked = isUnlocked(tool, state.researched)
        if (!unlocked) {
          if (tool === 'copy' || tool === 'paste' || tool === 'remove') return null
          if ((state.inventory[tool as Placeable] ?? 0) <= 0) return null
        }
        const label =
          tool === 'remove'
            ? 'Remove'
            : tool === 'copy'
              ? 'Copy'
              : tool === 'paste'
                ? 'Paste'
                : PLACEABLE_META[tool].label
        const count =
          tool === 'remove' || tool === 'copy' || tool === 'paste'
            ? tool === 'paste' && state.blueprint
              ? state.blueprint.length
              : null
            : state.inventory[PLACEABLE_META[tool].inventoryKey]
        const hint =
          tool === 'remove'
            ? 'Bulldoze'
            : tool === 'copy'
              ? 'Click two corners to copy a rectangle of buildings'
              : tool === 'paste'
                ? state.blueprint
                  ? `Paste ${state.blueprint.length} buildings (spends inventory)`
                  : 'Copy a blueprint first'
                : PLACEABLE_META[tool].hint
        return (
          <button
            key={tool}
            type="button"
            className={selected === tool ? 'tool is-active' : 'tool'}
            onClick={() => selectTool(tool)}
            title={hint}
          >
            <ToolIcon kind={tool} />
            <span className="tool-text">
              <span className="tool-name">{label}</span>
              <span className="tool-meta">
                {HOTKEYS[tool] ? `[${HOTKEYS[tool]}] · ` : ''}
                {count !== null ? count : ''}
              </span>
            </span>
          </button>
        )
      })}
      <button type="button" className="tool" onClick={rotateDir} title="Rotate place direction">
        <span className="tool-rotate-glyph">{placeDir}</span>
        <span className="tool-text">
          <span className="tool-name">Rotate</span>
          <span className="tool-meta">[R]</span>
        </span>
      </button>
      <button type="button" className="tool" onClick={fuelDrills} title="Fuel burner drills">
        <span className="resource-icon tool-fuel">
          <ItemSprite item="coal" />
        </span>
        <span className="tool-text">
          <span className="tool-name">Fuel</span>
          <span className="tool-meta">coal</span>
        </span>
      </button>
      <button type="button" className="tool" onClick={buildStarter} title="Auto-build starter line">
        <span className="tool-rotate-glyph">+</span>
        <span className="tool-text">
          <span className="tool-name">Starter</span>
          <span className="tool-meta">line</span>
        </span>
      </button>
    </div>
  )
}
