import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ITEM_META, PLACEABLE_META, idx, isFurnaceKind, storeTotal } from '../game/data'
import { useGame } from '../game/GameContext'
import {
  EntitySprite,
  GroundTexture,
  ItemSprite,
  OreTexture,
  ToolIcon,
} from '../sprites/Sprites'
import type { Entity, GameState, OreId, Placeable, ToolId } from '../game/types'

const CELL = 56
const ZOOM_MIN = 0.45
const ZOOM_MAX = 2.2

type Highlight = 'ore' | 'drillTool' | 'beltTool' | 'manualSteps' | 'habit' | null
type ToolTab = 'build' | 'belts' | 'edit'

const BUILD_TOOLS: ToolId[] = ['drill', 'electricDrill', 'furnace', 'steelFurnace', 'chest', 'assembler']
const BELT_TOOLS: ToolId[] = [
  'belt',
  'fastBelt',
  'undergroundBelt',
  'inserter',
  'longInserter',
  'splitter',
]
const EDIT_TOOLS: ToolId[] = ['remove', 'copy', 'paste']

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

function canPlaceAt(tool: ToolId | null, x: number, y: number, state: GameState): boolean {
  if (!tool || tool === 'copy' || tool === 'paste' || tool === 'remove') return false
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false
  const tile = state.tiles[idx(x, y)]
  if (tile.entityId) return false
  if ((tool === 'drill' || tool === 'electricDrill') && !tile.ore) return false
  const meta = PLACEABLE_META[tool]
  return (state.inventory[meta.inventoryKey] ?? 0) >= 1
}

function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* ignore */
  }
}

export function FactoryFloor({ highlight = null }: { highlight?: Highlight }) {
  const {
    state,
    place,
    rotateAt,
    collect,
    selectTool,
    rotateDir,
    fuelDrills,
    buildStarter,
    selected,
    placeDir,
  } = useGame()
  const { width, height, tiles, entities, copyCorner, blueprint } = state

  const [toolTab, setToolTab] = useState<ToolTab>('build')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 16, y: 16 })
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [inspect, setInspect] = useState<{ x: number; y: number } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    kind: 'none' | 'pan' | 'paint' | 'pinch'
    startZoom: number
    startDist: number
    moved: boolean
    lastCell: string | null
    origin: { x: number; y: number } | null
  }>({
    kind: 'none',
    startZoom: 1,
    startDist: 0,
    moved: false,
    lastCell: null,
    origin: null,
  })

  const inspectEnt = useMemo(() => {
    if (!inspect) return null
    const id = tiles[idx(inspect.x, inspect.y)]?.entityId
    return id ? entities[id] ?? null : null
  }, [inspect, tiles, entities])

  useEffect(() => {
    if (highlight === 'beltTool') setToolTab('belts')
    if (highlight === 'ore' || highlight === 'drillTool') setToolTab('build')
  }, [highlight])

  const toolsForTab = toolTab === 'build' ? BUILD_TOOLS : toolTab === 'belts' ? BELT_TOOLS : EDIT_TOOLS

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

  const cellFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const world = worldRef.current
      if (!world) return null
      const rect = world.getBoundingClientRect()
      const x = Math.floor((clientX - rect.left) / (CELL * zoom))
      const y = Math.floor((clientY - rect.top) / (CELL * zoom))
      if (x < 0 || y < 0 || x >= width || y >= height) return null
      return { x, y }
    },
    [zoom, width, height],
  )

  const paintCell = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`
      if (gesture.current.lastCell === key) return
      gesture.current.lastCell = key
      place(x, y)
      setFlash(key)
      window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 180)
      buzz(8)
    },
    [place],
  )

  const onPointerDown = (e: ReactPointerEvent) => {
    const vp = viewportRef.current
    if (!vp) return
    vp.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      gesture.current = {
        kind: 'pinch',
        startZoom: zoom,
        startDist: Math.max(1, dist),
        moved: false,
        lastCell: null,
        origin: null,
      }
      return
    }

    const cell = cellFromPoint(e.clientX, e.clientY)

    if (selected) {
      gesture.current = {
        kind: 'paint',
        startZoom: zoom,
        startDist: 0,
        moved: false,
        lastCell: null,
        origin: { x: e.clientX, y: e.clientY },
      }
      if (cell) {
        setHover(cell)
        paintCell(cell.x, cell.y)
      }
    } else {
      gesture.current = {
        kind: 'pan',
        startZoom: zoom,
        startDist: 0,
        moved: false,
        lastCell: null,
        origin: { x: e.clientX, y: e.clientY },
      }
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (gesture.current.kind === 'pinch' && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, gesture.current.startZoom * (dist / gesture.current.startDist)),
      )
      setZoom(Math.round(next * 100) / 100)
      return
    }

    if (gesture.current.kind === 'pan' && pointers.current.size === 1) {
      setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }))
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) gesture.current.moved = true
      return
    }

    if (gesture.current.kind === 'paint') {
      const cell = cellFromPoint(e.clientX, e.clientY)
      if (!cell) return
      setHover(cell)
      const dragPaint =
        selected === 'belt' ||
        selected === 'fastBelt' ||
        selected === 'undergroundBelt' ||
        selected === 'remove' ||
        selected === 'inserter' ||
        selected === 'longInserter'
      if (dragPaint) {
        gesture.current.moved = true
        paintCell(cell.x, cell.y)
      } else if (gesture.current.origin) {
        const dx = e.clientX - gesture.current.origin.x
        const dy = e.clientY - gesture.current.origin.y
        if (Math.hypot(dx, dy) > 18) {
          gesture.current.moved = true
          paintCell(cell.x, cell.y)
        }
      }
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const wasPaint = gesture.current.kind === 'paint'
    const wasPan = gesture.current.kind === 'pan'
    const moved = gesture.current.moved
    pointers.current.delete(e.pointerId)

    if (pointers.current.size < 2 && gesture.current.kind === 'pinch') {
      gesture.current.kind = 'none'
    }

    if (pointers.current.size === 0) {
      if (wasPan && !moved && !selected) {
        const cell = cellFromPoint(e.clientX, e.clientY)
        if (cell) {
          const entId = tiles[idx(cell.x, cell.y)]?.entityId
          setInspect(entId ? cell : null)
        }
      }
      if (wasPaint && !moved) {
        /* single tap already painted */
      }
      gesture.current.kind = 'none'
      gesture.current.moved = false
      gesture.current.lastCell = null
      gesture.current.origin = null
    }
  }

  const toolLabel = !selected
    ? 'Hand — drag to pan, tap machines'
    : selected === 'remove'
      ? 'Demolish — drag to clear'
      : selected === 'copy'
        ? 'Copy — tap two corners'
        : selected === 'paste'
          ? 'Paste — tap origin'
          : `Place ${PLACEABLE_META[selected].label} ${dirArrow(placeDir)}`

  return (
    <section className="factory-floor">
      <div className="factory-hud">
        <div className="factory-hud-main">
          <strong>{toolLabel}</strong>
          <span>
            Cycles {state.mineCycles.toLocaleString()}
            {blueprint ? ` · BP ${blueprint.length}` : ''}
          </span>
        </div>
        <div className="factory-hud-actions">
          <button
            type="button"
            className="fab-btn"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - 0.15) * 100) / 100))}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="fab-btn"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + 0.15) * 100) / 100))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="fab-btn fab-rotate"
            onClick={() => {
              rotateDir()
              buzz(6)
            }}
            aria-label="Rotate"
          >
            {dirArrow(placeDir)}
          </button>
        </div>
      </div>

      <div
        className={`factory-viewport ${selected ? 'is-build' : 'is-pan'}`}
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="factory-world"
          ref={worldRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: width * CELL,
            height: height * CELL,
          }}
        >
          <div
            className="factory-grid"
            style={{
              gridTemplateColumns: `repeat(${width}, ${CELL}px)`,
              gridTemplateRows: `repeat(${height}, ${CELL}px)`,
              width: width * CELL,
              height: height * CELL,
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
                const valid = canPlaceAt(selected, x, y, state)
                const showGhost =
                  isHover &&
                  !!selected &&
                  selected !== 'remove' &&
                  selected !== 'copy' &&
                  selected !== 'paste'

                const lit = Boolean(
                  ent && (isFurnaceKind(ent.kind) || ent.kind === 'assembler') && ent.smelting,
                )
                const active = Boolean(
                  (ent?.kind === 'drill' && (ent.store.coal ?? 0) > 0 && tile.ore) ||
                    (ent?.kind === 'electricDrill' && tile.ore),
                )
                const movingBelt =
                  ent?.kind === 'belt' ||
                  ent?.kind === 'fastBelt' ||
                  ent?.kind === 'splitter' ||
                  ent?.kind === 'undergroundBelt'
                const filled = ent ? storeTotal(ent.store) > 0 : false
                const isInspect = inspect?.x === x && inspect?.y === y
                const isFlash = flash === `${x},${y}`

                return (
                  <div
                    key={`${x}-${y}`}
                    className={[
                      'cell',
                      tile.ore ? `ore-${tile.ore}` : 'ore-none',
                      ent ? `has-${ent.kind}` : '',
                      isHover ? 'is-hover' : '',
                      inSelect ? 'is-select' : '',
                      isCopyCorner ? 'is-copy-corner' : '',
                      bpGhost ? 'is-bp-ghost' : '',
                      highlight === 'ore' && tile.ore === 'ironOre' && !ent ? 'is-ore-hint' : '',
                      showGhost ? (valid ? 'is-valid-ghost' : 'is-invalid-ghost') : '',
                      isInspect ? 'is-inspect' : '',
                      isFlash ? 'is-flash' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
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

                    {ent &&
                      (ent.kind === 'drill' ||
                        ent.kind === 'electricDrill' ||
                        isFurnaceKind(ent.kind) ||
                        ent.kind === 'chest' ||
                        ent.kind === 'assembler') &&
                      storeSummary(ent) && (
                        <span className="cell-store">{storeSummary(ent)}</span>
                      )}

                    {ent && (isFurnaceKind(ent.kind) || ent.kind === 'assembler') && ent.smelting && (
                      <span
                        className="smelt-bar"
                        style={{ width: `${Math.min(100, ent.progress * 100)}%` }}
                      />
                    )}

                    <span className="cell-gridline" />
                  </div>
                )
              }),
            )}
          </div>
        </div>
      </div>

      {inspectEnt && inspect && (
        <div className="machine-sheet" role="dialog" aria-label="Machine">
          <div className="machine-sheet-head">
            <strong>
              {PLACEABLE_META[inspectEnt.kind as Placeable]?.label ?? inspectEnt.kind}{' '}
              {dirArrow(inspectEnt.dir)}
            </strong>
            <button type="button" className="ghost-btn" onClick={() => setInspect(null)}>
              Close
            </button>
          </div>
          <p className="machine-sheet-meta">
            ({inspect.x},{inspect.y})
            {storeSummary(inspectEnt) ? ` · ${storeSummary(inspectEnt)}` : ''}
          </p>
          <div className="machine-sheet-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                rotateAt(inspect.x, inspect.y)
                buzz(8)
              }}
            >
              Rotate
            </button>
            {inspectEnt.kind === 'chest' && (
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  collect(inspect.x, inspect.y)
                  buzz(10)
                }}
              >
                Collect
              </button>
            )}
            <button
              type="button"
              className="primary-btn danger-btn"
              onClick={() => {
                selectTool('remove')
                place(inspect.x, inspect.y)
                selectTool(null)
                setInspect(null)
                buzz(15)
              }}
            >
              Demolish
            </button>
          </div>
        </div>
      )}

      <div className="build-console">
        <div className="build-mode-row" role="tablist" aria-label="Tool groups">
          <button
            type="button"
            className={!selected ? 'is-active' : ''}
            onClick={() => selectTool(null)}
          >
            Hand
          </button>
          {(
            [
              ['build', 'Build'],
              ['belts', 'Belts'],
              ['edit', 'Edit'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={toolTab === id && selected ? 'is-active' : ''}
              onClick={() => {
                setToolTab(id)
                const list = id === 'build' ? BUILD_TOOLS : id === 'belts' ? BELT_TOOLS : EDIT_TOOLS
                const first = list.find((t) => isUnlocked(t, state.researched))
                if (first) selectTool(first)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="build-icon-dock" role="toolbar" aria-label="Build tools">
          {toolsForTab.map((tool) => {
            const unlocked = isUnlocked(tool, state.researched)
            if (!unlocked) {
              if (tool === 'copy' || tool === 'paste' || tool === 'remove') return null
              if ((state.inventory[tool as Placeable] ?? 0) <= 0) return null
            }
            const label =
              tool === 'remove'
                ? 'Demolish'
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
            const pulse =
              (highlight === 'drillTool' && tool === 'drill') ||
              (highlight === 'ore' && tool === 'drill') ||
              (highlight === 'beltTool' && tool === 'belt')
            const affordable =
              tool === 'remove' ||
              tool === 'copy' ||
              tool === 'paste' ||
              (count !== null && count > 0)
            return (
              <button
                key={tool}
                type="button"
                className={[
                  'build-icon',
                  selected === tool ? 'is-active' : '',
                  !affordable ? 'is-empty' : '',
                  pulse ? 'is-tutorial-pulse' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  selectTool(selected === tool ? null : tool)
                  setInspect(null)
                  buzz(6)
                }}
                title={label}
              >
                <ToolIcon kind={tool} />
                <span className="build-icon-name">{label}</span>
                {count !== null && <span className="build-icon-count">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="build-quick">
          <button type="button" className="ghost-btn" onClick={() => fuelDrills()}>
            Fuel drills
          </button>
          <button type="button" className="ghost-btn" onClick={() => buildStarter()}>
            Starter line
          </button>
          <span className="build-hint">Pinch zoom · Hand pans · Drag paints belts</span>
        </div>
      </div>
    </section>
  )
}
