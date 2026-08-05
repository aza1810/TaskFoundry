import { useEffect, useRef, useState, type FormEvent } from 'react'
import { APP_NAME, APP_TAGLINE } from '../game/data'
import { useAuth } from '../auth/AuthContext'
import { getGoogleClientId, loadGoogleIdentityScript } from '../auth/google'
import {
  formatNativeGoogleError,
  isNativeGoogleAuth,
  nativeGoogleSignIn,
} from '../auth/nativeGoogle'

type Mode = 'signin' | 'register'

export function AuthScreen() {
  const { signIn, register, guest, signInGoogleCredential } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientId] = useState(() => getGoogleClientId())
  const [googleReady, setGoogleReady] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const nativeGoogle = isNativeGoogleAuth()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err =
      mode === 'signin'
        ? await signIn(username, password)
        : await register(username, password, displayName || username)
    setBusy(false)
    if (err) setError(err)
  }

  async function onNativeGoogle() {
    setGoogleBusy(true)
    setError(null)
    try {
      const credential = await nativeGoogleSignIn()
      const err = await signInGoogleCredential(credential)
      if (err) setError(err)
    } catch (err) {
      setError(formatNativeGoogleError(err))
    } finally {
      setGoogleBusy(false)
    }
  }

  useEffect(() => {
    // Native app uses Credential Manager / Google Sign-In SDK - skip GIS web button.
    if (nativeGoogle) {
      setGoogleReady(Boolean(clientId))
      return
    }

    if (!clientId) {
      setGoogleReady(false)
      return
    }

    let cancelled = false
    setGoogleReady(false)

    void (async () => {
      try {
        await loadGoogleIdentityScript()
        if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            void (async () => {
              setGoogleBusy(true)
              setError(null)
              const err = await signInGoogleCredential(response.credential)
              setGoogleBusy(false)
              if (err) setError(err)
            })()
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
          ux_mode: 'popup',
        })

        googleBtnRef.current.innerHTML = ''
        const width = Math.min(360, googleBtnRef.current.clientWidth || 320)
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width,
        })
        if (!cancelled) setGoogleReady(true)
      } catch {
        if (!cancelled) {
          setGoogleReady(false)
          setError(
            'Could not load Google Sign-In in this browser. Use Continue as guest, or open https://azztech.online/apps/tf/ in Chrome/Safari.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clientId, signInGoogleCredential, nativeGoogle])

  return (
    <div className="auth-screen">
      <div className="auth-atmosphere" aria-hidden>
        <div className="belt-strip" />
        <div className="haze" />
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <p className="brand">{APP_NAME}</p>
          <p className="tagline">{APP_TAGLINE}</p>
          <p className="auth-pitch">
            Walk to power drills, clear daily tasks for parts, automate a factory.
            Sign in to keep your foundry on this device - or continue as guest.
          </p>
        </div>

        <div className="auth-google">
          {clientId ? (
            <>
              {nativeGoogle ? (
                <button
                  type="button"
                  className="primary-btn auth-google-native"
                  onClick={() => void onNativeGoogle()}
                  disabled={googleBusy || !googleReady}
                >
                  {googleBusy ? 'Signing you in…' : 'Continue with Google'}
                </button>
              ) : (
                <>
                  <div
                    ref={googleBtnRef}
                    className={`auth-google-btn ${googleReady ? 'is-ready' : ''}`}
                    aria-busy={!googleReady || googleBusy}
                  />
                  {!googleReady && (
                    <p className="auth-google-status">Loading Google Sign-In…</p>
                  )}
                </>
              )}
              {googleBusy && !nativeGoogle && (
                <p className="auth-google-status">Signing you in…</p>
              )}
            </>
          ) : (
            <p className="auth-google-status">Google Sign-In is unavailable.</p>
          )}
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === 'signin' ? 'is-active' : ''}
            aria-selected={mode === 'signin'}
            onClick={() => {
              setMode('signin')
              setError(null)
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            className={mode === 'register' ? 'is-active' : ''}
            aria-selected={mode === 'register'}
            onClick={() => {
              setMode('register')
              setError(null)
            }}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              placeholder="operator_01"
            />
          </label>
          {mode === 'register' && (
            <label>
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                placeholder="Optional"
                maxLength={24}
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={4}
            />
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="primary-btn auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button type="button" className="ghost-btn auth-guest" onClick={guest}>
          Continue as guest
        </button>

        <p className="auth-note">
          Accounts stay on this device (local password hash or Google profile id). Saves are
          per operator on this phone/browser.
        </p>
      </div>
    </div>
  )
}
