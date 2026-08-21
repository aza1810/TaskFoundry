# Task Foundry - agent notes

## Publishing (always publish)

After making any code change to this project, always publish it live once the
change is verified. Do not wait to be asked.

- Publish command: `npm run deploy:azz`
  - This runs `build:azz` (Vite build with base `/apps/tf/`) then uploads
    `dist/` to the host over FTP via `scripts/deploy-ftp.mjs`.
  - Live URL: https://azztech.online/apps/tf/
- Required credentials (env vars): `FTP_USER`, `FTP_PASS`.
  - Optional: `FTP_HOST`, `FTP_PORT`, `FTP_REMOTE_DIR`, `FTP_SECURE`, `FTP_ATTEMPTS`.

## Cursor Cloud specific instructions

- In Cloud Agent VMs, `FTP_USER` and `FTP_PASS` must be provided as Secrets so
  the deploy step can run. If they are missing, build the bundle with
  `npm run build:azz`, then ask the user to add the FTP secrets so publishing
  can complete.
- This repo is a GitHub-mirrored repo, so Origin pull requests cannot be opened.
  Ship by committing/pushing the working branch and running the publish command.
