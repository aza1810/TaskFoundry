import { useEffect, useRef, useState, type FormEvent } from 'react'
import { APP_NAME, APP_TAGLINE } from '../game/data'
import { useAuth } from '../auth/AuthContext'
import {
  getGoogleClientId,
  loadGoogleIdentityScript,
  setGoogleClientId,
} from '../auth/google'

type Mode = 'signin' | 'register'

export function AuthScreen() {
  const { signIn, register, guest, signInGoogleCredential } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientId, setClientId] = useState(() => getGoogleClientId())
  const [clientIdDraft, setClientIdDraft] = useState(() => getGoogleClientId())
  const [showClientSetup, setShowClientSetup] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)

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

  function saveClientId() {
    setGoogleClientId(clientIdDraft)
    const next = getGoogleClientId()
    setClientId(next)
    setShowClientSetup(!next)
    setError(null)
  }

  useEffect(() => {
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
          setError('Could not load Google Sign-In. Check your connection and try again.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clientId, signInGoogleCredential])

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url'

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
            Sign in to keep your foundry on this device — or continue as guest.
          </p>
        </div>

        <div className="auth-google">
          {clientId ? (
            <>
              <div
                ref={googleBtnRef}
                className={`auth-google-btn ${googleReady ? 'is-ready' : ''}`}
                aria-busy={!googleReady || googleBusy}
              />
              {!googleReady && (
                <p className="auth-google-status">Loading Google Sign-In…</p>
              )}
              {googleBusy && <p className="auth-google-status">Signing you in…</p>}
              <button
                type="button"
                className="ghost-btn auth-google-setup-toggle"
                onClick={() => setShowClientSetup((v) => !v)}
              >
                {showClientSetup ? 'Hide Client ID' : 'Change Google Client ID'}
              </button>
            </>
          ) : (
            <p className="auth-google-status">
              Add a Google OAuth Client ID below to enable Sign in with Google.
            </p>
          )}

          {showClientSetup && (
            <div className="auth-google-setup">
              <label>
                Google OAuth Client ID
                <input
                  value={clientIdDraft}
                  onChange={(e) => setClientIdDraft(e.target.value)}
                  placeholder="123456789-abc.apps.googleusercontent.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <p className="auth-google-hint">
                Create a Web client in Google Cloud Console → APIs &amp; Services →
                Credentials. Add this origin under Authorized JavaScript origins:
              </p>
              <code className="auth-origin">{origin}</code>
              <button type="button" className="primary-btn auth-client-save" onClick={saveClientId}>
                Save Client ID
              </button>
            </div>
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
