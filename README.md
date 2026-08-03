# Task Foundry

Walk. Task. Automate.

An idle RPG where daily tasks, real steps, and a Factorio-style factory floor feed each other.

**Repo:** https://github.com/aza1810/TaskFoundry  
**Live:** https://azztech.online/apps/tf/ · **APK:** https://azztech.online/apps/tf/TaskFoundry-debug.apk  
**Current OTA:** `1.1.25` · **Native APK base:** `1.1.0` (`online.azztech.taskfoundry`)

```bash
npm install
npm run dev
```

## Live (web)

https://azztech.online/apps/tf/

The website keeps the browser pedometer + manual step log. Browsers cannot read Apple Health or Health Connect.

## Native app (Apple Health / Health Connect)

Same React app, wrapped with [Capacitor](https://capacitorjs.com/). On device it can sync today’s steps from:

- **iOS** — Apple Health (HealthKit)
- **Android** — Health Connect

```bash
npm install
npm run cap:sync          # build web assets + sync native projects
npm run cap:android       # open Android Studio
npm run cap:ios           # open Xcode (macOS)
```

### First-time native setup

1. Install Android Studio (and Xcode on a Mac for iOS).
2. `npm run cap:sync`
3. **Android:** open the `android/` project, run on a device/emulator with Health Connect installed, grant step permission, then **Steps → Sync health steps**.
4. **iOS:** open `ios/App/App.xcworkspace`, enable the **HealthKit** capability for the app target if Xcode didn’t already, run on a device, grant Health access, then sync.

App id: `online.azztech.taskfoundry`

Privacy policy asset for Health Connect: `public/privacypolicy.html` (copied into the web build).

### Auto-update (no reinstall)

The Android APK uses [Capgo Capacitor Updater](https://capgo.app/) against static files on azztech (no Capgo cloud account).

- On launch / resume it fetches `https://azztech.online/apps/tf/ota/latest.php` (CORS-enabled)
- If a newer web bundle was published by CI, it downloads the zip, applies it, and reloads
- In the app: **··· → Settings → Check for update** / **Download & install**
- The last downloaded bundle is cached on the phone (works offline after update)
- CI bumps OTA versions to `1.1.<run_number>` on each deploy

**You only need a new APK** when native plugins/permissions change (Health, Google Sign-In, updater itself). Normal game/UI changes ship via the deploy workflow’s OTA upload.

Local publish: `npm run build:ota` then `npm run upload:ota` (same FTP secrets as the website). First install must be an APK that includes the updater (**1.1.0+**).

### Google Sign-In (native Android)

The website uses Google Identity Services. The APK uses native Google Sign-In and needs an **Android** OAuth client in the same Google Cloud project as the Web client:

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create credentials → OAuth client ID → Android**
3. Package name: `online.azztech.taskfoundry`
4. SHA-1: `D6:73:A2:0F:34:7D:05:54:71:8F:EC:66:AE:51:96:7E:AD:13:FD:5B`
5. Keep using the existing **Web** client ID in the app (`VITE_GOOGLE_CLIENT_ID` / default)

Until that Android client exists, Google Sign-In on the APK will fail (guest / local accounts still work).

### What syncs

- Native app reads today’s step total from Health / Health Connect.
- Only the **delta** since the last import is applied to the game (no double-counting).
- Manual logs and the live accelerometer pedometer still work as backups.

## Deploy (web)

CI publishes on push (`main` or the factory branch) via [.github/workflows/deploy-azz.yml](.github/workflows/deploy-azz.yml).

**GitHub Actions secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `FTP_HOST` | `FTP.fasthosts.co.uk` |
| `FTP_USER` | `azztech.online` |
| `FTP_PASS` | Fasthosts FTP password |

Then run **Actions → Deploy azztech.online/apps/tf → Run workflow**, or push a change.

**Manual / local:**

```bash
# copy .env.example → .env and set FTP_*
npm run deploy:azz
```

The uploader reconnects per file and retries on Fasthosts `425` data-channel errors. Remote path is `apps/tf` under the FTP login home (`/htdocs`) — do not prefix `htdocs/`.
