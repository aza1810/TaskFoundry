import { DIRS, DIR_DELTA, OPPOSITE, idx, inBounds, isBeltKind, rotateDir } from './data'
import type { Dir, Entity, Tile } from './types'

export type BeltTurn = 'cw' | 'ccw'

export type BeltBend = {
  /** Travel direction of the item as it enters this belt. */
  from: Dir
  turn: BeltTurn
}

/**
 * Infer corner shape from neighbors that feed into this belt.
 * Straight (or no feeder) returns null - keep the normal belt graphic.
 */
export function getBeltBend(
  tiles: Tile[],
  entities: Record<string, Entity>,
  ent: Entity,
  width: number,
  height: number,
): BeltBend | null {
  if (!isBeltKind(ent.kind)) return null

  const out = ent.dir
  const behind = OPPOSITE[out]
  let fromBehind: Dir | null = null
  let fromSide: Dir | null = null

  for (const d of DIRS) {
    const { dx, dy } = DIR_DELTA[d]
    const nx = ent.x - dx
    const ny = ent.y - dy
    if (!inBounds(nx, ny, width, height)) continue
    const id = tiles[idx(nx, ny, width)]?.entityId
    if (!id) continue
    const n = entities[id]
    if (!n || !isBeltKind(n.kind) || n.dir !== d) continue
    if (d === behind) fromBehind = d
    else if (d !== out && !fromSide) fromSide = d
  }

  // Behind feeder wins: treat as straight even if a side also merges in.
  if (fromBehind || !fromSide) return null

  const turn: BeltTurn = rotateDir(fromSide) === out ? 'cw' : 'ccw'
  return { from: fromSide, turn }
}
