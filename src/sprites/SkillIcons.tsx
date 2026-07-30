import type { ReactNode } from 'react'
import type { SkillId } from '../game/types'

const FRAME = {
  outer: '#1a1410',
  rim: '#c9a227',
  rimDark: '#6a5010',
  rimLight: '#f0e0a0',
  inner: '#2a2218',
}

function SkillFrame({
  children,
  bg,
  lit,
  gradId,
}: {
  children: ReactNode
  bg: string
  lit?: boolean
  gradId: string
}) {
  return (
    <svg className="skill-icon-svg" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="45%" stopColor={bg} stopOpacity="1" />
          <stop offset="100%" stopColor="#0a0806" stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id={`${gradId}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={FRAME.rimLight} />
          <stop offset="45%" stopColor={FRAME.rim} />
          <stop offset="100%" stopColor={FRAME.rimDark} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={FRAME.outer} />
      <circle cx="32" cy="32" r="28.5" fill={`url(#${gradId}-rim)`} />
      <circle cx="32" cy="32" r="24.5" fill={FRAME.inner} />
      <circle
        cx="32"
        cy="32"
        r="23"
        fill={`url(#${gradId})`}
        className={lit ? 'skill-icon-lit' : undefined}
      />
      <circle
        cx="32"
        cy="32"
        r="23.2"
        fill="none"
        stroke={FRAME.rimDark}
        strokeWidth="1.2"
        opacity="0.7"
      />
      <path
        d="M14 22 A18 18 0 0 1 42 14"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        opacity="0.18"
        strokeLinecap="round"
      />
      {children}
    </svg>
  )
}

function MiningArt() {
  return (
    <g>
      <path
        d="M18 44 L28 34 L38 38 L46 32 L50 44 Z"
        fill="#6b6358"
        stroke="#2a2218"
        strokeWidth="1"
      />
      <path d="M28 34 L34 40 L38 38" fill="#8a8478" opacity="0.7" />
      <g transform="rotate(-35 32 28)">
        <rect x="30" y="18" width="4" height="26" rx="1" fill="#5a4030" stroke="#2a1810" />
        <path
          d="M18 20 L32 14 L46 20 L40 26 L32 22 L24 26 Z"
          fill="#a8b0bc"
          stroke="#2a2218"
          strokeWidth="1.2"
        />
        <path d="M22 21 L32 17 L42 21" fill="#d0d8e0" opacity="0.5" />
      </g>
      <circle cx="40" cy="30" r="1.5" fill="#f0e060" opacity="0.9" />
    </g>
  )
}

function SmeltingArt() {
  return (
    <g>
      <rect x="20" y="40" width="24" height="6" rx="1" fill="#3a4048" stroke="#1a1612" />
      <path d="M16 34 H48 L44 40 H20 Z" fill="#5c6b7a" stroke="#1a1612" strokeWidth="1" />
      <rect x="28" y="28" width="8" height="8" fill="#4a5560" />
      <g transform="rotate(25 38 22)">
        <rect x="36" y="12" width="3.5" height="18" rx="1" fill="#5a4030" />
        <rect x="30" y="10" width="16" height="8" rx="1" fill="#8a8478" stroke="#2a2218" />
      </g>
      <ellipse cx="32" cy="36" rx="6" ry="3" fill="#ff6a20" opacity="0.85" />
      <ellipse cx="32" cy="35" rx="3" ry="1.5" fill="#ffcc44" opacity="0.9" />
    </g>
  )
}

function LogisticsArt() {
  return (
    <g>
      <rect x="18" y="26" width="20" height="18" rx="1" fill="#8a5a30" stroke="#2a1810" />
      <rect x="18" y="26" width="20" height="5" fill="#a07040" />
      <line x1="28" y1="26" x2="28" y2="44" stroke="#5a3a18" strokeWidth="1.5" />
      <line x1="18" y1="35" x2="38" y2="35" stroke="#5a3a18" strokeWidth="1.5" />
      <path
        d="M36 22 H48 L44 18 M48 22 L44 26"
        fill="none"
        stroke="#f0a020"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="40" y="30" width="10" height="8" rx="1" fill="#f0a020" stroke="#8a5a10" />
      <rect x="41" y="31" width="3" height="6" fill="#8a5a10" opacity="0.5" />
      <rect x="45" y="31" width="3" height="6" fill="#c47a12" />
    </g>
  )
}

function FieldworkArt() {
  return (
    <g>
      <path
        d="M16 42 Q24 36 32 40 T48 36"
        fill="none"
        stroke="#6b5535"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M16 42 Q24 36 32 40 T48 36"
        fill="none"
        stroke="#a08050"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 4"
      />
      <path
        d="M22 28 L34 26 L38 34 L36 40 L20 38 Z"
        fill="#4a3020"
        stroke="#1a1008"
        strokeWidth="1.2"
      />
      <path d="M22 28 L34 26 L33 30 L22 32 Z" fill="#6a4530" />
      <ellipse cx="28" cy="38" rx="8" ry="3" fill="#2a1810" opacity="0.35" />
      <path d="M42 28 Q46 22 48 28 Q46 26 42 28" fill="#4a8a40" />
      <path d="M14 30 Q18 24 20 30 Q18 28 14 30" fill="#3d7a35" />
    </g>
  )
}

const ART: Record<SkillId, { bg: string; Art: () => ReactNode; grad: string }> = {
  mining: { bg: '#5a4a38', Art: MiningArt, grad: 'sk-mining' },
  smelting: { bg: '#6a3a18', Art: SmeltingArt, grad: 'sk-smelting' },
  logistics: { bg: '#5a4010', Art: LogisticsArt, grad: 'sk-logistics' },
  fieldwork: { bg: '#2a4a28', Art: FieldworkArt, grad: 'sk-fieldwork' },
}

export function SkillIcon({
  id,
  level,
  lit,
  size = 'md',
}: {
  id: SkillId
  level?: number
  lit?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const { bg, Art, grad } = ART[id]
  // Unique gradient ids per instance to avoid SVG id collisions when multiple icons render
  const uid = `${grad}-${size}-${level ?? 'x'}-${lit ? '1' : '0'}`
  return (
    <span className={`skill-icon skill-icon-${size} ${lit ? 'is-lit' : ''}`}>
      <SkillFrame bg={bg} lit={lit} gradId={uid}>
        <Art />
      </SkillFrame>
      {level !== undefined && (
        <span className="skill-icon-level" aria-hidden>
          {level}
        </span>
      )}
    </span>
  )
}
