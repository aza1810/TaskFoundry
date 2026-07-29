import { DIR_DELTA, ITEM_META, idx } from '../game/data'
import { useGame } from '../game/GameContext'
import type { Entity, OreId } from '../game/types'

const ORE_CLASS: Record<OreId, string> = {
  ironOre: 'ore-iron',
  copperOre: 'ore-copper',
  coal: 'ore-coal',
}

function dirArrow(dir: Entity['dir']): string {
  return { N: '↑', E: '→', S: '↓', W: '←' }[dir]
}

function entityLabel(e: Entity): string {
  if (e.kind === 'belt') return e.cargo ? ITEM_META[e.cargo.item].short : '═'
  if (e.kind === 'drill') return '⛏'
  if (e.kind === 'inserter') return '↕'
  if (e.kind === 'furnace') return '▲'
  return '▣'
}

function storeSummary(e: Entity): string {
  const parts: string[] = []
  for (const [id, n] of Object.entries(e.store)) {
    if (n && n > 0) parts.push(`${ITEM_META[id as keyof typeof ITEM_META].short}:${Math.floor(n)}`)
  }
  if (e.cargo) parts.push(ITEM_META[e.cargo.item].short)
  if (e.kind === 'furnace' && e.smelting) parts.push('🔥')
  return parts.join(' ')
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
          Mine cycles {state.mineCycles.toLocaleString()} · Facing {placeDir} ·{' '}
          {selected === 'remove'
            ? 'Remove mode'
            : selected
              ? `Placing ${selected}`
              : 'Select a tool'}
        </p>
      </div>

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
            const oreClass = tile.ore ? ORE_CLASS[tile.ore] : ''
            const titleParts = [
              `(${x},${y})`,
              tile.ore
                ? `${ITEM_META[tile.ore].label}${tile.amount !== null ? ` ×${tile.amount}` : ''}`
                : 'empty ground',
            ]
            if (ent) {
              titleParts.push(`${ent.kind} ${dirArrow(ent.dir)}`)
              const sum = storeSummary(ent)
              if (sum) titleParts.push(sum)
            }

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                className={`cell ${oreClass} ${ent ? `has-${ent.kind}` : ''} ${
                  ent?.kind === 'belt' && ent.cargo ? 'has-cargo' : ''
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
                {ent && (
                  <>
                    <span className={`ent ent-${ent.kind}`} data-dir={ent.dir}>
                      {entityLabel(ent)}
                    </span>
                    <span className="ent-dir">{dirArrow(ent.dir)}</span>
                    {ent.kind === 'belt' && ent.cargo && (
                      <span
                        className="cargo-dot"
                        style={{
                          background: ITEM_META[ent.cargo.item].color,
                          ['--p' as string]: String(ent.cargo.progress),
                        }}
                      />
                    )}
                    {(ent.kind === 'drill' ||
                      ent.kind === 'furnace' ||
                      ent.kind === 'chest') &&
                      storeSummary(ent) && (
                        <span className="cell-store">{storeSummary(ent)}</span>
                      )}
                    {ent.kind === 'furnace' && ent.smelting && (
                      <span
                        className="smelt-bar"
                        style={{ width: `${Math.min(100, ent.progress * 100)}%` }}
                      />
                    )}
                  </>
                )}
                {!ent && tile.ore && <span className="ore-speckle" />}
              </button>
            )
          }),
        )}
      </div>

      <p className="grid-help">
        Click place · Shift-click / right-click rotate · Right-click chest to collect ·
        Ghost arrow shows place direction
        {selected && selected !== 'remove' && (
          <span className="ghost-dir">
            {' '}
            → {placeDir} ({DIR_DELTA[placeDir].dx},{DIR_DELTA[placeDir].dy})
          </span>
        )}
      </p>
    </section>
  )
}
