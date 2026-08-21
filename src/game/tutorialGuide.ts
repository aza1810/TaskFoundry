import {
  DIR_DELTA,
  DIRS,
  idx,
  inBounds,
  isBeltKind,
  isDrillKind,
  isFurnaceKind,
  isInserterKind,
  PLACEABLE_META,
} from './data'
import { inserterIoAt } from './grid'
import { countPlacedChests, maxChestsFor } from './research'
import {
  getTutorialStep,
  type TutorialHighlight,
  type TutorialStepDef,
  type TutorialStepId,
} from './tutorial'
import type { Dir, Entity, GameState, Placeable, ToolId } from './types'

export interface TutorialCheckStatus {
  id: string
  label: string
  done: boolean
  tool?: ToolId
}

export interface TutorialGhost {
  x: number
  y: number
  kind: Placeable
  dir: Dir
  next: boolean
}

type KindCounts = {
  drills: number
  belts: number
  inserters: number
  chests: number
  furnaces: number
}

const LINE: { kind: Placeable; d: number }[] = [
  { kind: 'drill', d: 0 },
  { kind: 'belt', d: 1 },
  { kind: 'inserter', d: 2 },
  { kind: 'chest', d: 3 },
  { kind: 'inserter', d: 4 },
  { kind: 'belt', d: 5 },
  { kind: 'inserter', d: 6 },
  { kind: 'furnace', d: 7 },
  { kind: 'inserter', d: 8 },
  { kind: 'chest', d: 9 },
]

const STEP_GHOST_OFFSETS: Partial<Record<TutorialStepId, number[]>> = {
  placeDrill: [0],
  oreToChest: [1, 2, 3],
  chestToFurnace: [4, 5, 6, 7],
  plateChest: [8, 9],
}

function countsOf(state: GameState): KindCounts {
  const c: KindCounts = {
    drills: 0,
    belts: 0,
    inserters: 0,
    chests: 0,
    furnaces: 0,
  }
  for (const e of Object.values(state.entities)) {
    if (isDrillKind(e.kind)) c.drills += 1
    else if (isBeltKind(e.kind)) c.belts += 1
    else if (isInserterKind(e.kind)) c.inserters += 1
    else if (e.kind === 'chest') c.chests += 1
    else if (isFurnaceKind(e.kind)) c.furnaces += 1
  }
  return c
}

function entityAt(state: GameState, x: number, y: number): Entity | null {
  if (!inBounds(x, y, state.width, state.height)) return null
  const id = state.tiles[idx(x, y)]?.entityId
  return id ? state.entities[id] ?? null : null
}

function isSourceKind(kind: Entity['kind']): boolean {
  return (
    isDrillKind(kind) ||
    isBeltKind(kind) ||
    kind === 'chest' ||
    isFurnaceKind(kind) ||
    kind === 'assembler' ||
    kind === 'splitter' ||
    kind === 'undergroundBelt'
  )
}

function isSinkKind(kind: Entity['kind']): boolean {
  return (
    isBeltKind(kind) ||
    kind === 'chest' ||
    isFurnaceKind(kind) ||
    kind === 'assembler' ||
    kind === 'splitter' ||
    kind === 'undergroundBelt'
  )
}

function matchingInserters(
  state: GameState,
  pickupKinds: Array<(kind: Entity['kind']) => boolean>,
  dropKinds: Array<(kind: Entity['kind']) => boolean>,
): number {
  let n = 0
  for (const e of Object.values(state.entities)) {
    if (!isInserterKind(e.kind)) continue
    const reach = e.kind === 'longInserter' ? 2 : 1
    const io = inserterIoAt(e.x, e.y, e.dir, reach, state.width, state.height)
    const pickup = io.pickup ? entityAt(state, io.pickup.x, io.pickup.y) : null
    const drop = io.drop ? entityAt(state, io.drop.x, io.drop.y) : null
    const fromOk =
      pickupKinds.length === 0 ||
      (pickup != null && pickupKinds.some((fn) => fn(pickup.kind)))
    const toOk =
      dropKinds.length === 0 ||
      (drop != null && dropKinds.some((fn) => fn(drop.kind)))
    if (fromOk && toOk) n += 1
  }
  return n
}

function evalCheck(id: string, state: GameState, c: KindCounts): boolean {
  switch (id) {
    case 'roboport':
      return Object.values(state.entities).some(
        (e) => e.kind === 'roboport' && !e.ghost,
      )
    case 'drill':
      return c.drills >= 1
    case 'belt':
      return c.belts >= 1
    case 'chest1':
      return c.chests >= 1
    case 'inserter1':
      return (
        matchingInserters(state, [isBeltKind], [(k) => k === 'chest']) >= 1 ||
        (c.inserters >= 1 && c.chests >= 1)
      )
    case 'steps':
      return state.stepsLifetime >= 10 || state.mineCycles >= 10
    case 'furnace':
      return c.furnaces >= 1
    case 'belt2':
      return c.belts >= 2
    case 'inserter2':
      return (
        (matchingInserters(state, [(k) => k === 'chest'], [isBeltKind]) >= 1 &&
          matchingInserters(state, [isBeltKind], [isFurnaceKind]) >= 1) ||
        (c.furnaces >= 1 && c.inserters >= 3)
      )
    case 'chest2':
      return c.chests >= 2
    case 'inserter3':
      return (
        matchingInserters(state, [isFurnaceKind], [(k) => k === 'chest']) >= 1 ||
        (c.chests >= 2 && c.inserters >= 4)
      )
    default:
      return false
  }
}

export function tutorialChecklist(
  state: GameState,
  step: TutorialStepDef | null,
): TutorialCheckStatus[] {
  if (!step?.checks?.length) return []
  const c = countsOf(state)
  return step.checks.map((item) => ({
    id: item.id,
    label: item.label,
    tool: item.tool,
    done: evalCheck(item.id, state, c),
  }))
}

export function tutorialRecommendedTool(
  checks: TutorialCheckStatus[],
  fallback: ToolId | undefined,
): ToolId | null {
  const next = checks.find((item) => !item.done && item.tool)
  return next?.tool ?? fallback ?? null
}

export function tutorialHighlightFor(
  step: TutorialStepDef | null,
  recommended: ToolId | null,
): TutorialHighlight {
  if (!step) return null
  if (recommended === 'roboport') return 'roboportTool'
  if (recommended === 'drill' || recommended === 'electricDrill') return 'ore'
  if (recommended === 'belt' || recommended === 'fastBelt') return 'beltTool'
  if (recommended === 'inserter' || recommended === 'longInserter') {
    return 'inserterTool'
  }
  if (recommended === 'chest') return 'chestTool'
  if (recommended === 'furnace' || recommended === 'steelFurnace') {
    return 'furnaceTool'
  }
  return step.highlight ?? null
}

export function tutorialCoachHint(
  state: GameState,
  step: TutorialStepDef | null,
  checks: TutorialCheckStatus[],
): string | null {
  if (!step) return null
  const next = checks.find((item) => !item.done)
  if (!next) return step.action ?? null

  if (next.id === 'inserter1' || next.id === 'inserter2' || next.id === 'inserter3') {
    const anyInserter = Object.values(state.entities).some((e) =>
      isInserterKind(e.kind),
    )
    if (anyInserter) {
      return 'Point the green arrow into the machine. Inserters pull from behind and drop in front.'
    }
    return 'Place the inserter between the two tiles. The arrow is the drop side.'
  }
  if (next.id === 'belt' || next.id === 'belt2') {
    return 'Tap or hold-drag to paint belts. They carry items the way the chevrons point.'
  }
  if (next.id === 'drill') {
    return 'Drills only go on ore. Aim the yellow arrow at empty ground.'
  }
  if (next.id === 'chest1') {
    return 'Place the chest on the glowing ghost. Belts cannot dump into it. Use an inserter.'
  }
  if (next.id === 'chest2') {
    return 'Second chest unlocked. Catch plates coming out of the furnace.'
  }
  if (next.id === 'furnace') {
    return 'Furnaces need ore and coal. Place it on the glowing tile.'
  }
  if (next.id === 'steps') {
    return 'Open Steps, then sync Health or start the pedometer.'
  }
  return next.label
}

function emptyRun(state: GameState, x: number, y: number, dir: Dir): number {
  const { dx, dy } = DIR_DELTA[dir]
  let n = 0
  for (let i = 1; i <= 10; i++) {
    const nx = x + dx * i
    const ny = y + dy * i
    if (!inBounds(nx, ny, state.width, state.height)) break
    if (state.tiles[idx(nx, ny)]?.entityId) break
    n += 1
  }
  return n
}

function findLineOrigin(state: GameState): { x: number; y: number; dir: Dir } | null {
  const drills = Object.values(state.entities).filter((e) => isDrillKind(e.kind))
  if (drills.length) {
    const d = drills[0]
    return { x: d.x, y: d.y, dir: d.dir }
  }

  // The drill sits on ore; the rest of the line must be clear grass so the
  // belt/inserter/chest never land on the ore patch.
  const tryOrigin = (x: number, y: number, dir: Dir) => {
    const { dx, dy } = DIR_DELTA[dir]
    for (let i = 1; i <= 9; i++) {
      const nx = x + dx * i
      const ny = y + dy * i
      if (!inBounds(nx, ny, state.width, state.height)) return false
      const t = state.tiles[idx(nx, ny)]
      if (!t || t.entityId || t.ore) return false
    }
    return true
  }

  const prefer: Dir[] = ['E', 'S', 'W', 'N']
  for (const dir of prefer) {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[idx(x, y)]
        if (tile.ore !== 'ironOre' || tile.entityId) continue
        if (tryOrigin(x, y, dir)) return { x, y, dir }
      }
    }
  }

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = state.tiles[idx(x, y)]
      if (tile.ore !== 'ironOre' || tile.entityId) continue
      return { x, y, dir: 'E' }
    }
  }
  return null
}

export function tutorialGhosts(
  state: GameState,
  step: TutorialStepDef | null,
  recommended: ToolId | null,
): TutorialGhost[] {
  if (!step || state.tutorialComplete) return []
  const offsets = STEP_GHOST_OFFSETS[step.id]
  if (!offsets) return []
  const origin = findLineOrigin(state)
  if (!origin) return []

  const { dx, dy } = DIR_DELTA[origin.dir]
  const ghosts: TutorialGhost[] = []
  for (const d of offsets) {
    const spec = LINE[d]
    if (!spec) continue
    const x = origin.x + dx * spec.d
    const y = origin.y + dy * spec.d
    if (!inBounds(x, y, state.width, state.height)) continue
    const ent = entityAt(state, x, y)
    if (ent) continue
    ghosts.push({
      x,
      y,
      kind: spec.kind,
      dir: origin.dir,
      next: false,
    })
  }

  const nextIdx = ghosts.findIndex((g) => g.kind === recommended)
  const mark = nextIdx >= 0 ? nextIdx : 0
  if (ghosts[mark]) ghosts[mark] = { ...ghosts[mark], next: true }
  return ghosts
}

export function tutorialFocusCell(
  state: GameState,
  step: TutorialStepDef | null,
  ghosts: TutorialGhost[],
): { x: number; y: number } | null {
  const next = ghosts.find((g) => g.next) ?? ghosts[0]
  if (next) return { x: next.x, y: next.y }
  if (step?.id === 'placeDrill') {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[idx(x, y)]
        if (tile.ore === 'ironOre' && !tile.entityId) return { x, y }
      }
    }
  }
  const drill = Object.values(state.entities).find((e) => isDrillKind(e.kind))
  if (drill) return { x: drill.x, y: drill.y }
  return null
}

export function tutorialToolsFor(
  step: TutorialStepDef | null,
  tab: 'build' | 'logistics' | 'edit',
  full: ToolId[],
): ToolId[] {
  if (!step || step.mode !== 'coach') return full
  const allow: ToolId[] =
    step.id === 'placeRoboport'
      ? ['roboport']
      : step.id === 'placeDrill'
        ? ['drill']
      : step.id === 'oreToChest'
        ? ['chest', 'belt', 'inserter']
        : step.id === 'chestToFurnace'
          ? ['furnace', 'belt', 'inserter', 'chest']
          : step.id === 'plateChest'
            ? ['chest', 'inserter']
            : []
  if (tab === 'edit') return full
  if (!allow.length) return full
  const filtered = full.filter((t) => allow.includes(t))
  return filtered.length ? filtered : full
}

function inserterDirScore(
  state: GameState,
  x: number,
  y: number,
  dir: Dir,
  reach: number,
): number {
  const io = inserterIoAt(x, y, dir, reach, state.width, state.height)
  const pickup = io.pickup ? entityAt(state, io.pickup.x, io.pickup.y) : null
  const drop = io.drop ? entityAt(state, io.drop.x, io.drop.y) : null
  let score = 0
  if (pickup && isSourceKind(pickup.kind)) score += 3
  if (drop && isSinkKind(drop.kind)) score += 3
  if (pickup && isDrillKind(pickup.kind)) score += 2
  if (pickup && isBeltKind(pickup.kind)) score += 2
  if (drop && (drop.kind === 'chest' || isFurnaceKind(drop.kind))) score += 3
  if (pickup && pickup.kind === 'chest' && drop && isBeltKind(drop.kind)) score += 2
  if (pickup && isFurnaceKind(pickup.kind) && drop && drop.kind === 'chest') {
    score += 3
  }
  return score
}

/** Auto-face drills toward open ground and inserters toward a source → sink. */
export function suggestPlaceDir(
  state: GameState,
  tool: ToolId | null,
  x: number,
  y: number,
): Dir {
  if (!tool) return state.placeDir

  if (tool === 'belt' || tool === 'fastBelt' || tool === 'undergroundBelt') {
    for (const dir of DIRS) {
      const { dx, dy } = DIR_DELTA[dir]
      const nx = x - dx
      const ny = y - dy
      if (!inBounds(nx, ny, state.width, state.height)) continue
      const nEnt = entityAt(state, nx, ny)
      if (nEnt && isBeltKind(nEnt.kind) && nEnt.dir === dir) return dir
    }
    const drill = entityAt(state, x - DIR_DELTA[state.placeDir].dx, y - DIR_DELTA[state.placeDir].dy)
    if (drill && isDrillKind(drill.kind)) return drill.dir
    return state.placeDir
  }

  if (tool === 'drill' || tool === 'electricDrill') {
    const chosenFront = entityAt(
      state,
      x + DIR_DELTA[state.placeDir].dx,
      y + DIR_DELTA[state.placeDir].dy,
    )
    if (
      !chosenFront ||
      isBeltKind(chosenFront.kind) ||
      chosenFront.kind === 'chest' ||
      chosenFront.kind === 'undergroundBelt' ||
      chosenFront.kind === 'splitter'
    ) {
      return state.placeDir
    }
    let best = state.placeDir
    let bestScore = -1
    for (const dir of DIRS) {
      const run = emptyRun(state, x, y, dir)
      const score = run * 2 + (dir === 'E' ? 0.2 : dir === 'S' ? 0.1 : 0)
      if (score > bestScore) {
        bestScore = score
        best = dir
      }
    }
    return best
  }

  if (tool === 'inserter' || tool === 'longInserter') {
    const reach = tool === 'longInserter' ? 2 : 1
    const chosen = inserterDirScore(state, x, y, state.placeDir, reach)
    if (chosen > 0) return state.placeDir
    let best = state.placeDir
    let bestScore = 0
    for (const dir of DIRS) {
      const score = inserterDirScore(state, x, y, dir, reach)
      if (score > bestScore) {
        bestScore = score
        best = dir
      }
    }
    return bestScore > 0 ? best : state.placeDir
  }

  return state.placeDir
}

export function placeFailReason(
  state: GameState,
  tool: ToolId | null,
  x: number,
  y: number,
): string | null {
  if (
    !tool ||
    tool === 'remove' ||
    tool === 'rotate' ||
    tool === 'copy' ||
    tool === 'paste'
  ) {
    return null
  }
  if (!inBounds(x, y, state.width, state.height)) return 'off map'
  const tile = state.tiles[idx(x, y)]
  if (tile.entityId) return 'blocked'
  if ((tool === 'drill' || tool === 'electricDrill') && !tile.ore) return 'needs ore'
  if (tool === 'chest') {
    if (countPlacedChests(state.entities) >= maxChestsFor(state.researched, state.completedGoals)) {
      return 'chest cap'
    }
  }
  const meta = PLACEABLE_META[tool]
  if (Math.floor((state.inventory[meta.inventoryKey] ?? 0) + 1e-9) < 1) {
    return 'craft more'
  }
  return null
}

export function getActiveTutorialStep(state: GameState): TutorialStepDef | null {
  if (state.tutorialComplete) return null
  return getTutorialStep(state.tutorialStep)
}
