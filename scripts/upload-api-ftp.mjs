#!/usr/bin/env node
/**
 * Upload api/ PHP endpoints → apps/tf/api/ without wiping cloud save data/.
 *
 * Required env: FTP_HOST, FTP_USER, FTP_PASS
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localDir = path.join(root, 'api')
const host = process.env.FTP_HOST
const user = process.env.FTP_USER
const pass = process.env.FTP_PASS
const remoteDir = (process.env.FTP_API_DIR || 'apps/tf/api').replace(/^\/+|\/+$/g, '')
const attempts = Math.max(3, Number(process.env.FTP_ATTEMPTS || 12))

if (!host || !user || !pass) {
  console.error('Missing FTP_HOST / FTP_USER / FTP_PASS')
  process.exit(1)
}
if (!fs.existsSync(path.join(localDir, 'session.php'))) {
  console.error('api/ missing session.php')
  process.exit(1)
}

const { Client } = await import('basic-ftp')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Upload code + deny rules; never sync live save/session JSON. */
function listUploadFiles(dir, base = dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    if (name === 'saves' || name === 'sessions') continue
    const full = path.join(dir, name)
    const rel = path.relative(base, full).split(path.sep).join('/')
    if (fs.statSync(full).isDirectory()) {
      out.push(...listUploadFiles(full, base))
    } else if (name === '.gitkeep') {
      continue
    } else {
      out.push(rel)
    }
  }
  return out.sort()
}

async function withClient(fn) {
  const client = new Client(90_000)
  client.ftp.verbose = process.env.FTP_VERBOSE === '1'
  try {
    await client.access({ host, user, password: pass, secure: false })
    return await fn(client)
  } finally {
    client.close()
  }
}

async function uploadFile(rel) {
  const local = path.join(localDir, rel)
  const expectedSize = fs.statSync(local).size
  const parent = path.posix.dirname(rel)
  const remoteParent =
    parent === '.' ? remoteDir : path.posix.join(remoteDir, parent)
  const base = path.posix.basename(rel)
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try {
      await withClient(async (client) => {
        await client.ensureDir(remoteParent)
        console.log(`Uploading api/${rel} (${expectedSize} bytes, try ${i}/${attempts})`)
        await client.uploadFrom(local, base)
        const size = await client.size(base)
        if (Number(size) !== expectedSize) {
          throw new Error(`size mismatch remote=${size} local=${expectedSize}`)
        }
      })
      return
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  fail ${rel}: ${msg}`)
      await sleep(Math.min(8000, 400 * i * i))
    }
  }
  throw lastErr ?? new Error(`Failed to upload ${rel}`)
}

const files = listUploadFiles(localDir)
console.log(`Deploy ${files.length} API files → ftp://${host}/${remoteDir}/`)
for (const rel of files) {
  await uploadFile(rel)
}
// Ensure data dirs exist without uploading user saves.
for (const rel of ['data', 'data/saves', 'data/sessions']) {
  await withClient(async (client) => {
    await client.ensureDir(path.posix.join(remoteDir, rel))
  })
}
console.log('Cloud API OK → https://azztech.online/apps/tf/api/session.php')
