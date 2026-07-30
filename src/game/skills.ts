import type { Entity, GameState, SkillId, SkillState, SkillsState } from './types'

export const MAX_SKILL_LEVEL = 5

export const SKILL_IDS: SkillId[] = [
  'mining',
  'smelting',
  'logistics',
  'fieldwork',
]

export interface SkillPerk {
  level: number
  label: string
}

export interface SkillDef {
  id: SkillId
  name: string
  detail: string
  color: string
  perks: SkillPerk[]
}

/** XP required to go from `level` → `level + 1` (level is current, 0–4). */
export function skillXpForLevel(level: number): number {
  return Math.floor(35 * Math.pow(1.55, Math.max(0, level)))
}

export const SKILL_DEFS: Record<SkillId, SkillDef> = {
  mining: {
    id: 'mining',
    name: 'Mining',
    detail: 'Trained by walking while drills are working the patches.',
    color: '#c4a070',
    perks: [
      { level: 1, label: '+10% ore per step cycle' },
      { level: 2, label: '+20% ore per step cycle' },
      { level: 3, label: '+35% ore per step cycle' },
      { level: 4, label: 'Burner drills use 15% less coal' },
      { level: 5, label: '+60% ore · electric drills +1 yield' },
    ],
  },
  smelting: {
    id: 'smelting',
    name: 'Smelting',
    detail: 'Trained by walking while furnaces are lit.',
    color: '#e8913a',
    perks: [
      { level: 1, label: 'Furnaces 10% faster' },
      { level: 2, label: 'Furnaces 20% faster' },
      { level: 3, label: '15% less coal per smelt' },
      { level: 4, label: 'Furnaces 35% faster' },
      { level: 5, label: 'Furnaces 60% faster · 25% less coal' },
    ],
  },
  logistics: {
    id: 'logistics',
    name: 'Logistics',
    detail: 'Trained by walking while belts and inserters are moving items.',
    color: '#f0a020',
    perks: [
      { level: 1, label: 'Belts 8% faster' },
      { level: 2, label: 'Inserters 10% quicker' },
      { level: 3, label: 'Belts 20% faster' },
      { level: 4, label: 'Underground belt range +1' },
      { level: 5, label: 'Belts 35% · inserters 25% · UG +2' },
    ],
  },
  fieldwork: {
    id: 'fieldwork',
    name: 'Fieldwork',
    detail: 'Trained by every step — even with an empty factory floor.',
    color: '#7dff9a',
    perks: [
      { level: 1, label: 'Habit rewards +10%' },
      { level: 2, label: '+25% operator XP from steps' },
      { level: 3, label: 'Habit rewards +25%' },
      { level: 4, label: 'Skill XP from steps +15%' },
      { level: 5, label: 'Habit rewards +45% · step XP +30%' },
    ],
  },
}

export function emptySkills(): SkillsState {
  return {
    mining: { xp: 0, level: 0 },
    smelting: { xp: 0, level: 0 },
    logistics: { xp: 0, level: 0 },
    fieldwork: { xp: 0, level: 0 },
  }
}

export function normalizeSkills(raw?: Partial<SkillsState> | null): SkillsState {
  const base = emptySkills()
  if (!raw) return base
  for (const id of SKILL_IDS) {
    const s = raw[id]
    if (!s) continue
    base[id] = {
      xp: Math.max(0, s.xp ?? 0),
      level: Math.max(0, Math.min(MAX_SKILL_LEVEL, s.level ?? 0)),
    }
  }
  return base
}

export interface SkillBonuses {
  mineYieldMult: number
  electricYieldBonus: number
  drillCoalSave: number
  furnaceSpeedMult: number
  furnaceCoalSave: number
  beltSpeedMult: number
  inserterSpeedMult: number
  ugBonus: number
  habitRewardMult: number
  stepOperatorXpMult: number
  stepSkillXpMult: number
}

export function skillBonuses(skills: SkillsState): SkillBonuses {
  const m = skills.mining.level
  const s = skills.smelting.level
  const l = skills.logistics.level
  const f = skills.fieldwork.level

  let mineYieldMult = 1
  if (m >= 1) mineYieldMult = 1.1
  if (m >= 2) mineYieldMult = 1.2
  if (m >= 3) mineYieldMult = 1.35
  if (m >= 5) mineYieldMult = 1.6

  let furnaceSpeedMult = 1
  if (s >= 1) furnaceSpeedMult = 1.1
  if (s >= 2) furnaceSpeedMult = 1.2
  if (s >= 4) furnaceSpeedMult = 1.35
  if (s >= 5) furnaceSpeedMult = 1.6

  let beltSpeedMult = 1
  if (l >= 1) beltSpeedMult = 1.08
  if (l >= 3) beltSpeedMult = 1.2
  if (l >= 5) beltSpeedMult = 1.35

  let inserterSpeedMult = 1
  if (l >= 2) inserterSpeedMult = 1.1
  if (l >= 5) inserterSpeedMult = 1.25

  let ugBonus = 0
  if (l >= 4) ugBonus = 1
  if (l >= 5) ugBonus = 2

  let habitRewardMult = 1
  if (f >= 1) habitRewardMult = 1.1
  if (f >= 3) habitRewardMult = 1.25
  if (f >= 5) habitRewardMult = 1.45

  let stepOperatorXpMult = 1
  if (f >= 2) stepOperatorXpMult = 1.25

  let stepSkillXpMult = 1
  if (f >= 4) stepSkillXpMult = 1.15
  if (f >= 5) stepSkillXpMult = 1.3

  return {
    mineYieldMult,
    electricYieldBonus: m >= 5 ? 1 : 0,
    drillCoalSave: m >= 4 ? 0.15 : 0,
    furnaceSpeedMult,
    furnaceCoalSave: s >= 5 ? 0.25 : s >= 3 ? 0.15 : 0,
    beltSpeedMult,
    inserterSpeedMult,
    ugBonus,
    habitRewardMult,
    stepOperatorXpMult,
    stepSkillXpMult,
  }
}

function addSkillXpOne(
  skill: SkillState,
  amount: number,
): { skill: SkillState; leveled: number } {
  if (amount <= 0 || skill.level >= MAX_SKILL_LEVEL) {
    return { skill, leveled: 0 }
  }
  let { xp, level } = skill
  xp += amount
  let leveled = 0
  while (level < MAX_SKILL_LEVEL) {
    const need = skillXpForLevel(level)
    if (xp < need) break
    xp -= need
    level += 1
    leveled += 1
  }
  if (level >= MAX_SKILL_LEVEL) xp = 0
  return { skill: { xp, level }, leveled }
}

export function grantSkillXp(
  skills: SkillsState,
  gains: Partial<Record<SkillId, number>>,
): { skills: SkillsState; leveled: SkillId[] } {
  const next = { ...skills }
  const leveled: SkillId[] = []
  for (const id of SKILL_IDS) {
    const amt = gains[id] ?? 0
    if (amt <= 0) continue
    const result = addSkillXpOne(next[id], amt)
    next[id] = result.skill
    for (let i = 0; i < result.leveled; i++) leveled.push(id)
  }
  return { skills: next, leveled }
}

/** Route step XP into skills based on what the factory is doing. */
export function stepSkillGains(
  state: GameState,
  steps: number,
): Partial<Record<SkillId, number>> {
  if (steps <= 0) return {}
  const ents = Object.values(state.entities)
  const drills = ents.filter(
    (e) => e.kind === 'drill' || e.kind === 'electricDrill',
  ).length
  const furnaces = ents.filter(
    (e) => e.kind === 'furnace' || e.kind === 'steelFurnace',
  ).length
  const logistics = ents.filter(
    (e) =>
      e.kind === 'belt' ||
      e.kind === 'fastBelt' ||
      e.kind === 'undergroundBelt' ||
      e.kind === 'inserter' ||
      e.kind === 'splitter',
  ).length

  const bonuses = skillBonuses(state.skills)
  const mult = bonuses.stepSkillXpMult

  const gains: Partial<Record<SkillId, number>> = {
    fieldwork: Math.max(1, Math.floor(steps * 1 * mult)),
  }

  if (drills > 0) {
    gains.mining = Math.floor(steps * (0.55 + Math.min(0.45, drills * 0.08)) * mult)
  }
  if (furnaces > 0) {
    gains.smelting = Math.floor(
      steps * (0.45 + Math.min(0.4, furnaces * 0.1)) * mult,
    )
  }
  if (logistics > 0) {
    gains.logistics = Math.floor(
      steps * (0.4 + Math.min(0.4, logistics * 0.03)) * mult,
    )
  }

  return gains
}

export function nextPerkLabel(id: SkillId, level: number): string | null {
  const def = SKILL_DEFS[id]
  const next = def.perks.find((p) => p.level === level + 1)
  return next?.label ?? null
}

export function currentPerkLabels(id: SkillId, level: number): string[] {
  return SKILL_DEFS[id].perks.filter((p) => p.level <= level).map((p) => p.label)
}

export function countActiveLine(entities: Record<string, Entity>): {
  drills: number
  furnaces: number
  logistics: number
} {
  const ents = Object.values(entities)
  return {
    drills: ents.filter((e) => e.kind === 'drill' || e.kind === 'electricDrill')
      .length,
    furnaces: ents.filter(
      (e) => e.kind === 'furnace' || e.kind === 'steelFurnace',
    ).length,
    logistics: ents.filter(
      (e) =>
        e.kind === 'belt' ||
        e.kind === 'fastBelt' ||
        e.kind === 'undergroundBelt' ||
        e.kind === 'inserter' ||
        e.kind === 'splitter',
    ).length,
  }
}
