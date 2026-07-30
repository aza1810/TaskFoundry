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
  signOut as signOutAuth,
  type Session,
} from './auth'

interface AuthContextValue {
  session: Session | null
  signIn: (username: string, password: string) => Promise<string | null>
  register: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<string | null>
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
      guest,
      signOut,
    }),
    [session, doSignIn, doRegister, guest, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
