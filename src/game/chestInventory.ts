/**
 * Floor chests are the material warehouse (HUD + craft/research spend).
 * Placeable buildings still live in the backpack inventory.
 */
import {
  CHEST_SLOT_COUNT,
  CHEST_STACK_SIZE,
  asItemCount,
  gain,
  spend,
} from './data'
import type { Entity, GameState, Inventory, ItemId } from './types'

/** Materials shown on the factory HUD and spent from chests. */
export const WAREHOUSE_ITEMS: ItemId[] = [
  'ironOre',
  'copperOre',
  'coal',
  'ironPlate',
  'copperPlate',
  'steel',
  'gear',
]

const WAREHOUSE_SET = new Set<ItemId>(WAREHOUSE_ITEMS)

export function isWarehouseItem(id: ItemId): boolean {
  return WAREHOUSE_SET.has(id)
}

/** Combined contents of every chest on the floor. */
export function sumChestStores(
  state: GameState,
): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {}
  for (const e of Object.values(state.entities)) {
    if (e.kind !== 'chest') continue
    for (const [key, value] of Object.entries(e.store)) {
      const n = value ?? 0
      if (n <= 0) continue
      const id = key as ItemId
      out[id] = (out[id] ?? 0) + n
    }
  }
  return out
}

/** HUD amount: chests only for warehouse mats. */
export function warehouseHudAmount(state: GameState, id: ItemId): number {
  if (!isWarehouseItem(id)) return asItemCount(state.inventory[id] ?? 0)
  return asItemCount(sumChestStores(state)[id] ?? 0)
}

/**
 * Spendable amount. Warehouse mats prefer chests, then leftover backpack
 * (migration / withdraw). Buildings always use backpack.
 */
export function stockOf(state: GameState, id: ItemId): number {
  if (isWarehouseItem(id)) {
    return (
      asItemCount(sumChestStores(state)[id] ?? 0) +
      asItemCount(state.inventory[id] ?? 0)
    )
  }
  return asItemCount(state.inventory[id] ?? 0)
}

export function canAffordStock(
  state: GameState,
  cost: Partial<Inventory>,
): boolean {
  return (Object.entries(cost) as [ItemId, number][]).every(
    ([id, n]) => stockOf(state, id) >= asItemCount(n),
  )
}

function takeFromChestStore(
  store: Partial<Record<ItemId, number>>,
  item: ItemId,
  want: number,
): number {
  const have = asItemCount(store[item] ?? 0)
  const take = Math.min(have, want)
  if (take <= 0) return 0
  const left = have - take
  if (left <= 0) delete store[item]
  else store[item] = left
  return take
}

function putInChestStore(
  store: Partial<Record<ItemId, number>>,
  item: ItemId,
  want: number,
): number {
  let left = want
  const have = asItemCount(store[item] ?? 0)
  if (have > 0) {
    const room = Math.max(0, CHEST_STACK_SIZE - have)
    const put = Math.min(left, room)
    if (put > 0) {
      store[item] = have + put
      left -= put
    }
    return want - left
  }
  const used = Object.values(store).filter((n) => (n ?? 0) > 0).length
  if (used >= CHEST_SLOT_COUNT) return 0
  const put = Math.min(left, CHEST_STACK_SIZE)
  if (put <= 0) return 0
  store[item] = put
  return put
}

/** Remove materials from chests first, then backpack. Buildings from backpack only. */
export function spendStock(
  state: GameState,
  cost: Partial<Inventory>,
): GameState {
  if (!canAffordStock(state, cost)) return state

  const entities: Record<string, Entity> = { ...state.entities }
  // Clone chest stores we will mutate.
  for (const [id, e] of Object.entries(state.entities)) {
    if (e.kind === 'chest') {
      entities[id] = { ...e, store: { ...e.store } }
    }
  }
  let inventory = { ...state.inventory }

  for (const [key, raw] of Object.entries(cost) as [ItemId, number][]) {
    let need = asItemCount(raw)
    if (need <= 0) continue

    if (isWarehouseItem(key)) {
      for (const e of Object.values(entities)) {
        if (need <= 0) break
        if (e.kind !== 'chest') continue
        need -= takeFromChestStore(e.store, key, need)
      }
    }

    if (need > 0) {
      inventory = spend(inventory, { [key]: need })
    }
  }

  return { ...state, entities, inventory }
}

/** Refund / deposit: warehouse mats try chests first, overflow backpack. */
export function depositStock(
  state: GameState,
  add: Partial<Inventory>,
  mult = 1,
): GameState {
  const entities: Record<string, Entity> = { ...state.entities }
  for (const [id, e] of Object.entries(state.entities)) {
    if (e.kind === 'chest') {
      entities[id] = { ...e, store: { ...e.store } }
    }
  }
  let inventory = { ...state.inventory }
  const overflow: Partial<Inventory> = {}

  for (const [key, raw] of Object.entries(add) as [ItemId, number][]) {
    let left = asItemCount(Math.round(raw * mult))
    if (left <= 0) continue

    if (isWarehouseItem(key)) {
      for (const e of Object.values(entities)) {
        if (left <= 0) break
        if (e.kind !== 'chest') continue
        left -= putInChestStore(e.store, key, left)
      }
    }

    if (left > 0) {
      overflow[key] = (overflow[key] ?? 0) + left
    }
  }

  if (Object.keys(overflow).length) {
    inventory = gain(inventory, overflow)
  }

  return { ...state, entities, inventory }
}
