#!/usr/bin/env node
/**
 * Resilient upload of dist/ → azztech.online/apps/tf via FTP.
 *
 * Fasthosts prositeFTP often returns 425 on the data channel. This script
 * reconnects per file, retries with backoff, and verifies SIZE after STOR.
 *
 * Required env: FTP_USER, FTP_PASS
 * Optional:
 *   FTP_HOST         (default FTP.fasthosts.co.uk)
 *   FTP_PORT         (default 21)
 *   FTP_REMOTE_DIR   (default apps/tf - relative to FTP login home /htdocs)
 *   FTP_LOCAL_DIR    (default dist; CI uses dist-web so OTA can rebuild dist/)
 *   FTP_SECURE       (1 to enable explicit TLS)
 *   FTP_ATTEMPTS     (default 12)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const host = process.env.FTP_HOST || 'FTP.fasthosts.co.uk'
const user = process.env.FTP_USER
const pass = process.env.FTP_PASS
const port = Number(process.env.FTP_PORT || 21)
/** Local folder to upload (default dist). CI uses dist-web after OTA rebuilds dist/. */
const localDirName = (process.env.FTP_LOCAL_DIR || 'dist').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
const dist = path.join(root, localDirName)
/** Relative to FTP login home (Fasthosts lands in /htdocs). Never prefix htdocs/. */
const remoteDir = (process.env.FTP_REMOTE_DIR || 'apps/tf')
  .replace(/\\/g, '/')
  .replace(/^\/+|\/+$/g, '')
  .replace(/^htdocs\//, '')
const attempts = Math.max(3, Number(process.env.FTP_ATTEMPTS || 12))
const secure = process.env.FTP_SECURE === '1'

if (!user || !pass) {
  console.error('Missing FTP_USER / FTP_PASS. Set them then re-run: npm run deploy:azz')
  process.exit(1)
}
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error(`${localDirName}/ missing - run npm run build:azz first`)
  process.exit(1)
}
const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
if (!indexHtml.includes('/apps/tf/assets/')) {
  console.error(
    `${localDirName}/index.html is missing /apps/tf/assets/ paths. ` +
      'Refusing to publish a root-relative (base `/`) build to /apps/tf/.',
  )
  process.exit(1)
}

async function loadFp() {
  try {
    return await import('basic-ftp')
  } catch {
    console.log('Installing basic-ftp…')
    execSync('npm install --no-save basic-ftp', { stdio: 'inherit', cwd: root })
    return await import('basic-ftp')
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function listFiles(dir, base = dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) out.push(...listFiles(full, base))
    else out.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return out.sort()
}

async function withClient(basicFtp, fn) {
  const client = new basicFtp.Client(90_000)
  client.ftp.verbose = process.env.FTP_VERBOSE === '1'
  try {
    await client.access({
      host,
      port,
      user,
      password: pass,
      secure,
      secureOptions: secure ? { rejectUnauthorized: false } : undefined,
    })
    return await fn(client)
  } finally {
    try {
      client.close()
    } catch {
      /* ignore teardown races after 425 */
    }
  }
}

async function uploadFile(basicFtp, localPath, remoteRel) {
  const localSize = fs.statSync(localPath).size
  const parent = path.posix.dirname(remoteRel)
  const name = path.posix.basename(remoteRel)
  const remoteParent =
    parent === '.' ? remoteDir : path.posix.join(remoteDir, parent)
  let lastErr

  for (let i = 1; i <= attempts; i++) {
    try {
      // Fresh login each attempt - CWD starts at Fasthosts /htdocs
      await withClient(basicFtp, async (client) => {
        await client.ensureDir(remoteParent)
        await client.uploadFrom(localPath, name)
        const size = await client.size(name)
        if (size !== localSize) {
          throw new Error(`size mismatch remote=${size} local=${localSize}`)
        }
      })
      console.log(`OK  ${remoteRel} (${localSize} bytes) [attempt ${i}]`)
      return
    } catch (err) {
      lastErr = err
      console.warn(`…  ${remoteRel} attempt ${i}/${attempts}: ${err.message || err}`)
      await sleep(Math.min(30_000, 800 * i + Math.floor(Math.random() * 400)))
    }
  }
  throw new Error(`FAILED ${remoteRel}: ${lastErr?.message || lastErr}`)
}

async function pruneStaleAssets(basicFtp, keepNames) {
  try {
    await withClient(basicFtp, async (client) => {
      await client.ensureDir(path.posix.join(remoteDir, 'assets'))
      const listing = await client.list()
      for (const entry of listing) {
        if (entry.isDirectory) continue
        if (keepNames.has(entry.name)) continue
        if (!/^index-[\w-]+\.(js|css)$/.test(entry.name)) continue
        console.log(`rm  assets/${entry.name}`)
        await client.remove(entry.name)
      }
    })
  } catch (err) {
    console.warn(`prune skipped: ${err.message || err}`)
  }
}

async function main() {
  const basicFtp = await loadFp()
  const files = listFiles(dist)
  console.log(`Deploy ${files.length} files → ftp://${host}/${remoteDir}/`)
  console.log('(Fasthosts login home is /htdocs; remote dir is relative to that)')

  // Control-channel only check (pwd does not need a data connection)
  for (let i = 1; i <= attempts; i++) {
    try {
      await withClient(basicFtp, async (client) => {
        console.log('FTP pwd after login:', await client.pwd())
      })
      break
    } catch (err) {
      console.warn(`login attempt ${i}/${attempts}: ${err.message || err}`)
      if (i === attempts) throw err
      await sleep(1000 * i)
    }
  }

  // Small files first so index/favicon land even if a large bundle flakes later
  const ordered = [...files].sort((a, b) => {
    const sa = fs.statSync(path.join(dist, a)).size
    const sb = fs.statSync(path.join(dist, b)).size
    return sa - sb
  })

  const required = new Set(['index.html'])
  for (const f of files) {
    if (f.startsWith('assets/')) required.add(f)
  }
  const failed = []

  for (const rel of ordered) {
    try {
      await uploadFile(basicFtp, path.join(dist, rel), rel)
    } catch (err) {
      console.error(String(err.message || err))
      failed.push(rel)
    }
  }

  const missingRequired = failed.filter((f) => required.has(f))
  if (missingRequired.length) {
    throw new Error(`Required files failed: ${missingRequired.join(', ')}`)
  }
  if (failed.length) {
    console.warn(`Non-critical upload failures (site may still work): ${failed.join(', ')}`)
  }

  const keep = new Set(
    files.filter((f) => f.startsWith('assets/')).map((f) => path.posix.basename(f)),
  )
  await pruneStaleAssets(basicFtp, keep)

  console.log(`Uploaded dist/ → ftp://${host}/${remoteDir}/`)
  console.log('Live: https://azztech.online/apps/tf/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
