import type { Placeable, ToolId } from './types'

export type ToolTab = 'production' | 'logistics' | 'floor' | 'edit'

/** Miners, smelters, assemblers, power, and storage. */
export const PRODUCTION_TOOLS: Placeable[] = [
  'generator',
  'roboport',
  'drill',
  'electricDrill',
  'furnace',
  'steelFurnace',
  'assembler',
  'chest',
]

/** Belts, inserters, and splitters. */
export const LOGISTICS_TOOLS: Placeable[] = [
  'belt',
  'fastBelt',
  'undergroundBelt',
  'splitter',
  'inserter',
  'longInserter',
]

/** Terrain paint. Foundation is a floor flag, not a machine. */
export const FLOOR_TOOLS: Placeable[] = ['foundation']

export const EDIT_TOOLS: ToolId[] = ['remove', 'rotate', 'flip', 'copy', 'paste']

export const TOOL_TABS: { id: ToolTab; label: string; title: string }[] = [
  { id: 'production', label: 'Production', title: 'Production: drills, furnaces, assemblers' },
  { id: 'logistics', label: 'Logistics', title: 'Logistics: belts, inserters, splitters' },
  { id: 'floor', label: 'Floor', title: 'Floor: paint Foundation' },
  { id: 'edit', label: 'Edit', title: 'Edit: demolish, rotate, copy' },
]

export function tabTools(tab: ToolTab): ToolId[] {
  if (tab === 'production') return PRODUCTION_TOOLS
  if (tab === 'logistics') return LOGISTICS_TOOLS
  if (tab === 'floor') return FLOOR_TOOLS
  return EDIT_TOOLS
}

export function isEditMetaTool(
  tool: ToolId | null,
): tool is 'remove' | 'rotate' | 'flip' | 'copy' | 'paste' {
  return (
    tool === 'remove' ||
    tool === 'rotate' ||
    tool === 'flip' ||
    tool === 'copy' ||
    tool === 'paste'
  )
}

export function tabForTool(tool: ToolId | null): ToolTab | null {
  if (!tool) return null
  if (PRODUCTION_TOOLS.includes(tool as Placeable)) return 'production'
  if (LOGISTICS_TOOLS.includes(tool as Placeable)) return 'logistics'
  if (tool === 'foundation') return 'floor'
  if (isEditMetaTool(tool)) return 'edit'
  return null
}
