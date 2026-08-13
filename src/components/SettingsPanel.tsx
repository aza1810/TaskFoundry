import { useEffect, useRef, useState } from 'react'
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
  const {
    state,
    reset,
    rename,
    replayTutorial,
    cloudSync,
    pullCloudSaveNow,
    exportSaveFile,
    importSaveFile,
  } = useGame()
  const { session, signOut, cloudError, reconnectCloud } = useAuth()
  const [ota, setOta] = useState<OtaState>(getOtaState)
  const [busy, setBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [transferMsg, setTransferMsg] = useState<string | null>(null)
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')
  const [name, setName] = useState(state.playerName)
  const importRef = useRef<HTMLInputElement>(null)
  const native = Capacitor.isNativePlatform()
  const platform = native
    ? Capacitor.getPlatform() === 'ios'
      ? 'iOS app'
      : 'Android APK'
    : 'Web browser'
  const googleCloud = session?.provider === 'google' && !session.isGuest

  const cloudHint = googleCloud
    ? cloudSync === 'synced'
      ? `Signed in as ${session.displayName}. Cloud save synced - the server keeps the latest foundry while you play.`
      : cloudSync === 'syncing'
        ? `Signed in as ${session.displayName}. Uploading your foundry so the server stays current…`
        : cloudSync === 'offline'
          ? `Signed in as ${session.displayName}. Cloud unreachable right now. Tap Reconnect cloud or Sync cloud now. Your factory is still on this device - Export save as a backup.`
          : `Signed in as ${session.displayName}. Cloud session is missing. Tap Reconnect cloud (or sign out and Continue with Google).`
    : session?.isGuest
      ? 'Signed in as guest (save stays on this device). Use Google Sign-In on this same device to upload your factory to the cloud.'
      : session
        ? `Signed in as @${session.username}. Local accounts stay on this device - use Google Sign-In for cloud sync.`
        : 'Not signed in'

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

  const runPull = async () => {
    setSyncBusy(true)
    setTransferMsg(null)
    try {
      const err = await pullCloudSaveNow()
      setTransferMsg(err ?? 'Cloud save checked.')
    } finally {
      setSyncBusy(false)
    }
  }

  const runReconnect = async () => {
    setSyncBusy(true)
    setTransferMsg(null)
    try {
      const err = await reconnectCloud()
      if (err) {
        setTransferMsg(err)
        return
      }
      const pullErr = await pullCloudSaveNow()
      setTransferMsg(pullErr ?? 'Cloud reconnected and save synced.')
    } finally {
      setSyncBusy(false)
    }
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    setSyncBusy(true)
    setTransferMsg(null)
    try {
      const err = await importSaveFile(file)
      setTransferMsg(err ?? 'Save imported.')
    } finally {
      setSyncBusy(false)
      if (importRef.current) importRef.current.value = ''
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
          <button
            type="submit"
            className="ghost-btn"
            disabled={name.trim() === state.playerName || name.trim().length === 0}
          >
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
        <p className="settings-hint">{cloudHint}</p>
        {cloudError ? (
          <p className="settings-hint settings-cloud-error" role="alert">
            {cloudError}
          </p>
        ) : null}
        {transferMsg ? (
          <p className="settings-hint" role="status">
            {transferMsg}
          </p>
        ) : null}
        <div className="settings-actions">
          {googleCloud ? (
            <>
              <button
                type="button"
                className="primary-btn"
                disabled={syncBusy}
                onClick={() => void runReconnect()}
              >
                {syncBusy ? 'Working…' : 'Reconnect cloud'}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={syncBusy}
                onClick={() => void runPull()}
              >
                {syncBusy ? 'Syncing…' : 'Sync cloud now'}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            disabled={syncBusy}
            onClick={() => {
              exportSaveFile()
              setTransferMsg('Save file downloaded. Import it on your other device if needed.')
            }}
          >
            Export save
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={syncBusy}
            onClick={() => importRef.current?.click()}
          >
            Import save
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
          <button type="button" className="ghost-btn" onClick={() => signOut()}>
            Sign out
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => replayTutorial()}
          >
            Replay tour
          </button>
          <button
            type="button"
            className="ghost-btn is-danger"
            onClick={() => {
              if (
                window.confirm(
                  googleCloud
                    ? 'Scrap this save on this device and in the cloud? Factory, inventory, and progress will be wiped.'
                    : 'Scrap this save? Factory, inventory, and progress on this account will be wiped.',
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
