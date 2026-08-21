import { memo, useId } from 'react'
import { INSERTER_COOLDOWN } from '../game/data'
import type { BeltTurn } from '../game/beltShape'
import type { Dir, EntityKind, ItemId, OreId, RockVariantId, TreeVariantId } from '../game/types'

const ROT: Record<Dir, number> = { N: -90, E: 0, S: 90, W: 180 }

/** Local arm angle: 0 = drop (forward), 180 = pickup (behind). Art points up. */
function inserterArmAngle(progress: number, cooldown: number): number {
  if (progress <= 0) return 180
  const span = Math.max(0.01, cooldown)
  const u = 1 - Math.min(1, progress / span)
  if (u < 0.5) return 180 * (1 - u / 0.5)
  return 180 * ((u - 0.5) / 0.5)
}

export const GroundTexture = memo(function GroundTexture({ seed = 0 }: { seed?: number }) {
  const base =
    seed % 3 === 0
      ? 'var(--ground-a)'
      : seed % 3 === 1
        ? 'var(--ground-b)'
        : 'var(--ground-c)'
  const dots = Array.from({ length: 7 }, (_, i) => {
    const x = ((seed * 17 + i * 37) % 90) + 5
    const y = ((seed * 29 + i * 53) % 90) + 5
    const r = 1 + ((seed + i) % 3)
    const shade = (seed + i) % 2 === 0 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.16)'
    return <circle key={i} cx={x} cy={y} r={r} fill={shade} />
  })
  return (
    <svg className="tex tex-ground" viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill={base} />
      <rect x="0" y="0" width="100" height="100" fill="var(--ground-shade)" opacity="0.14" />
      {dots}
      <rect
        x={(seed * 13) % 70}
        y={(seed * 19) % 70}
        width="8"
        height="3"
        fill="var(--ground-tuft)"
        opacity="0.45"
      />
    </svg>
  )
})

export const OreTexture = memo(function OreTexture({ ore, amount }: { ore: OreId; amount: number | null }) {
  const colors =
    ore === 'ironOre'
      ? { base: '#8a7e6e', spark: '#d8cfc0', deep: '#5a5248' }
      : ore === 'copperOre'
        ? { base: '#b86838', spark: '#f0a050', deep: '#6a3a20' }
        : { base: '#4a4a4a', spark: '#7a7a7a', deep: '#2a2a2a' }

  const density = amount === null ? 8 : Math.max(3, Math.min(12, Math.floor(amount / 40)))

  return (
    <svg className="tex tex-ore" viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill="var(--ground-cell)" />
      <rect width="100" height="100" fill={colors.deep} opacity="0.42" />
      {Array.from({ length: density }, (_, i) => {
        const x = 12 + ((i * 47) % 76)
        const y = 10 + ((i * 31) % 78)
        const r = 4 + (i % 4)
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={r} ry={r * 0.7} fill={colors.base} />
            <ellipse
              cx={x - r * 0.25}
              cy={y - r * 0.2}
              rx={r * 0.35}
              ry={r * 0.25}
              fill={colors.spark}
              opacity="0.7"
            />
          </g>
        )
      })}
    </svg>
  )
})

export function BeltSprite({
  dir,
  moving,
  fast,
  turn,
}: {
  dir: Dir
  moving?: boolean
  fast?: boolean
  /** Corner bend in local east-exit space; ccw mirrors the cw art. */
  turn?: BeltTurn | null
}) {
  const uid = useId().replace(/:/g, '')
  const clipId = `belt-clip-${uid}`
  const clipH = `belt-clip-h-${uid}`
  const clipV = `belt-clip-v-${uid}`
  const deck = fast ? '#b83838' : '#c47a12'
  const tooth = fast ? '#f09090' : '#f0b040'
  const gap = fast ? '#7a1818' : '#8a5010'
  const rail = fast ? '#4a1010' : '#5c3a08'
  const chevronFill = fast ? '#ffe0e0' : '#ffe8a0'
  const rot = ROT[dir]

  const hStripes = Array.from({ length: 10 }, (_, i) => {
    const x = i * 16 - 16
    return (
      <g key={`h${i}`}>
        <rect x={x} y="20" width="9" height="24" rx="1" fill={tooth} />
        <rect x={x + 9} y="20" width="7" height="24" fill={gap} />
      </g>
    )
  })

  const vStripes = Array.from({ length: 10 }, (_, i) => {
    const y = i * 16 - 16
    return (
      <g key={`v${i}`}>
        <rect x="20" y={y} width="24" height="9" rx="1" fill={tooth} />
        <rect x="20" y={y + 9} width="24" height="7" fill={gap} />
      </g>
    )
  })

  const rollers = (spots: { cx: number; cy: number }[]) =>
    spots.map(({ cx, cy }) => (
      <g key={`${cx}-${cy}`} className="belt-roller">
        <circle cx={cx} cy={cy} r="3.2" fill="#2a2620" stroke="#0a0806" strokeWidth="1" />
        <line x1={cx - 2.2} y1={cy} x2={cx + 2.2} y2={cy} stroke="#c4b8a0" strokeWidth="1.1" />
        <line x1={cx} y1={cy - 2.2} x2={cx} y2={cy + 2.2} stroke="#6a6258" strokeWidth="0.9" />
        <circle cx={cx} cy={cy} r="1.15" fill="#c4b8a0" />
      </g>
    ))

  const exitChevron = (
    <>
      <polygon
        className="belt-chevron"
        points="48,32 36,23 36,29 28,29 28,35 36,35 36,41"
        fill="#1a1612"
        opacity="0.55"
      />
      <polygon
        className="belt-chevron"
        points="47,32 37,25 37,30 30,30 30,34 37,34 37,39"
        fill={chevronFill}
        opacity="0.9"
      />
    </>
  )

  // Corner art is always drawn as CW └ in local east-exit space, then
  // optionally mirrored for CCW. Orientation uses SVG transforms so the
  // pivot stays at viewBox center (CSS rotate/scale was clipping cells).
  const cornerBody = (
    <>
      {/* South arm + east arm frames (overlap at elbow) */}
      <rect x="12" y="20" width="40" height="43" rx="3" fill="#1a1612" />
      <rect x="20" y="12" width="43" height="40" rx="3" fill="#1a1612" />
      <rect x="14" y="22" width="36" height="39" rx="2" fill={deck} />
      <rect x="22" y="14" width="39" height="36" rx="2" fill={deck} />
      {/* Outer rails */}
      <rect x="14" y="22" width="6" height="39" fill={rail} opacity="0.85" />
      <rect x="14" y="55" width="36" height="6" fill={rail} opacity="0.85" />
      <rect x="22" y="14" width="39" height="6" fill={rail} opacity="0.85" />
      <rect x="55" y="14" width="6" height="36" fill={rail} opacity="0.85" />
      {/* Inner elbow rails */}
      <rect x="44" y="22" width="6" height="22" fill={rail} opacity="0.5" />
      <rect x="22" y="44" width="28" height="6" fill={rail} opacity="0.5" />
      <defs>
        {/* East arm only (no elbow overlap) */}
        <clipPath id={clipH}>
          <rect x="32" y="20" width="28" height="24" rx="1" />
        </clipPath>
        {/* South arm only */}
        <clipPath id={clipV}>
          <rect x="20" y="32" width="24" height="28" rx="1" />
        </clipPath>
      </defs>
      <g className="belt-stripes" clipPath={`url(#${clipH})`}>
        {hStripes}
      </g>
      <g className="belt-stripes belt-stripes-v" clipPath={`url(#${clipV})`}>
        {vStripes}
      </g>
      {rollers([
        { cx: 32, cy: 48 },
        { cx: 32, cy: 32 },
        { cx: 48, cy: 32 },
      ])}
      {exitChevron}
    </>
  )

  if (turn) {
    return (
      <svg
        className={`sprite sprite-belt is-corner ${moving ? 'is-moving' : ''} ${fast ? 'is-fast' : ''}`}
        viewBox="0 0 64 64"
        aria-hidden
      >
        <g transform={`rotate(${rot} 32 32)`}>
          {turn === 'ccw' ? (
            <g transform="translate(0 64) scale(1 -1)">{cornerBody}</g>
          ) : (
            cornerBody
          )}
        </g>
      </svg>
    )
  }

  return (
    <svg
      className={`sprite sprite-belt ${moving ? 'is-moving' : ''} ${fast ? 'is-fast' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <g transform={`rotate(${rot} 32 32)`}>
        <rect x="1" y="12" width="62" height="40" rx="3" fill="#1a1612" />
        <rect x="3" y="14" width="58" height="36" rx="2" fill={deck} />
        <rect x="3" y="14" width="58" height="6" fill={rail} opacity="0.85" />
        <rect x="3" y="44" width="58" height="6" fill={rail} opacity="0.85" />
        <defs>
          <clipPath id={clipId}>
            <rect x="5" y="20" width="54" height="24" rx="1" />
          </clipPath>
        </defs>
        <g className="belt-stripes" clipPath={`url(#${clipId})`}>
          {hStripes}
        </g>
        {rollers([
          { cx: 10, cy: 32 },
          { cx: 32, cy: 32 },
          { cx: 54, cy: 32 },
        ])}
        {exitChevron}
      </g>
    </svg>
  )
}

export function DrillSprite({
  dir,
  active,
  electric,
  flip,
}: {
  dir: Dir
  active?: boolean
  electric?: boolean
  flip?: boolean
}) {
  const body = electric ? '#3d7a52' : '#5a554c'
  const accent = electric ? '#7dff9a' : '#c47a12'
  // Local art faces east. Port sits on one of the two east cells (top vs bottom).
  const portY = flip ? 48 : 16
  return (
    <svg
      className={`sprite sprite-drill ${active ? 'is-active' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <g style={{ transform: `rotate(${ROT[dir]}deg)`, transformOrigin: '32px 32px' }}>
        <rect x="6" y="6" width="52" height="52" rx="3" fill={body} stroke="#2a2620" strokeWidth="2" />
        <rect x="10" y="10" width="22" height="18" fill="#3d3830" />
        <rect x="34" y="10" width="18" height="44" fill={electric ? '#4a9a6a' : '#6b655c'} stroke="#2a2620" strokeWidth="1" />
        <circle
          className="drill-bit"
          cx="20"
          cy="40"
          r="8"
          fill="#8a8478"
          stroke="#1a1612"
          strokeWidth="2"
        />
        <circle cx="20" cy="40" r="3.2" fill="#1a1612" />
        <rect x="44" y={portY - 6} width="16" height="12" fill={accent} stroke="#1a1612" strokeWidth="1" />
        <polygon
          points={`62,${portY} 50,${portY - 8} 50,${portY + 8}`}
          fill={accent}
        />
        <rect x="12" y="8" width="12" height="8" fill="#3d3830" stroke="#1a1612" strokeWidth="1" />
        {active && <circle cx="50" cy="8" r="3" fill={accent} className="drill-lamp" />}
        {electric && <path d="M26 8 L30 16 L27 16 L32 26 L28 18 L31 18 Z" fill="#f0e060" />}
      </g>
    </svg>
  )
}

export function SplitterSprite({ dir, moving }: { dir: Dir; moving?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const clipA = `split-a-${uid}`
  const clipB = `split-b-${uid}`
  const laneStripes = (offset: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const x = offset + i * 16 - 16
      return (
        <g key={i}>
          <rect x={x} y="22" width="9" height="20" rx="1" fill="#f0b040" />
          <rect x={x + 9} y="22" width="7" height="20" fill="#8a5010" />
        </g>
      )
    })
  return (
    <svg
      className={`sprite sprite-splitter ${moving ? 'is-moving' : ''}`}
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${ROT[dir]}deg)` }}
      aria-hidden
    >
      <defs>
        <clipPath id={clipA}>
          <rect x="6" y="20" width="22" height="24" rx="1" />
        </clipPath>
        <clipPath id={clipB}>
          <rect x="36" y="20" width="22" height="24" rx="1" />
        </clipPath>
      </defs>
      <rect x="2" y="14" width="60" height="36" rx="2" fill="#1a1612" />
      <rect x="4" y="16" width="56" height="32" fill="#c4a035" stroke="#6a5010" strokeWidth="1" />
      <rect x="6" y="20" width="22" height="24" fill="#8a7020" />
      <rect x="36" y="20" width="22" height="24" fill="#8a7020" />
      <g className="belt-stripes splitter-lane" clipPath={`url(#${clipA})`}>
        {laneStripes(0)}
      </g>
      <g className="belt-stripes splitter-lane" clipPath={`url(#${clipB})`}>
        {laneStripes(32)}
      </g>
      <rect x="28" y="18" width="8" height="28" fill="#e8c84a" stroke="#1a1612" strokeWidth="1" />
      <polygon points="20,32 12,25 12,39" fill="#1a1612" />
      <polygon points="52,32 44,25 44,39" fill="#1a1612" />
    </svg>
  )
}

export function InserterSprite({
  dir,
  long,
  progress = 0,
  cooldown = INSERTER_COOLDOWN,
}: {
  dir: Dir
  long?: boolean
  /** Remaining transfer cooldown; >0 means currently moving an item. */
  progress?: number
  /** Full swing duration in seconds (skill-adjusted). */
  cooldown?: number
}) {
  const arm = long ? '#e07040' : '#c4a035'
  const tip = long ? '#f0a070' : '#e8c84a'
  // Art points north (arm up); +90° so local up = drop direction.
  const facing = ROT[dir] + 90
  const swingCd = cooldown > 0 ? cooldown : INSERTER_COOLDOWN
  const armDeg = inserterArmAngle(progress, swingCd)
  const swinging = progress > 0
  const carrying =
    swinging && 1 - Math.min(1, progress / swingCd) < 0.55
  const tipY = long ? 4 : 10

  return (
    <svg
      className={`sprite sprite-inserter ${long ? 'is-long' : ''} ${
        swinging ? 'is-swinging' : ''
      }`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <g transform={`rotate(${facing} 32 32)`}>
        <circle cx="32" cy="32" r="11" fill="#6b655c" stroke="#1a1612" strokeWidth="2" />
        <circle cx="32" cy="32" r="4.5" fill="#2a2620" />
        {/* Fixed flow arrow: pickup (down) → drop (up) in local space */}
        <g className="inserter-flow">
          <path
            d="M32 50 L32 24"
            fill="none"
            stroke="#1a1612"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M32 50 L32 24"
            fill="none"
            stroke="#7dff9a"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <polygon points="32,14 41,27 23,27" fill="#7dff9a" stroke="#1a1612" strokeWidth="1.2" />
        </g>
        <g className="inserter-arm" transform={`rotate(${armDeg} 32 32)`}>
          <rect
            x="28"
            y={long ? 2 : 8}
            width="8"
            height={long ? 30 : 24}
            rx="2"
            fill={arm}
            stroke="#1a1612"
            strokeWidth="1"
          />
          <rect
            x="24"
            y={long ? 0 : 6}
            width="16"
            height="8"
            rx="1"
            fill={tip}
            stroke="#1a1612"
            strokeWidth="1"
          />
          <polygon
            points={long ? '32,-2 38,6 26,6' : '32,2 38,10 26,10'}
            fill="#1a1612"
          />
          {carrying && (
            <circle
              className="inserter-cargo"
              cx="32"
              cy={tipY}
              r="5"
              fill="#c4b8a8"
              stroke="#1a1612"
              strokeWidth="1.2"
            />
          )}
        </g>
        {long && <circle cx="32" cy="46" r="5" fill="#1a1612" />}
        {long && <circle cx="32" cy="46" r="2.5" fill="#f0a070" />}
      </g>
    </svg>
  )
}

export function FurnaceSprite({ lit, steel }: { lit?: boolean; steel?: boolean }) {
  const body = steel ? '#4a5560' : '#6a5a4a'
  const rim = steel ? '#2a3038' : '#2a2018'
  const top = steel ? '#6a7580' : '#5a4a3a'
  const foot = steel ? '#3a4450' : '#4a3a2a'
  return (
    <svg
      className={`sprite sprite-furnace ${lit ? 'is-lit' : ''} ${steel ? 'is-steel' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <rect x="10" y="14" width="44" height="42" rx="2" fill={body} stroke={rim} strokeWidth="2" />
      <rect x="16" y="20" width="32" height="22" fill="#1a1210" />
      <rect
        className="furnace-glow"
        x="18"
        y="22"
        width="28"
        height="18"
        fill={lit ? '#ff6a20' : '#2a1a10'}
        opacity={lit ? 0.95 : 0.8}
      />
      {lit && (
        <>
          <ellipse cx="28" cy="32" rx="4" ry="6" fill="#ffcc44" opacity="0.8" />
          <ellipse cx="38" cy="34" rx="3" ry="5" fill="#ff8822" opacity="0.7" />
        </>
      )}
      <rect x="14" y="48" width="36" height="6" fill={foot} />
      <rect x="22" y="8" width="8" height="8" fill={top} stroke="#1a1612" strokeWidth="1" />
      <rect x="34" y="8" width="8" height="8" fill={top} stroke="#1a1612" strokeWidth="1" />
      {steel && (
        <rect x="24" y="50" width="16" height="3" fill="#c4d0dc" opacity="0.5" />
      )}
      <circle cx="14" cy="18" r="1.5" fill="#2a2018" />
      <circle cx="50" cy="18" r="1.5" fill="#2a2018" />
      <circle cx="14" cy="50" r="1.5" fill="#2a2018" />
      <circle cx="50" cy="50" r="1.5" fill="#2a2018" />
    </svg>
  )
}

export function UndergroundBeltSprite({
  dir,
  exit,
  moving,
}: {
  dir: Dir
  exit?: boolean
  moving?: boolean
}) {
  const clipId = `ug-clip-${useId().replace(/:/g, '')}`
  const mouthX = exit ? 46 : 18
  const stripes = Array.from({ length: 8 }, (_, i) => {
    const x = i * 16 - 16
    return (
      <g key={i}>
        <rect x={x} y="24" width="9" height="16" rx="1" fill="#f0a020" />
        <rect x={x + 9} y="24" width="7" height="16" fill="#8a5010" />
      </g>
    )
  })
  return (
    <svg
      className={`sprite sprite-ug ${moving ? 'is-moving' : ''} ${exit ? 'is-exit' : 'is-entry'}`}
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${ROT[dir]}deg)` }}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="6" y="23" width="52" height="18" rx="1" />
        </clipPath>
      </defs>
      <rect x="2" y="16" width="60" height="32" rx="3" fill="#1a1612" />
      <rect x="4" y="18" width="56" height="28" rx="2" fill="#c4783a" />
      <rect x="4" y="18" width="56" height="5" fill="#8a4a20" opacity="0.7" />
      <rect x="4" y="41" width="56" height="5" fill="#8a4a20" opacity="0.7" />
      <g className="belt-stripes ug-stripes" clipPath={`url(#${clipId})`}>
        {stripes}
      </g>
      <ellipse className="ug-mouth" cx={mouthX} cy="32" rx="11" ry="9" fill="#1a1210" />
      <ellipse cx={mouthX} cy="32" rx="7" ry="5.5" fill="#0a0806" />
      <ellipse
        className="ug-glow"
        cx={mouthX}
        cy="32"
        rx="5"
        ry="3.5"
        fill="#f0a020"
        opacity="0.35"
      />
      {exit ? (
        <polygon points="60,32 50,24 50,40" fill="#ffe08a" />
      ) : (
        <polygon points="4,32 14,24 14,40" fill="#ffe08a" />
      )}
      {/* Entry/exit marker on the non-mouth side */}
      <rect
        x={exit ? 10 : 42}
        y="28"
        width="12"
        height="8"
        rx="1"
        fill="#1a1612"
        opacity="0.35"
      />
    </svg>
  )
}

export function ChestSprite({ filled }: { filled?: boolean }) {
  return (
    <svg className="sprite sprite-chest" viewBox="0 0 64 64" aria-hidden>
      <rect x="12" y="18" width="40" height="34" rx="2" fill="#5c6b7a" stroke="#1a1612" strokeWidth="2" />
      <rect x="12" y="18" width="40" height="10" fill="#7a8a9a" />
      <rect x="28" y="30" width="8" height="10" rx="1" fill="#c47a12" stroke="#1a1612" strokeWidth="1" />
      <line x1="12" y1="28" x2="52" y2="28" stroke="#2a3540" strokeWidth="2" />
      <circle cx="16" cy="22" r="1.5" fill="#2a3540" />
      <circle cx="48" cy="22" r="1.5" fill="#2a3540" />
      {filled && <rect x="16" y="40" width="32" height="4" fill="#f0a020" opacity="0.7" />}
    </svg>
  )
}

export function AssemblerSprite({ active }: { active?: boolean }) {
  return (
    <svg
      className={`sprite sprite-assembler ${active ? 'is-active' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <rect x="8" y="12" width="48" height="44" rx="2" fill="#4a6a8a" stroke="#1a1612" strokeWidth="2" />
      <rect x="14" y="18" width="36" height="22" fill="#1a2430" />
      <rect x="18" y="22" width="12" height="14" fill="#6a8aaa" className="asm-arm" />
      <rect x="34" y="22" width="12" height="14" fill="#6a8aaa" className="asm-arm" />
      <circle cx="32" cy="48" r="6" fill="#c47a12" stroke="#1a1612" strokeWidth="1" />
      {active && <circle cx="50" cy="16" r="3" fill="#7dff9a" className="drill-lamp" />}
      <rect x="12" y="42" width="8" height="4" fill="#2a4058" />
      <rect x="44" y="42" width="8" height="4" fill="#2a4058" />
    </svg>
  )
}

export function RoboportSprite({ active }: { active?: boolean }) {
  return (
    <svg
      className={`sprite sprite-roboport ${active ? 'is-active' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <rect x="6" y="6" width="52" height="52" rx="6" fill="#2a4a58" stroke="#12303c" strokeWidth="2" />
      <rect x="10" y="10" width="44" height="44" rx="4" fill="#356878" />
      {/* Corner drone pads */}
      <rect x="12" y="12" width="14" height="14" rx="2" fill="#1c3a46" />
      <rect x="38" y="12" width="14" height="14" rx="2" fill="#1c3a46" />
      <rect x="12" y="38" width="14" height="14" rx="2" fill="#1c3a46" />
      <rect x="38" y="38" width="14" height="14" rx="2" fill="#1c3a46" />
      {/* Central landing dish */}
      <circle cx="32" cy="32" r="12" fill="#123039" stroke="#0c2129" strokeWidth="2" />
      <circle
        className="roboport-core"
        cx="32"
        cy="32"
        r="7"
        fill={active ? '#7fe8ff' : '#4a8fa5'}
        stroke="#0c2129"
        strokeWidth="1.5"
      />
      <circle cx="32" cy="32" r="2.5" fill="#eafcff" />
      {/* Beacon lamps */}
      <circle cx="19" cy="19" r="2" fill={active ? '#8dffcf' : '#2c5460'} />
      <circle cx="45" cy="19" r="2" fill={active ? '#8dffcf' : '#2c5460'} />
      <circle cx="19" cy="45" r="2" fill={active ? '#8dffcf' : '#2c5460'} />
      <circle cx="45" cy="45" r="2" fill={active ? '#8dffcf' : '#2c5460'} />
    </svg>
  )
}

export function DroneSprite() {
  return (
    <svg className="sprite sprite-drone" viewBox="0 0 32 32" aria-hidden>
      <ellipse className="drone-shadow" cx="16" cy="27" rx="7" ry="2.4" fill="rgba(0,0,0,0.35)" />
      {/* Rotor blur */}
      <ellipse cx="9" cy="11" rx="6" ry="1.8" fill="#bfe9f5" opacity="0.7" />
      <ellipse cx="23" cy="11" rx="6" ry="1.8" fill="#bfe9f5" opacity="0.7" />
      <line x1="9" y1="11" x2="14" y2="16" stroke="#123039" strokeWidth="2" />
      <line x1="23" y1="11" x2="18" y2="16" stroke="#123039" strokeWidth="2" />
      {/* Body */}
      <rect x="11" y="14" width="10" height="8" rx="3" fill="#3fa7c9" stroke="#0c2129" strokeWidth="1.5" />
      <circle cx="16" cy="18" r="2.2" fill="#eafcff" />
      {/* Carried spark */}
      <circle className="drone-spark" cx="16" cy="24" r="1.8" fill="#ffe08a" />
    </svg>
  )
}

export const GeneratorSprite = memo(function GeneratorSprite({
  active,
}: {
  active?: boolean
}) {
  return (
    <svg
      className={`sprite sprite-generator ${active ? 'is-active' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <rect x="8" y="16" width="48" height="38" rx="4" fill="#4a4436" stroke="#241f16" strokeWidth="2" />
      <rect x="12" y="20" width="40" height="24" rx="2" fill="#2e2a20" />
      {/* Dynamo drum */}
      <circle cx="32" cy="32" r="11" fill="#6a6252" stroke="#241f16" strokeWidth="2" />
      <circle cx="32" cy="32" r="6" fill={active ? '#ffe14d' : '#8a7f66'} stroke="#241f16" strokeWidth="1.5" />
      {/* Lightning bolt */}
      <path
        d="M33 23 L26 34 L31 34 L29 42 L38 30 L33 30 Z"
        fill={active ? '#fff2a0' : '#c9be9a'}
        stroke="#241f16"
        strokeWidth="1"
      />
      {/* Vents + feet */}
      <rect x="14" y="47" width="36" height="5" fill="#3a3428" />
      <circle cx="16" cy="20" r="1.6" fill="#241f16" />
      <circle cx="48" cy="20" r="1.6" fill="#241f16" />
      {active && <circle cx="49" cy="50" r="3" fill="#8dffcf" className="drill-lamp" />}
    </svg>
  )
})

export const TreeSprite = memo(function TreeSprite({
  variant = 'pine',
}: {
  variant?: TreeVariantId | string
}) {
  // Tall viewBox, bottom-aligned so the trunk sits on its tile while the
  // canopy rises ~1.5 tiles above it (the tree still occupies one tile).
  if (variant === 'oak') {
    return (
      <svg
        className="sprite sprite-tree"
        viewBox="0 0 64 96"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden
      >
        <ellipse cx="32" cy="90" rx="18" ry="4.5" fill="rgba(0,0,0,0.3)" />
        <rect x="25" y="58" width="14" height="33" rx="4" fill="#5a3a1c" stroke="#2f1c0c" strokeWidth="1.5" />
        <circle cx="32" cy="36" r="24" fill="#3d5c28" stroke="#243618" strokeWidth="2" />
        <circle cx="16" cy="46" r="14" fill="#4a6e30" stroke="#243618" strokeWidth="1.5" />
        <circle cx="48" cy="46" r="14" fill="#4a6e30" stroke="#243618" strokeWidth="1.5" />
        <circle cx="32" cy="22" r="10" fill="#5a8a38" opacity="0.85" />
      </svg>
    )
  }
  if (variant === 'birch') {
    return (
      <svg
        className="sprite sprite-tree"
        viewBox="0 0 64 96"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden
      >
        <ellipse cx="32" cy="90" rx="13" ry="4" fill="rgba(0,0,0,0.28)" />
        <rect x="28" y="58" width="8" height="33" rx="2" fill="#e8e0d4" stroke="#6a6458" strokeWidth="1.4" />
        <path d="M30 64 h4 M29 72 h5 M31 80 h3" stroke="#3a342c" strokeWidth="1.4" />
        <circle cx="32" cy="38" r="18" fill="#8aaa4a" stroke="#5a7030" strokeWidth="2" />
        <circle cx="20" cy="46" r="11" fill="#9bbb55" stroke="#5a7030" strokeWidth="1.4" />
        <circle cx="44" cy="46" r="11" fill="#9bbb55" stroke="#5a7030" strokeWidth="1.4" />
        <circle cx="32" cy="26" r="6" fill="#c4d878" opacity="0.8" />
      </svg>
    )
  }
  if (variant === 'deadwood') {
    return (
      <svg
        className="sprite sprite-tree"
        viewBox="0 0 64 96"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden
      >
        <ellipse cx="32" cy="90" rx="12" ry="3.5" fill="rgba(0,0,0,0.28)" />
        <rect x="29" y="52" width="6" height="39" rx="2" fill="#6a5a40" stroke="#3a3020" strokeWidth="1.4" />
        <path
          d="M32 58 L18 42 M32 62 L48 46 M32 70 L22 56 M32 54 L40 40"
          fill="none"
          stroke="#6a5a40"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="18" cy="42" r="3" fill="#7a6a50" />
        <circle cx="48" cy="46" r="2.5" fill="#7a6a50" />
      </svg>
    )
  }
  return (
    <svg
      className="sprite sprite-tree"
      viewBox="0 0 64 96"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
    >
      <ellipse cx="32" cy="90" rx="15" ry="4.5" fill="rgba(0,0,0,0.3)" />
      <rect x="27" y="60" width="10" height="31" rx="3" fill="#6b4a2a" stroke="#3d2a15" strokeWidth="1.5" />
      <path d="M32 74 L24 66 M32 68 L40 60" stroke="#5a3d22" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="34" r="21" fill="#2f6b32" stroke="#1c3f1e" strokeWidth="2" />
      <circle cx="17" cy="45" r="13" fill="#357a38" stroke="#1c3f1e" strokeWidth="1.5" />
      <circle cx="47" cy="45" r="13" fill="#357a38" stroke="#1c3f1e" strokeWidth="1.5" />
      <circle cx="25" cy="24" r="7" fill="#4c9a4f" opacity="0.85" />
      <circle cx="41" cy="29" r="5.5" fill="#4c9a4f" opacity="0.7" />
    </svg>
  )
})

export const RockSprite = memo(function RockSprite({
  variant = 'stone',
}: {
  variant?: RockVariantId | string
}) {
  if (variant === 'boulder') {
    return (
      <svg className="sprite sprite-rock" viewBox="0 0 32 32" aria-hidden>
        <ellipse cx="16" cy="27" rx="13" ry="3.6" fill="rgba(0,0,0,0.32)" />
        <path
          d="M3 24 L7 10 L16 6 L26 11 L29 22 L24 28 L6 28 Z"
          fill="#5c564e"
          stroke="#2f2b26"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M7 10 L16 6 L18 16 L10 20 Z" fill="#7a7268" opacity="0.9" />
        <path d="M18 16 L26 11 L29 22 L22 24 Z" fill="#4a453e" opacity="0.95" />
      </svg>
    )
  }
  if (variant === 'pebble') {
    return (
      <svg className="sprite sprite-rock" viewBox="0 0 32 32" aria-hidden>
        <ellipse cx="16" cy="27" rx="10" ry="2.8" fill="rgba(0,0,0,0.22)" />
        <ellipse cx="12" cy="22" rx="5" ry="3.6" fill="#c4bdb2" stroke="#8a8478" strokeWidth="1.2" />
        <ellipse cx="20" cy="23" rx="4.2" ry="3" fill="#b8b0a4" stroke="#8a8478" strokeWidth="1.1" />
        <ellipse cx="16" cy="20" rx="3.2" ry="2.4" fill="#d4cdc2" stroke="#8a8478" strokeWidth="1" />
      </svg>
    )
  }
  if (variant === 'ironVein') {
    return (
      <svg className="sprite sprite-rock" viewBox="0 0 32 32" aria-hidden>
        <ellipse cx="16" cy="27" rx="12" ry="3.5" fill="rgba(0,0,0,0.28)" />
        <path
          d="M5 24 L8 13 L15 9 L23 12 L27 20 L24 26 L9 27 Z"
          fill="#8B7355"
          stroke="#5a4a38"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M10 16 L18 12 L22 18" fill="none" stroke="#c4a070" strokeWidth="2" />
        <path d="M12 21 L20 17" fill="none" stroke="#a08058" strokeWidth="1.6" />
      </svg>
    )
  }
  if (variant === 'copperVein') {
    return (
      <svg className="sprite sprite-rock" viewBox="0 0 32 32" aria-hidden>
        <ellipse cx="16" cy="27" rx="12" ry="3.5" fill="rgba(0,0,0,0.28)" />
        <path
          d="M5 24 L8 13 L15 9 L23 12 L27 20 L24 26 L9 27 Z"
          fill="#8a6a4a"
          stroke="#5a4030"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M11 15 L19 11 L24 18" fill="none" stroke="#C4783A" strokeWidth="2.2" />
        <path d="M10 21 L18 17" fill="none" stroke="#e8913a" strokeWidth="1.6" />
      </svg>
    )
  }
  if (variant === 'coalSeam') {
    return (
      <svg className="sprite sprite-rock" viewBox="0 0 32 32" aria-hidden>
        <ellipse cx="16" cy="27" rx="12" ry="3.5" fill="rgba(0,0,0,0.28)" />
        <path
          d="M5 24 L8 13 L15 9 L23 12 L27 20 L24 26 L9 27 Z"
          fill="#2A2A2A"
          stroke="#111"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M9 18 L16 12 L22 19" fill="none" stroke="#4a4a4a" strokeWidth="1.8" />
        <ellipse cx="14" cy="16" rx="1.6" ry="1" fill="#5a5a5a" />
      </svg>
    )
  }
  return (
    <svg className="sprite sprite-rock" viewBox="0 0 32 32" aria-hidden>
      <ellipse cx="16" cy="27" rx="12" ry="3.5" fill="rgba(0,0,0,0.28)" />
      <path
        d="M5 24 L8 13 L15 9 L23 12 L27 20 L24 26 L9 27 Z"
        fill="#8f867a"
        stroke="#4f4842"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 13 L15 9 L18 16 L11 20 Z" fill="#a8a094" opacity="0.9" />
      <path d="M18 16 L23 12 L27 20 L22 22 Z" fill="#7a7268" opacity="0.9" />
      <path d="M11 20 L18 16 L22 22 L13 25 Z" fill="#6f6860" opacity="0.85" />
      <ellipse cx="12" cy="14" rx="1.8" ry="1.2" fill="#c4bdb2" opacity="0.7" />
    </svg>
  )
})

const ITEM_COLORS: Record<ItemId, { fill: string; edge: string }> = {
  ironOre: { fill: '#8B7355', edge: '#5a4a38' },
  copperOre: { fill: '#C4783A', edge: '#8a4a28' },
  coal: { fill: '#2A2A2A', edge: '#111' },
  ironPlate: { fill: '#A8B0BC', edge: '#6a7280' },
  copperPlate: { fill: '#E8913A', edge: '#a06020' },
  gear: { fill: '#9AA3AD', edge: '#5a636c' },
  steel: { fill: '#5C6B7A', edge: '#2a3540' },
  belt: { fill: '#F0A020', edge: '#8a5a10' },
  inserter: { fill: '#c4a035', edge: '#6a5010' },
  longInserter: { fill: '#e07040', edge: '#8a3020' },
  drill: { fill: '#6B5535', edge: '#3d3020' },
  furnace: { fill: '#8A4B1A', edge: '#4a2810' },
  steelFurnace: { fill: '#4a5560', edge: '#2a3038' },
  chest: { fill: '#5C6B7A', edge: '#2a3540' },
  assembler: { fill: '#4a6a8a', edge: '#2a4058' },
  fastBelt: { fill: '#E05050', edge: '#8a2020' },
  undergroundBelt: { fill: '#c4783a', edge: '#6a3a18' },
  electricDrill: { fill: '#3D9E5F', edge: '#1a5030' },
  splitter: { fill: '#c4a035', edge: '#6a5010' },
  roboport: { fill: '#3fa7c9', edge: '#1a5060' },
  wood: { fill: '#8a5a30', edge: '#4a2f18' },
  generator: { fill: '#f5d020', edge: '#8a6a10' },
  stone: { fill: '#9a9184', edge: '#5f5850' },
  foundation: { fill: '#b8b0a4', edge: '#6a645c' },
}

const PLACEABLE_ITEMS = new Set<ItemId>([
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
  'roboport',
  'generator',
])

function OreItemSprite({ item }: { item: 'ironOre' | 'copperOre' | 'coal' }) {
  const c = ITEM_COLORS[item]
  if (item === 'coal') {
    return (
      <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
        <rect x="2" y="2" width="28" height="28" rx="3" fill="#1a1612" opacity="0.35" />
        <path d="M8 20 L12 8 L18 14 L22 7 L27 18 L24 26 L10 26 Z" fill={c.fill} stroke={c.edge} strokeWidth="1.5" />
        <path d="M13 12 L16 18 L11 22" fill="none" stroke="#555" strokeWidth="1.2" />
        <ellipse cx="20" cy="16" rx="2" ry="1.4" fill="#666" opacity="0.7" />
      </svg>
    )
  }
  const spark = item === 'ironOre' ? '#d0c4b0' : '#f0b060'
  return (
    <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="3" fill="#1a1612" opacity="0.28" />
      <ellipse cx="12" cy="20" rx="7" ry="5" fill={c.fill} stroke={c.edge} strokeWidth="1.4" />
      <ellipse cx="21" cy="16" rx="6" ry="5" fill={c.fill} stroke={c.edge} strokeWidth="1.4" />
      <ellipse cx="16" cy="12" rx="5.5" ry="4.5" fill={c.fill} stroke={c.edge} strokeWidth="1.4" />
      <ellipse cx="14" cy="10" rx="2" ry="1.3" fill={spark} opacity="0.75" />
      <ellipse cx="20" cy="14" rx="1.6" ry="1" fill={spark} opacity="0.55" />
    </svg>
  )
}

function PlateItemSprite({ item }: { item: 'ironPlate' | 'copperPlate' | 'steel' }) {
  const c = ITEM_COLORS[item]
  const sheen = item === 'steel' ? 'rgba(200,220,240,0.35)' : 'rgba(255,255,255,0.28)'
  return (
    <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="3" fill="#1a1612" opacity="0.28" />
      <rect x="5" y="8" width="22" height="16" rx="1.5" fill={c.fill} stroke={c.edge} strokeWidth="1.8" />
      <rect x="7" y="10" width="18" height="3" fill={sheen} />
      <rect x="7" y="20" width="10" height="1.5" fill={c.edge} opacity="0.45" />
      {item === 'steel' && (
        <rect x="18" y="18" width="6" height="3" fill="#c4d0dc" opacity="0.55" />
      )}
    </svg>
  )
}

function GearItemSprite() {
  const c = ITEM_COLORS.gear
  return (
    <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="3" fill="#1a1612" opacity="0.28" />
      <circle cx="16" cy="16" r="10" fill={c.fill} stroke={c.edge} strokeWidth="1.6" />
      <circle cx="16" cy="16" r="3.6" fill="#1a1612" />
      {[0, 45, 90, 135].map((a) => (
        <rect
          key={a}
          x="14"
          y="3"
          width="4"
          height="7"
          rx="0.6"
          fill={c.fill}
          stroke={c.edge}
          strokeWidth="0.6"
          transform={`rotate(${a} 16 16)`}
        />
      ))}
    </svg>
  )
}

export const ItemSprite = memo(function ItemSprite({ item }: { item: ItemId }) {
  if (item === 'ironOre' || item === 'copperOre' || item === 'coal') {
    return <OreItemSprite item={item} />
  }
  if (item === 'ironPlate' || item === 'copperPlate' || item === 'steel') {
    return <PlateItemSprite item={item} />
  }
  if (item === 'gear') {
    return <GearItemSprite />
  }
  if (item === 'wood') {
    return (
      <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
        <rect x="2" y="2" width="28" height="28" rx="3" fill="#1a1612" opacity="0.28" />
        <rect x="6" y="12" width="20" height="9" rx="2.5" fill="#8a5a30" stroke="#4a2f18" strokeWidth="1.6" />
        <ellipse cx="26" cy="16.5" rx="2.6" ry="4.5" fill="#c79a63" stroke="#4a2f18" strokeWidth="1.2" />
        <circle cx="26" cy="16.5" r="1.4" fill="#8a5a30" />
        <path d="M9 15h12M9 18h10" stroke="#5f3e22" strokeWidth="1" opacity="0.6" />
      </svg>
    )
  }
  if (item === 'stone') {
    return (
      <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
        <rect x="2" y="2" width="28" height="28" rx="3" fill="#1a1612" opacity="0.28" />
        <path d="M7 21 L10 12 L17 10 L23 15 L22 23 L11 25 Z" fill="#9a9184" stroke="#5f5850" strokeWidth="1.6" />
        <path d="M12 13 L17 15 L15 21" fill="none" stroke="#7a7268" strokeWidth="1.2" />
        <ellipse cx="12" cy="14" rx="2" ry="1.3" fill="#c4bdb2" opacity="0.7" />
        <ellipse cx="20" cy="19" rx="1.6" ry="1" fill="#c4bdb2" opacity="0.5" />
      </svg>
    )
  }
  if (item === 'foundation') {
    return <FoundationSprite />
  }
  if (PLACEABLE_ITEMS.has(item)) {
    return (
      <span className="sprite sprite-item sprite-item-entity" aria-hidden>
        <EntitySprite kind={item as EntityKind} dir="E" />
      </span>
    )
  }
  const c = ITEM_COLORS[item]
  return (
    <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="11" fill={c.fill} stroke={c.edge} strokeWidth="2" />
      <ellipse cx="12" cy="12" rx="4" ry="3" fill="rgba(255,255,255,0.25)" />
    </svg>
  )
})

export const EntitySprite = memo(function EntitySprite({
  kind,
  dir,
  lit,
  active,
  moving,
  filled,
  toggle,
  progress = 0,
  cooldown,
  turn,
  flip,
  variant,
}: {
  kind: EntityKind
  dir: Dir
  lit?: boolean
  active?: boolean
  moving?: boolean
  filled?: boolean
  toggle?: number
  progress?: number
  cooldown?: number
  turn?: BeltTurn | null
  flip?: boolean
  variant?: string
}) {
  switch (kind) {
    case 'belt':
      return <BeltSprite dir={dir} moving={moving} turn={turn} />
    case 'fastBelt':
      return <BeltSprite dir={dir} moving={moving} fast turn={turn} />
    case 'undergroundBelt':
      return (
        <UndergroundBeltSprite
          dir={dir}
          exit={(toggle ?? 0) === 1}
          moving={moving}
        />
      )
    case 'drill':
      return <DrillSprite dir={dir} active={active} flip={flip} />
    case 'electricDrill':
      return <DrillSprite dir={dir} active={active} electric flip={flip} />
    case 'inserter':
      return (
        <InserterSprite dir={dir} progress={progress} cooldown={cooldown} />
      )
    case 'longInserter':
      return (
        <InserterSprite
          dir={dir}
          long
          progress={progress}
          cooldown={cooldown}
        />
      )
    case 'furnace':
      return <FurnaceSprite lit={lit} />
    case 'steelFurnace':
      return <FurnaceSprite lit={lit} steel />
    case 'chest':
      return <ChestSprite filled={filled} />
    case 'assembler':
      return <AssemblerSprite active={active || lit} />
    case 'splitter':
      return <SplitterSprite dir={dir} moving={moving} />
    case 'roboport':
      return <RoboportSprite active={active} />
    case 'tree':
      return <TreeSprite variant={variant} />
    case 'rock':
      return <RockSprite variant={variant} />
    case 'generator':
      return <GeneratorSprite active={active} />
  }
})

export const FoundationSprite = memo(function FoundationSprite() {
  return (
    <svg className="sprite sprite-foundation" viewBox="0 0 64 64" aria-hidden>
      <rect x="1" y="1" width="62" height="62" fill="#8e877c" />
      <rect x="1" y="1" width="62" height="62" fill="none" stroke="#5c574e" strokeWidth="2" />
      <path d="M1 32 H63" stroke="#6e6860" strokeWidth="1.4" />
      <path d="M32 1 V63" stroke="#6e6860" strokeWidth="1.4" />
      <path d="M1 16 H31" stroke="#a39c92" strokeWidth="0.8" opacity="0.7" />
      <path d="M33 48 H63" stroke="#a39c92" strokeWidth="0.8" opacity="0.7" />
      <rect x="4" y="4" width="10" height="6" fill="#c4bdb2" opacity="0.28" />
      <rect x="40" y="36" width="14" height="5" fill="#5c574e" opacity="0.25" />
    </svg>
  )
})

export function ToolIcon({
  kind,
}: {
  kind: EntityKind | 'foundation' | 'remove' | 'copy' | 'paste' | 'rotate' | 'flip'
}) {
  if (kind === 'foundation') {
    return (
      <span className="tool-icon-wrap">
        <FoundationSprite />
      </span>
    )
  }
  if (kind === 'remove') {
    return (
      <svg className="tool-icon" viewBox="0 0 32 32" aria-hidden>
        <rect x="4" y="4" width="24" height="24" fill="#3d3030" stroke="#b33a2b" strokeWidth="2" />
        <line x1="10" y1="10" x2="22" y2="22" stroke="#b33a2b" strokeWidth="3" />
        <line x1="22" y1="10" x2="10" y2="22" stroke="#b33a2b" strokeWidth="3" />
      </svg>
    )
  }
  if (kind === 'copy') {
    return (
      <svg className="tool-icon" viewBox="0 0 32 32" aria-hidden>
        <rect x="6" y="10" width="14" height="14" fill="none" stroke="#7ab0e0" strokeWidth="2" />
        <rect x="12" y="6" width="14" height="14" fill="#2a3540" stroke="#a8d0f0" strokeWidth="2" />
      </svg>
    )
  }
  if (kind === 'paste') {
    return (
      <svg className="tool-icon" viewBox="0 0 32 32" aria-hidden>
        <rect x="8" y="8" width="16" height="16" fill="#2a4030" stroke="#7dff9a" strokeWidth="2" />
        <path d="M12 16 L15 19 L21 12" fill="none" stroke="#7dff9a" strokeWidth="2" />
      </svg>
    )
  }
  if (kind === 'rotate') {
    return (
      <svg className="tool-icon" viewBox="0 0 32 32" aria-hidden>
        <rect x="4" y="4" width="24" height="24" fill="#2a2418" stroke="#f0a020" strokeWidth="2" />
        <path
          d="M10 16a6 6 0 1 1 2.2 4.7"
          fill="none"
          stroke="#f0c060"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <polygon points="9,12 14,13.5 10.5,17.5" fill="#f0c060" />
      </svg>
    )
  }
  if (kind === 'flip') {
    return (
      <svg className="tool-icon" viewBox="0 0 32 32" aria-hidden>
        <rect x="4" y="4" width="24" height="24" fill="#1a2430" stroke="#7ab0e0" strokeWidth="2" />
        <path
          d="M10 12 H20 M20 12 L16 8 M20 12 L16 16"
          fill="none"
          stroke="#a8d0f0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 20 H12 M12 20 L16 16 M12 20 L16 24"
          fill="none"
          stroke="#a8d0f0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <span className="tool-icon-wrap">
      <EntitySprite kind={kind} dir="E" />
    </span>
  )
}
