/**
 * Shell height must follow the live viewport, not a frozen 100dvh.
 */
import { readFileSync } from 'node:fs'
import { pickAppHeight } from '../src/ui/syncAppHeight.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

assert(pickAppHeight(400, 400, 800) === 800, 'should use the largest live viewport')
assert(pickAppHeight(844, 390, 390) === 844, 'should keep innerHeight when visual is stale-small')
assert(pickAppHeight(0, 0, 0) === 1, 'should never report zero')

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const shellBlock = css.slice(
  css.indexOf('html,\nbody,\n#root'),
  css.indexOf('.atmosphere'),
)
assert(!/height:\s*100dvh/.test(shellBlock), 'html/body/#root shell must not pin 100dvh')
assert(
  !/\.app \{[\s\S]*?height:\s*100dvh/.test(css),
  '.app must fill the fixed body, not 100dvh',
)
assert(
  !/\.app-game \{[\s\S]*?height:\s*100dvh/.test(css),
  '.app-game must fill the shell, not 100dvh',
)
assert(css.includes('--app-height'), 'CSS should read --app-height from JS')

console.log('verify-app-height: ok')
