#!/usr/bin/env node
/**
 * Upload dist/ to azztech.online/apps/tf via FTP.
 * Required env: FTP_HOST, FTP_USER, FTP_PASS
 * Optional: FTP_REMOTE_DIR (default public_html/apps/tf), FTP_PORT (21)
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

const host = process.env.FTP_HOST || 'azztech.online'
const user = process.env.FTP_USER
const pass = process.env.FTP_PASS
const port = Number(process.env.FTP_PORT || 21)
const remoteDir = (process.env.FTP_REMOTE_DIR || 'htdocs/apps/tf').replace(/\\/g, '/')

if (!user || !pass) {
  console.error('Missing FTP_USER / FTP_PASS. Set them then re-run: npm run deploy:azz')
  process.exit(1)
}
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ missing — run npm run build:azz first')
  process.exit(1)
}

async function main() {
  let basicFtp
  try {
    basicFtp = await import('basic-ftp')
  } catch {
    console.error('Installing basic-ftp…')
    const { execSync } = await import('node:child_process')
    execSync('npm install --no-save basic-ftp', { stdio: 'inherit', cwd: root })
    basicFtp = await import('basic-ftp')
  }
  const client = new basicFtp.Client(60000)
  client.ftp.verbose = true
  try {
    await client.access({
      host,
      port,
      user,
      password: pass,
      secure: process.env.FTP_SECURE === '1' ? true : false,
    })
    await client.ensureDir(remoteDir)
    await client.clearWorkingDir()
    await client.uploadFromDir(dist)
    console.log(`Uploaded dist/ → ftp://${host}/${remoteDir}`)
    console.log('Live: https://azztech.online/apps/tf/')
  } finally {
    client.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
