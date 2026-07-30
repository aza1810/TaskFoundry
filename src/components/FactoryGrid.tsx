import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { DIR_DELTA, ITEM_META, idx, storeTotal } from '../game/data'
import { useGame } from '../game/GameContext'
import {
  EntitySprite,
  GroundTexture,
  ItemSprite,
  OreTexture,
} from '../sprites/Sprites'
import type { Entity, OreId, Placeable } from '../game/types'

function dirArrow(dir: Entity['dir']): string {
  return { N: '↑', E: '→', S: '↓', W: '←' }[dir]
}

function storeSummary(e: Entity): string {
  const parts: string[] = []
  for (const [id, n] of Object.entries(e.store)) {
    if (n && n > 0) parts.push(`${ITEM_META[id as keyof typeof ITEM_META].short}:${Math.floor(n)}`)
  }
  return parts.join(' ')
}

function cargoOffset(dir: Entity['dir'], p: number): CSSProperties {
  const t = Math.min(1, Math.max(0, p))
  if (dir === 'E') return { left: `${8 + t * 60}%`, top: '36%' }
  if (dir === 'W') return { left: `${68 - t * 60}%`, top: '36%' }
  if (dir === 'S') return { left: '36%', top: `${8 + t * 60}%` }
  return { left: '36%', top: `${68 - t * 60}%` }
}

export function FactoryGrid() {
  const { state, place, rotateAt, collect, selected, placeDir } = useGame()
  const { width, height, tiles, entities } = state
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)

  const paint = useCallback(
    (x: number, y: number) => {
      place(x, y)
    },
    [place],
  )

  return (
    <section className="panel factory-panel">
      <div className="panel-head">
        <h2>Factory Floor</h2>
        <p>
          Drills face a belt or chest and auto-drop ore. Drag to paint belts. Assemblers
          cut gears from plates while you walk.
        </p>
        <p className="panel-stat">
          Mine cycles {state.mineCycles.toLocaleString()} · Facing {placeDir}{' '}
          {dirArrow(placeDir)} ·{' '}
          {selected === 'remove'
            ? 'Bulldoze'
            : selected
              ? `Placing ${selected}`
              : 'Select a tool'}
        </p>
      </div>

      <div className="factory-stage">
        <div
          className="factory-grid"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseLeave={() => {
            dragging.current = false
            setHover(null)
          }}
          onMouseUp={() => {
            dragging.current = false
          }}
        >
          {Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => {
              const tile = tiles[idx(x, y)]
              const ent = tile.entityId ? entities[tile.entityId] : null
              const seed = x * 13 + y * 29
              const isHover = hover?.x === x && hover?.y === y
              const showGhost =
                isHover &&
                !ent &&
                selected &&
                selected !== 'remove' &&
                !(selected === 'drill' && !tile.ore)

              const titleParts = [
                `(${x},${y})`,
                tile.ore
                  ? `${ITEM_META[tile.ore].label}${tile.amount !== null ? ` ×${tile.amount}` : ''}`
                  : 'grass',
              ]
              if (ent) {
                titleParts.push(`${ent.kind} ${dirArrow(ent.dir)}`)
                const sum = storeSummary(ent)
                if (sum) titleParts.push(sum)
              }

              const filled = ent ? storeTotal(ent.store) > 0 : false
              const lit =
                (ent?.kind === 'furnace' || ent?.kind === 'assembler') &&
                Boolean(ent.smelting)
              const active =
                (ent?.kind === 'drill' &&
                  (ent.store.coal ?? 0) > 0 &&
                  Boolean(tile.ore)) ||
                (ent?.kind === 'electricDrill' && Boolean(tile.ore))
              const movingBelt =
                ent?.kind === 'belt' || ent?.kind === 'fastBelt' || ent?.kind === 'splitter'

              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  className={`cell ${tile.ore ? `ore-${tile.ore}` : 'ore-none'} ${
                    ent ? `has-${ent.kind}` : ''
                  } ${isHover ? 'is-hover' : ''}`}
                  title={titleParts.join(' · ')}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return
                    if (e.shiftKey) {
                      rotateAt(x, y)
                      return
                    }
                    dragging.current = true
                    paint(x, y)
                  }}
                  onMouseEnter={() => {
                    setHover({ x, y })
                    if (dragging.current) paint(x, y)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (ent?.kind === 'chest') collect(x, y)
                    else rotateAt(x, y)
                  }}
                >
                  <span className="cell-tex">
                    {tile.ore ? (
                      <OreTexture ore={tile.ore as OreId} amount={tile.amount} />
                    ) : (
                      <GroundTexture seed={seed} />
                    )}
                  </span>

                  {ent && (
                    <span className="cell-ent">
                      <EntitySprite
                        kind={ent.kind}
                        dir={ent.dir}
                        lit={lit}
                        active={active || lit}
                        moving={movingBelt}
                        filled={filled}
                      />
                    </span>
                  )}

                  {showGhost && (
                    <span className="cell-ghost">
                      <EntitySprite kind={selected as Placeable} dir={placeDir} />
                    </span>
                  )}

                  {ent?.kind === 'belt' && ent.cargo && (
                    <span className="cargo-item" style={cargoOffset(ent.dir, ent.cargo.progress)}>
                      <ItemSprite item={ent.cargo.item} />
                    </span>
                  )}

                  {(ent?.kind === 'drill' ||
                    ent?.kind === 'electricDrill' ||
                    ent?.kind === 'furnace' ||
                    ent?.kind === 'chest' ||
                    ent?.kind === 'assembler') &&
                    storeSummary(ent) && (
                      <span className="cell-store">{storeSummary(ent)}</span>
                    )}

                  {(ent?.kind === 'furnace' || ent?.kind === 'assembler') &&
                    ent.smelting && (
                      <span
                        className="smelt-bar"
                        style={{ width: `${Math.min(100, ent.progress * 100)}%` }}
                      />
                    )}

                  <span className="cell-gridline" />
                </button>
              )
            }),
          )}
        </div>
      </div>

      <p className="grid-help">
        Drag to paint · Shift-click rotate · Right-click chest collect · Drills auto-output
        the way they face
        {selected && selected !== 'remove' && (
          <span className="ghost-dir">
            {' '}
            · {dirArrow(placeDir)} ({DIR_DELTA[placeDir].dx},{DIR_DELTA[placeDir].dy})
          </span>
        )}
      </p>
    </section>
  )
}
