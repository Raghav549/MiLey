/**
 * MiLey Platform - Database Module
 * Real Supabase database operations with RLS support
 */

import { supabase } from './supabaseClient'
import { auth } from './auth'

// Generic select/query function
export async function select(table, filters = {}, options = {}) {
  try {
    const user = auth.getCurrentUser()
    let query = supabase.from(table).select('*', { count: 'exact' })
    
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
    
    // Apply offset
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error(`Select error on ${table}:`, error)
    throw error
  }
}

// Get single record by ID
export async function get(table, id) {
  try {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
    if (error) throw error
    return data
  } catch (error) {
    console.error(`Get error on ${table}:`, error)
    return null
  }
}

// Insert new record
export async function insert(table, data, id = null, policies = {}) {
  try {
    const user = auth.getCurrentUser()
    if (!user) throw new Error('Authentication required')
    
    const record = {
      ...data,
      id: id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    const { data: result, error } = await supabase.from(table).insert(record).select().single()
    if (error) throw error
    return result
  } catch (error) {
    console.error(`Insert error on ${table}:`, error)
    throw error
  }
}

// Update existing record
export async function update(table, id, data) {
  try {
    const user = auth.getCurrentUser()
    if (!user) throw new Error('Authentication required')
    
    const { data: result, error } = await supabase.from(table)
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return result
  } catch (error) {
    console.error(`Update error on ${table}:`, error)
    throw error
  }
}

// Upsert record
export async function upsert(table, data, id, policies = {}) {
  try {
    const existing = await get(table, id)
    if (existing) {
      return await update(table, id, data)
    } else {
      return await insert(table, data, id, policies)
    }
  } catch (error) {
    console.error(`Upsert error on ${table}:`, error)
    throw error
  }
}

// Delete record
export async function remove(table, id) {
  try {
    const user = auth.getCurrentUser()
    if (!user) throw new Error('Authentication required')
    
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
    return true
  } catch (error) {
    console.error(`Delete error on ${table}:`, error)
    throw error
  }
}

// Count records
export async function count(table, filters = {}) {
  try {
    let query = supabase.from(table).select('*', { count: 'exact', head: true })
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value)
      }
    })
    const { count: total, error } = await query
    if (error) throw error
    return total || 0
  } catch (error) {
    console.error(`Count error on ${table}:`, error)
    return 0
  }
}

// Increment a numeric field
export async function increment(table, id, field, amount = 1) {
  try {
    const user = auth.getCurrentUser()
    if (!user) throw new Error('Authentication required')
    
    const { data: result, error } = await supabase.rpc('increment_field', {
      table_name: table,
      record_id: id,
      field_name: field,
      increment_amount: amount,
    })
    
    if (error) {
      // Fallback: fetch, increment, update
      const record = await get(table, id)
      if (record) {
        const newValue = (record[field] || 0) + amount
        return await update(table, id, { [field]: newValue })
      }
      throw error
    }
    return result
  } catch (error) {
    console.error(`Increment error on ${table}:`, error)
    throw error
  }
}

// Search function
export async function search(table, query, options = {}) {
  try {
    const fields = options.fields || ['title', 'name', 'description']
    let searchQuery = supabase.from(table).select('*', { count: 'exact' })
    
    // Build search filter
    const searchConditions = fields.map(f => `${f}.ilike.%${query}%`).join(',')
    searchQuery = searchQuery.or(searchConditions)
    
    if (options.limit) {
      searchQuery = searchQuery.limit(options.limit)
    }
    
    const { data, error } = await searchQuery
    if (error) throw error
    return data || []
  } catch (error) {
    console.error(`Search error on ${table}:`, error)
    return []
  }
}

// Subscribe to realtime changes
export function subscribe(table, callback, filters = {}) {
  const channelName = `${table}:${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(':')}`
  
  let query = supabase.channel(channelName)
  
  if (Object.keys(filters).length > 0) {
    query = query.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: table,
      ...filters,
    }, (payload) => {
      callback({
        type: payload.eventType,
        data: payload.new || payload.old,
        oldData: payload.old,
      })
    })
  } else {
    query = query.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: table,
    }, (payload) => {
      callback({
        type: payload.eventType,
        data: payload.new || payload.old,
        oldData: payload.old,
      })
    })
  }
  
  query.subscribe()
  
  return () => {
    supabase.removeChannel(channelName)
  }
}

// Shared table operations (with visibility policies)
export async function selectShared(table, filters = {}, options = {}) {
  return select(table, filters, options)
}

export async function getShared(table, id) {
  return get(table, id)
}

export async function insertShared(table, data, id = null, policies = {}) {
  return insert(table, data, id, policies)
}

export async function updateShared(table, id, data) {
  return update(table, id, data)
}

export async function upsertShared(table, data, id, policies = {}) {
  return upsert(table, data, id, policies)
}

export async function deleteShared(table, id) {
  return remove(table, id)
}

export async function countShared(table, filters = {}) {
  return count(table, filters)
}

export async function incrementShared(table, id, field, amount = 1) {
  return increment(table, id, field, amount)
}

export async function searchShared(table, query, options = {}) {
  return search(table, query, options)
}

export function subscribeShared(table, callback, filters = {}) {
  return subscribe(table, callback, filters)
}

// Batch operations
export async function batchInsert(table, records) {
  try {
    const user = auth.getCurrentUser()
    if (!user) throw new Error('Authentication required')
    
    const timestamp = new Date().toISOString()
    const recordsWithMeta = records.map(r => ({
      ...r,
      id: r.id || crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    
    const { data, error } = await supabase.from(table).insert(recordsWithMeta).select()
    if (error) throw error
    return data
  } catch (error) {
    console.error(`Batch insert error on ${table}:`, error)
    throw error
  }
}

export async function batchUpdate(table, updates) {
  try {
    const user = auth.getCurrentUser()
    if (!user) throw new Error('Authentication required')
    
    const results = []
    for (const { id, data } of updates) {
      const result = await update(table, id, data)
      results.push(result)
    }
    return results
  } catch (error) {
    console.error(`Batch update error on ${table}:`, error)
    throw error
  }
}

export async function batchDelete(table, ids) {
  try {
    const user = auth.getCurrentUser()
    if (!user) throw new Error('Authentication required')
    
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (error) throw error
    return true
  } catch (error) {
    console.error(`Batch delete error on ${table}:`, error)
    throw error
  }
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
