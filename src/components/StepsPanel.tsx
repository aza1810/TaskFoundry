import { useState } from 'react'
import { formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import type { HealthStepsApi } from '../hooks/useHealthSteps'
import type { PedometerApi } from '../hooks/usePedometer'

export function StepsPanel({
  pedometer,
  healthSteps,
  highlightWalk = false,
}: {
  pedometer: PedometerApi
  healthSteps: HealthStepsApi
  highlightWalk?: boolean
}) {
  const { state, importHealthSteps } = useGame()
  const [syncBusy, setSyncBusy] = useState(false)
  const drills = Object.values(state.entities).filter(
    (e) => e.kind === 'drill' || e.kind === 'electricDrill',
  ).length
  const listening = pedometer.status === 'listening'
  const healthReady =
    healthSteps.isNative &&
    (healthSteps.status === 'ready' ||
      healthSteps.status === 'syncing' ||
      healthSteps.status === 'checking')

  async function syncFromHealth() {
    setSyncBusy(true)
    try {
      if (healthSteps.status === 'denied' || healthSteps.status === 'unavailable') {
        await healthSteps.connect()
      }
      const total = await healthSteps.readTodaySteps()
      if (total != null) importHealthSteps(total)
    } finally {
      setSyncBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Step Cycles</h2>
        <p>
          {healthSteps.isNative
            ? 'Sync steps from Apple Health / Health Connect, or use the live pedometer. Each step runs one mining cycle on every drill.'
            : 'Start the phone pedometer and walk with this page open. For Health / Fit sync, install the native Task Foundry app.'}
        </p>
      </div>

      {healthSteps.isNative ? (
        <div
          className={`pedo-card ${healthReady ? 'is-live' : ''} ${
            highlightWalk ? 'is-tutorial-pulse' : ''
          }`}
        >
          <div className="pedo-head">
            <h3>{healthSteps.platformLabel}</h3>
            <span className={`pedo-status status-${healthSteps.status}`}>
              {healthSteps.status === 'ready' && 'Connected'}
              {healthSteps.status === 'checking' && 'Checking…'}
              {healthSteps.status === 'syncing' && 'Syncing…'}
              {healthSteps.status === 'denied' && 'Permission needed'}
              {healthSteps.status === 'unavailable' && 'Unavailable'}
              {healthSteps.status === 'error' && 'Error'}
              {healthSteps.status === 'web' && 'Web'}
            </span>
          </div>
          <p className="pedo-copy">
            Reads today&apos;s steps from {healthSteps.platformLabel}. Only new steps since the last
            sync are imported.
          </p>
          <div className="pedo-session">
            <span className="pedo-session-num">
              {healthSteps.healthStepsToday == null
                ? '-'
                : formatNum(healthSteps.healthStepsToday)}
            </span>
            <span className="pedo-session-label">steps in health today</span>
          </div>
          <div className="pedo-actions">
            <button
              type="button"
              className={`primary-btn pedo-start ${highlightWalk ? 'is-tutorial-cta' : ''}`}
              onClick={() => void syncFromHealth()}
              disabled={syncBusy || healthSteps.status === 'unavailable'}
            >
              {syncBusy
                ? 'Syncing…'
                : healthSteps.status === 'denied'
                  ? 'Allow & sync steps'
                  : 'Sync health steps'}
            </button>
          </div>
          {healthSteps.lastError && (
            <p className="hint pedo-hint">{healthSteps.lastError}</p>
          )}
          {healthSteps.status === 'unavailable' && (
            <p className="hint pedo-hint">
              On Android, install Health Connect and grant step access. On iPhone, enable Health
              permissions for Task Foundry.
            </p>
          )}
        </div>
      ) : (
        <div className="pedo-card">
          <div className="pedo-head">
            <h3>Native health sync</h3>
            <span className="pedo-status status-web">Web only</span>
          </div>
          <p className="pedo-copy">
            This browser site cannot read Apple Health or Google Health Connect. Use the native
            Android / iOS app for that, or the live pedometer below.
          </p>
        </div>
      )}

      <div
        className={`pedo-card ${listening ? 'is-live' : ''} ${
          highlightWalk && !healthSteps.isNative ? 'is-tutorial-pulse' : ''
        }`}
      >
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
          Uses your phone&apos;s motion sensors while this page stays open. Useful as a backup when
          health sync isn&apos;t available.
        </p>
        <div className="pedo-session">
          <span className="pedo-session-num">{formatNum(pedometer.sessionSteps)}</span>
          <span className="pedo-session-label">steps this session</span>
        </div>
        <div className="pedo-actions">
          {!listening ? (
            <button
              type="button"
              className={`primary-btn pedo-start ${
                highlightWalk && !healthSteps.isNative ? 'is-tutorial-cta' : ''
              }`}
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
            Safari), or skip this tour step for now.
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
    </section>
  )
}
