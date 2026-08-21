/**
 * Move / export / import local foundry saves (guest → Google, file backup).
 */
import { saveKeyForAccount } from '../auth/auth'
import { persistableState } from '../game/logic'
import type { GameState } from '../game/types'
import { bumpLocalSavedAt, writeSaveMeta } from './saveSync'

const LEGACY_SAVE_KEYS = [
  'task-foundry-v9',
  'task-foundry-v8',
  'habitworks-grid-v7',
  'habitworks-grid-v6',
]

function entityCount(raw: string | null): number {
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw) as { entities?: Record<string, unknown> }
    return Object.keys(parsed.entities ?? {}).length
  } catch {
    return 0
  }
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Local slots that may hold a factory built before Google cloud sync. */
export function listLocalSaveCandidates(excludeKey?: string): string[] {
  const keys = new Set<string>()
  keys.add(saveKeyForAccount('guest-local'))
  for (const k of LEGACY_SAVE_KEYS) keys.add(k)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('task-foundry-save-')) keys.add(k)
    }
  } catch {
    /* ignore */
  }
  if (excludeKey) keys.delete(excludeKey)
  return [...keys]
}

/**
 * If the Google (or target) slot is empty/hollow and another local slot has a
 * built foundry, copy that progress in. Returns true when a migration ran.
 */
export function adoptRicherLocalSave(targetSaveKey: string): boolean {
  const targetRaw = readRaw(targetSaveKey)
  const targetRichness = entityCount(targetRaw)
  if (targetRichness > 0) return false

  let bestKey: string | null = null
  let bestRaw: string | null = null
  let bestCount = 0
  for (const key of listLocalSaveCandidates(targetSaveKey)) {
    const raw = readRaw(key)
    const count = entityCount(raw)
    if (count > bestCount) {
      bestCount = count
      bestKey = key
      bestRaw = raw
    }
  }

  if (!bestKey || !bestRaw || bestCount <= 0) return false

  localStorage.setItem(targetSaveKey, bestRaw)
  bumpLocalSavedAt(targetSaveKey)
  return true
}

export function exportSavePayload(state: GameState): string {
  return JSON.stringify(
    {
      format: 'task-foundry-save',
      version: 1,
      exportedAt: Date.now(),
      state: persistableState(state),
    },
    null,
    2,
  )
}

export function parseImportedSave(raw: string): GameState {
  const parsed = JSON.parse(raw) as {
    format?: string
    state?: GameState
    version?: number
    entities?: GameState['entities']
  }
  const state =
    parsed.format === 'task-foundry-save' && parsed.state
      ? parsed.state
      : (parsed as GameState)
  if (!state || typeof state !== 'object' || !state.entities || !state.inventory) {
    throw new Error('Not a Task Foundry save file')
  }
  if (typeof state.version !== 'number') {
    throw new Error('Save file is missing version')
  }
  return state
}

export function applyImportedSave(saveKey: string, state: GameState): void {
  localStorage.setItem(saveKey, JSON.stringify(persistableState(state)))
  writeSaveMeta(saveKey, {
    savedAt: Date.now(),
    lastError: undefined,
  })
}
