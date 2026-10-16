/**
 * MiLey Platform - Share Utility (mileymusic.space)
 */

import { APP_DOMAIN } from './supabaseClient'

export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  return /Instagram|FBAN|FBAV|Line|WebView|wv/i.test(navigator.userAgent || '')
}

export function normalizeShareUrl(url) {
  if (!url) return APP_DOMAIN
  try {
    // Always share canonical mileymusic.space links when sharing externally
    if (url.includes('/#/')) {
      const hashPart = url.slice(url.indexOf('/#/'))
      return `${APP_DOMAIN}${hashPart}`
    }
  } catch {}
  return url
}

export async function link({ title = 'MiLey', text = '', url = APP_DOMAIN } = {}) {
  const canonical = normalizeShareUrl(url)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url: canonical })
      return { shared: true, url: canonical }
    } catch { /* fallback to clipboard */ }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(canonical)
      return { copied: true, url: canonical }
    } catch {}
  }
  return { url: canonical }
}

export const share = {
  isInAppBrowser,
  normalizeShareUrl,
  link,
}

export default share
