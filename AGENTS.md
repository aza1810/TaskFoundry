# Task Foundry - agent notes

## Publishing (always publish)

After making any code change to this project, always publish it live once the
change is verified. Do not wait to be asked.

- How to publish: merge the verified work into `main` and push `main`.
  - The `.github/workflows/deploy-azz.yml` GitHub Actions workflow runs on every
    push to `main` (for `src/**`, `public/**`, `index.html`, build config, etc).
    It builds with base `/apps/tf/` and uploads over FTP using GitHub repo
    secrets (`FTP_HOST` / `FTP_USER` / `FTP_PASS`), then smoke-checks the site.
  - Live URL: https://azztech.online/apps/tf/
  - Typical flow: work on `cursor/<name>-3db5`, then
    `git checkout -B main origin/main && git merge --ff-only <branch> && git push origin main`.
  - Verify by polling the live site for the new content-hashed bundle name, e.g.
    compare `basename dist/assets/index-*.js` (from a local `npm run build:azz`)
    against the `index-*.js` referenced in `curl -s https://azztech.online/apps/tf/`.

## Cursor Cloud specific instructions

- Publishing does NOT need FTP secrets in the VM. The secrets live in GitHub
  Actions; pushing to `main` is what deploys. No local `npm run deploy:azz` is
  required from the Cloud Agent.
- This repo is a GitHub-mirrored repo, so Origin pull requests cannot be opened.
  Ship by merging to `main` and pushing (which triggers the deploy workflow).
