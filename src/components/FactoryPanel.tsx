import {
  RECIPE_MAP,
  RECIPES,
  RESOURCE_META,
  canAfford,
  formatNum,
} from '../game/data'
import { isRecipeUnlocked } from '../game/logic'
import { useGame } from '../game/GameContext'
import type { RecipeId, ResourceId } from '../game/types'

function CostLine({ inputs }: { inputs: Partial<Record<ResourceId, number>> }) {
  return (
    <span className="cost-line">
      {(Object.entries(inputs) as [ResourceId, number][]).map(([id, n]) => (
        <span key={id}>
          {formatNum(n)} {RESOURCE_META[id].short}
        </span>
      ))}
    </span>
  )
}

export function FactoryPanel() {
  const { state, craft, setFurnace, setAssembler } = useGame()
  const queue = state.craftQueue
  const queueRecipe = queue ? RECIPE_MAP[queue.recipeId] : null
  const queuePct =
    queue && queueRecipe
      ? Math.min(100, (queue.progress / queueRecipe.seconds) * 100)
      : 0

  const smeltRecipes = RECIPES.filter((r) =>
    ['smeltIron', 'smeltCopper', 'makeSteel'].includes(r.id),
  )
  const assembleRecipes = RECIPES.filter(
    (r) => !['smeltIron', 'smeltCopper', 'makeSteel'].includes(r.id),
  )

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Manual Crafting Bench</h2>
        <p>
          Hand-craft while the yard spins up. Feed furnaces and assemblers a target
          recipe for idle belts.
        </p>
      </div>

      {queue && queueRecipe && (
        <div className="craft-queue">
          <span>Crafting {queueRecipe.name}</span>
          <div className="craft-track">
            <div className="craft-fill" style={{ width: `${queuePct}%` }} />
          </div>
        </div>
      )}

      <div className="recipe-grid">
        {RECIPES.map((recipe) => {
          const unlocked = isRecipeUnlocked(state, recipe.id)
          const affordable = canAfford(state.resources, recipe.inputs)
          const busy = Boolean(queue)
          return (
            <button
              key={recipe.id}
              type="button"
              className="recipe"
              disabled={!unlocked || !affordable || busy}
              onClick={() => craft(recipe.id)}
            >
              <span className="recipe-name">{recipe.name}</span>
              {!unlocked ? (
                <span className="recipe-lock">Locked</span>
              ) : (
                <>
                  <CostLine inputs={recipe.inputs} />
                  <span className="recipe-out">
                    →{' '}
                    {(Object.entries(recipe.outputs) as [ResourceId, number][])
                      .map(([id, n]) => `${formatNum(n)} ${RESOURCE_META[id].label}`)
                      .join(', ')}
                  </span>
                  <span className="recipe-time">{recipe.seconds}s</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      <div className="auto-row">
        <label>
          Furnace target
          <select
            value={state.furnaceRecipe ?? ''}
            onChange={(e) => setFurnace(e.target.value as RecipeId)}
          >
            {smeltRecipes.map((r) => (
              <option key={r.id} value={r.id} disabled={!isRecipeUnlocked(state, r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assembler target
          <select
            value={state.assemblerRecipe ?? ''}
            onChange={(e) =>
              setAssembler((e.target.value || null) as RecipeId | null)
            }
          >
            <option value="">Idle</option>
            {assembleRecipes.map((r) => (
              <option key={r.id} value={r.id} disabled={!isRecipeUnlocked(state, r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
