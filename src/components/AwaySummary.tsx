import { useMemo } from 'react'
import { ITEM_META } from '../game/data'
import { useGame } from '../game/GameContext'
import type { ItemId, OfflineReport } from '../game/types'
import { ItemSprite } from '../sprites/Sprites'

const ITEM_ORDER: ItemId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'steel',
  'gear',
  'belt',
  'fastBelt',
  'undergroundBelt',
  'inserter',
  'longInserter',
  'drill',
  'electricDrill',
  'furnace',
  'steelFurnace',
  'chest',
  'assembler',
  'splitter',
]

export function formatAwayDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)

  if (days > 0) {
    if (hours > 0) return `${days}d ${hours}h`
    return days === 1 ? '1 day' : `${days} days`
  }
  if (hours > 0) {
    if (minutes > 0) return `${hours}h ${minutes}m`
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  if (minutes > 0) return minutes === 1 ? '1 minute' : `${minutes} minutes`
  return 'less than a minute'
}

function hasAnyProgress(report: OfflineReport): boolean {
  if (
    report.platesSmelted > 0 ||
    report.gearsMade > 0 ||
    report.itemsMoved > 0 ||
    report.craftsFinished > 0
  ) {
    return true
  }
  return Object.values(report.itemGains).some((n) => (n ?? 0) > 0)
}

export function AwaySummary() {
  const { state, clearOfflineReport } = useGame()
  const report = state.offlineReport

  const gains = useMemo(() => {
    if (!report) return []
    return ITEM_ORDER.filter((id) => (report.itemGains[id] ?? 0) > 0).map(
      (id) => ({ id, amount: report.itemGains[id] ?? 0 }),
    )
  }, [report])

  if (!report) return null

  const awayLabel = formatAwayDuration(report.awaySeconds)
  const simLabel = formatAwayDuration(report.simulatedSeconds)
  const busy = hasAnyProgress(report)

  return (
    <div
      className="away-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="away-title"
    >
      <button
        type="button"
        className="away-scrim"
        aria-label="Dismiss away summary"
        onClick={clearOfflineReport}
      />
      <div className="away-card">
        <p className="away-kicker">Welcome back</p>
        <h2 id="away-title">
          You&apos;ve been away from your factory for {awayLabel}
        </h2>
        <p className="away-lead">
          {report.capped ? (
            <>
              Belts, furnaces, assemblers, and the craft bench kept running for the
              maximum <strong>{simLabel}</strong>. Drills still need your steps.
              Anything beyond 24 hours waited for you.
            </>
          ) : busy ? (
            <>
              Belts, furnaces, assemblers, and hand crafts kept working. Drills only
              mine when you walk.
            </>
          ) : (
            <>
              The floor was quiet. Offline progress needs loaded furnaces/assemblers
              or a craft queue - drills wait for your steps.
            </>
          )}
        </p>

        {(report.platesSmelted > 0 ||
          report.gearsMade > 0 ||
          report.itemsMoved > 0 ||
          report.craftsFinished > 0) && (
          <ul className="away-stats">
            {report.platesSmelted > 0 && (
              <li>
                <span className="away-stat-value">
                  {report.platesSmelted.toLocaleString()}
                </span>
                <span className="away-stat-label">plates smelted</span>
              </li>
            )}
            {report.gearsMade > 0 && (
              <li>
                <span className="away-stat-value">
                  {report.gearsMade.toLocaleString()}
                </span>
                <span className="away-stat-label">gears made</span>
              </li>
            )}
            {report.itemsMoved > 0 && (
              <li>
                <span className="away-stat-value">
                  {report.itemsMoved.toLocaleString()}
                </span>
                <span className="away-stat-label">items moved</span>
              </li>
            )}
            {report.craftsFinished > 0 && (
              <li>
                <span className="away-stat-value">
                  {report.craftsFinished.toLocaleString()}
                </span>
                <span className="away-stat-label">hand crafts done</span>
              </li>
            )}
          </ul>
        )}

        {gains.length > 0 && (
          <div className="away-gains">
            <h3>Gained on the floor</h3>
            <ul className="away-gain-grid">
              {gains.map(({ id, amount }) => (
                <li key={id}>
                  <span className="away-gain-icon" aria-hidden>
                    <ItemSprite item={id} />
                  </span>
                  <span className="away-gain-meta">
                    <span className="away-gain-name">{ITEM_META[id].label}</span>
                    <span className="away-gain-amt">+{amount.toLocaleString()}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!busy && (
          <p className="away-empty">
            Load furnaces with ore + coal, queue crafts, or walk to feed drills
            before you leave next time.
          </p>
        )}

        <div className="away-actions">
          <button type="button" className="primary-btn" onClick={clearOfflineReport}>
            Back to the floor
          </button>
        </div>
      </div>
    </div>
  )
}
