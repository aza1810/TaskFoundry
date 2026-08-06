import { useMemo, useState } from 'react'
import { ITEM_META, formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import type { ItemId, OfflineReport } from '../game/types'
import { ItemSprite } from '../sprites/Sprites'

/** Prefer materials first when amounts tie; unknown ids fall through. */
const ITEM_PRIORITY: Partial<Record<ItemId, number>> = {
  ironOre: 0,
  copperOre: 1,
  coal: 2,
  ironPlate: 3,
  copperPlate: 4,
  steel: 5,
  gear: 6,
  belt: 7,
  fastBelt: 8,
  undergroundBelt: 9,
  inserter: 10,
  longInserter: 11,
  drill: 12,
  electricDrill: 13,
  furnace: 14,
  steelFurnace: 15,
  chest: 16,
  assembler: 17,
  splitter: 18,
}

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
    report.craftsFinished > 0 ||
    (report.stepsSynced ?? 0) > 0
  ) {
    return true
  }
  return Object.values(report.itemGains).some((n) => (n ?? 0) > 0)
}

function activityStats(report: OfflineReport) {
  const stats: { key: string; value: number; label: string }[] = []
  if ((report.stepsSynced ?? 0) > 0) {
    stats.push({
      key: 'steps',
      value: report.stepsSynced,
      label: 'steps synced',
    })
  }
  if (report.platesSmelted > 0) {
    stats.push({
      key: 'plates',
      value: report.platesSmelted,
      label: 'plates smelted',
    })
  }
  if (report.gearsMade > 0) {
    stats.push({ key: 'gears', value: report.gearsMade, label: 'gears made' })
  }
  if (report.itemsMoved > 0) {
    stats.push({
      key: 'moved',
      value: report.itemsMoved,
      label: 'items moved',
    })
  }
  if (report.craftsFinished > 0) {
    stats.push({
      key: 'crafts',
      value: report.craftsFinished,
      label: 'hand crafts',
    })
  }
  return stats
}

/** Dev-only sample so `?awayDemo=1` can preview the recap UI. */
function demoOfflineReport(): OfflineReport {
  return {
    awaySeconds: 60 * 60 * 5 + 60 * 22,
    simulatedSeconds: 60 * 60 * 5 + 60 * 22,
    capped: false,
    platesSmelted: 1840,
    gearsMade: 120,
    itemsMoved: 9320,
    craftsFinished: 4,
    stepsSynced: 2840,
    itemGains: {
      ironPlate: 920,
      copperPlate: 640,
      steel: 180,
      gear: 120,
      ironOre: 44,
      coal: 18,
      belt: 2,
    },
  }
}

export function AwaySummary({
  holdForHealthSync = false,
}: {
  /** Native boot: wait for Health auto-sync so drill ore appears on the recap. */
  holdForHealthSync?: boolean
}) {
  const { state, clearOfflineReport } = useGame()
  const [demoDismissed, setDemoDismissed] = useState(false)
  const demo =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    !demoDismissed &&
    new URLSearchParams(window.location.search).has('awayDemo')
  const report = state.offlineReport ?? (demo ? demoOfflineReport() : null)

  const gains = useMemo(() => {
    if (!report) return []
    return (Object.keys(report.itemGains) as ItemId[])
      .filter((id) => (report.itemGains[id] ?? 0) > 0 && id in ITEM_META)
      .map((id) => ({ id, amount: report.itemGains[id] ?? 0 }))
      .sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount
        return (ITEM_PRIORITY[a.id] ?? 99) - (ITEM_PRIORITY[b.id] ?? 99)
      })
  }, [report])

  const stats = useMemo(
    () => (report ? activityStats(report) : []),
    [report],
  )

  if (!report) return null
  if (holdForHealthSync && state.offlineReport) return null

  const awayLabel = formatAwayDuration(report.awaySeconds)
  const simLabel = formatAwayDuration(report.simulatedSeconds)
  const busy = hasAnyProgress(report)
  const totalGained = gains.reduce((sum, g) => sum + g.amount, 0)
  const stepsSynced = report.stepsSynced ?? 0

  const dismiss = () => {
    if (demo && !state.offlineReport) setDemoDismissed(true)
    clearOfflineReport()
  }

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
        onClick={dismiss}
      />
      <div className="away-card">
        <header className="away-header">
          <p className="away-kicker">Welcome back</p>
          <h2 id="away-title">You&apos;ve been away</h2>
          <p className="away-duration" aria-label={`Away for ${awayLabel}`}>
            <span className="away-duration-value">{awayLabel}</span>
            {report.capped && (
              <span className="away-cap-pill" title={`Simulated ${simLabel}`}>
                max {simLabel} credited
              </span>
            )}
          </p>
          <p className="away-lead">
            {busy ? (
              <>
                Your factory kept running
                {report.capped ? ' up to the offline cap' : ''}
                {stepsSynced > 0
                  ? ', and Health steps ran your drills'
                  : ''}. Here&apos;s what piled up while you were gone.
              </>
            ) : (
              <>
                The floor was quiet. Offline progress needs loaded
                furnaces/assemblers, a craft queue, or Health steps for drills.
              </>
            )}
          </p>
        </header>

        {gains.length > 0 && (
          <section className="away-gains" aria-label="Items obtained while away">
            <div className="away-gains-head">
              <h3>Obtained while away</h3>
              <p className="away-gains-total">
                +{formatNum(totalGained)} item{totalGained === 1 ? '' : 's'}
              </p>
            </div>
            <ul className="away-gain-grid">
              {gains.map(({ id, amount }, index) => (
                <li
                  key={id}
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                >
                  <span className="away-gain-icon" aria-hidden>
                    <ItemSprite item={id} />
                  </span>
                  <span className="away-gain-amt">+{formatNum(amount)}</span>
                  <span className="away-gain-name">{ITEM_META[id].label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {stats.length > 0 && (
          <section className="away-activity" aria-label="Factory activity">
            <h3>Factory activity</h3>
            <ul className="away-stats">
              {stats.map((stat) => (
                <li key={stat.key}>
                  <span className="away-stat-value">
                    {formatNum(stat.value)}
                  </span>
                  <span className="away-stat-label">{stat.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!busy && (
          <p className="away-empty">
            Load furnaces with ore + coal, queue crafts, or walk to feed drills
            before you leave next time.
          </p>
        )}

        {busy && gains.length === 0 && (
          <p className="away-empty">
            Machines ran, but stock stayed on belts and in buffers. Check the
            floor for cargo still in transit.
          </p>
        )}

        <div className="away-actions">
          <button type="button" className="primary-btn" onClick={dismiss}>
            {busy ? 'Collect & continue' : 'Back to the factory'}
          </button>
        </div>
      </div>
    </div>
  )
}
