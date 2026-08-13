import {
  DIR_DELTA,
  GRID_H,
  GRID_W,
  idx,
  inBounds,
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
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > radius + 0.2) continue
      const t = tiles[idx(x, y)]
      t.ore = ore
      t.amount = amount
    }
  }
}

export function createTiles(): Tile[] {
  const tiles: Tile[] = Array.from({ length: GRID_W * GRID_H }, () => ({
    ore: null,
    amount: null,
    entityId: null,
  }))

  // Bigger map patches
  paintPatch(tiles, 4, 3, 2, 'ironOre', 500)
  paintPatch(tiles, 10, 2, 2, 'ironOre', 320)
  paintPatch(tiles, 18, 5, 2, 'copperOre', 400)
  paintPatch(tiles, 20, 12, 1, 'copperOre', 180)
  paintPatch(tiles, 5, 12, 2, 'coal', 600)
  paintPatch(tiles, 14, 13, 2, 'coal', 350)
  paintPatch(tiles, 12, 8, 1, 'ironOre', 200)

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
