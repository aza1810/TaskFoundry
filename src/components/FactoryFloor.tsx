import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import {
  APP_NAME,
  ITEM_META,
  PLACEABLE_META,
  formatNum,
  idx,
  isFurnaceKind,
  storeTotal,
  titleForLevel,
  xpForLevel,
} from '../game/data'
import { useGame } from '../game/GameContext'
import { activeGoal } from '../game/goals'
import {
  EntitySprite,
  GroundTexture,
  ItemSprite,
  OreTexture,
  ToolIcon,
} from '../sprites/Sprites'
import { useProductionRates } from '../hooks/useProductionRates'
import type { PedometerApi } from '../hooks/usePedometer'
import type { Entity, GameState, ItemId, OreId, Placeable, ToolId } from '../game/types'

const CELL = 56
const ZOOM_MIN = 0.45
const ZOOM_MAX = 2.2
const HUD_RESOURCES: ItemId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'gear',
  'steel',
]

type Highlight = 'ore' | 'drillTool' | 'beltTool' | 'manualSteps' | 'habit' | null
type ToolTab = 'build' | 'belts' | 'edit'

type Floater = {
  id: number
  x: number
  y: number
  text: string
  tone: 'ore' | 'place' | 'good' | 'warn'
}

const BUILD_TOOLS: Placeable[] = [
  'drill',
  'electricDrill',
  'furnace',
  'steelFurnace',
  'chest',
  'assembler',
]
const BELT_TOOLS: Placeable[] = [
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

let floaterSeq = 0

export function FactoryFloor({
  highlight = null,
  pedometer,
  onOpenTasks,
  onOpenSteps,
}: {
  highlight?: Highlight
  pedometer: PedometerApi
  onOpenTasks: () => void
  onOpenSteps: () => void
}) {
  const {
    state,
    place,
    rotateAt,
    collect,
    selectTool,
    rotateDir,
    fuelDrills,
    fuelAt,
    buildStarter,
    selected,
    placeDir,
  } = useGame()
  const { width, height, tiles, entities, copyCorner, blueprint } = state
  const rates = useProductionRates(state.stats)
  const goal = activeGoal(state)
  const xpNeeded = xpForLevel(state.level)
  const xpPct = Math.min(100, (state.xp / xpNeeded) * 100)

  const [toolTab, setToolTab] = useState<ToolTab>('build')
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 12, y: 48 })
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [inspect, setInspect] = useState<{ x: number; y: number } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [stepPulse, setStepPulse] = useState(false)
  const [dockOpen, setDockOpen] = useState(true)

  const pickTool = useCallback(
    (list: ToolId[]) => {
      const unlocked = list.filter((t) => isUnlocked(t, state.researched))
      const stocked = unlocked.find((t) => {
        if (t === 'remove' || t === 'copy' || t === 'paste') return true
        return (state.inventory[t as Placeable] ?? 0) > 0
      })
      return stocked ?? unlocked[0] ?? null
    },
    [state.researched, state.inventory],
  )
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const velocity = useRef({ x: 0, y: 0 })
  const inertiaRaf = useRef(0)
  const prevSteps = useRef(state.stepsToday)
  const prevOre = useRef(state.stats.oreMined)
  const prevCycles = useRef(state.mineCycles)
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

  const spawnFloater = useCallback(
    (x: number, y: number, text: string, tone: Floater['tone'] = 'good') => {
      const id = ++floaterSeq
      setFloaters((list) => [...list.slice(-18), { id, x, y, text, tone }])
      window.setTimeout(() => {
        setFloaters((list) => list.filter((f) => f.id !== id))
      }, 900)
    },
    [],
  )

  // Step pulse + ore floaters when the factory mines
  useEffect(() => {
    if (state.stepsToday > prevSteps.current) {
      setStepPulse(true)
      window.setTimeout(() => setStepPulse(false), 420)
    }
    prevSteps.current = state.stepsToday
  }, [state.stepsToday])

  useEffect(() => {
    const oreDelta = state.stats.oreMined - prevOre.current
    const cycleDelta = state.mineCycles - prevCycles.current
    prevOre.current = state.stats.oreMined
    prevCycles.current = state.mineCycles
    if (oreDelta <= 0 && cycleDelta <= 0) return

    const drills = Object.values(entities).filter(
      (e) => e.kind === 'drill' || e.kind === 'electricDrill',
    )
    if (!drills.length) return
    const sample = drills.slice(0, Math.min(4, drills.length))
    for (const d of sample) {
      const tile = tiles[idx(d.x, d.y)]
      const label = tile?.ore ? ITEM_META[tile.ore].short : '+'
      spawnFloater(d.x, d.y, `+${label}`, 'ore')
    }
  }, [state.stats.oreMined, state.mineCycles, entities, tiles, spawnFloater])

  useEffect(() => {
    if (highlight === 'beltTool') setToolTab('belts')
    if (highlight === 'ore' || highlight === 'drillTool') setToolTab('build')
  }, [highlight])

  // Camera inertia after pan
  useEffect(() => {
    return () => {
      if (inertiaRaf.current) cancelAnimationFrame(inertiaRaf.current)
    }
  }, [])

  const runInertia = useCallback(() => {
    const tick = () => {
      const vx = velocity.current.x
      const vy = velocity.current.y
      if (Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2) {
        velocity.current = { x: 0, y: 0 }
        inertiaRaf.current = 0
        return
      }
      setPan((p) => ({ x: p.x + vx, y: p.y + vy }))
      velocity.current = { x: vx * 0.9, y: vy * 0.9 }
      inertiaRaf.current = requestAnimationFrame(tick)
    }
    if (inertiaRaf.current) cancelAnimationFrame(inertiaRaf.current)
    inertiaRaf.current = requestAnimationFrame(tick)
  }, [])

  const toolsForTab: ToolId[] =
    toolTab === 'build' ? BUILD_TOOLS : toolTab === 'belts' ? BELT_TOOLS : EDIT_TOOLS

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
      const before = state.tiles[idx(x, y)]?.entityId
      place(x, y)
      setFlash(key)
      window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 180)
      buzz(8)
      if (selected && selected !== 'remove' && selected !== 'copy' && selected !== 'paste') {
        spawnFloater(x, y, PLACEABLE_META[selected].label.split(' ')[0], 'place')
      } else if (selected === 'remove' && before) {
        spawnFloater(x, y, 'scrap', 'warn')
      }
    },
    [place, selected, spawnFloater, state.tiles],
  )

  const centerOn = useCallback(
    (gx: number, gy: number) => {
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      setPan({
        x: rect.width / 2 - (gx + 0.5) * CELL * zoom,
        y: rect.height / 2 - (gy + 0.5) * CELL * zoom,
      })
      velocity.current = { x: 0, y: 0 }
    },
    [zoom],
  )

  const recenter = useCallback(() => {
    const drills = Object.values(entities).filter(
      (e) => e.kind === 'drill' || e.kind === 'electricDrill',
    )
    if (drills.length) {
      const ax = drills.reduce((s, d) => s + d.x, 0) / drills.length
      const ay = drills.reduce((s, d) => s + d.y, 0) / drills.length
      centerOn(ax, ay)
      return
    }
    centerOn(width / 2, height / 2)
  }, [entities, width, height, centerOn])

  const onPointerDown = (e: ReactPointerEvent) => {
    const vp = viewportRef.current
    if (!vp) return
    if (inertiaRaf.current) {
      cancelAnimationFrame(inertiaRaf.current)
      inertiaRaf.current = 0
    }
    velocity.current = { x: 0, y: 0 }
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
      velocity.current = {
        x: e.movementX * 0.85 + velocity.current.x * 0.15,
        y: e.movementY * 0.85 + velocity.current.y * 0.15,
      }
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
      if (wasPan && moved) runInertia()
      if (wasPan && !moved && !selected) {
        const cell = cellFromPoint(e.clientX, e.clientY)
        if (cell) {
          const entId = tiles[idx(cell.x, cell.y)]?.entityId
          setInspect(entId ? cell : null)
          if (entId) buzz(6)
        } else {
          setInspect(null)
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
    ? 'Hand — drag map, tap machines'
    : selected === 'remove'
      ? 'Demolish — drag to clear'
      : selected === 'copy'
        ? 'Copy — tap two corners'
        : selected === 'paste'
          ? 'Paste — tap origin'
          : `Build ${PLACEABLE_META[selected].label} ${dirArrow(placeDir)}`

  const activeMachines = useMemo(() => {
    let n = 0
    for (const e of Object.values(entities)) {
      if (e.kind === 'drill' && (e.store.coal ?? 0) > 0) n++
      else if (e.kind === 'electricDrill') n++
      else if ((isFurnaceKind(e.kind) || e.kind === 'assembler') && e.smelting) n++
    }
    return n
  }, [entities])

  const rateLine =
    rates.ore > 0.05
      ? `${rates.ore.toFixed(1)} ore/s`
      : rates.moved > 0.05
        ? `${rates.moved.toFixed(1)} flow/s`
        : activeMachines > 0
          ? `${activeMachines} running`
          : 'idle'

  return (
    <section className="factory-floor is-playable">
      <div className="game-hud">
        <div className="game-hud-top">
          <div className="game-hud-identity">
            <div className="game-hud-title-row">
              <strong className="game-hud-brand">{APP_NAME}</strong>
              <span className="game-hud-lv">Lv{state.level}</span>
            </div>
            <div className="game-hud-xp" aria-hidden>
              <div className="game-hud-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
          <div className="game-hud-rates is-inline">
            <span className={rates.ore > 0.05 ? 'is-hot' : ''}>{rateLine}</span>
          </div>
          <button
            type="button"
            className={`game-hud-steps ${stepPulse ? 'is-pulse' : ''} ${
              pedometer.status === 'listening' ? 'is-live' : ''
            }`}
            onClick={onOpenSteps}
            title={`${state.playerName} · ${titleForLevel(state.level)}`}
          >
            <span className="game-hud-steps-label">Steps</span>
            <span className="game-hud-steps-num">{formatNum(state.stepsToday)}</span>
            {pedometer.status === 'listening' && (
              <span className="game-hud-steps-live">+{pedometer.sessionSteps}</span>
            )}
          </button>
        </div>

        <div className="game-hud-resources" aria-label="Inventory">
          {HUD_RESOURCES.map((id) => {
            const n = state.inventory[id] ?? 0
            if (n <= 0 && id !== 'ironOre' && id !== 'coal' && id !== 'ironPlate') return null
            return (
              <span key={id} className="game-res" style={{ '--res': ITEM_META[id].color } as CSSProperties}>
                <ItemSprite item={id} />
                <em>{formatNum(n)}</em>
              </span>
            )
          })}
        </div>

        {goal ? (
          <button type="button" className="game-objective" onClick={onOpenTasks}>
            <span>Objective</span>
            <strong>{goal.title}</strong>
          </button>
        ) : (
          <button type="button" className="game-objective is-clear" onClick={onOpenTasks}>
            <span>Contracts</span>
            <strong>All clear — expand</strong>
          </button>
        )}

        {pedometer.status === 'listening' && (
          <div className="game-walk-banner">
            <span className="game-walk-dot" aria-hidden />
            Walking — drills mine with each step
            <button type="button" onClick={pedometer.stop}>
              Stop
            </button>
          </div>
        )}
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
        <div className="factory-vignette" aria-hidden />
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
                      active ? 'is-active-machine' : '',
                      lit ? 'is-lit' : '',
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

          {floaters.map((f) => (
            <span
              key={f.id}
              className={`world-floater tone-${f.tone}`}
              style={{
                left: f.x * CELL + CELL * 0.2,
                top: f.y * CELL + CELL * 0.15,
              }}
            >
              {f.text}
            </span>
          ))}
        </div>

        <div className="viewport-fabs">
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
          <button type="button" className="fab-btn" onClick={recenter} aria-label="Recenter">
            ⌖
          </button>
        </div>

        <Minimap
          width={width}
          height={height}
          tiles={tiles}
          entities={entities}
          pan={pan}
          zoom={zoom}
          viewportRef={viewportRef}
          onJump={centerOn}
        />

        <div className="mode-banner" aria-live="polite">
          <strong>{toolLabel}</strong>
          <span>
            {formatNum(state.mineCycles)} cycles
            {blueprint ? ` · BP ${blueprint.length}` : ''}
          </span>
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
            {inspectEnt.kind === 'drill' && (
              <button
                type="button"
                className="primary-btn"
                disabled={state.inventory.coal < 1}
                onClick={() => {
                  fuelAt(inspect.x, inspect.y)
                  spawnFloater(inspect.x, inspect.y, '+fuel', 'good')
                  buzz(10)
                }}
              >
                Fuel
              </button>
            )}
            {inspectEnt.kind === 'chest' && (
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  collect(inspect.x, inspect.y)
                  spawnFloater(inspect.x, inspect.y, 'loot', 'good')
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

      <div className={`build-console ${dockOpen ? 'is-open' : 'is-collapsed'}`}>
        <button
          type="button"
          className="build-console-toggle"
          onClick={() => setDockOpen((v) => !v)}
          aria-expanded={dockOpen}
        >
          {dockOpen ? 'Hide tools' : 'Show tools'}
          <span>{selected ? PLACEABLE_META[selected as Placeable]?.label ?? selected : 'Hand'}</span>
        </button>

        {dockOpen && (
          <>
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
              ).map(([id, label]) => {
                const list =
                  id === 'build' ? BUILD_TOOLS : id === 'belts' ? BELT_TOOLS : EDIT_TOOLS
                const tabActive = toolTab === id && !!selected && list.includes(selected)
                return (
                  <button
                    key={id}
                    type="button"
                    className={tabActive ? 'is-active' : ''}
                    onClick={() => {
                      setToolTab(id)
                      setDockOpen(true)
                      const next = pickTool(list)
                      if (next) selectTool(next)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="build-icon-dock" role="toolbar" aria-label="Build tools">
              {toolsForTab.map((tool) => {
                const unlocked = isUnlocked(tool, state.researched)
                if (!unlocked) return null
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
            {toolTab === 'build' &&
              BUILD_TOOLS.every(
                (t) =>
                  !isUnlocked(t, state.researched) ||
                  (state.inventory[PLACEABLE_META[t].inventoryKey] ?? 0) <= 0,
              ) && (
                <p className="build-empty-hint">
                  No buildings in stock — craft more on the Craft tab, or complete Tasks.
                </p>
              )}

            <div className="build-quick">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  fuelDrills()
                  buzz(10)
                }}
              >
                Fuel all
              </button>
              {!state.tutorialComplete && (
                <button type="button" className="ghost-btn" onClick={() => buildStarter()}>
                  Starter line
                </button>
              )}
              {pedometer.status !== 'listening' && pedometer.supported && (
                <button
                  type="button"
                  className="ghost-btn walk-btn"
                  onClick={() => {
                    void pedometer.start()
                    buzz(12)
                  }}
                >
                  Start walk
                </button>
              )}
              <span className="build-hint">Pinch · drag · paint belts</span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Minimap({
  width,
  height,
  tiles,
  entities,
  pan,
  zoom,
  viewportRef,
  onJump,
}: {
  width: number
  height: number
  tiles: GameState['tiles']
  entities: GameState['entities']
  pan: { x: number; y: number }
  zoom: number
  viewportRef: RefObject<HTMLDivElement | null>
  onJump: (x: number, y: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scale = 3

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = width * scale
    canvas.height = height * scale
    ctx.fillStyle = '#1a2214'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[idx(x, y)]
        if (tile.ore === 'ironOre') ctx.fillStyle = '#8B7355'
        else if (tile.ore === 'copperOre') ctx.fillStyle = '#C4783A'
        else if (tile.ore === 'coal') ctx.fillStyle = '#2A2A2A'
        else ctx.fillStyle = '#3a4a28'
        ctx.fillRect(x * scale, y * scale, scale, scale)
        if (tile.entityId && entities[tile.entityId]) {
          const kind = entities[tile.entityId].kind
          if (kind.includes('belt') || kind === 'splitter') ctx.fillStyle = '#f0a020'
          else if (kind.includes('drill')) ctx.fillStyle = '#7dff9a'
          else if (kind.includes('furnace') || kind === 'assembler') ctx.fillStyle = '#e07040'
          else ctx.fillStyle = '#7b8792'
          ctx.fillRect(x * scale, y * scale, scale, scale)
        }
      }
    }
  }, [width, height, tiles, entities])

  const view = useMemo(() => {
    const vp = viewportRef.current
    if (!vp) return null
    const rect = vp.getBoundingClientRect()
    const left = Math.max(0, Math.min(width, -pan.x / (CELL * zoom)))
    const top = Math.max(0, Math.min(height, -pan.y / (CELL * zoom)))
    const w = Math.min(width - left, rect.width / (CELL * zoom))
    const h = Math.min(height - top, rect.height / (CELL * zoom))
    return { left, top, w, h }
  }, [pan, zoom, width, height, viewportRef])

  return (
    <button
      type="button"
      className="minimap"
      aria-label="Minimap — tap to jump"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * width
        const y = ((e.clientY - rect.top) / rect.height) * height
        onJump(x, y)
        buzz(6)
      }}
    >
      <canvas ref={canvasRef} />
      {view && (
        <span
          className="minimap-view"
          style={{
            left: `${(view.left / width) * 100}%`,
            top: `${(view.top / height) * 100}%`,
            width: `${(view.w / width) * 100}%`,
            height: `${(view.h / height) * 100}%`,
          }}
        />
      )}
    </button>
  )
}
