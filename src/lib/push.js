/**
 * MiLey Platform - Push & Local Notification Module
 */

export function getPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'granted'
  return Notification.permission
}

export async function requestPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'granted'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'granted'
  }
}

export async function subscribe() {
  return { ok: true }
}

export async function send(_recipientId, payload = {}) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if (document.visibilityState === 'hidden') {
        new Notification(payload.title || 'MiLey', {
          body: payload.body || '',
          icon: '/apple-touch-icon.png',
        })
      }
    } catch { /* ignore */ }
  }
  return { ok: true }
}

export async function schedule(payload = {}) {
  const delay = payload.at ? Math.max(0, new Date(payload.at).getTime() - Date.now()) : 0
  if (delay > 0 && delay < 3600000) {
    setTimeout(() => {
      send(null, payload)
    }, delay)
  }
  return { ok: true }
}

export const push = {
  getPermission,
  requestPermission,
  subscribe,
  send,
  schedule,
}

export default push
