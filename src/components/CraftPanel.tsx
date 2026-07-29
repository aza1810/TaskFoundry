import { HAND_RECIPES, ITEM_META, canAfford, formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import type { ItemId } from '../game/types'

export function CraftPanel() {
  const { state, craft } = useGame()

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Hand Crafting</h2>
        <p>
          Smelt plates and assemble belts, inserters, drills, furnaces, and chests for the
          grid.
        </p>
      </div>

      <div className="recipe-grid">
        {HAND_RECIPES.map((recipe) => {
          const ok = canAfford(state.inventory, recipe.inputs)
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
            </button>
          )
        })}
      </div>
    </section>
  )
}
