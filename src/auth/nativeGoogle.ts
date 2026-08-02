import { Capacitor } from '@capacitor/core'
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in'
import { getGoogleClientId } from './google'

let initializedFor: string | null = null

export function isNativeGoogleAuth(): boolean {
  return Capacitor.isNativePlatform()
}

async function ensureInitialized(): Promise<string> {
  const clientId = getGoogleClientId()
  if (!clientId) throw new Error('Missing Google Client ID')
  if (initializedFor !== clientId) {
    await GoogleSignIn.initialize({ clientId })
    initializedFor = clientId
  }
  return clientId
}

/**
 * Native Google Sign-In (Credential Manager / Google Sign-In SDK).
 * Returns the ID token JWT for the existing local Google account flow.
 */
export async function nativeGoogleSignIn(): Promise<string> {
  await ensureInitialized()
  const result = await GoogleSignIn.signIn()
  if (!result.idToken) {
    throw new Error('Google did not return an ID token')
  }
  return result.idToken
}

export function formatNativeGoogleError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const lower = msg.toLowerCase()
  if (lower.includes('cancel') || lower.includes('canceled') || lower.includes('cancelled')) {
    return 'Google Sign-In was cancelled'
  }
  if (
    lower.includes('10') ||
    lower.includes('developer_error') ||
    lower.includes('12500') ||
    lower.includes('sha')
  ) {
    return (
      'Google Sign-In needs an Android OAuth client in Google Cloud Console for ' +
      'package online.azztech.taskfoundry (debug SHA-1 D6:73:A2:0F:34:7D:05:54:71:8F:EC:66:AE:51:96:7E:AD:13:FD:5B). ' +
      'Create it in the same project as the Web client ID, then try again.'
    )
  }
  if (msg.trim()) return msg
  return 'Google Sign-In failed'
}
