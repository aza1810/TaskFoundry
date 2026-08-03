#!/usr/bin/env node
/**
 * Build a Capgo-compatible OTA zip from the native Vite dist/ (base `/`)
 * and write apps/tf/ota publish artifacts into ota-dist/.
 *
 * Env:
 *   OTA_VERSION  semver (default: package.json version)
 *   OTA_PUBLIC_BASE  URL prefix (default https://azztech.online/apps/tf/ota)
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const outDir = path.join(root, 'ota-dist')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

const version = (process.env.OTA_VERSION || pkg.version || '1.0.0').replace(/^v/, '')
const publicBase = (
  process.env.OTA_PUBLIC_BASE || 'https://azztech.online/apps/tf/ota'
).replace(/\/+$/, '')
const appId = 'online.azztech.taskfoundry'

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ missing - run npm run build:native first')
  process.exit(1)
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const zipName = `task-foundry-${version}.zip`
const zipPath = path.join(outDir, zipName)
const bundleName = `task-foundry-${version}`

console.log(`Zipping OTA bundle ${version}…`)
const raw = execSync(
  `npx @capgo/cli bundle zip ${appId} --path "${dist}" --bundle "${version}" --name "${bundleName}" --json --no-code-check`,
  { cwd: root, encoding: 'utf8' },
)
console.log(raw)

// Capgo CLI often writes the archive WITHOUT a .zip extension (name as given).
const candidates = [
  path.join(root, bundleName),
  path.join(root, `${bundleName}.zip`),
  path.join(root, zipName),
  path.join(root, `${appId}_${version}.zip`),
]

let found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
if (!found) {
  const recent = fs
    .readdirSync(root)
    .filter((f) => f.includes(version) || f.includes('task-foundry'))
    .map((f) => ({ f, m: fs.statSync(path.join(root, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  if (recent[0]) found = path.join(root, recent[0].f)
}

if (!found || !fs.existsSync(found)) {
  console.error('Could not locate Capgo zip output')
  process.exit(1)
}

fs.renameSync(found, zipPath)

let checksum = ''
try {
  const parsed = JSON.parse(raw.trim().split('\n').filter(Boolean).at(-1) || '{}')
  checksum = parsed.checksum || parsed.sha256 || ''
} catch {
  /* fall through */
}
if (!checksum) {
  // sha256 of zip as fallback
  const { createHash } = await import('node:crypto')
  checksum = createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex')
}

const latest = {
  version,
  url: `${publicBase}/${zipName}`,
  checksum,
  builtAt: new Date().toISOString(),
}

fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(latest, null, 2))
for (const name of ['update.php', 'latest.php', '.htaccess']) {
  const src = path.join(root, 'ota', name)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outDir, name))
}
// Stable alias for the zip so latest.json can optionally use a fixed name too
fs.copyFileSync(zipPath, path.join(outDir, 'bundle.zip'))

console.log('OTA artifacts →', outDir)
console.log(JSON.stringify(latest, null, 2))
