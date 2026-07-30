const ACCOUNTS_KEY = 'task-foundry-accounts'
const SESSION_KEY = 'task-foundry-session'

export type AuthProvider = 'local' | 'google'

export interface AccountRecord {
  id: string
  username: string
  displayName: string
  salt: string
  passwordHash: string
  createdAt: number
  provider?: AuthProvider
  googleSub?: string
  email?: string
  picture?: string
}

export interface Session {
  accountId: string
  username: string
  displayName: string
  isGuest: boolean
  provider?: AuthProvider
  picture?: string
}

function readAccounts(): AccountRecord[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AccountRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAccounts(list: AccountRecord[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

function randomId(): string {
  return `acc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function saveKeyForAccount(accountId: string): string {
  return `task-foundry-save-${accountId}`
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s?.accountId) return null
    return s
  } catch {
    return null
  }
}

export function persistSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function listUsernames(): string[] {
  return readAccounts().map((a) => a.username)
}

export async function createAccount(
  usernameRaw: string,
  password: string,
  displayNameRaw?: string,
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  const username = usernameRaw.trim().toLowerCase()
  const displayName = (displayNameRaw ?? usernameRaw).trim().slice(0, 24) || username
  if (username.length < 3) return { ok: false, error: 'Username needs at least 3 characters' }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { ok: false, error: 'Use letters, numbers, and underscores only' }
  }
  if (password.length < 4) return { ok: false, error: 'Password needs at least 4 characters' }

  const accounts = readAccounts()
  if (accounts.some((a) => a.username === username)) {
    return { ok: false, error: 'That username is already taken' }
  }

  const salt = randomSalt()
  const passwordHash = await hashPassword(password, salt)
  const account: AccountRecord = {
    id: randomId(),
    username,
    displayName,
    salt,
    passwordHash,
    createdAt: Date.now(),
    provider: 'local',
  }
  writeAccounts([...accounts, account])

  const session: Session = {
    accountId: account.id,
    username: account.username,
    displayName: account.displayName,
    isGuest: false,
    provider: 'local',
  }
  persistSession(session)
  return { ok: true, session }
}

export async function signIn(
  usernameRaw: string,
  password: string,
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  const username = usernameRaw.trim().toLowerCase()
  const account = readAccounts().find((a) => a.username === username)
  if (!account) return { ok: false, error: 'Account not found' }
  if (account.provider === 'google') {
    return { ok: false, error: 'This account uses Google Sign-In' }
  }
  const hash = await hashPassword(password, account.salt)
  if (hash !== account.passwordHash) return { ok: false, error: 'Wrong password' }

  const session: Session = {
    accountId: account.id,
    username: account.username,
    displayName: account.displayName,
    isGuest: false,
    provider: account.provider ?? 'local',
    picture: account.picture,
  }
  persistSession(session)
  return { ok: true, session }
}

function sessionFromAccount(account: AccountRecord): Session {
  return {
    accountId: account.id,
    username: account.username,
    displayName: account.displayName,
    isGuest: false,
    provider: account.provider ?? 'local',
    picture: account.picture,
  }
}

/** Sign in / link a Google Identity Services ID token (JWT). */
export function signInWithGoogle(
  payload: {
    sub: string
    email?: string
    name?: string
    picture?: string
    aud?: string
  },
  expectedClientId: string,
): { ok: true; session: Session } | { ok: false; error: string } {
  if (!payload.sub) return { ok: false, error: 'Invalid Google credential' }
  if (expectedClientId && payload.aud && payload.aud !== expectedClientId) {
    return { ok: false, error: 'Google credential does not match this app' }
  }

  const accounts = readAccounts()
  const existing = accounts.find((a) => a.googleSub === payload.sub)
  if (existing) {
    const updated: AccountRecord = {
      ...existing,
      displayName: payload.name?.trim().slice(0, 24) || existing.displayName,
      email: payload.email ?? existing.email,
      picture: payload.picture ?? existing.picture,
      provider: 'google',
    }
    writeAccounts(accounts.map((a) => (a.id === existing.id ? updated : a)))
    const session = sessionFromAccount(updated)
    persistSession(session)
    return { ok: true, session }
  }

  const email = payload.email?.trim().toLowerCase()
  const baseUser =
    email?.split('@')[0]?.replace(/[^a-z0-9_]/g, '_').slice(0, 18) ||
    `google_${payload.sub.slice(0, 8)}`
  let username = baseUser
  let n = 1
  while (accounts.some((a) => a.username === username)) {
    username = `${baseUser}_${n++}`.slice(0, 24)
  }

  const account: AccountRecord = {
    id: `google-${payload.sub}`,
    username,
    displayName: (payload.name ?? username).trim().slice(0, 24) || username,
    salt: '',
    passwordHash: '',
    createdAt: Date.now(),
    provider: 'google',
    googleSub: payload.sub,
    email,
    picture: payload.picture,
  }
  writeAccounts([...accounts, account])
  const session = sessionFromAccount(account)
  persistSession(session)
  return { ok: true, session }
}

export function continueAsGuest(): Session {
  const existing = loadSession()
  if (existing?.isGuest) return existing

  const session: Session = {
    accountId: 'guest-local',
    username: 'guest',
    displayName: 'Guest Operator',
    isGuest: true,
  }
  persistSession(session)

  // Pull forward any pre-auth foundry save into the guest slot once
  const guestKey = saveKeyForAccount(session.accountId)
  if (!localStorage.getItem(guestKey)) {
    const legacy =
      localStorage.getItem('task-foundry-v9') ??
      localStorage.getItem('task-foundry-v8') ??
      localStorage.getItem('habitworks-grid-v7')
    if (legacy) localStorage.setItem(guestKey, legacy)
  }

  return session
}

export function signOut(): void {
  clearSession()
}
