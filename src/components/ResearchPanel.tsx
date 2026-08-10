import { useEffect, useMemo, useState } from 'react'
import { ITEM_META } from '../game/data'
import {
  TECHS,
  TECH_MAP,
  TECH_TREE_COLS,
  TECH_TREE_ROWS,
  prereqsMet,
} from '../game/research'
import { canAffordStock, stockOf } from '../game/chestInventory'
import { useGame } from '../game/GameContext'
import type { ItemId, TechId } from '../game/types'
import { ItemSprite } from '../sprites/Sprites'

const CELL_W = 112
const CELL_H = 108
const NODE_W = 88
const NODE_H = 78
const PAD_X = 20
const PAD_Y = 16

function nodeCenter(col: number, row: number) {
  return {
    x: PAD_X + col * CELL_W + CELL_W / 2,
    y: PAD_Y + row * CELL_H + CELL_H / 2,
  }
}

function edgePath(
  from: { col: number; row: number },
  to: { col: number; row: number },
) {
  const a = nodeCenter(from.col, from.row)
  const b = nodeCenter(to.col, to.row)
  const midX = (a.x + b.x) / 2
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`
}

export function ResearchPanel() {
  const { state, research } = useGame()
  const [selectedId, setSelectedId] = useState<TechId>('automation')
  const selected = TECH_MAP[selectedId]

  const treeW = PAD_X * 2 + TECH_TREE_COLS * CELL_W
  const treeH = PAD_Y * 2 + TECH_TREE_ROWS * CELL_H

  const edges = useMemo(
    () =>
      TECHS.flatMap((tech) =>
        tech.prerequisites.map((preId) => {
          const pre = TECH_MAP[preId]
          return {
            key: `${preId}->${tech.id}`,
            from: pre,
            to: tech,
            lit:
              state.researched.includes(preId) ||
              state.researched.includes(tech.id),
          }
        }),
      ),
    [state.researched],
  )

  const done = state.researched.includes(selected.id)
  const unlocked = prereqsMet(selected, state.researched)
  const affordable = canAffordStock(state, selected.cost)
  const canResearch = !done && unlocked && affordable
  const researchedCount = state.researched.length

  useEffect(() => {
    if (!state.researched.includes(selectedId)) return
    const nextReady =
      TECHS.find(
        (t) =>
          !state.researched.includes(t.id) &&
          prereqsMet(t, state.researched) &&
          canAffordStock(state, t.cost),
      ) ??
      TECHS.find(
        (t) =>
          !state.researched.includes(t.id) && prereqsMet(t, state.researched),
      )
    if (nextReady) setSelectedId(nextReady.id)
  }, [state.researched, state.entities, state.inventory, selectedId])

  return (
    <section className="panel research-panel">
      <div className="panel-head">
        <h2>Research tree</h2>
        <p>
          Unlock branches left to right. Tap a node for details - only Research
          spends materials.
        </p>
        <p className="panel-stat">
          {researchedCount}/{TECHS.length} researched
        </p>
      </div>

      <div className="research-tree-scroll">
        <div
          className="research-tree"
          style={{ width: treeW, height: treeH }}
          role="tree"
          aria-label="Research tree"
        >
          <svg
            className="research-tree-edges"
            width={treeW}
            height={treeH}
            aria-hidden
          >
            {edges.map((edge) => (
              <path
                key={edge.key}
                d={edgePath(edge.from, edge.to)}
                className={`research-edge${edge.lit ? ' is-lit' : ''}`}
              />
            ))}
          </svg>

          {TECHS.map((tech) => {
            const isDone = state.researched.includes(tech.id)
            const isOpen = prereqsMet(tech, state.researched)
            const isSelected = selectedId === tech.id
            const isReady =
              !isDone && isOpen && canAffordStock(state, tech.cost)
            const left = PAD_X + tech.col * CELL_W + (CELL_W - NODE_W) / 2
            const top = PAD_Y + tech.row * CELL_H + (CELL_H - NODE_H) / 2
            return (
              <button
                key={tech.id}
                type="button"
                role="treeitem"
                aria-selected={isSelected}
                className={[
                  'research-node',
                  isSelected ? 'is-selected' : '',
                  isDone ? 'is-done' : '',
                  !isDone && isOpen ? 'is-available' : '',
                  !isDone && !isOpen ? 'is-locked' : '',
                  isReady ? 'is-ready' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ left, top, width: NODE_W, height: NODE_H }}
                title={tech.name}
                onClick={() => setSelectedId(tech.id)}
              >
                <span className="research-node-icon" aria-hidden>
                  <ItemSprite item={tech.icon} />
                </span>
                <span className="research-node-name">{tech.name}</span>
                {isDone && (
                  <span className="research-node-badge" aria-hidden>
                    ✓
                  </span>
                )}
                {!isDone && !isOpen && (
                  <span className="research-node-badge is-lock" aria-hidden>
                    ?
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="research-detail" aria-live="polite">
        <div className="research-detail-main">
          <span className="research-detail-icon" aria-hidden>
            <ItemSprite item={selected.icon} />
          </span>
          <div className="research-detail-copy">
            <strong>{selected.name}</strong>
            <p>{selected.detail}</p>
            {!unlocked && !done ? (
              <p className="research-detail-meta is-lock">
                Requires{' '}
                {selected.prerequisites
                  .map((id) => TECH_MAP[id]?.name ?? id)
                  .join(', ')}
              </p>
            ) : (
              <>
                <div className="research-cost-row" aria-label="Research cost">
                  {(Object.entries(selected.cost) as [ItemId, number][]).map(
                    ([id, n]) => {
                      const have = stockOf(state, id)
                      const short = !done && have < n
                      return (
                        <span
                          key={id}
                          className={`research-cost-chip${short ? ' is-short' : ''}`}
                          title={`${ITEM_META[id].label}: ${Math.floor(have)} / ${n}`}
                        >
                          <span className="craft-slot craft-slot-xs" aria-hidden>
                            <ItemSprite item={id} />
                          </span>
                          <span className="research-cost-count">
                            {Math.floor(have)}/{n}
                          </span>
                        </span>
                      )
                    },
                  )}
                </div>
                <p className="research-detail-meta">Unlocks: {selected.unlocks}</p>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="primary-btn research-buy-btn"
          disabled={!canResearch}
          onClick={() => research(selected.id)}
        >
          {done
            ? 'Researched'
            : !unlocked
              ? 'Locked'
              : affordable
                ? 'Research'
                : 'Need mats'}
        </button>
      </div>
    </section>
  )
}
