import {
  ASSEMBLER_PLATES_PER_GEAR,
  CHEST_SLOT_COUNT,
  CHEST_STACK_SIZE,
  FURNACE_COAL_PER_SMELT,
  drillDropCells,
  fuelUnits,
  idx,
  inBounds,
  isBeltKind,
  isDrillKind,
  isDeconstructing,
  isFurnaceKind,
  mineCells,
  rockVariant,
  sizeOf,
  treeVariant,
} from './data'
import { MACHINE_CAP } from './sim'
import {
  drillHasRemotePower,
  entityOnPoweredFloor,
  powerNet,
} from './power'
import type { Entity, GameState, Tile } from './types'

/** True when the floor tile needs a status CSS class (skip trees, belts, grass). */
export function needsFloorStatus(ent: Entity | null | undefined): boolean {
  if (!ent) return false
  if (ent.ghost || ent.marked) return true
  if (ent.kind === 'tree' || ent.kind === 'rock') return false
  if (isBeltKind(ent.kind) || ent.kind === 'undergroundBelt') return false
  if (ent.kind === 'generator' || ent.kind === 'roboport') return false
  return true
}

export type MachineStatusTone = 'ok' | 'work' | 'warn' | 'idle'

export interface MachineStatus {
  label: string
  tone: MachineStatusTone
  /** Floor CSS class when the machine needs attention */
  floorClass?: 'is-needs-fuel' | 'is-waiting' | 'is-blocked'
}

export function machineStatus(
  ent: Entity,
  _tile: Tile | undefined,
  _state: GameState,
  net = powerNet(_state),
): MachineStatus {

  if (ent.ghost) {
    const pct = Math.round(Math.min(1, Math.max(0, ent.buildProgress ?? 0)) * 100)
    return {
      label: pct > 0 ? `Under construction ${pct}%` : 'Awaiting construction drone',
      tone: pct > 0 ? 'work' : 'idle',
      floorClass: 'is-waiting',
    }
  }

  if (isDeconstructing(ent)) {
    const pct = Math.round(Math.min(1, Math.max(0, ent.buildProgress ?? 0)) * 100)
    return {
      label: pct > 0 ? `Drone demolishing ${pct}%` : 'Marked for demolition - waiting for a drone',
      tone: pct > 0 ? 'work' : 'idle',
      floorClass: 'is-waiting',
    }
  }

  if (ent.kind === 'tree') {
    const def = treeVariant(ent.variant)
    if (ent.marked) {
      const pct = Math.round(Math.min(1, Math.max(0, ent.buildProgress ?? 0)) * 100)
      return {
        label: pct > 0 ? `Drone chopping ${def.label.toLowerCase()} ${pct}%` : `Marked ${def.label.toLowerCase()} - waiting for a drone`,
        tone: pct > 0 ? 'work' : 'idle',
        floorClass: 'is-waiting',
      }
    }
    return {
      label: `${def.label} - Demolish to mark. ${def.cutSeconds}s, ${def.wood} wood`,
      tone: 'idle',
    }
  }

  if (ent.kind === 'rock') {
    const def = rockVariant(ent.variant)
    const loot = def.drops
      .filter((d) => d.chance == null)
      .map((d) => `${d.amount} ${d.item === 'ironOre' ? 'iron' : d.item === 'copperOre' ? 'copper' : d.item}`)
      .join(', ')
    if (ent.marked) {
      const pct = Math.round(Math.min(1, Math.max(0, ent.buildProgress ?? 0)) * 100)
      return {
        label: pct > 0 ? `Drone excavating ${def.label.toLowerCase()} ${pct}%` : `Marked ${def.label.toLowerCase()} - waiting for a drone`,
        tone: pct > 0 ? 'work' : 'idle',
        floorClass: 'is-waiting',
      }
    }
    return {
      label: `${def.label} - Demolish to excavate. ${def.mineSeconds}s, ${loot}`,
      tone: 'idle',
    }
  }

  if (ent.kind === 'roboport') {
    const drones = _state.drones.filter((d) => d.homeId === ent.id)
    const busy = drones.filter((d) => d.state !== 'idle').length
    return {
      label:
        drones.length === 0
          ? 'Drone hub'
          : `Drone hub · ${busy}/${drones.length} out`,
      tone: busy > 0 ? 'work' : 'ok',
    }
  }

  if (ent.kind === 'generator') {
    return { label: 'Power generator - steps charge the grid', tone: 'ok' }
  }

  if (isDrillKind(ent.kind)) {
    const hasOre = mineCells(ent.x, ent.y).some((c) => {
      if (!inBounds(c.x, c.y)) return false
      const t = _state.tiles[idx(c.x, c.y)]
      return !!t.ore && (t.amount === null || t.amount > 0)
    })
    if (!hasOre) return { label: 'No ore in dig area', tone: 'idle', floorClass: 'is-waiting' }
    if (!drillHasRemotePower(ent, _state, net)) {
      return {
        label: 'No power - generator or powered floor within 5 tiles',
        tone: 'warn',
        floorClass: 'is-needs-fuel',
      }
    }
    if (_state.power <= 0) {
      return { label: 'No power - walk to charge the grid', tone: 'warn', floorClass: 'is-needs-fuel' }
    }
    const cap = MACHINE_CAP[ent.kind] ?? 5
    const oreHeld = Object.entries(ent.store)
      .filter(([k]) => k !== 'coal')
      .reduce((s, [, n]) => s + (n ?? 0), 0)
    let dumpGhost = false
    let dumpReady = false
    for (const o of drillDropCells(ent.kind, ent.x, ent.y, ent.dir, ent.flip === true)) {
      if (!inBounds(o.x, o.y, _state.width, _state.height)) continue
      const t = _state.tiles[idx(o.x, o.y)]
      let cand = t?.entityId ? _state.entities[t.entityId] : null
      if (!cand) {
        for (const e of Object.values(_state.entities)) {
          if (e.kind === 'tree' || e.kind === 'rock') continue
          const { w, h } = sizeOf(e.kind)
          if (o.x >= e.x && o.x < e.x + w && o.y >= e.y && o.y < e.y + h) {
            cand = e
            break
          }
        }
      }
      if (!cand || cand.id === ent.id) continue
      const sink =
        isBeltKind(cand.kind) ||
        cand.kind === 'chest' ||
        isFurnaceKind(cand.kind) ||
        cand.kind === 'splitter' ||
        cand.kind === 'undergroundBelt'
      if (!sink) continue
      if (cand.ghost) {
        dumpGhost = true
        continue
      }
      dumpReady = true
      break
    }
    if (!dumpReady) {
      return {
        label: dumpGhost
          ? 'Belt in front is still a blueprint'
          : 'No belt in front of the orange port (Flip picks the other square)',
        tone: 'warn',
        floorClass: 'is-blocked',
      }
    }
    if (oreHeld >= cap - 0.01) {
      return { label: 'Output full - clear the belt', tone: 'warn', floorClass: 'is-blocked' }
    }
    return {
      label:
        ent.kind === 'electricDrill'
          ? 'Mining (electric) - spends stored power'
          : 'Mining (powered) - spends stored power',
      tone: 'work',
    }
  }

  if (isFurnaceKind(ent.kind)) {
    if (ent.smelting) return { label: 'Smelting', tone: 'work' }
    const coalNeed = FURNACE_COAL_PER_SMELT
    const hasOre = (ent.store.ironOre ?? 0) >= 1 || (ent.store.copperOre ?? 0) >= 1
    const hasFuel = fuelUnits(ent.store) >= coalNeed
    const plates =
      (ent.store.ironPlate ?? 0) + (ent.store.copperPlate ?? 0) + (ent.store.steel ?? 0)
    const cap = MACHINE_CAP[ent.kind] ?? 12
    if (plates >= cap) {
      return { label: 'Output full', tone: 'warn', floorClass: 'is-blocked' }
    }
    if (!hasOre && !hasFuel) {
      return { label: 'Needs ore + fuel', tone: 'warn', floorClass: 'is-waiting' }
    }
    if (!hasOre) return { label: 'Waiting for ore', tone: 'idle', floorClass: 'is-waiting' }
    if (!hasFuel) {
      return {
        label: 'Needs fuel (coal or wood)',
        tone: 'warn',
        floorClass: 'is-needs-fuel',
      }
    }
    return { label: 'Ready', tone: 'ok' }
  }

  if (ent.kind === 'assembler') {
    if (!entityOnPoweredFloor(ent, _state, net)) {
      return {
        label: 'No power - pave with Foundation',
        tone: 'warn',
        floorClass: 'is-needs-fuel',
      }
    }
    if (_state.power <= 0) {
      return { label: 'No power - walk to charge the grid', tone: 'warn', floorClass: 'is-needs-fuel' }
    }
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

  if (ent.kind === 'belt' || ent.kind === 'fastBelt' || ent.kind === 'undergroundBelt') {
    return {
      label: ent.cargo ? `Carrying ${ent.cargo.item}` : 'Empty',
      tone: ent.cargo ? 'work' : 'idle',
    }
  }

  if (ent.kind === 'splitter') {
    if (!entityOnPoweredFloor(ent, _state, net)) {
      return {
        label: 'No power - pave with Foundation',
        tone: 'warn',
        floorClass: 'is-needs-fuel',
      }
    }
    if (_state.power <= 0) {
      return { label: 'No power - walk to charge the grid', tone: 'warn', floorClass: 'is-needs-fuel' }
    }
    return {
      label: ent.cargo ? `Carrying ${ent.cargo.item}` : 'Empty',
      tone: ent.cargo ? 'work' : 'idle',
    }
  }

  if (ent.kind === 'inserter' || ent.kind === 'longInserter') {
    if (!entityOnPoweredFloor(ent, _state, net)) {
      return {
        label: 'No power - pave with Foundation',
        tone: 'warn',
        floorClass: 'is-needs-fuel',
      }
    }
    if (_state.power <= 0) {
      return { label: 'No power - walk to charge the grid', tone: 'warn', floorClass: 'is-needs-fuel' }
    }
    return {
      label: ent.progress > 0 ? 'Transferring' : 'Ready',
      tone: ent.progress > 0 ? 'work' : 'ok',
    }
  }

  return { label: 'Online', tone: 'ok' }
}
