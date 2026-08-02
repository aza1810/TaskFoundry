# Task Foundry

Walk. Task. Automate.

An idle RPG where daily tasks, real steps, and a Factorio-style factory floor feed each other.

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
