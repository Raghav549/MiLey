/**
 * MiLey Platform - Storage Module
 * Supports Supabase Storage + Local IndexedDB/DataURL Media Engine
 * Handles songs, covers, banners, profile images, and Song Theme visuals
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { auth } from './auth'
import { storeMediaFile } from './localBackend'

const BUCKETS = {
  songs: 'songs',
  covers: 'covers',
  banners: 'banners',
  profiles: 'profiles',
  documents: 'documents',
  backgrounds: 'backgrounds',
  themes: 'themes',
}

const DEFAULT_BUCKET = BUCKETS.covers

function getFileExtension(filename = 'file.bin') {
  return (filename.split('.').pop() || 'bin').toLowerCase()
}

function getContentType(extension) {
  const types = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    webm: 'audio/webm',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }
  return types[extension] || 'application/octet-stream'
}

function getBucketForFile(file) {
  const type = file?.type || ''
  if (type.startsWith('audio/')) return BUCKETS.songs
  if (type.startsWith('image/')) return BUCKETS.covers
  return DEFAULT_BUCKET
}

function generateFilename(originalName = 'upload.bin') {
  const ext = getFileExtension(originalName)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}-${random}.${ext}`
}

export async function upload(file, originalName, options = {}) {
  const {
    bucket = null,
    path = '',
    onProgress = null,
  } = options

  const user = auth.getCurrentUser()
  const uid = user?.id || 'anon'
  const nameToUse = originalName || file?.name || 'upload.bin'
  const targetBucket = bucket || getBucketForFile(file)
  const filename = generateFilename(nameToUse)
  const fullPath = path ? `${path}/${filename}` : `${uid}/${filename}`

  if (onProgress) {
    onProgress({ loaded: Math.floor((file?.size || 1000) * 0.35), total: file?.size || 1000, percentage: 35 })
  }

  if (isSupabaseConfigured && file) {
    try {
      const { error } = await supabase.storage
        .from(targetBucket)
        .upload(fullPath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || getContentType(getFileExtension(nameToUse)),
        })

      if (!error) {
        const { data: urlData } = supabase.storage
          .from(targetBucket)
          .getPublicUrl(fullPath)

        if (onProgress) {
          onProgress({ loaded: file.size || 1000, total: file.size || 1000, percentage: 100 })
        }

        return {
          url: urlData.publicUrl,
          path: fullPath,
          bucket: targetBucket,
          filename,
          size: file.size || 0,
          type: file.type || '',
        }
      }
    } catch (err) {
      console.warn('Supabase storage upload fallback to local media store:', err?.message)
    }
  }

  // Local IndexedDB / DataURL media storage fallback
  const mediaKey = `${targetBucket}_${fullPath.replace(/\//g, '_')}`
  const localUrl = file ? await storeMediaFile(mediaKey, file) : ''

  if (onProgress) {
    onProgress({ loaded: file?.size || 1000, total: file?.size || 1000, percentage: 100 })
  }

  return {
    url: localUrl,
    path: fullPath,
    bucket: targetBucket,
    filename,
    size: file?.size || 0,
    type: file?.type || '',
  }
}

export async function uploadResumable(file, originalName, options = {}) {
  return upload(file, originalName, options)
}

export async function remove(path, bucket = null) {
  if (isSupabaseConfigured) {
    try {
      await supabase.storage.from(bucket || DEFAULT_BUCKET).remove([path])
    } catch {}
  }
  return true
}

export function getPublicUrl(path, bucket = null) {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('idb://') || path.startsWith('synth://')) {
    return path
  }
  if (isSupabaseConfigured) {
    const { data } = supabase.storage.from(bucket || DEFAULT_BUCKET).getPublicUrl(path)
    return data?.publicUrl || path
  }
  return path
}

export async function getSignedUrl(path, bucket = null, expiresIn = 3600) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage.from(bucket || DEFAULT_BUCKET).createSignedUrl(path, expiresIn)
      if (!error && data?.signedUrl) return data.signedUrl
    } catch {}
  }
  return getPublicUrl(path, bucket)
}

export async function list(folderPath, bucket = null, options = {}) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage.from(bucket || DEFAULT_BUCKET).list(folderPath, options)
      if (!error && data) return data
    } catch {}
  }
  return []
}

export async function download(path, bucket = null) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage.from(bucket || DEFAULT_BUCKET).download(path)
      if (!error && data) return data
    } catch {}
  }
  const res = await fetch(path)
  return res.blob()
}

export async function uploadSong(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.songs,
    onProgress: metadata.onProgress,
  })
}

export async function uploadCover(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.covers,
    onProgress: metadata.onProgress,
  })
}

export async function uploadBanner(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.banners,
    onProgress: metadata.onProgress,
  })
}

export async function uploadSongThemeAsset(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.themes,
    onProgress: metadata.onProgress,
  })
}

export async function uploadProfileImage(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.profiles,
    onProgress: metadata.onProgress,
  })
}

export async function uploadDocument(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.documents,
    onProgress: metadata.onProgress,
  })
}

export const storage = {
  upload,
  uploadResumable,
  delete: remove,
  getPublicUrl,
  getSignedUrl,
  list,
  download,
  uploadSong,
  uploadCover,
  uploadBanner,
  uploadSongThemeAsset,
  uploadProfileImage,
  uploadDocument,
  buckets: BUCKETS,
}

export default storage
