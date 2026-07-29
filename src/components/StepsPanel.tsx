import { useState } from 'react'
import { formatNum } from '../game/data'
import { useGame } from '../game/GameContext'

const PRESETS = [1, 10, 50, 100, 500, 1000]

export function StepsPanel() {
  const { state, logSteps } = useGame()
  const [custom, setCustom] = useState('100')
  const drills = Object.values(state.entities).filter((e) => e.kind === 'drill').length

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Step Cycles</h2>
        <p>
          Every step fires <strong>one mining cycle on every burner drill</strong>. Walk
          more, pull more ore — then let belts and inserters move it.
        </p>
      </div>

      <div className="steps-hero">
        <div className="steps-count">
          <span className="steps-num">{formatNum(state.stepsToday)}</span>
          <span className="steps-label">steps today</span>
        </div>
        <div className="steps-goal">
          <p>
            Drills on floor: <strong>{drills}</strong>
          </p>
          <p>
            Lifetime steps {formatNum(state.stepsLifetime)} · Mine cycles{' '}
            {formatNum(state.mineCycles)}
          </p>
          <p className="hint">
            Tip: fuel drills with coal (toolbar or inserter from a coal line).
          </p>
        </div>
      </div>

      <div className="step-actions">
        {PRESETS.map((n) => (
          <button key={n} type="button" className="primary-btn" onClick={() => logSteps(n)}>
            +{n} {n === 1 ? 'step' : 'steps'}
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
          Log steps / mine cycles
        </button>
      </form>
    </section>
  )
}
