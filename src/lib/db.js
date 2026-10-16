/**
 * MiLey Platform - Database Module
 * Hybrid Supabase Cloud + Local Persistent Engine with Real-Time Reactivity
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { auth } from './auth'
import { readTable, writeTable, onTableChange, notifyTableListeners } from './localBackend'

const OPTION_KEYS = new Set(['order', 'limit', 'offset', 'fields', 'filters', 'visibleTo', 'writableBy', 'writableFields'])

export function normalizeQueryArgs(filtersOrOptions = {}, maybeOptions = {}) {
  const fObj = filtersOrOptions || {}
  const oObj = maybeOptions || {}

  const filters = {}
  const options = { ...oObj }

  if (fObj.filters && typeof fObj.filters === 'object') {
    Object.assign(filters, fObj.filters)
  }

  for (const [k, v] of Object.entries(fObj)) {
    if (OPTION_KEYS.has(k)) {
      if (k !== 'filters' && options[k] === undefined) options[k] = v
    } else if (v !== undefined && v !== null) {
      filters[k] = v
    }
  }

  return { filters, options }
}

// Convert snake_case keys from Postgres to camelCase while preserving original keys
function normalizeRecord(row) {
  if (!row || typeof row !== 'object') return row
  const out = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (k.includes('_')) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      if (out[camel] === undefined) out[camel] = v
    }
  }
  if (out.plays === undefined && out.playsCount !== undefined) out.plays = out.playsCount
  if (out.createdAt === undefined) out.createdAt = new Date().toISOString()
  return out
}

function applyLocalQuery(rows, filters = {}, options = {}) {
  let list = rows.map(normalizeRecord)

  const filterEntries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null)
  if (filterEntries.length > 0) {
    list = list.filter((item) =>
      filterEntries.every(([k, v]) => {
        if (item[k] === v) return true
        // Support matching userId / id interchangeability on profiles
        if (k === 'userId' && item.id === v) return true
        if (k === 'id' && item.userId === v) return true
        return false
      })
    )
  }

  if (options.order) {
    const desc = options.order.startsWith('-')
    const field = desc ? options.order.slice(1) : options.order
    list.sort((a, b) => {
      const av = a[field] ?? ''
      const bv = b[field] ?? ''
      if (av === bv) return 0
      return desc ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1)
    })
  }

  const offset = options.offset || 0
  const limit = options.limit || list.length
  return list.slice(offset, offset + limit)
}

export async function select(table, filtersOrOptions = {}, maybeOptions = {}) {
  const { filters, options } = normalizeQueryArgs(filtersOrOptions, maybeOptions)

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from(table).select('*')
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) query = query.eq(key, value)
      })
      if (options.order) {
        const desc = options.order.startsWith('-')
        const col = desc ? options.order.slice(1) : options.order
        query = query.order(col, { ascending: !desc })
      }
      if (options.limit) query = query.limit(options.limit)
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
      }
      const { data, error } = await query
      if (!error && Array.isArray(data)) {
        const localRows = readTable(table)
        const mergedMap = new Map()
        for (const r of localRows) mergedMap.set(r.id, normalizeRecord(r))
        for (const r of data) mergedMap.set(r.id, normalizeRecord(r))
        return applyLocalQuery([...mergedMap.values()], filters, options)
      }
    } catch { /* fallback to local */ }
  }

  const rows = readTable(table)
  return applyLocalQuery(rows, filters, options)
}

export async function get(table, id) {
  if (!id) return null
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
      if (!error && data) return normalizeRecord(data)
    } catch { /* fallback to local */ }
  }
  const rows = readTable(table)
  const found = rows.find((r) => r.id === id || r.userId === id)
  return found ? normalizeRecord(found) : null
}

export async function insert(table, data, id = null, _policies = {}) {
  const user = auth.getCurrentUser()
  const now = new Date().toISOString()
  const record = normalizeRecord({
    ...data,
    id: id || data?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    userId: data?.userId || user?.id || null,
    createdAt: data?.createdAt || now,
    updatedAt: now,
  })

  // Save to local store immediately for instant reactivity
  const rows = readTable(table)
  const existingIdx = rows.findIndex((r) => r.id === record.id)
  if (existingIdx >= 0) rows[existingIdx] = { ...rows[existingIdx], ...record }
  else rows.unshift(record)
  writeTable(table, rows)
  notifyTableListeners(table, { type: 'INSERT', data: record })

  if (isSupabaseConfigured) {
    try {
      await supabase.from(table).upsert(record)
    } catch { /* local already saved */ }
  }

  return record
}

export async function update(table, id, data) {
  const now = new Date().toISOString()
  const rows = readTable(table)
  const idx = rows.findIndex((r) => r.id === id || r.userId === id)
  let updatedRecord
  if (idx >= 0) {
    updatedRecord = normalizeRecord({ ...rows[idx], ...data, updatedAt: now })
    rows[idx] = updatedRecord
  } else {
    updatedRecord = normalizeRecord({ id, ...data, createdAt: now, updatedAt: now })
    rows.unshift(updatedRecord)
  }
  writeTable(table, rows)
  notifyTableListeners(table, { type: 'UPDATE', data: updatedRecord })

  if (isSupabaseConfigured) {
    try {
      await supabase.from(table).update({ ...data, updatedAt: now }).eq('id', id)
    } catch { /* local already saved */ }
  }

  return updatedRecord
}

export async function upsert(table, data, id, policies = {}) {
  const targetId = id || data?.id
  const existing = targetId ? await get(table, targetId) : null
  if (existing) {
    return update(table, existing.id, data)
  }
  return insert(table, data, targetId, policies)
}

export async function remove(table, id) {
  const rows = readTable(table)
  const old = rows.find((r) => r.id === id)
  const next = rows.filter((r) => r.id !== id)
  writeTable(table, next)
  notifyTableListeners(table, { type: 'DELETE', data: old || { id }, oldData: old || { id } })

  if (isSupabaseConfigured) {
    try {
      await supabase.from(table).delete().eq('id', id)
    } catch { /* local already removed */ }
  }

  return true
}

export async function count(table, filters = {}) {
  const list = await select(table, filters)
  return list.length
}

export async function increment(table, id, field, amount = 1) {
  const record = await get(table, id)
  if (!record) return null
  const nextVal = Math.max(0, (Number(record[field]) || 0) + amount)
  return update(table, id, { [field]: nextVal })
}

export async function search(table, query, options = {}) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  const fields = options.fields || ['title', 'name', 'artistName', 'username', 'displayName', 'description', 'lyrics']
  const rows = await select(table, {}, { limit: 500 })
  const matches = rows.filter((r) =>
    fields.some((f) => String(r[f] || '').toLowerCase().includes(q))
  )
  return options.limit ? matches.slice(0, options.limit) : matches
}

export function subscribe(table, callback, filters = {}) {
  const unsubLocal = onTableChange(table, (payload) => {
    const rec = payload?.data || payload?.oldData
    if (rec && Object.keys(filters).length > 0) {
      const ok = Object.entries(filters).every(([k, v]) => v === undefined || rec[k] === v)
      if (!ok) return
    }
    callback(payload)
  })

  let unsubSb = () => {}
  if (isSupabaseConfigured) {
    try {
      const channelName = `sub:${table}:${Math.random().toString(36).slice(2, 8)}`
      const channel = supabase.channel(channelName).on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          callback({
            type: payload.eventType,
            data: normalizeRecord(payload.new || payload.old),
            oldData: normalizeRecord(payload.old),
          })
        }
      )
      channel.subscribe()
      unsubSb = () => { supabase.removeChannel(channel) }
    } catch {}
  }

  const unsubscribe = () => {
    unsubLocal()
    unsubSb()
  }
  unsubscribe.unsubscribe = unsubscribe
  return unsubscribe
}

// Shared table operations
export const selectShared = select
export const getShared = get
export const insertShared = insert
export const updateShared = update
export const upsertShared = upsert
export const deleteShared = remove
export const countShared = count
export const incrementShared = increment
export const searchShared = search
export const subscribeShared = subscribe

export async function batchInsert(table, records) {
  const results = []
  for (const r of records) {
    results.push(await insert(table, r, r.id))
  }
  return results
}

export async function batchUpdate(table, updates) {
  const results = []
  for (const { id, data } of updates) {
    results.push(await update(table, id, data))
  }
  return results
}

export async function batchDelete(table, ids) {
  for (const id of ids) {
    await remove(table, id)
  }
  return true
}

export const db = {
  select,
  get,
  insert,
  update,
  upsert,
  delete: remove,
  count,
  increment,
  search,
  subscribe,
  selectShared,
  getShared,
  insertShared,
  updateShared,
  upsertShared,
  deleteShared,
  countShared,
  incrementShared,
  searchShared,
  subscribeShared,
  batchInsert,
  batchUpdate,
  batchDelete,
}

export default db
