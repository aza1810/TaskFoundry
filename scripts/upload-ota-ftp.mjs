#!/usr/bin/env node
/**
 * Upload ota-dist/ → apps/tf/ota/ without wiping the web app.
 * Reconnects per file and retries on Fasthosts 425 PASV flakes.
 * Required env: FTP_HOST, FTP_USER, FTP_PASS
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localDir = path.join(root, 'ota-dist')
const host = process.env.FTP_HOST
const user = process.env.FTP_USER
const pass = process.env.FTP_PASS
const remoteDir = (process.env.FTP_OTA_DIR || 'apps/tf/ota').replace(/^\/+|\/+$/g, '')
const attempts = Math.max(3, Number(process.env.FTP_ATTEMPTS || 12))

if (!host || !user || !pass) {
  console.error('Missing FTP_HOST / FTP_USER / FTP_PASS')
  process.exit(1)
}
if (!fs.existsSync(path.join(localDir, 'latest.json'))) {
  console.error('ota-dist/ missing — run node scripts/build-ota.mjs first')
  process.exit(1)
}

const { Client } = await import('basic-ftp')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withClient(fn) {
  const client = new Client(120000)
  client.ftp.verbose = true
  try {
    await client.access({ host, user, password: pass, secure: false })
    return await fn(client)
  } finally {
    client.close()
  }
}

async function uploadFile(name) {
  const local = path.join(localDir, name)
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try {
      await withClient(async (client) => {
        await client.ensureDir(remoteDir)
        console.log(`Uploading ${name} (try ${i}/${attempts})`)
        await client.uploadFrom(local, name)
      })
      return
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  fail ${name}: ${msg}`)
      await sleep(Math.min(8000, 400 * i * i))
    }
  }
  throw lastErr ?? new Error(`Failed to upload ${name}`)
}

const files = fs
  .readdirSync(localDir)
  .filter((name) => fs.statSync(path.join(localDir, name)).isFile())

for (const name of files) {
  await uploadFile(name)
}

console.log(`OTA live → https://azztech.online/apps/tf/ota/latest.json`)
