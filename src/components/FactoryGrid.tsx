import type { CSSProperties } from 'react'
import { DIR_DELTA, ITEM_META, idx, storeTotal } from '../game/data'
import { useGame } from '../game/GameContext'
import {
  EntitySprite,
  GroundTexture,
  ItemSprite,
  OreTexture,
} from '../sprites/Sprites'
import type { Entity, OreId } from '../game/types'

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

  return (
    <section className="panel factory-panel">
      <div className="panel-head">
        <h2>Factory Floor</h2>
        <p>
          Place a burner drill on ore. Log steps — each step is one mining cycle.
          Belts move items; inserters pull from behind and push forward into furnaces
          and chests.
        </p>
        <p className="panel-stat">
          Mine cycles {state.mineCycles.toLocaleString()} · Facing {placeDir}{' '}
          {dirArrow(placeDir)} ·{' '}
          {selected === 'remove'
            ? 'Remove mode'
            : selected
              ? `Placing ${selected}`
              : 'Select a tool'}
        </p>
      </div>

      <div className="factory-stage">
        <div
          className="factory-grid"
          style={{
            gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => {
              const tile = tiles[idx(x, y)]
              const ent = tile.entityId ? entities[tile.entityId] : null
              const seed = x * 13 + y * 29
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
              const lit = ent?.kind === 'furnace' && Boolean(ent.smelting)
              const active =
                ent?.kind === 'drill' && (ent.store.coal ?? 0) > 0 && Boolean(tile.ore)

              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  className={`cell ${tile.ore ? `ore-${tile.ore}` : 'ore-none'} ${
                    ent ? `has-${ent.kind}` : ''
                  }`}
                  title={titleParts.join(' · ')}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      rotateAt(x, y)
                      return
                    }
                    place(x, y)
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
                        active={active}
                        moving={ent.kind === 'belt' && Boolean(ent.cargo)}
                        filled={filled}
                      />
                    </span>
                  )}

                  {ent?.kind === 'belt' && ent.cargo && (
                    <span className="cargo-item" style={cargoOffset(ent.dir, ent.cargo.progress)}>
                      <ItemSprite item={ent.cargo.item} />
                    </span>
                  )}

                  {(ent?.kind === 'drill' ||
                    ent?.kind === 'furnace' ||
                    ent?.kind === 'chest') &&
                    storeSummary(ent) && (
                      <span className="cell-store">{storeSummary(ent)}</span>
                    )}

                  {ent?.kind === 'furnace' && ent.smelting && (
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
        Click place · Shift-click / right-click rotate · Right-click chest to collect
        {selected && selected !== 'remove' && (
          <span className="ghost-dir">
            {' '}
            · Ghost {dirArrow(placeDir)} ({DIR_DELTA[placeDir].dx},{DIR_DELTA[placeDir].dy})
          </span>
        )}
      </p>
    </section>
  )
}
