const CLIENT_ID_KEY = 'task-foundry-google-client-id'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Public OAuth Web Client ID for Task Foundry (not a secret). */
export const DEFAULT_GOOGLE_CLIENT_ID =
  '769075164048-02j154eqdqlm58q5tch234bhb7hfl53b.apps.googleusercontent.com'

export interface GoogleIdPayload {
  sub: string
  email?: string
  email_verified?: boolean | string
  name?: string
  picture?: string
  given_name?: string
  aud?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            context?: string
            ux_mode?: 'popup' | 'redirect'
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string
              theme?: string
              size?: string
              text?: string
              shape?: string
              logo_alignment?: string
              width?: number | string
            },
          ) => void
          prompt: (
            momentListener?: (notification: {
              isNotDisplayed: () => boolean
              isSkippedMoment: () => boolean
              getNotDisplayedReason: () => string
            }) => void,
          ) => void
          cancel: () => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

export function getGoogleClientId(): string {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY)?.trim()
    if (stored) return stored
  } catch {
    /* ignore */
  }
  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return DEFAULT_GOOGLE_CLIENT_ID
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Sign-In')),
      )
      if (window.google?.accounts?.id) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Failed to load Google Sign-In'))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

export function decodeGoogleCredential(credential: string): GoogleIdPayload | null {
  try {
    const parts = credential.split('.')
    if (parts.length < 2) return null
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as GoogleIdPayload
    if (!payload?.sub) return null
    return payload
  } catch {
    return null
  }
}
