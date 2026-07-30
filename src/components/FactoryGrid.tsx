import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { DIR_DELTA, ITEM_META, idx, isFurnaceKind, storeTotal } from '../game/data'
import { useGame } from '../game/GameContext'
import {
  EntitySprite,
  GroundTexture,
  ItemSprite,
  OreTexture,
} from '../sprites/Sprites'
import type { Entity, OreId, Placeable } from '../game/types'

const ZOOM_MIN = 0.55
const ZOOM_MAX = 1.8
const ZOOM_STEP = 0.15

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

function toolLabel(selected: string | null, placeDir: Entity['dir']): string {
  if (selected === 'remove') return 'Bulldoze'
  if (selected === 'copy') return 'Copy blueprint (two corners)'
  if (selected === 'paste') return 'Paste blueprint'
  if (selected) return `Placing ${selected} ${dirArrow(placeDir)}`
  return 'Select a tool'
}

export function FactoryGrid() {
  const { state, place, rotateAt, collect, selected, placeDir } = useGame()
  const { width, height, tiles, entities, copyCorner, blueprint } = state
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(0.85)
  const dragging = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)

  const paint = useCallback(
    (x: number, y: number) => {
      place(x, y)
    },
    [place],
  )

  const canDragPaint =
    selected &&
    selected !== 'copy' &&
    selected !== 'paste' &&
    selected !== 'remove'

  const selectionRect = useMemo(() => {
    if (!copyCorner || !hover || selected !== 'copy') return null
    return {
      x0: Math.min(copyCorner.x, hover.x),
      y0: Math.min(copyCorner.y, hover.y),
      x1: Math.max(copyCorner.x, hover.x),
      y1: Math.max(copyCorner.y, hover.y),
    }
  }, [copyCorner, hover, selected])

  const pastePreview = useMemo(() => {
    if (selected !== 'paste' || !blueprint?.length || !hover) return null
    return blueprint.map((p) => ({
      x: hover.x + p.dx,
      y: hover.y + p.dy,
      kind: p.kind,
      dir: p.dir,
      toggle: p.toggle,
    }))
  }, [selected, blueprint, hover])

  const pasteSet = useMemo(() => {
    if (!pastePreview) return null
    return new Set(pastePreview.map((p) => `${p.x},${p.y}`))
  }, [pastePreview])

  const bumpZoom = (delta: number) => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)))
  }

  return (
    <section className="panel factory-panel">
      <div className="panel-head">
        <h2>Foundry Floor</h2>
        <p>
          Bigger map — zoom and scroll to navigate. Underground belts tunnel under lines;
          steel furnaces smelt twice as fast. Copy a rectangle, then paste.
        </p>
        <p className="panel-stat">
          Mine cycles {state.mineCycles.toLocaleString()} · Facing {placeDir}{' '}
          {dirArrow(placeDir)} · {toolLabel(selected, placeDir)}
          {blueprint ? ` · BP ${blueprint.length}` : ''}
        </p>
      </div>

      <div className="factory-zoom-bar">
        <button type="button" className="zoom-btn" onClick={() => bumpZoom(-ZOOM_STEP)}>
          −
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button type="button" className="zoom-btn" onClick={() => bumpZoom(ZOOM_STEP)}>
          +
        </button>
        <button type="button" className="zoom-btn" onClick={() => setZoom(0.85)}>
          Reset
        </button>
        <span className="zoom-hint">Ctrl+wheel zooms · scroll to pan</span>
      </div>

      <div
        className="factory-stage"
        ref={stageRef}
        onWheel={(e) => {
          if (!e.ctrlKey && Math.abs(e.deltaY) < 40) return
          e.preventDefault()
          bumpZoom(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)
        }}
      >
        <div
          className="factory-zoom-wrap"
          style={{
            transform: `scale(${zoom})`,
            width: `${100 / zoom}%`,
          }}
        >
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
                const inSelect =
                  selectionRect &&
                  x >= selectionRect.x0 &&
                  x <= selectionRect.x1 &&
                  y >= selectionRect.y0 &&
                  y <= selectionRect.y1
                const isCopyCorner =
                  copyCorner?.x === x && copyCorner?.y === y && selected === 'copy'
                const bpGhost = pastePreview?.find((p) => p.x === x && p.y === y)

                const showGhost =
                  isHover &&
                  !ent &&
                  selected &&
                  selected !== 'remove' &&
                  selected !== 'copy' &&
                  selected !== 'paste' &&
                  !(
                    (selected === 'drill' || selected === 'electricDrill') &&
                    !tile.ore
                  )

                const titleParts = [
                  `(${x},${y})`,
                  tile.ore
                    ? `${ITEM_META[tile.ore].label}${tile.amount !== null ? ` ×${tile.amount}` : ''}`
                    : 'grass',
                ]
                if (ent) {
                  titleParts.push(`${ent.kind} ${dirArrow(ent.dir)}`)
                  if (ent.kind === 'undergroundBelt') {
                    titleParts.push((ent.toggle ?? 0) === 0 ? 'entrance' : 'exit')
                  }
                  const sum = storeSummary(ent)
                  if (sum) titleParts.push(sum)
                }

                const filled = ent ? storeTotal(ent.store) > 0 : false
                const lit = Boolean(
                  ent &&
                    (isFurnaceKind(ent.kind) || ent.kind === 'assembler') &&
                    ent.smelting,
                )
                const active = Boolean(
                  (ent?.kind === 'drill' &&
                    (ent.store.coal ?? 0) > 0 &&
                    tile.ore) ||
                    (ent?.kind === 'electricDrill' && tile.ore),
                )
                const movingBelt =
                  ent?.kind === 'belt' ||
                  ent?.kind === 'fastBelt' ||
                  ent?.kind === 'splitter' ||
                  ent?.kind === 'undergroundBelt'

                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    className={`cell ${tile.ore ? `ore-${tile.ore}` : 'ore-none'} ${
                      ent ? `has-${ent.kind}` : ''
                    } ${isHover ? 'is-hover' : ''} ${inSelect ? 'is-select' : ''} ${
                      isCopyCorner ? 'is-copy-corner' : ''
                    } ${bpGhost ? 'is-bp-ghost' : ''}`}
                    title={titleParts.join(' · ')}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return
                      if (e.shiftKey) {
                        rotateAt(x, y)
                        return
                      }
                      if (canDragPaint) dragging.current = true
                      paint(x, y)
                    }}
                    onMouseEnter={() => {
                      setHover({ x, y })
                      if (dragging.current && canDragPaint) paint(x, y)
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
                          toggle={ent.toggle}
                        />
                      </span>
                    )}

                    {showGhost && (
                      <span className="cell-ghost">
                        <EntitySprite kind={selected as Placeable} dir={placeDir} />
                      </span>
                    )}

                    {bpGhost && !ent && (
                      <span className="cell-ghost cell-bp">
                        <EntitySprite
                          kind={bpGhost.kind}
                          dir={bpGhost.dir}
                          toggle={bpGhost.toggle}
                        />
                      </span>
                    )}

                    {(ent?.kind === 'belt' ||
                      ent?.kind === 'fastBelt' ||
                      ent?.kind === 'undergroundBelt') &&
                      ent.cargo && (
                        <span
                          className="cargo-item"
                          style={cargoOffset(ent.dir, ent.cargo.progress)}
                        >
                          <ItemSprite item={ent.cargo.item} />
                        </span>
                      )}

                    {(ent?.kind === 'drill' ||
                      ent?.kind === 'electricDrill' ||
                      (ent && isFurnaceKind(ent.kind)) ||
                      ent?.kind === 'chest' ||
                      ent?.kind === 'assembler') &&
                      ent &&
                      storeSummary(ent) && (
                        <span className="cell-store">{storeSummary(ent)}</span>
                      )}

                    {ent &&
                      (isFurnaceKind(ent.kind) || ent.kind === 'assembler') &&
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
      </div>

      <p className="grid-help">
        Drag to paint · Shift-click rotate · Right-click chest collect · Wheel/± zoom ·
        Copy two corners then Paste
        {selected && selected !== 'remove' && selected !== 'copy' && selected !== 'paste' && (
          <span className="ghost-dir">
            {' '}
            · {dirArrow(placeDir)} ({DIR_DELTA[placeDir].dx},{DIR_DELTA[placeDir].dy})
          </span>
        )}
        {pasteSet && hover ? (
          <span className="ghost-dir"> · paste origin ({hover.x},{hover.y})</span>
        ) : null}
      </p>
    </section>
  )
}
