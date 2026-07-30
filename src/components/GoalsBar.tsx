import { useEffect, useRef, useState } from 'react'
import { formatNum } from '../game/data'
import { GOALS, TIPS, activeGoal } from '../game/goals'
import { useGame } from '../game/GameContext'

export function GoalsBar() {
  const { state } = useGame()
  const goal = activeGoal(state)
  const done = state.completedGoals.length
  const total = GOALS.length
  const tip = TIPS[state.tipIndex % TIPS.length]

  const prev = useRef(state.stats)
  const prevAt = useRef(Date.now())
  const [rates, setRates] = useState({ ore: 0, plates: 0, gears: 0 })

  useEffect(() => {
    const now = Date.now()
    const dt = Math.max(0.2, (now - prevAt.current) / 1000)
    const dOre = (state.stats.oreMined - prev.current.oreMined) / dt
    const dPlates = (state.stats.platesSmelted - prev.current.platesSmelted) / dt
    const dGears = (state.stats.gearsMade - prev.current.gearsMade) / dt
    setRates({
      ore: Math.max(0, dOre),
      plates: Math.max(0, dPlates),
      gears: Math.max(0, dGears),
    })
    prev.current = state.stats
    prevAt.current = now
  }, [state.stats])

  return (
    <div className="goals-bar">
      <div className="goals-main">
        <div className="goals-progress">
          Objectives {done}/{total}
          {state.researched.length > 0 && (
            <span> · Tech {state.researched.length}</span>
          )}
        </div>
        {goal ? (
          <>
            <h3 className="goals-title">{goal.title}</h3>
            <p className="goals-detail">{goal.detail}</p>
            <p className="goals-reward">Reward: {goal.rewardLabel}</p>
          </>
        ) : (
          <p className="goals-detail">All objectives clear — research upgrades and expand.</p>
        )}
      </div>
      <div className="goals-stats">
        <span>Ore {formatNum(state.stats.oreMined)}</span>
        <span>Plates {formatNum(state.stats.platesSmelted)}</span>
        <span>Gears {formatNum(state.stats.gearsMade)}</span>
        <span>Moved {formatNum(state.stats.itemsMoved)}</span>
        <span className="rate">
          {rates.ore > 0.05 ? `Fe ${rates.ore.toFixed(1)}/s` : 'idle'}
        </span>
        {rates.plates > 0.02 && (
          <span className="rate">Plates {rates.plates.toFixed(1)}/s</span>
        )}
        {rates.gears > 0.02 && (
          <span className="rate">Gears {rates.gears.toFixed(1)}/s</span>
        )}
      </div>
      <p className="goals-tip">{tip}</p>
    </div>
  )
}
