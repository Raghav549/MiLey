/**
 * MiLey Platform - File Download Utility
 */

import { resolveMediaUrl } from './localBackend'

export async function saveFile(url, filename = 'miley-track.wav') {
  if (!url) return false
  try {
    const resolved = await resolveMediaUrl(url)
    const a = document.createElement('a')
    a.href = resolved
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return true
  } catch (e) {
    window.open(url, '_blank')
    return false
  }
}

export const download = {
  saveFile,
}

export default download
