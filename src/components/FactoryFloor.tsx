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
  DIR_DELTA,
  ITEM_META,
  OPPOSITE,
  PLACEABLE_META,
  RECIPE_MAP,
  formatNum,
  idx,
  isBeltKind,
  isDrillKind,
  isFurnaceKind,
  isInserterKind,
  storeTotal,
  xpForLevel,
} from '../game/data'
import { getBeltBend } from '../game/beltShape'
import { useGame } from '../game/GameContext'
import { activeGoal } from '../game/goals'
import { contractComplete } from '../game/contracts'
import {
  fuelAllDrills,
  fuelDrillAt,
  placeEntity,
} from '../game/logic'
import { machineStatus } from '../game/machineStatus'
import {
  EntitySprite,
  GroundTexture,
  ItemSprite,
  OreTexture,
  ToolIcon,
} from '../sprites/Sprites'
import { useProductionRates } from '../hooks/useProductionRates'
import { MachineInventory, hasMachineInventory } from './MachineInventory'
import { resolveTheme, subscribeTheme } from '../theme'
import type { Dir, Entity, GameState, ItemId, OreId, Placeable, ToolId } from '../game/types'

const CELL = 56
const ZOOM_MIN = 0.45
const ZOOM_MAX = 2.2
/** Touch browsers often report movementX/Y as 0 - use client deltas instead. */
const PAN_SLOP = 10
const PAINT_HOLD_MS = 280

/** Extra pixels past the map edge so you can see you've hit the border. */
const PAN_EDGE_SLACK = 56

/** Keep the factory grid near the viewport - slight overscroll shows the map edge. */
function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  viewport: { width: number; height: number },
  mapW: number,
  mapH: number,
): { x: number; y: number } {
  const vw = viewport.width
  const vh = viewport.height
  if (vw <= 0 || vh <= 0) return pan

  const worldW = mapW * CELL * zoom
  const worldH = mapH * CELL * zoom
  const slack = PAN_EDGE_SLACK

  let x: number
  let y: number
  if (worldW <= vw) {
    const center = (vw - worldW) / 2
    x = Math.min(center + slack, Math.max(center - slack, pan.x))
  } else {
    x = Math.min(slack, Math.max(vw - worldW - slack, pan.x))
  }
  if (worldH <= vh) {
    const center = (vh - worldH) / 2
    y = Math.min(center + slack, Math.max(center - slack, pan.y))
  } else {
    y = Math.min(slack, Math.max(vh - worldH - slack, pan.y))
  }
  return { x, y }
}
const HUD_RESOURCES: ItemId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'gear',
  'steel',
]

type Highlight = 'ore' | 'drillTool' | 'beltTool' | 'walkSteps' | 'habit' | null
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
const EDIT_TOOLS: ToolId[] = ['remove', 'rotate', 'copy', 'paste']

function isEditMetaTool(
  tool: ToolId | null,
): tool is 'remove' | 'rotate' | 'copy' | 'paste' {
  return tool === 'remove' || tool === 'rotate' || tool === 'copy' || tool === 'paste'
}

function dirArrow(dir: Entity['dir']): string {
  return { N: '↑', E: '→', S: '↓', W: '←' }[dir]
}

/** Bold chevron overlay so inserter facing reads at a glance. */
function InserterDirOverlay({ dir }: { dir: Dir }) {
  return (
    <span className={`cell-inserter-dir is-${dir}`} aria-hidden>
      <svg viewBox="0 0 32 32" className="cell-inserter-dir-svg">
        <path
          d="M6 16 H20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M18 8 L28 16 L18 24 Z" fill="currentColor" stroke="#1a1612" strokeWidth="1" />
      </svg>
    </span>
  )
}

function storeSummary(e: Entity): string {
  const parts: string[] = []
  for (const [id, n] of Object.entries(e.store)) {
    if (n && n > 0) parts.push(`${ITEM_META[id as keyof typeof ITEM_META].short}:${Math.floor(n)}`)
  }
  return parts.join(' ')
}

function cargoOffset(
  dir: Entity['dir'],
  p: number,
  opts?: { underground?: boolean; fromDir?: Dir | null },
): CSSProperties {
  const t = Math.min(1, Math.max(0, p))
  const from = opts?.fromDir
  const isCorner =
    !!from && from !== dir && from !== OPPOSITE[dir]

  const along = (travel: Dir, u: number) => {
    const d = -42 + u * 84
    if (travel === 'E') return { x: d, y: 0 }
    if (travel === 'W') return { x: -d, y: 0 }
    if (travel === 'S') return { x: 0, y: d }
    return { x: 0, y: -d }
  }

  let x = 0
  let y = 0
  if (isCorner && from) {
    // Enter along `from` to center, then leave along `dir`.
    const pos = t < 0.5 ? along(from, t) : along(dir, t)
    x = pos.x
    y = pos.y
  } else if (dir === 'E') {
    x = -42 + t * 84
    y = 0
  } else if (dir === 'W') {
    x = 42 - t * 84
    y = 0
  } else if (dir === 'S') {
    x = 0
    y = -42 + t * 84
  } else {
    x = 0
    y = 42 - t * 84
  }
  // Fade into / out of underground mouths.
  let opacity = 1
  if (opts?.underground) {
    opacity = t < 0.25 ? t / 0.25 : t > 0.75 ? (1 - t) / 0.25 : 1
  }
  return {
    transform: `translate(-50%, -50%) translate(${x}%, ${y}%)`,
    opacity,
  }
}

function isUnlocked(tool: ToolId, researched: string[]): boolean {
  if (
    tool === 'remove' ||
    tool === 'rotate' ||
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

function needsPlaceDir(tool: ToolId | null): boolean {
  if (!tool) return false
  if (tool === 'rotate') return true
  if (isEditMetaTool(tool)) return false
  if (tool === 'chest') return false
  return true
}

function canPlaceAt(tool: ToolId | null, x: number, y: number, state: GameState): boolean {
  if (!tool || isEditMetaTool(tool)) return false
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false
  const tile = state.tiles[idx(x, y)]
  if (tile.entityId) return false
  if ((tool === 'drill' || tool === 'electricDrill') && !tile.ore) return false
  const meta = PLACEABLE_META[tool]
  return Math.floor((state.inventory[meta.inventoryKey] ?? 0) + 1e-9) >= 1
}

function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* ignore */
  }
}

/** Tile an inserter pulls from / drops into (matches sim reach). */
function inserterIoAt(
  x: number,
  y: number,
  dir: Dir,
  reach: number,
  width: number,
  height: number,
): { pickup: { x: number; y: number } | null; drop: { x: number; y: number } | null } {
  const behind = DIR_DELTA[OPPOSITE[dir]]
  const front = DIR_DELTA[dir]
  const pickup = { x: x + behind.dx * reach, y: y + behind.dy * reach }
  const drop = { x: x + front.dx * reach, y: y + front.dy * reach }
  const inBounds = (c: { x: number; y: number }) =>
    c.x >= 0 && c.y >= 0 && c.x < width && c.y < height
  return {
    pickup: inBounds(pickup) ? pickup : null,
    drop: inBounds(drop) ? drop : null,
  }
}

let floaterSeq = 0

export function FactoryFloor({
  highlight = null,
  onOpenTasks,
  onOpenSteps,
  onOpenSettings,
}: {
  highlight?: Highlight
  onOpenTasks: () => void
  onOpenSteps: () => void
  onOpenSettings: () => void
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
  const goalProg = goal?.progress?.(state) ?? null
  const claimableContracts = (state.contracts ?? []).filter(
    (c) => !c.claimed && contractComplete(state, c),
  )
  const activeCraft = state.craftQueue[0]
  const activeCraftRecipe = activeCraft ? RECIPE_MAP[activeCraft.recipeId] : null
  const craftPct = activeCraft
    ? Math.min(100, (activeCraft.elapsed / activeCraft.duration) * 100)
    : 0
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
  const [railOpen, setRailOpen] = useState(false)
  const [paintActive, setPaintActive] = useState(false)
  const [resPulse, setResPulse] = useState<Partial<Record<ItemId, boolean>>>({})
  const prevInv = useRef(state.inventory)

  const openInspect = useCallback((cell: { x: number; y: number }) => {
    setInspect(cell)
  }, [])

  const closeInspect = useCallback(() => {
    setInspect(null)
  }, [])

  const pickTool = useCallback(
    (list: ToolId[]) => {
      const unlocked = list.filter((t) => isUnlocked(t, state.researched))
      const stocked = unlocked.find((t) => {
        if (isEditMetaTool(t)) return true
        return (state.inventory[t as Placeable] ?? 0) > 0
      })
      return stocked ?? unlocked[0] ?? null
    },
    [state.researched, state.inventory],
  )
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const viewportSize = useRef({ width: 0, height: 0 })
  const cameraRef = useRef({ zoom, width, height })
  cameraRef.current = { zoom, width, height }
  const panRef = useRef(pan)
  panRef.current = pan
  const prevSteps = useRef(state.stepsToday)
  const prevOre = useRef(state.stats.oreMined)
  const prevCycles = useRef(state.mineCycles)
  const holdTimer = useRef(0)
  const gesture = useRef<{
    kind: 'none' | 'pending' | 'pan' | 'paint' | 'pinch'
    startZoom: number
    startDist: number
    startPan: { x: number; y: number } | null
    startMid: { x: number; y: number } | null
    moved: boolean
    lastCell: string | null
    origin: { x: number; y: number } | null
    last: { x: number; y: number } | null
    pointerId: number | null
  }>({
    kind: 'none',
    startZoom: 1,
    startDist: 0,
    startPan: null,
    startMid: null,
    moved: false,
    lastCell: null,
    origin: null,
    last: null,
    pointerId: null,
  })

  const isDragPaintTool = (tool: ToolId | null) =>
    tool === 'belt' ||
    tool === 'fastBelt' ||
    tool === 'undergroundBelt' ||
    tool === 'remove' ||
    tool === 'rotate' ||
    tool === 'inserter' ||
    tool === 'longInserter'

  const inspectEnt = useMemo(() => {
    if (!inspect) return null
    const id = tiles[idx(inspect.x, inspect.y)]?.entityId
    return id ? entities[id] ?? null : null
  }, [inspect, tiles, entities])

  const inspectTile = useMemo(() => {
    if (!inspect) return null
    return tiles[idx(inspect.x, inspect.y)] ?? null
  }, [inspect, tiles])

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
    const prev = prevInv.current
    const gained: ItemId[] = []
    for (const id of HUD_RESOURCES) {
      if ((state.inventory[id] ?? 0) > (prev[id] ?? 0)) gained.push(id)
    }
    prevInv.current = state.inventory
    if (!gained.length) return
    setResPulse((p) => {
      const next = { ...p }
      for (const id of gained) next[id] = true
      return next
    })
    const t = window.setTimeout(() => {
      setResPulse((p) => {
        const next = { ...p }
        for (const id of gained) delete next[id]
        return next
      })
    }, 420)
    return () => window.clearTimeout(t)
  }, [state.inventory])

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
    if (highlight === 'beltTool') {
      setToolTab('belts')
      setRailOpen(true)
    }
    if (highlight === 'ore' || highlight === 'drillTool') {
      setToolTab('build')
      setRailOpen(true)
    }
  }, [highlight])

  const clampCamera = useCallback((p: { x: number; y: number }) => {
    const cam = cameraRef.current
    return clampPan(p, cam.zoom, viewportSize.current, cam.width, cam.height)
  }, [])

  // Keep pan bounds in sync with viewport size and zoom
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const sync = () => {
      const rect = el.getBoundingClientRect()
      viewportSize.current = { width: rect.width, height: rect.height }
      setPan((p) => clampCamera(p))
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [clampCamera, zoom, width, height])

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current)
    }
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
      const beforeId = state.tiles[idx(x, y)]?.entityId
      const beforeDir = beforeId ? state.entities[beforeId]?.dir : null
      const preview = placeEntity(state, x, y)
      place(x, y)
      const afterId = preview.tiles[idx(x, y)]?.entityId
      const afterDir = afterId ? preview.entities[afterId]?.dir : null
      const placed = Boolean(afterId && afterId !== beforeId)
      const removed = Boolean(beforeId && !afterId)
      const rotated = Boolean(
        beforeId && afterId && beforeId === afterId && beforeDir !== afterDir,
      )

      if (selected === 'remove') {
        if (removed) {
          setFlash(key)
          window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 180)
          buzz(8)
          spawnFloater(x, y, 'scrap', 'warn')
        } else {
          buzz(4)
          spawnFloater(x, y, 'empty', 'warn')
        }
        return
      }

      if (selected === 'rotate') {
        if (rotated) {
          setFlash(key)
          window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 180)
          buzz(8)
          spawnFloater(x, y, 'turn', 'place')
        } else {
          buzz(4)
        }
        return
      }

      if (selected && !isEditMetaTool(selected)) {
        if (placed) {
          setFlash(key)
          window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 180)
          buzz(8)
          spawnFloater(x, y, PLACEABLE_META[selected].label.split(' ')[0], 'place')
        } else {
          buzz(4)
          spawnFloater(x, y, 'blocked', 'warn')
        }
        return
      }

      // copy / paste / other meta - still flash on any entity change
      if (placed || removed || rotated || preview.blueprint !== state.blueprint) {
        setFlash(key)
        window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 180)
        buzz(8)
      }
    },
    [place, selected, spawnFloater, state],
  )

  const centerOn = useCallback(
    (gx: number, gy: number) => {
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      viewportSize.current = { width: rect.width, height: rect.height }
      const z = cameraRef.current.zoom
      setPan(
        clampCamera({
          x: rect.width / 2 - (gx + 0.5) * CELL * z,
          y: rect.height / 2 - (gy + 0.5) * CELL * z,
        }),
      )
    },
    [clampCamera],
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

  /** Zoom around a viewport-local focal point, adjusting pan so that point stays put. */
  const zoomAt = useCallback(
    (nextZoom: number, focal: { x: number; y: number }) => {
      const z0 = cameraRef.current.zoom
      const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(nextZoom * 100) / 100))
      if (z1 === z0) return
      cameraRef.current = { ...cameraRef.current, zoom: z1 }
      setPan((p) =>
        clampCamera({
          x: focal.x - ((focal.x - p.x) * z1) / z0,
          y: focal.y - ((focal.y - p.y) * z1) / z0,
        }),
      )
      setZoom(z1)
    },
    [clampCamera],
  )

  const zoomByButton = useCallback(
    (delta: number) => {
      const vp = viewportRef.current
      const size = vp
        ? { width: vp.clientWidth, height: vp.clientHeight }
        : viewportSize.current
      zoomAt(cameraRef.current.zoom + delta, {
        x: size.width / 2,
        y: size.height / 2,
      })
    },
    [zoomAt],
  )

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = 0
    }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    const vp = viewportRef.current
    if (!vp) return
    clearHoldTimer()
    vp.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const rect = vp.getBoundingClientRect()
      const mid = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      }
      gesture.current = {
        kind: 'pinch',
        startZoom: cameraRef.current.zoom,
        startDist: Math.max(1, dist),
        startPan: { ...panRef.current },
        startMid: mid,
        moved: false,
        lastCell: null,
        origin: null,
        last: { x: e.clientX, y: e.clientY },
        pointerId: e.pointerId,
      }
      return
    }

    const cell = cellFromPoint(e.clientX, e.clientY)
    if (cell) setHover(cell)

    // Don't place yet - wait for tap vs drag. Drag always pans the map.
    gesture.current = {
      kind: 'pending',
      startZoom: zoom,
      startDist: 0,
      startPan: null,
      startMid: null,
      moved: false,
      lastCell: null,
      origin: { x: e.clientX, y: e.clientY },
      last: { x: e.clientX, y: e.clientY },
      pointerId: e.pointerId,
    }

    // Long-press then drag = paint belts / demolish (keeps one-finger pan free)
    if (isDragPaintTool(selected)) {
      holdTimer.current = window.setTimeout(() => {
        if (gesture.current.kind !== 'pending' || gesture.current.pointerId !== e.pointerId) return
        gesture.current.kind = 'paint'
        setPaintActive(true)
        buzz(10)
        const c = cellFromPoint(
          gesture.current.last?.x ?? e.clientX,
          gesture.current.last?.y ?? e.clientY,
        )
        if (c) {
          setHover(c)
          paintCell(c.x, c.y)
        }
      }, PAINT_HOLD_MS)
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (gesture.current.kind === 'pinch' && pointers.current.size >= 2) {
      const vp = viewportRef.current
      const startPan = gesture.current.startPan
      const startMid = gesture.current.startMid
      if (!vp || !startPan || !startMid) return

      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const nextZoom = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, gesture.current.startZoom * (dist / gesture.current.startDist)),
      )
      const z1 = Math.round(nextZoom * 100) / 100
      const z0 = gesture.current.startZoom
      const rect = vp.getBoundingClientRect()
      // Keep the world point under the moving pinch midpoint stable.
      const mid = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      }
      const ratio = z1 / z0
      cameraRef.current = { ...cameraRef.current, zoom: z1 }
      setZoom(z1)
      setPan(
        clampCamera({
          x: mid.x - (startMid.x - startPan.x) * ratio,
          y: mid.y - (startMid.y - startPan.y) * ratio,
        }),
      )
      gesture.current.moved = true
      return
    }

    const last = gesture.current.last ?? { x: e.clientX, y: e.clientY }
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    gesture.current.last = { x: e.clientX, y: e.clientY }

    // Resolve pending → pan once the finger moves past slop
    if (gesture.current.kind === 'pending' && gesture.current.origin) {
      const ox = e.clientX - gesture.current.origin.x
      const oy = e.clientY - gesture.current.origin.y
      if (Math.hypot(ox, oy) > PAN_SLOP) {
        clearHoldTimer()
        gesture.current.kind = 'pan'
        gesture.current.moved = true
      }
    }

    if (gesture.current.kind === 'pan' && pointers.current.size === 1) {
      setPan((p) => {
        const attempted = { x: p.x + dx, y: p.y + dy }
        const next = clampCamera(attempted)
        return next
      })
      gesture.current.moved = true
      return
    }

    if (gesture.current.kind === 'paint') {
      const cell = cellFromPoint(e.clientX, e.clientY)
      if (!cell) return
      setHover(cell)
      gesture.current.moved = true
      paintCell(cell.x, cell.y)
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const kind = gesture.current.kind
    const origin = gesture.current.origin
    clearHoldTimer()
    pointers.current.delete(e.pointerId)

    if (pointers.current.size < 2 && kind === 'pinch') {
      gesture.current.kind = 'none'
      gesture.current.startPan = null
      gesture.current.startMid = null
      gesture.current.startZoom = 1
      gesture.current.startDist = 0
    }

    if (pointers.current.size === 0) {
      if (kind === 'pan' || kind === 'pinch') setHover(null)

      // Tap (no drag / no long-press paint): place with tool, or inspect in hand mode
      const wasTap =
        kind === 'pending' &&
        origin &&
        Math.hypot(e.clientX - origin.x, e.clientY - origin.y) <= PAN_SLOP

      if (wasTap) {
        const cell = cellFromPoint(e.clientX, e.clientY)
        if (selected && cell) {
          paintCell(cell.x, cell.y)
        } else if (!selected && cell) {
          // Tap same tile again to close; otherwise inspect (map stays pannable).
          if (inspect && inspect.x === cell.x && inspect.y === cell.y) {
            closeInspect()
          } else {
            openInspect(cell)
            buzz(6)
            const tile = tiles[idx(cell.x, cell.y)]
            if (tile?.ore) {
              spawnFloater(cell.x, cell.y, ITEM_META[tile.ore].short, 'ore')
            }
          }
        } else if (!selected) {
          closeInspect()
        }
      }

      setPaintActive(false)
      gesture.current.kind = 'none'
      gesture.current.moved = false
      gesture.current.lastCell = null
      gesture.current.origin = null
      gesture.current.last = null
      gesture.current.pointerId = null
      gesture.current.startPan = null
      gesture.current.startMid = null
      gesture.current.startZoom = 1
      gesture.current.startDist = 0
    }
  }

  useEffect(() => {
    if (selected) setRailOpen(true)
  }, [selected])

  const selectedToolName = !selected
    ? null
    : selected === 'remove'
      ? 'Demolish'
      : selected === 'rotate'
        ? 'Rotate'
        : selected === 'copy'
          ? 'Copy'
          : selected === 'paste'
            ? 'Paste'
            : PLACEABLE_META[selected].label

  const selectedToolCount =
    selected && !isEditMetaTool(selected)
      ? (state.inventory[PLACEABLE_META[selected].inventoryKey] ?? 0)
      : selected === 'paste' && state.blueprint
        ? state.blueprint.length
        : null

  const toolLabel = !selected
    ? 'Drag to pan · tap a tile to inspect · tap again to close'
    : selected === 'remove'
      ? 'Tap or hold-drag to demolish · drag pans'
      : selected === 'rotate'
        ? 'Tap or hold-drag to rotate · drag pans'
        : selected === 'copy'
          ? 'Tap two corners · drag to pan'
          : selected === 'paste'
            ? 'Tap origin · drag to pan'
            : isDragPaintTool(selected)
              ? 'Tap to place · hold-drag to paint · drag pans'
              : 'Tap to place · drag pans'

  const modeHint = paintActive
    ? selected === 'remove'
      ? 'Release to stop demolishing'
      : selected === 'rotate'
        ? 'Release to stop rotating'
        : 'Release to stop painting'
    : selected === 'remove'
      ? 'Hold-drag clears a path'
      : selected === 'rotate'
        ? 'Or use the yellow arrow FAB'
        : selected === 'copy'
          ? 'Second tap finishes the box'
          : selected === 'paste'
            ? state.blueprint
              ? `Blueprint ${state.blueprint.length} tiles`
              : 'Copy a region first'
            : isDragPaintTool(selected)
              ? 'Hold-drag paints a line'
              : 'Drag pans the map'

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

  /** Green IO marks: pickup (behind) / drop (front) for every inserter + place ghost. */
  const inserterIo = useMemo(() => {
    const pickup = new Set<string>()
    const drop = new Set<string>()
    const mark = (
      set: Set<string>,
      cell: { x: number; y: number } | null,
    ) => {
      if (cell) set.add(`${cell.x},${cell.y}`)
    }

    for (const e of Object.values(entities)) {
      if (!isInserterKind(e.kind)) continue
      const reach = e.kind === 'longInserter' ? 2 : 1
      const io = inserterIoAt(e.x, e.y, e.dir, reach, width, height)
      mark(pickup, io.pickup)
      mark(drop, io.drop)
    }

    if (
      hover &&
      (selected === 'inserter' || selected === 'longInserter')
    ) {
      const reach = selected === 'longInserter' ? 2 : 1
      const io = inserterIoAt(hover.x, hover.y, placeDir, reach, width, height)
      mark(pickup, io.pickup)
      mark(drop, io.drop)
    }

    return { pickup, drop }
  }, [entities, width, height, hover, selected, placeDir])

  const beltBends = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getBeltBend>>()
    for (const e of Object.values(entities)) {
      if (!isBeltKind(e.kind)) continue
      map.set(e.id, getBeltBend(tiles, entities, e, width, height))
    }
    return map
  }, [entities, tiles, width, height])

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
            className={`game-hud-steps ${stepPulse ? 'is-pulse' : ''}`}
            onClick={onOpenSteps}
            title="Today's steps - open Steps"
            aria-label={`${formatNum(state.stepsToday)} steps today`}
          >
            <span className="game-hud-steps-label">Today</span>
            <span className="game-hud-steps-num">{formatNum(state.stepsToday)}</span>
          </button>
          <button
            type="button"
            className="game-hud-settings"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
          >
            ···
          </button>
        </div>

        <div className="game-hud-resources" aria-label="Inventory">
          {HUD_RESOURCES.map((id) => {
            const n = state.inventory[id] ?? 0
            if (n <= 0 && id !== 'ironOre' && id !== 'coal' && id !== 'ironPlate') return null
            return (
              <span
                key={id}
                className={`game-res${resPulse[id] ? ' is-pulse' : ''}`}
                style={{ '--res': ITEM_META[id].color } as CSSProperties}
              >
                <ItemSprite item={id} />
                <em>{formatNum(n)}</em>
              </span>
            )
          })}
        </div>

        {goal ? (
          <button
            type="button"
            className={`game-objective${claimableContracts.length > 0 ? ' is-claim' : ''}`}
            onClick={onOpenTasks}
          >
            <span>{claimableContracts.length > 0 ? 'Claim' : 'Objective'}</span>
            <strong>
              {claimableContracts.length > 0
                ? `${goal.title} · ${claimableContracts.length} ready`
                : goal.title}
            </strong>
            {goalProg && (
              <em className="game-objective-prog">
                {goalProg.cur.toLocaleString()}/{goalProg.max.toLocaleString()}
              </em>
            )}
            {goalProg && (
              <span
                className="game-objective-bar"
                aria-hidden
                style={
                  {
                    '--obj-pct': `${Math.min(100, (goalProg.cur / goalProg.max) * 100)}%`,
                  } as CSSProperties
                }
              />
            )}
          </button>
        ) : claimableContracts.length > 0 ? (
          <button
            type="button"
            className="game-objective is-claim"
            onClick={onOpenTasks}
          >
            <span>Contracts</span>
            <strong>
              {claimableContracts.length === 1
                ? 'Claim ready'
                : `${claimableContracts.length} claims ready`}
            </strong>
          </button>
        ) : (
          <button type="button" className="game-objective is-clear" onClick={onOpenTasks}>
            <span>Contracts</span>
            <strong>All clear - expand</strong>
          </button>
        )}

        {activeCraftRecipe && (
          <div className="game-craft-chip" aria-live="polite">
            <span className="game-craft-chip-label">Crafting</span>
            <strong>{activeCraftRecipe.name}</strong>
            <em>
              {state.craftQueue.length > 1
                ? `+${state.craftQueue.length - 1} queued`
                : `${Math.round(craftPct)}%`}
            </em>
            <span
              className="game-craft-chip-bar"
              aria-hidden
              style={{ '--craft-pct': `${craftPct}%` } as CSSProperties}
            />
          </div>
        )}
      </div>

      <div
        className={[
          'factory-viewport',
          'is-pan',
          selected ? 'is-build' : '',
          railOpen && selected ? 'is-tools-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
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
                  isHover && !!selected && !isEditMetaTool(selected)

                const lit = Boolean(
                  ent && (isFurnaceKind(ent.kind) || ent.kind === 'assembler') && ent.smelting,
                )
                const active = Boolean(
                  (ent?.kind === 'drill' && (ent.store.coal ?? 0) > 0 && tile.ore) ||
                    (ent?.kind === 'electricDrill' && tile.ore),
                )
                const status = ent ? machineStatus(ent, tile, state) : null
                const movingBelt =
                  ent?.kind === 'belt' ||
                  ent?.kind === 'fastBelt' ||
                  ent?.kind === 'splitter' ||
                  ent?.kind === 'undergroundBelt'
                const beltBend =
                  ent && isBeltKind(ent.kind) ? beltBends.get(ent.id) ?? null : null
                const filled = ent ? storeTotal(ent.store) > 0 : false
                const isInspect = inspect?.x === x && inspect?.y === y
                const isFlash = flash === `${x},${y}`
                const key = `${x},${y}`
                const isIoPickup = inserterIo.pickup.has(key)
                const isIoDrop = inserterIo.drop.has(key)

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
                      status?.floorClass ?? '',
                      isIoPickup ? 'is-io-pickup' : '',
                      isIoDrop ? 'is-io-drop' : '',
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
                          progress={ent.progress}
                          turn={beltBend?.turn}
                        />
                      </span>
                    )}

                    {ent && isInserterKind(ent.kind) && (
                      <InserterDirOverlay dir={ent.dir} />
                    )}

                    {showGhost && (
                      <span className="cell-ghost">
                        <EntitySprite kind={selected as Placeable} dir={placeDir} />
                      </span>
                    )}

                    {showGhost &&
                      (selected === 'inserter' || selected === 'longInserter') && (
                        <InserterDirOverlay dir={placeDir} />
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
                      ent?.kind === 'undergroundBelt' ||
                      ent?.kind === 'splitter') &&
                      ent.cargo && (
                        <span
                          className={`cargo-item${
                            ent.kind === 'fastBelt' ? ' is-fast' : ''
                          }${ent.kind === 'undergroundBelt' ? ' is-ug' : ''}`}
                          style={cargoOffset(ent.dir, ent.cargo.progress, {
                            underground: ent.kind === 'undergroundBelt',
                            fromDir: beltBend?.from,
                          })}
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

                    {(isIoPickup || isIoDrop) && (
                      <span
                        className={[
                          'cell-io',
                          isIoPickup ? 'is-from' : '',
                          isIoDrop ? 'is-to' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-hidden
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
            onClick={() => zoomByButton(-0.15)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="fab-btn"
            onClick={() => zoomByButton(0.15)}
            aria-label="Zoom in"
          >
            +
          </button>
          {needsPlaceDir(selected) && (
            <button
              type="button"
              className="fab-btn fab-rotate"
              onClick={() => {
                rotateDir()
                buzz(6)
              }}
              aria-label="Rotate placement"
              title={`Facing ${placeDir}`}
            >
              {dirArrow(placeDir)}
            </button>
          )}
          <button type="button" className="fab-btn" onClick={recenter} aria-label="Recenter">
            ⌖
          </button>
        </div>

        <Minimap
          width={width}
          height={height}
          tiles={tiles}
          entities={entities}
          state={state}
          pan={pan}
          zoom={zoom}
          viewportRef={viewportRef}
          onJump={centerOn}
        />

        {(selected || paintActive) && (
          <div
            className={`mode-banner${paintActive ? ' is-painting' : ''}`}
            aria-live="polite"
          >
            <strong>{paintActive ? 'Painting - drag to continue' : toolLabel}</strong>
            <span>{modeHint}</span>
          </div>
        )}

        <div
          className={`build-rail ${railOpen && selected ? 'is-expanded' : 'is-slim'}`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {selected && selectedToolName && (
            <div className="build-rail-selected" aria-live="polite">
              <ToolIcon kind={selected} />
              <strong>{selectedToolName}</strong>
              {selectedToolCount != null && (
                <span className="build-rail-selected-count">
                  {selected === 'paste' ? `${formatNum(selectedToolCount)} tiles` : formatNum(selectedToolCount)}
                </span>
              )}
            </div>
          )}
          {railOpen && selected && (
            <div className="build-rail-tray" role="toolbar" aria-label="Build tools">
              <div className="build-rail-tools">
                {toolsForTab.map((tool) => {
                  const unlocked = isUnlocked(tool, state.researched)
                  if (!unlocked) return null
                  const label =
                    tool === 'remove'
                      ? 'Demolish'
                      : tool === 'rotate'
                        ? 'Rotate'
                        : tool === 'copy'
                          ? 'Copy'
                          : tool === 'paste'
                            ? 'Paste'
                            : PLACEABLE_META[tool].label
                  const count = isEditMetaTool(tool)
                    ? tool === 'paste' && state.blueprint
                      ? state.blueprint.length
                      : null
                    : state.inventory[PLACEABLE_META[tool].inventoryKey]
                  const pulse =
                    (highlight === 'drillTool' && tool === 'drill') ||
                    (highlight === 'ore' && tool === 'drill') ||
                    (highlight === 'beltTool' && tool === 'belt')
                  const affordable =
                    isEditMetaTool(tool) || (count !== null && count > 0)
                  return (
                    <button
                      key={tool}
                      type="button"
                      className={[
                        'rail-tool',
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
                      aria-label={
                        count !== null ? `${label}, ${formatNum(count)}` : label
                      }
                    >
                      <ToolIcon kind={tool} />
                      {count !== null && (
                        <span className="rail-tool-count">{formatNum(count)}</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="build-rail-quick">
                <button
                  type="button"
                  className="rail-chip"
                  onClick={() => {
                    const preview = fuelAllDrills(state)
                    let fueled = 0
                    for (const e of Object.values(state.entities)) {
                      if (!isDrillKind(e.kind) || e.kind !== 'drill') continue
                      const before = e.store.coal ?? 0
                      const after = preview.entities[e.id]?.store.coal ?? 0
                      if (after > before + 0.01) {
                        spawnFloater(e.x, e.y, '+fuel', 'good')
                        fueled += 1
                      }
                    }
                    fuelDrills()
                    if (fueled <= 0) {
                      const anyDrill = Object.values(state.entities).find((e) => e.kind === 'drill')
                      if (anyDrill) spawnFloater(anyDrill.x, anyDrill.y, 'no fuel', 'warn')
                      buzz(4)
                    } else {
                      buzz(10)
                    }
                  }}
                >
                  Fuel
                </button>
                {!state.tutorialComplete && (
                  <button
                    type="button"
                    className="rail-chip"
                    onClick={() => buildStarter()}
                  >
                    Starter
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="build-rail-modes" role="tablist" aria-label="Tool groups">
            <button
              type="button"
              className={`rail-mode ${!selected ? 'is-active' : ''}`}
              onClick={() => {
                selectTool(null)
                setRailOpen(false)
                setInspect(null)
              }}
              title="Hand - pan the map"
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
                  className={`rail-mode ${tabActive ? 'is-active' : ''}`}
                  onClick={() => {
                    setToolTab(id)
                    const next = pickTool(list)
                    if (next) {
                      selectTool(next)
                      setRailOpen(true)
                    }
                  }}
                >
                  {label}
                </button>
              )
            })}
            <button
              type="button"
              className="rail-mode is-toggle"
              onClick={() => {
                if (railOpen && selected) {
                  setRailOpen(false)
                } else {
                  const list =
                    toolTab === 'build'
                      ? BUILD_TOOLS
                      : toolTab === 'belts'
                        ? BELT_TOOLS
                        : EDIT_TOOLS
                  const next = selected ?? pickTool(list)
                  if (next) selectTool(next)
                  setRailOpen(true)
                }
              }}
              aria-expanded={railOpen && !!selected}
              title={railOpen && selected ? 'Hide tools' : 'Show tools'}
            >
              {railOpen && selected ? '▾' : '▴'}
            </button>
          </div>
        </div>

      {inspect && inspectTile && (
        <div className="inspect-modal" role="presentation">
          <div
            className={`inspect-card ${inspectEnt ? 'is-entity' : 'is-ground'}`}
            role="dialog"
            aria-label={inspectEnt ? 'Machine' : 'Tile'}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerCancel={(e) => e.stopPropagation()}
          >
            <div className="inspect-card-head">
              <div className="inspect-card-title">
                {inspectEnt ? (
                  <>
                    <ToolIcon kind={inspectEnt.kind as Placeable} />
                    <strong>
                      {PLACEABLE_META[inspectEnt.kind as Placeable]?.label ?? inspectEnt.kind}
                    </strong>
                    <span className="inspect-card-dir" aria-hidden>
                      {dirArrow(inspectEnt.dir)}
                    </span>
                  </>
                ) : inspectTile.ore ? (
                  <>
                    <ItemSprite item={inspectTile.ore} />
                    <strong>{ITEM_META[inspectTile.ore].label}</strong>
                  </>
                ) : (
                  <strong>Empty ground</strong>
                )}
              </div>
              <button
                type="button"
                className="inspect-card-close"
                onClick={() => closeInspect()}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {inspectEnt ? (
              <>
                <p className="inspect-card-desc">
                  {PLACEABLE_META[inspectEnt.kind as Placeable]?.hint ??
                    (inspectEnt.kind === 'assembler'
                      ? 'Crafts gears from iron plates.'
                      : 'Rotate to turn; Demolish to remove.')}
                </p>
                {(() => {
                  const status = machineStatus(inspectEnt, inspectTile, state)
                  return (
                    <p className={`inspect-card-status is-${status.tone}`}>
                      {status.label}
                    </p>
                  )
                })()}
                {hasMachineInventory(inspectEnt.kind) && (
                  <MachineInventory entity={inspectEnt} />
                )}
                <p className="inspect-card-meta">
                  ({inspect.x},{inspect.y})
                  {inspectTile.ore
                    ? ` · on ${ITEM_META[inspectTile.ore].label}${
                        inspectTile.amount != null
                          ? ` (${formatNum(inspectTile.amount)} left)`
                          : ''
                      }`
                    : ' · plain ground'}
                  {!hasMachineInventory(inspectEnt.kind) && storeSummary(inspectEnt)
                    ? ` · ${storeSummary(inspectEnt)}`
                    : ''}
                  {inspectEnt.kind === 'drill'
                    ? ` · coal ${Math.floor(inspectEnt.store.coal ?? 0)}`
                    : ''}
                </p>
                <div className="inspect-card-actions">
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
                        const beforeCoal = state.inventory.coal
                        const preview = fuelDrillAt(state, inspect.x, inspect.y)
                        fuelAt(inspect.x, inspect.y)
                        const spent = beforeCoal - preview.inventory.coal
                        if (spent <= 0) {
                          spawnFloater(inspect.x, inspect.y, 'no fuel', 'warn')
                          buzz(4)
                        } else {
                          spawnFloater(inspect.x, inspect.y, '+fuel', 'good')
                          buzz(10)
                        }
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
                        const beforeHeld = Object.values(inspectEnt.store).reduce(
                          (s, n) => s + (n ?? 0),
                          0,
                        )
                        collect(inspect.x, inspect.y)
                        if (beforeHeld <= 0) {
                          spawnFloater(inspect.x, inspect.y, 'empty', 'warn')
                          buzz(4)
                        } else {
                          spawnFloater(inspect.x, inspect.y, 'loot', 'good')
                          buzz(10)
                        }
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
              </>
            ) : (
              <>
                <p className="inspect-card-desc">
                  {inspectTile.ore === 'ironOre'
                    ? 'Brown iron patch. Place a burner or electric drill here to mine it with steps.'
                    : inspectTile.ore === 'copperOre'
                      ? 'Copper patch. Drill here to mine copper ore for plates and wiring crafts.'
                      : inspectTile.ore === 'coal'
                        ? 'Coal seam. Mine it for fuel - burner drills and furnaces need coal.'
                        : 'Open ground. Belts, furnaces, chests, and assemblers can go here.'}
                </p>
                <p className="inspect-card-meta">
                  ({inspect.x},{inspect.y})
                  {inspectTile.ore
                    ? inspectTile.amount == null
                      ? ' · Rich patch'
                      : ` · ${formatNum(inspectTile.amount)} remaining`
                    : ' · buildable tile'}
                </p>
                {inspectTile.ore && (
                  <div className="inspect-card-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={(state.inventory.drill ?? 0) < 1}
                      onClick={() => {
                        selectTool('drill')
                        setRailOpen(true)
                        setToolTab('build')
                        setInspect(null)
                        buzz(6)
                      }}
                    >
                      Select drill
                    </button>
                    {(state.inventory.electricDrill ?? 0) > 0 &&
                      state.researched.includes('electricMining') && (
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => {
                            selectTool('electricDrill')
                            setRailOpen(true)
                            setToolTab('build')
                            setInspect(null)
                            buzz(6)
                          }}
                        >
                          Electric drill
                        </button>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
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
  state,
  pan,
  zoom,
  viewportRef,
  onJump,
}: {
  width: number
  height: number
  tiles: GameState['tiles']
  entities: GameState['entities']
  state: GameState
  pan: { x: number; y: number }
  zoom: number
  viewportRef: RefObject<HTMLDivElement | null>
  onJump: (x: number, y: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [theme, setTheme] = useState(resolveTheme)
  const scale = 3

  useEffect(() => subscribeTheme(({ resolved }) => setTheme(resolved)), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const light = theme === 'light'
    canvas.width = width * scale
    canvas.height = height * scale
    ctx.fillStyle = light ? '#d4c8b0' : '#1a2214'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[idx(x, y)]
        if (tile.ore === 'ironOre') ctx.fillStyle = light ? '#a09078' : '#8B7355'
        else if (tile.ore === 'copperOre') ctx.fillStyle = '#C4783A'
        else if (tile.ore === 'coal') ctx.fillStyle = light ? '#5a5a5a' : '#2A2A2A'
        else ctx.fillStyle = light ? '#9bb262' : '#3a4a28'
        ctx.fillRect(x * scale, y * scale, scale, scale)
        if (tile.entityId && entities[tile.entityId]) {
          const ent = entities[tile.entityId]
          const kind = ent.kind
          if (kind.includes('belt') || kind === 'splitter') ctx.fillStyle = '#f0a020'
          else if (kind.includes('drill')) ctx.fillStyle = light ? '#3d9e5f' : '#7dff9a'
          else if (kind.includes('furnace') || kind === 'assembler') ctx.fillStyle = '#e07040'
          else ctx.fillStyle = '#7b8792'
          ctx.fillRect(x * scale, y * scale, scale, scale)

          const status = machineStatus(ent, tile, state)
          if (status.floorClass === 'is-needs-fuel' || status.floorClass === 'is-blocked') {
            ctx.fillStyle = status.floorClass === 'is-needs-fuel' ? '#e05030' : '#f0a020'
            ctx.fillRect(x * scale + 1, y * scale + 1, Math.max(1, scale - 2), Math.max(1, scale - 2))
          }
        }
      }
    }
  }, [width, height, tiles, entities, state, theme])

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
      aria-label="Minimap - tap to jump"
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
