#!/usr/bin/env node
/**
 * Upload ota-dist/ → apps/tf/ota/ without wiping the web app.
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

if (!host || !user || !pass) {
  console.error('Missing FTP_HOST / FTP_USER / FTP_PASS')
  process.exit(1)
}
if (!fs.existsSync(path.join(localDir, 'latest.json'))) {
  console.error('ota-dist/ missing — run node scripts/build-ota.mjs first')
  process.exit(1)
}

const { Client } = await import('basic-ftp')
const client = new Client(120000)
client.ftp.verbose = true
try {
  await client.access({ host, user, password: pass, secure: false })
  await client.ensureDir(remoteDir)
  for (const name of fs.readdirSync(localDir)) {
    const local = path.join(localDir, name)
    if (!fs.statSync(local).isFile()) continue
    console.log('Uploading', name)
    await client.uploadFrom(local, name)
  }
  console.log(`OTA live → https://azztech.online/apps/tf/ota/latest.json`)
} finally {
  client.close()
}
