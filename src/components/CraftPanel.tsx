import {
  HAND_RECIPES,
  ITEM_META,
  MAX_CRAFT_QUEUE,
  RECIPE_MAP,
  canAfford,
  formatNum,
} from '../game/data'
import { useGame } from '../game/GameContext'
import type { ItemId } from '../game/types'

function formatDuration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  return `${Math.round(seconds)}s`
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

  const categories = [
    { id: 'smelt' as const, title: 'Smelting' },
    { id: 'part' as const, title: 'Parts' },
    { id: 'building' as const, title: 'Buildings' },
  ]

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
                <strong>Working: {activeRecipe.name}</strong>
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
              return (
                <li key={job.id} className={i === 0 ? 'is-active' : ''}>
                  <div className="craft-queue-main">
                    <span>
                      {i === 0 ? '▶' : `#${i + 1}`} {recipe?.name ?? job.recipeId}
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

      {categories.map((cat) => (
        <div key={cat.id} className="craft-section">
          <h3>{cat.title}</h3>
          <div className="recipe-grid">
            {HAND_RECIPES.filter((r) => r.category === cat.id).map((recipe) => {
              const ok = canAfford(state.inventory, recipe.inputs) && !queueFull
              const speedNote =
                recipe.machineSeconds && recipe.machineLabel
                  ? `Hand ${formatDuration(recipe.handSeconds)} · ${recipe.machineLabel} ${formatDuration(recipe.machineSeconds)}`
                  : `Hand ${formatDuration(recipe.handSeconds)}`
              return (
                <button
                  key={recipe.id}
                  type="button"
                  className="recipe"
                  disabled={!ok}
                  onClick={() => craft(recipe.id)}
                >
                  <span className="recipe-name">{recipe.name}</span>
                  <span className="cost-line">
                    {(Object.entries(recipe.inputs) as [ItemId, number][]).map(
                      ([id, n]) => (
                        <span key={id}>
                          {formatNum(n)} {ITEM_META[id].short}
                        </span>
                      ),
                    )}
                  </span>
                  <span className="recipe-out">
                    →{' '}
                    {(Object.entries(recipe.outputs) as [ItemId, number][])
                      .map(([id, n]) => `${formatNum(n)} ${ITEM_META[id].label}`)
                      .join(', ')}
                  </span>
                  <span className="recipe-time">{speedNote}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
