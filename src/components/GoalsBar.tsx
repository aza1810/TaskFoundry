import { formatNum } from '../game/data'
import { GOALS, TIPS, activeGoal } from '../game/goals'
import {
  contractComplete,
  contractProgress,
} from '../game/contracts'
import { useGame } from '../game/GameContext'
import { useProductionRates } from '../hooks/useProductionRates'

export function GoalsBar() {
  const { state, claimContract } = useGame()
  const goal = activeGoal(state)
  const done = state.completedGoals.length
  const total = GOALS.length
  const tip = TIPS[state.tipIndex % TIPS.length]
  const rates = useProductionRates(state.stats)
  const contracts = state.contracts ?? []

  return (
    <div className="goals-bar">
      <div className="goals-main">
        <div className="goals-progress">
          Objectives {done}/{total}
          {state.researched.length > 0 && (
            <span> · Tech {state.researched.length}</span>
          )}
          {state.focusSkills?.length > 0 && (
            <span> · Focus {state.focusSkills.length}/2</span>
          )}
        </div>
        {goal ? (
          <>
            <h3 className="goals-title">{goal.title}</h3>
            <p className="goals-detail">{goal.detail}</p>
            {goal.progress && (
              <div className="goals-track" aria-hidden>
                <div
                  className="goals-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      (goal.progress(state).cur / goal.progress(state).max) * 100,
                    )}%`,
                  }}
                />
              </div>
            )}
            {goal.progress && (
              <p className="goals-prog">
                {goal.progress(state).cur.toLocaleString()}/
                {goal.progress(state).max.toLocaleString()}
              </p>
            )}
            <p className="goals-reward">Reward: {goal.rewardLabel}</p>
          </>
        ) : (
          <p className="goals-detail">All objectives clear - research upgrades and expand.</p>
        )}
      </div>

      <div className="goals-stats">
        <span>Ore {formatNum(state.stats.oreMined)}</span>
        <span>Plates {formatNum(state.stats.platesSmelted)}</span>
        <span>Gears {formatNum(state.stats.gearsMade)}</span>
        <span>Moved {formatNum(state.stats.itemsMoved)}</span>
        <span className="rate">
          {rates.ore > 0.05 ? `Ore ${rates.ore.toFixed(1)}/s` : 'idle'}
        </span>
        {rates.plates > 0.02 && (
          <span className="rate">Plates {rates.plates.toFixed(1)}/s</span>
        )}
        {rates.gears > 0.02 && (
          <span className="rate">Gears {rates.gears.toFixed(1)}/s</span>
        )}
        {rates.moved > 0.05 && (
          <span className="rate">Flow {rates.moved.toFixed(1)}/s</span>
        )}
      </div>

      {contracts.length > 0 && (
        <div className="contracts">
          <h4 className="contracts-title">Daily contracts</h4>
          <ul className="contract-list">
            {contracts.map((c) => {
              const prog = Math.min(c.amount, contractProgress(state, c))
              const ready = contractComplete(state, c)
              const pct = Math.min(100, (prog / c.amount) * 100)
              return (
                <li key={c.id} className={`contract ${c.claimed ? 'is-claimed' : ''}`}>
                  <div className="contract-main">
                    <strong>{c.title}</strong>
                    <span>
                      {Math.floor(prog)}/{c.amount}
                    </span>
                  </div>
                  <div className="contract-track" aria-hidden>
                    <div className="contract-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="contract-detail">{c.detail}</p>
                  <button
                    type="button"
                    className="primary-btn contract-btn"
                    disabled={c.claimed || !ready}
                    onClick={() => claimContract(c.id)}
                  >
                    {c.claimed ? 'Claimed' : ready ? `Claim · ${c.rewardLabel}` : 'In progress'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="goals-tip">{tip}</p>
    </div>
  )
}
