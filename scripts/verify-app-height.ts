/**
 * Shell height must follow the live viewport, not a frozen 100dvh.
 */
import { readFileSync } from 'node:fs'
import { pickAppHeight, screenAxisHeight } from '../src/ui/syncAppHeight.ts'

function fail(msg: string): never {
  throw new Error(msg)
}

function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg)
}

assert(pickAppHeight(400, 400, 800) === 800, 'should use the largest live viewport')
assert(pickAppHeight(844, 390, 390) === 844, 'should keep innerHeight when visual is stale-small')
assert(pickAppHeight(0, 0, 0) === 1, 'should never report zero')
assert(
  pickAppHeight(400, 400, 400, 844) === 844,
  'half-height read should snap up to the device screen',
)
assert(
  pickAppHeight(400, 400, 400, 844, 820) === 844,
  'half-height resume should keep a full-screen floor',
)
assert(
  pickAppHeight(400, 400, 400, 0, 844) === 844,
  'should keep the last good height when the viewport collapses',
)
assert(
  pickAppHeight(746, 746, 746, 844, 844) === 746,
  'safari chrome shrinking a little should still be trusted',
)
assert(screenAxisHeight(390, 844, 390, 844) === 844, 'portrait uses the long screen side')
assert(screenAxisHeight(390, 844, 844, 390) === 390, 'landscape uses the short screen side')

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const shellBlock = css.slice(
  css.indexOf('html,\nbody,\n#root'),
  css.indexOf('.atmosphere'),
)
assert(!/height:\s*100dvh/.test(shellBlock), 'html/body/#root shell must not pin 100dvh')
assert(shellBlock.includes('-webkit-fill-available'), 'shell should fill the iOS viewport')
assert(shellBlock.includes('100lvh'), 'shell should use the large viewport as a floor')
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
