/**
 * MiLey Platform - useLive & usePresence Hooks
 * Real-time reactive data hooks powered by hybrid Supabase + Local Event Engine
 */

import { useEffect, useState, useCallback } from 'react'
import { db, normalizeQueryArgs } from './db'
import { realtime } from './realtime'
import { auth } from './auth'

export function useLive(table, filtersOrOptions = {}, maybeOptions = {}) {
  const { filters, options } = normalizeQueryArgs(filtersOrOptions, maybeOptions)
  const serializedKey = JSON.stringify({ table, filters, options })

  const [data, setData] = useState(() => [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCurrent = useCallback(async () => {
    try {
      const result = await db.select(table, filters, options)
      setData(result || [])
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedKey])

  useEffect(() => {
    fetchCurrent()
  }, [fetchCurrent])

  useEffect(() => {
    const unsub = db.subscribe(table, () => {
      fetchCurrent()
    }, filters)
    return () => {
      if (typeof unsub === 'function') unsub()
      else unsub?.unsubscribe?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedKey, fetchCurrent])

  const refetch = useCallback(() => {
    return fetchCurrent()
  }, [fetchCurrent])

  return { data, loading, error, refetch }
}

export function useLiveShared(table, filtersOrOptions = {}, maybeOptions = {}) {
  return useLive(table, filtersOrOptions, maybeOptions)
}

export function usePresence(channelName, initialInfo = {}) {
  const [users, setUsers] = useState([])
  const user = auth.getCurrentUser()

  useEffect(() => {
    if (!channelName) return
    const p = realtime.presence(channelName, initialInfo)
    p.onSync((list) => setUsers(list || []))
    return () => p.leave?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, user?.id])

  const updateInfo = useCallback((newInfo) => {
    if (!channelName) return
    const p = realtime.presence(channelName, newInfo)
    p.updateInfo?.(newInfo)
  }, [channelName])

  const leave = useCallback(() => {
    if (!channelName) return
    const p = realtime.presence(channelName, {})
    p.leave?.()
  }, [channelName])

  return { users, updateInfo, leave }
}

export default { useLive, useLiveShared, usePresence }
