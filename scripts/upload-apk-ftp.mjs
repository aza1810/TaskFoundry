#!/usr/bin/env node
/**
 * Upload out/TaskFoundry-debug.apk to azztech.online/apps/tf/
 * Required env: FTP_HOST, FTP_USER, FTP_PASS
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apk = path.join(root, 'out', 'TaskFoundry-debug.apk')

const host = process.env.FTP_HOST
const user = process.env.FTP_USER
const pass = process.env.FTP_PASS

if (!host || !user || !pass) {
  console.error('Missing FTP_HOST / FTP_USER / FTP_PASS')
  process.exit(1)
}
if (!fs.existsSync(apk)) {
  console.error('Missing', apk)
  process.exit(1)
}

const { Client } = await import('basic-ftp')
const client = new Client(120000)
client.ftp.verbose = true
try {
  await client.access({ host, user, password: pass, secure: false })
  await client.ensureDir('apps/tf')
  await client.uploadFrom(apk, 'TaskFoundry-debug.apk')
  console.log('Uploaded → https://azztech.online/apps/tf/TaskFoundry-debug.apk')
} finally {
  client.close()
}
