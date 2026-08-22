/**
 * Export payload round-trips, and a factory snapshot stays short.
 */
import { offerSaveFile, messageForOffer } from '../src/cloud/saveExport.ts'
import { exportSavePayload, parseImportedSave } from '../src/cloud/localTransfer.ts'
import { factorySnapshot } from '../src/game/factorySnapshot.ts'
import { createEntity } from '../src/game/grid.ts'
import { createInitialState } from '../src/game/logic.ts'
import { footprintCells, idx } from '../src/game/data.ts'
import type { Entity, GameState } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

function stamp(state: GameState, ent: Entity, cells: { x: number; y: number }[]): GameState {
  const tiles = state.tiles.map((t) => ({ ...t }))
  for (const c of cells) tiles[idx(c.x, c.y)].entityId = ent.id
  return { ...state, tiles, entities: { ...state.entities, [ent.id]: ent } }
}

{
  let state = createInitialState()
  const drill = createEntity('drill', 3, 2, 'E')
  drill.store = { ironOre: 2 }
  state = stamp(state, drill, footprintCells('drill', 3, 2))
  const belt = createEntity('belt', 5, 2, 'E')
  belt.cargo = { item: 'ironOre', progress: 0.4 }
  state = stamp(state, belt, [{ x: 5, y: 2 }])

  const raw = exportSavePayload(state)
  assert(!raw.includes('\n  '), 'export should not pretty-print (phones hitch on a 2MB indent)')
  const imported = parseImportedSave(raw)
  assert(imported.entities[drill.id]?.store.ironOre === 2, 'round-trip should keep drill ore')
  assert(imported.entities[belt.id]?.cargo?.item === 'ironOre', 'round-trip should keep belt cargo')

  const snap = factorySnapshot(state)
  assert(snap.includes('drill (3,2)'), 'snapshot should name the drill')
  assert(snap.includes('belts 1 carrying 1'), 'snapshot should count the loaded belt')
  assert(snap.length < 8000, `snapshot should stay paste-sized, got ${snap.length}`)
}

{
  const msg = messageForOffer({ ok: true, via: 'download' })
  assert(msg.includes('Copy save'), 'download message should point at Copy save')
  const cancelled = messageForOffer({ ok: false, message: 'Export cancelled.' })
  assert(cancelled === 'Export cancelled.', 'offer errors should pass through')
}

{
  const origCreate = globalThis.document
  assert(typeof offerSaveFile === 'function', 'offerSaveFile is exported')
  void origCreate
}

console.log('verify-export-save: ok')
