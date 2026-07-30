import { useState } from 'react'
import { formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import type { PedometerApi } from '../hooks/usePedometer'

const PRESETS = [1, 10, 50, 100, 500, 1000]

export function StepsPanel({ pedometer }: { pedometer: PedometerApi }) {
  const { state, logSteps } = useGame()
  const [custom, setCustom] = useState('100')
  const drills = Object.values(state.entities).filter(
    (e) => e.kind === 'drill' || e.kind === 'electricDrill',
  ).length
  const listening = pedometer.status === 'listening'

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Step Cycles</h2>
        <p>
          Every step fires <strong>one mining cycle on every drill</strong>. Turn on the
          live pedometer on your phone, then walk — ore pulls while you move.
        </p>
      </div>

      <div className={`pedo-card ${listening ? 'is-live' : ''}`}>
        <div className="pedo-head">
          <h3>Phone pedometer</h3>
          <span className={`pedo-status status-${pedometer.status}`}>
            {pedometer.status === 'listening' && 'Listening'}
            {pedometer.status === 'idle' && 'Off'}
            {pedometer.status === 'starting' && 'Starting…'}
            {pedometer.status === 'denied' && 'Permission denied'}
            {pedometer.status === 'unsupported' && 'Not supported'}
          </span>
        </div>
        <p className="pedo-copy">
          Uses your phone’s motion sensors (not Apple Health / Google Fit history). Keep
          this page open while you walk — screen stay-awake is requested automatically.
        </p>
        <div className="pedo-session">
          <span className="pedo-session-num">{formatNum(pedometer.sessionSteps)}</span>
          <span className="pedo-session-label">steps this session</span>
        </div>
        <div className="pedo-actions">
          {!listening ? (
            <button
              type="button"
              className="primary-btn pedo-start"
              onClick={() => void pedometer.start()}
              disabled={
                pedometer.status === 'starting' ||
                pedometer.status === 'unsupported' ||
                !pedometer.supported
              }
            >
              {pedometer.supported ? 'Start live pedometer' : 'Sensors unavailable'}
            </button>
          ) : (
            <button type="button" className="primary-btn pedo-stop" onClick={pedometer.stop}>
              Stop pedometer
            </button>
          )}
        </div>
        {pedometer.status === 'denied' && (
          <p className="hint pedo-hint">
            Allow motion / accelerometer access for this site in your browser settings,
            then try again. On iPhone use Safari and tap Allow when prompted.
          </p>
        )}
        {pedometer.status === 'unsupported' && (
          <p className="hint pedo-hint">
            This browser has no motion sensors. Open Task Foundry on your phone (Chrome or
            Safari), or log steps manually below.
          </p>
        )}
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
            Tip: fuel burner drills with coal (toolbar or inserter from a coal line).
          </p>
        </div>
      </div>

      <div className="manual-steps">
        <h3 className="manual-title">Manual log (desktop / backup)</h3>
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
      </div>
    </section>
  )
}
