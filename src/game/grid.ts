import {
  GRID_H,
  GRID_W,
  idx,
  inBounds,
} from './data'
import type { Entity, OreId, Tile } from './types'

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

  // Starter patches — Factorio vibes
  paintPatch(tiles, 3, 3, 2, 'ironOre', 400)
  paintPatch(tiles, 8, 2, 1, 'ironOre', 180)
  paintPatch(tiles, 14, 4, 2, 'copperOre', 320)
  paintPatch(tiles, 4, 9, 2, 'coal', 500)
  paintPatch(tiles, 12, 9, 1, 'coal', 200)

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
