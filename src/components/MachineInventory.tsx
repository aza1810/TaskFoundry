import {
  ASSEMBLER_PLATES_PER_GEAR,
  ASSEMBLER_SLOT_CAP,
  CHEST_SLOT_COUNT,
  CHEST_STACK_SIZE,
  FURNACE_COAL_PER_SMELT,
  FURNACE_FUEL_CAP,
  FURNACE_SLOT_CAP,
  ITEM_META,
  SMELT_MAP,
  formatNum,
  isFurnaceKind,
} from '../game/data'
import type { Entity, ItemId, OreId } from '../game/types'
import { ItemSprite } from '../sprites/Sprites'

function Slot({
  item,
  amount,
  cap,
  label,
  empty,
}: {
  item: ItemId | null
  amount: number
  cap: number
  label: string
  empty?: boolean
}) {
  const n = Math.floor(amount)
  return (
    <div
      className={`machine-slot ${empty || n <= 0 ? 'is-empty' : ''} ${item ? '' : 'is-ghost'}`}
      title={item ? `${ITEM_META[item].label}: ${n} / ${cap}` : label}
    >
      <span className="machine-slot-label">{label}</span>
      <span className="machine-slot-icon" aria-hidden>
        {item ? <ItemSprite item={item} /> : <span className="machine-slot-placeholder">?</span>}
      </span>
      <span className="machine-slot-amount">
        {item ? (
          <>
            {formatNum(n)}
            <span className="machine-slot-cap">/{cap}</span>
          </>
        ) : (
          '-'
        )}
      </span>
    </div>
  )
}

function ProgressBar({
  progress,
  active,
  label,
}: {
  progress: number
  active: boolean
  label: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <div className={`machine-progress ${active ? 'is-active' : ''}`}>
      <div className="machine-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="machine-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="machine-progress-label">
        {active ? `${label} ${pct}%` : 'Idle'}
      </span>
    </div>
  )
}

function Arrow() {
  return (
    <span className="machine-flow-arrow" aria-hidden>
      →
    </span>
  )
}

function furnaceSlots(ent: Entity) {
  const iron = ent.store.ironOre ?? 0
  const copper = ent.store.copperOre ?? 0
  const coal = ent.store.coal ?? 0
  const ironPlate = ent.store.ironPlate ?? 0
  const copperPlate = ent.store.copperPlate ?? 0
  const steel = ent.store.steel ?? 0

  // Prefer the ore currently smelting, else whichever ore is present.
  let inputItem: ItemId | null = null
  let inputAmount = 0
  if (ent.smelting === 'ironOre' || (iron >= 1 && iron >= copper)) {
    inputItem = 'ironOre'
    inputAmount = iron
  } else if (ent.smelting === 'copperOre' || copper >= 1) {
    inputItem = 'copperOre'
    inputAmount = copper
  } else if (iron > 0) {
    inputItem = 'ironOre'
    inputAmount = iron
  } else if (copper > 0) {
    inputItem = 'copperOre'
    inputAmount = copper
  }

  let outputItem: ItemId | null = null
  let outputAmount = 0
  if (ent.smelting) {
    outputItem = SMELT_MAP[ent.smelting as OreId]
    if (outputItem === 'ironPlate') outputAmount = ironPlate
    else if (outputItem === 'copperPlate') outputAmount = copperPlate
    else outputAmount = steel
  } else if (ironPlate >= copperPlate && ironPlate >= steel && ironPlate > 0) {
    outputItem = 'ironPlate'
    outputAmount = ironPlate
  } else if (copperPlate >= steel && copperPlate > 0) {
    outputItem = 'copperPlate'
    outputAmount = copperPlate
  } else if (steel > 0) {
    outputItem = 'steel'
    outputAmount = steel
  } else {
    outputItem = inputItem ? SMELT_MAP[inputItem as OreId] : 'ironPlate'
    outputAmount = 0
  }

  const working = Boolean(ent.smelting)
  return (
    <div className="machine-inventory">
      <div className="machine-flow" aria-label="Furnace inventory">
        <Slot
          item={inputItem}
          amount={inputAmount}
          cap={FURNACE_SLOT_CAP}
          label="Ore"
          empty={!inputItem || inputAmount <= 0}
        />
        <Slot
          item="coal"
          amount={coal}
          cap={FURNACE_FUEL_CAP}
          label="Fuel"
          empty={coal < FURNACE_COAL_PER_SMELT}
        />
        <Arrow />
        <Slot
          item={outputItem}
          amount={outputAmount}
          cap={FURNACE_SLOT_CAP}
          label="Result"
          empty={outputAmount <= 0}
        />
      </div>
      <ProgressBar
        progress={working ? ent.progress : 0}
        active={working}
        label="Smelting"
      />
    </div>
  )
}

function assemblerSlots(ent: Entity) {
  const plates = ent.store.ironPlate ?? 0
  const gears = ent.store.gear ?? 0
  const working = Boolean(ent.smelting)
  return (
    <div className="machine-inventory">
      <div className="machine-flow" aria-label="Assembler inventory">
        <Slot
          item="ironPlate"
          amount={plates}
          cap={ASSEMBLER_SLOT_CAP}
          label={`In (×${ASSEMBLER_PLATES_PER_GEAR})`}
          empty={plates < ASSEMBLER_PLATES_PER_GEAR}
        />
        <Arrow />
        <Slot
          item="gear"
          amount={gears}
          cap={ASSEMBLER_SLOT_CAP}
          label="Result"
          empty={gears <= 0}
        />
      </div>
      <ProgressBar
        progress={working ? ent.progress : 0}
        active={working}
        label="Assembling"
      />
    </div>
  )
}

function chestSlots(ent: Entity) {
  const filled = (Object.entries(ent.store) as [ItemId, number][])
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const slots: { item: ItemId | null; amount: number }[] = []
  for (let i = 0; i < CHEST_SLOT_COUNT; i++) {
    const entry = filled[i]
    slots.push(
      entry
        ? { item: entry[0], amount: entry[1] }
        : { item: null, amount: 0 },
    )
  }
  return (
    <div className="machine-inventory">
      <div className="machine-flow is-chest" aria-label="Chest inventory">
        {slots.map((slot, i) => (
          <Slot
            key={slot.item ?? `empty-${i}`}
            item={slot.item}
            amount={slot.amount}
            cap={CHEST_STACK_SIZE}
            label={`Slot ${i + 1}`}
            empty={!slot.item || slot.amount <= 0}
          />
        ))}
      </div>
    </div>
  )
}

/** Recipe-style inventory + progress for furnaces, assemblers, and chests. */
export function MachineInventory({ entity }: { entity: Entity }) {
  if (isFurnaceKind(entity.kind)) return furnaceSlots(entity)
  if (entity.kind === 'assembler') return assemblerSlots(entity)
  if (entity.kind === 'chest') return chestSlots(entity)
  return null
}

export function hasMachineInventory(kind: Entity['kind']): boolean {
  return isFurnaceKind(kind) || kind === 'assembler' || kind === 'chest'
}
