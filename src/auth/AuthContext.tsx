import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  continueAsGuest,
  createAccount,
  loadSession,
  signIn,
  signInWithGoogle,
  signOut as signOutAuth,
  saveKeyForAccount,
  type Session,
} from './auth'
import { decodeGoogleCredential, getGoogleClientId } from './google'
import {
  formatNativeGoogleError,
  isNativeGoogleAuth,
  nativeGoogleSignIn,
} from './nativeGoogle'
import { adoptRicherLocalSave } from '../cloud/localTransfer'
import { clearCloudSession, createCloudSession, loadCloudSession } from '../cloud/saveSync'

interface AuthContextValue {
  session: Session | null
  cloudError: string | null
  signIn: (username: string, password: string) => Promise<string | null>
  register: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<string | null>
  signInGoogleCredential: (credential: string) => Promise<string | null>
  /** Re-run Google auth and create a cloud session (keeps current local save). */
  reconnectCloud: () => Promise<string | null>
  guest: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [cloudError, setCloudError] = useState<string | null>(() =>
    loadSession()?.provider === 'google' && !loadCloudSession()
      ? 'Cloud session missing. Use Reconnect cloud or sign in with Google again.'
      : null,
  )

  const doSignIn = useCallback(async (username: string, password: string) => {
    const result = await signIn(username, password)
    if (!result.ok) return result.error
    clearCloudSession()
    setCloudError(null)
    setSession(result.session)
    return null
  }, [])

  const doRegister = useCallback(
    async (username: string, password: string, displayName?: string) => {
      const result = await createAccount(username, password, displayName)
      if (!result.ok) return result.error
      clearCloudSession()
      setCloudError(null)
      setSession(result.session)
      return null
    },
    [],
  )

  const signInGoogleCredential = useCallback(async (credential: string) => {
    const clientId = getGoogleClientId()
    if (!clientId) return 'Google Sign-In is unavailable'
    const payload = decodeGoogleCredential(credential)
    if (!payload) return 'Invalid Google credential'
    const result = signInWithGoogle(payload, clientId)
    if (!result.ok) return result.error
    // Pull guest/local factory into the Google slot before GameProvider mounts.
    adoptRicherLocalSave(saveKeyForAccount(result.session.accountId))
    try {
      await createCloudSession(credential)
      setCloudError(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Cloud session failed'
      console.warn('[task-foundry] Cloud session failed', message)
      setCloudError(message)
      setSession(result.session)
      // Enter the game with local save; Settings shows Reconnect cloud.
      return null
    }
    setSession(result.session)
    return null
  }, [])

  const reconnectCloud = useCallback(async () => {
    const clientId = getGoogleClientId()
    if (!clientId) return 'Google Sign-In is unavailable'
    try {
      let credential: string
      if (isNativeGoogleAuth()) {
        credential = await nativeGoogleSignIn()
      } else if (window.google?.accounts?.id) {
        return 'On web, sign out and Continue with Google to reconnect cloud sync.'
      } else {
        return 'Google Sign-In is unavailable on this device.'
      }
      const payload = decodeGoogleCredential(credential)
      if (!payload) return 'Invalid Google credential'
      const result = signInWithGoogle(payload, clientId)
      if (!result.ok) return result.error
      adoptRicherLocalSave(saveKeyForAccount(result.session.accountId))
      await createCloudSession(credential)
      setCloudError(null)
      setSession(result.session)
      return null
    } catch (err) {
      const message = isNativeGoogleAuth()
        ? formatNativeGoogleError(err)
        : err instanceof Error
          ? err.message
          : 'Cloud reconnect failed'
      setCloudError(message)
      return message
    }
  }, [])

  const guest = useCallback(() => {
    clearCloudSession()
    setCloudError(null)
    setSession(continueAsGuest())
  }, [])

  const signOut = useCallback(() => {
    clearCloudSession()
    setCloudError(null)
    signOutAuth()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      cloudError,
      signIn: doSignIn,
      register: doRegister,
      signInGoogleCredential,
      reconnectCloud,
      guest,
      signOut,
    }),
    [
      session,
      cloudError,
      doSignIn,
      doRegister,
      signInGoogleCredential,
      reconnectCloud,
      guest,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
