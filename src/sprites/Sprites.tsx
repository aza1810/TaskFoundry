import type { Dir, EntityKind, ItemId, OreId } from '../game/types'

const ROT: Record<Dir, number> = { N: -90, E: 0, S: 90, W: 180 }

export function GroundTexture({ seed = 0 }: { seed?: number }) {
  const base = seed % 3 === 0 ? '#4f6436' : seed % 3 === 1 ? '#465c30' : '#526a38'
  const dots = Array.from({ length: 7 }, (_, i) => {
    const x = ((seed * 17 + i * 37) % 90) + 5
    const y = ((seed * 29 + i * 53) % 90) + 5
    const r = 1 + ((seed + i) % 3)
    const shade = (seed + i) % 2 === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.07)'
    return <circle key={i} cx={x} cy={y} r={r} fill={shade} />
  })
  return (
    <svg className="tex tex-ground" viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill={base} />
      <rect x="0" y="0" width="100" height="100" fill="#3a4a28" opacity="0.15" />
      {dots}
      <rect
        x={(seed * 13) % 70}
        y={(seed * 19) % 70}
        width="8"
        height="3"
        fill="#3d5228"
        opacity="0.5"
      />
    </svg>
  )
}

export function OreTexture({ ore, amount }: { ore: OreId; amount: number | null }) {
  const colors =
    ore === 'ironOre'
      ? { base: '#6b6358', spark: '#c4b8a8', deep: '#3d3830' }
      : ore === 'copperOre'
        ? { base: '#8a4a28', spark: '#e8913a', deep: '#4a2818' }
        : { base: '#2a2a2a', spark: '#555', deep: '#111' }

  const density = amount === null ? 8 : Math.max(3, Math.min(12, Math.floor(amount / 40)))

  return (
    <svg className="tex tex-ore" viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill="#4a5c32" />
      <rect width="100" height="100" fill={colors.deep} opacity="0.55" />
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
}

export function BeltSprite({ dir, moving, fast }: { dir: Dir; moving?: boolean; fast?: boolean }) {
  const a = fast ? '#E05050' : '#c47a12'
  const b = fast ? '#f08080' : '#f0a020'
  const c = fast ? '#8a2020' : '#8a5a10'
  return (
    <svg
      className={`sprite sprite-belt ${moving ? 'is-moving' : ''} ${fast ? 'is-fast' : ''}`}
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${ROT[dir]}deg)` }}
      aria-hidden
    >
      <rect x="2" y="14" width="60" height="36" rx="2" fill="#1a1612" />
      <rect x="4" y="16" width="56" height="32" fill={a} />
      <g className="belt-stripes">
        <rect x="0" y="18" width="10" height="28" fill={b} />
        <rect x="14" y="18" width="10" height="28" fill={c} />
        <rect x="28" y="18" width="10" height="28" fill={b} />
        <rect x="42" y="18" width="10" height="28" fill={c} />
        <rect x="56" y="18" width="10" height="28" fill={b} />
      </g>
      <rect x="4" y="16" width="56" height="4" fill="#5c3a08" opacity="0.5" />
      <rect x="4" y="44" width="56" height="4" fill="#5c3a08" opacity="0.5" />
      <polygon points="50,32 40,24 40,40" fill="#1a1612" opacity="0.55" />
    </svg>
  )
}

export function DrillSprite({ dir, active, electric }: { dir: Dir; active?: boolean; electric?: boolean }) {
  const body = electric ? '#3d7a52' : '#5a554c'
  const accent = electric ? '#7dff9a' : '#c47a12'
  return (
    <svg
      className={`sprite sprite-drill ${active ? 'is-active' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <rect x="8" y="18" width="48" height="36" rx="3" fill={body} stroke="#2a2620" strokeWidth="2" />
      <rect x="12" y="22" width="20" height="14" fill="#3d3830" />
      <rect x="34" y="22" width="18" height="28" fill={electric ? '#4a9a6a' : '#6b655c'} stroke="#2a2620" strokeWidth="1" />
      <circle
        className="drill-bit"
        cx="22"
        cy="48"
        r="7"
        fill="#8a8478"
        stroke="#1a1612"
        strokeWidth="2"
      />
      <circle cx="22" cy="48" r="3" fill="#1a1612" />
      <g style={{ transform: `rotate(${ROT[dir]}deg)`, transformOrigin: '32px 32px' }}>
        <rect x="44" y="28" width="14" height="8" fill={accent} stroke="#1a1612" strokeWidth="1" />
      </g>
      <rect x="14" y="12" width="12" height="8" fill="#3d3830" stroke="#1a1612" strokeWidth="1" />
      {active && <circle cx="50" cy="14" r="3" fill={accent} className="drill-lamp" />}
      {electric && <path d="M28 8 L32 16 L29 16 L34 26 L30 18 L33 18 Z" fill="#f0e060" />}
    </svg>
  )
}

export function SplitterSprite({ dir }: { dir: Dir }) {
  return (
    <svg
      className="sprite sprite-splitter"
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${ROT[dir]}deg)` }}
      aria-hidden
    >
      <rect x="4" y="16" width="56" height="32" fill="#c4a035" stroke="#1a1612" strokeWidth="2" />
      <rect x="8" y="20" width="20" height="24" fill="#8a7020" />
      <rect x="36" y="20" width="20" height="24" fill="#8a7020" />
      <polygon points="18,32 12,26 12,38" fill="#1a1612" />
      <polygon points="46,32 40,26 40,38" fill="#1a1612" />
      <rect x="28" y="22" width="8" height="20" fill="#e8c84a" />
    </svg>
  )
}

export function InserterSprite({ dir }: { dir: Dir }) {
  return (
    <svg
      className="sprite sprite-inserter"
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${ROT[dir]}deg)` }}
      aria-hidden
    >
      <circle cx="32" cy="32" r="10" fill="#6b655c" stroke="#1a1612" strokeWidth="2" />
      <circle cx="32" cy="32" r="4" fill="#2a2620" />
      <rect x="28" y="8" width="8" height="24" rx="2" fill="#c4a035" stroke="#1a1612" strokeWidth="1" />
      <rect x="24" y="6" width="16" height="8" rx="1" fill="#e8c84a" stroke="#1a1612" strokeWidth="1" />
      <polygon points="32,2 38,10 26,10" fill="#1a1612" />
    </svg>
  )
}

export function FurnaceSprite({ lit }: { lit?: boolean }) {
  return (
    <svg
      className={`sprite sprite-furnace ${lit ? 'is-lit' : ''}`}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <rect x="10" y="14" width="44" height="42" rx="2" fill="#6a5a4a" stroke="#2a2018" strokeWidth="2" />
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
      <rect x="14" y="48" width="36" height="6" fill="#4a3a2a" />
      <rect x="22" y="8" width="8" height="8" fill="#5a4a3a" stroke="#1a1612" strokeWidth="1" />
      <rect x="34" y="8" width="8" height="8" fill="#5a4a3a" stroke="#1a1612" strokeWidth="1" />
      {/* rivets */}
      <circle cx="14" cy="18" r="1.5" fill="#2a2018" />
      <circle cx="50" cy="18" r="1.5" fill="#2a2018" />
      <circle cx="14" cy="50" r="1.5" fill="#2a2018" />
      <circle cx="50" cy="50" r="1.5" fill="#2a2018" />
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

const ITEM_COLORS: Record<ItemId, { fill: string; edge: string }> = {
  ironOre: { fill: '#8B7355', edge: '#5a4a38' },
  copperOre: { fill: '#C4783A', edge: '#8a4a28' },
  coal: { fill: '#2A2A2A', edge: '#111' },
  ironPlate: { fill: '#A8B0BC', edge: '#6a7280' },
  copperPlate: { fill: '#E8913A', edge: '#a06020' },
  gear: { fill: '#9AA3AD', edge: '#5a636c' },
  belt: { fill: '#F0A020', edge: '#8a5a10' },
  inserter: { fill: '#c4a035', edge: '#6a5010' },
  drill: { fill: '#6B5535', edge: '#3d3020' },
  furnace: { fill: '#8A4B1A', edge: '#4a2810' },
  chest: { fill: '#5C6B7A', edge: '#2a3540' },
  assembler: { fill: '#4a6a8a', edge: '#2a4058' },
  fastBelt: { fill: '#E05050', edge: '#8a2020' },
  electricDrill: { fill: '#3D9E5F', edge: '#1a5030' },
  splitter: { fill: '#c4a035', edge: '#6a5010' },
}

export function ItemSprite({ item }: { item: ItemId }) {
  const c = ITEM_COLORS[item]
  if (item === 'gear') {
    return (
      <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="12" fill={c.fill} stroke={c.edge} strokeWidth="2" />
        <circle cx="16" cy="16" r="4" fill="#2a2620" />
        {[0, 45, 90, 135].map((a) => (
          <rect
            key={a}
            x="14"
            y="2"
            width="4"
            height="8"
            fill={c.fill}
            stroke={c.edge}
            strokeWidth="0.5"
            transform={`rotate(${a} 16 16)`}
          />
        ))}
      </svg>
    )
  }
  if (item === 'ironPlate' || item === 'copperPlate') {
    return (
      <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
        <rect x="4" y="8" width="24" height="16" rx="1" fill={c.fill} stroke={c.edge} strokeWidth="2" />
        <rect x="6" y="10" width="20" height="3" fill="rgba(255,255,255,0.25)" />
      </svg>
    )
  }
  return (
    <svg className="sprite sprite-item" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="11" fill={c.fill} stroke={c.edge} strokeWidth="2" />
      <ellipse cx="12" cy="12" rx="4" ry="3" fill="rgba(255,255,255,0.25)" />
    </svg>
  )
}

export function EntitySprite({
  kind,
  dir,
  lit,
  active,
  moving,
  filled,
}: {
  kind: EntityKind
  dir: Dir
  lit?: boolean
  active?: boolean
  moving?: boolean
  filled?: boolean
}) {
  switch (kind) {
    case 'belt':
      return <BeltSprite dir={dir} moving={moving} />
    case 'fastBelt':
      return <BeltSprite dir={dir} moving={moving} fast />
    case 'drill':
      return <DrillSprite dir={dir} active={active} />
    case 'electricDrill':
      return <DrillSprite dir={dir} active={active} electric />
    case 'inserter':
      return <InserterSprite dir={dir} />
    case 'furnace':
      return <FurnaceSprite lit={lit} />
    case 'chest':
      return <ChestSprite filled={filled} />
    case 'assembler':
      return <AssemblerSprite active={active || lit} />
    case 'splitter':
      return <SplitterSprite dir={dir} />
  }
}

export function ToolIcon({ kind }: { kind: EntityKind | 'remove' }) {
  if (kind === 'remove') {
    return (
      <svg className="tool-icon" viewBox="0 0 32 32" aria-hidden>
        <rect x="4" y="4" width="24" height="24" fill="#3d3030" stroke="#b33a2b" strokeWidth="2" />
        <line x1="10" y1="10" x2="22" y2="22" stroke="#b33a2b" strokeWidth="3" />
        <line x1="22" y1="10" x2="10" y2="22" stroke="#b33a2b" strokeWidth="3" />
      </svg>
    )
  }
  return (
    <span className="tool-icon-wrap">
      <EntitySprite kind={kind} dir="E" />
    </span>
  )
}
