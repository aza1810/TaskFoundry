import { useState } from 'react'
import {
  STEPS_PER_COAL,
  STEPS_PER_COPPER,
  STEPS_PER_IRON,
  formatNum,
} from '../game/data'
import { useGame } from '../game/GameContext'

const PRESETS = [500, 1000, 2500, 5000, 10000]

export function StepsPanel() {
  const { state, logSteps } = useGame()
  const [custom, setCustom] = useState('2000')
  const goal = 8000
  const pct = Math.min(100, (state.stepsToday / goal) * 100)
  const toNextIron = STEPS_PER_IRON - (state.stepsToday % STEPS_PER_IRON)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Step Mining</h2>
        <p>
          Feet are your first drills. Log steps to pull iron, copper, and coal from the
          day.
        </p>
      </div>

      <div className="steps-hero">
        <div className="steps-count">
          <span className="steps-num">{formatNum(state.stepsToday)}</span>
          <span className="steps-label">steps today</span>
        </div>
        <div className="steps-goal">
          <div className="steps-track">
            <div className="steps-fill" style={{ width: `${pct}%` }} />
          </div>
          <p>
            Daily goal {goal.toLocaleString()} · Lifetime{' '}
            {formatNum(state.stepsLifetime)}
          </p>
        </div>
      </div>

      <div className="conversion">
        <p>
          <strong>{STEPS_PER_IRON}</strong> steps → 1 iron ore
        </p>
        <p>
          <strong>{STEPS_PER_COPPER}</strong> steps → 1 copper ore
        </p>
        <p>
          <strong>{STEPS_PER_COAL}</strong> steps → 1 coal
        </p>
        <p className="hint">{toNextIron} steps to next iron chunk</p>
      </div>

      <div className="step-actions">
        {PRESETS.map((n) => (
          <button key={n} type="button" className="primary-btn" onClick={() => logSteps(n)}>
            +{n.toLocaleString()}
          </button>
        ))}
      </div>

      <form
        className="custom-steps"
        onSubmit={(e) => {
          e.preventDefault()
          logSteps(Number(custom) || 0)
        }}
      >
        <input
          type="number"
          min={1}
          max={100000}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Custom step count"
        />
        <button type="submit" className="primary-btn">
          Log steps
        </button>
      </form>
    </section>
  )
}
