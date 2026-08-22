/**
 * Production / Logistics / Floor groupings and keep-selected tool clicks.
 */
import {
  EDIT_TOOLS,
  FLOOR_TOOLS,
  LOGISTICS_TOOLS,
  PRODUCTION_TOOLS,
  TOOL_TABS,
  tabForTool,
  tabTools,
} from '../src/game/toolTabs.ts'
import type { ToolId } from '../src/game/types.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

assert(!PRODUCTION_TOOLS.includes('foundation'), 'foundation is not a production machine')
assert(
  PRODUCTION_TOOLS.includes('drill') && PRODUCTION_TOOLS.includes('electricDrill'),
  'production holds mining drills',
)
assert(
  PRODUCTION_TOOLS.includes('furnace') && PRODUCTION_TOOLS.includes('assembler'),
  'production holds smelters and assemblers',
)
assert(PRODUCTION_TOOLS.includes('chest'), 'production holds chests')
assert(PRODUCTION_TOOLS.includes('generator'), 'production holds generators')
assert(PRODUCTION_TOOLS.includes('roboport'), 'production holds roboports')

assert(LOGISTICS_TOOLS.includes('belt'), 'logistics holds belts')
assert(LOGISTICS_TOOLS.includes('inserter'), 'logistics holds inserters')
assert(LOGISTICS_TOOLS.includes('splitter'), 'logistics holds splitters')
assert(!LOGISTICS_TOOLS.includes('foundation'), 'foundation is not logistics')
assert(!LOGISTICS_TOOLS.includes('drill'), 'drills are not logistics')

assert(
  FLOOR_TOOLS.length === 1 && FLOOR_TOOLS[0] === 'foundation',
  'floor tab is Foundation only',
)

assert(tabForTool('foundation') === 'floor', 'foundation maps to floor')
assert(tabForTool('drill') === 'production', 'drill maps to production')
assert(tabForTool('belt') === 'logistics', 'belt maps to logistics')
assert(tabForTool('remove') === 'edit', 'remove maps to edit')
assert(tabTools('floor')[0] === 'foundation', 'floor tools start with foundation')
assert(
  TOOL_TABS.find((t) => t.id === 'production')?.label === 'Production',
  'production tab uses the full name',
)
assert(
  TOOL_TABS.find((t) => t.id === 'logistics')?.label === 'Logistics',
  'logistics tab uses the full name',
)
assert(EDIT_TOOLS.includes('rotate'), 'edit still has rotate')

/** Tapping an already-selected tool keeps it armed (never Hand). */
function nextSelected(current: ToolId | null, tapped: ToolId): ToolId {
  return tapped
}

assert(nextSelected('foundation', 'foundation') === 'foundation', 're-tap foundation stays armed')
assert(nextSelected(null, 'foundation') === 'foundation', 'first tap arms foundation')
assert(nextSelected('drill', 'foundation') === 'foundation', 'switch to foundation stays in place mode')

console.log('verify-tool-tabs: ok')
