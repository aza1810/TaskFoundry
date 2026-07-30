import { GOALS, TIPS, activeGoal } from '../game/goals'
import { useGame } from '../game/GameContext'
import { formatNum } from '../game/data'

export function GoalsBar() {
  const { state } = useGame()
  const goal = activeGoal(state)
  const done = state.completedGoals.length
  const total = GOALS.length
  const tip = TIPS[state.tipIndex % TIPS.length]

  return (
    <div className="goals-bar">
      <div className="goals-main">
        <div className="goals-progress">
          Objectives {done}/{total}
        </div>
        {goal ? (
          <>
            <h3 className="goals-title">{goal.title}</h3>
            <p className="goals-detail">{goal.detail}</p>
            <p className="goals-reward">Reward: {goal.rewardLabel}</p>
          </>
        ) : (
          <p className="goals-detail">All objectives clear — keep expanding the plant.</p>
        )}
      </div>
      <div className="goals-stats">
        <span>Ore {formatNum(state.stats.oreMined)}</span>
        <span>Plates {formatNum(state.stats.platesSmelted)}</span>
        <span>Gears {formatNum(state.stats.gearsMade)}</span>
        <span>Moved {formatNum(state.stats.itemsMoved)}</span>
      </div>
      <p className="goals-tip">{tip}</p>
    </div>
  )
}
