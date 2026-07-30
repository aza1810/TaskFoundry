import { useState, type FormEvent } from 'react'
import { APP_NAME, APP_TAGLINE } from '../game/data'
import { useAuth } from '../auth/AuthContext'

type Mode = 'signin' | 'register'

export function AuthScreen() {
  const { signIn, register, guest } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
            Sign in to keep your foundry save on this device. Guests can play too — create
            an account anytime to lock in progress.
          </p>
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
          Accounts are stored on this device (password hashed). Cloud sync can come later —
          signing in still keeps your foundry separate from other operators on the same phone.
        </p>
      </div>
    </div>
  )
}
