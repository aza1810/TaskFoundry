# Task Foundry

Walk. Task. Automate.

An idle RPG where daily tasks, real steps, and a Factorio-style factory floor feed each other.

```bash
npm install
npm run dev
```

## Live

https://azztech.online/apps/tf/

## Deploy

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
