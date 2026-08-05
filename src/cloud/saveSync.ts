/**
 * Cloud save sync for Google-signed-in operators.
 * Hosted at https://azztech.online/apps/tf/api/
 */
import type { GameState } from '../game/types'

const CLOUD_SESSION_KEY = 'task-foundry-cloud-session'
const SAVE_META_PREFIX = 'task-foundry-save-meta-'

export const CLOUD_API_BASE = 'https://azztech.online/apps/tf/api'

export type CloudSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'
  | 'local-only'

export interface CloudSession {
  token: string
  expiresAt: number
  sub: string
}

export interface SaveMeta {
  savedAt: number
  cloudSyncedAt?: number
  lastError?: string
}

export interface CloudSavePayload {
  savedAt: number
  state: GameState
  updatedAt?: number
}

function metaKey(saveKey: string): string {
  return `${SAVE_META_PREFIX}${saveKey}`
}

export function readSaveMeta(saveKey: string): SaveMeta {
  try {
    const raw = localStorage.getItem(metaKey(saveKey))
    if (!raw) return { savedAt: 0 }
    const parsed = JSON.parse(raw) as SaveMeta
    return {
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
      cloudSyncedAt:
        typeof parsed.cloudSyncedAt === 'number' ? parsed.cloudSyncedAt : undefined,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined,
    }
  } catch {
    return { savedAt: 0 }
  }
}

export function writeSaveMeta(saveKey: string, meta: SaveMeta): void {
  localStorage.setItem(metaKey(saveKey), JSON.stringify(meta))
}

export function bumpLocalSavedAt(saveKey: string): number {
  const savedAt = Date.now()
  const prev = readSaveMeta(saveKey)
  writeSaveMeta(saveKey, { ...prev, savedAt, lastError: undefined })
  return savedAt
}

export function loadCloudSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(CLOUD_SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as CloudSession
    if (!s?.token || !s.expiresAt || !s.sub) return null
    if (s.expiresAt < Date.now() + 60_000) {
      localStorage.removeItem(CLOUD_SESSION_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function clearCloudSession(): void {
  localStorage.removeItem(CLOUD_SESSION_KEY)
}

function persistCloudSession(session: CloudSession): void {
  localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session))
}

async function apiFetch(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`)
  }
  const { token: _t, ...rest } = init
  return fetch(`${CLOUD_API_BASE}${path}`, { ...rest, headers })
}

/** Exchange a Google ID token for a long-lived cloud session. */
export async function createCloudSession(idToken: string): Promise<CloudSession> {
  const res = await apiFetch('/session.php', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    token?: string
    expiresAt?: number
    sub?: string
    error?: string
  }
  if (!res.ok || !data.token || !data.expiresAt || !data.sub) {
    throw new Error(data.error || `Cloud session failed (${res.status})`)
  }
  const session: CloudSession = {
    token: data.token,
    expiresAt: data.expiresAt,
    sub: data.sub,
  }
  persistCloudSession(session)
  return session
}

export async function pullCloudSave(
  session: CloudSession = loadCloudSession()!,
): Promise<CloudSavePayload | null> {
  if (!session?.token) return null
  const res = await apiFetch('/save.php', {
    method: 'GET',
    token: session.token,
  })
  if (res.status === 404) return null
  const data = (await res.json().catch(() => ({}))) as CloudSavePayload & {
    error?: string
  }
  if (!res.ok) {
    if (res.status === 401) clearCloudSession()
    throw new Error(data.error || `Cloud pull failed (${res.status})`)
  }
  if (!data.state || typeof data.savedAt !== 'number') {
    throw new Error('Invalid cloud save payload')
  }
  return {
    savedAt: data.savedAt,
    state: data.state,
    updatedAt: data.updatedAt,
  }
}

export async function pushCloudSave(
  saveKey: string,
  state: GameState,
  savedAt: number,
  session: CloudSession | null = loadCloudSession(),
): Promise<boolean> {
  if (!session?.token) return false
  const { offlineReport: _omit, ...persisted } = state
  const res = await apiFetch('/save.php', {
    method: 'PUT',
    token: session.token,
    body: JSON.stringify({ savedAt, state: persisted }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    skipped?: boolean
  }
  if (!res.ok) {
    if (res.status === 401) clearCloudSession()
    const prev = readSaveMeta(saveKey)
    writeSaveMeta(saveKey, {
      ...prev,
      savedAt,
      lastError: data.error || `Cloud push failed (${res.status})`,
    })
    throw new Error(data.error || `Cloud push failed (${res.status})`)
  }
  const prev = readSaveMeta(saveKey)
  writeSaveMeta(saveKey, {
    ...prev,
    savedAt,
    cloudSyncedAt: Date.now(),
    lastError: undefined,
  })
  return true
}

/** Pull cloud save and decide whether it should replace local. */
export async function resolveCloudHydration(
  saveKey: string,
  localState: GameState,
): Promise<{ state: GameState; savedAt: number; fromCloud: boolean } | null> {
  const session = loadCloudSession()
  if (!session) return null
  try {
    const remote = await pullCloudSave(session)
    const localMeta = readSaveMeta(saveKey)
    if (!remote) {
      // First cloud upload of whatever is local.
      const savedAt = localMeta.savedAt || Date.now()
      await pushCloudSave(saveKey, localState, savedAt, session)
      return { state: localState, savedAt, fromCloud: false }
    }
    if (remote.savedAt > (localMeta.savedAt || 0)) {
      writeSaveMeta(saveKey, {
        savedAt: remote.savedAt,
        cloudSyncedAt: Date.now(),
      })
      return { state: remote.state, savedAt: remote.savedAt, fromCloud: true }
    }
    if ((localMeta.savedAt || 0) > remote.savedAt) {
      await pushCloudSave(saveKey, localState, localMeta.savedAt || Date.now(), session)
    }
    return {
      state: localState,
      savedAt: localMeta.savedAt || remote.savedAt,
      fromCloud: false,
    }
  } catch {
    return null
  }
}
