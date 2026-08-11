/**
 * Cloud save sync for Google-signed-in operators.
 * Hosted at https://azztech.online/apps/tf/api/
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core'
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

type ApiResult = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

function asApiResult(status: number, bodyText: string): ApiResult {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      try {
        return JSON.parse(bodyText || 'null')
      } catch {
        return {}
      }
    },
    async text() {
      return bodyText
    },
  }
}

async function apiFetch(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (init.body) {
    headers['Content-Type'] = 'application/json'
  }
  if (init.token) {
    const bearer = `Bearer ${init.token}`
    headers.Authorization = bearer
    // Duplicate under a custom header - some hosts strip Authorization.
    headers['X-TF-Authorization'] = bearer
  }
  const method = (init.method ?? 'GET').toUpperCase()
  let url = `${CLOUD_API_BASE}${path}`
  // Query token fallback when Authorization headers are stripped by the host.
  if (init.token) {
    url += (url.includes('?') ? '&' : '?') + `tf_token=${encodeURIComponent(init.token)}`
  }

  const bodyStr = typeof init.body === 'string' ? init.body : undefined

  // Native: CapacitorHttp first, then window.fetch fallback.
  if (Capacitor.isNativePlatform()) {
    try {
      const data = bodyStr
        ? (() => {
            try {
              return JSON.parse(bodyStr)
            } catch {
              return bodyStr
            }
          })()
        : undefined
      const native = await CapacitorHttp.request({
        url,
        method,
        headers,
        data,
        connectTimeout: 20000,
        readTimeout: 30000,
        responseType: 'text',
      })
      const bodyText =
        typeof native.data === 'string'
          ? native.data
          : native.data == null
            ? ''
            : JSON.stringify(native.data)
      const status = typeof native.status === 'number' ? native.status : 0
      if (status > 0) {
        return asApiResult(status, bodyText)
      }
      throw new Error(`Native HTTP returned status ${status}`)
    } catch (nativeErr) {
      // Fall through to fetch - some OTA/WebView builds mis-route the plugin.
      console.warn(
        '[task-foundry] CapacitorHttp failed, trying fetch',
        nativeErr instanceof Error ? nativeErr.message : nativeErr,
      )
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: bodyStr,
    })
    const bodyText = await res.text()
    return asApiResult(res.status, bodyText)
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Network error: ${err.message}`
        : 'Network error talking to cloud save',
    )
  }
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

export type CloudPushResult = 'ok' | 'skipped' | 'no-session'

/**
 * Upload local foundry state. Returns:
 * - `ok` - server accepted this payload (or wrote it)
 * - `skipped` - server already has a newer savedAt (caller should pull)
 * - `no-session` - not signed in for cloud
 */
export async function pushCloudSave(
  saveKey: string,
  state: GameState,
  savedAt: number,
  session: CloudSession | null = loadCloudSession(),
): Promise<CloudPushResult> {
  if (!session?.token) return 'no-session'
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
    savedAt?: number
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
  if (data.skipped) {
    // Server kept a newer save - do not claim this device payload is synced.
    const prev = readSaveMeta(saveKey)
    writeSaveMeta(saveKey, {
      ...prev,
      lastError: undefined,
    })
    return 'skipped'
  }
  const prev = readSaveMeta(saveKey)
  writeSaveMeta(saveKey, {
    ...prev,
    savedAt,
    cloudSyncedAt: Date.now(),
    lastError: undefined,
  })
  return 'ok'
}

export type CloudHydrationResult =
  | { ok: true; state: GameState; savedAt: number; fromCloud: boolean }
  | { ok: false; reason: 'no-session' | 'error'; message?: string }

function factoryRichness(state: GameState): number {
  return Object.keys(state.entities ?? {}).length
}

/**
 * Pull cloud save and decide whether it should replace local.
 *
 * Snapshot local meta BEFORE the network round-trip. Autosave must not bump
 * `savedAt` during hydration, or a fresh empty browser tab can look "newer"
 * than the phone foundry and overwrite it.
 */
export async function resolveCloudHydration(
  saveKey: string,
  localState: GameState,
): Promise<CloudHydrationResult> {
  const session = loadCloudSession()
  if (!session) return { ok: false, reason: 'no-session' }

  // Freeze comparison inputs before any await.
  const localMeta = readSaveMeta(saveKey)
  const baselineSavedAt = localMeta.savedAt || 0
  const everCloudSynced = typeof localMeta.cloudSyncedAt === 'number'
  const localRichness = factoryRichness(localState)

  try {
    const remote = await pullCloudSave(session)
    if (!remote) {
      // First cloud upload of whatever is local.
      const savedAt = baselineSavedAt || Date.now()
      await pushCloudSave(saveKey, localState, savedAt, session)
      return { ok: true, state: localState, savedAt, fromCloud: false }
    }

    const remoteRichness = factoryRichness(remote.state)
    // Empty cloud must not clobber a built local foundry (repairs the old web
    // hydration race that could upload a blank tab with a fresh timestamp).
    const hollowRemoteOverwrite =
      remoteRichness === 0 && localRichness > 0

    const preferRemote =
      !hollowRemoteOverwrite &&
      (remote.savedAt > baselineSavedAt ||
        (!everCloudSynced &&
          remoteRichness >= localRichness &&
          (remote.savedAt >= baselineSavedAt || remoteRichness > localRichness)))

    if (preferRemote) {
      writeSaveMeta(saveKey, {
        savedAt: remote.savedAt,
        cloudSyncedAt: Date.now(),
      })
      return {
        ok: true,
        state: remote.state,
        savedAt: remote.savedAt,
        fromCloud: true,
      }
    }

    if (baselineSavedAt > remote.savedAt || hollowRemoteOverwrite) {
      const savedAt = hollowRemoteOverwrite
        ? Math.max(baselineSavedAt, Date.now())
        : baselineSavedAt
      await pushCloudSave(saveKey, localState, savedAt, session)
      return {
        ok: true,
        state: localState,
        savedAt,
        fromCloud: false,
      }
    }
    return {
      ok: true,
      state: localState,
      savedAt: baselineSavedAt || remote.savedAt,
      fromCloud: false,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cloud sync failed'
    writeSaveMeta(saveKey, {
      ...readSaveMeta(saveKey),
      lastError: message,
    })
    return { ok: false, reason: 'error', message }
  }
}
