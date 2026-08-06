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
    <section className="panel steps-hub">
      <div className="panel-head">
        <h2>Steps</h2>
        <p>
          Health syncs automatically when you open the app. Every step runs one mining
          cycle on every drill. Today&apos;s total stays in the top bar on the Factory.
        </p>
      </div>

      <div className="steps-today-card" aria-live="polite">
        <div className="steps-today-main">
          <span className="steps-today-num">{formatNum(state.stepsToday)}</span>
          <span className="steps-today-label">steps today</span>
        </div>
        <div className="steps-today-meta">
          <p>
            <strong>{drills}</strong> drill{drills === 1 ? '' : 's'} on the floor
          </p>
          <p>
            Lifetime {formatNum(state.stepsLifetime)} · Mine cycles {formatNum(state.mineCycles)}
          </p>
          {listening && (
            <p className="steps-today-live">
              Pedometer live · +{formatNum(pedometer.sessionSteps)} this session
            </p>
          )}
        </div>
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
            Pulls today&apos;s steps from {healthSteps.platformLabel} on launch and
            resume. Only new steps since the last sync are added. Use the button if
            you need a manual refresh.
          </p>
          <div className="pedo-session">
            <span className="pedo-session-num">
              {healthSteps.healthStepsToday == null
                ? '-'
                : formatNum(healthSteps.healthStepsToday)}
            </span>
            <span className="pedo-session-label">in health today</span>
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
            <h3>Health sync</h3>
            <span className="pedo-status status-web">App only</span>
          </div>
          <p className="pedo-copy">
            Apple Health and Google Health Connect need the native Task Foundry app. On the web,
            use the phone pedometer below.
          </p>
        </div>
      )}

      <div
        className={`pedo-card ${listening ? 'is-live' : ''} ${
          highlightWalk && !healthSteps.isNative ? 'is-tutorial-pulse' : ''
        }`}
      >
        <div className="pedo-head">
          <h3>Live pedometer</h3>
          <span className={`pedo-status status-${pedometer.status}`}>
            {pedometer.status === 'listening' && 'Listening'}
            {pedometer.status === 'idle' && 'Off'}
            {pedometer.status === 'starting' && 'Starting…'}
            {pedometer.status === 'denied' && 'Permission denied'}
            {pedometer.status === 'unsupported' && 'Not supported'}
          </span>
        </div>
        <p className="pedo-copy">
          Uses motion sensors while Task Foundry stays open. Start it here, then walk - keep this
          tab or the app in the foreground for best results.
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
              {pedometer.supported ? 'Start pedometer' : 'Sensors unavailable'}
            </button>
          ) : (
            <button type="button" className="primary-btn pedo-stop" onClick={pedometer.stop}>
              Stop pedometer
            </button>
          )}
        </div>
        {pedometer.status === 'denied' && (
          <p className="hint pedo-hint">
            Allow motion / accelerometer access in your browser or phone settings, then try again.
          </p>
        )}
        {pedometer.status === 'unsupported' && (
          <p className="hint pedo-hint">
            This browser has no motion sensors. Open Task Foundry on your phone, or use the native
            app with Health Connect.
          </p>
        )}
      </div>

      <p className="hint steps-hub-tip">
        Tip: fuel burner drills with coal so walking actually mines ore.
      </p>
    </section>
  )
}
