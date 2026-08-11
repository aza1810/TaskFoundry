import {
  ASSEMBLER_PLATES_PER_GEAR,
  CHEST_SLOT_COUNT,
  CHEST_STACK_SIZE,
  FURNACE_COAL_PER_SMELT,
  isDrillKind,
  isFurnaceKind,
} from './data'
import { MACHINE_CAP } from './sim'
import type { Entity, GameState, Tile } from './types'

export type MachineStatusTone = 'ok' | 'work' | 'warn' | 'idle'

export interface MachineStatus {
  label: string
  tone: MachineStatusTone
  /** Floor CSS class when the machine needs attention */
  floorClass?: 'is-needs-fuel' | 'is-waiting' | 'is-blocked'
}

export function machineStatus(
  ent: Entity,
  tile: Tile | undefined,
  _state: GameState,
): MachineStatus {
  if (isDrillKind(ent.kind)) {
    if (!tile?.ore) return { label: 'No ore under drill', tone: 'idle', floorClass: 'is-waiting' }
    if (ent.kind === 'drill' && (ent.store.coal ?? 0) < 0.25) {
      return { label: 'Needs coal', tone: 'warn', floorClass: 'is-needs-fuel' }
    }
    const cap = MACHINE_CAP[ent.kind] ?? 5
    const oreHeld = Object.entries(ent.store)
      .filter(([k]) => k !== 'coal')
      .reduce((s, [, n]) => s + (n ?? 0), 0)
    if (oreHeld >= cap - 0.01) {
      return { label: 'Output full - clear the belt', tone: 'warn', floorClass: 'is-blocked' }
    }
    return {
      label: ent.kind === 'electricDrill' ? 'Mining (steps)' : 'Mining (steps + coal)',
      tone: 'work',
    }
  }

  if (isFurnaceKind(ent.kind)) {
    if (ent.smelting) return { label: 'Smelting', tone: 'work' }
    const coalNeed = FURNACE_COAL_PER_SMELT
    const hasOre = (ent.store.ironOre ?? 0) >= 1 || (ent.store.copperOre ?? 0) >= 1
    const hasCoal = (ent.store.coal ?? 0) >= coalNeed
    const plates =
      (ent.store.ironPlate ?? 0) + (ent.store.copperPlate ?? 0) + (ent.store.steel ?? 0)
    const cap = MACHINE_CAP[ent.kind] ?? 12
    if (plates >= cap) {
      return { label: 'Output full', tone: 'warn', floorClass: 'is-blocked' }
    }
    if (!hasOre && !hasCoal) {
      return { label: 'Needs ore + coal', tone: 'warn', floorClass: 'is-waiting' }
    }
    if (!hasOre) return { label: 'Waiting for ore', tone: 'idle', floorClass: 'is-waiting' }
    if (!hasCoal) {
      return {
        label: 'Needs coal (fuel)',
        tone: 'warn',
        floorClass: 'is-needs-fuel',
      }
    }
    return { label: 'Ready', tone: 'ok' }
  }

  if (ent.kind === 'assembler') {
    if (ent.smelting) return { label: 'Assembling gears', tone: 'work' }
    const plates = ent.store.ironPlate ?? 0
    const gears = ent.store.gear ?? 0
    const cap = MACHINE_CAP.assembler ?? 10
    if (gears >= cap) {
      return { label: 'Output full', tone: 'warn', floorClass: 'is-blocked' }
    }
    if (plates < ASSEMBLER_PLATES_PER_GEAR) {
      return { label: 'Waiting for iron plates', tone: 'idle', floorClass: 'is-waiting' }
    }
    return { label: 'Ready', tone: 'ok' }
  }

  if (ent.kind === 'chest') {
    const slots = Object.values(ent.store).filter((v) => (v ?? 0) > 0).length
    const n = Object.values(ent.store).reduce((s, v) => s + (v ?? 0), 0)
    if (n <= 0) {
      return { label: `Empty · ${CHEST_SLOT_COUNT} slots`, tone: 'idle' }
    }
    const stackFull = Object.values(ent.store).every(
      (v) => (v ?? 0) <= 0 || (v ?? 0) >= CHEST_STACK_SIZE,
    )
    if (slots >= CHEST_SLOT_COUNT && stackFull) {
      return { label: 'Full', tone: 'warn', floorClass: 'is-blocked' }
    }
    return {
      label: `${Math.floor(n)} items · ${slots}/${CHEST_SLOT_COUNT} slots`,
      tone: 'ok',
    }
  }

  if (
    ent.kind === 'belt' ||
    ent.kind === 'fastBelt' ||
    ent.kind === 'splitter' ||
    ent.kind === 'undergroundBelt'
  ) {
    return {
      label: ent.cargo ? `Carrying ${ent.cargo.item}` : 'Empty',
      tone: ent.cargo ? 'work' : 'idle',
    }
  }

  if (ent.kind === 'inserter' || ent.kind === 'longInserter') {
    return {
      label: ent.progress > 0 ? 'Transferring' : 'Ready',
      tone: ent.progress > 0 ? 'work' : 'ok',
    }
  }

  return { label: 'Online', tone: 'ok' }
}
