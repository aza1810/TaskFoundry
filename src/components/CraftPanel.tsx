import { useState } from 'react'
import {
  HAND_RECIPES,
  ITEM_META,
  MAX_CRAFT_QUEUE,
  RECIPE_MAP,
  canAfford,
  formatNum,
} from '../game/data'
import { useGame } from '../game/GameContext'
import type { Inventory, ItemId } from '../game/types'
import { ItemSprite } from '../sprites/Sprites'

function formatDuration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  return `${Math.round(seconds)}s`
}

function primaryOutput(outputs: Partial<Inventory>): [ItemId, number] {
  const [id, n] = Object.entries(outputs)[0] as [ItemId, number]
  return [id, n]
}

function craftableCount(have: Inventory, cost: Partial<Inventory>): number {
  let min = Infinity
  for (const [k, n] of Object.entries(cost) as [ItemId, number][]) {
    if (!n) continue
    min = Math.min(min, Math.floor((have[k] ?? 0) / n))
  }
  return Number.isFinite(min) ? min : 0
}

export function CraftPanel() {
  const { state, craft, cancelCraft } = useGame()
  const queue = state.craftQueue
  const active = queue[0] ?? null
  const activeRecipe = active ? RECIPE_MAP[active.recipeId] : null
  const activePct = active
    ? Math.min(100, (active.elapsed / active.duration) * 100)
    : 0
  const queueFull = queue.length >= MAX_CRAFT_QUEUE
  const [selectedId, setSelectedId] = useState<string | null>(HAND_RECIPES[0]?.id ?? null)
  const selected = selectedId ? RECIPE_MAP[selectedId] : null

  const categories = [
    { id: 'smelt' as const, title: 'Smelting' },
    { id: 'part' as const, title: 'Parts' },
    { id: 'building' as const, title: 'Buildings' },
  ]

  const selectedLocked =
    Boolean(selected?.requiresTech) &&
    !state.researched.includes(selected!.requiresTech!)
  const selectedOk =
    Boolean(selected) &&
    !selectedLocked &&
    canAfford(state.inventory, selected!.inputs) &&
    !queueFull

  return (
    <section className="panel craft-panel">
      <div className="panel-head">
        <h2>Hand Crafting Bench</h2>
        <p>
          Hand crafts take real time — slower than furnaces and assemblers. Queue up to{' '}
          {MAX_CRAFT_QUEUE} jobs; materials are reserved when you start.
        </p>
      </div>

      <div className="craft-bench">
        <div className="craft-active">
          {active && activeRecipe ? (
            <>
              <div className="craft-active-head">
                <div className="craft-active-product">
                  <span className="craft-slot craft-slot-sm" aria-hidden>
                    <ItemSprite item={primaryOutput(activeRecipe.outputs)[0]} />
                  </span>
                  <strong>{activeRecipe.name}</strong>
                </div>
                <span>
                  {formatDuration(Math.max(0, active.duration - active.elapsed))} left
                </span>
              </div>
              <div className="craft-track">
                <div className="craft-fill" style={{ width: `${activePct}%` }} />
              </div>
            </>
          ) : (
            <p className="craft-idle">Bench idle — pick a recipe below.</p>
          )}
        </div>

        {queue.length > 0 && (
          <ul className="craft-queue">
            {queue.map((job, i) => {
              const recipe = RECIPE_MAP[job.recipeId]
              const pct = Math.min(100, (job.elapsed / job.duration) * 100)
              const outId = recipe ? primaryOutput(recipe.outputs)[0] : null
              return (
                <li key={job.id} className={i === 0 ? 'is-active' : ''}>
                  <div className="craft-queue-main">
                    <span className="craft-queue-label">
                      {outId && (
                        <span className="craft-slot craft-slot-xs" aria-hidden>
                          <ItemSprite item={outId} />
                        </span>
                      )}
                      <span>
                        {i === 0 ? '▶' : `#${i + 1}`} {recipe?.name ?? job.recipeId}
                      </span>
                    </span>
                    <span className="craft-queue-time">
                      {i === 0
                        ? `${formatDuration(job.elapsed)} / ${formatDuration(job.duration)}`
                        : formatDuration(job.duration)}
                    </span>
                  </div>
                  {i === 0 && (
                    <div className="craft-track craft-track-sm">
                      <div className="craft-fill" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <button
                    type="button"
                    className="ghost-btn craft-cancel"
                    onClick={() => cancelCraft(job.id)}
                  >
                    Cancel
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selected && (
        <div className="craft-recipe-detail" aria-live="polite">
          <div className="craft-recipe-detail-main">
            <span className="craft-slot craft-slot-lg" aria-hidden>
              <ItemSprite item={primaryOutput(selected.outputs)[0]} />
              {primaryOutput(selected.outputs)[1] > 1 && (
                <span className="craft-qty">{formatNum(primaryOutput(selected.outputs)[1])}</span>
              )}
            </span>
            <div className="craft-recipe-detail-copy">
              <strong>{selected.name}</strong>
              {selectedLocked ? (
                <span className="recipe-lock">Research required</span>
              ) : (
                <>
                  <div className="craft-ingredient-row" aria-label="Ingredients">
                    {(Object.entries(selected.inputs) as [ItemId, number][]).map(
                      ([id, n]) => {
                        const have = state.inventory[id] ?? 0
                        const short = have < n
                        return (
                          <span
                            key={id}
                            className={`craft-ingredient${short ? ' is-short' : ''}`}
                            title={`${ITEM_META[id].label}: ${formatNum(have)} / ${formatNum(n)}`}
                          >
                            <span className="craft-slot craft-slot-xs" aria-hidden>
                              <ItemSprite item={id} />
                            </span>
                            <span className="craft-ingredient-count">{formatNum(n)}</span>
                          </span>
                        )
                      },
                    )}
                    <span className="craft-ingredient-arrow" aria-hidden>
                      →
                    </span>
                    {(Object.entries(selected.outputs) as [ItemId, number][]).map(
                      ([id, n]) => (
                        <span
                          key={id}
                          className="craft-ingredient craft-ingredient-out"
                          title={ITEM_META[id].label}
                        >
                          <span className="craft-slot craft-slot-xs" aria-hidden>
                            <ItemSprite item={id} />
                          </span>
                          <span className="craft-ingredient-count">{formatNum(n)}</span>
                        </span>
                      ),
                    )}
                  </div>
                  <span className="recipe-time">
                    {selected.machineSeconds && selected.machineLabel
                      ? `Hand ${formatDuration(selected.handSeconds)} · ${selected.machineLabel} ${formatDuration(selected.machineSeconds)}`
                      : `Hand ${formatDuration(selected.handSeconds)}`}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="primary-btn craft-queue-btn"
            disabled={!selectedOk}
            onClick={() => craft(selected.id)}
          >
            {queueFull ? 'Queue full' : selectedLocked ? 'Locked' : 'Craft'}
          </button>
        </div>
      )}

      {categories.map((cat) => {
        const recipes = HAND_RECIPES.filter((r) => r.category === cat.id)
        if (recipes.length === 0) return null
        return (
          <div key={cat.id} className="craft-section">
            <h3>{cat.title}</h3>
            <div className="recipe-icon-grid" role="list">
              {recipes.map((recipe) => {
                const locked =
                  Boolean(recipe.requiresTech) &&
                  !state.researched.includes(recipe.requiresTech!)
                const [outId, outN] = primaryOutput(recipe.outputs)
                const canMake = locked
                  ? 0
                  : craftableCount(state.inventory, recipe.inputs)
                const ok = !locked && canMake > 0 && !queueFull
                const isSelected = selectedId === recipe.id
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    role="listitem"
                    className={[
                      'recipe-icon',
                      isSelected ? 'is-selected' : '',
                      locked ? 'is-locked' : '',
                      !ok && !locked ? 'is-empty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={
                      locked
                        ? `${recipe.name} — research required`
                        : `${recipe.name} (${canMake} craftable) — tap for details`
                    }
                    aria-label={
                      locked
                        ? `${recipe.name}, research required`
                        : `${recipe.name}, ${canMake} craftable, tap for details`
                    }
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(recipe.id)}
                  >
                    <span className="craft-slot" aria-hidden>
                      <ItemSprite item={outId} />
                      {outN > 1 && <span className="craft-qty">{formatNum(outN)}</span>}
                      {!locked && canMake > 0 && (
                        <span className="craft-avail">{formatNum(canMake)}</span>
                      )}
                    </span>
                    {locked && <span className="recipe-icon-lock">?</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
