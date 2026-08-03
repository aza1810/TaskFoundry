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
  type Session,
} from './auth'
import { decodeGoogleCredential, getGoogleClientId } from './google'

interface AuthContextValue {
  session: Session | null
  signIn: (username: string, password: string) => Promise<string | null>
  register: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<string | null>
  signInGoogleCredential: (credential: string) => Promise<string | null>
  guest: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())

  const doSignIn = useCallback(async (username: string, password: string) => {
    const result = await signIn(username, password)
    if (!result.ok) return result.error
    setSession(result.session)
    return null
  }, [])

  const doRegister = useCallback(
    async (username: string, password: string, displayName?: string) => {
      const result = await createAccount(username, password, displayName)
      if (!result.ok) return result.error
      setSession(result.session)
      return null
    },
    [],
  )

  const signInGoogleCredential = useCallback(async (credential: string) => {
    const clientId = getGoogleClientId()
    if (!clientId) return 'Add a Google Client ID to enable Sign in with Google'
    // Native apps already have an ID token from Credential Manager - no GIS script needed.
    const payload = decodeGoogleCredential(credential)
    if (!payload) return 'Invalid Google credential'
    const result = signInWithGoogle(payload, clientId)
    if (!result.ok) return result.error
    setSession(result.session)
    return null
  }, [])

  const guest = useCallback(() => {
    setSession(continueAsGuest())
  }, [])

  const signOut = useCallback(() => {
    signOutAuth()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      signIn: doSignIn,
      register: doRegister,
      signInGoogleCredential,
      guest,
      signOut,
    }),
    [session, doSignIn, doRegister, signInGoogleCredential, guest, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
