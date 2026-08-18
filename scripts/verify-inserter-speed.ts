/**
 * Chest → inserter → chest throughput at logistics 0.
 * Early-game swing is 1.2s so the arm is readable (was 0.45s).
 */
import { INSERTER_COOLDOWN, idx } from '../src/game/data.ts'
import { createEntity } from '../src/game/grid.ts'
import { createInitialState } from '../src/game/logic.ts'
import { simTick } from '../src/game/sim.ts'

function countTransfers(seconds: number, step = 0.2): number {
  let state = createInitialState()
  const src = createEntity('chest', 2, 4, 'E')
  const arm = createEntity('inserter', 3, 4, 'E')
  const dest = createEntity('chest', 4, 4, 'E')
  src.store = { ironOre: 40 }
  state = {
    ...state,
    entities: {
      [src.id]: src,
      [arm.id]: arm,
      [dest.id]: dest,
    },
    tiles: state.tiles.map((t, i) => {
      if (i === idx(2, 4)) return { ...t, entityId: src.id }
      if (i === idx(3, 4)) return { ...t, entityId: arm.id }
      if (i === idx(4, 4)) return { ...t, entityId: dest.id }
      return t
    }),
  }

  let t = 0
  while (t < seconds) {
    state = simTick(state, step)
    t += step
  }
  return state.entities[dest.id].store.ironOre ?? 0
}

const seconds = 6
const moved = countTransfers(seconds)
const minExpected = Math.floor(seconds / INSERTER_COOLDOWN)
const maxExpected = minExpected + 1
const oldFastRate = seconds / 0.45 + 1

if (INSERTER_COOLDOWN < 1) {
  throw new Error(
    `INSERTER_COOLDOWN is ${INSERTER_COOLDOWN}s; early game should be >= 1s`,
  )
}
if (moved < minExpected || moved > maxExpected) {
  throw new Error(
    `Expected ${minExpected}-${maxExpected} transfers in ${seconds}s, got ${moved}`,
  )
}
if (moved >= oldFastRate - 2) {
  throw new Error(
    `Still near the old 0.45s pace (${moved} vs ~${oldFastRate.toFixed(0)})`,
  )
}

console.log(
  `OK: ${moved} items in ${seconds}s at ${INSERTER_COOLDOWN}s cooldown (was ~${Math.floor(oldFastRate)})`,
)
