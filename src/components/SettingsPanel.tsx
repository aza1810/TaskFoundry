import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../auth/AuthContext'
import { useGame } from '../game/GameContext'
import {
  APK_DOWNLOAD_URL,
  APP_VERSION,
  checkForUpdate,
  getOtaState,
  subscribeOta,
  type OtaState,
} from '../native/ota'
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../theme'

function formatBuiltAt(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

export function SettingsPanel() {
  const { state, reset, rename } = useGame()
  const { session, signOut } = useAuth()
  const [ota, setOta] = useState<OtaState>(getOtaState)
  const [busy, setBusy] = useState(false)
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')
  const [name, setName] = useState(state.playerName)
  const native = Capacitor.isNativePlatform()
  const platform = native
    ? Capacitor.getPlatform() === 'ios'
      ? 'iOS app'
      : 'Android APK'
    : 'Web browser'

  useEffect(() => subscribeOta(setOta), [])
  useEffect(() => setName(state.playerName), [state.playerName])
  useEffect(
    () =>
      subscribeTheme(({ preference, resolved }) => {
        setThemePref(preference)
        setResolvedTheme(resolved)
      }),
    [],
  )

  const runCheck = async (apply: boolean) => {
    setBusy(true)
    try {
      await checkForUpdate(apply)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-head">
        <h2>Settings</h2>
        <p>Appearance, account, version, and Android app updates.</p>
      </div>

      <div className="settings-block">
        <h3>Operator</h3>
        <form
          className="settings-name-form"
          onSubmit={(e) => {
            e.preventDefault()
            rename(name)
          }}
        >
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              aria-label="Operator name"
            />
          </label>
          <button type="submit" className="ghost-btn">
            Save name
          </button>
        </form>
      </div>

      <div className="settings-block">
        <h3>Appearance</h3>
        <p className="settings-hint">
          Light mode brightens the chrome and factory floor. Dark keeps the night-shift look.
        </p>
        <div className="settings-theme" role="group" aria-label="Theme">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={themePref === opt.id ? 'is-active' : ''}
              aria-pressed={themePref === opt.id}
              onClick={() => setThemePreference(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="settings-theme-note">
          Using {resolvedTheme}
          {themePref === 'system' ? ' (follows device)' : ''}
        </p>
      </div>

      <div className="settings-block">
        <h3>Version</h3>
        <dl className="settings-meta">
          <div>
            <dt>App</dt>
            <dd>{APP_VERSION}</dd>
          </div>
          <div>
            <dt>Bundle</dt>
            <dd>{ota.bundleVersion}</dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{platform}</dd>
          </div>
          <div>
            <dt>Latest on server</dt>
            <dd>{ota.remoteVersion ?? '-'}</dd>
          </div>
          <div>
            <dt>Server build</dt>
            <dd>{formatBuiltAt(ota.remoteBuiltAt)}</dd>
          </div>
        </dl>
        <p
          className={[
            'settings-status',
            ota.phase === 'error' ? 'is-error' : '',
            ota.phase === 'upToDate' ? 'is-ok' : '',
            ota.phase === 'available' || ota.phase === 'downloading'
              ? 'is-warn'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="status"
        >
          {ota.message}
        </p>
        <div className="settings-actions">
          {native ? (
            <>
              <button
                type="button"
                className="primary-btn"
                disabled={busy || ota.phase === 'downloading' || ota.phase === 'applying'}
                onClick={() => void runCheck(false)}
              >
                {busy && ota.phase === 'checking' ? 'Checking…' : 'Check for update'}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy || ota.phase === 'downloading' || ota.phase === 'applying'}
                onClick={() => void runCheck(true)}
              >
                {ota.phase === 'downloading' || ota.phase === 'applying'
                  ? 'Updating…'
                  : 'Download & install'}
              </button>
            </>
          ) : (
            <p className="settings-hint">
              Install the Android APK to get over-the-air updates without reinstalling.
            </p>
          )}
          <a
            className="ghost-btn settings-link-btn"
            href={APK_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
          >
            Get latest APK
          </a>
        </div>
      </div>

      <div className="settings-block">
        <h3>Account</h3>
        <p className="settings-hint">
          {session
            ? session.isGuest
              ? 'Signed in as guest (save stays on this device).'
              : session.provider === 'google'
                ? `Signed in as ${session.displayName}`
                : `Signed in as @${session.username}`
            : 'Not signed in'}
        </p>
        <div className="settings-actions">
          <button type="button" className="ghost-btn" onClick={() => signOut()}>
            Sign out
          </button>
          <button
            type="button"
            className="ghost-btn is-danger"
            onClick={() => {
              if (
                window.confirm(
                  'Scrap this save? Factory, inventory, and progress on this account will be wiped.',
                )
              ) {
                reset()
              }
            }}
          >
            Scrap save
          </button>
        </div>
      </div>
    </section>
  )
}
