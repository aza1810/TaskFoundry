import {
  DIR_DELTA,
  GRID_H,
  GRID_W,
  LEGACY_GRID_H,
  LEGACY_GRID_W,
  STARTER_PAD,
  idx,
  inBounds,
  inStarterPad,
  OPPOSITE,
} from './data'
import type { Dir, Entity, OreId, Tile } from './types'

function paintPatch(
  tiles: Tile[],
  cx: number,
  cy: number,
  radius: number,
  ore: OreId,
  amount: number,
) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!inBounds(x, y)) continue
      if (inStarterPad(x, y)) continue
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > radius + 0.2) continue
      const t = tiles[idx(x, y)]
      t.ore = ore
      t.amount = amount
    }
  }
}

/** Deterministic 0..1 RNG so ore patches stay put across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function paintStarterPatches(tiles: Tile[]) {
  // Original 24x16 map patches, kept at the same coords so the tutorial
  // and early factory still sit on the same iron / copper / coal.
  paintPatch(tiles, 4, 3, 2, 'ironOre', 500)
  paintPatch(tiles, 10, 2, 2, 'ironOre', 320)
  paintPatch(tiles, 18, 5, 2, 'copperOre', 400)
  paintPatch(tiles, 20, 12, 1, 'copperOre', 180)
  paintPatch(tiles, 5, 12, 2, 'coal', 600)
  paintPatch(tiles, 14, 13, 2, 'coal', 350)
  paintPatch(tiles, 12, 8, 1, 'ironOre', 200)
}

function paintWildernessPatches(tiles: Tile[]) {
  const rng = mulberry32(0x54464e44)
  const ores: OreId[] = ['ironOre', 'copperOre', 'coal']
  const amounts: Record<OreId, [number, number]> = {
    ironOre: [280, 900],
    copperOre: [220, 720],
    coal: [300, 1000],
  }
  const extra = 92
  for (let i = 0; i < extra; i++) {
    const x = 6 + Math.floor(rng() * (GRID_W - 12))
    const y = 6 + Math.floor(rng() * (GRID_H - 12))
    // Leave the old 24x16 starter continent alone so migrated factories
    // keep their original patches after the blit.
    if (x < LEGACY_GRID_W + 4 && y < LEGACY_GRID_H + 4) continue
    if (
      x >= STARTER_PAD.x - 4 &&
      x < STARTER_PAD.x + STARTER_PAD.w + 4 &&
      y >= STARTER_PAD.y - 4 &&
      y < STARTER_PAD.y + STARTER_PAD.h + 4
    ) {
      continue
    }
    const ore = ores[Math.floor(rng() * ores.length)]
    const radius = 1 + Math.floor(rng() * 3)
    const [lo, hi] = amounts[ore]
    const amount = lo + Math.floor(rng() * (hi - lo + 1))
    paintPatch(tiles, x, y, radius, ore, amount)
  }
}

export function createTiles(): Tile[] {
  const tiles: Tile[] = Array.from({ length: GRID_W * GRID_H }, () => ({
    ore: null,
    amount: null,
    entityId: null,
    foundation: false,
  }))

  paintWildernessPatches(tiles)
  paintStarterPatches(tiles)

  return tiles
}

/** Copy a 24x16 save into the top-left of a fresh 240x160 map. */
export function expandLegacyTiles(old: Tile[], oldW = LEGACY_GRID_W, oldH = LEGACY_GRID_H): Tile[] {
  const tiles = createTiles()
  const copyW = Math.min(oldW, GRID_W)
  const copyH = Math.min(oldH, GRID_H)
  for (let y = 0; y < copyH; y++) {
    for (let x = 0; x < copyW; x++) {
      const src = old[y * oldW + x]
      if (!src) continue
      tiles[idx(x, y)] = {
        ore: src.ore ?? null,
        amount: src.amount ?? null,
        entityId: src.entityId ?? null,
        foundation: src.foundation === true,
      }
    }
  }
  return tiles
}

export function createEntity(
  kind: Entity['kind'],
  x: number,
  y: number,
  dir: Entity['dir'],
): Entity {
  return {
    id: `${kind}-${x}-${y}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    x,
    y,
    dir,
    store: {},
    progress: 0,
    smelting: null,
    cargo: null,
  }
}

export function getTile(tiles: Tile[], x: number, y: number): Tile | null {
  if (!inBounds(x, y)) return null
  return tiles[idx(x, y)]
}

/** Tile an inserter pulls from / drops into (matches sim reach). */
export function inserterIoAt(
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
  const ok = (c: { x: number; y: number }) =>
    c.x >= 0 && c.y >= 0 && c.x < width && c.y < height
  return {
    pickup: ok(pickup) ? pickup : null,
    drop: ok(drop) ? drop : null,
  }
}
