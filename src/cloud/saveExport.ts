/**
 * Offer a save file through share, download, or clipboard.
 * A detached <a download> plus instant URL.revokeObjectURL fails on phones.
 */

export type SaveOfferVia = 'share' | 'download' | 'clipboard'

export type SaveOfferResult =
  | { ok: true; via: SaveOfferVia }
  | { ok: false; message: string }

function isAbort(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  const message = err instanceof Error ? err.message : ''
  return name === 'AbortError' || /abort|cancel/i.test(message)
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

function triggerDownload(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function offerSaveFile(
  text: string,
  filename: string,
): Promise<SaveOfferResult> {
  try {
    const file = new File([text], filename, { type: 'application/json' })
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean
    }
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename })
      return { ok: true, via: 'share' }
    }
  } catch (err) {
    if (isAbort(err)) return { ok: false, message: 'Export cancelled.' }
  }

  try {
    triggerDownload(text, filename)
    return { ok: true, via: 'download' }
  } catch {
    /* fall through */
  }

  if (await copyText(text)) return { ok: true, via: 'clipboard' }
  return {
    ok: false,
    message: 'Could not export the save. Tap Copy save, or try a desktop browser.',
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  return copyText(text)
}

export function messageForOffer(result: SaveOfferResult): string {
  if (!result.ok) return result.message
  if (result.via === 'share') {
    return 'Share sheet opened. Save the JSON file or send it to yourself.'
  }
  if (result.via === 'clipboard') {
    return 'Save copied to the clipboard. Paste it into a note, or send it here if you want it inspected.'
  }
  return 'Save file offered to the browser. If no download appeared (common on phones), tap Copy save.'
}
