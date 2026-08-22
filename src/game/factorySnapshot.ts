import { idx, isBeltKind, isDrillKind } from './data'
import { machineStatus } from './machineStatus'
import { powerCapacity, powerDemand } from './power'
import type { Entity, EntityKind, GameState } from './types'

function countKinds(ents: Entity[]): Partial<Record<EntityKind, number>> {
  const counts: Partial<Record<EntityKind, number>> = {}
  for (const e of ents) {
    counts[e.kind] = (counts[e.kind] ?? 0) + 1
  }
  return counts
}

function storeSummary(store: Entity['store']): string {
  const parts: string[] = []
  for (const [item, n] of Object.entries(store)) {
    if ((n ?? 0) > 0) parts.push(`${item}:${n}`)
  }
  return parts.length ? parts.join(',') : 'empty'
}

/** Short factory report that is small enough to paste into chat. */
export function factorySnapshot(state: GameState): string {
  const ents = Object.values(state.entities)
  const built = ents.filter((e) => !e.ghost)
  const ghosts = ents.length - built.length
  const counts = countKinds(built)
  let foundations = 0
  let oreTiles = 0
  for (const t of state.tiles) {
    if (t.foundation) foundations += 1
    if (t.ore) oreTiles += 1
  }

  const drills = built.filter((e) => isDrillKind(e.kind))
  const drillLines = drills.slice(0, 24).map((d) => {
    const tile = state.tiles[idx(d.x, d.y)]
    const status = machineStatus(d, tile, state)
    const cargo = d.cargo ? ` cargo=${d.cargo.item}` : ''
    return `- ${d.kind} (${d.x},${d.y}) ${d.dir}${d.flip ? ' flip' : ''} store=${storeSummary(d.store)}${cargo} :: ${status.label}`
  })

  const belts = built.filter(
    (e) => isBeltKind(e.kind) || e.kind === 'undergroundBelt',
  )
  const beltsWithCargo = belts.filter((e) => e.cargo).length
  const beltOnFoundation = belts.filter((e) => {
    const t = state.tiles[idx(e.x, e.y)]
    return t?.foundation === true
  }).length

  const lines = [
    `Task Foundry snapshot v${state.version} ${state.playerName || 'operator'}`,
    `power ${Math.round(state.power)}/${powerCapacity(state)} demand ${powerDemand(state).toFixed(1)} steps ${state.stepsToday}`,
    `tiles ${state.tiles.length} foundation ${foundations} ore ${oreTiles}`,
    `entities ${built.length} ghosts ${ghosts}`,
    `counts ${JSON.stringify(counts)}`,
    `belts ${belts.length} carrying ${beltsWithCargo} onFoundation ${beltOnFoundation}`,
    `drills ${drills.length}${drills.length > 24 ? ' (first 24)' : ''}`,
    ...drillLines,
  ]
  return lines.join('\n')
}
