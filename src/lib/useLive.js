/**
 * MiLey Platform - useLive Hook
 * React hooks for realtime data subscriptions with Supabase
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { auth } from './auth'

// Generic hook for subscribing to realtime table changes
export function useLive(table, filters = {}, options = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchInitial = useCallback(async () => {
    try {
      let query = supabase.from(table).select('*')
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value)
        }
      })
      
      // Apply ordering
      if (options.order) {
        const orderParts = options.order.startsWith('-') 
          ? options.order.slice(1) 
          : options.order
        const ascending = !options.order.startsWith('-')
        query = query.order(orderParts, { ascending })
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit)
      }
      
      const { data: result, error: fetchError } = await query
      
      if (fetchError) throw fetchError
      setData(result || null)
      setError(null)
    } catch (err) {
      console.error('useLive fetch error:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [table, JSON.stringify(filters), options.order, options.limit])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  useEffect(() => {
    const user = auth.getCurrentUser()
    if (!user) return

    const channelName = `live:${table}:${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(':')}`
    
    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        ...filters,
      },
      (payload) => {
        setData((prevData) => {
          if (!prevData) return prevData
          
          if (Array.isArray(prevData)) {
            switch (payload.eventType) {
              case 'INSERT':
                return [...prevData, payload.new]
              case 'UPDATE':
                return prevData.map(item => 
                  item.id === payload.new.id ? { ...item, ...payload.new } : item
                )
              case 'DELETE':
                return prevData.filter(item => item.id !== payload.old.id)
              default:
                return prevData
            }
          } else {
            // Single object
            if (payload.eventType === 'UPDATE' && prevData.id === payload.new.id) {
              return { ...prevData, ...payload.new }
            }
            if (payload.eventType === 'DELETE' && prevData.id === payload.old.id) {
              return null
            }
            return prevData
          }
        })
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channelName)
    }
  }, [table, JSON.stringify(filters)])

  const refetch = useCallback(() => {
    setLoading(true)
    return fetchInitial()
  }, [fetchInitial])

  return { data, loading, error, refetch }
}

// Hook for shared tables (with visibility policies)
export function useLiveShared(table, filters = {}, options = {}) {
  return useLive(table, filters, options)
}

// Hook for presence/online status
export function usePresence(channelName, initialInfo = {}) {
  const [users, setUsers] = useState([])
  const user = auth.getCurrentUser()

  useEffect(() => {
    if (!user) {
      setUsers([])
      return
    }

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: channelName,
        },
      },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const userList = []
      
      Object.values(state).forEach(presences => {
        presences.forEach(p => {
          if (p.userid) {
            userList.push({
              id: p.userid,
              userId: p.userid,
              ...p.state,
            })
          }
        })
      })
      
      setUsers(userList)
    })

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      newPresences.forEach(p => {
        if (p.userid) {
          setUsers(prev => {
            if (prev.some(u => u.id === p.userid)) return prev
            return [...prev, { id: p.userid, userId: p.userid, ...p.state }]
          })
        }
      })
    })

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      leftPresences.forEach(p => {
        if (p.userid) {
          setUsers(prev => prev.filter(u => u.id !== p.userid))
        }
      })
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userid: user.id,
          ...initialInfo,
        })
      }
    })

    return () => {
      channel.unsubscribe()
    }
  }, [channelName, user?.id, JSON.stringify(initialInfo)])

  const updateInfo = useCallback((newInfo) => {
    if (!user) return
    
    const channel = supabase.channel(channelName)
    channel.track({
      userid: user.id,
      ...newInfo,
    })
  }, [channelName, user?.id])

  const leave = useCallback(() => {
    const channel = supabase.channel(channelName)
    channel.unsubscribe()
  }, [channelName])

  return { users, updateInfo, leave }
}

export default { useLive, useLiveShared, usePresence }
